import { useState, type ReactNode } from "react";
import { Check, Plug, ShieldCheck, Trash2, TriangleAlert, Unplug, Vibrate } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { hapticSupported, type HapticKind } from "@/lib/haptics";
import type { ModelOption, ToneId } from "@/lib/models";
import { TONES } from "@/lib/models";
import { cn } from "@/lib/utils";

const TONE_HINTS: Record<ToneId, string> = {
  coach: "Direct, warm, one clear next step",
  analyst: "Numbers and deltas, minimal prose",
  explain: "Defines every metric it mentions",
  straight: "Blunt, no praise, no hedging",
};

export function SettingsDialog({
  open,
  onOpenChange,
  models,
  model,
  onModelChange,
  tone,
  onToneChange,
  connected,
  configured,
  tools,
  onConnect,
  onDisconnect,
  haptics,
  onHapticsChange,
  onHapticTest,
  chatCount,
  onClearChats,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: ModelOption[];
  model: string;
  onModelChange: (id: string) => void;
  tone: ToneId;
  onToneChange: (tone: ToneId) => void;
  connected: boolean;
  configured: boolean;
  tools: number;
  onConnect: () => void;
  onDisconnect: () => void;
  haptics: boolean;
  onHapticsChange: (value: boolean) => void;
  onHapticTest: (kind: HapticKind) => void;
  chatCount: number;
  onClearChats: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const canVibrate = hapticSupported();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmClear(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex h-[88dvh] w-[calc(100vw-1.5rem)] max-w-[760px] flex-col gap-0 overflow-hidden border-border p-0 shadow-xl sm:h-[80dvh]"
        aria-describedby="settings-description"
      >
        <div className="shrink-0 border-b border-border/70 bg-gradient-to-br from-brand-soft to-background px-5 py-4">
          <DialogTitle className="text-[16px] font-semibold tracking-tight">Settings</DialogTitle>
          <DialogDescription
            id="settings-description"
            className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground"
          >
            Saved in this browser. Changes apply to your next message.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          <Section title="Model" hint="What writes the answers and the chat titles.">
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card/60 p-1">
              {models.map((option) => {
                const selected = option.id === model;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onHapticTest("select");
                      onModelChange(option.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      selected ? "bg-accent text-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.note && (
                      <span className="shrink-0 text-[10.5px] text-muted-foreground">
                        {option.note}
                      </span>
                    )}
                    {selected && <Check className="size-3.5 shrink-0 text-foreground" />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Answer tone" hint="How the coach talks to you.">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {TONES.map((option) => {
                const selected = option.id === tone;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onHapticTest("select");
                      onToneChange(option.id);
                    }}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition-colors",
                      selected
                        ? "border-foreground/25 bg-accent"
                        : "border-border bg-card/60 hover:bg-accent/50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      {option.label}
                      {selected && <Check className="size-3" />}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                      {TONE_HINTS[option.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Garmin" hint="Read-only access to your own Garmin data.">
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    connected ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {connected ? "Connected" : "Not connected"}
                </span>
                {connected && (
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {tools} tools
                  </span>
                )}
                {connected ? (
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Unplug className="size-3" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onConnect}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Plug className="size-3" />
                    Connect
                  </button>
                )}
              </div>
              {connected ? (
                <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  The token stays in an httpOnly cookie on the server.
                </p>
              ) : !configured ? (
                <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-destructive">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  This deployment is missing SESSION_SECRET, so connecting is disabled.
                </p>
              ) : (
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  One sign-in through the MissingMCP gateway. Your Garmin password is never stored.
                </p>
              )}
            </div>
          </Section>

          <Section title="Feel" hint="Small buzzes when something happens.">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3">
              <Vibrate className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <label htmlFor="haptics" className="block text-[13px] font-medium">
                  Vibration feedback
                </label>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {canVibrate
                    ? "Buzz on send, copy, redo and delete. Follows your system reduced-motion setting."
                    : "This browser has no Vibration API (iOS Safari doesn't). The setting is remembered for devices that do."}
                </p>
              </div>
              <Switch
                id="haptics"
                checked={haptics}
                onCheckedChange={(next) => {
                  onHapticsChange(next);
                  if (next) onHapticTest("done");
                }}
                aria-label="Vibration feedback"
                className="mt-0.5 shrink-0"
              />
            </div>
          </Section>

          <Section title="Chats" hint="Threads are stored only in this browser.">
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-[13px]">
                  {chatCount === 0
                    ? "No saved chats"
                    : `${chatCount} saved chat${chatCount === 1 ? "" : "s"}`}
                </span>
                {confirmClear ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-lg px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmClear(false);
                        onClearChats();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-[11.5px] font-medium text-destructive-foreground transition-opacity hover:opacity-90"
                    >
                      <Trash2 className="size-3" />
                      Delete all
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={chatCount === 0}
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    <Trash2 className="size-3" />
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </Section>
        </div>

        <div className="shrink-0 border-t border-border/70 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.99]"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </h3>
      <p className="mt-0.5 mb-2 text-[11.5px] text-muted-foreground/80">{hint}</p>
      {children}
    </section>
  );
}
