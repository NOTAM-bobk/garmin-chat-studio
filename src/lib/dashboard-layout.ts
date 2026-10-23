export type WidgetId =
  | "readiness"
  | "battery"
  | "sleep"
  | "hrv"
  | "load"
  | "steps"
  | "zones"
  | "week";

export type WidgetSize = "sm" | "lg";
export type WidgetSlot = { id: WidgetId; visible: boolean; size: WidgetSize };

export const DEFAULT_LAYOUT: WidgetSlot[] = [
  { id: "readiness", visible: true, size: "sm" },
  { id: "battery", visible: true, size: "lg" },
  { id: "steps", visible: true, size: "sm" },
  { id: "sleep", visible: true, size: "lg" },
  { id: "hrv", visible: true, size: "lg" },
  { id: "zones", visible: true, size: "sm" },
  { id: "load", visible: true, size: "lg" },
  { id: "week", visible: true, size: "sm" },
];

export function moveWidget(layout: WidgetSlot[], id: WidgetId, dir: -1 | 1): WidgetSlot[] {
  const i = layout.findIndex((w) => w.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layout.length) return layout;
  const next = [...layout];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function updateWidget(
  layout: WidgetSlot[],
  id: WidgetId,
  patch: Partial<Omit<WidgetSlot, "id">>,
): WidgetSlot[] {
  return layout.map((w) => (w.id === id ? { ...w, ...patch } : w));
}

/** Parse a saved layout, keeping known widgets and appending any new ones. */
export function parseLayout(raw: string | null): WidgetSlot[] {
  if (!raw) return DEFAULT_LAYOUT;
  try {
    const saved = JSON.parse(raw) as WidgetSlot[];
    const known = new Set(DEFAULT_LAYOUT.map((w) => w.id));
    const kept = saved.filter((w) => known.has(w.id));
    const missing = DEFAULT_LAYOUT.filter((d) => !kept.some((w) => w.id === d.id));
    return [...kept, ...missing];
  } catch {
    return DEFAULT_LAYOUT;
  }
}
