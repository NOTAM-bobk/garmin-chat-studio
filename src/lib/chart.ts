/**
 * Chart specs emitted by the assistant inside ```chart fences.
 *
 * The model is told to send one line of JSON; everything is validated here
 * before it reaches recharts, so a malformed block degrades to text.
 */

export type ChartSeries = { name?: string; data: number[] };

export type ChartType = "line" | "bar" | "area" | "pie";

export type ChartSpec = {
  type: ChartType;
  title?: string;
  unit?: string;
  x: string[];
  series: ChartSeries[];
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
    series.push({
      ...(typeof item["name"] === "string" && item["name"].trim()
        ? { name: item["name"].trim().slice(0, 40) }
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

  return {
    type,
    ...(typeof record["title"] === "string" && record["title"].trim()
      ? { title: record["title"].trim().slice(0, 80) }
      : {}),
    ...(typeof record["unit"] === "string" && record["unit"].trim()
      ? { unit: record["unit"].trim().slice(0, 16) }
      : {}),
    x,
    series,
  };
}
