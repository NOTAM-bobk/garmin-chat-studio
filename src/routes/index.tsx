import { createFileRoute } from "@tanstack/react-router";

import { ChatApp } from "@/components/chat/ChatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Garmin Studio — your training, in conversation" },
      {
        name: "description",
        content:
          "Read your Garmin sleep, recovery and training data in a clean chat. Every tool call and thought is shown as it happens.",
      },
      { property: "og:title", content: "Garmin Studio — your training, in conversation" },
      {
        property: "og:description",
        content:
          "Read your Garmin sleep, recovery and training data in a clean chat. Every tool call and thought is shown as it happens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatApp,
});
