/**
 * Where a chat lives.
 *
 * Every thread already has a short random id, so it doubles as its address:
 * served on `<id>.<base domain>` when a base domain is configured (wildcard DNS
 * + TLS), and on `/c/<id>` otherwise. The subdomain form is a plain alias — the
 * app resolves either one on load.
 */

/** Short, lowercase, DNS-safe. Chat ids from `uid()` already qualify. */
const SLUG = /^[a-z0-9]{5,12}$/;

const RESERVED = new Set(["www", "app", "api", "blog", "admin", "mail", "static"]);

/** Set VITE_CHAT_DOMAIN (e.g. `garmin.chat`) to hand each chat its own subdomain. */
export function chatBaseDomain(): string {
  const configured = import.meta.env["VITE_CHAT_DOMAIN"] as string | undefined;
  return (configured ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

export function isChatSlug(value: string): boolean {
  return SLUG.test(value) && !RESERVED.has(value);
}

/** The chat id in the current hostname, when the app is served on a chat subdomain. */
export function chatSlugFromHost(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;

  const base = chatBaseDomain();
  if (base) {
    if (host === base) return null;
    if (!host.endsWith(`.${base}`)) return null;
    const label = host.slice(0, -(base.length + 1));
    return label && !label.includes(".") && isChatSlug(label) ? label : null;
  }

  // Without a configured domain, guess: `slug.example.com` or `slug.localhost`.
  const labels = host.split(".");
  const first = labels[0];
  if (!first || labels.length < 2) return null;
  const isApex = labels.length === 2 && labels[1] !== "localhost";
  if (isApex) return null;
  return isChatSlug(first) ? first : null;
}

/** Path form, used when no base domain is configured. */
export function chatPath(id: string): string {
  return `/c/${id}`;
}

/**
 * The public address of a chat: its own subdomain when one is configured,
 * otherwise a `/c/<id>` path on the current host.
 */
export function chatUrlFor(id: string | null): string {
  const base = chatBaseDomain();
  if (base) return id ? `https://${id}.${base}/` : `https://${base}/`;
  if (typeof window === "undefined") return id ? chatPath(id) : "/";
  return new URL(id ? chatPath(id) : "/", window.location.origin).toString();
}
