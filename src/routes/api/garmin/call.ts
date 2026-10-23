import { createFileRoute } from "@tanstack/react-router";

import {
  SESSION_COOKIE,
  bakeCookie,
  callTool,
  clearCookie,
  cookieDomain,
  jsonResponse,
  readSession,
  requestOrigin,
  seal,
} from "@/server/garmin.server";
import { PERSONAL_COOKIE, callPersonalTool, readPersonalSession } from "@/server/garmin-key.server";

const PERSONAL_MAX_AGE = 60 * 60 * 24 * 180;

type CallBody = { name?: unknown; arguments?: unknown };

export const Route = createFileRoute("/api/garmin/call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await readSession(request);

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

        const personal = session ? null : await readPersonalSession(request);
        if (!session && !personal) {
          return jsonResponse({ error: "Garmin isn't connected." }, 401);
        }

        try {
          if (personal) {
            const { result, session: refreshed } = await callPersonalTool(
              personal,
              body.name,
              args,
            );
            // A rotated token is re-sealed so the next call skips the exchange.
            if (refreshed.token === personal.token) return jsonResponse(result);
            const domain = cookieDomain(request);
            return jsonResponse(result, 200, [
              bakeCookie(PERSONAL_COOKIE, await seal(refreshed), {
                maxAge: PERSONAL_MAX_AGE,
                secure: requestOrigin(request).startsWith("https://"),
                ...(domain ? { domain } : {}),
              }),
            ]);
          }

          const result = await callTool(session!.accessToken, body.name, args);
          return jsonResponse(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "The Garmin tool failed.";
          const expired = /401|unauthor|expired|invalid_token|reconnect/i.test(message);
          return jsonResponse(
            { error: message, expired },
            expired ? 401 : 502,
            expired && session ? [clearCookie(SESSION_COOKIE, cookieDomain(request))] : [],
          );
        }
      },
    },
  },
});
