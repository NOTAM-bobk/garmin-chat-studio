import { describe, expect, it } from "vitest";

import { PERSONAL_TOOLS, personalPath } from "@/server/garmin-key.server";

describe("personal API toolset", () => {
  it("offers read-only tools with unique names", () => {
    const names = PERSONAL_TOOLS.map((tool) => tool.name);
    expect(names).toContain("get_activities_by_date");
    expect(names).toContain("get_activity");
    expect(names).toContain("get_sleep_summary_range");
    expect(names.every((name) => name.startsWith("get_"))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of PERSONAL_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.parameters.type).toBe("object");
    }
  });

  it("maps a date range onto the documented path", () => {
    expect(
      personalPath("get_sleep_summary_range", {
        start_date: "2026-10-01",
        end_date: "2026-10-07",
      }),
    ).toEqual({
      path: "/sleep-service/sleep/dailySleepSummariesByDate?startDate=2026-10-01&endDate=2026-10-07",
      trimmed: false,
    });
  });

  it("clamps a range the endpoint would reject", () => {
    const built = personalPath("get_daily_steps", {
      start_date: "2026-01-01",
      end_date: "2026-10-01",
    });
    expect(built?.trimmed).toBe(true);
    expect(built?.path).toBe("/usersummary-service/stats/steps/daily/2026-09-25/2026-10-01");
  });

  it("defaults a missing range to the last week, without claiming a trim", () => {
    const built = personalPath("get_daily_steps", {});
    expect(built?.trimmed).toBe(false);
    expect(built?.path).toMatch(
      /^\/usersummary-service\/stats\/steps\/daily\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("orders a reversed range and caps the activity list", () => {
    const built = personalPath("get_activities_by_date", {
      start_date: "2026-10-07",
      end_date: "2026-10-01",
      limit: 500,
    });
    expect(built?.path).toContain("startDate=2026-10-01");
    expect(built?.path).toContain("endDate=2026-10-07");
    expect(built?.path).toContain("limit=50");
  });

  it("reaches the hydration, goal, nutrition and fitness-age endpoints", () => {
    expect(
      personalPath("get_hydration", { start_date: "2026-10-01", end_date: "2026-10-07" }),
    ).toEqual({
      path: "/usersummary-service/stats/hydration/daily/2026-10-01/2026-10-07",
      trimmed: false,
    });
    expect(
      personalPath("get_weight_goal", { start_date: "2026-10-01", end_date: "2026-10-07" })?.path,
    ).toBe("/goal-service/goal/user/effective/weightgoal/2026-10-01/2026-10-07");
    expect(personalPath("get_nutrition_logs", { date: "2026-10-01" })?.path).toBe(
      "/nutrition-service/food/logs/2026-10-01",
    );
    expect(personalPath("get_fitness_age", { date: "2026-10-01" })?.path).toBe(
      "/fitnessage-service/fitnessage/v2/2026-10-01",
    );
    expect(
      personalPath("get_wellness_activity_summaries", {
        start_date: "2026-10-01",
        end_date: "2026-10-07",
      })?.path,
    ).toBe("/wellnessactivity-service/activity/summary/range/2026-10-01/2026-10-07");
  });

  it("sends a reference day with the cycle day view", () => {
    expect(personalPath("get_menstrual_cycle_summary", { date: "2026-10-01" })?.path).toBe(
      "/periodichealth-service/menstrualcycle/summary/2026-10-01",
    );
    expect(personalPath("get_menstrual_cycle_day", { date: "2026-10-01" })?.path).toBe(
      "/periodichealth-service/menstrualcycle/dayview/2026-10-01?todayDate=2026-10-01",
    );
    expect(
      personalPath("get_menstrual_cycle_day", { date: "2026-09-28", today_date: "2026-10-01" })
        ?.path,
    ).toBe("/periodichealth-service/menstrualcycle/dayview/2026-09-28?todayDate=2026-10-01");
  });

  it("requires a numeric activity id and ignores unknown tools", () => {
    expect(() => personalPath("get_activity", {})).toThrow(/activity id/i);
    expect(personalPath("get_activity", { activity_id: 12345 })?.path).toBe(
      "/activity-service/activity/12345",
    );
    expect(personalPath("create_run_workout", {})).toBeNull();
  });
});
