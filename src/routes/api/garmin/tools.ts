import { createFileRoute } from "@tanstack/react-router";

import {
  SESSION_COOKIE,
  clearCookie,
  getTools,
  jsonResponse,
  readSession,
} from "@/server/garmin.server";

export const Route = createFileRoute("/api/garmin/tools")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await readSession(request);
        if (!session) {
          return jsonResponse({ error: "Garmin isn't connected." }, 401);
        }
        try {
          const { tools, available } = await getTools(session.accessToken, false);
          return jsonResponse({ tools, available });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load Garmin tools.";
          const expired = /401|unauthor|expired|invalid_token|reconnect/i.test(message);
          return jsonResponse(
            { error: message },
            expired ? 401 : 502,
            expired ? [clearCookie(SESSION_COOKIE)] : [],
          );
        }
      },
    },
  },
});
