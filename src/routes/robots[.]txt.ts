import { createFileRoute } from "@tanstack/react-router";

import { requestBase } from "@/lib/seo";

const ALLOWED_BOTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-Web",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

function renderRobots(base: string): string {
  const rules = ALLOWED_BOTS.map((bot) => `User-agent: ${bot}\nAllow: /\n`).join("\n");
  return `${rules}
User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(renderRobots(requestBase(request)), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=3600",
          },
        }),
    },
  },
});
