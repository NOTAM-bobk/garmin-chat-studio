import { ArrowRight, Check, HeartPulse, Plug, ShieldCheck, Sparkles } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[22px] max-sm:border-x-0 max-sm:border-b-0 max-h-[92dvh] gap-0 overflow-y-auto border-border p-0 shadow-xl duration-300 sm:max-w-[430px] sm:rounded-2xl"
        aria-describedby="welcome-description"
      >
        <div className="flex items-center gap-3 border-b border-border/70 bg-gradient-to-br from-brand-soft to-background px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="size-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-[15.5px] font-semibold tracking-tight">
              Welcome to Garmin Chat
            </DialogTitle>
            <p className="mt-0.5 text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
              Two things to know
            </p>
          </div>
        </div>

        <div className="px-5 pt-4 pb-5">
          <DialogDescription
            id="welcome-description"
            className="text-[13px] leading-relaxed text-muted-foreground"
          >
            Ask about your sleep, recovery and training. Answers are read from your own Garmin
            account, with every lookup and thought shown as it happens.
          </DialogDescription>

          <ol className="mt-4 space-y-2.5">
            <li
              className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl border border-border bg-card/70 p-3 duration-300"
              style={{ animationDelay: "40ms", animationFillMode: "both" }}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <Plug className="size-3" strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium">Connect your Garmin account</p>
                    <span
                      className={
                        connected
                          ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                          : "rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      }
                    >
                      {connected ? (
                        <>
                          <Check className="size-2.5" /> {tools || 38} tools
                        </>
                      ) : (
                        "Required"
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    One sign-in through the open-source MissingMCP gateway. Your Garmin password is
                    never stored, and the access token stays on the server.
                  </p>
                  {connected ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-700">
                      <ShieldCheck className="size-3" /> Connected
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={onConnect}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-transform active:scale-[0.98]"
                      >
                        <Plug className="size-3" />
                        Connect Garmin
                        <ArrowRight className="size-3" />
                      </button>
                      {!configured && (
                        <p className="mt-1.5 text-[11px] text-destructive">
                          This deployment is missing SESSION_SECRET, so connecting is disabled.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>

            <li
              className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl border border-border bg-card/70 p-3 duration-300"
              style={{ animationDelay: "100ms", animationFillMode: "both" }}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <Sparkles className="size-3" strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium">The AI runs on Puter.js</p>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Automatic
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    No API key and no sign-up. A free Puter guest session starts with your first
                    message — if your browser asks, allow the prompt.
                  </p>
                </div>
              </div>
            </li>

            <li
              className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl border border-border bg-card/70 p-3 duration-300"
              style={{ animationDelay: "160ms", animationFillMode: "both" }}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <HeartPulse className="size-3" strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Ask, then steer</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Tap a suggestion or type a question. You can edit a prompt, redo an answer, and
                    switch tone under the composer. Charts and workout plans are supported.
                  </p>
                </div>
              </div>
            </li>
          </ol>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={connected ? () => onOpenChange(false) : onConnect}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {connected ? "Start chatting" : "Connect Garmin"}
              <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Maybe later
            </button>
          </div>

          <p className="mt-3 text-center text-[10.5px] text-muted-foreground/70">
            Garmin data is read on demand and never stored. Training guidance, not medical advice.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
