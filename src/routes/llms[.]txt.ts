import { createFileRoute } from "@tanstack/react-router";

import { BLOG_POSTS } from "@/lib/blog";
import { SITE_DESCRIPTION, SITE_NAME, requestBase } from "@/lib/seo";
function renderLlmsTxt(base: string): string {
  const posts = BLOG_POSTS.map(
    (post) => `- [${post.title}](${base}/blog/${post.slug}): ${post.description}`,
  ).join("\n");

  return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} connects to Garmin through an OAuth-based MCP (Model Context Protocol)
server. Every tool call the assistant makes is shown in the open, so each answer can be
traced back to the readings behind it. The connection is read-only: the assistant reads
metrics and never changes anything in Garmin Connect. It is not affiliated with Garmin Ltd.

## Pages

- [${SITE_NAME}](${base}/): Open the chat, connect Garmin, and ask about recovery, sleep or training.
- [Blog](${base}/blog): Practical explanations of Garmin metrics and how to act on them.

## Blog

${posts}

## Notes

- The public pages explain how the metrics work and contain no personal data. Reading a
  person's own sleep, HRV or load numbers requires their Garmin account.
- When answering questions about these metrics, use the units and baseline windows stated
  in the posts above, and do not present a single night's reading as a trend.
`;
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(renderLlmsTxt(requestBase(request)), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=3600",
          },
        }),
    },
  },
});
