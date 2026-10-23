/**
 * Server-only Garmin path: MissingMCP OAuth 2.1 (authorization code + PKCE,
 * dynamic client registration) and a thin MCP JSON-RPC client.
 *
 * The Garmin bearer token is sealed in an httpOnly cookie with AES-256-GCM, so
 * the browser never sees it and the MCP endpoint can't be called directly with
 * a stolen token from client JS.
 */
import process from "node:process";

import {
  GARMIN_TOOL_ALLOWLIST,
  isAllowedTool,
  type GarminStatus,
  type GarminTool,
  type JsonSchema,
  type ToolResult,
} from "@/lib/garmin";

const DEFAULT_BASE = "https://missingmcp.com";
const DEV_SECRET = "garmin-chat-studio-dev-secret-change-me-please";

export const SESSION_COOKIE = "gcs_garmin_session";
export const PENDING_COOKIE = "gcs_garmin_pending";
export const MCP_PROTOCOL_VERSION = "2025-06-18";

export function gatewayBase(): string {
  return (process.env["MISSINGMCP_BASE_URL"] || DEFAULT_BASE).replace(/\/+$/, "");
}

export function isConfigured(): boolean {
  const secret = process.env["SESSION_SECRET"];
  if (secret && secret.length >= 16) return true;
  return process.env["NODE_ENV"] !== "production";
}

function sessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (secret && secret.length >= 16) return secret;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("SESSION_SECRET is not set (32+ random characters required).");
  }
  console.warn("[garmin] SESSION_SECRET not set — using the insecure development secret.");
  return DEV_SECRET;
}

/* ------------------------------------------------------------------ crypto */

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let keyPromise: Promise<CryptoKey> | null = null;

function aesKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const encoder = new TextEncoder();
    keyPromise = crypto.subtle
      .digest("SHA-256", encoder.encode(sessionSecret()))
      .then((hash) =>
        crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
      );
  }
  return keyPromise;
}

export async function seal(payload: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const key = await aesKey();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return `${b64url(iv)}.${b64url(new Uint8Array(cipher))}`;
}

export async function unseal<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const [ivPart, dataPart] = token.split(".");
  if (!ivPart || !dataPart) return null;
  try {
    const key = await aesKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64url(ivPart) as BufferSource },
      key,
      fromB64url(dataPart) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/* ----------------------------------------------------------------- cookies */

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

type CookieOptions = { maxAge?: number; secure: boolean; domain?: string };

export function bakeCookie(name: string, value: string, options: CookieOptions): string {
  const bits = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge !== undefined) bits.push(`Max-Age=${options.maxAge}`);
  if (options.domain) bits.push(`Domain=${options.domain}`);
  if (options.secure) bits.push("Secure");
  return bits.join("; ");
}

export function clearCookie(name: string, domain?: string): string {
  const scope = domain ? `; Domain=${domain}` : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${scope}`;
}

/** The base domain chats are served under, shared by client and server. */
export function configuredChatDomain(): string {
  const baked = import.meta.env["VITE_CHAT_DOMAIN"] as string | undefined;
  const fromEnv = process.env["CHAT_DOMAIN"] ?? process.env["VITE_CHAT_DOMAIN"] ?? baked ?? "";
  return fromEnv
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Share one Garmin session across a chat's subdomain and the apex.
 *
 * Cookies are host-bound by default, so a chat at <id>.example.com would ask
 * for a fresh Garmin sign-in. Scoping to the configured base domain fixes that;
 * without one (apex host, localhost, preview URLs) the cookie stays host-only,
 * so a random preview host can never set a cookie for a shared parent domain.
 */
export function cookieDomain(request: Request): string | undefined {
  const base = configuredChatDomain();
  if (!base) return undefined;

  const peeled = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = (peeled ?? new URL(request.url).host).split(",")[0]?.trim().toLowerCase() ?? "";
  const hostname = host.split(":")[0] ?? "";
  if (!hostname || hostname === "localhost" || hostname.includes(":")) return undefined;
  if (/^\d+(\.\d+){3}$/.test(hostname)) return undefined;
  if (hostname !== base && !hostname.endsWith(`.${base}`)) return undefined;
  return base;
}

export function requestOrigin(request: Request): string {
  const configured = process.env["PUBLIC_URL"] || process.env["APP_URL"];
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers });
}

export function jsonResponse(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

/* --------------------------------------------------------------- oauth 2.1 */

export type SessionPayload = {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  expiresAt: number;
};

export type PendingPayload = {
  state: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  createdAt: number;
};

type RegistrationResponse = {
  client_id?: unknown;
  client_secret?: unknown;
};

export async function registerClient(redirectUri: string): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const response = await fetch(`${gatewayBase()}/garmin/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      client_name: "Garmin Chat Studio",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    }),
  });
  if (!response.ok) {
    throw new Error(`Garmin gateway rejected client registration (${response.status}).`);
  }
  const body = (await response.json()) as RegistrationResponse;
  if (typeof body.client_id !== "string" || typeof body.client_secret !== "string") {
    throw new Error("Garmin gateway returned an incomplete client registration.");
  }
  return { clientId: body.client_id, clientSecret: body.client_secret };
}

export function authorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(`${gatewayBase()}/garmin/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export async function exchangeCode(options: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    // PKCE S256: the gateway recomputes the challenge from this verifier and
    // rejects the exchange with invalid_grant if it is missing or mismatched.
    code_verifier: options.codeVerifier,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    client_secret: options.clientSecret,
  });
  const response = await fetch(`${gatewayBase()}/garmin/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: body.toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || typeof payload.access_token !== "string") {
    const reason =
      payload.error === "invalid_grant"
        ? "That Garmin sign-in link was already used or expired. Connect again to get a fresh one."
        : typeof payload.error_description === "string"
          ? payload.error_description
          : typeof payload.error === "string"
            ? payload.error
            : `token exchange failed (${response.status})`;
    throw new Error(reason);
  }
  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
  };
}

export async function readSession(request: Request): Promise<SessionPayload | null> {
  const payload = await unseal<SessionPayload>(readCookie(request, SESSION_COOKIE));
  if (!payload?.accessToken) return null;
  // The stored expiry is a hint, not a gate: the gateway is the authority, and
  // rejecting early is what forced a fresh sign-in every hour. A real 401 from
  // the gateway clears the cookie instead.
  return payload;
}

export function statusFor(session: SessionPayload | null, available: number): GarminStatus {
  return {
    connected: !!session,
    configured: isConfigured(),
    tools: GARMIN_TOOL_ALLOWLIST.length,
    available,
  };
}

export function cachedToolCount(token: string | null | undefined): number {
  if (!token) return 0;
  return toolsCache.get(tokenKey(token))?.available ?? 0;
}

/* --------------------------------------------------------------------- mcp */

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
};

type McpReply = { message: JsonRpcMessage | null; sessionId: string | null };

function isRpcError(message: JsonRpcMessage | null): message is JsonRpcMessage & {
  error: { code?: number; message?: string };
} {
  return !!message && !!message.error;
}

function pickMessage(parsed: unknown, id: unknown): JsonRpcMessage | null {
  if (Array.isArray(parsed)) {
    const match = parsed.find(
      (entry) => entry && typeof entry === "object" && (entry as JsonRpcMessage).id === id,
    );
    if (match) return match as JsonRpcMessage;
    const first = parsed[0];
    return first && typeof first === "object" ? (first as JsonRpcMessage) : null;
  }
  return parsed && typeof parsed === "object" ? (parsed as JsonRpcMessage) : null;
}

async function readJsonRpc(response: Response, id: unknown): Promise<JsonRpcMessage | null> {
  const contentType = response.headers.get("content-type") ?? "";

  // Plain JSON answers arrive as one body; read them whole.
  if (contentType.includes("application/json") || !response.body) {
    const raw = await response.text();
    if (!raw.trim()) return null;
    try {
      return pickMessage(JSON.parse(raw), id);
    } catch {
      return null;
    }
  }

  // Streamable HTTP may answer with SSE frames and keep the stream open, so stop
  // as soon as the response with our id arrives instead of waiting for EOF.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fallback: JsonRpcMessage | null = null;
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8_000_000) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) continue;
        try {
          const parsed = pickMessage(JSON.parse(data), id);
          if (parsed && parsed.id === id) return parsed;
          if (parsed) fallback = parsed;
        } catch {
          // A keepalive or partial frame — keep reading.
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Already closed.
    }
    reader.releaseLock();
  }
  return fallback;
}

async function post(
  token: string,
  body: unknown,
  sessionId?: string | null,
): Promise<McpReply & { status: number }> {
  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
  });
  if (sessionId) headers.set("mcp-session-id", sessionId);

  const response = await fetch(`${gatewayBase()}/garmin/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const message = await readJsonRpc(response, (body as { id?: unknown }).id ?? null);
  return {
    message,
    sessionId: response.headers.get("mcp-session-id") ?? sessionId ?? null,
    status: response.status,
  };
}

const sessionCache = new Map<string, { id: string | null; at: number }>();

function tokenKey(token: string): string {
  // Not a security boundary — just a cache key that avoids logging the token.
  let hash = 0;
  for (let i = 0; i < token.length; i++) hash = (hash * 31 + token.charCodeAt(i)) | 0;
  return `t${hash}`;
}

async function initialize(token: string): Promise<string | null> {
  const key = tokenKey(token);
  const cached = sessionCache.get(key);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.id;

  const reply = await post(token, {
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "garmin-chat-studio", version: "1.0.0" },
    },
  });
  if (reply.status === 401) {
    throw new Error("Your Garmin session expired (401). Reconnect to continue.");
  }
  if (isRpcError(reply.message)) {
    throw new Error(reply.message.error.message ?? "Garmin MCP initialize failed.");
  }

  const sessionId = reply.sessionId;
  await post(token, { jsonrpc: "2.0", method: "notifications/initialized" }, sessionId).catch(
    () => undefined,
  );

  sessionCache.set(key, { id: sessionId, at: Date.now() });
  return sessionId;
}

function looksUninitialized(message: JsonRpcMessage | null): boolean {
  if (!isRpcError(message)) return false;
  const text = (message.error.message ?? "").toLowerCase();
  return /initial|session/.test(text) || message.error.code === -32002;
}

type ToolListResult = { tools?: unknown; nextCursor?: unknown };

function normalizeTool(raw: unknown): GarminTool | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record["name"] !== "string") return null;
  const schema = (record["inputSchema"] ?? record["parameters"] ?? {}) as JsonSchema;
  return {
    name: record["name"],
    description:
      typeof record["description"] === "string" ? record["description"].slice(0, 500) : "",
    parameters: schema,
  };
}

export async function fetchTools(
  token: string,
): Promise<{ tools: GarminTool[]; available: number }> {
  let sessionId = await initialize(token);
  const collected: GarminTool[] = [];
  let cursor: string | undefined;
  let available = 0;

  for (let page = 0; page < 4; page++) {
    const params: Record<string, unknown> = {};
    if (cursor) params["cursor"] = cursor;
    let reply = await post(
      token,
      { jsonrpc: "2.0", id: "tools", method: "tools/list", params },
      sessionId,
    );
    if (looksUninitialized(reply.message)) {
      sessionId = await initialize(token);
      reply = await post(
        token,
        { jsonrpc: "2.0", id: "tools", method: "tools/list", params },
        sessionId,
      );
    }
    if (reply.status === 401) {
      throw new Error("Your Garmin session expired (401). Reconnect to continue.");
    }
    if (isRpcError(reply.message)) {
      throw new Error(reply.message.error.message ?? "Could not list Garmin tools.");
    }
    const result = reply.message?.result as ToolListResult | undefined;
    const list: unknown[] = Array.isArray(result?.tools) ? result.tools : [];
    for (const raw of list) {
      available += 1;
      const tool = normalizeTool(raw);
      if (tool) collected.push(tool);
    }
    if (typeof result?.nextCursor !== "string" || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  const byName = new Map(collected.map((tool) => [tool.name, tool]));
  const tools = collected
    .filter((tool) => isAllowedTool(tool.name))
    .sort((a, b) => {
      // Keep the curated order first, then the extra read-only activity tools.
      const curated = GARMIN_TOOL_ALLOWLIST as readonly string[];
      const left = curated.indexOf(a.name);
      const right = curated.indexOf(b.name);
      if (left === -1 && right === -1) return a.name.localeCompare(b.name);
      if (left === -1) return 1;
      if (right === -1) return -1;
      return left - right;
    });
  return { tools, available: Math.max(available, collected.length) };
}

const toolsCache = new Map<string, { tools: GarminTool[]; available: number; at: number }>();

export async function getTools(
  token: string,
  useCache = true,
): Promise<{ tools: GarminTool[]; available: number }> {
  const key = tokenKey(token);
  const cached = toolsCache.get(key);
  if (useCache && cached && Date.now() - cached.at < 10 * 60_000) {
    return { tools: cached.tools, available: cached.available };
  }
  const fresh = await fetchTools(token);
  toolsCache.set(key, { ...fresh, at: Date.now() });
  return fresh;
}

type CallResult = { content?: unknown; isError?: unknown };

export async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  if (!isAllowedTool(name)) {
    throw new Error(`Tool "${name}" is not available in Garmin Chat Studio.`);
  }
  let sessionId = await initialize(token);
  let reply = await post(
    token,
    {
      jsonrpc: "2.0",
      id: "call",
      method: "tools/call",
      params: { name, arguments: args },
    },
    sessionId,
  );
  if (looksUninitialized(reply.message)) {
    sessionId = await initialize(token);
    reply = await post(
      token,
      {
        jsonrpc: "2.0",
        id: "call",
        method: "tools/call",
        params: { name, arguments: args },
      },
      sessionId,
    );
  }
  if (reply.status === 401) {
    throw new Error("Your Garmin session expired (401). Reconnect to continue.");
  }
  if (isRpcError(reply.message)) {
    throw new Error(reply.message.error.message ?? `Garmin tool "${name}" failed.`);
  }

  const result = reply.message?.result as CallResult | undefined;
  const content: unknown[] = Array.isArray(result?.content) ? result.content : [];
  const text = content
    .map((item) => {
      if (item && typeof item === "object" && "text" in item) {
        const value = (item as { text?: unknown }).text;
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  const isError = result?.isError === true;
  if (!text) {
    return {
      ok: !isError,
      isError,
      text: isError ? "The Garmin tool returned an error." : "No data returned.",
    };
  }

  // Keep tool payloads efficient on the wire and in the model context.
  const limit = 24_000;
  return {
    ok: !isError,
    isError,
    text: text.length > limit ? `${text.slice(0, limit)}\n\n…[truncated]` : text,
  };
}
