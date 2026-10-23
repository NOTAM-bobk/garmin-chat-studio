import { createFileRoute } from "@tanstack/react-router";

import { ChatApp } from "@/components/chat/ChatApp";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/seo";

const TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: siteUrl("/") }],
  }),
  component: ChatApp,
});
