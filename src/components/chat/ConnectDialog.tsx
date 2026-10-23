import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Waypoints,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const KEY_STEPS = [
  "Open Garmin Connect → Settings → Personal API Key.",
  "Click Create Key, then read and accept the terms.",
  "Choose 1 year as the expiration, then click Create.",
  "Copy the key right away — Garmin shows it once and never again.",
  "Paste it below and press Connect with key.",
];

const KEY_PAGE = "https://connect.garmin.com/app/settings/personalApiToken";

/**
 * Two ways to connect: the MissingMCP gateway (OAuth, read and write) or the
 * user's own Garmin personal API key (read-only, no gateway account needed).
 */
export function ConnectDialog({
  open,
  onOpenChange,
  configured,
  onMcp,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configured: boolean;
  onMcp: () => void;
  onConnected: () => void;
}) {
  const [view, setView] = useState<"choice" | "key">("choice");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setView("choice");
    setKey("");
    setBusy(false);
    setError(null);
  }, [open]);

  async function submit() {
    const value = key.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/garmin/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: value }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Garmin wouldn't accept that key.");
        return;
      }
      haptic("done");
      setKey("");
      onConnected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[24px] max-sm:border-x-0 max-sm:border-b-0 max-h-[92dvh] gap-0 overflow-y-auto border-border p-0 shadow-xl sm:max-w-[470px] sm:rounded-[26px]"
        aria-describedby="connect-description"
      >
        <div className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            {view === "choice" ? "Connect your Garmin" : "Personal API key"}
          </DialogTitle>
          <DialogDescription
            id="connect-description"
            className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground"
          >
            {view === "choice"
              ? "Two ways in. Both read your own data; pick the one that fits your setup."
              : "Garmin issues these from your own account, free, in about a minute."}
          </DialogDescription>
        </div>

        {view === "choice" ? (
          <div className="space-y-2.5 p-4">
            <button
              type="button"
              disabled={!configured}
              onClick={() => {
                haptic("tap");
                onMcp();
              }}
              className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-colors hover:border-foreground/25 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                <Waypoints className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                  Connect with Garmin MCP
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    Recommended
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                  Sign in once through the MissingMCP gateway. Reads sleep, recovery, load and
                  workouts — and can schedule new workouts.
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setView("key");
                setError(null);
              }}
              className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-colors hover:border-foreground/25 hover:bg-accent/40"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-foreground/80">
                <KeyRound className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">Use a personal API key</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                  Paste a key from Garmin's developer program. Read-only, and it reaches every
                  activity back to your first.
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            {!configured && (
              <p className="flex items-start gap-1.5 px-1 pt-1 text-[11.5px] text-destructive">
                <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                This deployment is missing SESSION_SECRET, so connecting is disabled.
              </p>
            )}
          </div>
        ) : (
          <div className="p-4">
            <button
              type="button"
              onClick={() => {
                setView("choice");
                setError(null);
              }}
              className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Both options
            </button>

            <ol className="space-y-2 text-[12.5px] leading-relaxed text-foreground/85">
              {KEY_STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-secondary font-mono text-[10px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{step}</span>
                </li>
              ))}
            </ol>

            <a
              href={KEY_PAGE}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-accent"
            >
              Open Garmin's Personal API page
              <ExternalLink className="size-3" />
            </a>

            <div className="mt-4">
              <label
                htmlFor="personal-key"
                className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
              >
                Your personal key
              </label>
              <input
                id="personal-key"
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Paste your key"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-[13px] outline-none transition-colors focus:border-foreground/30"
              />

              {error && (
                <p className="mt-2 flex items-start gap-1.5 text-[12px] text-destructive">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  <span className="min-w-0 flex-1">{error}</span>
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!key.trim() || busy}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40",
                  )}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Checking with Garmin…
                    </>
                  ) : (
                    "Connect with key"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
              </div>

              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                <span>
                  The key is sealed in an httpOnly cookie on the server — never in this browser's
                  storage. Garmin's terms make it personal and read-only: data can be read, workouts
                  cannot be uploaded.
                </span>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
