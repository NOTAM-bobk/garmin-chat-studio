/**
 * Browser bridge to Puter.js (https://docs.puter.com/AI/chat/).
 * Uses Puter's temporary (guest) user so visitors never hit a sign-in form.
 */

export type ChatRole = "user" | "assistant" | "system";
export type ChatMsg = { role: ChatRole; content: string };

export type ToolCallWire = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AgentMessage = {
  role: ChatRole | "tool";
  content?: string;
  tool_calls?: ToolCallWire[];
  tool_call_id?: string;
  /** Opaque thinking artifacts a provider needs replayed on the next turn. */
  reasoning_details?: unknown[];
};

export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type PuterGlobal = {
  ai: {
    chat: (m: unknown, o?: Record<string, unknown>) => Promise<unknown>;
    listModels?: (provider?: string) => Promise<unknown>;
  };
  auth: {
    isSignedIn: () => boolean;
    signIn: (o?: { attempt_temp_user_creation?: boolean }) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    puter?: PuterGlobal;
  }
}

let loading: Promise<PuterGlobal> | null = null;

export function loadPuter(): Promise<PuterGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.puter) return Promise.resolve(window.puter);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => {
      const interval = setInterval(() => {
        if (window.puter) {
          clearInterval(interval);
          resolve(window.puter);
        }
      }, 50);
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the AI. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Live model catalogue from Puter. Returns [] when the SDK or the call is
 * unavailable so callers can fall back to the curated list.
 */
export async function listPuterModels(): Promise<
  { id: string; name?: string; provider?: string }[]
> {
  try {
    const puter = await loadPuter();
    if (!puter.ai.listModels) return [];
    const raw = await puter.ai.listModels();
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const id = typeof record["id"] === "string" ? record["id"] : "";
      if (!id) return [];
      const name = typeof record["name"] === "string" ? record["name"] : undefined;
      const provider = typeof record["provider"] === "string" ? record["provider"] : undefined;
      return [{ id, ...(name ? { name } : {}), ...(provider ? { provider } : {}) }];
    });
  } catch {
    return [];
  }
}

/** Make sure a (temporary) Puter user exists. Must be called from a click/keypress. */
export async function ensureGuest(puter: PuterGlobal) {
  if (puter.auth.isSignedIn()) return;
  await puter.auth.signIn({ attempt_temp_user_creation: true });
}

type Chunk = {
  type?: string;
  text?: unknown;
  reasoning?: unknown;
  delta?: unknown;
  id?: unknown;
  name?: unknown;
  input?: unknown;
  detail?: unknown;
  message?: unknown;
  error?: unknown;
};

export type TurnEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; call: { id: string; name: string; input: Record<string, unknown> } };

export type TurnResult = {
  text: string;
  reasoning: string;
  toolCalls: { id: string; name: string; input: Record<string, unknown> }[];
  reasoningDetails: unknown[];
  assistant: AgentMessage;
};

function stringField(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["text"] === "string") return record["text"];
    if (typeof record["thinking"] === "string") return record["thinking"];
  }
  return "";
}

/** Plain text out of a non-streamed Puter response, whatever shape it arrives in. */
function responseText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const message = record["message"];
  if (typeof message === "string") return message;
  if (message && typeof message === "object") {
    return stringField((message as Record<string, unknown>)["content"]);
  }
  return stringField(record["text"]);
}

/** Tidy a model-written title: one line, no quotes or trailing punctuation, capped. */
export function cleanTitle(raw: string): string {
  const line = raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const stripped = line
    .replace(/^["'“”‘’`*#\s]+/, "")
    .replace(/["'“”‘’`*\s]+$/, "")
    .replace(/[.!?,;:—-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 52).trim();
}

/**
 * Ask the model for a short thread title. Runs on the same Puter session as the
 * chat; failures are the caller's problem (auto-naming stays silent).
 */
export async function nameChat(
  messages: { role: string; content: string }[],
  model: string,
): Promise<string> {
  const transcript = messages
    .slice(0, 4)
    .map((message) => `${message.role}: ${message.content.slice(0, 500)}`)
    .join("\n\n");
  if (!transcript.trim()) return "";

  const puter = await loadPuter();
  await ensureGuest(puter);

  const raw = await puter.ai.chat(
    [
      {
        role: "system",
        content:
          "You name chat threads. Reply with the title only: 2-5 words, no quotes, no trailing punctuation, at most 48 characters. Name the topic (what the chat is about), not the fact that it is a chat.",
      },
      { role: "user", content: transcript },
    ],
    { model, stream: false },
  );

  return cleanTitle(responseText(raw));
}

/** Tidy one suggested question: single line, no bullets/numbering/quotes. */
export function cleanFollowup(raw: string): string {
  return raw
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^["'“”‘’`\s]+/, "")
    .replace(/["'“”‘’`\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90)
    .trim();
}

/** Parse the model's reply into at most two follow-up questions. */
export function parseFollowups(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const candidates: string[] = [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") candidates.push(item);
        }
      }
    } catch {
      // Fall through to the line-by-line parse below.
    }
  }
  if (candidates.length === 0) {
    candidates.push(...text.split(/\r?\n+/));
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    const question = cleanFollowup(candidate);
    if (question.length < 8) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
    if (result.length === 2) break;
  }
  return result;
}

/**
 * Ask the model for two follow-up questions the user might tap next. Runs on
 * the same Puter session as the chat; an empty list means "show nothing".
 */
export async function suggestFollowups(
  messages: { role: string; content: string }[],
  model: string,
): Promise<string[]> {
  const transcript = messages
    .slice(-6)
    .map((message) => `${message.role}: ${message.content.slice(0, 1200)}`)
    .join("\n\n");
  if (!transcript.trim()) return [];

  try {
    const puter = await loadPuter();
    await ensureGuest(puter);

    const raw = await puter.ai.chat(
      [
        {
          role: "system",
          content:
            'You write the two follow-up questions a user would most likely ask next in a chat about their Garmin training data. Reply with a JSON array of exactly two short questions and nothing else, for example ["How does that compare with last month?", "What should I change tomorrow?"]. Ground each question in the conversation, keep it under 70 characters, and do not repeat a question already answered.',
        },
        { role: "user", content: transcript },
      ],
      { model, stream: false },
    );

    return parseFollowups(responseText(raw));
  } catch {
    return [];
  }
}

/** One model round, streamed. Tool calls are collected and reported as events. */
export async function runRound(
  messages: AgentMessage[],
  options: {
    model: string;
    signal: AbortSignal;
    tools?: ToolSpec[];
    onEvent: (event: TurnEvent) => void;
  },
): Promise<TurnResult> {
  const puter = await loadPuter();
  await ensureGuest(puter);

  const request: Record<string, unknown> = {
    model: options.model,
    stream: true,
    signal: options.signal,
    normalize: true,
  };
  if (options.tools && options.tools.length > 0) request["tools"] = options.tools;

  const raw = await puter.ai.chat(messages, request);
  let text = "";
  let reasoning = "";
  const toolCalls: TurnResult["toolCalls"] = [];
  const reasoningDetails: unknown[] = [];

  const handleChunk = (chunk: Chunk) => {
    const type = chunk.type;
    if (type === "text") {
      const piece = stringField(chunk.text);
      if (piece) {
        text += piece;
        options.onEvent({ type: "text", text: piece });
      }
      return;
    }
    if (type === "reasoning") {
      const piece =
        stringField(chunk.reasoning) || stringField(chunk.text) || stringField(chunk.delta);
      if (piece) {
        reasoning += piece;
        options.onEvent({ type: "reasoning", text: piece });
      }
      return;
    }
    if (type === "reasoning_detail" && chunk.detail) {
      reasoningDetails.push(chunk.detail);
      return;
    }
    if (type === "tool_use" || type === "tool_call") {
      const name = typeof chunk.name === "string" ? chunk.name : "";
      if (!name) return;
      const input =
        chunk.input && typeof chunk.input === "object"
          ? (chunk.input as Record<string, unknown>)
          : {};
      const id =
        typeof chunk.id === "string" ? chunk.id : `call_${Math.random().toString(36).slice(2, 10)}`;
      const call = { id, name, input };
      toolCalls.push(call);
      options.onEvent({ type: "tool", call });
      return;
    }
    if (type === "error") {
      const message =
        typeof chunk.message === "string" ? chunk.message : "The model stopped unexpectedly.";
      throw new Error(message);
    }
    // Some providers only send { text } for plain chunks.
    if (typeof chunk.text === "string" && chunk.text) {
      text += chunk.text;
      options.onEvent({ type: "text", text: chunk.text });
    }
  };

  if (raw && typeof raw === "object" && Symbol.asyncIterator in raw) {
    for await (const part of raw as AsyncIterable<Chunk>) {
      if (options.signal.aborted) break;
      handleChunk(part);
    }
  } else {
    const message = (raw as { message?: Record<string, unknown> } | null)?.message;
    if (message) {
      const content = stringField(message["content"]);
      if (content) {
        text += content;
        options.onEvent({ type: "text", text: content });
      }
      const reasoningText = stringField(message["reasoning"]);
      if (reasoningText) {
        reasoning += reasoningText;
        options.onEvent({ type: "reasoning", text: reasoningText });
      }
      const details = message["reasoning_details"];
      if (Array.isArray(details)) reasoningDetails.push(...details);
      const list = Array.isArray(message["tool_calls"]) ? message["tool_calls"] : [];
      for (const entry of list) {
        const record = entry as Record<string, unknown>;
        const fn = (record["function"] ?? {}) as Record<string, unknown>;
        const name = typeof fn["name"] === "string" ? fn["name"] : "";
        if (!name) continue;
        let input: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(String(fn["arguments"] ?? "{}")) as unknown;
          if (parsed && typeof parsed === "object") input = parsed as Record<string, unknown>;
        } catch {
          input = {};
        }
        const id =
          typeof record["id"] === "string"
            ? record["id"]
            : `call_${Math.random().toString(36).slice(2, 10)}`;
        const call = { id, name, input };
        toolCalls.push(call);
        options.onEvent({ type: "tool", call });
      }
    }
  }

  const assistant: AgentMessage = { role: "assistant", content: text };
  if (toolCalls.length > 0) {
    assistant.tool_calls = toolCalls.map((call) => ({
      id: call.id,
      type: "function" as const,
      function: { name: call.name, arguments: JSON.stringify(call.input) },
    }));
  }
  if (reasoningDetails.length > 0) assistant.reasoning_details = reasoningDetails;

  return { text, reasoning, toolCalls, reasoningDetails, assistant };
}
