import { createFileRoute } from "@tanstack/react-router";

import { UnderDevelopment } from "@/components/UnderDevelopment";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Garmin Chat" },
      { name: "description", content: "Garmin Chat dashboard — coming soon." },
      { property: "og:title", content: "Dashboard · Garmin Chat" },
      { property: "og:description", content: "Garmin Chat dashboard — coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <UnderDevelopment title="Dashboard" />,
});
