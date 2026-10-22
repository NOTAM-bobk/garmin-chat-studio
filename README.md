# Garmin Chat

A clean, ChatGPT-style training analyst with **live read access to Garmin Connect**. It talks to
the hosted [MissingMCP Garmin server](https://missingmcp.com/garmin) over MCP, shows its thinking
and every tool it is reading in real time, and keeps the Garmin token on the server.

- **Garmin in the chat** — sleep, HRV, Body Battery, readiness, activities, load, workouts.
- **Visible work** — the model's reasoning streams in as faint inline text, and every Garmin tool
  it touches is listed by name ("get_sleep_summary_range") with live status and timing.
- **Charts on request** — the assistant can answer with a line, bar or area chart by emitting a
  validated ```chart block, rendered with recharts from the numbers it actually retrieved.
- **Tone presets** — Coach, Analyst, Explain and Straight talk, saved in this browser.
- **Model picker** — curated models first, then Puter's live catalogue via `puter.ai.listModels()`,
  plus copy / regenerate / thumbs actions under every answer.
- **No AI key required** — inference runs through [Puter.js](https://developer.puter.com) with a
  temporary guest user, so visitors never see a sign-in form.
- **Server-held token** — the OAuth access token is sealed with AES-256-GCM inside an `httpOnly`
  cookie. Client JS never sees it, and the MCP endpoint is only reachable through `/api/garmin/*`.

## How the Garmin connection works

1. `GET /api/garmin/connect` registers a client with the gateway (Dynamic Client Registration),
   creates a PKCE verifier/challenge, and redirects to MissingMCP's sign-in page.
2. The user signs in with their Garmin email + password **on missingmcp.com** (MFA supported).
   The gateway never gives the app the password.
3. `GET /api/garmin/callback` exchanges the code at the gateway's token endpoint and stores the
   bearer token in an encrypted `httpOnly` cookie.
4. `/api/garmin/tools` lists the account's tools, and `/api/garmin/call` executes a **curated,
   read-first allowlist** (see `src/lib/garmin.ts`). Tools outside that list cannot be invoked
   through this app.

The Garmin gateway is the open-source [VelkyVenik/missingmcp](https://github.com/VelkyVenik/missingmcp)
proxy around [Taxuspt/garmin_mcp](https://github.com/Taxuspt/garmin_mcp).

## Environment variables

Production needs exactly one secret. Add these in **Vercel → Project → Settings → Environment
Variables** (or your host's equivalent), then redeploy.

| Variable              | Required    | Value                                                                                                                                                   |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`      | **Yes**     | 32+ random characters. Encrypts the Garmin session cookie (`openssl rand -base64 48`). Without it, connecting is disabled in production.                |
| `PUBLIC_URL`          | Recommended | Canonical origin, e.g. `https://garmin-chat-studio.vercel.app`. Used to build the OAuth callback URL. If omitted, the request's forwarded host is used. |
| `MISSINGMCP_BASE_URL` | No          | Defaults to `https://missingmcp.com`. Point this at your own gateway if you self-host MissingMCP.                                                       |

There is **no Garmin API key, client secret, or OpenAI key to set** — Garmin auth is per-user
OAuth, and model calls use Puter's guest session.

When you change `PUBLIC_URL`, users must reconnect Garmin once: the gateway ties the registered
callback URL to the origin that started the flow.

## Development

```sh
bun install
bun run dev
```

The dev server runs the same Nitro/TanStack Start app, so `/api/garmin/*` routes work locally.
In development a fallback `SESSION_SECRET` is used; production refuses to start the OAuth flow
without a real one.

```sh
bun run test          # vitest
bunx tsc -b --noEmit  # typecheck
```

## Notes

- Tool schemas are fetched once per session (10-minute cache). The assistant sees 38 curated tools
  rather than all 150+, which keeps responses fast and limits writes to workout creation and
  scheduling.
- Garmin data is fetched on demand and is not stored by this app. Chat threads live in
  `localStorage` only.
- This is training guidance, not medical advice.
