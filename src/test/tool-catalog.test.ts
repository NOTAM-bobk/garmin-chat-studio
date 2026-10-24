import { describe, expect, it } from "vitest";

import {
  TOOL_CAP,
  coreTools,
  type GarminTool,
  GARMIN_TOOL_ALLOWLIST,
  isAllowedTool,
} from "@/lib/garmin";
import { matchTools, matchesText } from "@/lib/tool-catalog";

function make(name: string, description = `${name} data`, required: string[] = []): GarminTool {
  return {
    name,
    description,
    parameters: {
      type: "object",
      required,
      properties: Object.fromEntries(required.map((key) => [key, { type: "string" }])),
    },
  };
}

const TOOLS: GarminTool[] = [
  make("get_lactate_threshold", "Get lactate threshold data", ["start", "end"]),
  make("get_gear", "Get all gear registered with the user account"),
  make("add_gear_to_activity", "Associate gear with an activity", ["gear_id", "activity_id"]),
  make("get_earned_badges", "Get earned badges for user"),
  make("get_courses", "List all courses saved on Garmin Connect"),
  make("get_nutrition_daily_food_log", "Get daily food consumption records for a date"),
  make("search_foods", "Search Garmin's general food catalog"),
  make("get_weigh_ins", "Get weight measurements between specified dates"),
  make("add_weigh_in", "Add a new weight measurement"),
  make("get_sleep_data", "Get full sleep data with all details"),
  make("delete_workout", "Delete a workout from Garmin Connect", ["workout_id"]),
];

describe("matchTools", () => {
  it("finds a metric by topic, not by exact tool name", () => {
    expect(matchTools("lactate threshold", TOOLS)[0]?.name).toBe("get_lactate_threshold");
    expect(matchTools("badges", TOOLS)[0]?.name).toBe("get_earned_badges");
    expect(matchTools("food log", TOOLS)[0]?.name).toBe("get_nutrition_daily_food_log");
  });

  it("prefers a reading over a write when both match", () => {
    expect(matchTools("gear", TOOLS).map((tool) => tool.name)).toEqual([
      "get_gear",
      "add_gear_to_activity",
    ]);
    expect(matchTools("weight", TOOLS)[0]?.name).toBe("get_weigh_ins");
  });

  it("still returns the write when only the write matches", () => {
    expect(matchTools("delete workout", TOOLS)[0]?.name).toBe("delete_workout");
  });

  it("ignores stop words and empty queries", () => {
    expect(matchTools("", TOOLS)).toEqual([]);
    expect(matchTools("the garmin tools for a", TOOLS)).toEqual([]);
  });

  it("respects the limit it is given", () => {
    expect(matchTools("weight", TOOLS, 1)).toHaveLength(1);
  });
});

describe("matchesText", () => {
  it("lists the tool ids with their required arguments", () => {
    const matched = matchTools("lactate", TOOLS);
    const text = matchesText(matched, "lactate");
    expect(text).toContain("get_lactate_threshold(start, end)");
    expect(text).toContain("callable on your next turn");
  });

  it("says plainly when nothing matched", () => {
    expect(matchesText([], "hydraulic press")).toContain(
      'No Garmin tool matches "hydraulic press"',
    );
  });
});

describe("coreTools", () => {
  const full = GARMIN_TOOL_ALLOWLIST.map((name) => make(name));

  it("sends a small account's whole set", () => {
    const personal = [make("get_sleep_summary"), make("get_daily_steps")];
    expect(coreTools(personal)).toBe(personal);
  });

  it("keeps a 150-tool account under the provider cap", () => {
    const core = coreTools(full);
    expect(core.length).toBeGreaterThan(20);
    expect(core.length).toBeLessThan(TOOL_CAP);
    expect(core.some((tool) => tool.name === "get_sleep_summary_range")).toBe(true);
    expect(core.some((tool) => tool.name === "get_earned_badges")).toBe(false);
  });

  it("still returns tools when the gateway renames everything", () => {
    const unknown = Array.from({ length: 150 }, (_, index) =>
      make(`get_custom_${index}`, "custom"),
    );
    expect(coreTools(unknown).length).toBe(60);
  });

  it("leaves the long tail discoverable and callable", () => {
    const loaded = new Set(coreTools(full).map((tool) => tool.name));
    const rest = full.filter((tool) => !loaded.has(tool.name));
    expect(rest.length).toBeGreaterThan(60);
    expect(rest.every((tool) => isAllowedTool(tool.name))).toBe(true);
    expect(matchTools("badges", rest)[0]?.name).toContain("badge");
  });
});
