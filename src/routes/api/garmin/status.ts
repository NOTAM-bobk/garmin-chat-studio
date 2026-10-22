import { createFileRoute } from "@tanstack/react-router";

import { cachedToolCount, jsonResponse, readSession, statusFor } from "@/server/garmin.server";

export const Route = createFileRoute("/api/garmin/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await readSession(request);
        return jsonResponse(statusFor(session, cachedToolCount(session?.accessToken)));
      },
    },
  },
});
