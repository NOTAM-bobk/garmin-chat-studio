import { describe, expect, it } from "vitest";

import { parseChartSpec } from "@/lib/chart";

const x = ["Mon", "Tue", "Wed"];

describe("parseChartSpec", () => {
  it("keeps line, bar and area specs", () => {
    for (const type of ["line", "bar", "area"]) {
      const spec = parseChartSpec(
        JSON.stringify({ type, x, series: [{ name: "Load", data: [10, 20, 30] }] }),
      );
      expect(spec?.type).toBe(type);
      expect(spec?.series[0]?.data).toEqual([10, 20, 30]);
    }
  });

  it("reads pie and donut as pie charts", () => {
    const spec = parseChartSpec(
      JSON.stringify({ type: "donut", x: ["Z1", "Z2", "Z3"], series: [{ data: [5, 12, 3] }] }),
    );
    expect(spec?.type).toBe("pie");
    expect(spec?.x).toEqual(["Z1", "Z2", "Z3"]);
  });

  it("accepts a bare number list as one series", () => {
    const spec = parseChartSpec(JSON.stringify({ type: "bar", x, data: [1, 2, 3] }));
    expect(spec?.series).toHaveLength(1);
    expect(spec?.series[0]?.data).toEqual([1, 2, 3]);
  });

  it("rejects mismatched or missing data", () => {
    expect(parseChartSpec(JSON.stringify({ x, series: [{ data: [1, 2] }] }))).toBeNull();
    expect(parseChartSpec("not json")).toBeNull();
  });
});
