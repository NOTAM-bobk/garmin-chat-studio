import { describe, expect, it } from "vitest";

import { sanitizeChats } from "@/lib/chat";
import { answerSummary, answersToText, parseQuestions } from "@/lib/questions";

describe("parseQuestions", () => {
  it("keeps usable questions and normalises the text", () => {
    const questions = parseQuestions({
      questions: [
        {
          prompt: "  What  are you training for? ",
          kind: "choice",
          options: ["5k", "10k", "Half marathon"],
          hint: " Changes the volume ",
        },
        { prompt: "Which days can you train?", kind: "multi", options: ["Mon", "Wed", "Fri"] },
        { prompt: "Anything to work around?", kind: "text" },
      ],
    });

    expect(questions.map((question) => question.id)).toEqual(["q1", "q2", "q3"]);
    expect(questions[0]).toEqual({
      id: "q1",
      prompt: "What are you training for?",
      kind: "choice",
      options: ["5k", "10k", "Half marathon"],
      hint: "Changes the volume",
    });
    expect(questions[1]?.kind).toBe("multi");
    expect(questions[2]).toEqual({
      id: "q3",
      prompt: "Anything to work around?",
      kind: "text",
      options: [],
    });
  });

  it("drops empty prompts and stops at three questions", () => {
    const questions = parseQuestions({
      questions: [
        { prompt: "One?", kind: "text" },
        { prompt: "   ", kind: "text" },
        { prompt: "Two?", kind: "text" },
        { prompt: "Three?", kind: "text" },
        { prompt: "Four?", kind: "text" },
      ],
    });
    expect(questions).toHaveLength(3);
    expect(questions.map((question) => question.prompt)).toEqual(["One?", "Two?", "Three?"]);
  });

  it("turns a choice with fewer than two options into free text", () => {
    const [question] = parseQuestions({
      questions: [{ prompt: "Race date?", kind: "choice", options: ["May"] }],
    });
    expect(question?.kind).toBe("text");
    expect(question?.options).toEqual([]);
  });

  it("de-duplicates options and keeps five", () => {
    const [question] = parseQuestions({
      questions: [
        {
          prompt: "How long?",
          kind: "choice",
          options: ["30", "30", "45", "60", "75", "90", "120"],
        },
      ],
    });
    expect(question?.options).toEqual(["30", "45", "60", "75", "90"]);
  });

  it("rejects junk", () => {
    expect(parseQuestions(null)).toEqual([]);
    expect(parseQuestions("questions")).toEqual([]);
    expect(parseQuestions({ questions: [1, null, "x"] })).toEqual([]);
  });
});

describe("answers", () => {
  const questions = parseQuestions({
    questions: [
      { prompt: "Goal race?", kind: "choice", options: ["5k", "10k"] },
      { prompt: "Days?", kind: "multi", options: ["Mon", "Wed"] },
      { prompt: "Anything else?", kind: "text" },
    ],
  });

  it("formats only the answered questions", () => {
    const text = answersToText(questions, { q1: ["10k"], q2: ["Mon", "Wed"] });
    expect(text).toBe("My answers:\n- Goal race? → 10k\n- Days? → Mon, Wed");
  });

  it("ignores blank answers and returns nothing when all are empty", () => {
    expect(answersToText(questions, { q3: ["  "] })).toBe("");
    expect(answersToText(questions, {})).toBe("");
  });

  it("summarises the answered pairs for the card", () => {
    expect(answerSummary(questions, { q1: ["5k"], q3: ["left knee"] })).toEqual([
      "Goal race? 5k",
      "Anything else? left knee",
    ]);
  });

  it("survives a storage round-trip with its answers", () => {
    const [chat] = sanitizeChats([
      {
        id: "c1",
        title: "Plan",
        updated: 1,
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "Two quick things.",
            steps: [],
            ask: {
              questions: [
                { prompt: "Goal race?", kind: "choice", options: ["5k", "10k"] },
                { prompt: "Days?", kind: "multi", options: ["Mon", "Wed"] },
              ],
              answers: { q1: ["10k"], q2: ["Mon"] },
            },
          },
        ],
      },
    ]);

    expect(chat?.messages[0]?.ask?.questions[0]?.prompt).toBe("Goal race?");
    expect(chat?.messages[0]?.ask?.answers).toEqual({ q1: ["10k"], q2: ["Mon"] });
  });
});
