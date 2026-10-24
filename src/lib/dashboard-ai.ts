/**
 * AI-designed dashboard gadgets.
 *
 * The dashboard used to be eight hard-coded cards, several of which do not
 * exist on a personal-API account. Now the model is handed the readings this
 * account can actually produce, chooses which ones belong on the page and what
 * each is for, and — once the numbers are in — writes the one-line reading and
 * the chart shape for each gadget.
 *
 * Everything the model sends is validated here. A bad plan falls back to the
 * hand-picked grid, so the dashboard never ends up empty because the model
 * answered in prose or picked a tool that is not connected.
 */

import type { ChartType } from "@/lib/chart";
import { uid } from "@/lib/chat";
import { isReadTool, type GarminTool } from "@/lib/garmin";
import { CURATED_MODELS } from "@/lib/models";
import { ensureGuest, loadPuter, responseText } from "@/lib/puter";

export type GadgetKind = "stat" | "chart" | "list";

/** A compact series the model extracts from a tool result. */
export type GadgetSeries = {
  x: string[];
  y: number[];
  label: string;
  unit?: string;
  type: ChartType;
};

export type Gadget = {
  id: string;
  title: string;
  /** Garmin tool name; always one the connected account exposes. */
  tool: string;
  args: Record<string, unknown>;
  kind: GadgetKind;
  span: "sm" | "lg";
  visible: boolean;
  /** One-line reading of the numbers, written after the fetch. */
  note?: string;
  /** Headline value for a stat gadget. */
  value?: string;
  /** Chart data for a chart gadget. */
  series?: GadgetSeries;
};

export type DashboardPlan = {
  headline: string;
  focus: string;
  /** "ai" when the model laid it out, "fallback" when it is the built-in grid. */
  source: "ai" | "fallback";
  gadgets: Gadget[];
};

export type GadgetReading = { state: "loading" | "loaded" | "empty" | "error"; text: string };

const STORAGE_KEY = "garmin-chat:gadgets:v1";

/** Balanced curated model: this is a background layout call, not a chat. */
export const DESIGN_MODEL = CURATED_MODELS[1]?.id ?? "gpt-5.6";

export const MAX_GADGETS = 8;
const MAX_DATA_CHARS = 2400;

/* ------------------------------------------------------------------- dates */

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBefore(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function isDateKey(key: string): boolean {
  return /date|day$|start|end|^c(start|end)$/i.test(key);
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * Keep the model's arguments when they make sense for the tool, and fill in
 * anything a required parameter still needs. Returns null when a required
 * identifier (an activity id, say) cannot be guessed.
 */
export function fillArguments(
  tool: GarminTool,
  given: Record<string, unknown>,
  now = new Date(),
): Record<string, unknown> | null {
  const properties = (tool.parameters.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = tool.parameters.required ?? [];
  const hasSchema = Object.keys(properties).length > 0;
  const today = isoDate(now);
  const windowStart = isoDate(daysBefore(now, 13));
  const args: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(given)) {
    if (!isScalar(value)) continue;
    if (hasSchema && !(key in properties)) continue;
    if (typeof value === "string") {
      const trimmed = value.trim().slice(0, 64);
      if (!trimmed) continue;
      if (isDateKey(key)) {
        // Only a real, recent YYYY-MM-DD survives; anything else is re-derived.
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        const time = match ? Date.parse(`${trimmed}T12:00:00`) : NaN;
        const oldest = daysBefore(now, 730).getTime();
        if (
          !match ||
          !Number.isFinite(time) ||
          time < oldest ||
          time > now.getTime() + 86_400_000
        ) {
          continue;
        }
      }
      args[key] = trimmed;
      continue;
    }
    args[key] = value;
  }

  for (const key of required) {
    const current = args[key];
    if (current !== undefined) continue;
    const schema = properties[key] ?? {};
    const lower = key.toLowerCase();
    if (/^(start|from|cstart)/.test(lower) || lower === "startdate") args[key] = windowStart;
    else if (/^(end|to|cend)/.test(lower) || lower === "enddate") args[key] = today;
    else if (/date|calendar/.test(lower)) args[key] = today;
    else if (Array.isArray(schema["enum"]) && schema["enum"].length > 0)
      args[key] = schema["enum"][0];
    else if (schema["type"] === "number" || schema["type"] === "integer") args[key] = 7;
    else if (schema["type"] === "boolean") args[key] = false;
    else return null;
  }

  return args;
}

/* ------------------------------------------------------------------ prompts */

function toolLine(tool: GarminTool): string {
  const properties = (tool.parameters.properties ?? {}) as Record<string, unknown>;
  const required = tool.parameters.required ?? [];
  const args = required.length > 0 ? `(${required.join(", ")})` : "";
  const says = tool.description.replace(/\s+/g, " ").trim();
  const optional = Object.keys(properties).filter((key) => !required.includes(key));
  const extra = optional.length > 0 ? ` [optional: ${optional.slice(0, 6).join(", ")}]` : "";
  return `- ${tool.name}${args} — ${says.slice(0, 130)}${extra}`;
}

function toolCatalogue(tools: GarminTool[]): string {
  return tools
    .filter((tool) => isReadTool(tool.name))
    .map(toolLine)
    .join("\n");
}

export function designMessages(
  tools: GarminTool[],
  now = new Date(),
): { role: "system"; content: string }[] {
  const today = isoDate(now);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return [
    {
      role: "system",
      content: `You lay out a training dashboard for one athlete whose Garmin account is connected. You cannot see their data yet: you only decide which readings belong on the page and how each one is shown.

Reply with one JSON object and nothing else:
{"headline":"...","focus":"...","gadgets":[{"title":"...","tool":"get_sleep_summary_range","args":{"start":"${isoDate(daysBefore(now, 13))}","end":"${today}"},"kind":"chart","span":"lg"}]}

Rules:
- 5 to 8 gadgets. Quality over quantity: every gadget must earn its place.
- "tool" must be copied exactly from the list below. Never invent a tool.
- "args" carries only that tool's parameters. Dates are YYYY-MM-DD and must not be in the future. Today is ${weekday}, ${today}. Use a 14-day window for trends and today's date for a daily snapshot.
- "kind": "stat" for one number with a unit, "chart" for 7-30 days of a series, "list" for a short table (activity rows, zones, records).
- "span": "lg" for charts and lists, "sm" for single numbers.
- Order matters: the reading that most affects today's training comes first.
- Titles are 2-4 words and name the metric ("Readiness", "Sleep debt", "HRV trend"), not the tool.
- "headline": at most 8 words describing what this dashboard watches. No numbers.
- "focus": one sentence, at most 110 characters, naming what to look at first today and why.

Ratings, readiness style metrics, sleep, HRV, load, recovery and the most recent sessions are usually the strongest set. Include a health or lifestyle reading only when the account offers nothing better.

Available tools:
${toolCatalogue(tools)}`,
    },
  ];
}

export function insightMessages(
  gadgets: Gadget[],
  readings: Record<string, GadgetReading>,
  now = new Date(),
): { role: "system" | "user"; content: string }[] {
  const payload = gadgets.map((gadget) => ({
    id: gadget.id,
    title: gadget.title,
    kind: gadget.kind,
    tool: gadget.tool,
    data: (readings[gadget.id]?.text ?? "").slice(0, MAX_DATA_CHARS),
  }));
  return [
    {
      role: "system",
      content: `You turn raw Garmin API output into the contents of one dashboard gadget each.

Reply with one JSON object and nothing else:
{"gadgets":[{"id":"...","note":"...","value":"...","series":{"x":["Oct 12","Oct 13","Oct 14"],"y":[62,58,71],"label":"HRV","unit":"ms","type":"line"}}]}

Rules:
- One entry per gadget id below. Copy each id exactly; never add an id that is not in the input.
- "note": one short sentence (max 130 characters) saying what the numbers mean, and the change since the start of the window when the data shows one. No praise, no greeting, no advice unless the data clearly demands it. Omit if the data is empty or unreadable.
- "value": for "stat" gadgets, the single decision-relevant number as a short string with its unit ("62 ms", "7h 12m", "84"). Use only numbers that appear in the data.
- "series": for "chart" gadgets, 3 to 31 points: "x" are short labels ("Mon", "Oct 12"), "y" are the matching numbers, "label" names the metric, "unit" is optional, "type" is "line" for a trend, "bar" for day-by-day, "area" for accumulated volume. Use only values present in the data — never invent, average or interpolate. If the data cannot fill at least three points, omit the series.
- Dates in the data are real; today is ${isoDate(now)}. Keep x labels in date order.
- Never wrap the JSON in a code fence and never add commentary around it.`,
    },
    { role: "user", content: JSON.stringify(payload) },
  ];
}

/* ------------------------------------------------------------------ parsing */

function jsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Human title from a tool name, used when the model forgets to name a gadget. */
export function titleFor(tool: string): string {
  const words = tool.replace(/^get_/, "").replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function parseSeries(value: unknown): GadgetSeries | null {
  if (!isRecord(value)) return null;
  const rawX = Array.isArray(value["x"])
    ? value["x"]
    : Array.isArray(value["labels"])
      ? value["labels"]
      : [];
  const rawY = Array.isArray(value["y"])
    ? value["y"]
    : Array.isArray(value["data"])
      ? value["data"]
      : Array.isArray(value["values"])
        ? value["values"]
        : [];
  const x = rawX.map((label) => text(label, 16)).filter(Boolean);
  const y = rawY.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
  const count = Math.min(x.length, y.length, 31);
  if (count < 3) return null;
  const label = text(value["label"], 22);
  const unit = text(value["unit"], 10);
  const type: ChartType =
    value["type"] === "bar" ? "bar" : value["type"] === "area" ? "area" : "line";
  return {
    x: x.slice(0, count),
    y: y.slice(0, count),
    label: label || "Value",
    ...(unit ? { unit } : {}),
    type,
  };
}

/** Attach the model's notes, headline values and series to existing gadgets. */
export function applyInsights(raw: string, gadgets: Gadget[]): Gadget[] {
  const json = jsonObject(raw);
  if (!json) return gadgets;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return gadgets;
  }
  if (!isRecord(parsed)) return gadgets;
  const list = Array.isArray(parsed["gadgets"]) ? parsed["gadgets"] : [];
  const patched = new Map<string, Gadget>();

  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id = typeof entry["id"] === "string" ? entry["id"] : "";
    const gadget = gadgets.find((item) => item.id === id);
    if (!gadget) continue;
    const note = text(entry["note"], 160);
    const value = text(entry["value"], 24);
    const series = parseSeries(entry["series"]);
    const next: Gadget = { ...gadget };
    if (note) next.note = note;
    if (value) next.value = value;
    if (series) next.series = series;
    patched.set(id, next);
  }

  return gadgets.map((gadget) => patched.get(gadget.id) ?? gadget);
}

/** Validate a model layout against the tools this account actually exposes. */
export function parsePlan(
  raw: string,
  tools: GarminTool[],
  now = new Date(),
): DashboardPlan | null {
  const json = jsonObject(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const entries = Array.isArray(parsed["gadgets"]) ? parsed["gadgets"] : [];
  const gadgets: Gadget[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (gadgets.length >= MAX_GADGETS) break;
    if (!isRecord(entry)) continue;
    const name = typeof entry["tool"] === "string" ? entry["tool"] : "";
    const tool = byName.get(name);
    if (!tool || !isReadTool(tool.name)) continue;
    const given = isRecord(entry["args"]) ? entry["args"] : {};
    const args = fillArguments(tool, given, now);
    if (!args) continue;
    const key = `${tool.name}:${JSON.stringify(args)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const kind: GadgetKind =
      entry["kind"] === "chart" || entry["kind"] === "list" ? entry["kind"] : "stat";
    gadgets.push({
      id: uid(),
      title: text(entry["title"], 40) || titleFor(tool.name),
      tool: tool.name,
      args,
      kind,
      span: entry["span"] === "lg" || kind !== "stat" ? "lg" : "sm",
      visible: true,
    });
  }

  if (gadgets.length < 3) return null;
  return {
    headline: text(parsed["headline"], 70) || "Your training today",
    focus: text(parsed["focus"], 140),
    source: "ai",
    gadgets,
  };
}

/* --------------------------------------------------------------- fallbacks */

type Preferred = {
  tool: string;
  title: string;
  kind: GadgetKind;
  span: "sm" | "lg";
};

/** The built-in grid, in priority order, filtered to what the account offers. */
const PREFERRED: Preferred[] = [
  { tool: "get_training_readiness", title: "Readiness", kind: "stat", span: "sm" },
  { tool: "get_body_battery", title: "Body Battery", kind: "chart", span: "lg" },
  { tool: "get_sleep_summary_range", title: "Sleep", kind: "chart", span: "lg" },
  { tool: "get_hrv_trend", title: "HRV trend", kind: "chart", span: "lg" },
  { tool: "get_training_load_trend", title: "Training load", kind: "chart", span: "lg" },
  { tool: "get_daily_steps", title: "Steps", kind: "stat", span: "sm" },
  { tool: "get_stats", title: "Today", kind: "list", span: "sm" },
  { tool: "get_activities_by_date", title: "Recent activities", kind: "list", span: "sm" },
];

export function fallbackPlan(tools: GarminTool[], now = new Date()): DashboardPlan {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const gadgets: Gadget[] = [];
  const used = new Set<string>();

  const add = (tool: GarminTool, title: string, kind: GadgetKind, span: "sm" | "lg") => {
    const args = fillArguments(tool, {}, now);
    if (!args) return;
    used.add(tool.name);
    gadgets.push({ id: uid(), title, tool: tool.name, args, kind, span, visible: true });
  };

  for (const preferred of PREFERRED) {
    if (gadgets.length >= MAX_GADGETS) break;
    const tool = byName.get(preferred.tool);
    if (tool) add(tool, preferred.title, preferred.kind, preferred.span);
  }
  // Plenty of accounts (personal API keys especially) miss half the list above.
  for (const tool of tools) {
    if (gadgets.length >= 5) break;
    if (used.has(tool.name) || !isReadTool(tool.name)) continue;
    add(tool, titleFor(tool.name), "list", "sm");
  }

  return {
    headline: "Your training today",
    focus: gadgets[0] ? `Start with ${gadgets[0].title.toLowerCase()}.` : "",
    source: "fallback",
    gadgets,
  };
}

/** True when every gadget still has a connected tool behind it. */
export function planFits(plan: DashboardPlan | null, tools: GarminTool[]): plan is DashboardPlan {
  if (!plan || plan.gadgets.length === 0) return false;
  const names = new Set(tools.map((tool) => tool.name));
  return plan.gadgets.every((gadget) => names.has(gadget.tool));
}

/* ---------------------------------------------------------------- storage */

function sanitizeGadget(value: unknown): Gadget | null {
  if (!isRecord(value)) return null;
  const title = text(value["title"], 40);
  const tool = text(value["tool"], 60);
  if (!title || !tool) return null;
  const args = isRecord(value["args"]) ? value["args"] : {};
  const cleanArgs: Record<string, unknown> = {};
  for (const [key, arg] of Object.entries(args)) {
    if (isScalar(arg)) cleanArgs[key] = arg;
  }
  const kind: GadgetKind =
    value["kind"] === "chart" || value["kind"] === "list" ? value["kind"] : "stat";
  return {
    id: text(value["id"], 24) || uid(),
    title,
    tool,
    args: cleanArgs,
    kind,
    span: value["span"] === "lg" ? "lg" : "sm",
    visible: value["visible"] !== false,
  };
}

export function parseStoredPlan(raw: string | null): DashboardPlan | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const list = Array.isArray(parsed["gadgets"]) ? parsed["gadgets"] : [];
  const gadgets = list
    .map(sanitizeGadget)
    .filter((gadget): gadget is Gadget => !!gadget)
    .slice(0, MAX_GADGETS);
  if (gadgets.length === 0) return null;
  return {
    headline: text(parsed["headline"], 70) || "Your training today",
    focus: text(parsed["focus"], 140),
    source: parsed["source"] === "ai" ? "ai" : "fallback",
    gadgets,
  };
}

export function loadPlan(): DashboardPlan | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredPlan(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Only the layout is stored; notes and charts are re-read on every visit. */
export function savePlan(plan: DashboardPlan): void {
  if (typeof window === "undefined") return;
  const structural = {
    headline: plan.headline,
    focus: plan.focus,
    source: plan.source,
    gadgets: plan.gadgets.map((gadget) => ({
      id: gadget.id,
      title: gadget.title,
      tool: gadget.tool,
      args: gadget.args,
      kind: gadget.kind,
      span: gadget.span,
      visible: gadget.visible,
    })),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(structural));
  } catch {
    // Storage blocked: the plan still works for this session.
  }
}

/* --------------------------------------------------------------- readings */

export type ReadingRow = { label: string; value: string };

function readableKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Flatten a Garmin JSON result into labelled rows: the body of a "list" gadget
 * and the safety net when the model did not send a headline value or series.
 */
export function factList(text: string, limit = 8): { rows: ReadingRow[]; raw: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { rows: [], raw: text.trim().slice(0, 2400) };
  }

  const rows: ReadingRow[] = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (rows.length >= limit || depth > 4 || value == null) return;
    if (Array.isArray(value)) {
      value.slice(0, 5).forEach((item, index) => {
        visit(item, path ? `${path} ${index + 1}` : `Item ${index + 1}`, depth + 1);
      });
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        visit(child, path ? `${path} · ${readableKey(key)}` : readableKey(key), depth + 1);
        if (rows.length >= limit) break;
      }
      return;
    }
    const display = typeof value === "string" ? value.trim() : String(value);
    if (!display) return;
    rows.push({ label: path || "Reading", value: display.slice(0, 160) });
  };
  visit(parsed, "", 0);
  return { rows, raw: rows.length > 0 ? "" : JSON.stringify(parsed, null, 2).slice(0, 2400) };
}

/* ------------------------------------------------------------------- calls */

async function askModel(
  messages: { role: "system" | "user"; content: string }[],
  model: string,
): Promise<string | null> {
  try {
    const puter = await loadPuter();
    await ensureGuest(puter);
    const raw = await puter.ai.chat(messages, { model, stream: false });
    const content = responseText(raw).trim();
    return content || null;
  } catch {
    return null;
  }
}

/** Ask the model to lay out the dashboard. Null means "use the fallback". */
export async function designDashboard(
  tools: GarminTool[],
  now = new Date(),
): Promise<DashboardPlan | null> {
  if (tools.length === 0) return null;
  const raw = await askModel(designMessages(tools, now), DESIGN_MODEL);
  return raw ? parsePlan(raw, tools, now) : null;
}

/** Fill in each gadget's note, headline value and chart from its reading. */
export async function writeInsights(
  gadgets: Gadget[],
  readings: Record<string, GadgetReading>,
  now = new Date(),
): Promise<Gadget[]> {
  const filled = gadgets.filter((gadget) => {
    const reading = readings[gadget.id];
    return reading && reading.state === "loaded" && reading.text.trim().length > 0;
  });
  if (filled.length === 0) return gadgets;
  const raw = await askModel(insightMessages(filled, readings, now), DESIGN_MODEL);
  return raw ? applyInsights(raw, gadgets) : gadgets;
}
