/**
 * Site-level SEO constants.
 *
 * Set VITE_SITE_URL in the environment once the production domain is known so
 * canonical links, Open Graph images and structured data are absolute. Until
 * then paths stay relative, which browsers and crawlers resolve correctly.
 */

export const SITE_NAME = "Garmin Chat";

export const SITE_TAGLINE = "Ask your Garmin data anything";

export const SITE_DESCRIPTION =
  "Chat with your Garmin Connect data — sleep, recovery, training load and workouts — with every lookup and reasoning step shown as it happens.";

export const SITE_URL = ((import.meta.env["VITE_SITE_URL"] as string | undefined) ?? "").replace(
  /\/+$/,
  "",
);

export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Absolute origin for the current request: the configured domain when set,
 * otherwise the host the proxy forwarded, otherwise the request URL itself.
 * Sitemaps and robots.txt need absolute URLs to be valid.
 */
export function requestBase(request: Request): string {
  if (SITE_URL) return SITE_URL;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    try {
      return new URL(request.url).origin;
    } catch {
      return "";
    }
  }
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
  const proto = request.headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
}
