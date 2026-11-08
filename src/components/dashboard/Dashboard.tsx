import { useCallback, useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import {
  ArrowLeft,
  HeartPulse,
  KeyRound,
  Plug,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Wifi,
} from "lucide-react";

import { ConnectDialog } from "@/components/chat/ConnectDialog";
import { DesigningCard, GadgetCard } from "@/components/dashboard/GadgetCard";
import {
  designDashboard,
  fallbackPlan,
  loadPlan,
  planFits,
  savePlan,
  writeInsights,
  type DashboardPlan,
  type Gadget,
  type GadgetReading,
} from "@/lib/dashboard-ai";
import type { GarminStatus, GarminTool } from "@/lib/garmin";
import { createAiTraceId, type AiTraceContext } from "@/lib/puter";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

function clock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The dashboard is laid out by the model: it picks which readings this account
 * can actually produce, then writes the note and chart for each one. The
 * built-in grid is the fallback, so a failed design call degrades to a working
 * page instead of an empty one.
 */
export function Dashboard() {
  const posthog = usePostHog();
  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [tools, setTools] = useState<GarminTool[]>([]);
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [data, setData] = useState<Record<string, GadgetReading>>({});
  const [designing, setDesigning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const planRef = useRef<DashboardPlan | null>(null);
  const aliveRef = useRef(true);
  const dashboardSessionIdRef = useRef(`dashboard-${createAiTraceId()}`);

  const createAiTrace = useCallback(
    (): AiTraceContext => ({
      sessionId: dashboardSessionIdRef.current,
      traceId: createAiTraceId(),
      capture: (event, properties) => posthog.capture(event, properties),
    }),
    [posthog],
  );

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Read every gadget's tool in parallel and keep the results by gadget id. */
  const loadReadings = useCallback(async (gadgets: Gadget[]) => {
    const initial: Record<string, GadgetReading> = {};
    for (const gadget of gadgets) initial[gadget.id] = { state: "loading", text: "" };
    setData(initial);

    const results = await Promise.all(
      gadgets.map(async (gadget) => {
        try {
          const response = await fetch("/api/garmin/call", {
            method: "POST",
            headers: { "content-type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ name: gadget.tool, arguments: gadget.args }),
          });
          const payload = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            text?: string;
            error?: string;
          };
          if (!response.ok || payload.ok === false) {
            throw new Error(payload.error ?? "Garmin could not return this reading.");
          }
          const text = payload.text?.trim() ?? "";
          return [
            gadget.id,
            {
              state: text && text !== "No data returned." ? "loaded" : "empty",
              text,
            } as GadgetReading,
          ] as const;
        } catch (error) {
          return [
            gadget.id,
            {
              state: "error",
              text: error instanceof Error ? error.message : "Could not read this Garmin data.",
            } as GadgetReading,
          ] as const;
        }
      }),
    );

    const next: Record<string, GadgetReading> = {};
    for (const [id, reading] of results) next[id] = reading;
    setData(next);
    return next;
  }, []);

  /** Show a plan, load its readings, then let the model annotate them. */
  const applyPlan = useCallback(
    async (next: DashboardPlan, ai: AiTraceContext) => {
      planRef.current = next;
      setPlan(next);
      savePlan(next);
      const readings = await loadReadings(next.gadgets);
      if (!aliveRef.current) return;
      const enriched = await writeInsights(next.gadgets, readings, ai);
      if (!aliveRef.current) return;
      if (enriched.every((gadget, index) => gadget === next.gadgets[index])) return;
      const updated = { ...next, gadgets: enriched };
      planRef.current = updated;
      setPlan(updated);
    },
    [loadReadings],
  );

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/garmin/status", { cache: "no-store" });
    const nextStatus = (await response.json()) as GarminStatus;
    setStatus(nextStatus);
    return nextStatus;
  }, []);

  const loadTools = useCallback(async () => {
    const response = await fetch("/api/garmin/tools", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      tools?: GarminTool[];
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error ?? "Could not load Garmin tools.");
    const list = payload.tools ?? [];
    setTools(list);
    return list;
  }, []);

  const bootstrap = useCallback(async () => {
    setRefreshing(true);
    setPageError(null);
    try {
      const nextStatus = await loadStatus();
      if (!nextStatus.connected) {
        planRef.current = null;
        setPlan(null);
        setData({});
        return;
      }

      const ai = createAiTrace();
      const list = await loadTools();
      const saved = loadPlan();
      if (planFits(saved, list)) {
        await applyPlan(saved, ai);
        return;
      }

      setDesigning(true);
      const designed = await designDashboard(list, ai);
      setDesigning(false);
      if (!aliveRef.current) return;
      await applyPlan(designed ?? fallbackPlan(list), ai);
    } catch (error) {
      setDesigning(false);
      setPageError(error instanceof Error ? error.message : "Could not load Garmin data.");
      setStatus(
        (previous) => previous ?? { connected: false, configured: true, tools: 0, available: 0 },
      );
    } finally {
      if (aliveRef.current) {
        setRefreshing(false);
        setUpdatedAt(Date.now());
      }
    }
  }, [applyPlan, createAiTrace, loadStatus, loadTools]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function refresh() {
    const current = planRef.current;
    if (!current || refreshing || designing) return;
    haptic("tap");
    setRefreshing(true);
    try {
      await applyPlan(current, createAiTrace());
      posthog.capture("dashboard_refreshed", { gadget_count: current.gadgets.length });
    } finally {
      if (aliveRef.current) {
        setRefreshing(false);
        setUpdatedAt(Date.now());
      }
    }
  }

  /** Ask the model for a fresh layout (this is also "create gadgets by itself"). */
  async function redesign() {
    if (tools.length === 0 || designing) return;
    haptic("select");
    setDesigning(true);
    setPageError(null);
    try {
      const ai = createAiTrace();
      const designed = await designDashboard(tools, ai);
      if (!aliveRef.current) return;
      const next = designed ?? fallbackPlan(tools);
      await applyPlan(next, ai);
      posthog.capture("dashboard_redesigned", {
        gadget_count: next.gadgets.length,
        layout_source: designed ? "ai" : "fallback",
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not redesign the dashboard.");
    } finally {
      if (aliveRef.current) {
        setDesigning(false);
        setUpdatedAt(Date.now());
      }
    }
  }

  async function resetLayout() {
    if (tools.length === 0 || designing) return;
    haptic("select");
    await applyPlan(fallbackPlan(tools), createAiTrace());
    setUpdatedAt(Date.now());
  }

  function editPlan(patch: (current: DashboardPlan) => DashboardPlan) {
    const current = planRef.current;
    if (!current) return;
    const next = patch(current);
    planRef.current = next;
    setPlan(next);
    savePlan(next);
  }

  const updateGadget = (id: string, change: Partial<Gadget>) =>
    editPlan((current) => ({
      ...current,
      gadgets: current.gadgets.map((gadget) =>
        gadget.id === id ? { ...gadget, ...change } : gadget,
      ),
    }));

  const removeGadget = (id: string) =>
    editPlan((current) => ({
      ...current,
      gadgets: current.gadgets.filter((gadget) => gadget.id !== id),
    }));

  const connect = () => {
    if (status?.configured === false) return;
    haptic("tap");
    setConnectOpen(true);
  };

  const connected = status?.connected ?? false;
  const gadgets = plan?.gadgets ?? [];
  const shown = editing ? gadgets : gadgets.filter((gadget) => gadget.visible);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        configured={status?.configured ?? true}
        onMcp={() => {
          setConnectOpen(false);
          posthog.capture("garmin_connection_started", { connection_method: "mcp" });
          window.location.assign("/api/garmin/connect");
        }}
        onConnected={() => {
          setConnectOpen(false);
          void bootstrap();
        }}
      />

      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <header className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:px-5">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Chat
          </a>
          <span className="text-[12px] text-muted-foreground/60">/</span>
          <span className="text-[13px] font-medium">Dashboard</span>

          <div className="ml-auto flex items-center gap-1.5">
            {connected && (
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing || designing}
                aria-label="Refresh readings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
            {connected && editing && (
              <button
                type="button"
                onClick={() => void resetLayout()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
            {connected && (
              <button
                type="button"
                onClick={() => void redesign()}
                disabled={designing || refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Sparkles className={cn("size-3.5", designing && "animate-pulse")} />
                <span className="hidden sm:inline">{designing ? "Designing…" : "Redesign"}</span>
              </button>
            )}
            {gadgets.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  setEditing((value) => !value);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  editing
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-accent",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                {editing ? "Done" : "Customize"}
              </button>
            )}
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-3 pb-20 pt-5 sm:px-5">
        <section className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {today}
            </span>
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                <Wifi className="size-2.5" />
                Live Garmin
              </span>
            )}
            {plan?.source === "ai" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-medium text-brand-ink">
                <Sparkles className="size-2.5" />
                Designed by AI
              </span>
            )}
            {status?.mode === "personal" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-muted-foreground">
                <KeyRound className="size-2.5" />
                Personal key · read-only
              </span>
            )}
            {updatedAt && (
              <span className="text-[10.5px] text-muted-foreground/70">
                Updated {clock(updatedAt)}
              </span>
            )}
          </div>

          <h1 className="mt-2 max-w-3xl text-[27px] font-semibold leading-[1.15] tracking-tight sm:text-[32px]">
            {plan?.headline ?? "Dashboard"}
          </h1>
          {plan?.focus && (
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              {plan.focus}
            </p>
          )}
        </section>

        {pageError && (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{pageError}</span>
          </p>
        )}

        {connected ? (
          <>
            {editing && (
              <p className="mb-3 rounded-xl border border-dashed border-border bg-card/50 px-3 py-2 text-[11.5px] text-muted-foreground">
                Resize, hide or remove any gadget. Hidden ones stay here, faded, until you redesign
                the dashboard.
              </p>
            )}

            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
              {shown.map((gadget) => (
                <GadgetCard
                  key={gadget.id}
                  gadget={gadget}
                  reading={data[gadget.id]}
                  editing={editing}
                  onToggle={() => updateGadget(gadget.id, { visible: !gadget.visible })}
                  onSpan={() =>
                    updateGadget(gadget.id, { span: gadget.span === "lg" ? "sm" : "lg" })
                  }
                  onRemove={() => removeGadget(gadget.id)}
                />
              ))}
              {designing &&
                Array.from({ length: 4 }, (_, index) => (
                  <DesigningCard
                    key={`designing-${index}`}
                    className={index === 0 ? "md:col-span-2" : undefined}
                  />
                ))}
            </div>

            {!designing && shown.length === 0 && (
              <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
                <p className="text-[13.5px] text-muted-foreground">
                  Every gadget is hidden. Redesign the layout, or reset it to the default grid.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void redesign()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Sparkles className="size-3.5" /> Design with AI
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetLayout()}
                    className="rounded-xl border border-border px-3.5 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Reset layout
                  </button>
                </div>
              </div>
            )}
          </>
        ) : !status ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Array.from({ length: 4 }, (_, index) => (
              <DesigningCard
                key={`booting-${index}`}
                className={index === 0 ? "md:col-span-2" : undefined}
              />
            ))}
          </div>
        ) : (
          <section className="mx-auto flex max-w-xl flex-col items-center rounded-[24px] border border-border bg-card px-6 py-11 text-center shadow-sm">
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-muted">
              <HeartPulse className="size-6 text-muted-foreground" />
            </span>
            <h2 className="text-[18px] font-semibold">Connect Garmin to build your dashboard</h2>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
              The AI reads which metrics your account exposes, then picks the handful worth watching
              and charts them. No sample numbers — only your data.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> Gadgets chosen for you
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> Read-only
              </span>
            </div>
            {status?.configured === false ? (
              <p className="mt-5 rounded-xl bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                Garmin sign-in is not configured on this deployment.
              </p>
            ) : (
              <button
                type="button"
                onClick={connect}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plug className="size-4" />
                Connect Garmin
              </button>
            )}
            {pageError && (
              <button
                type="button"
                onClick={() => void bootstrap()}
                className="mt-3 text-[12px] text-muted-foreground underline"
              >
                Try again
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
