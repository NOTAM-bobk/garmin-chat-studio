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
      {
        id: "compare-chat",
        title: "Sleep vs load",
        updated: Date.now() - 1000,
        messages: [
          { id: "u2", role: "user", content: "Sleep against load", steps: [] },
          {
            id: "a2",
            role: "assistant",
            content:
              'Here they are together.\n\n```chart\n{"type":"line","title":"Sleep vs load","x":["Mon","Tue","Wed"],"series":[{"name":"Sleep score","data":[72,80,84]},{"name":"Load","data":[300,420,380],"axis":"right"}],"xLabel":"Night","yLabel":"Score"}\n```',
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

  it("lets a legend entry turn a series off and back on", async () => {
    render(<ChatApp />);
    fireEvent.click(await screen.findByText("Sleep vs load"));

    const hide = await screen.findByRole("button", { name: "Hide Sleep score" });
    fireEvent.click(hide);

    const show = screen.getByRole("button", { name: "Show Sleep score" });
    expect(show).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(show);
    expect(screen.getByRole("button", { name: "Hide Sleep score" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("refuses to hide the last series on screen", async () => {
    render(<ChatApp />);
    fireEvent.click(await screen.findByText("Sleep vs load"));

    fireEvent.click(await screen.findByRole("button", { name: "Hide Load" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Sleep score" }));

    // One series always stays visible, so the plot never goes blank.
    expect(screen.getByRole("button", { name: "Hide Sleep score" })).toBeInTheDocument();
  });

  it("shows the latest reading and its move without hovering", async () => {
    render(<ChatApp />);
    fireEvent.click(await screen.findByText("Sleep trend"));

    expect(await screen.findByText("84 score")).toBeInTheDocument();
    expect(await screen.findByText(/since Mon/)).toBeInTheDocument();
  });
});
