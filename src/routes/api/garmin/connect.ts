import { createFileRoute } from "@tanstack/react-router";

import {
  PENDING_COOKIE,
  authorizeUrl,
  bakeCookie,
  isConfigured,
  jsonResponse,
  pkceChallenge,
  randomToken,
  redirect,
  registerClient,
  requestOrigin,
  seal,
  type PendingPayload,
} from "@/server/garmin.server";

export const Route = createFileRoute("/api/garmin/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isConfigured()) {
          return jsonResponse(
            {
              error:
                "Garmin isn't configured on this deployment yet. Add SESSION_SECRET in your environment settings.",
            },
            503,
          );
        }

        const origin = requestOrigin(request);
        const redirectUri = `${origin}/api/garmin/callback`;

        try {
          const { clientId, clientSecret } = await registerClient(redirectUri);
          const state = randomToken(24);
          const verifier = randomToken(48);
          const pending: PendingPayload = {
            state,
            verifier,
            clientId,
            clientSecret,
            redirectUri,
            createdAt: Date.now(),
          };

          const cookie = bakeCookie(PENDING_COOKIE, await seal(pending), {
            maxAge: 600,
            secure: origin.startsWith("https://"),
          });

          return redirect(
            authorizeUrl({
              clientId,
              redirectUri,
              state,
              challenge: await pkceChallenge(verifier),
            }),
            [cookie],
          );
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Could not reach Garmin.";
          return redirect(`/?garmin=error&reason=${encodeURIComponent(reason)}`);
        }
      },
    },
  },
});
