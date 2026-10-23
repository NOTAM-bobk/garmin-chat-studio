import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

describe("chat permalinks", () => {
  it("points the address bar at the open chat", async () => {
    localStorage.setItem("garmin-chat:onboarded:v1", "1");
    localStorage.setItem(
      "garmin-chat:threads:v2",
      JSON.stringify([
        {
          id: "a1b2c3d4",
          title: "Sleep this week",
          updated: Date.now(),
          messages: [
            { id: "m1", role: "user", content: "How did I sleep?", steps: [] },
            { id: "m2", role: "assistant", content: "Seven hours a night.", steps: [] },
          ],
        },
      ]),
    );

    render(<ChatApp />);

    fireEvent.click(await screen.findByText("Sleep this week"));

    await waitFor(() => expect(window.location.pathname).toBe("/c/a1b2c3d4"));
  });
});
