import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsDialog } from "@/components/chat/SettingsDialog";
import type { CustomMode } from "@/lib/modes";

type Overrides = {
  modes?: CustomMode[];
  onCreateMode?: (name: string, instruction: string) => void;
  onDeleteMode?: (id: string) => void;
  onToneChange?: (tone: string) => void;
  onNotificationsChange?: (enabled: boolean) => void;
};

function renderSettings(overrides: Overrides = {}) {
  return render(
    <SettingsDialog
      open
      onOpenChange={vi.fn()}
      models={[{ id: "gpt-5.6", label: "GPT-5.6" }]}
      model="gpt-5.6"
      onModelChange={vi.fn()}
      tone="coach"
      onToneChange={overrides.onToneChange ?? vi.fn()}
      connected={false}
      configured
      tools={0}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      haptics
      onHapticsChange={vi.fn()}
      notificationsEnabled={false}
      onNotificationsChange={overrides.onNotificationsChange ?? vi.fn()}
      notificationSupported
      notificationPermission="default"
      onHapticTest={vi.fn()}
      chatCount={0}
      onClearChats={vi.fn()}
      memories={[]}
      onForgetMemory={vi.fn()}
      account={null}
      syncState="idle"
      onSignIn={vi.fn()}
      onSignOut={vi.fn()}
      modes={overrides.modes ?? []}
      onCreateMode={overrides.onCreateMode ?? vi.fn()}
      onDeleteMode={overrides.onDeleteMode ?? vi.fn()}
    />,
  );
}

describe("custom modes in settings", () => {
  it("offers opt-in browser reply notifications", () => {
    const onNotificationsChange = vi.fn();
    renderSettings({ onNotificationsChange });

    fireEvent.click(screen.getByRole("switch", { name: "Reply notifications" }));

    expect(onNotificationsChange).toHaveBeenCalledWith(true);
    expect(
      screen.getByText(/cannot send alerts after it is closed or provide scheduled Garmin updates/),
    ).toBeInTheDocument();
  });

  it("saves a new mode from the form", () => {
    const onCreateMode = vi.fn();
    renderSettings({ onCreateMode });

    fireEvent.change(screen.getByPlaceholderText(/Name — e.g. Race-week coach/), {
      target: { value: "Physio" },
    });
    fireEvent.change(screen.getByLabelText("How the mode should answer"), {
      target: { value: "Answer like a sports physio, short and practical." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save mode" }));

    expect(onCreateMode).toHaveBeenCalledWith(
      "Physio",
      "Answer like a sports physio, short and practical.",
    );
  });

  it("won't save an empty mode", () => {
    const onCreateMode = vi.fn();
    renderSettings({ onCreateMode });

    const save = screen.getByRole("button", { name: "Save mode" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(onCreateMode).not.toHaveBeenCalled();
  });

  it("selects and deletes a saved mode", () => {
    const onToneChange = vi.fn();
    const onDeleteMode = vi.fn();
    renderSettings({
      modes: [{ id: "abc123", name: "Physio", instruction: "Short answers.", created: 1 }],
      onToneChange,
      onDeleteMode,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Physio/ }));
    expect(onToneChange).toHaveBeenCalledWith("custom:abc123");

    fireEvent.click(screen.getByRole("button", { name: "Delete Physio" }));
    expect(onDeleteMode).toHaveBeenCalledWith("abc123");
  });
});
