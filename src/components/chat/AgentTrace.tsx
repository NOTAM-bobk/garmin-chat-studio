import { useEffect, useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";

import type { TraceStep } from "@/lib/chat";
import { cn } from "@/lib/utils";

function formatMs(ms: number | undefined): string {
  if (!ms || ms < 250) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function totalMs(steps: TraceStep[]): number {
  return steps.reduce((sum, step) => sum + (step.ms ?? 0), 0);
}

function StepIcon({ step }: { step: TraceStep }) {
  if (step.status === "active") {
    return <Loader2 className="size-3 animate-spin text-muted-foreground" strokeWidth={2.2} />;
  }
  if (step.status === "error") {
    return <AlertCircle className="size-3 text-destructive" strokeWidth={2.2} />;
  }
  return <Check className="size-3 text-muted-foreground" strokeWidth={2.4} />;
}

export function AgentTrace({ steps, running }: { steps: TraceStep[]; running: boolean }) {
  const [open, setOpen] = useState(running);

  useEffect(() => {
    setOpen(running);
  }, [running]);

  if (steps.length === 0) return null;

  const active = steps.find((step) => step.status === "active");
  const errored = steps.some((step) => step.status === "error");
  const elapsed = totalMs(steps);
  const tools = steps.filter((step) => step.kind === "tool").length;

  const headline = active
    ? active.kind === "thinking"
      ? active.label
      : `${active.label}${active.detail ? ` · ${active.detail}` : ""}`
    : errored
      ? "Finished with a problem"
      : `Thought for ${formatMs(elapsed) || "a moment"}${
          tools ? ` · ${tools} ${tools === 1 ? "lookup" : "lookups"}` : ""
        }`;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="-ml-2 flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[13px] transition-colors hover:bg-accent/70"
      >
        <span
          className={cn(
            "min-w-0 truncate",
            running ? "text-muted-foreground shimmer-text" : "text-muted-foreground",
          )}
        >
          {headline}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>

      {open && (
        <ol className="mt-1 ml-1 space-y-2 border-l border-border/80 pl-3">
          {steps.map((step) => (
            <li key={step.id} className="min-w-0">
              <div className="flex items-start gap-2">
                <span className="mt-[3px] grid size-3 shrink-0 place-items-center">
                  <StepIcon step={step} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "min-w-0 text-[12.5px] leading-relaxed",
                        step.status === "active"
                          ? "text-foreground"
                          : step.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                      {step.detail && (
                        <span className="text-muted-foreground/80"> · {step.detail}</span>
                      )}
                    </span>
                    {step.ms !== undefined && step.ms > 250 && (
                      <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground/60">
                        {formatMs(step.ms)}
                      </span>
                    )}
                  </div>

                  {step.kind === "thinking" && step.text && (
                    <p
                      className={cn(
                        "mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground/90",
                        step.status === "active" ? "max-h-44 overflow-y-auto" : "line-clamp-4",
                      )}
                    >
                      {step.text}
                    </p>
                  )}

                  {step.kind === "tool" && step.preview && (
                    <p
                      className={cn(
                        "mt-0.5 truncate font-mono text-[10.5px]",
                        step.status === "error"
                          ? "text-destructive/90"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {step.preview}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
