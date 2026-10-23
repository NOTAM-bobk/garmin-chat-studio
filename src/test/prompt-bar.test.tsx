import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Activity, Moon, Zap } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import PromptBar from "@/components/chat/PromptBar";
import type { ToneId } from "@/lib/models";

const quickPrompts = [
  { icon: Moon, title: "Sleep debrief", prompt: "How did I sleep this week?" },
  { icon: Zap, title: "Readiness check", prompt: "Why is my readiness low?" },
  { icon: Activity, title: "Compare runs", prompt: "Compare my last runs." },
];

function Harness({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [tone, setTone] = useState<ToneId>("coach");
  return (
    <>
      <PromptBar
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        onStop={() => undefined}
        busy={false}
        tone={tone}
        onToneChange={setTone}
        quickPrompts={quickPrompts}
      />
      <p data-testid="tone">{tone}</p>
    </>
  );
}

describe("PromptBar", () => {
  it("submits typed text with Enter and clears nothing on its own", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Ask about your training");
    fireEvent.change(textarea, { target: { value: "How is my load?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith("How is my load?");
  });

  it("fills the field from the quick prompt menu", () => {
    render(<Harness onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Quick prompts"));
    fireEvent.click(screen.getByRole("option", { name: "Sleep debrief" }));

    expect((screen.getByLabelText("Ask about your training") as HTMLTextAreaElement).value).toBe(
      "How did I sleep this week?",
    );
  });

  it("switches tone from the mode pill", () => {
    render(<Harness onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Coach/ }));
    fireEvent.click(screen.getByRole("option", { name: "Analyst" }));

    expect(screen.getByTestId("tone").textContent).toBe("analyst");
  });
});
