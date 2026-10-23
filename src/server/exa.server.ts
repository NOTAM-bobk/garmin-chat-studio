/**
 * Server-side Exa client for web research.
 *
 * EXA_API_KEY stays in the server environment; the browser only talks to
 * /api/web/search and /api/web/read. Exa returns clean page text, so the model
 * can quote a source instead of guessing from a search snippet.
 */
import process from "node:process";

import type { WebSource } from "@/lib/web";

const EXA_BASE = "https://api.exa.ai";

export function exaConfigured(): boolean {
  return !!process.env["EXA_API_KEY"]?.trim();
}

export function exaSetupHint(): string {
  return "Web research isn't configured. Add EXA_API_KEY to the deployment's environment variables.";
}

type ExaResult = {
  title?: unknown;
  url?: unknown;
  publishedDate?: unknown;
  author?: unknown;
  highlights?: unknown;
  text?: unknown;
};

type ExaResponse = {
  results?: unknown;
  error?: unknown;
  message?: unknown;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function joinHighlights(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" … ");
}

function normalize(raw: unknown): WebSource | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as ExaResult;
  const url = typeof record.url === "string" ? record.url : "";
  if (!/^https?:\/\//i.test(url)) return null;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  const excerpt = joinHighlights(record.highlights) || text.slice(0, 1200);
  return {
    title:
      typeof record.title === "string" && record.title.trim() ? record.title.trim() : domainOf(url),
    url,
    domain: domainOf(url),
    published:
      typeof record.publishedDate === "string" && record.publishedDate
        ? record.publishedDate
        : null,
    excerpt: excerpt.slice(0, 4000),
    ...(text ? { text: text.slice(0, 12_000) } : {}),
  };
}

async function callExa<T extends ExaResponse>(path: string, body: unknown): Promise<T> {
  const key = process.env["EXA_API_KEY"]?.trim();
  if (!key) throw new Error(exaSetupHint());

  const response = await fetch(`${EXA_BASE}${path}`, {
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
    const detail =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : "";
    if (response.status === 401 || response.status === 403) {
      throw new Error("Exa rejected the API key. Check EXA_API_KEY in the environment.");
    }
    if (response.status === 402 || response.status === 429) {
      throw new Error(
        "Exa is rate limited or out of credits for this key. Try again, or ask a question that doesn't need the web.",
      );
    }
    throw new Error(detail || `Exa request failed (${response.status}).`);
  }
  return payload;
}

/** Ranked pages for a natural-language query, with query-focused excerpts. */
export async function exaSearch(query: string, numResults: number): Promise<WebSource[]> {
  const payload = await callExa<ExaResponse>("/search", {
    query,
    type: "auto",
    numResults,
    contents: {
      highlights: true,
      text: { maxCharacters: 2000 },
    },
  });
  const list: unknown[] = Array.isArray(payload.results) ? payload.results : [];
  return list.flatMap((entry): WebSource[] => {
    const source = normalize(entry);
    return source ? [source] : [];
  });
}

/** Clean full text for one URL. */
export async function exaRead(url: string): Promise<WebSource | null> {
  const payload = await callExa<ExaResponse>("/contents", {
    urls: [url],
    text: { maxCharacters: 12_000 },
    highlights: true,
  });
  const list: unknown[] = Array.isArray(payload.results) ? payload.results : [];
  return normalize(list[0]) ?? null;
}
