import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

const CHATS = "garmin-chat:threads:v2";

function seedAnswer(answer: string) {
  localStorage.setItem("garmin-chat:onboarded:v1", "1");
  localStorage.setItem(
    CHATS,
    JSON.stringify([
      {
        id: "cite1234",
        title: "Zone 2 research",
        updated: Date.now(),
        messages: [
          { id: "m1", role: "user", content: "Is 80/20 training real?", steps: [] },
          { id: "m2", role: "assistant", content: answer, steps: [] },
        ],
      },
    ]),
  );
}

describe("web citations", () => {
  it("renders a cited domain as an inline source pill", async () => {
    seedAnswer(
      "Polarised training raised aerobic gains [pubmed.ncbi.nlm.nih.gov](https://pubmed.ncbi.nlm.nih.gov/26928661/).",
    );
    render(<ChatApp />);

    fireEvent.click(await screen.findByText("Zone 2 research"));

    const chip = document.querySelector(".citation-chip");
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toBe("pubmed.ncbi.nlm.nih.gov");
    expect(chip?.getAttribute("href")).toBe("https://pubmed.ncbi.nlm.nih.gov/26928661/");
  });

  it("leaves ordinary links alone", async () => {
    seedAnswer("Read the [full guide](https://example.com/guide) if you want the long version.");
    render(<ChatApp />);

    fireEvent.click(await screen.findByText("Zone 2 research"));

    expect(document.querySelector(".citation-chip")).toBeNull();
    expect(document.querySelector('a[href="https://example.com/guide"]')).not.toBeNull();
  });
});
