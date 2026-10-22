import { useCallback, useEffect, useRef, useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Dumbbell,
  Loader2,
  Menu,
  Moon,
  PanelLeft,
  Plug,
  Square,
  SquarePen,
  Trash2,
  TriangleAlert,
  Unplug,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AgentTrace } from "@/components/chat/AgentTrace";
import { Toaster } from "@/components/ui/sonner";
import {
  describeTool,
  formatBytes,
  toolSpecs,
  type GarminStatus,
  type GarminTool,
  type ToolResult,
} from "@/lib/garmin";
import { loadChats, saveChats, uid, type Chat, type Message, type TraceStep } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { loadPuter, runRound, type AgentMessage } from "@/lib/puter";

const MODELS = [
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "fast" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", note: "balanced" },
  { id: "gpt-5.5", label: "GPT-5.5", note: "deep" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", note: "careful" },
];

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

function systemPrompt(status: GarminStatus | null, toolCount: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const connection = status?.connected
    ? `The user's Garmin Connect account is connected with ${toolCount} tools available.`
    : "The user's Garmin account is NOT connected, so you cannot read their data. Tell them to press Connect Garmin, then continue helping with general training questions.";

  return `You are Garmin Chat, a training analyst with live read access to the user's Garmin Connect account.
Today is ${today}. ${connection}

Rules:
- When a question depends on the user's own metrics, call a tool before answering. Never invent numbers, activity names, or dates.
- Turn relative dates ("this week", "last night") into explicit YYYY-MM-DD ranges, ending today.
- Prefer summary tools; only pull time series when the detail matters.
- Cross-check signals (sleep, HRV, resting HR, load, readiness) before recommending a change.
- Answer in tight markdown: the finding first, the evidence behind it, then one clear next step. Keep it under 200 words unless asked for a plan.
- You may create workouts or schedule them when asked. Say what you scheduled.
- If data is missing, say so plainly instead of guessing. This is not medical advice.`;
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
  const [model, setModel] = useState<string>(MODELS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

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

  useEffect(() => {
    setChats(loadChats());
    setHydrated(true);
    loadPuter().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (hydrated) saveChats(chats);
  }, [chats, hydrated]);

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
    setChats((previous) => previous.filter((chat) => chat.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function connectGarmin() {
    if (status && !status.configured) {
      toast.error("Garmin isn't configured", {
        description: "Add SESSION_SECRET to this deployment's environment variables.",
      });
      return;
    }
    window.location.assign("/api/garmin/connect");
  }

  async function disconnectGarmin() {
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

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;

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

    const priorMessages = activeChat?.messages ?? [];

    const chatId = activeChat?.id ?? uid();
    if (activeChat) {
      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, userMessage, assistantMessage],
                updated: Date.now(),
              }
            : chat,
        ),
      );
    } else {
      setChats((previous) => [
        {
          id: chatId,
          title: text.slice(0, 52),
          messages: [userMessage, assistantMessage],
          updated: Date.now(),
        },
        ...previous,
      ]);
      setActiveId(chatId);
    }

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
      { role: "system", content: systemPrompt(status, tools.length) },
      ...priorMessages
        .filter((message) => message.content.trim().length > 0)
        .map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: text },
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
                                    text: `${step.text ?? ""}${event.text}`.slice(0, 6000),
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
          ...(existing.content ? {} : { content: "" }),
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
  }

  const liveStep = busy
    ? [...(activeChat?.messages ?? [])]
        .reverse()
        .flatMap((message) => [...message.steps].reverse())
        .find((step) => step.status === "active")
    : undefined;

  const modelLabel = MODELS.find((option) => option.id === model)?.label ?? model;

  const sendButton = busy ? (
    <button
      type="button"
      onClick={() => abortRef.current?.abort()}
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
          {modelLabel}
          <ChevronDown className="size-3" />
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            aria-label="Model"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {MODELS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} — {option.note}
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
          <button
            onClick={() => {
              setMobileSidebar(false);
              setSidebarOpen(false);
            }}
            aria-label="Close sidebar"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeft className="size-[18px]" />
          </button>
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
                      setActiveId(chat.id);
                      setMobileSidebar(false);
                    }}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13.5px]"
                  >
                    {chat.title || "New chat"}
                  </button>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    aria-label={`Delete ${chat.title}`}
                    className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
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
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
          <button
            onClick={() => setMobileSidebar(true)}
            aria-label="Open sidebar"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
          >
            <Menu className="size-5" />
          </button>

          {!sidebarOpen && (
            <>
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:grid"
              >
                <PanelLeft className="size-5" />
              </button>
              <button
                onClick={newChat}
                aria-label="New chat"
                className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:grid"
              >
                <SquarePen className="size-5" />
              </button>
            </>
          )}

          <label className="relative ml-1 flex min-w-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
            <span className="truncate text-[14.5px] font-medium">Garmin Chat</span>
            <span className="hidden truncate text-[14.5px] text-muted-foreground sm:inline">
              {modelLabel}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              aria-label="Model"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {MODELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} — {option.note}
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
                <span className="truncate">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                {activeChat.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    running={busy && message.id === activeChat.messages.at(-1)?.id}
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
                    <span className="truncate">
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

function MessageBubble({ message, running }: { message: Message; running: boolean }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const empty = !message.content && message.steps.length === 0 && !message.error;

  return (
    <div className="group">
      <AgentTrace steps={message.steps} running={running} />

      {empty && running && (
        <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
        </div>
      )}

      {message.content && (
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}

      {message.error && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{message.error}</span>
        </div>
      )}

      {!running && message.content && (
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => {
              void navigator.clipboard
                ?.writeText(message.content)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => undefined);
            }}
            aria-label="Copy answer"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
