/**
 * Cloud chat sync through the user's own Puter account.
 *
 * Puter.js does not store conversations for you: it exposes a per-user,
 * per-app key-value store (`puter.kv`) and an account session. Guests get a
 * temporary account whose data disappears with the session, so syncing only
 * starts once the user signs in for real (`is_temp === false`).
 *
 * The KV entry is capped at 400 KB, so the cloud copy drops attached images and
 * the oldest threads until it fits; the browser copy stays complete.
 */

import { sanitizeChats, type Chat } from "@/lib/chat";
import { loadPuter } from "@/lib/puter";

const CLOUD_KEY = "garmin-chat:threads:v1";
/** 400 KB is the KV ceiling; leave headroom for JSON overhead. */
const MAX_BYTES = 380_000;

export type PuterAccount = {
  signedIn: boolean;
  /** Temporary (guest) accounts lose their cloud data, so we don't sync them. */
  guest: boolean;
  /** Puter's immutable account UUID, used as the analytics distinct ID. */
  id: string | null;
  username: string | null;
};

export const SIGNED_OUT: PuterAccount = { signedIn: false, guest: false, id: null, username: null };

function readUser(raw: unknown): { id: string | null; username: string | null; isTemp: boolean } {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof record["uuid"] === "string" ? record["uuid"] : null,
    username: typeof record["username"] === "string" ? record["username"] : null,
    isTemp: record["is_temp"] !== false,
  };
}

export async function readPuterAccount(): Promise<PuterAccount> {
  const puter = await loadPuter();
  if (!puter.auth.isSignedIn()) return SIGNED_OUT;
  try {
    const user = readUser(await puter.auth.getUser());
    return { signedIn: true, guest: user.isTemp, id: user.id, username: user.username };
  } catch {
    // A session exists but we can't identify it: treat it as temporary.
    return { signedIn: true, guest: true, id: null, username: null };
  }
}

export async function signInToPuter(): Promise<PuterAccount> {
  const puter = await loadPuter();
  await puter.auth.signIn();
  return readPuterAccount();
}

export async function signOutOfPuter(): Promise<void> {
  const puter = await loadPuter();
  await puter.auth.signOut();
}

export async function loadCloudChats(): Promise<Chat[]> {
  const puter = await loadPuter();
  if (!puter.kv) return [];
  return sanitizeChats(await puter.kv.get(CLOUD_KEY));
}

function withoutImages(chat: Chat): Chat {
  return {
    ...chat,
    messages: chat.messages.map(({ image: _image, ...rest }) => rest),
  };
}

function bytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export type CloudSaveResult = "saved" | "unavailable" | "too-large";

export async function saveCloudChats(chats: Chat[]): Promise<CloudSaveResult> {
  const puter = await loadPuter();
  if (!puter.kv) return "unavailable";

  // Newest first in the app; drop the oldest threads until the payload fits.
  const payload = chats.map(withoutImages);
  let trimmed = payload.slice(0, 40);
  while (trimmed.length > 0 && bytes(trimmed) > MAX_BYTES) trimmed = trimmed.slice(0, -1);
  if (trimmed.length === 0 && payload.length > 0) return "too-large";

  const saved = await puter.kv.set(CLOUD_KEY, trimmed, { disableSharing: true });
  return saved ? "saved" : "unavailable";
}
