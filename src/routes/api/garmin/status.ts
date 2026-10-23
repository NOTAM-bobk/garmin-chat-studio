import { createFileRoute } from "@tanstack/react-router";

import { cachedToolCount, jsonResponse, readSession, statusFor } from "@/server/garmin.server";
import { personalStatus, readPersonalSession } from "@/server/garmin-key.server";

export const Route = createFileRoute("/api/garmin/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await readSession(request);
        if (session) return jsonResponse(statusFor(session, cachedToolCount(session.accessToken)));
        const personal = await readPersonalSession(request);
        if (personal) return jsonResponse(personalStatus());
        return jsonResponse(statusFor(null, 0));
      },
    },
  },
});
