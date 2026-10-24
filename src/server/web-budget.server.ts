/**
 * Server-side web research budget.
 *
 * The client already limits lookups per answer, but that counter lives in the
 * tab and resets on reload, so it cannot protect the Exa/Tavily bill. This is
 * the real backstop: a per-client window keyed by the forwarded IP plus a
 * global window that caps a burst from many clients.
 *
 * In-memory on purpose. With several server instances each one keeps its own
 * window, which still bounds a single client; a shared store would be the next
 * step if the app ever scales out.
 */

import { isWindowEmpty, recordHit, type WindowLimit } from "@/lib/rate-limit";

/** One browser or NAT: generous enough for a long research session. */
const CLIENT: WindowLimit = { limit: 40, windowMs: 10 * 60_000 };
/** Everyone together, so one noisy client cannot drain the API keys. */
const GLOBAL: WindowLimit = { limit: 400, windowMs: 10 * 60_000 };
/** Above this many tracked clients, stale entries are swept. */
const MAX_CLIENTS = 4000;

const clients = new Map<string, number[]>();
let globalHits: number[] = [];

/** Best-effort client identity from the proxy headers Vercel sets. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "local";
}

function sweep(now: number): void {
  for (const [key, hits] of clients) {
    if (isWindowEmpty(hits, now, CLIENT.windowMs)) clients.delete(key);
  }
}

export type BudgetDenial = { retryAfterMs: number; message: string };

/**
 * Consume one lookup, or explain why not. Returns null when the call may run.
 */
export function checkWebBudget(request: Request, now = Date.now()): BudgetDenial | null {
  const key = clientKey(request);
  const client = recordHit(clients.get(key) ?? [], now, CLIENT);
  if (!client.ok) {
    clients.set(key, client.hits);
    const seconds = Math.ceil(client.retryAfterMs / 1000);
    return {
      retryAfterMs: client.retryAfterMs,
      message: `Too many web lookups from this connection. Try again in about ${seconds} seconds, or answer from what you already have.`,
    };
  }

  const global = recordHit(globalHits, now, GLOBAL);
  globalHits = global.hits;
  if (!global.ok) {
    const seconds = Math.ceil(global.retryAfterMs / 1000);
    return {
      retryAfterMs: global.retryAfterMs,
      message: `Web research is busy right now. Try again in about ${seconds} seconds, or answer from what you already have.`,
    };
  }

  clients.set(key, client.hits);
  if (clients.size > MAX_CLIENTS) sweep(now);
  return null;
}

/** Test/reset hook: forget every window. */
export function resetWebBudget(): void {
  clients.clear();
  globalHits = [];
}
