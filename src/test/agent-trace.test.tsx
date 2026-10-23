import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentTrace } from "@/components/chat/AgentTrace";
import type { TraceStep } from "@/lib/chat";

const done: TraceStep[] = [
  { id: "s1", kind: "thinking", label: "Reading your question", status: "done", ms: 900 },
  {
    id: "s2",
    kind: "tool",
    label: "Reading sleep data",
    tool: "get_sleep",
    status: "done",
    ms: 400,
    preview: "12 KB · loaded",
  },
  {
    id: "s3",
    kind: "thinking",
    label: "Reviewing your data",
    status: "done",
    ms: 600,
    text: "Sleep was shorter on the hard days.",
  },
];

describe("AgentTrace", () => {
  it("renders finished steps as a checklist with a total time", () => {
    render(<AgentTrace steps={done} running={false} />);

    expect(screen.getByText("Thought for 1.9s")).toBeInTheDocument();
    expect(screen.getByText("Reading sleep data")).toBeInTheDocument();
    expect(screen.getByText("12 KB · loaded")).toBeInTheDocument();
    expect(screen.queryByText("Sleep was shorter on the hard days.")).not.toBeInTheDocument();
  });

  it("keeps the reasoning behind a toggle", () => {
    render(<AgentTrace steps={done} running={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show reasoning" }));
    expect(screen.getByText("Sleep was shorter on the hard days.")).toBeInTheDocument();
  });

  it("marks the active step while running", () => {
    const running: TraceStep[] = [
      { id: "s1", kind: "thinking", label: "Reading your question", status: "done", ms: 400 },
      { id: "s2", kind: "tool", label: "Reading sleep data", status: "active" },
    ];
    render(<AgentTrace steps={running} running />);

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show reasoning" })).not.toBeInTheDocument();
  });
});
