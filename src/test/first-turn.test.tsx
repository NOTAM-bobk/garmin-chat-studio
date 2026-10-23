import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatApp } from "@/components/chat/ChatApp";

function streamOf(parts: string[]) {
  return (async function* () {
    for (const part of parts) {
      yield { type: "text", text: part };
    }
  })();
}

function emptyStream() {
  return (async function* () {
    // A provider that closes the stream after reasoning alone.
  })();
}

function installPuter(chat: (call: number) => unknown) {
  const calls = { count: 0 };
  const spy = vi.fn(async () => {
    calls.count += 1;
    return chat(calls.count);
  });
  (window as unknown as { puter: unknown }).puter = {
    ai: { chat: spy, listModels: async () => [] },
    auth: {
      isSignedIn: () => true,
      signIn: async () => ({}),
      signOut: async () => ({}),
      getUser: async () => ({ username: "sam", is_temp: false }),
    },
    kv: { get: async () => null, set: async () => true },
  };
  return calls;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("garmin-chat:onboarded:v1", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/garmin/status")) {
        return new Response(
          JSON.stringify({ connected: false, configured: true, tools: 0, available: 0 }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function ask(question: string) {
  render(<ChatApp />);
  const box = await screen.findByLabelText(/Ask/);
  fireEvent.change(box, { target: { value: question } });
  fireEvent.keyDown(box, { key: "Enter" });
}

describe("the first message of a chat", () => {
  it("streams the answer and stops the thinking heading when the turn ends", async () => {
    installPuter(() => streamOf(["Sleep ", "averaged 7h 12m."]));
    await ask("How did I sleep?");

    await waitFor(() => expect(document.body.textContent).toContain("Sleep averaged 7h 12m."), {
      timeout: 3000,
    });

    // The trace must not keep saying it is thinking once the answer is in.
    await waitFor(() => expect(screen.queryByText("Thinking…")).not.toBeInTheDocument());
  });

  it("asks again instead of stopping when a round returns no words", async () => {
    const calls = installPuter((call) =>
      call === 1 ? emptyStream() : streamOf(["Your sleep held at seven hours."]),
    );
    await ask("How did I sleep?");

    await waitFor(
      () => expect(document.body.textContent).toContain("Your sleep held at seven hours."),
      { timeout: 3000 },
    );
    expect(calls.count).toBeGreaterThan(1);
    expect(screen.getByText("Writing the answer")).toBeInTheDocument();
  });

  it("saves the new thread with both messages", async () => {
    installPuter(() => streamOf(["Seven hours."]));
    await ask("How did I sleep?");

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("garmin-chat:threads:v2") ?? "[]") as {
        messages: { role: string; content: string }[];
      }[];
      const chat = stored[0];
      expect(chat?.messages[0]).toMatchObject({ role: "user", content: "How did I sleep?" });
      expect(chat?.messages[1]?.content).toBe("Seven hours.");
    });
  });
});
