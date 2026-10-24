import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AskCard } from "@/components/chat/AskCard";
import { parseQuestions } from "@/lib/questions";

const QUESTIONS = parseQuestions({
  questions: [
    { prompt: "Goal race?", kind: "choice", options: ["5k", "10k"] },
    { prompt: "Which days?", kind: "multi", options: ["Mon", "Wed"] },
    { prompt: "Anything to work around?", kind: "text" },
  ],
});

describe("AskCard", () => {
  it("collects a choice and a multi answer before enabling send", () => {
    const onAnswer = vi.fn();
    render(<AskCard questions={QUESTIONS} onAnswer={onAnswer} />);

    const send = screen.getByRole("button", { name: /Send answers/i });
    expect(send).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "10k" }));
    fireEvent.click(screen.getByRole("button", { name: "Mon" }));
    fireEvent.click(screen.getByRole("button", { name: "Wed" }));
    expect(send).toBeEnabled();

    fireEvent.click(send);
    expect(onAnswer).toHaveBeenCalledWith({ q1: ["10k"], q2: ["Mon", "Wed"] });
  });

  it("takes a typed answer", () => {
    const onAnswer = vi.fn();
    render(<AskCard questions={QUESTIONS} onAnswer={onAnswer} />);

    fireEvent.change(screen.getByLabelText("Anything to work around?"), {
      target: { value: "left knee" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send answers/i }));

    expect(onAnswer).toHaveBeenCalledWith({ q3: ["left knee"] });
  });

  it("replaces a single choice instead of stacking it", () => {
    const onAnswer = vi.fn();
    render(<AskCard questions={QUESTIONS} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole("button", { name: "5k" }));
    fireEvent.click(screen.getByRole("button", { name: "10k" }));
    fireEvent.click(screen.getByRole("button", { name: /Send answers/i }));

    expect(onAnswer).toHaveBeenCalledWith({ q1: ["10k"] });
  });

  it("shows the answers once they were given", () => {
    render(
      <AskCard
        questions={QUESTIONS}
        answers={{ q1: ["10k"], q2: ["Mon"] }}
        onAnswer={() => undefined}
      />,
    );

    expect(screen.getByText("Your answers")).toBeInTheDocument();
    expect(screen.getByText("Goal race? 10k")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send answers/i })).not.toBeInTheDocument();
  });
});
