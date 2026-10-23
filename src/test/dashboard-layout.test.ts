import { describe, expect, it } from "vitest";

import { DEFAULT_LAYOUT, moveWidget, parseLayout, updateWidget } from "@/lib/dashboard-layout";

describe("dashboard layout", () => {
  it("moves a widget one place", () => {
    const next = moveWidget(DEFAULT_LAYOUT, "battery", -1);
    expect(next[0]?.id).toBe("battery");
    expect(next[1]?.id).toBe("readiness");
  });

  it("does not move past the edges", () => {
    expect(moveWidget(DEFAULT_LAYOUT, "readiness", -1)).toBe(DEFAULT_LAYOUT);
  });

  it("hides a widget", () => {
    const next = updateWidget(DEFAULT_LAYOUT, "hrv", { visible: false });
    expect(next.find((w) => w.id === "hrv")?.visible).toBe(false);
  });

  it("restores missing widgets and drops unknown ones from saved layouts", () => {
    const out = parseLayout(JSON.stringify([{ id: "bogus" }, { id: "week", visible: false, size: "lg" }]));
    expect(out[0]).toEqual({ id: "week", visible: false, size: "lg" });
    expect(out).toHaveLength(DEFAULT_LAYOUT.length);
  });
});
