/**
 * Chart specs emitted by the assistant inside ```chart fences.
 *
 * The model is told to send one line of JSON; everything is validated here
 * before it reaches recharts, so a malformed block degrades to text.
 */

export type ChartSeries = { name?: string; data: number[] };

export type ChartSpec = {
  type: "line" | "bar" | "area";
  title?: string;
  unit?: string;
  x: string[];
  series: ChartSeries[];
};

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

  const rawSeries = Array.isArray(record["series"]) ? record["series"] : [];
  const series: ChartSeries[] = [];
  for (const entry of rawSeries.slice(0, 3)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const data = Array.isArray(item["data"]) ? item["data"].filter(isFiniteNumber) : [];
    if (data.length !== x.length) continue;
    series.push({
      ...(typeof item["name"] === "string" && item["name"].trim()
        ? { name: item["name"].trim().slice(0, 40) }
        : {}),
      data,
    });
  }
  if (series.length === 0) return null;

  const type = record["type"] === "bar" ? "bar" : record["type"] === "area" ? "area" : "line";

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
