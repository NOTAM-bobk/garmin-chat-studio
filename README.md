# Garmin Chat
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/NOTAM-bobk/garmin-chat-studio)

A ChatGPT-style training analyst with live, read-only access to your Garmin Connect data. This application communicates with a hosted [MissingMCP Garmin server](https://missingmcp.com/garmin), displays the AI's reasoning and tool usage in real-time, and securely manages your Garmin token on the server.

- **Garmin in the Chat**: Access and discuss your sleep data, HRV, Body Battery, training readiness, activities, training load, and workouts directly within the chat interface.
- **Visible Work**: The AI's reasoning streams in as faint inline text, and every Garmin tool it utilizes is listed by name (e.g., `get_sleep_summary_range`) with live status and timing, providing full transparency into its process.
- **Charts on Request**: The assistant can generate line, bar, area, or pie charts by emitting a validated `chart` block. Charts are rendered using Recharts from the data retrieved during the conversation.
- **Tone Presets**: Choose from different conversational styles like Coach, Analyst, Explain, and Straight Talk. Your preference is saved in your browser.
- **Model Picker**: Select from a curated list of AI models, with access to Puter's full catalog via `puter.ai.listModels()`. Standard actions like copy, regenerate, and feedback are available for every response.
- **No AI Key Required**: Powered by [Puter.js](https://developer.puter.com), the application uses temporary guest sessions for AI inference, so you can start chatting without needing to sign in or provide an API key.
- **Server-Held Token**: Your OAuth access token is encrypted with AES-256-GCM and stored in an `httpOnly` cookie. It is never exposed to client-side JavaScript, and all Garmin API calls are proxied through the application's backend.

## How the Garmin Connection Works

The application uses the open-source [VelkyVenik/missingmcp](https://github.com/VelkyVenik/missingmcp) proxy, which is built on [Taxuspt/garmin_mcp](https://github.com/Taxuspt/garmin_mcp), to handle authentication and data access.

1.  `GET /api/garmin/connect`: The app registers a client with the gateway, creates a PKCE verifier/challenge, and redirects you to the MissingMCP sign-in page.
2.  You sign in with your Garmin email and password on `missingmcp.com`. The gateway handles your credentials and supports MFA; your password is never shared with this application.
3.  `GET /api/garmin/callback`: The app exchanges the authorization code for a bearer token at the gateway's token endpoint and stores it in an encrypted, `httpOnly` cookie.
4.  `/api/garmin/tools` and `/api/garmin/call`: Subsequent requests to list and execute tools are proxied through the app's backend. Only a curated, read-first allowlist of Garmin tools can be invoked to ensure security and data privacy.

## Environment Variables

For production deployments, one secret is required. Add the following in your hosting provider's environment variable settings (e.g., Vercel → Project → Settings → Environment Variables) and redeploy.

| Variable | Required | Value |
| :--- | :--- | :--- |
| `SESSION_SECRET` | **Yes** | 32+ random characters to encrypt the Garmin session cookie. Generate one with `openssl rand -base64 48`. Connecting is disabled in production without it. |
| `PUBLIC_URL` | Recommended | The canonical origin of your deployment, e.g., `https://garmin-chat-studio.vercel.app`. Used to build the OAuth callback URL. Defaults to the request's forwarded host. |
| `MISSINGMCP_BASE_URL` | No | Defaults to `https://missingmcp.com`. Change this if you are self-hosting the MissingMCP gateway. |

There is **no Garmin API key, client secret, or OpenAI key to set**. Authentication is handled via per-user OAuth, and AI model calls use Puter's guest session.

## Development

To run the application locally, follow these steps:

1.  Install dependencies:
    ```sh
    bun install
    ```
2.  Start the development server:
    ```sh
    bun run dev
    ```
    The dev server runs the full TanStack Start application, so the `/api/garmin/*` routes work locally. A fallback `SESSION_SECRET` is used for development.

3.  Run tests and type-checking:
    ```sh
    bun run test
    bunx tsc -b --noEmit
    ```

## Notes

-   Tool schemas are fetched once per session and cached for 10 minutes. The assistant uses a curated set of 38 tools by default to ensure fast and relevant responses, with the ability to discover more from the full catalog of over 150 tools as needed.
-   Garmin data is fetched on demand and is not stored by this application. Chat history is saved only in your browser's `localStorage`.
-   This application provides training guidance and is not a substitute for medical advice.
