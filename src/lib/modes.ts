/**
 * Answer modes the user writes themselves — a personal coach, a race-day
 * briefing, a physio voice, a plain-English explainer.
 *
 * They behave exactly like the built-in tones: a named prompt fragment that is
 * injected into the system prompt, picked from the composer, saved in this
 * browser. Ids are namespaced (`custom:<id>`) so they can never collide with a
 * built-in tone or drift when a mode is renamed.
 */

import { uid } from "@/lib/chat";
import { TONES, toneById, type Tone } from "@/lib/models";

export type CustomMode = {
  id: string;
  name: string;
  instruction: string;
  created: number;
};

const KEY = "garmin-chat:modes:v1";
export const MODE_LIMIT = 10;
const NAME_MAX = 24;
const INSTRUCTION_MAX = 280;

export function cleanModeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
}

export function cleanModeInstruction(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, INSTRUCTION_MAX).trim();
}

export function loadModes(): CustomMode[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((entry): CustomMode[] => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        const name = typeof record["name"] === "string" ? cleanModeName(record["name"]) : "";
        const instruction =
          typeof record["instruction"] === "string"
            ? cleanModeInstruction(record["instruction"])
            : "";
        if (!name || !instruction) return [];
        return [
          {
            id: typeof record["id"] === "string" ? record["id"] : uid(),
            name,
            instruction,
            created: typeof record["created"] === "number" ? record["created"] : Date.now(),
          },
        ];
      })
      .slice(0, MODE_LIMIT);
  } catch {
    return [];
  }
}

export function saveModes(list: CustomMode[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MODE_LIMIT)));
  } catch {
    // Storage blocked: the modes still work for this session.
  }
}

export function addMode(
  list: CustomMode[],
  name: string,
  instruction: string,
): { list: CustomMode[]; mode: CustomMode; duplicate: boolean } {
  const cleanName = cleanModeName(name);
  const cleanInstruction = cleanModeInstruction(instruction);
  const existing = list.find((mode) => mode.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) return { list, mode: existing, duplicate: true };
  const mode: CustomMode = {
    id: uid(),
    name: cleanName,
    instruction: cleanInstruction,
    created: Date.now(),
  };
  return { list: [...list, mode].slice(0, MODE_LIMIT), mode, duplicate: false };
}

export function dropMode(list: CustomMode[], id: string): CustomMode[] {
  return list.filter((mode) => mode.id !== id);
}

/** Namespaced id used as the selected tone. */
export function modeToneId(id: string): string {
  return `custom:${id}`;
}

export function isCustomTone(toneId: string): boolean {
  return toneId.startsWith("custom:");
}

function modeFromTone(modes: CustomMode[], toneId: string): CustomMode | undefined {
  return modes.find((mode) => modeToneId(mode.id) === toneId);
}

function toneFor(mode: CustomMode): Tone {
  return {
    id: modeToneId(mode.id),
    label: mode.name,
    prompt: `Mode "${mode.name}". ${mode.instruction}`,
  };
}

/** Built-in tones plus the user's own, in the order the pickers show them. */
export function toneOptions(modes: CustomMode[]): Tone[] {
  return [...TONES, ...modes.map(toneFor)];
}

/** The prompt fragment for a tone id, falling back to the default tone. */
export function resolveTone(toneId: string, modes: CustomMode[]): Tone {
  const custom = modeFromTone(modes, toneId);
  return custom ? toneFor(custom) : toneById(toneId);
}
