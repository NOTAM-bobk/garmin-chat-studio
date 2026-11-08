import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/server/garmin.server";
import { logPostHog } from "@/server/posthog-logs.server";
import { checkWebBudget } from "@/server/web-budget.server";
import { readPage, webConfigured, webSetupHint } from "@/server/web.server";

type ReadBody = { url?: unknown };

export const Route = createFileRoute("/api/web/read")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!webConfigured()) return jsonResponse({ error: webSetupHint() }, 503);

        let body: ReadBody;
        try {
          body = (await request.json()) as ReadBody;
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }

        const raw = typeof body.url === "string" ? body.url.trim() : "";
        if (!/^https?:\/\//i.test(raw)) {
          return jsonResponse({ error: "A valid http(s) URL is required." }, 400);
        }

        const limited = checkWebBudget(request);
        if (limited) {
          return jsonResponse({ error: limited.message }, 429, [], {
            "retry-after": String(Math.ceil(limited.retryAfterMs / 1000)),
          });
        }

        try {
          const source = await readPage(raw);
          if (!source) {
            logPostHog("warn", "web research page unavailable", { operation: "read" });
            return jsonResponse({ error: "That page couldn't be read." }, 404);
          }
          logPostHog("info", "web research page read", { operation: "read" });
          return jsonResponse({ source });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not read that page.";
          logPostHog("error", "web research page read failed", { operation: "read" });
          console.error("[exa] read failed:", message);
          return jsonResponse({ error: message }, 502);
        }
      },
    },
  },
});
