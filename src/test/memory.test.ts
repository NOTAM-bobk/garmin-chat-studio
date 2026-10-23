import { describe, expect, it } from "vitest";

import { addMemory, cleanMemoryText, dropMemory, memoryPrompt, replaceMemory } from "@/lib/memory";

describe("memory", () => {
  it("normalises text and adds a fact", () => {
    expect(cleanMemoryText("  Trains   early\nmornings  ")).toBe("Trains early mornings");

    const { list, memory } = addMemory([], "  Trains   early mornings ");
    expect(list).toHaveLength(1);
    expect(memory.text).toBe("Trains early mornings");
  });

  it("returns the existing fact instead of a duplicate", () => {
    const first = addMemory([], "Half marathon in March");
    const second = addMemory(first.list, "half marathon in march");

    expect(second.duplicate).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.memory.id).toBe(first.memory.id);
  });

  it("edits and forgets by id", () => {
    const { list, memory } = addMemory([], "Runs 30 km a week");
    const updated = replaceMemory(list, memory.id, "Runs 45 km a week");
    expect(updated?.[0]?.text).toBe("Runs 45 km a week");
    expect(replaceMemory(list, "missing", "nope")).toBeNull();

    expect(dropMemory(updated ?? list, memory.id)).toEqual([]);
    expect(dropMemory(list, "missing")).toBeNull();
  });

  it("gives the model ids and an empty-state rule", () => {
    const { list, memory } = addMemory([], "Knee niggle on the left");

    expect(memoryPrompt([])).toContain("no saved memories");
    expect(memoryPrompt(list)).toContain(`[${memory.id}] Knee niggle on the left`);
  });
});
