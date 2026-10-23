import { describe, expect, it } from "vitest";

import {
  addMode,
  cleanModeInstruction,
  cleanModeName,
  dropMode,
  modeToneId,
  resolveTone,
  toneOptions,
} from "@/lib/modes";
import { TONES } from "@/lib/models";

describe("custom modes", () => {
  it("cleans the name and instruction", () => {
    expect(cleanModeName("  Race   week coach  ")).toBe("Race week coach");
    expect(cleanModeInstruction("  Keep it\n short.  ")).toBe("Keep it short.");
  });

  it("saves a mode and rejects a duplicate name", () => {
    const first = addMode([], "Physio", "Answer like a sports physio.");
    expect(first.duplicate).toBe(false);
    expect(first.mode.instruction).toBe("Answer like a sports physio.");

    const second = addMode(first.list, "physio", "Different words.");
    expect(second.duplicate).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.mode.id).toBe(first.mode.id);
  });

  it("resolves a custom mode to its prompt and falls back for unknown ids", () => {
    const { list, mode } = addMode([], "Race week", "Short briefings only.");
    expect(resolveTone(modeToneId(mode.id), list).prompt).toContain("Short briefings only.");
    expect(resolveTone("nonsense", list).id).toBe(TONES[0]!.id);
    expect(resolveTone("analyst", list).prompt).toContain("data analyst");
  });

  it("lists custom modes after the built-in tones and drops them on delete", () => {
    const { list, mode } = addMode([], "Physio", "Answer like a sports physio.");
    const options = toneOptions(list);
    expect(options).toHaveLength(TONES.length + 1);
    expect(options.at(-1)?.label).toBe("Physio");
    expect(dropMode(list, mode.id)).toHaveLength(0);
  });
});
