import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/server/garmin.server";
import { exaConfigured, exaRead, exaSetupHint } from "@/server/exa.server";

type ReadBody = { url?: unknown };

export const Route = createFileRoute("/api/web/read")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!exaConfigured()) return jsonResponse({ error: exaSetupHint() }, 503);

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

        try {
          const source = await exaRead(raw);
          if (!source) {
            return jsonResponse({ error: "That page couldn't be read." }, 404);
          }
          return jsonResponse({ source });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not read that page.";
          console.error("[exa] read failed:", message);
          return jsonResponse({ error: message }, 502);
        }
      },
    },
  },
});
