import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("garmin-chat:onboarded:v1", "1");
  localStorage.setItem(
    "garmin-chat:threads:v2",
    JSON.stringify([
      {
        id: "chart-chat",
        title: "Sleep trend",
        updated: Date.now(),
        messages: [
          { id: "u1", role: "user", content: "Chart my sleep", steps: [] },
          {
            id: "a1",
            role: "assistant",
            content:
              'Sleep is trending up.\n\n```chart\n{"type":"bar","title":"Sleep score","unit":"score","x":["Mon","Tue","Wed"],"series":[{"name":"Score","data":[72,80,84]}],"target":80,"targetLabel":"Goal 80"}\n```',
            steps: [],
          },
        ],
      },
    ]),
  );
});

describe("chart blocks", () => {
  it("renders a chart instead of raw JSON", async () => {
    render(<ChatApp />);
    fireEvent.click(await screen.findByText("Sleep trend"));

    expect(await screen.findByText("Sleep score")).toBeInTheDocument();
    expect(screen.queryByText(/"type":"bar"/)).not.toBeInTheDocument();
  });

  it("shows the latest reading and its move without hovering", async () => {
    render(<ChatApp />);
    fireEvent.click(await screen.findByText("Sleep trend"));

    expect(await screen.findByText("84 score")).toBeInTheDocument();
    expect(await screen.findByText(/since Mon/)).toBeInTheDocument();
  });
});
