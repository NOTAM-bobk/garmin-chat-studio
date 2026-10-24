import { describe, expect, it } from "vitest";

import { thoughtPlan, FIRST_THOUGHTS, NEXT_THOUGHTS, shuffled } from "@/lib/thoughts";

describe("thinking labels", () => {
  it("varies the wording instead of repeating one line", () => {
    expect(new Set(FIRST_THOUGHTS).size).toBe(FIRST_THOUGHTS.length);
    expect(new Set(NEXT_THOUGHTS).size).toBe(NEXT_THOUGHTS.length);
    expect(FIRST_THOUGHTS.length).toBeGreaterThan(4);
    expect(NEXT_THOUGHTS.length).toBeGreaterThan(4);
  });

  it("plans one label per round without repeating", () => {
    const plan = thoughtPlan(6);
    expect(plan).toHaveLength(6);
    expect(FIRST_THOUGHTS).toContain(plan[0]);
    for (const label of plan.slice(1)) expect(NEXT_THOUGHTS).toContain(label);
    expect(new Set(plan).size).toBe(plan.length);
  });

  it("gives a single-round turn a question label", () => {
    const plan = thoughtPlan(1);
    expect(plan).toHaveLength(1);
    expect(FIRST_THOUGHTS).toContain(plan[0]);
  });

  it("shuffles a copy, never the source list", () => {
    const source = ["a", "b", "c", "d"];
    const out = shuffled(source, () => 0);
    expect(source).toEqual(["a", "b", "c", "d"]);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
    expect(out).not.toEqual(source);
  });
});
