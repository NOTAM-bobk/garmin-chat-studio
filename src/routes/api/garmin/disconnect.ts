import { createFileRoute } from "@tanstack/react-router";

import { PENDING_COOKIE, clearCookie, jsonResponse } from "@/server/garmin.server";
import { disconnectCookies } from "@/server/garmin-key.server";

export const Route = createFileRoute("/api/garmin/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        jsonResponse({ ok: true }, 200, [
          ...disconnectCookies(request),
          clearCookie(PENDING_COOKIE),
        ]),
    },
  },
});
