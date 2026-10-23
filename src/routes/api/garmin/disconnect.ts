import { createFileRoute } from "@tanstack/react-router";

import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  cookieDomain,
  jsonResponse,
} from "@/server/garmin.server";

export const Route = createFileRoute("/api/garmin/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        jsonResponse({ ok: true }, 200, [
          clearCookie(SESSION_COOKIE, cookieDomain(request)),
          clearCookie(PENDING_COOKIE),
        ]),
    },
  },
});
