/**
 * Chart specs emitted by the assistant inside ```chart fences.
 *
 * The model is told to send one line of JSON; everything is validated here
 * before it reaches recharts, so a malformed block degrades to text.
 */

/** Which y-axis a series is measured against; the right one is opt-in. */
export type ChartAxis = "left" | "right";

export type ChartSeries = { name?: string; data: number[]; axis?: ChartAxis };

export type ChartType = "line" | "bar" | "area" | "pie";

export type ChartSpec = {
  type: ChartType;
  title?: string;
  unit?: string;
  x: string[];
  series: ChartSeries[];
  /** Optional captions for the two axes, when the labels need context. */
  xLabel?: string;
  yLabel?: string;
  /** Optional benchmark drawn as a dashed line (goal, ceiling, baseline). */
  target?: number;
  targetLabel?: string;
};

function chartType(value: unknown): ChartType {
  if (value === "bar" || value === "column") return "bar";
  if (value === "area") return "area";
  if (value === "pie" || value === "donut") return "pie";
  return "line";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseChartSpec(raw: string): ChartSpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const x = Array.isArray(record["x"])
    ? record["x"].map((label) => String(label)).slice(0, 31)
    : [];
  if (x.length < 2) return null;

  const type = chartType(record["type"]);
  const rawSeries = Array.isArray(record["series"]) ? record["series"] : [];
  const series: ChartSeries[] = [];
  for (const entry of rawSeries.slice(0, 3)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const data = Array.isArray(item["data"])
      ? item["data"].filter(isFiniteNumber)
      : Array.isArray(item["values"])
        ? item["values"].filter(isFiniteNumber)
        : [];
    if (data.length !== x.length) continue;
    const axis = item["axis"];
    series.push({
      ...(typeof item["name"] === "string" && item["name"].trim()
        ? { name: item["name"].trim().slice(0, 40) }
        : {}),
      ...(axis === "right" || axis === "secondary" || axis === "y2"
        ? { axis: "right" as const }
        : {}),
      data,
    });
  }

  // A bare number list is enough for a single-series chart.
  if (series.length === 0) {
    const flat = Array.isArray(record["data"])
      ? record["data"].filter(isFiniteNumber)
      : Array.isArray(record["values"])
        ? record["values"].filter(isFiniteNumber)
        : [];
    if (flat.length === x.length) {
      series.push({
        ...(typeof record["name"] === "string" && record["name"].trim()
          ? { name: record["name"].trim().slice(0, 40) }
          : {}),
        data: flat,
      });
    }
  }
  if (series.length === 0) return null;

  const target = isFiniteNumber(record["target"])
    ? record["target"]
    : isFiniteNumber(record["goal"])
      ? record["goal"]
      : undefined;

  return {
    type,
    ...(typeof record["title"] === "string" && record["title"].trim()
      ? { title: record["title"].trim().slice(0, 80) }
      : {}),
    ...(typeof record["unit"] === "string" && record["unit"].trim()
      ? { unit: record["unit"].trim().slice(0, 16) }
      : {}),
    ...(typeof record["xLabel"] === "string" && record["xLabel"].trim()
      ? { xLabel: record["xLabel"].trim().slice(0, 24) }
      : {}),
    ...(typeof record["yLabel"] === "string" && record["yLabel"].trim()
      ? { yLabel: record["yLabel"].trim().slice(0, 24) }
      : {}),
    ...(target !== undefined ? { target } : {}),
    ...(typeof record["targetLabel"] === "string" && record["targetLabel"].trim()
      ? { targetLabel: record["targetLabel"].trim().slice(0, 24) }
      : {}),
    x,
    series,
  };
}

/** Compact number for axis ticks and stat chips: 72, 5.3, 1.2k. */
export function formatChartValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 10000) {
    const scaled = value / 1000;
    return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}k`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Y range for one axis. Line charts are fitted to the data so a 4-point drift
 * stays visible; bars and areas keep a zero baseline so size is honest.
 */
export function chartBounds(values: number[], zeroBased: boolean): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (zeroBased) {
    min = Math.min(0, min);
    max = Math.max(0, max);
    return [min, max === min ? min + 1 : max * 1.05];
  }
  if (min === max) {
    const bump = Math.abs(min) * 0.1 || 1;
    return [min - bump, max + bump];
  }
  const pad = (max - min) * 0.15;
  // Metrics like HRV or sleep score cannot be negative, so do not draw there.
  return [min >= 0 ? Math.max(0, min - pad) : min - pad, max + pad];
}

/** Values a series contributes to its axis, clamped to the charted window. */
export function axisValues(spec: ChartSpec, axis: ChartAxis): number[] {
  return spec.series
    .filter((series) => (axis === "right" ? series.axis === "right" : series.axis !== "right"))
    .flatMap((series) => series.data);
}

/** Latest reading and the move since the first reading, for the stat strip. */
export function seriesChange(series: ChartSeries): { last: number; delta: number } | null {
  if (series.data.length === 0) return null;
  const first = series.data[0]!;
  const last = series.data[series.data.length - 1]!;
  return { last, delta: last - first };
}
