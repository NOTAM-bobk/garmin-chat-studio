import { parseQuestions, type AskAnswers, type AskQuestion } from "@/lib/questions";

export type StepStatus = "active" | "done" | "error";

/** A questionnaire the assistant asked, plus what the user chose. */
export type AskBlock = { questions: AskQuestion[]; answers?: AskAnswers };

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
  /** Questions this answer asked the user, and the answers once given. */
  ask?: AskBlock;
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
  const ask = sanitizeAsk(record["ask"]);
  return {
    id: typeof record["id"] === "string" ? record["id"] : uid(),
    role,
    content,
    steps,
    ...(error ? { error } : {}),
    ...(followups.length > 0 ? { followups } : {}),
    ...(image ? { image } : {}),
    ...(feedback ? { feedback } : {}),
    ...(ask ? { ask } : {}),
  };
}

/** Validate a stored questionnaire so a reload keeps the card and its answers. */
function sanitizeAsk(raw: unknown): AskBlock | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const questions = parseQuestions({ questions: record["questions"] });
  if (questions.length === 0) return undefined;

  const answers: AskAnswers = {};
  if (record["answers"] && typeof record["answers"] === "object") {
    for (const [key, value] of Object.entries(record["answers"] as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const picked = value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 8);
      if (picked.length > 0) answers[key] = picked;
    }
  }
  return {
    questions,
    ...(Object.keys(answers).length > 0 ? { answers } : {}),
  };
}

/** Validate anything shaped like a chat list, so storage and cloud agree. */
export function sanitizeChats(parsed: unknown): Chat[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((raw): Chat | null => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const messages = Array.isArray(record["messages"])
        ? record["messages"].map(sanitizeMessage).filter((message): message is Message => !!message)
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
}

export function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeChats(JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown);
  } catch {
    return [];
  }
}

/** Union two chat lists by id, keeping the newer copy of each thread. */
export function mergeChats(local: Chat[], remote: Chat[]): Chat[] {
  const byId = new Map<string, Chat>();
  for (const chat of [...local, ...remote]) {
    const existing = byId.get(chat.id);
    if (!existing || chat.updated > existing.updated) byId.set(chat.id, chat);
  }
  return [...byId.values()].sort((a, b) => b.updated - a.updated).slice(0, MAX_CHATS);
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
