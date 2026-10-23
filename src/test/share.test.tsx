import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShareDialog } from "@/components/chat/ShareDialog";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

describe("ShareDialog", () => {
  it("shows the app link and copies it", async () => {
    render(<ShareDialog open onOpenChange={() => undefined} />);

    const input = screen.getByLabelText("Share link") as HTMLInputElement;
    expect(input.value).toBe(window.location.origin);

    fireEvent.click(screen.getByRole("button", { name: /Copy/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.origin));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("offers email and messaging links with the link embedded", () => {
    render(<ShareDialog open onOpenChange={() => undefined} />);

    const email = screen.getByRole("link", { name: /Email/ });
    expect(email.getAttribute("href")).toContain("mailto:");
    expect(decodeURIComponent(email.getAttribute("href") ?? "")).toContain(window.location.origin);

    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp.getAttribute("href")).toContain("https://wa.me/");
  });
});
