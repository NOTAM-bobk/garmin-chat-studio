import { createFileRoute } from "@tanstack/react-router";

import {
  SESSION_COOKIE,
  callTool,
  clearCookie,
  cookieDomain,
  jsonResponse,
  readSession,
} from "@/server/garmin.server";

type CallBody = { name?: unknown; arguments?: unknown };

export const Route = createFileRoute("/api/garmin/call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await readSession(request);
        if (!session) {
          return jsonResponse({ error: "Garmin isn't connected." }, 401);
        }

        let body: CallBody;
        try {
          body = (await request.json()) as CallBody;
        } catch {
          return jsonResponse({ error: "Invalid JSON body." }, 400);
        }

        if (typeof body.name !== "string") {
          return jsonResponse({ error: "A tool name is required." }, 400);
        }
        const args =
          body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments)
            ? (body.arguments as Record<string, unknown>)
            : {};

        try {
          const result = await callTool(session.accessToken, body.name, args);
          return jsonResponse(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "The Garmin tool failed.";
          const expired = /401|unauthor|expired|invalid_token|reconnect/i.test(message);
          return jsonResponse(
            { error: message, expired },
            expired ? 401 : 502,
            expired ? [clearCookie(SESSION_COOKIE, cookieDomain(request))] : [],
          );
        }
      },
    },
  },
});
