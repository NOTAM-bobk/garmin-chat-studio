import NumberFlow from "@number-flow/react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Plan = "free" | "starter";
type Period = "month" | "year";

const ROW_HEIGHT = 88;
const ROW_GAP = 12;

export function PricingInteraction({
  starterMonth,
  starterAnnual,
  onStart,
  className,
}: {
  starterMonth: number;
  starterAnnual: number;
  onStart?: (plan: Plan, period: Period) => void;
  className?: string;
}) {
  const [plan, setPlan] = useState<Plan>("starter");
  const [period, setPeriod] = useState<Period>("month");
  const starter = period === "month" ? starterMonth : starterAnnual;
  const active = plan === "starter" ? 1 : 0;

  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center gap-3 rounded-[32px] border-2 border-border bg-card p-3 shadow-md",
        className,
      )}
    >
      <div className="relative flex w-full items-center rounded-full bg-secondary p-1.5">
        <button
          type="button"
          aria-pressed={period === "month"}
          onClick={() => setPeriod("month")}
          className="z-20 w-full rounded-full p-1.5 text-[15px] font-semibold text-foreground"
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={period === "year"}
          onClick={() => setPeriod("year")}
          className="z-20 w-full rounded-full p-1.5 text-[15px] font-semibold text-foreground"
        >
          Yearly
        </button>
        <div className="absolute inset-0 z-10 flex w-1/2 justify-center p-1.5">
          <div
            className="h-full w-full rounded-full bg-card shadow-sm ring-1 ring-border/60 transition-transform duration-300"
            style={{ transform: `translateX(${period === "year" ? 100 : 0}%)` }}
          />
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Plan"
        className="relative flex w-full flex-col items-center justify-center gap-3"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[88px] rounded-2xl border-[3px] border-foreground transition-transform duration-300"
          style={{ transform: `translateY(${active * (ROW_HEIGHT + ROW_GAP)}px)` }}
        />

        <button
          type="button"
          role="radio"
          aria-checked={plan === "free"}
          onClick={() => setPlan("free")}
          className="relative z-20 flex h-[88px] w-full cursor-pointer items-center justify-between rounded-2xl border-2 border-border px-4 text-left"
        >
          <span className="flex flex-col items-start">
            <span className="text-xl font-semibold text-foreground">Free</span>
            <span className="text-[15px] text-muted-foreground">
              <span className="font-medium text-foreground">$0.00</span>/month
            </span>
          </span>
          <span
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/70 p-1 transition-colors"
            style={{ borderColor: plan === "free" ? "var(--foreground)" : undefined }}
          >
            <span
              className="size-3 rounded-full bg-foreground transition-opacity duration-300"
              style={{ opacity: plan === "free" ? 1 : 0 }}
            />
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={plan === "starter"}
          onClick={() => setPlan("starter")}
          className="relative z-20 flex h-[88px] w-full cursor-pointer items-center justify-between rounded-2xl border-2 border-border px-4 text-left"
        >
          <span className="flex flex-col items-start">
            <span className="flex items-center gap-2 text-xl font-semibold text-foreground">
              Starter
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-[13px] font-normal text-amber-950">
                Popular
              </span>
            </span>
            <span className="flex text-[15px] text-muted-foreground">
              <span className="flex items-center font-medium text-foreground">
                ${" "}
                <NumberFlow
                  className="font-medium text-foreground"
                  value={starter}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                />
              </span>
              /month
            </span>
          </span>
          <span
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/70 p-1 transition-colors"
            style={{ borderColor: plan === "starter" ? "var(--foreground)" : undefined }}
          >
            <span
              className="size-3 rounded-full bg-foreground transition-opacity duration-300"
              style={{ opacity: plan === "starter" ? 1 : 0 }}
            />
          </span>
        </button>
      </div>

      {period === "year" && (
        <p className="-mt-1 text-[12px] text-muted-foreground">
          Billed yearly · saves {Math.round((1 - starterAnnual / starterMonth) * 100)}%
        </p>
      )}

      <button
        type="button"
        onClick={() => onStart?.(plan, period)}
        className="w-full rounded-full bg-foreground p-3 text-lg text-background transition-transform duration-300 active:scale-95"
      >
        Get Started
      </button>
    </div>
  );
}
