/**
 * Web research across both providers.
 *
 * Exa and Tavily index the web differently, so when both keys are set a search
 * runs them in parallel and interleaves the results: one bad index or a missing
 * key degrades to the other instead of failing the turn. Reading a page prefers
 * Tavily's extractor (built for clean article text) and falls back to Exa.
 */
import type { WebSource } from "@/lib/web";
import { exaConfigured, exaRead, exaSearch } from "@/server/exa.server";
import { tavilyConfigured, tavilyExtract, tavilySearch } from "@/server/tavily.server";

export function webConfigured(): boolean {
  return exaConfigured() || tavilyConfigured();
}

export function webSetupHint(): string {
  return "Web research isn't configured. Add EXA_API_KEY and/or TAVILY_API_KEY to the deployment's environment variables.";
}

export function webProviders(): string[] {
  return [...(exaConfigured() ? ["Exa"] : []), ...(tavilyConfigured() ? ["Tavily"] : [])];
}

function dedupeKey(url: string): string {
  return url
    .replace(/[#?].*$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export async function searchWeb(
  query: string,
  numResults: number,
): Promise<{ sources: WebSource[]; providers: string[] }> {
  const tasks: { name: string; run: Promise<WebSource[]> }[] = [];
  if (exaConfigured()) tasks.push({ name: "Exa", run: exaSearch(query, numResults) });
  if (tavilyConfigured()) tasks.push({ name: "Tavily", run: tavilySearch(query, numResults) });
  if (tasks.length === 0) throw new Error(webSetupHint());

  const settled = await Promise.allSettled(tasks.map((task) => task.run));
  const lists: WebSource[][] = [];
  const providers: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      lists.push(result.value);
      providers.push(tasks[index]!.name);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`[web] ${tasks[index]!.name} search failed: ${reason}`);
    }
  });

  if (lists.length === 0) {
    const failure = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw failure?.reason instanceof Error
      ? failure.reason
      : new Error("Web search failed on every provider.");
  }

  // Interleave by rank so both indexes are represented, then drop duplicates.
  const merged: WebSource[] = [];
  const seen = new Set<string>();
  const longest = Math.max(...lists.map((list) => list.length));
  for (let rank = 0; rank < longest; rank++) {
    for (const list of lists) {
      const source = list[rank];
      if (!source) continue;
      const key = dedupeKey(source.url);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(source);
    }
  }

  return { sources: merged.slice(0, Math.max(numResults, 5)), providers };
}

export async function readPage(url: string): Promise<WebSource | null> {
  if (!webConfigured()) throw new Error(webSetupHint());

  const attempts: (() => Promise<WebSource | null>)[] = [];
  if (tavilyConfigured()) attempts.push(() => tavilyExtract(url));
  if (exaConfigured()) attempts.push(() => exaRead(url));

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const source = await attempt();
      if (source) return source;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[web] read failed: ${message}`);
    }
  }

  if (lastError)
    throw lastError instanceof Error ? lastError : new Error("That page couldn't be read.");
  return null;
}
