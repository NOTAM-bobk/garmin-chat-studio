import { describe, expect, it } from "vitest";

import {
  DESTRUCTIVE_TOOLS,
  GARMIN_TOOL_ALLOWLIST,
  WRITE_TOOLS,
  describeTool,
  isAllowedTool,
  isReadTool,
} from "@/lib/garmin";

const MUTATION =
  /^(create|set|add|update|upsert|upload|schedule|unschedule|delete|remove|log|request)_/;

describe("Garmin tool catalogue", () => {
  it("covers the documented MissingMCP surface without duplicates", () => {
    expect(GARMIN_TOOL_ALLOWLIST).toHaveLength(150);
    expect(new Set(GARMIN_TOOL_ALLOWLIST).size).toBe(GARMIN_TOOL_ALLOWLIST.length);
  });

  it("exposes the tools the old read-only subset left out", () => {
    for (const name of [
      "get_lactate_threshold",
      "get_power_duration_curve",
      "get_menstrual_calendar_data",
      "get_nutrition_daily_food_log",
      "get_earned_badges",
      "get_device_alarms",
      "get_courses",
      "search_foods",
      "create_strength_workout",
      "set_perceived_effort",
      "add_hydration_data",
    ]) {
      expect(isAllowedTool(name)).toBe(true);
    }
  });

  it("keeps file and binary tools off the text bridge", () => {
    for (const name of [
      "download_workout",
      "download_course_gpx",
      "download_activity_file",
      "set_fit_download_dir",
    ]) {
      expect(isAllowedTool(name)).toBe(false);
    }
    expect(isAllowedTool("install_keylogger")).toBe(false);
  });

  it("still accepts read-only activity tools the gateway adds later", () => {
    expect(isAllowedTool("get_activity_streams")).toBe(true);
  });

  it("marks every mutating tool as a write", () => {
    const mutations = GARMIN_TOOL_ALLOWLIST.filter((name) => MUTATION.test(name));
    expect(mutations.length).toBeGreaterThan(20);
    expect(mutations.filter((name) => !WRITE_TOOLS.has(name))).toEqual([]);
    expect(WRITE_TOOLS.has("get_sleep_data")).toBe(false);
  });

  it("labels actions by their verb instead of 'Reading'", () => {
    expect(describeTool("delete_workout").label).toBe("Deleting workout");
    expect(describeTool("set_perceived_effort").label).toBe("Updating perceived effort");
    expect(describeTool("log_food").label).toBe("Logging food");
    expect(describeTool("get_lactate_threshold").label).toBe("Reading lactate threshold");
    expect(describeTool("get_sleep_data").label).toBe("Reading sleep data");
  });

  it("only lets readings back a dashboard gadget", () => {
    expect(isReadTool("get_sleep_data")).toBe(true);
    expect(isReadTool("search_foods")).toBe(false);
    expect(isReadTool("create_strength_workout")).toBe(false);
  });

  it("treats deleting and overwriting as destructive", () => {
    expect(DESTRUCTIVE_TOOLS.has("delete_workouts")).toBe(true);
    expect(DESTRUCTIVE_TOOLS.has("unschedule_workouts")).toBe(true);
    expect(DESTRUCTIVE_TOOLS.has("add_weigh_in")).toBe(false);
    for (const name of DESTRUCTIVE_TOOLS) expect(isAllowedTool(name)).toBe(true);
  });
});
