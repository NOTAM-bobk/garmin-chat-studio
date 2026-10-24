import { beforeEach, describe, expect, it } from "vitest";

import { isWindowEmpty, recordHit } from "@/lib/rate-limit";
import { checkWebBudget, resetWebBudget } from "@/server/web-budget.server";

const LIMIT = { limit: 3, windowMs: 60_000 };
const NOW = 1_800_000_000_000;

describe("recordHit", () => {
  it("allows hits up to the limit", () => {
    let hits: number[] = [];
    for (let index = 0; index < 3; index++) {
      const result = recordHit(hits, NOW + index, LIMIT);
      expect(result.ok).toBe(true);
      hits = result.hits;
    }
    expect(hits).toHaveLength(3);
  });

  it("blocks the next hit and says how long to wait", () => {
    const hits = [NOW, NOW + 1000, NOW + 2000];
    const result = recordHit(hits, NOW + 3000, LIMIT);
    expect(result.ok).toBe(false);
    expect(result.hits).toHaveLength(3);
    expect(result.retryAfterMs).toBe(57_000);
  });

  it("never reports a wait under a second", () => {
    const hits = [NOW - 59_900, NOW - 59_800, NOW - 59_700];
    const result = recordHit(hits, NOW, LIMIT);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBe(1000);
  });

  it("frees a slot once the oldest hit ages out", () => {
    const hits = [NOW, NOW + 1000, NOW + 2000];
    const later = recordHit(hits, NOW + 60_001, LIMIT);
    expect(later.ok).toBe(true);
    expect(later.hits).toEqual([NOW + 1000, NOW + 2000, NOW + 60_001]);
  });

  it("ignores stale and clock-skewed entries", () => {
    const result = recordHit([NOW - 120_000, NOW + 10_000], NOW, LIMIT);
    expect(result.ok).toBe(true);
    expect(result.hits).toEqual([NOW]);
  });

  it("knows when a window can be swept", () => {
    expect(isWindowEmpty([NOW - 120_000], NOW, 60_000)).toBe(true);
    expect(isWindowEmpty([NOW - 30_000], NOW, 60_000)).toBe(false);
  });
});

describe("checkWebBudget", () => {
  const request = (ip: string) =>
    new Request("https://example.test/api/web/search", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    });

  beforeEach(() => resetWebBudget());

  it("allows a client's lookups and then refuses them", () => {
    for (let index = 0; index < 40; index++) {
      expect(checkWebBudget(request("203.0.113.7"))).toBeNull();
    }
    const denied = checkWebBudget(request("203.0.113.7"));
    expect(denied?.message).toContain("Too many web lookups");
    expect(denied?.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps separate windows per client", () => {
    for (let index = 0; index < 40; index++) checkWebBudget(request("203.0.113.7"));
    expect(checkWebBudget(request("203.0.113.7"))).not.toBeNull();
    expect(checkWebBudget(request("198.51.100.9"))).toBeNull();
  });
});
