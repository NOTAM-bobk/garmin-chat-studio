/**
 * Garmin Personal API connection.
 *
 * A personal key from the Garmin Connect developer program is exchanged for a
 * short-lived, read-only bearer token. Both the key and the token stay sealed in
 * an httpOnly cookie, so the browser never sees either after the paste.
 *
 * Docs: https://developer.garmin.com/gc-developer-program/personal/personal-api
 * Endpoints: https://github.com/garmin/connect-personal-api-python
 */
import {
  bakeCookie,
  clearCookie,
  cookieDomain,
  isConfigured,
  readCookie,
  requestOrigin,
  seal,
  SESSION_COOKIE,
  unseal,
} from "./garmin.server";
import type { GarminStatus, GarminTool, JsonSchema, ToolResult } from "@/lib/garmin";

export const PERSONAL_COOKIE = "gcs_garmin_personal";

const BASE = "https://personal.connectapi.garmin.com";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";
/** Garmin issues keys for up to a year; the sealed cookie sits just under that. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const TEXT_LIMIT = 24_000;
const DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type PersonalSession = {
  /** The key the user pasted; needed to mint a fresh token when one expires. */
  key: string;
  token: string;
  expiresAt: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

function shift(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / DAY,
  );
}

/** One day, defaulting to today when the model omits or mangles the date. */
function day(args: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readDate(args[key]);
    if (value) return value;
  }
  return today();
}

/**
 * A start/end window, clamped to what the endpoint accepts. Garmin answers a
 * long range with an unhelpful 400, so trimming beats failing the turn.
 */
function window(
  args: Record<string, unknown>,
  maxDays: number,
): { start: string; end: string; trimmed: boolean } {
  const end = day(args, ["end_date", "endDate", "date", "end"]);
  const asked =
    readDate(args["start_date"]) ??
    readDate(args["startDate"]) ??
    readDate(args["start"]) ??
    readDate(args["cstart"]);
  const first = asked ?? shift(end, 1 - maxDays);
  const [from, to] = first <= end ? [first, end] : [end, first];
  // `trimmed` is only true when something was actually cut, so the model is not
  // told a clean range was shortened.
  if (daysBetween(from, to) + 1 <= maxDays) return { start: from, end: to, trimmed: false };
  return { start: shift(to, 1 - maxDays), end: to, trimmed: true };
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

type Built = { path: string; trimmed?: boolean };
type Spec = GarminTool & { build: (args: Record<string, unknown>) => Built };

const DATE_FIELD: JsonSchema = { type: "string", description: "A date as YYYY-MM-DD." };
const RANGE_FIELDS: JsonSchema = {
  type: "object",
  properties: {
    start_date: { type: "string", description: "First date, YYYY-MM-DD." },
    end_date: { type: "string", description: "Last date, YYYY-MM-DD. Defaults to today." },
  },
};

const SPECS: Spec[] = [
  {
    name: "get_user_profile",
    description: "The Garmin account profile and unit settings (name, language, units).",
    parameters: { type: "object", properties: {} },
    build: () => ({ path: "/userprofile-service/userprofile/settings" }),
  },
  {
    name: "get_stats",
    description:
      "Daily wellbeing summaries: steps, calories, resting heart rate, stress, body battery, sleep score and intensity minutes. Up to 28 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 28);
      return {
        path: `/usersummary-service/v2/dailysummaries${query({ startDate: start, endDate: end })}`,
        trimmed,
      };
    },
  },
  {
    name: "get_daily_steps",
    description: "Step counts per day. Up to 7 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 7);
      return { path: `/usersummary-service/stats/steps/daily/${start}/${end}`, trimmed };
    },
  },
  {
    name: "get_stress_summary",
    description: "Daily stress levels and rest minutes. Up to 7 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 7);
      return { path: `/usersummary-service/stats/stress/daily/${start}/${end}`, trimmed };
    },
  },
  {
    name: "get_sleep_summary",
    description: "One night of sleep with stages, sleep score and overnight metrics.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({
      path: `/sleep-service/sleep/dailySleep${query({ date: day(args, ["date", "calendarDate"]) })}`,
    }),
  },
  {
    name: "get_sleep_summary_range",
    description: "Nightly sleep summaries between two dates. Up to 28 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 28);
      return {
        path: `/sleep-service/sleep/dailySleepSummariesByDate${query({
          startDate: start,
          endDate: end,
        })}`,
        trimmed,
      };
    },
  },
  {
    name: "get_hrv_data",
    description: "Overnight HRV readings for one night, including the weekly average.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({ path: `/hrv-service/hrv/${day(args, ["date", "calendarDate"])}` }),
  },
  {
    name: "get_hrv_trend",
    description: "Nightly HRV status between two dates. Up to 180 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 180);
      return { path: `/hrv-service/hrv/daily/${start}/${end}`, trimmed };
    },
  },
  {
    name: "get_body_battery",
    description: "Body Battery charged and drained values per day. Up to 28 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 28);
      return {
        path: `/wellness-service/wellness/bodyBattery/reports/daily${query({
          startDate: start,
          endDate: end,
        })}`,
        trimmed,
      };
    },
  },
  {
    name: "get_daily_heart_rate",
    description: "Resting heart rate plus the full day's heart-rate range for one date.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({
      path: `/wellness-service/wellness/dailyHeartRate${query({
        date: day(args, ["date", "calendarDate"]),
      })}`,
    }),
  },
  {
    name: "get_heart_rate_zones",
    description: "The athlete's configured heart-rate zones.",
    parameters: { type: "object", properties: {} },
    build: () => ({ path: "/biometric-service/heartRateZones/v2" }),
  },
  {
    name: "get_spo2_data",
    description: "Pulse-ox acclimation readings for one date.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({
      path: `/wellness-service/wellness/daily/spo2acclimation/${day(args, ["date", "calendarDate"])}`,
    }),
  },
  {
    name: "get_hydration",
    description:
      "Daily hydration: goal, intake and sweat loss in millilitres. Up to 28 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 28);
      return { path: `/usersummary-service/stats/hydration/daily/${start}/${end}`, trimmed };
    },
  },
  {
    name: "get_fitness_age",
    description:
      "Garmin's fitness age for one date, with the VO2 max and activity inputs behind it.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({
      path: `/fitnessage-service/fitnessage/v2/${day(args, ["date", "calendarDate"])}`,
    }),
  },
  {
    name: "get_weight_goal",
    description: "The active weight goal and its progress. Up to 90 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 90);
      return { path: `/goal-service/goal/user/effective/weightgoal/${start}/${end}`, trimmed };
    },
  },
  {
    name: "get_nutrition_logs",
    description:
      "Logged food for one day: meals, calories, macros and micronutrients, as recorded in Garmin Connect.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({
      path: `/nutrition-service/food/logs/${day(args, ["date", "calendarDate"])}`,
    }),
  },
  {
    name: "get_menstrual_cycle_summary",
    description:
      "Hormonal cycle summary for one date: current phase, cycle length and predictions. Empty when the user doesn't track it.",
    parameters: { type: "object", properties: { date: DATE_FIELD } },
    build: (args) => ({
      path: `/periodichealth-service/menstrualcycle/summary/${day(args, ["date", "calendarDate"])}`,
    }),
  },
  {
    name: "get_menstrual_cycle_day",
    description:
      "The per-day hormonal cycle view: symptoms, bleeding, mood and cycle day for one date.",
    parameters: {
      type: "object",
      properties: {
        date: DATE_FIELD,
        today_date: {
          type: "string",
          description: "The reference 'today', YYYY-MM-DD. Defaults to the same date.",
        },
      },
    },
    build: (args) => {
      const date = day(args, ["date", "calendarDate"]);
      const todayDate = readDate(args["today_date"]) ?? date;
      return {
        path: `/periodichealth-service/menstrualcycle/dayview/${date}${query({ todayDate })}`,
      };
    },
  },
  {
    name: "get_wellness_activity_summaries",
    description:
      "Everyday movement outside workouts: steps, floors, intensity minutes and active calories per day, plus the activity types Garmin detected. Up to 28 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end, trimmed } = window(args, 28);
      return { path: `/wellnessactivity-service/activity/summary/range/${start}/${end}`, trimmed };
    },
  },
  {
    name: "get_body_composition",
    description: "Weigh-ins with weight, body fat and muscle mass. Up to 90 days per call.",
    parameters: RANGE_FIELDS,
    build: (args) => {
      const { start, end } = window(args, 90);
      return { path: `/weight-service/weight/range/${start}/${end}?includeAll=true` };
    },
  },
  {
    name: "get_activities_by_date",
    description:
      "Recorded activities between two dates, newest first: sport, distance, duration, pace, heart rate, power, training effect. Up to 50 per call.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "First date, YYYY-MM-DD." },
        end_date: { type: "string", description: "Last date, YYYY-MM-DD. Defaults to today." },
        limit: { type: "number", description: "How many activities to return, 1-50. Default 20." },
        activity_type: {
          type: "string",
          description: "Optional sport filter, for example running.",
        },
      },
    },
    build: (args) => {
      const { start, end, trimmed } = window(args, 90);
      const rawLimit = typeof args["limit"] === "number" ? args["limit"] : Number(args["limit"]);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(50, Math.max(1, Math.round(rawLimit)))
        : 20;
      const type = typeof args["activity_type"] === "string" ? args["activity_type"].trim() : "";
      return {
        path: `/activitylist-service/activities/search/activities${query({
          start: 0,
          limit,
          startDate: start,
          endDate: end,
          activityType: type || undefined,
        })}`,
        trimmed,
      };
    },
  },
  {
    name: "get_activity",
    description:
      "One activity in full: totals, laps, heart rate, power, cadence, elevation and training effect. Pass the activity id from the activity list.",
    parameters: {
      type: "object",
      properties: { activity_id: { type: "string", description: "The Garmin activity id." } },
      required: ["activity_id"],
    },
    build: (args) => {
      const id = String(args["activity_id"] ?? args["activityId"] ?? "").trim();
      if (!/^\d+$/.test(id)) throw new Error("An activity id is required, for example 123456789.");
      return { path: `/activity-service/activity/${id}` };
    },
  },
  {
    name: "get_activity_workouts",
    description: "The structured workout or intervals attached to one activity.",
    parameters: {
      type: "object",
      properties: { activity_id: { type: "string", description: "The Garmin activity id." } },
      required: ["activity_id"],
    },
    build: (args) => {
      const id = String(args["activity_id"] ?? args["activityId"] ?? "").trim();
      if (!/^\d+$/.test(id)) throw new Error("An activity id is required, for example 123456789.");
      return { path: `/activity-service/activity/${id}/workouts` };
    },
  },
];

/** The read-only toolset a personal key can offer. */
export const PERSONAL_TOOLS: GarminTool[] = SPECS.map(({ build: _build, ...tool }) => tool);

/** Resolve a tool call to a Garmin path. Exported for tests. */
export function personalPath(
  name: string,
  args: Record<string, unknown> = {},
): { path: string; trimmed: boolean } | null {
  const spec = SPECS.find((entry) => entry.name === name);
  if (!spec) return null;
  const built = spec.build(args);
  return { path: built.path, trimmed: built.trimmed === true };
}

async function exchange(key: string): Promise<PersonalSession> {
  const response = await fetch(`${BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { authorization: `ApiKey ${key}`, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (!response.ok || typeof payload.access_token !== "string") {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Garmin rejected that key. Create a new one under Garmin Connect → Settings → Personal API Key and paste it exactly.",
      );
    }
    throw new Error(`Garmin's token endpoint answered ${response.status}. Try again in a moment.`);
  }
  const lifetime =
    typeof payload.expires_in === "number" && payload.expires_in > 60 ? payload.expires_in : 3300;
  return { key, token: payload.access_token, expiresAt: Date.now() + lifetime * 1000 };
}

/** Validate a pasted key and turn it into a sealed cookie. */
export async function connectPersonalKey(
  request: Request,
  key: string,
): Promise<{ session: PersonalSession; cookie: string }> {
  const cleaned = key.trim();
  if (!cleaned) throw new Error("Paste the key you copied from Garmin Connect.");
  if (!isConfigured()) {
    throw new Error("This deployment is missing SESSION_SECRET, so keys cannot be stored.");
  }
  const session = await exchange(cleaned);
  const domain = cookieDomain(request);
  const cookie = bakeCookie(PERSONAL_COOKIE, await seal(session), {
    maxAge: COOKIE_MAX_AGE,
    secure: requestOrigin(request).startsWith("https://"),
    ...(domain ? { domain } : {}),
  });
  return { session, cookie };
}

export async function readPersonalSession(request: Request): Promise<PersonalSession | null> {
  const payload = await unseal<PersonalSession>(readCookie(request, PERSONAL_COOKIE));
  if (!payload?.key || !payload?.token) return null;
  return payload;
}

export function personalStatus(): GarminStatus {
  return {
    connected: true,
    configured: isConfigured(),
    tools: PERSONAL_TOOLS.length,
    available: PERSONAL_TOOLS.length,
    mode: "personal",
  };
}

/** Cookies that clear both connection styles at once. */
export function disconnectCookies(request: Request): string[] {
  return [
    clearCookie(SESSION_COOKIE, cookieDomain(request)),
    clearCookie(PERSONAL_COOKIE, cookieDomain(request)),
  ];
}

function truncate(text: string): string {
  return text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}\n\n…[truncated]` : text;
}

/**
 * Run one read against the personal API. The returned session carries a fresh
 * token when the old one had expired, so the caller can re-bake the cookie.
 */
export async function callPersonalTool(
  session: PersonalSession,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: ToolResult; session: PersonalSession }> {
  const target = personalPath(name, args);
  if (!target) {
    throw new Error(`Tool "${name}" is not available with a personal API key.`);
  }

  let current = session;
  if (current.expiresAt - Date.now() < 60_000) current = await exchange(current.key);

  const send = async (token: string) =>
    fetch(`${BASE}${target.path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });

  let response = await send(current.token);
  if (response.status === 401) {
    // Tokens are revoked or rolled early now and then; one refresh fixes it.
    current = await exchange(current.key);
    response = await send(current.token);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("Garmin rejected the stored key (401). Create a new key and reconnect.");
    }
    throw new Error(
      `Garmin answered ${response.status} for ${name}${text ? `: ${text.slice(0, 160)}` : ""}`,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (body === null) {
    return {
      result: { ok: true, isError: false, text: "Garmin returned no data for that range." },
      session: current,
    };
  }

  const note = target.trimmed
    ? "The date range was trimmed to what this endpoint accepts.\n\n"
    : "";
  return {
    result: { ok: true, isError: false, text: note + truncate(JSON.stringify(body)) },
    session: current,
  };
}
