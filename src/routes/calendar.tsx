import { createFileRoute } from "@tanstack/react-router";

import { UnderDevelopment } from "@/components/UnderDevelopment";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Workout Calendar · Garmin Chat" },
      { name: "description", content: "Garmin Chat workout calendar — coming soon." },
      { property: "og:title", content: "Workout Calendar · Garmin Chat" },
      { property: "og:description", content: "Garmin Chat workout calendar — coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <UnderDevelopment title="Workout calendar" />,
});
