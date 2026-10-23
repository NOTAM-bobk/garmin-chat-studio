/**
 * Server-side Tavily client.
 *
 * Tavily is the second research provider: search returns ranked pages with
 * snippets and optional raw content, /extract returns the clean body of one
 * URL. TAVILY_API_KEY stays on the server; the browser only sees /api/web/*.
 */
import process from "node:process";

import type { WebSource } from "@/lib/web";

const TAVILY_BASE = "https://api.tavily.com";

export function tavilyConfigured(): boolean {
  return !!process.env["TAVILY_API_KEY"]?.trim();
}

type TavilySearchResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  raw_content?: unknown;
  published_date?: unknown;
};

type TavilySearchResponse = {
  results?: unknown;
  detail?: unknown;
};

type TavilyExtractResponse = {
  results?: unknown;
  failed_results?: unknown;
  detail?: unknown;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function errorDetail(payload: { detail?: unknown }): string {
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    if (typeof record["error"] === "string") return record["error"];
  }
  return "";
}

async function callTavily<T extends { detail?: unknown }>(path: string, body: unknown): Promise<T> {
  const key = process.env["TAVILY_API_KEY"]?.trim();
  if (!key) {
    throw new Error("Web research isn't configured. Add TAVILY_API_KEY to the environment.");
  }

  const response = await fetch(`${TAVILY_BASE}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Tavily rejected the API key. Check TAVILY_API_KEY in the environment.");
    }
    if (response.status === 429 || response.status === 432) {
      throw new Error(
        "Tavily is rate limited or out of credits for this key. Try again, or ask a question that doesn't need the web.",
      );
    }
    throw new Error(errorDetail(payload) || `Tavily request failed (${response.status}).`);
  }
  return payload;
}

/** Ranked pages with snippets (and full text when Tavily returns it). */
export async function tavilySearch(query: string, numResults: number): Promise<WebSource[]> {
  const payload = await callTavily<TavilySearchResponse>("/search", {
    query,
    search_depth: "advanced",
    max_results: numResults,
    topic: "general",
    include_raw_content: true,
    include_published_date: true,
  });

  const list: unknown[] = Array.isArray(payload.results) ? payload.results : [];
  return list.flatMap((entry): WebSource[] => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as TavilySearchResult;
    const url = typeof record.url === "string" ? record.url : "";
    if (!/^https?:\/\//i.test(url)) return [];
    const raw = typeof record.raw_content === "string" ? record.raw_content.trim() : "";
    const snippet = typeof record.content === "string" ? record.content.trim() : "";
    const excerpt = snippet || raw.slice(0, 1200);
    if (!excerpt) return [];
    return [
      {
        title:
          typeof record.title === "string" && record.title.trim()
            ? record.title.trim()
            : domainOf(url),
        url,
        domain: domainOf(url),
        published:
          typeof record.published_date === "string" && record.published_date
            ? record.published_date
            : null,
        excerpt: excerpt.slice(0, 4000),
        ...(raw ? { text: raw.slice(0, 12_000) } : {}),
      },
    ];
  });
}

/** Clean page text for one URL. */
export async function tavilyExtract(url: string): Promise<WebSource | null> {
  const payload = await callTavily<TavilyExtractResponse>("/extract", {
    urls: [url],
    extract_depth: "basic",
    format: "markdown",
  });

  const list: unknown[] = Array.isArray(payload.results) ? payload.results : [];
  const first = list[0];
  if (!first || typeof first !== "object") return null;
  const text =
    typeof (first as { raw_content?: unknown }).raw_content === "string"
      ? ((first as { raw_content: string }).raw_content ?? "").trim()
      : "";
  if (!text) return null;
  return {
    title: domainOf(url),
    url,
    domain: domainOf(url),
    published: null,
    excerpt: text.slice(0, 1200),
    text: text.slice(0, 12_000),
  };
}
