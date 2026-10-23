import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("garmin-chat:onboarded:v1", "1");
});

describe("empty-state presets", () => {
  it("shows a different set of four on each load", async () => {
    const first = render(<ChatApp />);
    expect(await screen.findByRole("button", { name: "Sleep debrief" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan the week" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HRV trend" })).not.toBeInTheDocument();
    first.unmount();

    render(<ChatApp />);
    expect(await screen.findByRole("button", { name: "HRV trend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Long run check" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sleep debrief" })).not.toBeInTheDocument();
  });
});
