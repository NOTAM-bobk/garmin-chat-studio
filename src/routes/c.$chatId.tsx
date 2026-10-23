import { createFileRoute } from "@tanstack/react-router";

import { ChatApp } from "@/components/chat/ChatApp";
import { isChatSlug } from "@/lib/chat-url";

export const Route = createFileRoute("/c/$chatId")({
  head: () => ({
    meta: [
      { title: "Chat — Garmin Chat" },
      // Chats are personal links, not search results.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ChatPermalink,
});

function ChatPermalink() {
  const { chatId } = Route.useParams();
  return <ChatApp initialChatId={isChatSlug(chatId) ? chatId : null} />;
}
