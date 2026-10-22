import { createFileRoute } from "@tanstack/react-router";

import { PENDING_COOKIE, SESSION_COOKIE, clearCookie, jsonResponse } from "@/server/garmin.server";

export const Route = createFileRoute("/api/garmin/disconnect")({
  server: {
    handlers: {
      POST: async () =>
        jsonResponse({ ok: true }, 200, [clearCookie(SESSION_COOKIE), clearCookie(PENDING_COOKIE)]),
    },
  },
});
