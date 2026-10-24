import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  CornerLeftUp,
  Dumbbell,
  Flame,
  Gauge,
  Heart,
  Loader2,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PenLine,
  Plug,
  RotateCcw,
  Route,
  Search,
  Settings2,
  Share2,
  Shuffle,
  Sparkles,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trash2,
  TriangleAlert,
  Unplug,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AgentTrace } from "@/components/chat/AgentTrace";
import { ChatChart } from "@/components/chat/ChatChart";
import { OnboardingDialog } from "@/components/chat/OnboardingDialog";
import PromptBar from "@/components/chat/PromptBar";
import { RenameDialog } from "@/components/chat/RenameDialog";
import { SearchDialog } from "@/components/chat/SearchDialog";
import { SettingsDialog } from "@/components/chat/SettingsDialog";
import { ShareDialog } from "@/components/chat/ShareDialog";
import { GlowButton } from "@/components/ui/glow-button";
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
import {
  loadChats,
  mergeChats,
  saveChats,
  uid,
  type Chat,
  type Message,
  type TraceStep,
} from "@/lib/chat";
import { chatBaseDomain, chatPath, chatSlugFromHost, chatUrlFor } from "@/lib/chat-url";
import {
  CURATED_MODELS,
  DEFAULT_TONE,
  mergeModels,
  pickVisionModel,
  type ModelOption,
} from "@/lib/models";
import {
  addMode,
  dropMode,
  loadModes,
  modeToneId,
  resolveTone,
  saveModes,
  toneOptions,
  type CustomMode,
} from "@/lib/modes";
import { APP_VERSION, BUILDER } from "@/lib/app-meta";
import { prepareImage } from "@/lib/image";
import {
  MEMORY_LIMIT,
  addMemory,
  cleanMemoryText,
  describeMemoryTool,
  dropMemory,
  isMemoryTool,
  loadMemories,
  memoryPrompt,
  memoryTools,
  replaceMemory,
  saveMemories,
  type Memory,
} from "@/lib/memory";
import { haptic, readHapticsSetting, writeHapticsSetting } from "@/lib/haptics";
import { describeWebTool, isCitationLabel, isWebTool, requestWebTool, webTools } from "@/lib/web";
import { cn } from "@/lib/utils";
import {
  listPuterModels,
  loadPuter,
  nameChat,
  primeSession,
  runRound,
  suggestFollowups,
  type AgentMessage,
} from "@/lib/puter";
import {
  SIGNED_OUT,
  loadCloudChats,
  readPuterAccount,
  saveCloudChats,
  signInToPuter,
  signOutOfPuter,
  type PuterAccount,
} from "@/lib/puter-sync";
import { useSteadyReveal } from "@/lib/useSteadyReveal";
import { ConnectDialog } from "@/components/chat/ConnectDialog";

const TONE_KEY = "garmin-chat:tone";
const MODEL_KEY = "garmin-chat:model";
const ONBOARDED_KEY = "garmin-chat:onboarded:v1";
const FENCE = "```";

const PRESETS = [
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
  {
    icon: Heart,
    title: "HRV trend",
    prompt: "Chart my HRV for the last two weeks and tell me whether the trend is real or noise.",
  },
  {
    icon: Gauge,
    title: "Resting HR",
    prompt: "Is my resting heart rate drifting up? Compare this month with last month.",
  },
  {
    icon: Flame,
    title: "Load balance",
    prompt: "Am I training too hard right now? Check my acute versus chronic load and recovery.",
  },
  {
    icon: Route,
    title: "Long run check",
    prompt: "How did my last long run go — pace drift, heart rate and fuelling signals.",
  },
  {
    icon: CalendarDays,
    title: "Taper plan",
    prompt: "Taper me into a race in ten days from my current load, then schedule the sessions.",
  },
  {
    icon: Timer,
    title: "Zone 2 check",
    prompt: "Is my easy pace actually easy? Look at my zone 2 time and heart rate drift.",
  },
  {
    icon: Activity,
    title: "Sleep vs load",
    prompt: "Does my sleep get worse after hard days? Chart sleep against training load.",
  },
  {
    icon: Dumbbell,
    title: "Strength mix",
    prompt: "How much strength work am I actually doing compared with cardio this month?",
  },
] as const;

const PRESET_COUNT = 4;
const PRESET_KEY = "garmin-chat:preset-offset";

const MAX_TOOL_ROUNDS = 6;

function systemPrompt(
  status: GarminStatus | null,
  toolCount: number,
  tonePrompt: string,
  hasImage: boolean,
  memories: Memory[],
): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const tone = tonePrompt;
  const connection = status?.connected
    ? `The user's Garmin Connect account is connected with ${toolCount} tools available.`
    : "The user's Garmin account is NOT connected, so you cannot read their data. Tell them to press Connect Garmin, then continue helping with general training questions.";
  const image = hasImage
    ? "The latest user message carries an image. Read it before answering and use it as primary evidence for that turn."
    : "No image is attached to the latest message.";
  // Personal API keys are read-only by Garmin's own terms, so promise nothing else.
  const writes =
    status?.mode === "personal"
      ? "This account is connected with a personal API key, which is read-only: you can read data but cannot create, upload or schedule workouts. Say that plainly instead of implying you did."
      : "You may create and schedule workouts when asked. State exactly what you created.";

  return `You are Garmin Chat, a training analyst with live read access to the user's Garmin Connect account through MCP tools.
Today is ${weekday}, ${today}. ${connection}
${image}

${tone}

${memoryPrompt(memories)}

How to answer:
- Ground every claim about the user in tool output or in the attached image. Never invent numbers, dates, activity names or workouts.
- Plan the lookup: cheapest summary first, then drill into the one metric that changes the answer. Skip tools whose data cannot affect the reply.
- Turn relative dates into explicit YYYY-MM-DD ranges ending today.
- Compare against the user's own baseline (7 or 30 days), not population averages, and quote the delta with numbers.
- Cross-check related signals (sleep, HRV, resting HR, load, readiness) before recommending a change. If two signals disagree, name the conflict and say which one you trust.
- When data is thin or a tool fails, say exactly what is missing and what you can still conclude.
- When the user asks for a diagnosis or a recommendation, commit: the most likely explanation and what you would do. Do not hedge across maybes.
- ${writes}
- This is training guidance, not medical advice. Keep any safety note to a single short line.

Answer shape — read the question first, then pick the structure it needs; do not reuse one template every time:
- Check-in ("how am I doing?", "is this normal?"): a one-line verdict, the number that decides it, then stop. Add a next action only if something is actually off.
- Diagnosis ("why did I fade?", "why is my HRV down?"): the most likely cause with its evidence, what else could explain it and why you discounted it, then one fix.
- Comparison ("this month vs last", "which run was harder?"): both sides on the same metrics with the deltas, then the verdict. No action unless asked.
- Plan ("what should I do this week?", "taper me"): the plan itself, day by day, with volume, intensity and the reason for each session. Do not bury it under a summary or staple one "next action" onto it.
- Explain ("what is aerobic decoupling?"): definition, the mechanism in a sentence, then what it means for their training.
- Open or exploratory ("what should I focus on?", "anything I'm missing?"): two or three genuinely different priorities, ranked, with the trade-off between them. Options are the right answer here.
- Factual or outside-the-account ("what pace is a sub-3 marathon?", "what do those shoes weigh?"): the answer, the source, the caveat. No unsolicited training advice.
- End with a "next action" only when the user is choosing what to do next. Never finish every reply with the same one-thing/one-step formula.
- Match depth to the decision: a status check gets a short answer; a plan or a why-question gets the reasoning spelled out.
- Match evidence to the question: one day wants one number and its driver, a trend wants the series, a comparison wants both sides with deltas.
- If the question is ambiguous between two metrics or date ranges, say which one you answered and why, then offer the other.
- Answer in the user's language, and keep their units (km or mi, 12h or 24h, kg or lb).
- If the previous turns already established something, build on it instead of restating it.
- When the user seems to be asking about a limitation of their device or data, say what is measurable and what is not.

Deep dives on activities:
- Every activity tool starting with get_activity reads one session: the list/summary tools give headlines, the siblings give splits, streams, weather and gear. Use them together.
- Before you characterise a session, fetch its own detail plus its splits, and its weather when conditions explain the result. One summary lookup is not a deep dive.
- Read inside the session, not just the totals: pace or power drift between the first and second half, heart-rate drift at constant effort, cadence, elevation, zone time, and the split where the fade started. Name the point it turned.
- Compare the session with the user's own 7- and 30-day baseline for the same sport, then say whether it was normal, better or worse and by how much.
- If a deeper tool is missing or errors, say which layer you could not read instead of implying the session was ordinary.

Web research:
- web_search and web_read reach the open internet for what your Garmin tools cannot answer: training science, gear specs, race rules, weather, event details, current guidance.
- Use Garmin tools for the user's own numbers and the web for what is true outside their account. A web claim never replaces a reading you could have looked up.
- Search in natural language, skim the excerpts, then read the one or two pages that actually carry the evidence. Do not describe a page you have not opened.
- Cite inline, right after the sentence the source supports, with the bare domain as the link text: [react.dev](https://react.dev/learn). Two to four sources per answer is plenty, and never invent a URL or a publication date.
- Quote numbers, sample sizes and dates exactly, and say when a source is old, single-study, or contradicted by the user's own data.
- If the web is unavailable or returns nothing useful, say so in one line and answer as general guidance.

Charts:
- Draw a chart whenever the reply compares three or more days, two or more sessions, or a distribution across zones or activity types. Keep the prose around it to two sentences; do not repeat charted values in a table.
- A chart block is a fenced code block tagged ${FENCE}chart containing one line of valid JSON:
${FENCE}chart
{"type":"line","title":"Sleep score","unit":"score","x":["Oct 12","Oct 13"],"series":[{"name":"Score","data":[72,80]}],"target":80,"targetLabel":"Goal 80","xLabel":"Night","yLabel":"Score"}
${FENCE}
- "type" is line (trend over time), bar (day-by-day comparison), area (accumulated volume or load) or pie (share of a total, exactly one series).
- "x" holds 3-31 short labels; each series needs the same number of plain numbers; up to 3 series. Optional "unit" is a short label.
- Add "target" (a number) and a short "targetLabel" whenever there is a real benchmark — a goal, a zone ceiling, a baseline average, a race pace. It draws a dashed line, so the gap is visible.
- Add "xLabel" and "yLabel" whenever the numbers alone would be ambiguous ("Night", "Week", "Load", "Sleep score"). They caption the two axes; the reader can also hover or tap for the exact values.
- Add "axis":"right" to a series only when it is on a different scale from the rest (hours against load, pace against heart rate) and both still matter. At most two scales per chart.
- Use line for shape over time, bar when the size of each day matters, area only for volume that accumulates, pie only for parts of one total.
- Use short x labels like "Oct 12" or "Tue", and name series by what they measure ("Pace", "Sleep score").
- Build the chart only from numbers you actually retrieved, and never nest one code fence inside another. If the data cannot fill a useful chart, skip it.

Images:
- The composer accepts photos: watch screens, workout summaries, race results, routes, meal or body-composition screenshots.
- Read visible values first, then say what you can and cannot read. Do not guess smudged text or partial numbers.
- Cross-check the image against Garmin data when it makes the answer stronger, and name the conflict if they disagree.
- Never describe the whole picture; answer the question the image was sent with.

Style:
- Markdown, short paragraphs. Lead with the answer, put the evidence after it, and end with what the question calls for — an action, a plan, a caveat, or nothing more. No preamble like "Sure" or "Here's".
- Default under 200 words; go longer only for a plan or a deep dive.`;
}

/** A stored message as the model expects it, with the newest attachment inlined. */
function imageAwareMessage(message: Message, withImage: boolean): AgentMessage {
  if (message.role === "user" && message.image && withImage) {
    return {
      role: "user",
      content: [
        {
          type: "text",
          text: message.content.trim() || "What can you tell me from this image?",
        },
        { type: "image_url", image_url: { url: message.image } },
      ],
    };
  }
  return { role: message.role, content: message.content };
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

export function ChatApp({ initialChatId = null }: { initialChatId?: string | null } = {}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [presetOffset, setPresetOffset] = useState(0);
  const [model, setModel] = useState<string>(CURATED_MODELS[0]!.id);
  const [models, setModels] = useState<ModelOption[]>(CURATED_MODELS);
  const [tone, setTone] = useState<string>(DEFAULT_TONE);
  const [modes, setModes] = useState<CustomMode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [account, setAccount] = useState<PuterAccount | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [haptics, setHaptics] = useState(true);
  const [renamingChat, setRenamingChat] = useState<Chat | null>(null);

  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [garminTools, setGarminTools] = useState<GarminTool[]>([]);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);

  const memoriesRef = useRef<Memory[]>([]);
  /** Slug from the address bar, used for the first message in a shared chat. */
  const pendingChatRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const connected = status?.connected ?? false;
  const activeChat = chats.find((chat) => chat.id === activeId) ?? null;
  const toolsAvailable = garminTools.length || status?.tools || 0;
  const modelLabel = models.find((option) => option.id === model)?.label ?? model;

  // A different window of presets each load, so the empty state doesn't go stale.
  const presets = useMemo(
    () =>
      Array.from(
        { length: Math.min(PRESET_COUNT, PRESETS.length) },
        (_, index) => PRESETS[(presetOffset + index) % PRESETS.length]!,
      ),
    [presetOffset],
  );

  useEffect(() => {
    setChats(loadChats());
    const storedMemories = loadMemories();
    memoriesRef.current = storedMemories;
    setMemories(storedMemories);
    const storedModes = loadModes();
    setModes(storedModes);
    setHydrated(true);
    try {
      const saved = Number(localStorage.getItem(PRESET_KEY));
      const offset = Number.isFinite(saved) ? Math.abs(saved) % PRESETS.length : 0;
      setPresetOffset(offset);
      localStorage.setItem(PRESET_KEY, String((offset + PRESET_COUNT) % PRESETS.length));
    } catch {
      // Storage blocked: the first window is as good as any.
    }
    const savedTone = localStorage.getItem(TONE_KEY);
    if (savedTone && toneOptions(storedModes).some((option) => option.id === savedTone)) {
      setTone(savedTone);
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

    // A chat address — /c/<id> or <id>.<domain> — selects that thread even when
    // it isn't in this browser yet: the first message is saved under its id.
    const requested = initialChatId ?? chatSlugFromHost(window.location.hostname);
    if (requested) {
      pendingChatRef.current = requested;
      setActiveId(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page load
  }, []);

  // Keep the address bar pointing at the open thread. On a chat subdomain the
  // host already is the address, so it is left alone.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    if (chatSlugFromHost(window.location.hostname)) return;
    const target = activeId ? chatPath(activeId) : "/";
    if (window.location.pathname !== target) {
      window.history.replaceState(window.history.state, "", target);
    }
  }, [activeId, hydrated]);

  useEffect(() => {
    if (hydrated) saveChats(chats);
  }, [chats, hydrated]);

  // Warm the temporary Puter session on the first tap or keypress, so the first
  // message never has to create the account mid-turn (which used to stop it).
  useEffect(() => {
    let done = false;
    const prime = () => {
      if (done) return;
      done = true;
      void primeSession();
    };
    const options = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", prime, options);
    window.addEventListener("keydown", prime, options);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  // Puter.js keeps conversations only if the app asks it to: read the account
  // and pull the cloud copy down when a real (non-temporary) user is signed in.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await readPuterAccount();
        if (cancelled) return;
        setAccount(next);
        if (!next.signedIn || next.guest) return;
        const remote = await loadCloudChats();
        if (cancelled || remote.length === 0) return;
        setChats((previous) => mergeChats(previous, remote));
        setSyncState("saved");
      } catch {
        if (!cancelled) setAccount(SIGNED_OUT);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror every change to the user's Puter KV store, debounced past streaming.
  useEffect(() => {
    if (!hydrated || !account?.signedIn || account.guest) return;
    const timer = window.setTimeout(() => {
      setSyncState("saving");
      void saveCloudChats(chats)
        .then((result) => setSyncState(result === "saved" ? "saved" : "error"))
        .catch(() => setSyncState("error"));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [chats, hydrated, account]);

  useEffect(() => {
    memoriesRef.current = memories;
    if (hydrated) saveMemories(memories);
  }, [memories, hydrated]);

  useEffect(() => {
    if (hydrated) saveModes(modes);
  }, [modes, hydrated]);

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

  /** Re-read the connection, so a fresh key or sign-in shows up immediately. */
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/garmin/status", { cache: "no-store" });
      const payload = (await response.json()) as GarminStatus;
      setStatus(payload);
      if (payload.connected) await refreshTools();
    } catch {
      setStatus({ connected: false, configured: true, tools: 0, available: 0 });
    }
  }, [refreshTools]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

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

  /** Select a thread, hopping to its own subdomain when chats are served there. */
  function focusChat(id: string | null) {
    haptic("tap");
    setMobileSidebar(false);
    if (chatBaseDomain() && chatSlugFromHost(window.location.hostname)) {
      window.location.assign(chatUrlFor(id));
      return;
    }
    setActiveId(id);
  }

  const newChat = useCallback(() => {
    haptic("tap");
    abortRef.current?.abort();
    if (chatBaseDomain() && chatSlugFromHost(window.location.hostname)) {
      window.location.assign(chatUrlFor(null));
      return;
    }
    pendingChatRef.current = null;
    setActiveId(null);
    setMobileSidebar(false);
    setError(null);
    setInput("");
    setImage(null);
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

  function chooseTone(next: string) {
    setTone(next);
    try {
      localStorage.setItem(TONE_KEY, next);
    } catch {
      // Private mode: the tone still applies for this session.
    }
  }

  /** Save a user-written mode and switch to it straight away. */
  function createMode(name: string, instruction: string) {
    const { list, mode, duplicate } = addMode(modes, name, instruction);
    if (duplicate) {
      toast("Mode already saved", { description: `${mode.name} already exists.` });
      chooseTone(modeToneId(mode.id));
      return;
    }
    setModes(list);
    saveModes(list);
    chooseTone(modeToneId(mode.id));
    toast("Mode created", { description: `${mode.name} is now the active mode.` });
  }

  function deleteMode(id: string) {
    const next = dropMode(modes, id);
    setModes(next);
    saveModes(next);
    if (tone === modeToneId(id)) chooseTone(DEFAULT_TONE);
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

  /** Every "Connect Garmin" entry point offers MCP or a personal key first. */
  function openConnect() {
    haptic("tap");
    if (status && !status.configured) {
      toast.error("Garmin isn't configured", {
        description: "Add SESSION_SECRET to this deployment's environment variables.",
      });
      return;
    }
    setMobileSidebar(false);
    setConnectOpen(true);
  }

  /** Step to a different window of empty-state prompts. */
  function shufflePresets() {
    haptic("select");
    const spread = Math.max(1, PRESETS.length - PRESET_COUNT);
    const step = PRESET_COUNT + Math.floor(Math.random() * spread);
    const next = (presetOffset + step) % PRESETS.length;
    setPresetOffset(next);
    try {
      localStorage.setItem(PRESET_KEY, String((next + PRESET_COUNT) % PRESETS.length));
    } catch {
      // Storage blocked: the current view is still shuffled.
    }
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

  /** Save, edit or forget a memory the model asked for. Stays in the browser. */
  function handleMemoryTool(name: string, input: Record<string, unknown>): ToolResult {
    const text = typeof input["text"] === "string" ? input["text"] : "";
    const id = typeof input["id"] === "string" ? input["id"] : "";
    const current = memoriesRef.current;

    if (name === "memory_save") {
      if (!cleanMemoryText(text)) {
        return { ok: false, isError: true, text: "memory_save needs a non-empty text field." };
      }
      if (current.length >= MEMORY_LIMIT) {
        return {
          ok: false,
          isError: true,
          text: `Memory is full (${MEMORY_LIMIT} entries). Update or forget one first.`,
        };
      }
      const { list, memory, duplicate } = addMemory(current, text);
      memoriesRef.current = list;
      setMemories(list);
      return {
        ok: true,
        isError: false,
        text: duplicate
          ? `Already remembered as ${memory.id}: ${memory.text}`
          : `Saved memory ${memory.id}: ${memory.text}. You now remember ${list.length} facts.`,
      };
    }

    if (name === "memory_update") {
      const list = replaceMemory(current, id, text);
      if (!list) {
        return {
          ok: false,
          isError: true,
          text: `No memory with id "${id}". Current ids: ${current.map((memory) => memory.id).join(", ") || "none"}.`,
        };
      }
      memoriesRef.current = list;
      setMemories(list);
      return { ok: true, isError: false, text: `Updated memory ${id}.` };
    }

    const list = dropMemory(current, id);
    if (!list) {
      return { ok: false, isError: true, text: `No memory with id "${id}".` };
    }
    memoriesRef.current = list;
    setMemories(list);
    return { ok: true, isError: false, text: `Forgot memory ${id}. ${list.length} facts remain.` };
  }

  function forgetMemory(id: string) {
    haptic("warn");
    const next = memoriesRef.current.filter((memory) => memory.id !== id);
    memoriesRef.current = next;
    setMemories(next);
  }

  /** Ask Puter for a real account so chats can live in their cloud store. */
  async function startCloudSync() {
    setSyncState("saving");
    try {
      const next = await signInToPuter();
      setAccount(next);
      if (next.signedIn && !next.guest) {
        const remote = await loadCloudChats();
        if (remote.length > 0) setChats((previous) => mergeChats(previous, remote));
        setSyncState("saved");
        toast("Chats now sync with your Puter account", {
          description:
            "Text history is saved across devices. Attached images stay in this browser.",
        });
      } else if (next.signedIn) {
        setSyncState("idle");
        toast("Still a temporary Puter session", {
          description: "Finish creating a Puter account to keep chats in the cloud.",
        });
      } else {
        setSyncState("idle");
      }
    } catch (caught) {
      setSyncState("error");
      toast.error("Puter sign-in didn't finish", { description: errorText(caught) });
    }
  }

  async function stopCloudSync() {
    try {
      await signOutOfPuter();
    } catch {
      // Signing out is best effort; local state still resets.
    }
    setAccount(SIGNED_OUT);
    setSyncState("idle");
    toast("Signed out of Puter", { description: "Chats stay saved in this browser." });
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

    let garminSpecs = connected ? toolSpecs(garminTools) : [];
    if (connected && garminSpecs.length === 0) {
      garminSpecs = toolSpecs(await refreshTools());
    }
    // Memory and web tools are always available; Garmin ones only while connected.
    const tools = [...memoryTools, ...webTools, ...garminSpecs];

    // Only the prompt being answered carries its image: past pixels stay in the
    // transcript but stop costing tokens on later turns.
    const withImage = !!prior.at(-1)?.image;
    const lastIndex = prior.length - 1;
    const history: AgentMessage[] = [
      {
        role: "system",
        content: systemPrompt(
          status,
          garminSpecs.length,
          resolveTone(tone, modes).prompt,
          withImage,
          memoriesRef.current,
        ),
      },
      ...prior.map((message, index) =>
        imageAwareMessage(message, withImage && index === lastIndex),
      ),
    ];

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) break;

        const thinkingId = `thinking-${assistantId}-${round}`;
        const thinkingStart = performance.now();
        addStep({
          id: thinkingId,
          kind: "thinking",
          label: round === 0 ? "Reading your question" : "Reviewing your data",
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
            const { label, detail } = isMemoryTool(event.call.name)
              ? describeMemoryTool(event.call.name, event.call.input)
              : isWebTool(event.call.name)
                ? describeWebTool(event.call.name, event.call.input)
                : describeTool(event.call.name, event.call.input);
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
            const local = isMemoryTool(call.name);
            const result = local
              ? handleMemoryTool(call.name, call.input)
              : isWebTool(call.name)
                ? await requestWebTool(call.name, call.input)
                : await requestTool(call.name, call.input);
            history.push({ role: "tool", tool_call_id: call.id, content: result.text });
            patchStep(stepId, {
              status: result.ok ? "done" : "error",
              ms: performance.now() - startedAt,
              preview: local
                ? result.ok
                  ? "saved in this browser"
                  : "memory not changed"
                : `${formatBytes(result.text)} · ${result.ok ? "loaded" : "tool reported an error"}`,
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

      // A turn that produced no words is not finished business: a provider can
      // close a stream after reasoning alone, or the tool budget can run out.
      // Give the model one last pass with tools removed so it has to answer
      // from the data it already has, instead of stopping on the trace.
      if (!controller.signal.aborted && !streamed.trim()) {
        const answerId = `answer-${assistantId}`;
        const startedAt = performance.now();
        addStep({
          id: answerId,
          kind: "thinking",
          label: "Writing the answer",
          status: "active",
        });
        try {
          const final = await runRound(
            [
              ...history,
              {
                role: "user",
                content:
                  "Answer my last question now, in plain text, using what you already retrieved. Do not call tools.",
              },
            ],
            {
              model,
              signal: controller.signal,
              onEvent: (event) => {
                if (event.type === "text") appendText(event.text);
              },
            },
          );
          if (!streamed.trim() && final.text.trim()) appendText(final.text);
          patchStep(answerId, { status: "done", ms: performance.now() - startedAt });
        } catch {
          patchStep(answerId, { status: "error", ms: performance.now() - startedAt });
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
          // Every step must end: a step left active keeps the trace shimmering
          // after the turn is over.
          const steps = message.steps.map((step) =>
            step.status === "active" ? { ...step, status: "done" as const } : step,
          );
          if (message.content.trim()) return { ...message, steps };
          return {
            ...message,
            content:
              "That turn ended before I had an answer. Ask again, or narrow it down — for example a specific date range or one metric.",
            steps,
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

    // Offer the next two questions from the finished answer. Best effort: an
    // empty list simply renders nothing.
    if (!controller.signal.aborted && streamed.trim()) {
      const followups = await suggestFollowups(
        [
          ...prior.map((message) => ({ role: message.role, content: message.content })),
          { role: "assistant", content: streamed },
        ],
        model,
      );
      if (followups.length > 0) {
        patchMessage((message) => ({ ...message, followups }));
      }
    }

    return streamed;
  }

  async function pickImage(file: File) {
    try {
      const dataUrl = await prepareImage(file);
      setImage(dataUrl);
      const next = pickVisionModel(model, models);
      if (next !== model) {
        setModel(next);
        toast("Model switched for images", {
          description: `${models.find((option) => option.id === next)?.label ?? next} can read what you upload.`,
        });
      }
    } catch (caught) {
      toast.error("Couldn't attach that image", { description: errorText(caught) });
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    const attached = image;
    if ((!text && !attached) || busy) return;

    haptic("tap");
    setError(null);
    setInput("");
    setImage(null);
    stickRef.current = true;

    const userMessage: Message = {
      id: uid(),
      role: "user",
      content: text,
      ...(attached ? { image: attached } : {}),
      steps: [],
    };
    const assistantId = uid();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      steps: [],
    };

    const prior = [...(activeChat?.messages ?? []), userMessage];
    const chatId = activeChat?.id ?? pendingChatRef.current ?? uid();
    pendingChatRef.current = chatId;

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
          title: text.slice(0, 52) || "Image question",
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

  const composer = (
    <PromptBar
      value={input}
      onChange={setInput}
      onSubmit={(text) => void send(text)}
      onStop={() => {
        haptic("tap");
        abortRef.current?.abort();
      }}
      busy={busy}
      connected={connected}
      tools={toolsAvailable}
      tone={tone}
      onToneChange={(next) => {
        haptic("select");
        chooseTone(next);
      }}
      modes={modes}
      image={image}
      onPickImage={(file) => void pickImage(file)}
      onRemoveImage={() => setImage(null)}
      placeholder={connected ? "Ask about your training" : "Ask anything"}
      onNewChat={newChat}
      onOpenSettings={() => setSettingsOpen(true)}
      onConnect={() => setConnectOpen(true)}
      textareaRef={textareaRef}
      dropUp={!!activeChat}
    />
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
          setConnectOpen(true);
        }}
      />

      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        configured={status?.configured ?? true}
        onMcp={() => {
          setConnectOpen(false);
          connectGarmin();
        }}
        onConnected={() => {
          setConnectOpen(false);
          haptic("done");
          toast.success("Garmin connected with your key", {
            description:
              "Read-only access to your Garmin data. Create a new key when this one expires.",
          });
          void refreshStatus();
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
          setConnectOpen(true);
        }}
        onDisconnect={() => void disconnectGarmin()}
        haptics={haptics}
        onHapticsChange={chooseHaptics}
        onHapticTest={haptic}
        chatCount={chats.length}
        onClearChats={clearChats}
        memories={memories}
        onForgetMemory={(id) => forgetMemory(id)}
        account={account}
        syncState={syncState}
        onSignIn={() => void startCloudSync()}
        onSignOut={() => void stopCloudSync()}
        modes={modes}
        onCreateMode={createMode}
        onDeleteMode={deleteMode}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        {...(activeId ? { url: chatUrlFor(activeId) } : {})}
      />

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        chats={chats}
        onSelect={(id) => focusChat(id)}
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setMobileSidebar(false);
                setSidebarOpen(false);
              }}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="hidden size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97] md:grid"
            >
              <PanelLeft className="size-[18px]" strokeWidth={1.9} />
            </button>
            <NavToggle
              open
              label="Close sidebar"
              onClick={() => {
                setMobileSidebar(false);
                setSidebarOpen(false);
              }}
              className="hover:bg-sidebar-accent md:hidden"
            />
          </div>
          <button
            onClick={newChat}
            aria-label="New chat"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <SquarePen className="size-[18px]" />
          </button>
        </div>

        <div className="px-2 pb-2">
          <a
            href="/upgrade"
            aria-label="Upgrade"
            onClick={() => {
              haptic("tap");
              setMobileSidebar(false);
            }}
            className="upgrade-pill flex h-10 items-center justify-center rounded-full text-[13.5px] font-semibold"
          >
            <span className="relative">Get unlimited access</span>
          </a>
        </div>

        <div className="px-2 pb-2">
          <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Apps
          </p>
          {[
            { href: "/dashboard", label: "Dashboard", Icon: Activity },
            { href: "/calendar", label: "Workout calendar", Icon: CalendarDays },
          ].map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMobileSidebar(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </a>
          ))}
          <p className="px-2 py-1 text-[12px] text-muted-foreground/70">More coming soon</p>
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
                    onClick={() => focusChat(chat.id)}
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
            <GlowButton fullWidth onClick={openConnect} size="sm" className="mt-0.5">
              <Plug className="size-3.5" />
              Connect Garmin
            </GlowButton>
          )}

          <div className="mt-1 flex gap-0.5 overflow-x-auto border-t border-sidebar-border/60 pt-1 [scrollbar-width:none] md:block md:space-y-0.5">
            <button
              onClick={() => {
                haptic("tap");
                setShareOpen(true);
                setMobileSidebar(false);
              }}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 md:w-full md:gap-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Share2 className="size-3.5" />
              Share
            </button>
            <button
              onClick={() => {
                haptic("tap");
                setSettingsOpen(true);
                setMobileSidebar(false);
              }}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 md:w-full md:gap-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Settings2 className="size-3.5" />
              Settings
            </button>
            <button
              onClick={() => {
                haptic("tap");
                setSearchOpen(true);
                setMobileSidebar(false);
              }}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 md:w-full md:gap-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Search className="size-3.5" />
              Search
            </button>
            <button
              onClick={() => setWelcomeOpen(true)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 md:w-full md:gap-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <CircleHelp className="size-3.5" />
              How it works
            </button>
            <a
              href="/blog"
              onClick={() => setMobileSidebar(false)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 md:w-full md:gap-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <BookOpen className="size-3.5" />
              Blog
            </a>
            <a
              href="https://fundrazr.com/62nDBa"
              target="_blank"
              rel="noreferrer noopener"
              className="group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 md:w-full md:gap-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Heart className="size-3.5 text-rose-500 transition-transform duration-200 group-hover:scale-110" />
              Donate
              <ArrowUpRight className="ml-auto size-3 opacity-60" />
            </a>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-sidebar-border/60 px-2 pt-2 pb-0.5 text-[10.5px] text-muted-foreground/70">
            <span className="truncate">Built by {BUILDER}</span>
            <span className="shrink-0 font-mono">v{APP_VERSION}</span>
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
              <GlowButton onClick={openConnect} size="sm" className="hidden sm:inline-flex">
                <Plug className="size-3.5" />
                Connect Garmin
              </GlowButton>
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
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16">
            <button
              type="button"
              onClick={shufflePresets}
              aria-label="Shuffle suggestions"
              title="Shuffle suggestions"
              className="group/shuffle absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground/50 transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground sm:right-5 sm:top-5"
            >
              <Shuffle
                className="size-4 transition-transform duration-300 group-hover/shuffle:rotate-180"
                strokeWidth={1.8}
              />
            </button>

            <h1 className="text-center text-[26px] font-medium tracking-tight sm:text-[30px]">
              Ask me about your training
            </h1>
            <p className="mt-2 max-w-md text-center text-[13.5px] leading-relaxed text-muted-foreground">
              {connected
                ? `${toolsAvailable} Garmin tools are live. Sleep, recovery, load and workouts — read as we go. Attach a screenshot with +.`
                : "Connect Garmin to read your sleep, recovery and workouts inside the chat — or attach a screenshot with +."}
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
              {presets.map((suggestion, index) => (
                <button
                  key={`${presetOffset}-${suggestion.title}`}
                  onClick={() => void send(suggestion.prompt)}
                  style={{ animationDelay: `${index * 70}ms` }}
                  className={cn(
                    "animate-in fade-in-0 fill-mode-both slide-in-from-bottom-1 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-foreground hover:shadow-sm",
                    // Phones get three suggestions; the fourth is desktop-only.
                    index === PRESET_COUNT - 1 ? "hidden sm:inline-flex" : "inline-flex",
                  )}
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
                    onFollowUp={(text) => void send(text)}
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
  a({ href, children }) {
    const text =
      typeof children === "string"
        ? children
        : Array.isArray(children)
          ? children.filter((part): part is string => typeof part === "string").join("")
          : "";
    if (typeof href === "string" && /^https?:\/\//i.test(href) && isCitationLabel(text)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          title={href}
          className="citation-chip"
        >
          {text.trim()}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
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
  onFollowUp,
}: {
  message: Message;
  running: boolean;
  canRegenerate: boolean;
  canEdit: boolean;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (value: "up" | "down") => void;
  onFollowUp: (text: string) => void;
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
          <div className="overflow-hidden rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
            {message.image && (
              <img
                src={message.image}
                alt="Attached"
                className="mb-2 max-h-64 w-full rounded-2xl object-cover"
              />
            )}
            {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}
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
      <AgentTrace steps={message.steps} running={running} />

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

      {!running && canRegenerate && (message.followups?.length ?? 0) > 0 && (
        <FollowUps items={message.followups ?? []} onPick={onFollowUp} />
      )}
    </div>
  );
}

/** Two questions the model proposed as the natural next turn. */
function FollowUps({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <div className="mt-6 max-w-[620px]">
      <p className="text-[13px] font-medium text-muted-foreground">Follow-ups</p>
      <div className="mt-2 border-t border-border/70">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              haptic("tap");
              onPick(item);
            }}
            className="group flex w-full items-center gap-3 border-b border-border/70 py-3 pr-1 text-left text-[15px] leading-snug text-foreground/90 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CornerLeftUp
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5"
              strokeWidth={1.7}
            />
            <span className="min-w-0 flex-1">{item}</span>
          </button>
        ))}
      </div>
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
