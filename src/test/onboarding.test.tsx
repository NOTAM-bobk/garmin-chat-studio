import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingDialog } from "@/components/chat/OnboardingDialog";

function renderDialog(overrides: {
  connected?: boolean;
  onConnect?: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  return render(
    <OnboardingDialog
      open
      onOpenChange={overrides.onOpenChange ?? vi.fn()}
      connected={overrides.connected ?? false}
      configured
      tools={0}
      onConnect={overrides.onConnect ?? vi.fn()}
    />,
  );
}

describe("OnboardingDialog", () => {
  it("walks the slides and offers the connect action last", () => {
    const onConnect = vi.fn();
    renderDialog({ onConnect });

    expect(screen.getByText("Welcome to Garmin Chat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Watch it think")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Charts, plans and memory")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Connect when you're ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Connect Garmin/ }));
    expect(onConnect).toHaveBeenCalled();
  });

  it("lets a connected user start chatting", () => {
    const onOpenChange = vi.fn();
    renderDialog({ connected: true, onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: "Step 4: Connect when you're ready" }));
    fireEvent.click(screen.getByRole("button", { name: /Start chatting/ }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("skips out without connecting", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
