/**
 * Rolling-window counters for API limits.
 *
 * Pure and time-injected so the rules can be tested without a server: the
 * caller owns the hit list (a Map entry, a module-level array) and this decides
 * whether the next hit fits and when a slot frees up.
 */

export type WindowLimit = { limit: number; windowMs: number };

export type WindowHit = {
  ok: boolean;
  /** Hits still inside the window, including this one when ok is true. */
  hits: number[];
  /** Milliseconds until a slot frees up; 0 when the hit was allowed. */
  retryAfterMs: number;
};

export function recordHit(hits: number[], now: number, limit: WindowLimit): WindowHit {
  const recent = hits.filter((at) => Number.isFinite(at) && at <= now && now - at < limit.windowMs);
  if (recent.length >= limit.limit) {
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      hits: recent,
      retryAfterMs: Math.max(1000, limit.windowMs - (now - oldest)),
    };
  }
  return { ok: true, hits: [...recent, now], retryAfterMs: 0 };
}

/** True when every hit in the list has aged out of the window. */
export function isWindowEmpty(hits: number[], now: number, windowMs: number): boolean {
  return hits.every((at) => now - at >= windowMs);
}
