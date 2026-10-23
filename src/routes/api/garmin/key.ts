import { createFileRoute } from "@tanstack/react-router";

import { clearCookie, cookieDomain, jsonResponse, SESSION_COOKIE } from "@/server/garmin.server";
import { PERSONAL_TOOLS, connectPersonalKey } from "@/server/garmin-key.server";

type KeyBody = { key?: unknown };

export const Route = createFileRoute("/api/garmin/key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: KeyBody;
        try {
          body = (await request.json()) as KeyBody;
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }
        if (typeof body.key !== "string" || !body.key.trim()) {
          return jsonResponse({ error: "Paste the personal API key you copied from Garmin." }, 400);
        }

        try {
          // Saving a personal key replaces any MCP sign-in: one connection at a time.
          const { cookie } = await connectPersonalKey(request, body.key);
          return jsonResponse(
            {
              ok: true,
              mode: "personal",
              tools: PERSONAL_TOOLS.length,
              available: PERSONAL_TOOLS.length,
            },
            200,
            [cookie, clearCookie(SESSION_COOKIE, cookieDomain(request))],
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Garmin wouldn't accept that key.";
          return jsonResponse({ error: message }, 400);
        }
      },
    },
  },
});
