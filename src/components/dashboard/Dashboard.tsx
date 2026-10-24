import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BatteryCharging,
  Eye,
  EyeOff,
  Footprints,
  HeartPulse,
  Loader2,
  Maximize2,
  Moon,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  Waves,
} from "lucide-react";

import { ConnectDialog } from "@/components/chat/ConnectDialog";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LAYOUT,
  moveWidget,
  parseLayout,
  updateWidget,
  type WidgetId,
  type WidgetSlot,
} from "@/lib/dashboard-layout";
import type { GarminStatus, GarminTool } from "@/lib/garmin";

const STORAGE_KEY = "garmin-chat:dashboard-layout";

type DataState = "loading" | "loaded" | "empty" | "error";
type WidgetData = { state: DataState; text: string; tool: string };
type WidgetDataMap = Partial<Record<WidgetId, WidgetData>>;

const DATA_TOOLS: Record<WidgetId, { tool: string; title: string }> = {
  readiness: { tool: "get_training_readiness", title: "Training readiness" },
  battery: { tool: "get_body_battery", title: "Body Battery today" },
  steps: { tool: "get_daily_steps", title: "Steps" },
  sleep: { tool: "get_sleep_summary_range", title: "Sleep stages" },
  hrv: { tool: "get_hrv_trend", title: "HRV trend" },
  zones: { tool: "get_heart_rate_zones", title: "Heart rate zones" },
  load: { tool: "get_training_load_trend", title: "Training load" },
  week: { tool: "get_activities_by_date", title: "Recent activities" },
};

const META: Record<WidgetId, { title: string; icon: typeof Activity }> = {
  readiness: { title: "Training readiness", icon: Activity },
  battery: { title: "Body Battery today", icon: BatteryCharging },
  steps: { title: "Steps", icon: Footprints },
  sleep: { title: "Sleep stages", icon: Moon },
  hrv: { title: "HRV trend", icon: Waves },
  zones: { title: "Heart rate zones", icon: HeartPulse },
  load: { title: "Training load", icon: Timer },
  week: { title: "Recent activities", icon: Activity },
};

function dateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toolArguments(tool: GarminTool | undefined): Record<string, unknown> | null {
  if (!tool) return null;
  const properties = (tool.parameters.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = tool.parameters.required ?? [];
  const args: Record<string, unknown> = {};
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);

  for (const key of required) {
    const schema = properties[key] ?? {};
    const lower = key.toLowerCase();
    if (/^(start|from|cstart)|startdate|start_date/.test(lower)) {
      args[key] = dateString(weekAgo);
    } else if (/^(end|to|cend)|enddate|end_date/.test(lower)) {
      args[key] = dateString(today);
    } else if (/date|calendar/.test(lower)) {
      args[key] = dateString(today);
    } else if (Array.isArray(schema["enum"]) && schema["enum"].length > 0) {
      args[key] = schema["enum"][0];
    } else if (schema["type"] === "number" || schema["type"] === "integer") {
      args[key] = 7;
    } else if (schema["type"] === "boolean") {
      args[key] = false;
    } else {
      // Required identifiers or free-form strings cannot be guessed safely.
      return null;
    }
  }
  return args;
}

function readableKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarize(text: string): { facts: Array<[string, string]>; raw: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { facts: [], raw: text.trim() };
  }

  const facts: Array<[string, string]> = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (facts.length >= 10 || depth > 4 || value == null) return;
    if (Array.isArray(value)) {
      value.slice(0, 6).forEach((item, index) => visit(item, path ? `${path} ${index + 1}` : `Item ${index + 1}`, depth + 1));
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        visit(child, path ? `${path} · ${readableKey(key)}` : readableKey(key), depth + 1);
        if (facts.length >= 10) break;
      }
      return;
    }
    const display = typeof value === "string" ? value.trim() : String(value);
    if (display) facts.push([path || "Reading", display.slice(0, 180)]);
  };
  visit(parsed, "", 0);
  return { facts, raw: facts.length ? "" : JSON.stringify(parsed, null, 2) };
}

function CardData({ data }: { data: WidgetData | undefined }) {
  if (!data || data.state === "loading") {
    return (
      <div className="flex h-36 items-center justify-center gap-2 text-[12.5px] text-muted-foreground" aria-live="polite">
        <Loader2 className="size-4 animate-spin" /> Reading your Garmin data…
      </div>
    );
  }
  if (data.state === "error") {
    return <p className="py-5 text-[12.5px] leading-relaxed text-muted-foreground">{data.text}</p>;
  }
  if (data.state === "empty") {
    return <p className="py-5 text-[12.5px] leading-relaxed text-muted-foreground">No data returned by Garmin for this reading.</p>;
  }

  const { facts, raw } = summarize(data.text);
  if (facts.length > 0) {
    return (
      <dl className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {facts.map(([label, value], index) => (
          <div key={`${label}-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-muted/60 px-2.5 py-2">
            <dt className="min-w-0 text-[11.5px] text-muted-foreground">{label}</dt>
            <dd className="max-w-[62%] break-words text-right text-[12px] font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
      {raw || data.text.slice(0, 2400)}
    </pre>
  );
}

export function Dashboard() {
  const [layout, setLayout] = useState<WidgetSlot[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [data, setData] = useState<WidgetDataMap>({});
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    setLayout(parseLayout(localStorage.getItem(STORAGE_KEY)));
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setPageError(null);
    try {
      const statusResponse = await fetch("/api/garmin/status", { cache: "no-store" });
      const nextStatus = (await statusResponse.json()) as GarminStatus;
      setStatus(nextStatus);
      if (!nextStatus.connected) {
        setData({});
        return;
      }

      const toolsResponse = await fetch("/api/garmin/tools", { cache: "no-store" });
      const toolsPayload = (await toolsResponse.json()) as { tools?: GarminTool[]; error?: string };
      if (!toolsResponse.ok) throw new Error(toolsPayload.error ?? "Could not load Garmin tools.");
      const toolMap = new Map((toolsPayload.tools ?? []).map((tool) => [tool.name, tool]));
      const initial: WidgetDataMap = {};
      for (const [id, config] of Object.entries(DATA_TOOLS) as Array<[WidgetId, (typeof DATA_TOOLS)[WidgetId]]>) {
        initial[id] = { state: "loading", text: "", tool: config.tool };
      }
      setData(initial);

      await Promise.all(
        (Object.entries(DATA_TOOLS) as Array<[WidgetId, (typeof DATA_TOOLS)[WidgetId]]>).map(async ([id, config]) => {
          const tool = toolMap.get(config.tool);
          const args = toolArguments(tool);
          if (!tool || !args) {
            setData((previous) => ({
              ...previous,
              [id]: { state: "error", text: "This Garmin reading is not available for the connected account.", tool: config.tool },
            }));
            return;
          }
          try {
            const response = await fetch("/api/garmin/call", {
              method: "POST",
              headers: { "content-type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({ name: config.tool, arguments: args }),
            });
            const result = (await response.json()) as { ok?: boolean; text?: string; error?: string };
            if (!response.ok || result.ok === false) throw new Error(result.error ?? "Garmin could not return this reading.");
            const text = result.text?.trim() ?? "";
            setData((previous) => ({
              ...previous,
              [id]: { state: text && text !== "No data returned." ? "loaded" : "empty", text, tool: config.tool },
            }));
          } catch (error) {
            setData((previous) => ({
              ...previous,
              [id]: {
                state: "error",
                text: error instanceof Error ? error.message : "Could not read this Garmin data.",
                tool: config.tool,
              },
            }));
          }
        }),
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not load Garmin data.");
      setStatus((previous) => previous ?? { connected: false, configured: true, tools: 0, available: 0 });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const connect = () => {
    if (status?.configured === false) return;
    setConnectOpen(true);
  };

  const save = (next: WidgetSlot[]) => {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  const shown = editing ? layout : layout.filter((widget) => widget.visible);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        configured={status?.configured ?? true}
        onMcp={() => {
          setConnectOpen(false);
          window.location.assign("/api/garmin/connect");
        }}
        onConnected={() => {
          setConnectOpen(false);
          void loadData();
        }}
      />

      <header className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4">
        <a href="/" className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to chat
        </a>
        <div className="flex items-center gap-1.5">
          {status?.connected && (
            <button onClick={() => void loadData()} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-accent disabled:opacity-50" aria-label="Refresh Garmin data">
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> Refresh
            </button>
          )}
          {editing && (
            <button onClick={() => save(DEFAULT_LAYOUT)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-accent">
              <RotateCcw className="size-3.5" /> Reset
            </button>
          )}
          {status?.connected && (
            <button onClick={() => setEditing((value) => !value)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", editing ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent")}>
              <SlidersHorizontal className="size-3.5" /> {editing ? "Done" : "Customize"}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 pb-16 sm:px-4">
        <div className="flex flex-wrap items-end justify-between gap-2 pt-2 pb-5">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Dashboard</h1>
            <p className="text-[13.5px] text-muted-foreground">Your Garmin training data, read from your connected account.</p>
          </div>
          {status?.connected && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11.5px] text-emerald-700">Live Garmin data</span>}
        </div>

        {pageError && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">{pageError}</p>}

        {status?.connected ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {shown.map((widget, index) => {
              const meta = META[widget.id];
              const Icon = meta.icon;
              return (
                <section key={widget.id} className={cn("animate-in fade-in-0 rounded-[22px] border border-border bg-card p-4 shadow-sm transition-opacity", widget.size === "lg" && "md:col-span-2", editing && !widget.visible && "opacity-45", editing && "ring-1 ring-dashed ring-brand/40")}>
                  <div className="mb-3 flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <h2 className="truncate text-[13.5px] font-medium">{meta.title}</h2>
                    {editing && (
                      <div className="ml-auto flex shrink-0 items-center gap-0.5">
                        {[
                          { label: "Move up", Icon: ArrowUp, on: () => save(moveWidget(layout, widget.id, -1)), off: index === 0 },
                          { label: "Move down", Icon: ArrowDown, on: () => save(moveWidget(layout, widget.id, 1)), off: index === layout.length - 1 },
                          { label: widget.size === "lg" ? "Make smaller" : "Make wider", Icon: Maximize2, on: () => save(updateWidget(layout, widget.id, { size: widget.size === "lg" ? "sm" : "lg" })), off: false },
                          { label: widget.visible ? "Hide" : "Show", Icon: widget.visible ? EyeOff : Eye, on: () => save(updateWidget(layout, widget.id, { visible: !widget.visible })), off: false },
                        ].map(({ label, Icon: ActionIcon, on, off }) => (
                          <button key={label} aria-label={label} title={label} disabled={off} onClick={on} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30">
                            <ActionIcon className="size-3.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <CardData data={data[widget.id]} />
                </section>
              );
            })}
          </div>
        ) : (
          <section className="mx-auto flex max-w-xl flex-col items-center rounded-[24px] border border-border bg-card px-6 py-12 text-center shadow-sm">
            <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-muted"><HeartPulse className="size-6 text-muted-foreground" /></span>
            <h2 className="text-[18px] font-semibold">Connect Garmin to load your dashboard</h2>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">This dashboard shows only readings from your connected Garmin account. It won’t fill in sample numbers.</p>
            {status?.configured === false ? (
              <p className="mt-5 rounded-xl bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">Garmin sign-in is not configured on this deployment.</p>
            ) : (
              <button onClick={connect} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-medium text-primary-foreground hover:opacity-90">Connect Garmin</button>
            )}
            {pageError && <button onClick={() => void loadData()} className="mt-3 text-[12px] text-muted-foreground underline">Try again</button>}
          </section>
        )}
      </main>
    </div>
  );
}
