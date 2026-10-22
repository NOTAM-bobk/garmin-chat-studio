import { useEffect, useState } from "react";
import { AlertCircle, Brain, Check, ChevronDown, Loader2, Sparkles, Wrench } from "lucide-react";

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
    return <Loader2 className="size-3.5 animate-spin text-brand" strokeWidth={2.2} />;
  }
  if (step.status === "error") {
    return <AlertCircle className="size-3.5 text-destructive" strokeWidth={2.2} />;
  }
  if (step.kind === "thinking") {
    return <Brain className="size-3.5 text-muted-foreground" strokeWidth={1.9} />;
  }
  return <Check className="size-3.5 text-brand" strokeWidth={2.4} />;
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

  const headline = active
    ? active.kind === "thinking"
      ? active.label
      : `${active.label}${active.detail ? ` · ${active.detail}` : ""}`
    : errored
      ? `Finished with a problem · ${steps.length} steps`
      : `Worked through ${steps.length} ${steps.length === 1 ? "step" : "steps"}${elapsed ? ` · ${formatMs(elapsed)}` : ""}`;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-border/70 bg-muted/35">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <Sparkles
          className={cn("size-3.5 shrink-0", running ? "text-brand" : "text-muted-foreground")}
          strokeWidth={2}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12.5px]",
            running ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {headline}
          {running && <AnimatedDots />}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      {open && (
        <ol className="space-y-0.5 border-t border-border/60 px-2 py-2">
          {steps.map((step) => (
            <li key={step.id} className="rounded-lg px-1.5 py-1.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                  <StepIcon step={step} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "truncate text-[12.5px]",
                        step.status === "active"
                          ? "font-medium text-foreground"
                          : "text-foreground/80",
                      )}
                    >
                      {step.label}
                      {step.detail && (
                        <span className="font-normal text-muted-foreground"> · {step.detail}</span>
                      )}
                    </span>
                    {step.kind === "tool" && (
                      <Wrench className="ml-auto size-3 shrink-0 text-muted-foreground/60" />
                    )}
                    {step.ms !== undefined && step.ms > 250 && (
                      <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground/80">
                        {formatMs(step.ms)}
                      </span>
                    )}
                  </div>

                  {step.kind === "thinking" && step.text && (
                    <p
                      className={cn(
                        "mt-0.5 whitespace-pre-wrap text-[12px] italic leading-relaxed text-muted-foreground",
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
                          : "text-muted-foreground/80",
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

function AnimatedDots() {
  return (
    <span className="inline-flex items-baseline gap-0.5 pl-1 text-brand" aria-hidden="true">
      <span className="animate-[dot_1.2s_ease-in-out_infinite]">.</span>
      <span className="animate-[dot_1.2s_ease-in-out_0.2s_infinite]">.</span>
      <span className="animate-[dot_1.2s_ease-in-out_0.4s_infinite]">.</span>
    </span>
  );
}
