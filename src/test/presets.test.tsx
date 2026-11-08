import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("garmin-chat:onboarded:v1", "1");
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it("deals a new set of prompts from the shuffle button", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<ChatApp />);

    expect(await screen.findByRole("button", { name: "Sleep debrief" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Shuffle suggestions" }));

    expect(await screen.findByRole("button", { name: "HRV trend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Long run check" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sleep debrief" })).not.toBeInTheDocument();
  });

  it("offers both connection options instead of jumping to the MCP sign-in", async () => {
    render(<ChatApp />);

    const [connect] = await screen.findAllByRole("button", { name: /Connect Garmin/ });
    fireEvent.click(connect!);

    expect(
      await screen.findByRole("button", { name: /Connect with Garmin MCP/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Use a personal API key/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("keeps one Garmin connect button outside the sidebar", async () => {
    render(<ChatApp />);

    expect(await screen.findByRole("button", { name: "Search this site" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Chat" })).toBeInTheDocument();
    expect(document.querySelector(".lucide-panel-left")).toBeTruthy();

    const apps = screen.getByText("Apps").parentElement!;
    expect(within(apps).getByRole("link", { name: "Workout calendar" })).toBeInTheDocument();
    expect(within(apps).getByRole("button", { name: /Morning report/ })).toBeDisabled();

    const connect = screen.getAllByRole("button", { name: /Connect Garmin/ });
    expect(connect).toHaveLength(1);
    expect(connect[0]!.className).toContain("bg-[#0d0d0f]");

    fireEvent.click(screen.getByRole("button", { name: "Search this site" }));
    expect(await screen.findByLabelText("Search query")).toBeInTheDocument();
  });

  it("links to the upgrade screen and credits the builder", async () => {
    render(<ChatApp />);

    const upgrade = await screen.findByRole("link", { name: /Upgrade/ });
    expect(upgrade.getAttribute("href")).toBe("/upgrade");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByText(/Built by Sawyer Schulz/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.1\.0/)).toBeInTheDocument();
  });
});
