/**
 * Web research through Exa.
 *
 * The browser never sees the Exa key: both tools call our own /api/web/* routes,
 * which proxy Exa server-side. Results come back as plain text for the model,
 * with the exact URL of every source so answers can cite it inline.
 */

import type { ToolSpec } from "@/lib/puter";
import type { ToolResult } from "@/lib/garmin";

export type WebSource = {
  title: string;
  url: string;
  domain: string;
  published: string | null;
  excerpt: string;
  text?: string;
};

/** `https://www.react.dev/learn` → `react.dev` */
export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** True when link text is a bare domain, i.e. the chip-style citation form. */
export function isCitationLabel(text: string): boolean {
  const value = text.trim();
  if (!value || value.includes(" ") || value.length > 60) return false;
  if (value.startsWith("@")) return false;
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(value);
}

export const webTools: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the open web for current or external information: research findings, training science, product specs, race results, news. Returns ranked pages with titles, URLs, publication dates and the most relevant excerpts. Follow up with web_read before relying on a page.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "A natural-language query, e.g. 'evidence for 80/20 running intensity distribution in recreational runners'.",
          },
          numResults: {
            type: "number",
            description: "How many pages to return, 3-8. Default 5.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_read",
      description:
        "Read one web page in full (cleaned text) from a URL returned by web_search. Use it to check the actual evidence before quoting numbers or recommendations.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The exact URL of the page to read.",
          },
        },
        required: ["url"],
      },
    },
  },
];

/* ------------------------------------------------------------ rate limiting */

/** Lookups one answer may spend. */
export const WEB_TURN_LIMIT = 6;
/** Lookups allowed across the rolling window, per browser tab. */
export const WEB_WINDOW_LIMIT = 16;
/** Length of that rolling window. */
export const WEB_WINDOW_MS = 10 * 60_000;

/** Drop lookups that have aged out of the window. */
export function pruneWebCalls(calls: number[], now: number): number[] {
  return calls.filter((at) => now - at < WEB_WINDOW_MS);
}

/**
 * Why a web lookup should be refused right now, or null when it may run.
 * Both web_search and web_read count: they hit the same paid API.
 */
export function webLimitReason(
  turnCalls: number,
  windowCalls: number[],
  now = Date.now(),
): string | null {
  if (turnCalls >= WEB_TURN_LIMIT) {
    return `Web research is paused for this answer: the ${WEB_TURN_LIMIT}-lookup budget is spent. Answer from the sources already gathered, and say what you could not check.`;
  }
  const recent = pruneWebCalls(windowCalls, now);
  if (recent.length >= WEB_WINDOW_LIMIT) {
    const oldest = recent[0] ?? now;
    const minutes = Math.max(1, Math.ceil((WEB_WINDOW_MS - (now - oldest)) / 60_000));
    const window = Math.round(WEB_WINDOW_MS / 60_000);
    return `Web research is rate limited: ${WEB_WINDOW_LIMIT} lookups per ${window} minutes. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}, or answer from what you already have.`;
  }
  return null;
}

const WEB_TOOL_NAMES = new Set(webTools.map((tool) => tool.function.name));

export function isWebTool(name: string): boolean {
  return WEB_TOOL_NAMES.has(name);
}

/** Trace labels, mirroring describeTool for Garmin tools. */
export function describeWebTool(
  name: string,
  input: Record<string, unknown>,
): { label: string; detail?: string } {
  if (name === "web_read") {
    const url = typeof input["url"] === "string" ? input["url"].trim() : "";
    const domain = url ? sourceDomain(url) : "";
    return {
      label: domain ? `Reading ${domain}` : "Reading a web page",
      ...(url ? { detail: url } : {}),
    };
  }
  const query = typeof input["query"] === "string" ? input["query"].trim() : "";
  return { label: "Searching the web", ...(query ? { detail: query } : {}) };
}

function excerptText(source: WebSource): string {
  return source.excerpt || source.text || "";
}

function formatSources(query: string, sources: WebSource[]): string {
  if (sources.length === 0) {
    return `No web results for "${query}". Try a broader query or answer from what you already know.`;
  }
  const rows = sources.map((source, index) => {
    const meta = [
      source.domain,
      source.published ? `published ${source.published.slice(0, 10)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return `${index + 1}. ${source.title} — ${source.url} (${meta})\n   ${excerptText(source).replace(/\s+/g, " ").slice(0, 1200)}`;
  });
  return `Web results for "${query}" (${sources.length}). Cite the ones you use as [${sources[0]?.domain ?? "domain"}](url).\n\n${rows.join("\n\n")}`;
}

type SearchResponse = { sources?: WebSource[]; error?: string };
type ReadResponse = { source?: WebSource | null; error?: string };

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Web research is unavailable right now.");
  }
  return payload;
}

/** Run one web tool call and shape the result for the model. */
export async function requestWebTool(
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  if (name === "web_read") {
    const url = typeof input["url"] === "string" ? input["url"].trim() : "";
    if (!url) {
      return { ok: false, isError: true, text: "web_read needs a url." };
    }
    const payload = await postJson<ReadResponse>("/api/web/read", { url });
    const source = payload.source;
    if (!source) {
      return { ok: false, isError: true, text: `Couldn't read ${url}. Try another result.` };
    }
    const body = (source.text || source.excerpt || "").slice(0, 12_000);
    return {
      ok: true,
      isError: false,
      text: `${source.title}\n${source.url}\n\n${body}\n\nCite as [${source.domain}](${source.url}).`,
    };
  }

  const query = typeof input["query"] === "string" ? input["query"].trim() : "";
  if (!query) {
    return { ok: false, isError: true, text: "web_search needs a query." };
  }
  const rawCount = typeof input["numResults"] === "number" ? input["numResults"] : 5;
  const numResults = Math.min(Math.max(Math.round(rawCount), 3), 8);
  const payload = await postJson<SearchResponse>("/api/web/search", { query, numResults });
  const sources = payload.sources ?? [];
  return { ok: true, isError: false, text: formatSources(query, sources) };
}
