export type StepStatus = "active" | "done" | "error";

export type TraceStep = {
  id: string;
  kind: "thinking" | "tool";
  label: string;
  /** Raw MCP tool name, shown in the tool list. */
  tool?: string;
  detail?: string;
  status: StepStatus;
  ms?: number;
  /** Streamed reasoning text for thinking steps. */
  text?: string;
  /** Short preview of the tool result (size + status). */
  preview?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: TraceStep[];
  error?: string;
  /** Two follow-up questions the model proposed for this answer. */
  followups?: string[];
  /** Data URL of an image the user attached to this prompt. */
  image?: string;
  /** Local thumbs feedback, kept in this browser only. */
  feedback?: "up" | "down";
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updated: number;
};

const KEY = "garmin-chat:threads:v2";
const MAX_CHATS = 40;

export const uid = () => Math.random().toString(36).slice(2, 10);

function sanitizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const role = record["role"];
  if (role !== "user" && role !== "assistant") return null;
  const content = typeof record["content"] === "string" ? record["content"] : "";
  const steps = Array.isArray(record["steps"])
    ? record["steps"]
        .map((step): TraceStep | null => {
          if (!step || typeof step !== "object") return null;
          const item = step as Record<string, unknown>;
          const kind = item["kind"] === "thinking" ? "thinking" : "tool";
          const status = item["status"];
          const detail = typeof item["detail"] === "string" ? item["detail"] : undefined;
          const tool = typeof item["tool"] === "string" ? item["tool"] : undefined;
          const ms = typeof item["ms"] === "number" ? item["ms"] : undefined;
          const text = typeof item["text"] === "string" ? item["text"].slice(0, 6000) : undefined;
          const preview = typeof item["preview"] === "string" ? item["preview"] : undefined;
          return {
            id: typeof item["id"] === "string" ? item["id"] : uid(),
            kind,
            label: typeof item["label"] === "string" ? item["label"] : "Step",
            status: status === "error" ? "error" : "done",
            ...(tool ? { tool } : {}),
            ...(detail ? { detail } : {}),
            ...(ms !== undefined ? { ms } : {}),
            ...(text ? { text } : {}),
            ...(preview ? { preview } : {}),
          };
        })
        .filter((step): step is TraceStep => !!step)
    : [];
  const error = typeof record["error"] === "string" ? record["error"] : undefined;
  const followups = Array.isArray(record["followups"])
    ? record["followups"]
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 2)
    : [];
  const image =
    typeof record["image"] === "string" && record["image"].startsWith("data:image/")
      ? record["image"]
      : undefined;
  const feedback =
    record["feedback"] === "up" ? "up" : record["feedback"] === "down" ? "down" : undefined;
  return {
    id: typeof record["id"] === "string" ? record["id"] : uid(),
    role,
    content,
    steps,
    ...(error ? { error } : {}),
    ...(followups.length > 0 ? { followups } : {}),
    ...(image ? { image } : {}),
    ...(feedback ? { feedback } : {}),
  };
}

export function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((raw): Chat | null => {
        if (!raw || typeof raw !== "object") return null;
        const record = raw as Record<string, unknown>;
        const messages = Array.isArray(record["messages"])
          ? record["messages"]
              .map(sanitizeMessage)
              .filter((message): message is Message => !!message)
          : [];
        if (messages.length === 0) return null;
        return {
          id: typeof record["id"] === "string" ? record["id"] : uid(),
          title: typeof record["title"] === "string" ? record["title"] : "New chat",
          messages,
          updated: typeof record["updated"] === "number" ? record["updated"] : Date.now(),
        };
      })
      .filter((chat): chat is Chat => !!chat)
      .slice(0, MAX_CHATS);
  } catch {
    return [];
  }
}

function withoutImages(chats: Chat[]): Chat[] {
  return chats.map((chat) => ({
    ...chat,
    messages: chat.messages.map(({ image: _image, ...rest }) => rest),
  }));
}

export function saveChats(chats: Chat[]) {
  if (typeof window === "undefined") return;
  const trimmed = chats.slice(0, MAX_CHATS);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return;
  } catch {
    // Attached images are heavy: drop them rather than lose the transcript.
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(withoutImages(trimmed)));
  } catch {
    // Storage full or blocked — chats stay in memory for this session.
  }
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
