/**
 * Browser bridge to Puter.js (https://docs.puter.com/AI/chat/).
 * Uses Puter's temporary (guest) user so visitors never see a sign-in form.
 */

export type ChatRole = "user" | "assistant" | "system";
export type ChatMsg = { role: ChatRole; content: string };

type PuterGlobal = {
  ai: { chat: (m: ChatMsg[] | string, o?: Record<string, unknown>) => Promise<unknown> };
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
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.async = true;
    s.onload = () => {
      const t = setInterval(() => {
        if (window.puter) {
          clearInterval(t);
          resolve(window.puter);
        }
      }, 50);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the AI. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Make sure a (temporary) Puter user exists. Must be called from a click/keypress. */
export async function ensureGuest(puter: PuterGlobal) {
  if (puter.auth.isSignedIn()) return;
  await puter.auth.signIn({ attempt_temp_user_creation: true });
}

export async function streamChat(
  messages: ChatMsg[],
  model: string,
  onDelta: (t: string) => void,
  signal: AbortSignal,
) {
  const puter = await loadPuter();
  await ensureGuest(puter);
  const res = await puter.ai.chat(messages, { model, stream: true });
  if (res && typeof res === "object" && Symbol.asyncIterator in res) {
    for await (const part of res as AsyncIterable<{ text?: string } | string>) {
      if (signal.aborted) return;
      const t = typeof part === "string" ? part : part?.text;
      if (t) onDelta(t);
    }
    return;
  }
  const r = res as { message?: { content?: unknown } } | string;
  const text = typeof r === "string" ? r : String(r?.message?.content ?? "");
  if (text) onDelta(text);
}
