import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

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

/** The Garmin tools this answer actually touched, with live status. */
export function ToolActivity({ steps }: { steps: TraceStep[] }) {
  const tools = steps.filter((step) => step.kind === "tool");
  if (tools.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/60">
        Tools
      </span>
      {tools.map((step) => (
        <span
          key={step.id}
          title={[step.label, step.detail, step.preview].filter(Boolean).join(" · ")}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-[3px]",
            step.status === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border/80 bg-muted/40 text-muted-foreground",
          )}
        >
          {step.status === "active" ? (
            <Loader2 className="size-2.5 shrink-0 animate-spin" strokeWidth={2.4} />
          ) : step.status === "error" ? (
            <AlertCircle className="size-2.5 shrink-0" strokeWidth={2.4} />
          ) : (
            <Check className="size-2.5 shrink-0" strokeWidth={2.6} />
          )}
          <span
            className={cn(
              "truncate font-mono text-[10.5px]",
              step.status === "active" && "shimmer-text",
            )}
          >
            {step.tool ?? step.label}
          </span>
          {step.ms !== undefined && step.ms > 250 && (
            <span className="shrink-0 font-mono text-[9.5px] text-muted-foreground/50">
              {formatMs(step.ms)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
