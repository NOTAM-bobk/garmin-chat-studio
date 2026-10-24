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
 * Every tool the MissingMCP Garmin server exposes to this app.
 *
 * The catalogue is the full published surface — 154 tools at the source commit
 * the docs list (https://missingmcp.com/garmin, garmin_mcp e79df6f) — because a
 * curated read-only subset left the assistant unable to touch workouts, gear,
 * nutrition, badges, courses and the rest of the account.
 *
 * Four tools are deliberately left out: download_workout, download_course_gpx
 * and download_activity_file hand back FIT/GPX files or write them to the server,
 * and set_fit_download_dir stores a filesystem path. None of them can travel
 * through the JSON text result this app reads, so allowing them would only
 * produce confusing failures.
 *
 * Schema size is the real cost of the full surface: the model receives all of
 * these each turn, which is why nothing here is added speculatively.
 */
export const GARMIN_TOOL_ALLOWLIST = [
  // Activities
  "get_activities_by_date",
  "get_activities_fordate",
  "get_activities",
  "count_activities",
  "get_activity",
  "get_activity_types",
  "get_activity_splits",
  "get_activity_typed_splits",
  "get_activity_split_summaries",
  "get_activity_weather",
  "get_activity_hr_in_timezones",
  "get_activity_power_in_timezones",
  "get_activity_gear",
  "get_activity_exercise_sets",
  "get_activity_fit_messages",
  "get_activity_fit_data",
  "get_power_duration_curve",
  "create_manual_activity",
  "set_activity_name",
  "set_activity_type",
  "set_activity_description",
  "set_activity_event_type",
  "set_perceived_effort",
  "set_activity_feel",
  "set_activity_exercise_sets",
  // Health & wellness
  "get_stats",
  "get_stats_range",
  "get_stats_and_body",
  "get_user_summary",
  "get_energy_balance",
  "get_daily_steps",
  "get_steps_data",
  "get_weekly_steps",
  "get_floors",
  "get_rhr_day",
  "get_heart_rates",
  "get_heart_rates_summary",
  "get_heart_rate_zones",
  "get_spo2_data",
  "get_blood_pressure",
  "get_respiration_data",
  "get_respiration_summary",
  "get_body_composition",
  "get_body_battery",
  "get_body_battery_events",
  "get_training_readiness",
  "get_morning_training_readiness",
  "get_recovery_time_remaining",
  "get_sleep_data",
  "get_sleep_summary",
  "get_sleep_summary_range",
  "get_stress_data",
  "get_stress_summary",
  "get_all_day_stress",
  "get_all_day_events",
  "get_weekly_stress",
  "get_weekly_intensity_minutes",
  "get_hydration_data",
  "get_lifestyle_logging_data",
  // Profile & settings
  "get_full_name",
  "get_unit_system",
  "get_user_profile",
  "get_userprofile_settings",
  "set_heart_rate_zones",
  // Devices
  "get_devices",
  "get_device_last_used",
  "get_device_settings",
  "get_primary_training_device",
  "get_device_solar_data",
  "get_device_alarms",
  // Gear
  "get_gear",
  "add_gear_to_activity",
  "remove_gear_from_activity",
  // Weight & body composition
  "get_weigh_ins",
  "get_daily_weigh_ins",
  "add_weigh_in",
  "add_weigh_in_with_timestamps",
  "delete_weigh_ins",
  // Challenges & badges
  "get_goals",
  "get_personal_record",
  "get_earned_badges",
  "get_adhoc_challenges",
  "get_available_badge_challenges",
  "get_badge_challenges",
  "get_non_completed_badge_challenges",
  "get_inprogress_virtual_challenges",
  "get_race_predictions",
  // Training & performance
  "get_training_status",
  "get_training_load_trend",
  "get_training_load_balance",
  "get_vo2max_trend",
  "get_hrv_data",
  "get_hrv_trend",
  "get_respiration_trend",
  "get_endurance_score",
  "get_hill_score",
  "get_fitnessage_data",
  "get_cycling_ftp",
  "get_lactate_threshold",
  "get_training_effect",
  "get_progress_summary_between_dates",
  "get_running_tolerance",
  "get_running_tolerance_trend",
  "get_acclimation",
  "request_reload",
  // Workouts
  "get_workouts",
  "get_workout_by_id",
  "upload_workout",
  "upload_workouts",
  "delete_workout",
  "delete_workouts",
  "get_scheduled_workouts",
  "get_garmin_coach_workouts",
  "get_training_plan_workouts",
  "schedule_workout",
  "schedule_workouts",
  "unschedule_workout",
  "unschedule_workouts",
  // Workout builders
  "create_run_workout",
  "create_run_interval_workout",
  "create_walk_run_workout",
  "create_z2_walk_workout",
  "create_strength_workout",
  "schedule_week",
  // Courses
  "get_courses",
  "get_course_details",
  "upload_course",
  "delete_course",
  // Nutrition
  "get_nutrition_daily_food_log",
  "get_nutrition_summary_between_dates",
  "get_nutrition_daily_meals",
  "get_nutrition_daily_settings",
  "set_nutrition_daily_settings",
  "search_foods",
  "get_custom_foods",
  "get_custom_food_serving_units",
  "create_custom_food",
  "update_custom_food",
  "delete_custom_food",
  "log_custom_food",
  "log_food",
  "delete_food_log",
  "upsert_and_log",
  // Data management
  "add_body_composition",
  "set_blood_pressure",
  "add_hydration_data",
  // Women's health
  "get_pregnancy_summary",
  "get_menstrual_data_for_date",
  "get_menstrual_calendar_data",
  // Calendar events
  "get_calendar_events",
] as const;

const ALLOWED_TOOLS = new Set<string>(GARMIN_TOOL_ALLOWLIST);

/**
 * The schemas sent on every chat turn.
 *
 * Providers cap a request at roughly 128 function schemas and this catalogue is
 * 150, so the readings a training question almost always needs travel every
 * turn while the long tail (gear, badges, courses, nutrition, devices, weight,
 * body battery events, lactate threshold…) is pulled in on demand through the
 * `find_garmin_tools` discovery tool. Accounts with fewer than 60 tools — every
 * personal-key account — send their whole set instead.
 */
export const CORE_TOOL_NAMES = new Set<string>([
  // Profile & daily snapshot
  "get_full_name",
  "get_unit_system",
  "get_user_profile",
  "get_heart_rate_zones",
  "get_stats",
  "get_daily_steps",
  "get_sleep_summary",
  "get_sleep_summary_range",
  "get_training_readiness",
  "get_body_battery",
  // Trends & fitness
  "get_hrv_trend",
  "get_hrv_data",
  "get_training_status",
  "get_training_load_trend",
  "get_training_load_balance",
  "get_vo2max_trend",
  "get_endurance_score",
  "get_race_predictions",
  // Health detail
  "get_stress_summary",
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
  // Workout writes the assistant can already handle well
  "create_run_workout",
  "create_run_interval_workout",
  "create_z2_walk_workout",
  "schedule_workout",
]);

/** How many tools a provider accepts before schemas start getting dropped. */
export const TOOL_CAP = 128;

/** The subset of a connected account's tools sent to the model up front. */
export function coreTools(tools: GarminTool[]): GarminTool[] {
  if (tools.length <= 60) return tools;
  const core = tools.filter((tool) => CORE_TOOL_NAMES.has(tool.name));
  // A gateway that renamed everything must not leave the model with no tools.
  return core.length > 0 ? core.slice(0, TOOL_CAP) : tools.slice(0, 60);
}

/**
 * Read tools are allowed by shape, not only by name.
 *
 * Per-session detail ships under `get_activity*`, and the gateway's exact
 * suffixes change between releases, so the prefix stays open. Everything else
 * has to be listed above.
 */
export function isAllowedTool(name: string): boolean {
  return ALLOWED_TOOLS.has(name) || /^get_activity[a-z_]*$/.test(name);
}

/**
 * Tools that change data. Used to keep write tools out of dashboard gadgets and
 * to label the trace correctly ("Deleting a workout", not "Reading delete…").
 */
export const WRITE_TOOLS = new Set<string>([
  "create_manual_activity",
  "set_activity_name",
  "set_activity_type",
  "set_activity_description",
  "set_activity_event_type",
  "set_perceived_effort",
  "set_activity_feel",
  "set_activity_exercise_sets",
  "set_heart_rate_zones",
  "set_nutrition_daily_settings",
  "set_blood_pressure",
  "add_gear_to_activity",
  "remove_gear_from_activity",
  "add_weigh_in",
  "add_weigh_in_with_timestamps",
  "delete_weigh_ins",
  "add_body_composition",
  "add_hydration_data",
  "request_reload",
  "upload_workout",
  "upload_workouts",
  "upload_course",
  "delete_workout",
  "delete_workouts",
  "delete_course",
  "delete_custom_food",
  "delete_food_log",
  "schedule_workout",
  "schedule_workouts",
  "schedule_week",
  "unschedule_workout",
  "unschedule_workouts",
  "create_run_workout",
  "create_run_interval_workout",
  "create_walk_run_workout",
  "create_z2_walk_workout",
  "create_strength_workout",
  "create_custom_food",
  "update_custom_food",
  "log_custom_food",
  "log_food",
  "upsert_and_log",
]);

/**
 * Tools whose job is to destroy or overwrite something that already exists. The
 * assistant is told to confirm these before running them.
 */
export const DESTRUCTIVE_TOOLS = new Set<string>([
  "delete_workout",
  "delete_workouts",
  "delete_course",
  "delete_custom_food",
  "delete_food_log",
  "delete_weigh_ins",
  "unschedule_workout",
  "unschedule_workouts",
  "set_activity_exercise_sets",
  "set_heart_rate_zones",
  "set_activity_name",
  "set_activity_type",
  "set_activity_description",
  "set_activity_event_type",
  "set_perceived_effort",
  "set_activity_feel",
  "remove_gear_from_activity",
  "update_custom_food",
  "set_nutrition_daily_settings",
  "set_blood_pressure",
]);

/** True for a reading that can back a dashboard gadget. */
export function isReadTool(name: string): boolean {
  return name.startsWith("get_") && !WRITE_TOOLS.has(name);
}

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

/** Verb-by-verb label for tools that have no hand-written one. */
const LABEL_VERBS: [RegExp, string][] = [
  [/^get_/, "Reading"],
  [/^count_/, "Counting"],
  [/^search_/, "Searching"],
  [/^create_/, "Creating"],
  [/^add_/, "Adding"],
  [/^set_/, "Updating"],
  [/^update_/, "Updating"],
  [/^upsert_/, "Saving"],
  [/^upload_/, "Uploading"],
  [/^schedule_/, "Scheduling"],
  [/^unschedule_/, "Unscheduling"],
  [/^delete_/, "Deleting"],
  [/^remove_/, "Removing"],
  [/^log_/, "Logging"],
  [/^request_/, "Requesting"],
  [/^download_/, "Downloading"],
];

export function toolLabel(name: string): string {
  const written = LABELS[name];
  if (written) return written;
  for (const [pattern, verb] of LABEL_VERBS) {
    if (pattern.test(name)) {
      const rest = name.replace(pattern, "").replace(/_/g, " ").trim();
      if (rest) return `${verb} ${rest}`;
    }
  }
  return name.replace(/_/g, " ");
}

/** Human-friendly headline + sub-label for the live activity trace. */
export function describeTool(name: string, args: Record<string, unknown> = {}) {
  const label = toolLabel(name);
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
