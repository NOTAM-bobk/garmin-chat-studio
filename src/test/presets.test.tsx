import { fireEvent, render, screen } from "@testing-library/react";
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
    // Only three fit on a phone: the fourth pill is desktop-only.
    expect(screen.getByRole("button", { name: "Plan the week" }).className).toContain("hidden");
    first.unmount();

    render(<ChatApp />);
    expect(await screen.findByRole("button", { name: "HRV trend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Long run check" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sleep debrief" })).not.toBeInTheDocument();
  });

  it("opens search and uses the panel icon and glow connect button", async () => {
    render(<ChatApp />);

    expect(await screen.findByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(document.querySelector(".lucide-panel-left")).toBeTruthy();

    const connect = screen.getAllByRole("button", { name: /Connect Garmin/ });
    expect(connect.some((button) => button.className.includes("bg-[#0d0d0f]"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByLabelText("Search query")).toBeInTheDocument();
  });

  it("links to the upgrade screen and credits the builder", async () => {
    render(<ChatApp />);

    const upgrade = await screen.findByRole("link", { name: /Upgrade/ });
    expect(upgrade.getAttribute("href")).toBe("/upgrade");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByText(/Built by Sawyer Schulz/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
  });
});
