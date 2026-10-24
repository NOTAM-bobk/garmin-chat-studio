import { createFileRoute } from "@tanstack/react-router";

import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Garmin Chat" },
      {
        name: "description",
        content:
          "An AI-designed Garmin dashboard: readiness, sleep, HRV, load and the readings worth watching today.",
      },
      { property: "og:title", content: "Dashboard · Garmin Chat" },
      {
        property: "og:description",
        content:
          "An AI-designed Garmin dashboard: readiness, sleep, HRV, load and the readings worth watching today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
