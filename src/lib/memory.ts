/**
 * Durable facts the assistant chooses to keep about the user.
 *
 * There is no backend, so memories live in localStorage next to the chats and
 * are injected into the system prompt on every turn. The model manages them via
 * three local tools — save, update, forget — that never leave the browser.
 */

import { uid } from "@/lib/chat";
import type { ToolSpec } from "@/lib/puter";

export type Memory = {
  id: string;
  text: string;
  created: number;
  updated: number;
};

const KEY = "garmin-chat:memory:v1";
export const MEMORY_LIMIT = 40;
const MAX_TEXT = 240;

export function cleanMemoryText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT).trim();
}

export function loadMemories(): Memory[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((entry): Memory[] => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        const text = typeof record["text"] === "string" ? cleanMemoryText(record["text"]) : "";
        if (!text) return [];
        return [
          {
            id: typeof record["id"] === "string" ? record["id"] : uid(),
            text,
            created: typeof record["created"] === "number" ? record["created"] : Date.now(),
            updated: typeof record["updated"] === "number" ? record["updated"] : Date.now(),
          },
        ];
      })
      .slice(0, MEMORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveMemories(list: Memory[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MEMORY_LIMIT)));
  } catch {
    // Storage blocked: memory still applies for this session.
  }
}

/** Add a fact, or return the existing entry when the text is already known. */
export function addMemory(
  list: Memory[],
  raw: string,
): { list: Memory[]; memory: Memory; duplicate: boolean } {
  const text = cleanMemoryText(raw);
  const existing = list.find((memory) => memory.text.toLowerCase() === text.toLowerCase());
  if (existing) return { list, memory: existing, duplicate: true };
  const now = Date.now();
  const memory: Memory = { id: uid(), text, created: now, updated: now };
  return { list: [...list, memory], memory, duplicate: false };
}

export function replaceMemory(list: Memory[], id: string, raw: string): Memory[] | null {
  const text = cleanMemoryText(raw);
  if (!id || !text) return null;
  let found = false;
  const next = list.map((memory) => {
    if (memory.id !== id) return memory;
    found = true;
    return { ...memory, text, updated: Date.now() };
  });
  return found ? next : null;
}

export function dropMemory(list: Memory[], id: string): Memory[] | null {
  const next = list.filter((memory) => memory.id !== id);
  return next.length === list.length ? null : next;
}

/** The prompt block that tells the model what it already knows. */
export function memoryPrompt(list: Memory[]): string {
  const rules =
    "Use a memory only when it changes the answer; never recite the list. When the user corrects a fact, update it instead of adding a duplicate. Forget facts that are no longer true.";
  if (list.length === 0) {
    return `Memory: you have no saved memories yet. When the user shares a durable fact — a goal, injury, schedule, preference, PR or equipment — save it with memory_save. Never save passwords, tokens or one-off details from this conversation.`;
  }
  const rows = list.map((memory) => `- [${memory.id}] ${memory.text}`).join("\n");
  return `Memory — durable facts the user shared in earlier chats:\n${rows}\n${rules} Save new durable facts with memory_save, edit with memory_update, remove with memory_delete.`;
}

export const memoryTools: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "memory_save",
      description:
        "Save a durable fact about the user for future chats: goals, injuries, schedule, preferences, PRs, equipment. Not for one-off details or anything from a single workout.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "One short sentence, written as a fact, e.g. 'Trains early mornings, races a half in March'.",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_update",
      description:
        "Rewrite an existing memory by id when the user corrects, refines or replaces it.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The id shown in brackets in the memory list." },
          text: { type: "string", description: "The corrected fact." },
        },
        required: ["id", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_delete",
      description:
        "Forget a saved memory by id when it is no longer true, or when the user asks you to forget it.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The id shown in brackets in the memory list." },
        },
        required: ["id"],
      },
    },
  },
];

const MEMORY_TOOL_NAMES = new Set(memoryTools.map((tool) => tool.function.name));

export function isMemoryTool(name: string): boolean {
  return MEMORY_TOOL_NAMES.has(name);
}

/** A readable label for the trace list, mirroring describeTool for Garmin tools. */
export function describeMemoryTool(
  name: string,
  input: Record<string, unknown>,
): { label: string; detail?: string } {
  const text = typeof input["text"] === "string" ? cleanMemoryText(input["text"]) : "";
  if (name === "memory_update") {
    return { label: "Updating what it remembers", ...(text ? { detail: text } : {}) };
  }
  if (name === "memory_delete") {
    return { label: "Forgetting something" };
  }
  return { label: "Saving to memory", ...(text ? { detail: text } : {}) };
}
