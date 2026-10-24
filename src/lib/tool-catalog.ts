/**
 * On-demand access to the rest of the Garmin catalogue.
 *
 * The gateway exposes 150 tools; providers accept roughly 128 schemas per
 * request, so the long tail travels behind one search tool instead of bloating
 * every turn. The model asks for a topic, gets the matching tool ids with their
 * required arguments, and those schemas are attached to its next round.
 */

import { isReadTool, type GarminTool, type ToolSpec } from "@/lib/garmin";

export const DISCOVERY_TOOL = "find_garmin_tools";

export const discoverySpec: ToolSpec = {
  type: "function",
  function: {
    name: DISCOVERY_TOOL,
    description:
      "Find Garmin tools that are not loaded in this conversation yet. Search by topic: gear, badges, courses, nutrition or food, weight, devices, blood pressure, lactate threshold, power curve, pregnancy, menstrual cycle, workout upload, strength workouts. Returns the matching tool names with their arguments; those tools become callable on your next turn.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'What you need, in a few words. Example: "lactate threshold".',
        },
      },
      required: ["query"],
    },
  },
};

export function isDiscoveryTool(name: string): boolean {
  return name === DISCOVERY_TOOL;
}

/** Words worth matching; drops articles and prepositions. */
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "tool",
  "tools",
  "garmin",
  "get",
]);

function terms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
    ),
  ];
}

/**
 * Tools that best answer a topic. Name hits outrank description hits, and a
 * reading beats a write when both match, so "weight" lands on weigh-ins before
 * it lands on add_weigh_in.
 */
export function matchTools(query: string, tools: GarminTool[], limit = 8): GarminTool[] {
  const wanted = terms(query);
  if (wanted.length === 0) return [];
  const phrase = wanted.join(" ");

  const scored = tools.map((tool) => {
    const name = tool.name.toLowerCase();
    const description = tool.description.toLowerCase();
    let score = 0;
    for (const term of wanted) {
      if (name.includes(term)) score += 6;
      else if (name.replace(/_/g, " ").includes(term)) score += 5;
      if (description.includes(term)) score += 2;
    }
    if (score === 0) return { tool, score };
    const stem = name.replace(
      /^(get|set|add|log|create|delete|update|upload|schedule|unschedule|remove)_/,
      "",
    );
    if (stem.includes(phrase)) score += 4;
    if (isReadTool(tool.name)) score += 1;
    return { tool, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, limit)
    .map((entry) => entry.tool);
}

/** The tool result the model reads after a successful search. */
export function matchesText(matched: GarminTool[], query: string): string {
  if (matched.length === 0) {
    return `No Garmin tool matches "${query}". Try a broader word — sleep, activity, gear, badges, food, weight, devices, courses — or answer from the tools you already have.`;
  }
  const lines = matched.map((tool) => {
    const required = tool.parameters.required ?? [];
    const args = required.length > 0 ? `(${required.join(", ")})` : "";
    return `- ${tool.name}${args}: ${tool.description.replace(/\s+/g, " ").trim().slice(0, 140)}`;
  });
  return `These tools are loaded and callable on your next turn:\n${lines.join("\n")}`;
}
