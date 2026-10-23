import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectDialog } from "@/components/chat/ConnectDialog";

function setup(
  overrides: { configured?: boolean; onMcp?: () => void; onConnected?: () => void } = {},
) {
  const onMcp = overrides.onMcp ?? vi.fn();
  const onConnected = overrides.onConnected ?? vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConnectDialog
      open
      onOpenChange={onOpenChange}
      configured={overrides.configured ?? true}
      onMcp={onMcp}
      onConnected={onConnected}
    />,
  );
  return { onMcp, onConnected, onOpenChange };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConnectDialog", () => {
  it("offers the gateway and a personal key, and sends the gateway choice onward", () => {
    const { onMcp } = setup();

    expect(screen.getByText("Connect with Garmin MCP")).toBeInTheDocument();
    expect(screen.getByText("Use a personal API key")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Connect with Garmin MCP/ }));
    expect(onMcp).toHaveBeenCalled();
  });

  it("explains the key steps before asking for the key", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Use a personal API key/ }));

    expect(
      screen.getByText(/Open Garmin Connect → Settings → Personal API Key/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose 1 year as the expiration/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your personal key")).toBeInTheDocument();
  });

  it("keeps the connect button disabled until a key is pasted", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Use a personal API key/ }));

    const submit = screen.getByRole("button", { name: "Connect with key" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Your personal key"), { target: { value: "abc123" } });
    expect(submit).toBeEnabled();
  });

  it("posts the key and reports success", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, tools: 16 }));
    vi.stubGlobal("fetch", fetchMock);
    const { onConnected } = setup();

    fireEvent.click(screen.getByRole("button", { name: /Use a personal API key/ }));
    fireEvent.change(screen.getByLabelText("Your personal key"), {
      target: { value: "  key-123  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect with key" }));

    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/garmin/key");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ key: "key-123" });
  });

  it("submits on Enter and shows the server's rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Garmin rejected that key." }, 400)),
    );
    const { onConnected } = setup();

    fireEvent.click(screen.getByRole("button", { name: /Use a personal API key/ }));
    const input = screen.getByLabelText("Your personal key");
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Garmin rejected that key.")).toBeInTheDocument();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("disables the gateway option when the deployment has no SESSION_SECRET", () => {
    setup({ configured: false });

    expect(screen.getByRole("button", { name: /Connect with Garmin MCP/ })).toBeDisabled();
    expect(screen.getByText(/missing SESSION_SECRET/)).toBeInTheDocument();
  });

  it("closes from the key panel without connecting", () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Use a personal API key/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
