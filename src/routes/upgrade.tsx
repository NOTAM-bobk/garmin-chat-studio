import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Brain,
  CalendarCheck,
  ChartLine,
  Check,
  HeartPulse,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { PricingInteraction } from "@/components/ui/pricing-interaction";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade · Garmin Chat" },
      {
        name: "description",
        content:
          "Free and Starter plans for Garmin Chat — frontier models, image analysis and memory.",
      },
      { property: "og:title", content: "Upgrade · Garmin Chat" },
    ],
  }),
  component: UpgradeScreen,
});

const STARTER_BENEFITS = [
  {
    icon: InfinityIcon,
    title: "Unlimited chats and images",
    body: "No daily cap on questions, screenshots or chart requests.",
  },
  {
    icon: Sparkles,
    title: "Frontier models first",
    body: "GPT-5.6, Claude Sonnet 5 and Gemini 4 before they reach the free tier.",
  },
  {
    icon: Brain,
    title: "Longer memory",
    body: "Goals, injuries and preferences carried across every thread.",
  },
  {
    icon: ChartLine,
    title: "Charts and deep trends",
    body: "Multi-series comparisons, zone breakdowns and load charts.",
  },
  {
    icon: CalendarCheck,
    title: "Plans that get scheduled",
    body: "Workouts written and pushed to your Garmin calendar.",
  },
  {
    icon: Zap,
    title: "Priority queue",
    body: "Your turns skip ahead when the models are busy.",
  },
];

function UpgradeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Toaster position="top-center" />

      <header className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to chat
        </Link>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <HeartPulse className="size-4 text-brand" />
          Garmin Chat
        </span>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:pt-8">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Plans
          </p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[36px]">
            Upgrade your training
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Free covers the daily check-in. Starter keeps the whole season in view — frontier
            models, image uploads and memory that carries between chats.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <PricingInteraction
            starterMonth={9.99}
            starterAnnual={7.49}
            onStart={(plan, period) => {
              if (plan === "free") {
                void navigate({ to: "/" });
                return;
              }
              toast("Starter checkout isn't live yet", {
                description: `No card was charged${period === "year" ? " (yearly)" : ""}. Billing still needs to be connected.`,
              });
            }}
          />
        </div>

        <section className="mx-auto mt-10 max-w-3xl rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight">What Starter adds</h2>
            <span className="rounded-lg bg-amber-100 px-2 py-1 text-[12px] text-amber-950">
              Everything in Free, plus
            </span>
          </div>

          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {STARTER_BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <benefit.icon className="size-3.5" strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium">{benefit.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                    {benefit.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/70 pt-3.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5" /> Cancel anytime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5" /> Your Garmin data is still read on demand
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="size-3.5" /> Images included
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
