import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

const KEY = "garmin-chat:threads:v2";

function seed() {
  localStorage.setItem("garmin-chat:onboarded:v1", "1");
  localStorage.setItem(
    KEY,
    JSON.stringify([
      {
        id: "chat-1",
        title: "Sleep this week",
        updated: Date.now(),
        messages: [
          { id: "m1", role: "user", content: "How did I sleep?", steps: [] },
          {
            id: "m2",
            role: "assistant",
            content: "Sleep averaged 7h 12m.",
            steps: [],
            followups: ["Which night was worst?", "Compare with last week"],
          },
        ],
      },
    ]),
  );
}

describe("follow-up suggestions", () => {
  it("renders two tappable follow-ups under the latest answer", async () => {
    seed();
    render(<ChatApp />);

    fireEvent.click(await screen.findByText("Sleep this week"));

    expect(await screen.findByText("Follow-ups")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Which night was worst?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare with last week" })).toBeInTheDocument();
  });
});
