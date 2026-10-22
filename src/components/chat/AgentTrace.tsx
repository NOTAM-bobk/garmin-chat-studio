import { useState } from "react";
import { AlertCircle, ChevronUp, HeartPulse, Loader2, Wrench } from "lucide-react";

import type { TraceStep } from "@/lib/chat";
import { cn } from "@/lib/utils";

function formatMs(ms: number | undefined): string {
  if (!ms || ms < 250) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The model's reasoning, printed as faint background text instead of a panel.
 * It streams in live and collapses to three lines once the answer lands.
 */
export function Thinking({ steps, running }: { steps: TraceStep[]; running: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const text = steps
    .filter((step) => step.kind === "thinking")
    .map((step) => (step.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  if (!text) return null;

  const clamped = !running && !expanded;

  return (
    <div className="mb-1.5">
      <p
        className={cn("thinking-layer", running && "is-live", clamped && "line-clamp-3")}
        aria-live="polite"
      >
        {text}
      </p>
      {!running && text.length > 180 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-0.5 text-[10.5px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        >
          {expanded ? "Hide reasoning" : "Show reasoning"}
        </button>
      )}
    </div>
  );
}

/**
 * The Garmin tools this answer actually touched, in the style of a file-activity
 * trace: one collapsible heading, then indented rows with a tool chip each.
 */
export function ToolActivity({ steps, running }: { steps: TraceStep[]; running: boolean }) {
  const [open, setOpen] = useState(true);
  const tools = steps.filter((step) => step.kind === "tool");
  if (tools.length === 0) return null;

  const active = running || tools.some((step) => step.status === "active");
  const failed = tools.filter((step) => step.status === "error").length;
  const heading = active
    ? "Reading your Garmin data"
    : failed > 0
      ? `${tools.length} lookup${tools.length === 1 ? "" : "s"} · ${failed} failed`
      : `${tools.length} Garmin lookup${tools.length === 1 ? "" : "s"}`;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md py-0.5 text-left transition-colors hover:text-foreground"
      >
        <Wrench className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.9} />
        <span
          className={cn(
            "truncate text-[13px] font-medium text-foreground/75",
            active && "shimmer-text",
          )}
        >
          {heading}
        </span>
        <ChevronUp
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
            !open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul className="mt-1.5 ml-[6px] space-y-1.5 border-l border-border/70 pl-3.5">
          {tools.map((step) => (
            <li
              key={step.id}
              className="flex min-w-0 animate-in fade-in-0 slide-in-from-top-0.5 flex-wrap items-center gap-1.5 text-[13px] leading-relaxed text-muted-foreground duration-200"
              title={[step.label, step.detail, step.preview].filter(Boolean).join(" · ")}
            >
              <span
                className={cn(
                  "min-w-0 truncate",
                  step.status === "active" && "shimmer-text text-foreground/80",
                  step.status === "error" && "text-destructive",
                )}
              >
                {step.label}
              </span>

              <span
                className={cn(
                  "inline-flex max-w-[16rem] shrink-0 items-center gap-1 rounded-md border px-1.5 py-[1px]",
                  step.status === "error"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border/80 bg-muted/40 text-muted-foreground/80",
                )}
              >
                {step.status === "active" ? (
                  <Loader2 className="size-2.5 shrink-0 animate-spin" strokeWidth={2.6} />
                ) : step.status === "error" ? (
                  <AlertCircle className="size-2.5 shrink-0" strokeWidth={2.6} />
                ) : (
                  <HeartPulse className="size-2.5 shrink-0 text-brand" strokeWidth={2.4} />
                )}
                <span className="truncate font-mono text-[10.5px]">{step.tool ?? step.label}</span>
              </span>

              {step.detail && (
                <span className="min-w-0 truncate text-[11.5px] text-muted-foreground/60">
                  {step.detail}
                </span>
              )}

              {step.ms !== undefined && step.ms > 250 && (
                <span className="ml-auto shrink-0 font-mono text-[9.5px] text-muted-foreground/45">
                  {formatMs(step.ms)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
