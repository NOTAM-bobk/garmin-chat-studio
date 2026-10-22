import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Dumbbell,
  Heart,
  Loader2,
  Moon,
  MoreHorizontal,
  PenLine,
  Plug,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Square,
  Sparkles,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Unplug,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Thinking, ToolActivity } from "@/components/chat/AgentTrace";
import { ChatChart } from "@/components/chat/ChatChart";
import { OnboardingDialog } from "@/components/chat/OnboardingDialog";
import { RenameDialog } from "@/components/chat/RenameDialog";
import { SettingsDialog } from "@/components/chat/SettingsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { parseChartSpec } from "@/lib/chart";
import {
  describeTool,
  formatBytes,
  toolSpecs,
  type GarminStatus,
  type GarminTool,
  type ToolResult,
} from "@/lib/garmin";
import { loadChats, saveChats, uid, type Chat, type Message, type TraceStep } from "@/lib/chat";
import {
  CURATED_MODELS,
  DEFAULT_TONE,
  TONES,
  mergeModels,
  toneById,
  type ModelOption,
  type ToneId,
} from "@/lib/models";
import { haptic, readHapticsSetting, writeHapticsSetting } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { listPuterModels, loadPuter, nameChat, runRound, type AgentMessage } from "@/lib/puter";
import { useSteadyReveal } from "@/lib/useSteadyReveal";

const TONE_KEY = "garmin-chat:tone";
const MODEL_KEY = "garmin-chat:model";
const ONBOARDED_KEY = "garmin-chat:onboarded:v1";
const FENCE = "```";

const SUGGESTIONS = [
  {
    icon: Moon,
    title: "Sleep debrief",
    prompt: "How did I sleep this week? Point out what changed and what to fix first.",
  },
  {
    icon: Zap,
    title: "Readiness check",
    prompt: "Why is my training readiness where it is today? Walk me through the drivers.",
  },
  {
    icon: Activity,
    title: "Compare my runs",
    prompt: "Compare my last three runs — pace, heart rate, and how hard they actually were.",
  },
  {
    icon: Dumbbell,
    title: "Plan the week",
    prompt: "Build my next 7 days of training from my current load, then schedule the workouts.",
  },
] as const;

const MAX_TOOL_ROUNDS = 5;

function systemPrompt(status: GarminStatus | null, toolCount: number, toneId: ToneId): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const tone = toneById(toneId).prompt;
  const connection = status?.connected
    ? `The user's Garmin Connect account is connected with ${toolCount} tools available.`
    : "The user's Garmin account is NOT connected, so you cannot read their data. Tell them to press Connect Garmin, then continue helping with general training questions.";

  return `You are Garmin Chat, a training analyst with live read access to the user's Garmin Connect account through MCP tools.
Today is ${weekday}, ${today}. ${connection}

${tone}

How to answer:
- Ground every claim about the user in tool output. Call a tool before answering questions about their metrics, and never invent numbers, dates, activity names or workouts.
- Plan the lookup: cheapest summary first, then drill into the one metric that changes the answer. Skip tools whose data cannot affect the reply.
- Turn relative dates into explicit YYYY-MM-DD ranges ending today.
- Compare against the user's own baseline (7 or 30 days), not population averages, and quote the delta with numbers.
- Cross-check related signals (sleep, HRV, resting HR, load, readiness) before recommending a change. If two signals disagree, name the conflict and say which one you trust.
- When data is thin or a tool fails, say exactly what is missing and what you can still conclude.
- Be decisive: one most likely explanation and one concrete next step, not a menu of maybes.
- You may create and schedule workouts when asked. State exactly what you created.
- This is training guidance, not medical advice. Keep any safety note to a single short line.

Charts:
- When a trend, comparison or distribution reads better as a chart, emit exactly one chart block and keep the prose around it to two sentences.
- A chart block is a fenced code block tagged ${FENCE}chart containing one line of valid JSON:
${FENCE}chart
{"type":"line","title":"Sleep score","unit":"score","x":["Oct 12","Oct 13"],"series":[{"name":"Score","data":[72,80]}]}
${FENCE}
- "type" is line, bar or area. "x" holds 3-21 short labels; each series needs the same count of plain numbers; up to 3 series. Optional "unit" is a short label.
- Only chart numbers you actually retrieved. Do not repeat the same values as a table, and never nest one code fence inside another.

Style:
- Markdown, short paragraphs. Finding first, evidence second, next step last. No preamble like "Sure" or "Here's".
- Default under 200 words; go longer only for a plan or a deep dive.`;
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; error?: { message?: unknown } };
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.error?.message === "string" && record.error.message) {
      return record.error.message;
    }
  }
  return "Something went wrong. Please try again.";
}

export function ChatApp() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(CURATED_MODELS[0]!.id);
  const [models, setModels] = useState<ModelOption[]>(CURATED_MODELS);
  const [tone, setTone] = useState<ToneId>(DEFAULT_TONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [renamingChat, setRenamingChat] = useState<Chat | null>(null);

  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [garminTools, setGarminTools] = useState<GarminTool[]>([]);
  const [toolsError, setToolsError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const connected = status?.connected ?? false;
  const activeChat = chats.find((chat) => chat.id === activeId) ?? null;
  const toolsAvailable = garminTools.length || status?.tools || 0;
  const modelLabel = models.find((option) => option.id === model)?.label ?? model;
  const toneLabel = TONES.find((option) => option.id === tone)?.label ?? tone;

  useEffect(() => {
    setChats(loadChats());
    setHydrated(true);
    const savedTone = localStorage.getItem(TONE_KEY);
    if (savedTone && TONES.some((option) => option.id === savedTone)) {
      setTone(savedTone as ToneId);
    }
    const savedModel = localStorage.getItem(MODEL_KEY);
    if (savedModel) setModel(savedModel);
    setHaptics(readHapticsSetting());
    try {
      if (localStorage.getItem(ONBOARDED_KEY) !== "1") setWelcomeOpen(true);
    } catch {
      // Storage blocked: skip the one-time welcome rather than looping it.
    }
    loadPuter().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (hydrated) saveChats(chats);
  }, [chats, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(MODEL_KEY, model);
    } catch {
      // Private mode: the pick still applies for this session.
    }
  }, [model, hydrated]);

  // Pull Puter's live catalogue so the picker grows with what the SDK offers.
  useEffect(() => {
    let cancelled = false;
    void listPuterModels().then((list) => {
      if (cancelled || list.length === 0) return;
      setModels(mergeModels(list));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTools = useCallback(async (): Promise<GarminTool[]> => {
    try {
      const response = await fetch("/api/garmin/tools", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        tools?: GarminTool[];
        available?: number;
        error?: string;
      };
      if (response.status === 401) {
        setStatus((previous) => (previous ? { ...previous, connected: false } : previous));
        setGarminTools([]);
        setToolsError(payload.error ?? "Garmin session expired.");
        return [];
      }
      if (!response.ok) throw new Error(payload.error ?? "Could not load Garmin tools.");
      const tools = payload.tools ?? [];
      setGarminTools(tools);
      setToolsError(null);
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              connected: true,
              available: payload.available ?? previous.available,
              tools: tools.length || previous.tools,
            }
          : previous,
      );
      return tools;
    } catch (caught) {
      setToolsError(errorText(caught));
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/garmin/status", { cache: "no-store" });
        const payload = (await response.json()) as GarminStatus;
        if (cancelled) return;
        setStatus(payload);
        if (payload.connected) await refreshTools();
      } catch {
        if (!cancelled) {
          setStatus({ connected: false, configured: true, tools: 0, available: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTools]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("garmin");
    if (!outcome) return;
    if (outcome === "connected") {
      toast.success("Garmin connected", {
        description: "Ask about your sleep, recovery, or training load.",
      });
    } else if (outcome === "error") {
      toast.error("Garmin connection failed", {
        description: params.get("reason") ?? "Please try again.",
      });
    }
    params.delete("garmin");
    params.delete("reason");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    if (!stickRef.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [activeChat?.messages]);

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  const newChat = useCallback(() => {
    haptic("tap");
    abortRef.current?.abort();
    setActiveId(null);
    setMobileSidebar(false);
    setError(null);
    setInput("");
    stickRef.current = true;
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        newChat();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newChat]);

  function deleteChat(id: string) {
    haptic("warn");
    setChats((previous) => previous.filter((chat) => chat.id !== id));
    if (activeId === id) setActiveId(null);
    if (renamingChat?.id === id) setRenamingChat(null);
  }

  function clearChats() {
    haptic("warn");
    abortRef.current?.abort();
    setChats([]);
    setActiveId(null);
    setError(null);
    toast("All chats deleted", { description: "Saved threads are gone from this browser." });
  }

  function startRename(chat: Chat) {
    haptic("tap");
    setRenamingChat(chat);
  }

  function commitRename(title: string) {
    const id = renamingChat?.id;
    setRenamingChat(null);
    if (!id) return;
    haptic("done");
    setChats((previous) => previous.map((chat) => (chat.id === id ? { ...chat, title } : chat)));
  }

  /** Let the model write a short thread title from the conversation so far. */
  async function titleChat(chat: Pick<Chat, "id" | "messages">, notify: boolean) {
    const seed = chat.messages
      .filter((message) => message.content.trim())
      .map((message) => ({ role: message.role, content: message.content }));
    if (seed.length === 0) return;
    try {
      const title = await nameChat(seed, model);
      if (!title) throw new Error("No title returned");
      setChats((previous) =>
        previous.map((entry) => (entry.id === chat.id ? { ...entry, title } : entry)),
      );
      if (notify) toast("Chat renamed", { description: title });
    } catch {
      if (notify) {
        toast.error("Couldn't name this chat", {
          description: "The model didn't reply with a title. Try again.",
        });
      }
    }
  }

  function chooseTone(next: ToneId) {
    setTone(next);
    try {
      localStorage.setItem(TONE_KEY, next);
    } catch {
      // Private mode: the tone still applies for this session.
    }
  }

  function chooseHaptics(next: boolean) {
    setHaptics(next);
    writeHapticsSetting(next);
  }

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // Ignore storage failures; the dialog just closes for this session.
    }
  }, []);

  function connectGarmin() {
    haptic("tap");
    if (status && !status.configured) {
      toast.error("Garmin isn't configured", {
        description: "Add SESSION_SECRET to this deployment's environment variables.",
      });
      return;
    }
    window.location.assign("/api/garmin/connect");
  }

  async function disconnectGarmin() {
    haptic("warn");
    try {
      await fetch("/api/garmin/disconnect", { method: "POST" });
    } catch {
      // Cookie clearing is best-effort; local state still resets.
    }
    setGarminTools([]);
    setToolsError(null);
    setStatus((previous) =>
      previous ? { ...previous, connected: false, available: 0 } : previous,
    );
    toast("Garmin disconnected", { description: "Your token cookie has been cleared." });
  }

  async function requestTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch("/api/garmin/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
    });
    const payload = (await response.json().catch(() => ({}))) as Partial<ToolResult> & {
      error?: string;
    };
    if (response.status === 401) {
      setStatus((previous) => (previous ? { ...previous, connected: false } : previous));
      setGarminTools([]);
      throw new Error(payload.error ?? "Garmin session expired. Reconnect to continue.");
    }
    if (!response.ok) {
      throw new Error(payload.error ?? `Garmin tool "${name}" failed.`);
    }
    return {
      ok: payload.ok ?? true,
      isError: payload.isError ?? false,
      text: payload.text ?? "No data returned.",
    };
  }

  /** Stream one assistant turn into an existing (empty) assistant message. */
  async function runTurn(args: {
    chatId: string;
    assistantId: string;
    /** History up to and including the user message being answered. */
    prior: Message[];
  }): Promise<string> {
    const { chatId, assistantId, prior } = args;
    let streamed = "";

    const patchMessage = (patch: (message: Message) => Message) => {
      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updated: Date.now(),
                messages: chat.messages.map((message) =>
                  message.id === assistantId ? patch(message) : message,
                ),
              }
            : chat,
        ),
      );
    };

    const addStep = (step: TraceStep) => {
      patchMessage((message) => ({ ...message, steps: [...message.steps, step] }));
    };

    const patchStep = (id: string, patch: Partial<TraceStep>) => {
      patchMessage((message) => ({
        ...message,
        steps: message.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
      }));
    };

    const appendText = (delta: string) => {
      streamed += delta;
      patchMessage((message) => ({ ...message, content: message.content + delta }));
    };

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    let tools = connected ? toolSpecs(garminTools) : [];
    if (connected && tools.length === 0) {
      const loaded = await refreshTools();
      tools = toolSpecs(loaded);
    }

    const history: AgentMessage[] = [
      { role: "system", content: systemPrompt(status, tools.length, tone) },
      ...prior.map((message) => ({ role: message.role, content: message.content })),
    ];

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) break;

        const thinkingId = `thinking-${assistantId}-${round}`;
        const thinkingStart = performance.now();
        addStep({
          id: thinkingId,
          kind: "thinking",
          label: round === 0 ? "Thinking" : "Reviewing your data",
          status: "active",
        });

        const turn = await runRound(history, {
          model,
          signal: controller.signal,
          ...(tools.length > 0 && round < MAX_TOOL_ROUNDS - 1 ? { tools } : {}),
          onEvent: (event) => {
            if (event.type === "reasoning") {
              setChats((previous) =>
                previous.map((chat) =>
                  chat.id === chatId
                    ? {
                        ...chat,
                        messages: chat.messages.map((message) => {
                          if (message.id !== assistantId) return message;
                          return {
                            ...message,
                            steps: message.steps.map((step) =>
                              step.id === thinkingId
                                ? {
                                    ...step,
                                    text: `${step.text ?? ""}${event.text}`.slice(0, 8000),
                                  }
                                : step,
                            ),
                          };
                        }),
                      }
                    : chat,
                ),
              );
              return;
            }

            if (event.type === "text") {
              appendText(event.text);
              return;
            }

            // A tool call ends the thinking phase for this round.
            patchStep(thinkingId, {
              status: "done",
              ms: performance.now() - thinkingStart,
            });
            const { label, detail } = describeTool(event.call.name, event.call.input);
            addStep({
              id: `tool-${event.call.id}`,
              kind: "tool",
              label,
              tool: event.call.name,
              ...(detail ? { detail } : {}),
              status: "active",
            });
          },
        });

        if (controller.signal.aborted) break;

        patchStep(thinkingId, {
          status: "done",
          ms: performance.now() - thinkingStart,
        });
        history.push(turn.assistant);

        if (turn.toolCalls.length === 0) break;

        for (const call of turn.toolCalls) {
          if (controller.signal.aborted) break;
          const stepId = `tool-${call.id}`;
          const startedAt = performance.now();
          try {
            const result = await requestTool(call.name, call.input);
            history.push({ role: "tool", tool_call_id: call.id, content: result.text });
            patchStep(stepId, {
              status: result.ok ? "done" : "error",
              ms: performance.now() - startedAt,
              preview: `${formatBytes(result.text)} · ${result.ok ? "loaded" : "tool reported an error"}`,
            });
          } catch (caught) {
            const message = errorText(caught);
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content: `Error: ${message}`,
            });
            patchStep(stepId, {
              status: "error",
              ms: performance.now() - startedAt,
              preview: message.slice(0, 140),
            });
          }
        }
      }

      if (controller.signal.aborted) {
        patchMessage((message) => ({
          ...message,
          content: message.content || "Stopped.",
          steps: message.steps.map((step) =>
            step.status === "active"
              ? { ...step, status: "done", label: `${step.label} · stopped` }
              : step,
          ),
        }));
      } else {
        patchMessage((message) => {
          if (message.content.trim()) return message;
          return {
            ...message,
            content:
              "I looked at your Garmin data but couldn't settle on an answer. Try asking a narrower question — for example a specific date range.",
            steps: message.steps.map((step) =>
              step.status === "active" ? { ...step, status: "done" } : step,
            ),
          };
        });
      }
    } catch (caught) {
      if (controller.signal.aborted || isAbort(caught)) {
        patchMessage((message) => ({
          ...message,
          steps: message.steps.map((step) =>
            step.status === "active" ? { ...step, status: "done" } : step,
          ),
        }));
      } else {
        const message = errorText(caught);
        setError(message);
        patchMessage((existing) => ({
          ...existing,
          error: message,
          steps: existing.steps.map((step) =>
            step.status === "active" ? { ...step, status: "error" } : step,
          ),
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }

    return streamed;
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;

    haptic("tap");
    setError(null);
    setInput("");
    stickRef.current = true;

    const userMessage: Message = { id: uid(), role: "user", content: text, steps: [] };
    const assistantId = uid();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      steps: [],
    };

    const prior = [...(activeChat?.messages ?? []), userMessage];
    const chatId = activeChat?.id ?? uid();

    if (activeChat) {
      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: [...prior, assistantMessage], updated: Date.now() }
            : chat,
        ),
      );
    } else {
      setChats((previous) => [
        {
          id: chatId,
          title: text.slice(0, 52),
          messages: [...prior, assistantMessage],
          updated: Date.now(),
        },
        ...previous,
      ]);
      setActiveId(chatId);
    }

    const reply = await runTurn({ chatId, assistantId, prior });

    // The first answer names the thread, so the sidebar reads like topics.
    if (!activeChat) {
      void titleChat(
        { id: chatId, messages: [...prior, { ...assistantMessage, content: reply }] },
        false,
      );
    }
  }

  async function regenerate(chatId: string, messageId: string) {
    if (busy) return;
    const chat = chats.find((entry) => entry.id === chatId);
    if (!chat) return;
    const index = chat.messages.findIndex((message) => message.id === messageId);
    if (index < 1) return;
    const prior = chat.messages.slice(0, index);
    if (prior[prior.length - 1]?.role !== "user") return;

    const assistantId = uid();
    setError(null);
    stickRef.current = true;
    setChats((previous) =>
      previous.map((entry) =>
        entry.id === chatId
          ? {
              ...entry,
              updated: Date.now(),
              messages: [...prior, { id: assistantId, role: "assistant", content: "", steps: [] }],
            }
          : entry,
      ),
    );

    await runTurn({ chatId, assistantId, prior });
  }

  async function editMessage(chatId: string, messageId: string, text: string) {
    const next = text.trim();
    if (!next || busy) return;
    const chat = chats.find((entry) => entry.id === chatId);
    if (!chat) return;
    const index = chat.messages.findIndex((message) => message.id === messageId);
    const target = chat.messages[index];
    if (!target || target.role !== "user") return;

    const edited: Message = { ...target, content: next };
    const prior = [...chat.messages.slice(0, index), edited];
    const assistantId = uid();
    setError(null);
    stickRef.current = true;
    setChats((previous) =>
      previous.map((entry) =>
        entry.id === chatId
          ? {
              ...entry,
              updated: Date.now(),
              messages: [...prior, { id: assistantId, role: "assistant", content: "", steps: [] }],
            }
          : entry,
      ),
    );

    await runTurn({ chatId, assistantId, prior });
  }

  function setFeedback(chatId: string, messageId: string, value: "up" | "down") {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id !== chatId
          ? chat
          : {
              ...chat,
              messages: chat.messages.map((message) => {
                if (message.id !== messageId) return message;
                const next: Message = { ...message };
                delete next.feedback;
                if (message.feedback !== value) next.feedback = value;
                return next;
              }),
            },
      ),
    );
  }

  const liveStep = busy
    ? [...(activeChat?.messages ?? [])]
        .reverse()
        .flatMap((message) => [...message.steps].reverse())
        .find((step) => step.status === "active")
    : undefined;

  const sendButton = busy ? (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        abortRef.current?.abort();
      }}
      aria-label="Stop generating"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
    >
      <Square className="size-2.5 fill-current" />
    </button>
  ) : (
    <button
      type="submit"
      disabled={!input.trim()}
      aria-label="Send message"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform enabled:hover:opacity-90 disabled:opacity-20 active:scale-95"
    >
      <ArrowUp className="size-4" strokeWidth={2.5} />
    </button>
  );

  const composer = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send(input);
      }}
      className="rounded-[26px] border border-border bg-card p-2 shadow-composer transition-shadow focus-within:border-foreground/15 focus-within:shadow-composer-focus"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send(input);
          }
        }}
        placeholder={connected ? "Ask about your training" : "Ask anything"}
        aria-label="Message"
        className="max-h-[220px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-1 px-0.5">
        {connected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Garmin live
            <span className="text-muted-foreground/70">· {toolsAvailable} tools</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={connectGarmin}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plug className="size-3" />
            Connect Garmin
          </button>
        )}

        <label className="relative ml-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <SlidersHorizontal className="size-3" />
          {toneLabel}
          <ChevronDown className="size-3" />
          <select
            value={tone}
            onChange={(event) => {
              haptic("select");
              chooseTone(event.target.value as ToneId);
            }}
            aria-label="Answer tone"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {TONES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {sendButton}
      </div>
    </form>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Toaster position="top-center" />

      <OnboardingDialog
        open={welcomeOpen}
        onOpenChange={(next) => (next ? setWelcomeOpen(true) : closeWelcome())}
        connected={connected}
        configured={status?.configured ?? true}
        tools={toolsAvailable}
        onConnect={() => {
          closeWelcome();
          connectGarmin();
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        models={models}
        model={model}
        onModelChange={setModel}
        tone={tone}
        onToneChange={(next) => {
          chooseTone(next);
        }}
        connected={connected}
        configured={status?.configured ?? true}
        tools={toolsAvailable}
        onConnect={() => {
          setSettingsOpen(false);
          connectGarmin();
        }}
        onDisconnect={() => void disconnectGarmin()}
        haptics={haptics}
        onHapticsChange={chooseHaptics}
        onHapticTest={haptic}
        chatCount={chats.length}
        onClearChats={clearChats}
      />

      <RenameDialog
        open={!!renamingChat}
        initialTitle={renamingChat?.title ?? ""}
        onOpenChange={(next) => {
          if (!next) setRenamingChat(null);
        }}
        onSave={commitRename}
      />

      {mobileSidebar && (
        <div
          className="fixed inset-0 z-30 bg-foreground/25 md:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar transition-transform duration-200 md:static md:translate-x-0",
          mobileSidebar ? "translate-x-0" : "-translate-x-full",
          sidebarOpen ? "md:flex" : "md:hidden",
        )}
      >
        <div className="flex items-center justify-between px-2 py-2">
          <NavToggle
            open
            label="Close sidebar"
            onClick={() => {
              setMobileSidebar(false);
              setSidebarOpen(false);
            }}
            className="hover:bg-sidebar-accent"
          />
          <button
            onClick={newChat}
            aria-label="New chat"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <SquarePen className="size-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {chats.length === 0 ? (
            <p className="px-3 py-6 text-[13px] leading-relaxed text-muted-foreground">
              No chats yet.
            </p>
          ) : (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Chats</p>
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "group flex items-center rounded-lg transition-colors",
                    chat.id === activeId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70",
                  )}
                >
                  <button
                    onClick={() => {
                      haptic("tap");
                      setActiveId(chat.id);
                      setMobileSidebar(false);
                    }}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13.5px]"
                  >
                    {chat.title || "New chat"}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Actions for ${chat.title}`}
                        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-sidebar-border/50 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                      <DropdownMenuItem onSelect={() => startRename(chat)}>
                        <PenLine />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void titleChat(chat, true)}>
                        <Sparkles />
                        Name with AI
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => deleteChat(chat.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 />
                        Delete chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t border-sidebar-border/80 p-2">
          {connected ? (
            <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="min-w-0 flex-1 truncate text-[12.5px]">Garmin connected</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{toolsAvailable}</span>
              <button
                onClick={() => void disconnectGarmin()}
                aria-label="Disconnect Garmin"
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Unplug className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={connectGarmin}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Plug className="size-3.5" />
              Connect Garmin
            </button>
          )}

          <div className="mt-1 space-y-0.5 border-t border-sidebar-border/60 pt-1">
            <button
              onClick={() => {
                haptic("tap");
                setSettingsOpen(true);
                setMobileSidebar(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Settings2 className="size-3.5" />
              Settings
            </button>
            <button
              onClick={() => setWelcomeOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <CircleHelp className="size-3.5" />
              How it works
            </button>
            <a
              href="https://fundrazr.com/62nDBa"
              target="_blank"
              rel="noreferrer noopener"
              className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Heart className="size-3.5 text-rose-500 transition-transform duration-200 group-hover:scale-110" />
              Donate
              <ArrowUpRight className="ml-auto size-3 opacity-60" />
            </a>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
          <NavToggle
            open={mobileSidebar}
            label="Open sidebar"
            onClick={() => setMobileSidebar(true)}
            className="md:hidden"
          />

          {!sidebarOpen && (
            <>
              <NavToggle
                open={false}
                label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
                className="hidden md:grid"
              />
              <button
                onClick={newChat}
                aria-label="New chat"
                className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:grid"
              >
                <SquarePen className="size-5" />
              </button>
            </>
          )}

          <label className="relative ml-1 flex min-w-0 max-w-[62%] cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
            <span className="truncate text-[14.5px] font-medium">{modelLabel}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              value={model}
              onChange={(event) => {
                haptic("select");
                setModel(event.target.value);
              }}
              aria-label="Model"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {!models.some((option) => option.id === model) && (
                <option value={model}>{model}</option>
              )}
              {models.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.note ? ` — ${option.note}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-1">
            {connected ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : (
              <button
                onClick={connectGarmin}
                className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                <Plug className="size-3" />
                Connect Garmin
              </button>
            )}
            <button
              onClick={newChat}
              aria-label="New chat"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
            >
              <SquarePen className="size-5" />
            </button>
          </div>
        </header>

        {!activeChat ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16">
            <h1 className="text-center text-[26px] font-medium tracking-tight sm:text-[30px]">
              Ask me about your training
            </h1>
            <p className="mt-2 max-w-md text-center text-[13.5px] leading-relaxed text-muted-foreground">
              {connected
                ? `${toolsAvailable} Garmin tools are live. Sleep, recovery, load and workouts — read as we go.`
                : "Connect Garmin to read your sleep, recovery and workouts inside the chat."}
            </p>

            <div className="mt-6 w-full max-w-3xl">{composer}</div>

            {liveStep && (
              <div
                className="mt-3 flex w-full max-w-3xl items-center gap-2 px-2 text-[12px] text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="size-3 animate-spin" />
                <span className="shimmer-text truncate">
                  {liveStep.kind === "tool"
                    ? `${liveStep.label}${liveStep.detail ? ` · ${liveStep.detail}` : ""}`
                    : liveStep.label}
                </span>
              </div>
            )}

            <div className="mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.title}
                  onClick={() => void send(suggestion.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-foreground hover:shadow-sm"
                >
                  <suggestion.icon className="size-3.5" strokeWidth={1.9} />
                  {suggestion.title}
                </button>
              ))}
            </div>

            <p className="mt-5 text-center text-[11.5px] text-muted-foreground/80">
              AI can make mistakes. Not medical advice.
            </p>

            {error && (
              <div className="mt-4 flex w-full max-w-3xl items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="shrink-0 text-[11.5px] underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {toolsError && !error && (
              <p className="mt-3 text-center text-[11.5px] text-muted-foreground">{toolsError}</p>
            )}
          </div>
        ) : (
          <>
            <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-6">
                {activeChat.messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    running={busy && message.id === activeChat.messages.at(-1)?.id}
                    canRegenerate={
                      !busy &&
                      message.role === "assistant" &&
                      index === activeChat.messages.length - 1 &&
                      activeChat.messages[index - 1]?.role === "user"
                    }
                    canEdit={!busy}
                    onEdit={(text) => void editMessage(activeChat.id, message.id, text)}
                    onRegenerate={() => void regenerate(activeChat.id, message.id)}
                    onFeedback={(value) => setFeedback(activeChat.id, message.id, value)}
                  />
                ))}
                <div ref={endRef} className="h-2" />
              </div>
            </div>

            <div className="shrink-0 bg-background">
              <div className="mx-auto w-full max-w-3xl px-4 pb-3">
                {liveStep && (
                  <div
                    className="mb-2 flex items-center gap-2 px-2 text-[12px] text-muted-foreground"
                    aria-live="polite"
                  >
                    <Loader2 className="size-3 animate-spin" />
                    <span className="shimmer-text truncate">
                      {liveStep.kind === "tool"
                        ? `${liveStep.label}${liveStep.detail ? ` · ${liveStep.detail}` : ""}`
                        : liveStep.label}
                    </span>
                  </div>
                )}

                {composer}

                <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
                  AI can make mistakes. Not medical advice.
                </p>

                {error && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                    <button
                      onClick={() => setError(null)}
                      className="shrink-0 text-[11.5px] underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const markdownComponents: Components = {
  pre({ children }) {
    const first = Array.isArray(children) ? children[0] : children;
    const className = (first as { props?: { className?: unknown } } | null)?.props?.className;
    if (typeof className === "string" && className.includes("language-chart")) {
      return <>{children}</>;
    }
    return <pre>{children}</pre>;
  },
  code({ className, children }) {
    if (typeof className === "string" && className.includes("language-chart")) {
      const raw = String(children ?? "").trim();
      const spec = parseChartSpec(raw);
      if (spec) return <ChatChart spec={spec} />;
      return (
        <div className="my-3 overflow-x-auto whitespace-pre rounded-xl border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {raw}
        </div>
      );
    }
    return <code className={className}>{children}</code>;
  },
};

function MessageBubble({
  message,
  running,
  canRegenerate,
  canEdit,
  onEdit,
  onRegenerate,
  onFeedback,
}: {
  message: Message;
  running: boolean;
  canRegenerate: boolean;
  canEdit: boolean;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (value: "up" | "down") => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const revealed = useSteadyReveal(message.content, running);
  const revealing = running && revealed.length < message.content.length;
  const markdown = useMemo(
    () => (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {revealed}
      </ReactMarkdown>
    ),
    [revealed],
  );

  if (message.role === "user") {
    if (editing) {
      return (
        <div className="animate-in fade-in-0 flex flex-col items-end duration-200">
          <div className="w-full max-w-[92%] sm:max-w-[85%]">
            <textarea
              autoFocus
              value={draft}
              rows={3}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(message.content);
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!draft.trim()) return;
                  setEditing(false);
                  onEdit(draft);
                }
              }}
              aria-label="Edit your prompt"
              className="w-full resize-none rounded-2xl border border-border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-foreground/25"
            />
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.content);
                }}
                className="rounded-lg px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => {
                  setEditing(false);
                  onEdit(draft);
                }}
                className="rounded-lg bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Save & redo
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group animate-in fade-in-0 slide-in-from-bottom-1 flex justify-end duration-200">
        <div className="flex max-w-[92%] items-end gap-1 sm:max-w-[85%]">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setDraft(message.content);
                setEditing(true);
              }}
              aria-label="Edit your prompt"
              title="Edit prompt"
              className="mb-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <PenLine className="size-3.5" />
            </button>
          )}
          <div className="whitespace-pre-wrap rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const empty = !revealed && message.steps.length === 0 && !message.error;

  const actions: {
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    active: boolean;
    wide?: boolean;
  }[] = [
    {
      key: "copy",
      label: copied ? "Copied" : "Copy answer",
      icon: copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />,
      onClick: () => {
        haptic("select");
        void navigator.clipboard
          ?.writeText(message.content)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      },
      active: copied,
    },
    ...(canRegenerate
      ? [
          {
            key: "regenerate",
            label: "Redo answer",
            icon: <RotateCcw className="size-3.5" />,
            onClick: () => {
              haptic("tap");
              onRegenerate();
            },
            active: false,
            wide: true,
          },
        ]
      : []),
    {
      key: "up",
      label: "Good answer",
      icon: <ThumbsUp className="size-3.5" />,
      onClick: () => {
        haptic("select");
        onFeedback("up");
      },
      active: message.feedback === "up",
    },
    {
      key: "down",
      label: "Bad answer",
      icon: <ThumbsDown className="size-3.5" />,
      onClick: () => {
        haptic("select");
        onFeedback("down");
      },
      active: message.feedback === "down",
    },
  ];

  return (
    <div className="group animate-in fade-in-0 duration-300">
      <Thinking steps={message.steps} running={running} />
      <ToolActivity steps={message.steps} running={running} />

      {empty && running && (
        <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
        </div>
      )}

      {revealed && (
        <div
          className={cn("prose-chat reveal-text", revealing && "is-revealing")}
          aria-busy={revealing || undefined}
        >
          {markdown}
          {revealing && <span className="reveal-caret" aria-hidden="true" />}
        </div>
      )}

      {message.error && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{message.error}</span>
        </div>
      )}

      {!running && (
        <div className="mt-1.5 flex items-center gap-0.5 text-muted-foreground">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={action.onClick}
              aria-label={action.label}
              aria-pressed={action.active || undefined}
              title={action.label}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md transition-colors hover:bg-accent hover:text-foreground active:scale-[0.97]",
                action.wide ? "px-1.5 text-[11.5px]" : "w-7 justify-center",
                action.active && "text-foreground",
              )}
            >
              {action.icon}
              {action.wide && <span>Redo</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Two unequal lines that morph into an X — the sidebar trigger. */
function NavToggle({
  open,
  label,
  onClick,
  className,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      title={label}
      className={cn(
        "group grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.97]",
        className,
      )}
    >
      <span className="relative block h-3 w-[18px]">
        <span
          className={cn(
            "absolute left-0 top-0 h-[1.6px] rounded-full bg-current transition-all duration-300 ease-out",
            open ? "w-[18px] translate-y-[4.6px] rotate-45" : "w-[18px]",
          )}
        />
        <span
          className={cn(
            "absolute left-0 top-[9px] h-[1.6px] rounded-full bg-current transition-all duration-300 ease-out",
            open ? "w-[18px] -translate-y-[4.6px] -rotate-45" : "w-[11px] group-hover:w-[15px]",
          )}
        />
      </span>
    </button>
  );
}
