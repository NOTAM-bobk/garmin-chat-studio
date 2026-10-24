/**
 * Shared Garmin/MCP types and the curated tool surface.
 *
 * The browser only ever talks to our own /api/garmin/* routes; the MissingMCP
 * bearer token stays in an httpOnly cookie and never reaches client JS.
 */

export type JsonSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type GarminTool = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

/** OpenAI-compatible function definition, ready for puter.ai.chat({ tools }). */
export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

export type GarminStatus = {
  connected: boolean;
  /** False when SESSION_SECRET is missing in production. */
  configured: boolean;
  /** Number of Garmin tools exposed to the assistant. */
  tools: number;
  /** Total tools the connected Garmin account exposes, when known. */
  available: number;
  /** How the account is connected: the MCP gateway or a personal API key. */
  mode?: "mcp" | "personal";
};

export type ToolResult = {
  ok: boolean;
  text: string;
  isError: boolean;
};

/**
 * A deliberately read-first subset of the 150+ Garmin tools. Sending every
 * schema would flood the model's context and invite accidental writes, so the
 * server only forwards tools that appear here.
 */
export const GARMIN_TOOL_ALLOWLIST = [
  // Profile & baseline
  "get_full_name",
  "get_unit_system",
  "get_user_profile",
  "get_heart_rate_zones",
  // Daily snapshot
  "get_stats",
  "get_daily_steps",
  "get_sleep_summary",
  "get_sleep_summary_range",
  "get_training_readiness",
  "get_body_battery",
  // Trends & fitness
  "get_hrv_trend",
  "get_training_status",
  "get_training_load_trend",
  "get_training_load_balance",
  "get_vo2max_trend",
  "get_endurance_score",
  "get_race_predictions",
  "get_stress_summary",
  // Health detail
  "get_hrv_data",
  "get_respiration_summary",
  "get_spo2_data",
  "get_rhr_day",
  "get_body_composition",
  "get_weigh_ins",
  // Activities
  "get_activities_by_date",
  "get_activity",
  "get_activity_splits",
  "get_activity_weather",
  "get_gear",
  // Training plan
  "get_workouts",
  "get_scheduled_workouts",
  "get_calendar_events",
  "get_personal_record",
  "get_devices",
  // Write tools the assistant is allowed to use (uploading/scheduling plans)
  "create_run_workout",
  "create_run_interval_workout",
  "create_z2_walk_workout",
  "schedule_workout",
] as const;

/**
 * Read tools are allowed by shape, not only by name.
 *
 * Per-session detail (splits, streams, charts, weather, gear) ships under
 * `get_activity*`, and the gateway's exact suffixes change between releases.
 * Matching the prefix keeps every read-only activity tool reachable without
 * hard-coding names that may not exist yet. Writes still go through the list.
 */
export function isAllowedTool(name: string): boolean {
  return (
    GARMIN_TOOL_ALLOWLIST.includes(name as (typeof GARMIN_TOOL_ALLOWLIST)[number]) ||
    /^get_activity[a-z_]*$/.test(name)
  );
}

export const WRITE_TOOLS = new Set<string>([
  "create_run_workout",
  "create_run_interval_workout",
  "create_z2_walk_workout",
  "schedule_workout",
]);

const LABELS: Record<string, string> = {
  get_full_name: "Checking your profile",
  get_unit_system: "Checking your units",
  get_user_profile: "Checking your profile",
  get_heart_rate_zones: "Reading heart-rate zones",
  get_stats: "Reading today's stats",
  get_daily_steps: "Reading step counts",
  get_sleep_summary: "Reading sleep",
  get_sleep_summary_range: "Reading sleep history",
  get_training_readiness: "Reading training readiness",
  get_body_battery: "Reading Body Battery",
  get_hrv_trend: "Reading HRV trend",
  get_training_status: "Reading training status",
  get_training_load_trend: "Reading training load",
  get_training_load_balance: "Reading load focus",
  get_vo2max_trend: "Reading VO2 max trend",
  get_endurance_score: "Reading endurance score",
  get_race_predictions: "Reading race predictions",
  get_stress_summary: "Reading stress",
  get_hrv_data: "Reading HRV",
  get_respiration_summary: "Reading respiration",
  get_spo2_data: "Reading SpO2",
  get_rhr_day: "Reading resting heart rate",
  get_body_composition: "Reading body composition",
  get_hydration: "Reading hydration",
  get_fitness_age: "Reading fitness age",
  get_weight_goal: "Reading your weight goal",
  get_nutrition_logs: "Reading food logs",
  get_menstrual_cycle_summary: "Reading cycle summary",
  get_menstrual_cycle_day: "Reading cycle day",
  get_wellness_activity_summaries: "Reading daily movement",
  get_weigh_ins: "Reading weigh-ins",
  get_activities_by_date: "Reading activities",
  get_activity: "Reading an activity",
  get_activity_details: "Reading activity detail",
  get_activity_detail: "Reading activity detail",
  get_activity_splits: "Reading activity splits",
  get_activity_split_summaries: "Reading split summaries",
  get_activity_hr_zones: "Reading activity heart-rate zones",
  get_activity_power: "Reading activity power",
  get_activity_streams: "Reading activity streams",
  get_activity_weather: "Reading activity weather",
  get_gear: "Reading your gear",
  get_workouts: "Reading workouts",
  get_scheduled_workouts: "Reading your plan",
  get_calendar_events: "Reading your calendar",
  get_personal_record: "Reading personal records",
  get_devices: "Reading your devices",
  create_run_workout: "Building a run workout",
  create_run_interval_workout: "Building an interval workout",
  create_z2_walk_workout: "Building a Zone 2 walk",
  schedule_workout: "Scheduling a workout",
};

const DATE_KEYS = [
  "cstart",
  "start",
  "start_date",
  "startDate",
  "date",
  "calendarDate",
  "end",
  "end_date",
  "endDate",
];

function shortDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const label = months[Number(month) - 1];
  if (!label) return null;
  return `${label} ${Number(day)}${year === String(new Date().getFullYear()) ? "" : ` ${year}`}`;
}

/** Human-friendly headline + sub-label for the live activity trace. */
export function describeTool(name: string, args: Record<string, unknown> = {}) {
  const label = LABELS[name] ?? name.replace(/^get_/, "Reading ").replace(/_/g, " ");
  const dates = DATE_KEYS.map((key) => shortDate(args[key])).filter((d): d is string => !!d);
  const unique = [...new Set(dates)];
  const detailParts: string[] = [];
  if (unique.length >= 2) detailParts.push(`${unique[0]} → ${unique[unique.length - 1]}`);
  else if (unique.length === 1) detailParts.push(unique[0]!);

  const activityId = args["activity_id"] ?? args["activityId"];
  if (typeof activityId === "string" || typeof activityId === "number") {
    detailParts.push(`activity ${String(activityId).slice(-6)}`);
  }
  const title = args["name"] ?? args["workout_name"];
  if (typeof title === "string" && title.trim()) detailParts.push(title.trim().slice(0, 40));

  return { label, detail: detailParts.join(" · ") };
}

export function toolSpecs(tools: GarminTool[]): ToolSpec[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

/** Rough byte size of a tool result, for the trace badge. */
export function formatBytes(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
