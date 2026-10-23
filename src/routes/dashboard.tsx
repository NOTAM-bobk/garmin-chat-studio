import { createFileRoute } from "@tanstack/react-router";

import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Garmin Chat" },
      { name: "description", content: "Customizable dashboard for readiness, sleep, HRV, load and more." },
      { property: "og:title", content: "Dashboard · Garmin Chat" },
      { property: "og:description", content: "Customizable dashboard for readiness, sleep, HRV, load and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
