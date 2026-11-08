import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/server/garmin.server";
import { logPostHog } from "@/server/posthog-logs.server";
import { checkWebBudget } from "@/server/web-budget.server";
import { searchWeb, webConfigured, webSetupHint } from "@/server/web.server";

type SearchBody = { query?: unknown; numResults?: unknown };

export const Route = createFileRoute("/api/web/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!webConfigured()) return jsonResponse({ error: webSetupHint() }, 503);

        let body: SearchBody;
        try {
          body = (await request.json()) as SearchBody;
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }

        const query = typeof body.query === "string" ? body.query.trim() : "";
        if (query.length < 3) {
          return jsonResponse({ error: "A search query is required." }, 400);
        }
        const requested =
          typeof body.numResults === "number" && Number.isFinite(body.numResults)
            ? body.numResults
            : 5;
        const numResults = Math.min(Math.max(Math.round(requested), 3), 8);

        const limited = checkWebBudget(request);
        if (limited) {
          return jsonResponse({ error: limited.message }, 429, [], {
            "retry-after": String(Math.ceil(limited.retryAfterMs / 1000)),
          });
        }

        try {
          const { sources, providers } = await searchWeb(query.slice(0, 400), numResults);
          logPostHog("info", "web research search completed", {
            operation: "search",
            provider_count: providers.length,
            result_count: sources.length,
          });
          return jsonResponse({ sources });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Web search failed.";
          logPostHog("error", "web research search failed", { operation: "search" });
          console.error("[exa] search failed:", message);
          return jsonResponse({ error: message }, 502);
        }
      },
    },
  },
});
