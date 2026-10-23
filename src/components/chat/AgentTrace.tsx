import { useState } from "react";
import { Check, X } from "lucide-react";

import type { TraceStep } from "@/lib/chat";
import { cn } from "@/lib/utils";

function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function rowMeta(step: TraceStep): string {
  const meta =
    step.kind === "tool" ? (step.preview ?? step.detail ?? "") : step.ms ? duration(step.ms) : "";
  return meta.length > 44 ? `${meta.slice(0, 43)}…` : meta;
}

/**
 * The thinking trace: a plain checklist of what the assistant did, in order.
 * Checks for finished steps, a dot for the running one, and the tool result on
 * the right. Reasoning text is available underneath once the turn is over.
 */
export function AgentTrace({ steps, running }: { steps: TraceStep[]; running: boolean }) {
  const [showReasoning, setShowReasoning] = useState(false);
  if (steps.length === 0) return null;

  const active = running || steps.some((step) => step.status === "active");
  const total = steps.reduce((sum, step) => sum + (step.ms ?? 0), 0);
  const reasoning = steps
    .filter((step) => step.kind === "thinking")
    .map((step) => (step.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const heading = active
    ? "Thinking…"
    : total >= 500
      ? `Thought for ${duration(total)}`
      : "Thought process";

  return (
    <div className="mb-4">
      <p
        aria-live="polite"
        className={cn(
          "text-[13.5px] font-medium",
          active ? "shimmer-text text-foreground/80" : "text-muted-foreground",
        )}
      >
        {heading}
      </p>

      <ul className="mt-3 space-y-2.5">
        {steps.map((step) => {
          const meta = rowMeta(step);
          return (
            <li key={step.id} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
              {step.status === "active" ? (
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                  <span className="size-2 animate-pulse rounded-full bg-foreground shadow-[0_0_0_3px_oklch(0.2_0_0/10%)]" />
                </span>
              ) : step.status === "error" ? (
                <X className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2.1} />
              ) : (
                <Check
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/45"
                  strokeWidth={2.1}
                />
              )}

              <span
                className={cn(
                  "min-w-0 flex-1",
                  step.status === "active" ? "text-foreground" : "text-foreground/85",
                  step.status === "error" && "text-destructive",
                )}
              >
                {step.label}
              </span>

              {meta && (
                <span className="ml-auto max-w-[45%] shrink-0 truncate pt-0.5 text-right text-[12px] text-muted-foreground/50">
                  {meta}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {reasoning && !active && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowReasoning((value) => !value)}
            className="text-[11px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
          >
            {showReasoning ? "Hide reasoning" : "Show reasoning"}
          </button>
          {showReasoning && (
            <p className="thinking-layer mt-1.5 text-[13px] leading-relaxed">{reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}
