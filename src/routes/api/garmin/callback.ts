import { createFileRoute } from "@tanstack/react-router";

import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  bakeCookie,
  clearCookie,
  cookieDomain,
  exchangeCode,
  readCookie,
  redirect,
  requestOrigin,
  seal,
  unseal,
  type PendingPayload,
  type SessionPayload,
} from "@/server/garmin.server";

const MAX_SESSION_SECONDS = 90 * 24 * 60 * 60;

export const Route = createFileRoute("/api/garmin/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const pending = await unseal<PendingPayload>(readCookie(request, PENDING_COOKIE));

        if (error) {
          const reason = url.searchParams.get("error_description") ?? error;
          return redirect(`/?garmin=error&reason=${encodeURIComponent(reason)}`, [
            clearCookie(PENDING_COOKIE),
          ]);
        }

        if (!pending || !code || !state || state !== pending.state) {
          return redirect("/?garmin=error&reason=Connection%20expired.%20Please%20try%20again.", [
            clearCookie(PENDING_COOKIE),
          ]);
        }

        try {
          const { accessToken, expiresIn } = await exchangeCode({
            code,
            codeVerifier: pending.verifier,
            redirectUri: pending.redirectUri,
            clientId: pending.clientId,
            clientSecret: pending.clientSecret,
          });
          const tokenSeconds = Math.min(expiresIn ?? MAX_SESSION_SECONDS, MAX_SESSION_SECONDS);
          const session: SessionPayload = {
            accessToken,
            clientId: pending.clientId,
            clientSecret: pending.clientSecret,
            expiresAt: Date.now() + tokenSeconds * 1000,
          };
          const secure = requestOrigin(request).startsWith("https://");
          const domain = cookieDomain(request);
          // The cookie outlives a short-lived gateway token: the token is
          // rechecked on every call and only a real 401 clears the session.
          const cookie = bakeCookie(SESSION_COOKIE, await seal(session), {
            maxAge: MAX_SESSION_SECONDS,
            secure,
            ...(domain ? { domain } : {}),
          });
          return redirect("/?garmin=connected", [cookie, clearCookie(PENDING_COOKIE)]);
        } catch (exchangeError) {
          const reason =
            exchangeError instanceof Error ? exchangeError.message : "Garmin sign-in failed.";
          return redirect(`/?garmin=error&reason=${encodeURIComponent(reason)}`, [
            clearCookie(PENDING_COOKIE),
          ]);
        }
      },
    },
  },
});
