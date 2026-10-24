import { useState } from "react";
import { Check, MessageCircleQuestion, Send } from "lucide-react";

import { answerSummary, answered, type AskAnswers, type AskQuestion } from "@/lib/questions";
import { cn } from "@/lib/utils";

/**
 * A small questionnaire the assistant asked for. Choice questions are one tap,
 * multi questions toggle, text questions take a short line. Answers are only
 * sent back as the next message; nothing here talks to a model.
 */
export function AskCard({
  questions,
  answers,
  onAnswer,
}: {
  questions: AskQuestion[];
  answers?: AskAnswers | undefined;
  onAnswer: (answers: AskAnswers) => void;
}) {
  const [picked, setPicked] = useState<AskAnswers>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (questions.length === 0) return null;

  if (answers && Object.keys(answers).length > 0) {
    const summary = answerSummary(questions, answers);
    return (
      <section className="mt-3 max-w-[620px] rounded-2xl border border-border/70 bg-card/60 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <Check className="size-3" /> Your answers
        </p>
        <dl className="mt-2 space-y-1.5">
          {summary.map((line) => (
            <div key={line} className="text-[12.5px] leading-relaxed">
              {line}
            </div>
          ))}
        </dl>
      </section>
    );
  }

  function choose(question: AskQuestion, option: string) {
    setPicked((previous) => {
      if (question.kind === "multi") {
        const current = previous[question.id] ?? [];
        const next = current.includes(option)
          ? current.filter((value) => value !== option)
          : [...current, option];
        return { ...previous, [question.id]: next };
      }
      return { ...previous, [question.id]: [option] };
    });
  }

  function type(question: AskQuestion, value: string) {
    setDrafts((previous) => ({ ...previous, [question.id]: value }));
    setPicked((previous) => ({
      ...previous,
      [question.id]: value.trim() ? [value.trim()] : [],
    }));
  }

  const ready = questions.some((question) => answered(question, picked));

  return (
    <section
      aria-label="Questions from the assistant"
      className="mt-3 max-w-[620px] rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(16,18,20,0.04)]"
    >
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <MessageCircleQuestion className="size-3.5" /> A few quick questions
      </p>

      <div className="mt-3 space-y-3.5">
        {questions.map((question) => (
          <div key={question.id}>
            <p className="text-[13.5px] font-medium leading-snug">{question.prompt}</p>
            {question.hint && (
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {question.hint}
              </p>
            )}

            {question.kind === "text" ? (
              <input
                type="text"
                value={drafts[question.id] ?? ""}
                onChange={(event) => type(question, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && ready) {
                    event.preventDefault();
                    onAnswer(picked);
                  }
                }}
                aria-label={question.prompt}
                placeholder="Type your answer"
                className="mt-2 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none transition-colors focus:border-foreground/25"
              />
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {question.options.map((option) => {
                  const active = (picked[question.id] ?? []).includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => choose(question, option)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[12.5px] transition-colors",
                        active
                          ? "border-foreground/25 bg-secondary font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onAnswer(picked)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-3" />
          Send answers
        </button>
        <span className="text-[11px] text-muted-foreground">
          {questions.length === 1 ? "One question" : `${questions.length} questions`} · pick what
          fits
        </span>
      </div>
    </section>
  );
}
