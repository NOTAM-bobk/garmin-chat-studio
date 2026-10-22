import { createFileRoute } from "@tanstack/react-router";

import { ChatApp } from "@/components/chat/ChatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Garmin Chat" },
      {
        name: "description",
        content:
          "Chat with your Garmin data — sleep, recovery, load and workouts, with every lookup shown as it happens.",
      },
      { property: "og:title", content: "Garmin Chat" },
      {
        property: "og:description",
        content:
          "Chat with your Garmin data — sleep, recovery, load and workouts, with every lookup shown as it happens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatApp,
});
