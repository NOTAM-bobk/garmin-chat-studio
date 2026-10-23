import { describe, expect, it } from "vitest";

import { axisValues, chartBounds, formatChartValue, parseChartSpec } from "@/lib/chart";

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

  it("keeps an optional target as a benchmark line", () => {
    const spec = parseChartSpec(
      JSON.stringify({ type: "line", x, data: [72, 80, 84], target: 80, targetLabel: "Goal 80" }),
    );
    expect(spec?.target).toBe(80);
    expect(spec?.targetLabel).toBe("Goal 80");
    expect(parseChartSpec(JSON.stringify({ type: "line", x, data: [1, 2, 3] }))?.target).toBe(
      undefined,
    );
  });

  it("keeps optional axis captions", () => {
    const spec = parseChartSpec(
      JSON.stringify({ type: "line", x, data: [1, 2, 3], xLabel: "Night", yLabel: "Score" }),
    );
    expect(spec?.xLabel).toBe("Night");
    expect(spec?.yLabel).toBe("Score");
    expect(parseChartSpec(JSON.stringify({ type: "line", x, data: [1, 2, 3] }))?.xLabel).toBe(
      undefined,
    );
  });

  it("moves only explicitly right-axis series onto the second scale", () => {
    const spec = parseChartSpec(
      JSON.stringify({
        type: "line",
        x,
        series: [
          { name: "Sleep", data: [7, 6, 8] },
          { name: "Load", data: [300, 420, 380], axis: "right" },
        ],
      }),
    );
    expect(spec?.series[0]?.axis).toBeUndefined();
    expect(spec?.series[1]?.axis).toBe("right");
    expect(spec && axisValues(spec, "left")).toEqual([7, 6, 8]);
    expect(spec && axisValues(spec, "right")).toEqual([300, 420, 380]);
  });
});

describe("chart scaling", () => {
  it("fits a trend to its own range but keeps bars on a zero baseline", () => {
    const [trendMin, trendMax] = chartBounds([72, 80, 84], false);
    expect(trendMin).toBeLessThan(72);
    expect(trendMax).toBeGreaterThan(84);

    const [barMin, barMax] = chartBounds([72, 80, 84], true);
    expect(barMin).toBe(0);
    expect(barMax).toBeGreaterThan(84);
  });

  it("formats short values without noise", () => {
    expect(formatChartValue(72)).toBe("72");
    expect(formatChartValue(5.316)).toBe("5.32");
    expect(formatChartValue(72500)).toBe("72.5k");
  });
});
