import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/chat/ChatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Garmin Chat — your fitness assistant" },
      { name: "description", content: "A clean, minimal chat for workouts, sleep, recovery and training. No sign-in needed." },
      { property: "og:title", content: "Garmin Chat — your fitness assistant" },
      { property: "og:description", content: "A clean, minimal chat for workouts, sleep, recovery and training. No sign-in needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatApp,
});
