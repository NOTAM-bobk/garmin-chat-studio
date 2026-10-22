/**
 * Web Vibration API wrapper.
 *
 * `navigator.vibrate` is missing on iOS Safari, and users who ask for reduced
 * motion usually don't want their phone buzzing either, so every call is a
 * silent no-op in those cases. The on/off preference lives in localStorage and
 * is mirrored into a module flag so plain event handlers can call `haptic()`
 * without threading state through props.
 */

const KEY = "garmin-chat:haptics";

export type HapticKind = "tap" | "select" | "done" | "warn";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  done: [10, 28, 14],
  warn: [16, 40, 16],
};

let enabled = true;

export function readHapticsSetting(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(KEY);
    enabled = stored !== "0";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function writeHapticsSetting(next: boolean) {
  enabled = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Storage blocked: the toggle still applies for this session.
  }
}

export function hapticSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(kind: HapticKind = "tap") {
  if (!enabled || !hapticSupported()) return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Vibration can throw when the page isn't focused; never break an action.
  }
}
