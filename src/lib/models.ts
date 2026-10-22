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

export type ToneId = "coach" | "analyst" | "explain" | "straight";

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
      "Tone: a sharp endurance coach. Warm, direct, zero filler. Name the one thing that matters most, then the next action.",
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

export const DEFAULT_TONE: ToneId = "coach";

export function toneById(id: string): Tone {
  return TONES.find((tone) => tone.id === id) ?? TONES[0]!;
}
