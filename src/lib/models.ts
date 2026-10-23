/**
 * Model catalogue and tone presets.
 *
 * Chat models come from Puter's live catalogue (`puter.ai.listModels()`), with a
 * small curated set shown first. Tones are prompt fragments, not saved state on
 * the server — they only shape how the assistant writes.
 */

export type ModelOption = {
  id: string;
  label: string;
  note?: string;
};

export type LiveModel = {
  id: string;
  name?: string;
  provider?: string;
};

/** Documented defaults, shown before (and alongside) the live catalogue. */
export const CURATED_MODELS: ModelOption[] = [
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "fastest" },
  { id: "gpt-5.6", label: "GPT-5.6", note: "balanced" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "careful" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", note: "deep" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", note: "quick" },
  { id: "gemini-4-argon", label: "Gemini 4 Argon", note: "long context" },
];

const MAX_LIVE_MODELS = 60;

/**
 * Merge the live catalogue behind the curated picks, dropping provider tier
 * variants (`:free`, `:priority`, …) so the picker stays readable.
 */
export function mergeModels(
  live: LiveModel[],
  base: ModelOption[] = CURATED_MODELS,
): ModelOption[] {
  const seen = new Set(base.map((model) => model.id));
  const extra: ModelOption[] = [];

  for (const model of live) {
    const id = model.id.trim();
    if (!id || seen.has(id) || id.includes(":")) continue;
    seen.add(id);
    extra.push({
      id,
      label: model.name?.trim() || id,
      ...(model.provider ? { note: model.provider } : {}),
    });
    if (extra.length >= MAX_LIVE_MODELS) break;
  }

  extra.sort((a, b) => a.label.localeCompare(b.label));
  return [...base, ...extra];
}

/** Built-in tones plus the user's own (`custom:<id>`), so this stays open. */
export type ToneId = string;

export type BuiltInToneId = "coach" | "analyst" | "explain" | "straight";

export type Tone = {
  id: ToneId;
  label: string;
  /** Instructions injected into the system prompt. */
  prompt: string;
};

export const TONES: Tone[] = [
  {
    id: "coach",
    label: "Coach",
    prompt:
      "Tone: a sharp endurance coach. Warm, direct, zero filler. Answer the question in the shape it needs — a fast verdict for a check-in, the full plan for a plan — and give a single next action only when the user is deciding what to do.",
  },
  {
    id: "analyst",
    label: "Analyst",
    prompt:
      "Tone: a data analyst. Lead with numbers, deltas and dates. Short lists or tables over prose. No motivational language.",
  },
  {
    id: "explain",
    label: "Explain",
    prompt:
      "Tone: a patient teacher. Define any metric you mention, explain the mechanism in one sentence, then the action. Assume the reader is new to training data.",
  },
  {
    id: "straight",
    label: "Straight talk",
    prompt:
      "Tone: blunt and unsentimental. No praise, no hedging, no disclaimers beyond safety. Say what is off and exactly what to do about it.",
  },
];

/**
 * Vision heuristic for the model picker.
 *
 * Puter exposes hundreds of ids, so instead of a brittle allow-list we read the
 * family from the id: multimodal families pass, audio/code/image generators and
 * the deliberately tiny tiers do not.
 */
const VISION_FAMILY =
  /(gpt-5|gpt-4o|gpt-4\.1|o4|claude|gemini|vision|llava|pixtral|qwen.*vl|glm.*v|internvl|muse-spark)/i;
const NON_VISION_TIER =
  /(^|[-_/])(nano|mini|flash-lite|codex|dall-e|imagen|tts|whisper|embed|rerank|sora|coder)([-_/.]|$)/i;

/** Curated ids to try first when an image needs a model that can read it. */
const VISION_PREFERENCE = ["gpt-5.6", "claude-sonnet-5", "gemini-4-argon", "claude-opus-4-8"];

export function isVisionModel(id: string): boolean {
  const name = id.toLowerCase();
  if (!name.trim() || NON_VISION_TIER.test(name)) return false;
  return VISION_FAMILY.test(name);
}

/**
 * The model to use when the user attaches an image: keep the current pick when
 * it can see images, otherwise move to the best vision model on offer.
 */
export function pickVisionModel(current: string, options: ModelOption[]): string {
  if (isVisionModel(current)) return current;
  for (const id of VISION_PREFERENCE) {
    if (options.some((option) => option.id === id) && isVisionModel(id)) return id;
  }
  const fallback = options.find((option) => isVisionModel(option.id));
  return fallback?.id ?? current;
}

export const DEFAULT_TONE: ToneId = "coach";

export function toneById(id: string): Tone {
  return TONES.find((tone) => tone.id === id) ?? TONES[0]!;
}

export const isBuiltInTone = (id: string): id is BuiltInToneId =>
  TONES.some((tone) => tone.id === id);
