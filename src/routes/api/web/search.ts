import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/server/garmin.server";
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

        try {
          const { sources } = await searchWeb(query.slice(0, 400), numResults);
          return jsonResponse({ sources });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Web search failed.";
          console.error("[exa] search failed:", message);
          return jsonResponse({ error: message }, 502);
        }
      },
    },
  },
});
