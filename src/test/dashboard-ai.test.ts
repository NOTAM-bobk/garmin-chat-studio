import { describe, expect, it } from "vitest";

import {
  applyInsights,
  factList,
  fallbackPlan,
  fillArguments,
  parsePlan,
  parseStoredPlan,
  planFits,
  type Gadget,
} from "@/lib/dashboard-ai";
import type { GarminTool } from "@/lib/garmin";

const NOW = new Date("2026-10-24T09:00:00");

function tool(
  name: string,
  required: string[] = [],
  properties: Record<string, Record<string, unknown>> = {},
): GarminTool {
  return {
    name,
    description: `${name} reading`,
    parameters: { type: "object", required, properties },
  };
}

const RANGE = {
  start: { type: "string" },
  end: { type: "string" },
};

const TOOLS: GarminTool[] = [
  tool("get_sleep_summary_range", ["start", "end"], RANGE),
  tool("get_hrv_trend", ["start", "end"], RANGE),
  tool("get_daily_steps", [], {}),
  tool("get_training_readiness", [], {}),
  tool("create_run_workout", ["name"], { name: { type: "string" } }),
];

const gadget = (overrides: Partial<Gadget> = {}): Gadget => ({
  id: "g1",
  title: "Sleep",
  tool: "get_sleep_summary_range",
  args: { start: "2026-10-11", end: "2026-10-24" },
  kind: "chart",
  span: "lg",
  visible: true,
  ...overrides,
});

describe("fillArguments", () => {
  it("fills a missing date range ending today", () => {
    const args = fillArguments(TOOLS[0]!, {}, NOW);
    expect(args).toEqual({ start: "2026-10-11", end: "2026-10-24" });
  });

  it("keeps a recent explicit range", () => {
    const args = fillArguments(TOOLS[0]!, { start: "2026-10-01", end: "2026-10-20" }, NOW);
    expect(args).toEqual({ start: "2026-10-01", end: "2026-10-20" });
  });

  it("drops a date the model invented in the future", () => {
    const args = fillArguments(TOOLS[0]!, { start: "2027-04-01", end: "2027-04-14" }, NOW);
    expect(args).toEqual({ start: "2026-10-11", end: "2026-10-24" });
  });

  it("returns null when a required identifier cannot be guessed", () => {
    const needsId = tool("get_activity", ["activity_id"], { activity_id: { type: "string" } });
    expect(fillArguments(needsId, {}, NOW)).toBeNull();
  });
});

describe("parsePlan", () => {
  it("keeps available tools, fills dates and drops write tools", () => {
    const plan = parsePlan(
      JSON.stringify({
        headline: "Watch recovery this week",
        focus: "Sleep has been short.",
        gadgets: [
          { title: "Sleep", tool: "get_sleep_summary_range", kind: "chart" },
          { title: "HRV", tool: "get_hrv_trend", kind: "chart", args: { start: "2026-10-01" } },
          { title: "Workout", tool: "create_run_workout", kind: "stat" },
          { title: "Steps", tool: "get_daily_steps", kind: "stat", args: { start: "2026-10-10" } },
          { title: "Readiness", tool: "get_training_readiness", kind: "stat", span: "lg" },
        ],
      }),
      TOOLS,
      NOW,
    );

    expect(plan?.source).toBe("ai");
    expect(plan?.headline).toBe("Watch recovery this week");
    expect(plan?.gadgets.map((item) => item.tool)).toEqual([
      "get_sleep_summary_range",
      "get_hrv_trend",
      "get_daily_steps",
      "get_training_readiness",
    ]);
    expect(plan?.gadgets[0]?.args).toEqual({ start: "2026-10-11", end: "2026-10-24" });
    expect(plan?.gadgets[2]?.kind).toBe("stat");
    expect(plan?.gadgets[3]?.span).toBe("lg");
  });

  it("rejects prose and layouts with too few usable gadgets", () => {
    expect(parsePlan("Here is a dashboard for you!", TOOLS, NOW)).toBeNull();
    expect(
      parsePlan(
        JSON.stringify({ gadgets: [{ tool: "get_daily_steps" }, { tool: "not_a_tool" }] }),
        TOOLS,
        NOW,
      ),
    ).toBeNull();
  });

  it("de-duplicates the same reading requested twice", () => {
    const plan = parsePlan(
      JSON.stringify({
        gadgets: [
          "get_sleep_summary_range",
          "get_sleep_summary_range",
          "get_hrv_trend",
          "get_daily_steps",
        ].map((name) => ({ title: name, tool: name, kind: "chart" })),
      }),
      TOOLS,
      NOW,
    );
    expect(plan?.gadgets).toHaveLength(3);
  });
});

describe("applyInsights", () => {
  it("attaches the note, value and series that match a gadget id", () => {
    const gadgets = [gadget()];
    const out = applyInsights(
      JSON.stringify({
        gadgets: [
          {
            id: "g1",
            note: "Sleep is 40 minutes short of your 14-day average.",
            value: "6h 52m",
            series: {
              x: ["Oct 12", "Oct 13", "Oct 14"],
              y: [72, 80, 68],
              label: "Score",
              type: "bar",
            },
          },
        ],
      }),
      gadgets,
    );
    expect(out[0]?.note).toBe("Sleep is 40 minutes short of your 14-day average.");
    expect(out[0]?.value).toBe("6h 52m");
    expect(out[0]?.series).toEqual({
      x: ["Oct 12", "Oct 13", "Oct 14"],
      y: [72, 80, 68],
      label: "Score",
      type: "bar",
    });
  });

  it("ignores unknown ids and series that do not line up", () => {
    const gadgets = [gadget()];
    const out = applyInsights(
      JSON.stringify({
        gadgets: [
          { id: "nope", note: "Lost" },
          { id: "g1", note: "Kept", series: { x: ["a", "b"], y: [1, 2, 3], label: "Bad" } },
        ],
      }),
      gadgets,
    );
    expect(out[0]?.note).toBe("Kept");
    expect(out[0]?.series).toBeUndefined();
  });

  it("leaves gadgets untouched when the reply is not JSON", () => {
    const gadgets = [gadget()];
    expect(applyInsights("I could not read that data.", gadgets)).toBe(gadgets);
  });
});

describe("fallbackPlan", () => {
  it("uses the built-in grid when those tools exist", () => {
    const plan = fallbackPlan(TOOLS, NOW);
    expect(plan.source).toBe("fallback");
    expect(plan.gadgets[0]?.tool).toBe("get_training_readiness");
    expect(plan.gadgets.every((item) => TOOLS.some((entry) => entry.name === item.tool))).toBe(
      true,
    );
  });

  it("builds from whatever a personal-key account exposes", () => {
    const personal = [
      tool("get_sleep_summary_range", ["start", "end"], RANGE),
      tool("get_daily_steps", [], {}),
      tool("get_hydration", ["date"], { date: { type: "string" } }),
      tool("get_body_battery", ["start", "end"], RANGE),
    ];
    const plan = fallbackPlan(personal, NOW);
    expect(plan.gadgets.map((item) => item.tool)).toEqual([
      "get_body_battery",
      "get_sleep_summary_range",
      "get_daily_steps",
      "get_hydration",
    ]);
    expect(plan.gadgets.find((item) => item.tool === "get_hydration")?.args).toEqual({
      date: "2026-10-24",
    });
  });
});

describe("planFits", () => {
  it("rejects a saved plan whose tools disappeared", () => {
    const plan = fallbackPlan(TOOLS, NOW);
    expect(planFits(plan, TOOLS)).toBe(true);
    expect(planFits(plan, TOOLS.slice(0, 1))).toBe(false);
    expect(planFits(null, TOOLS)).toBe(false);
  });

  it("round-trips through storage without notes or charts", () => {
    const stored = parseStoredPlan(
      JSON.stringify({
        headline: "Keep it easy",
        focus: "Recovery first.",
        source: "ai",
        gadgets: [gadget({ note: "stale", value: "70" })],
      }),
    );
    expect(stored?.headline).toBe("Keep it easy");
    expect(stored?.gadgets[0]?.note).toBeUndefined();
    expect(stored?.gadgets[0]?.tool).toBe("get_sleep_summary_range");
    expect(parseStoredPlan("{}")).toBeNull();
  });
});

describe("factList", () => {
  it("flattens nested Garmin JSON into labelled rows", () => {
    const { rows } = factList(
      JSON.stringify({ sleepScore: 78, stages: [{ deep: 72, rem: 88 }], note: "steady" }),
    );
    expect(rows[0]).toEqual({ label: "Sleep Score", value: "78" });
    expect(rows.some((row) => row.label.includes("Stages"))).toBe(true);
    expect(rows.some((row) => row.value === "steady")).toBe(true);
  });

  it("falls back to raw text when the result is not JSON", () => {
    const { rows, raw } = factList("No data returned.");
    expect(rows).toHaveLength(0);
    expect(raw).toBe("No data returned.");
  });
});
