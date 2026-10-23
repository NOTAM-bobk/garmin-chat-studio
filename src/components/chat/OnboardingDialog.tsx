import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Plug,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Waypoints,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Slide = {
  title: string;
  body: string;
  art: "ring" | "steps" | "chart" | "plug";
};

const SLIDES: Slide[] = [
  {
    title: "Welcome to Garmin Chat",
    body: "Ask about sleep, recovery, load and workouts. Every answer is read from your own Garmin account, never invented.",
    art: "ring",
  },
  {
    title: "Watch it think",
    body: "Each lookup and reasoning step is listed as the answer is built, so you can see exactly what was checked and when.",
    art: "steps",
  },
  {
    title: "Charts, plans and memory",
    body: "Trends turn into charts, plans turn into scheduled workouts, and the details you share are remembered for the next chat.",
    art: "chart",
  },
  {
    title: "Connect when you're ready",
    body: "One Garmin sign-in through the MissingMCP gateway. Your password is never stored and data is read on demand.",
    art: "plug",
  },
];

export function OnboardingDialog({
  open,
  onOpenChange,
  connected,
  configured,
  tools,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connected: boolean;
  configured: boolean;
  tools: number;
  onConnect: () => void;
}) {
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index] ?? SLIDES[0]!;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const finish = () => {
    if (!connected && last) {
      onConnect();
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[24px] max-sm:border-x-0 max-sm:border-b-0 max-h-[92dvh] gap-0 overflow-y-auto border-border p-3 shadow-xl duration-300 sm:max-w-[460px] sm:rounded-[26px] [&>button]:z-30 [&>button]:text-white/75 [&>button]:hover:text-white"
        aria-describedby="welcome-description"
      >
        <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-[18px] bg-[radial-gradient(120%_140%_at_50%_-10%,#35353b_0%,#242428_46%,#171719_100%)]">
          {[18, 34, 50, 66, 82].map((left) => (
            <span
              key={left}
              aria-hidden="true"
              className="absolute inset-y-0 border-l border-dashed border-white/10"
              style={{ left: `${left}%` }}
            />
          ))}

          {slide.art === "ring" && (
            <span
              aria-hidden="true"
              className="size-36 rounded-full border-[22px] border-white/25 bg-white/5 shadow-[inset_0_8px_26px_rgba(255,255,255,0.16),0_24px_60px_rgba(0,0,0,0.55)]"
            />
          )}

          {slide.art === "steps" && (
            <div className="w-[62%] space-y-2 text-[12.5px] text-white/80">
              {["Read your question", "Pulled sleep and HRV", "Checked the trend"].map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-white/50" strokeWidth={2.2} />
                  <span className="truncate">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-white">
                <span className="grid size-3.5 shrink-0 place-items-center">
                  <span className="size-1.5 rounded-full bg-white" />
                </span>
                <span className="truncate">Writing the answer</span>
              </div>
            </div>
          )}

          {slide.art === "chart" && (
            <div className="flex h-24 items-end gap-2.5">
              {[38, 58, 44, 78, 92].map((height, bar) => (
                <span
                  key={bar}
                  className="w-6 rounded-t-md bg-white/70"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          )}

          {slide.art === "plug" && (
            <div className="flex flex-col items-center gap-3">
              <span className="grid size-16 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
                <Plug className="size-7" strokeWidth={1.9} />
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-white/60">
                <Waypoints className="size-3.5" /> MissingMCP gateway
              </span>
            </div>
          )}
        </div>

        <div className="px-3 pb-2 pt-6">
          <DialogTitle className="text-[24px] font-semibold leading-tight tracking-tight">
            {slide.title}
          </DialogTitle>
          <DialogDescription
            id="welcome-description"
            className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground"
          >
            {slide.body}
          </DialogDescription>

          {last && (
            <div className="mt-3">
              {connected ? (
                <p className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
                  <ShieldCheck className="size-3.5" /> Connected · {tools || 0} tools
                </p>
              ) : !configured ? (
                <p className="flex items-start gap-1.5 text-[12px] text-destructive">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  This deployment is missing SESSION_SECRET, so connecting is disabled.
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Sparkles className="size-3.5" /> The AI runs on a free Puter guest session.
                </p>
              )}
            </div>
          )}

          <div className="mt-7 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {SLIDES.map((entry, dot) => (
                <button
                  key={entry.title}
                  type="button"
                  aria-label={`Step ${dot + 1}: ${entry.title}`}
                  aria-current={dot === index ? "step" : undefined}
                  onClick={() => setIndex(dot)}
                  className={cn(
                    "size-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dot === index ? "bg-foreground" : "bg-foreground/20 hover:bg-foreground/35",
                  )}
                />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  if (last) {
                    finish();
                    return;
                  }
                  setIndex((current) => Math.min(current + 1, SLIDES.length - 1));
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-[15px] font-medium text-background transition-opacity hover:opacity-90 active:scale-[0.98]"
              >
                {last ? (connected ? "Start chatting" : "Connect Garmin") : "Next"}
                <ArrowRight className="size-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
