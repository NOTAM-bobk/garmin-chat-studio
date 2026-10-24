/**
 * In-chat questionnaires.
 *
 * The assistant can ask up to three short questions when the answer really
 * branches on something only the athlete knows: the goal race, which days they
 * can train, an injury, the equipment they actually own. Each question can be
 * tap-only (choice / multi) so answering takes one click, or free text.
 *
 * The answers come back as the user's next message; the model never has to
 * remember a half-finished tool call.
 */

import type { ToolSpec } from "@/lib/puter";

export const ASK_TOOL = "ask_questions";
export const MAX_QUESTIONS = 3;
export const MAX_OPTIONS = 5;

export type AskKind = "choice" | "multi" | "text";

export type AskQuestion = {
  id: string;
  prompt: string;
  kind: AskKind;
  /** Empty for free-text questions. */
  options: string[];
  hint?: string;
};

/** Question id → chosen option(s), or the typed answer. */
export type AskAnswers = Record<string, string[]>;

export const askSpec: ToolSpec = {
  type: "function",
  function: {
    name: ASK_TOOL,
    description:
      "Ask the athlete one to three short questions in the chat, with tappable options. Use it only when the answer genuinely changes what you recommend and no Garmin tool can supply it (goal race and date, available training days, an injury, equipment). The answers arrive as their next message.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "One to three questions, in the order you want them answered.",
          items: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "The question, under 120 characters." },
              kind: {
                type: "string",
                enum: ["choice", "multi", "text"],
                description:
                  "choice: pick one option. multi: pick any number. text: type an answer.",
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Two to five short options for choice and multi. Omit for text.",
              },
              hint: {
                type: "string",
                description: "Optional one-line reason the answer matters, under 80 characters.",
              },
            },
            required: ["prompt", "kind"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

export function isAskTool(name: string): boolean {
  return name === ASK_TOOL;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/**
 * Validate the model's arguments. Anything unusable is dropped rather than
 * rendered as an empty card; two good questions beat three broken ones.
 */
export function parseQuestions(input: unknown): AskQuestion[] {
  if (!input || typeof input !== "object") return [];
  const record = input as Record<string, unknown>;
  const raw = Array.isArray(record["questions"])
    ? record["questions"]
    : Array.isArray(input)
      ? input
      : [];
  const questions: AskQuestion[] = [];

  for (const entry of raw) {
    if (questions.length >= MAX_QUESTIONS) break;
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const prompt = clean(item["prompt"], 120);
    if (!prompt) continue;

    const options: string[] = [];
    if (Array.isArray(item["options"])) {
      for (const option of item["options"]) {
        const label = clean(option, 60);
        if (label && !options.includes(label)) options.push(label);
        if (options.length >= MAX_OPTIONS) break;
      }
    }
    const kind: AskKind =
      item["kind"] === "multi" && options.length >= 2
        ? "multi"
        : item["kind"] === "choice" && options.length >= 2
          ? "choice"
          : options.length >= 2
            ? "choice"
            : "text";
    const hint = clean(item["hint"], 80);

    questions.push({
      id: `q${questions.length + 1}`,
      prompt,
      kind,
      options: kind === "text" ? [] : options,
      ...(hint ? { hint } : {}),
    });
  }

  return questions;
}

/** True when this question has a usable answer. */
export function answered(question: AskQuestion, answers: AskAnswers): boolean {
  const picked = answers[question.id] ?? [];
  return picked.some((value) => value.trim().length > 0);
}

/** The user message that carries the answers back to the model. */
export function answersToText(questions: AskQuestion[], answers: AskAnswers): string {
  const lines = questions
    .filter((question) => answered(question, answers))
    .map((question) => {
      const picked = (answers[question.id] ?? []).filter((value) => value.trim());
      return `- ${question.prompt} → ${picked.join(", ")}`;
    });
  if (lines.length === 0) return "";
  return `My answers:\n${lines.join("\n")}`;
}

/** Compact one-line summary for a card that has already been answered. */
export function answerSummary(questions: AskQuestion[], answers: AskAnswers): string[] {
  return questions
    .filter((question) => answered(question, answers))
    .map((question) => `${question.prompt} ${(answers[question.id] ?? []).join(", ")}`);
}
