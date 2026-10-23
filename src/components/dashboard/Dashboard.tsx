import { useEffect, useState, type ReactNode } from "react";
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
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import {
  DEFAULT_LAYOUT,
  moveWidget,
  parseLayout,
  updateWidget,
  type WidgetId,
  type WidgetSlot,
} from "@/lib/dashboard-layout";

const STORAGE_KEY = "garmin-chat:dashboard-layout";

// Sample data until live Garmin data is wired in.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sleep = DAYS.map((d, i) => ({
  d,
  deep: [1.4, 1.1, 1.6, 0.9, 1.3, 1.8, 1.5][i],
  light: [3.8, 4.1, 3.6, 3.9, 4.2, 4.4, 3.7][i],
  rem: [1.6, 1.3, 1.9, 1.2, 1.5, 2.0, 1.7][i],
}));
const hrv = Array.from({ length: 28 }, (_, i) => ({
  d: i + 1,
  v: Math.round(58 + Math.sin(i / 3) * 6 + (i % 5) - 2),
  base: 60,
}));
const battery = Array.from({ length: 24 }, (_, h) => ({
  h: `${h}:00`,
  v: Math.max(8, Math.min(100, h < 7 ? 30 + h * 10 : 100 - (h - 7) * 5 + (h === 13 ? 8 : 0))),
}));
const load = DAYS.map((d, i) => ({ d, acute: [320, 410, 0, 520, 280, 690, 150][i] }));
const zones = [
  { name: "Z1", v: 22, c: "var(--chart-3)" },
  { name: "Z2", v: 41, c: "var(--chart-1)" },
  { name: "Z3", v: 18, c: "var(--chart-4)" },
  { name: "Z4", v: 13, c: "var(--chart-2)" },
  { name: "Z5", v: 6, c: "var(--destructive)" },
];

const tip = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
  },
};

const META: Record<WidgetId, { title: string; icon: typeof Activity }> = {
  readiness: { title: "Training readiness", icon: Activity },
  battery: { title: "Body Battery today", icon: BatteryCharging },
  steps: { title: "Steps", icon: Footprints },
  sleep: { title: "Sleep stages", icon: Moon },
  hrv: { title: "HRV · 28 days", icon: Waves },
  zones: { title: "Heart rate zones", icon: HeartPulse },
  load: { title: "Training load", icon: Timer },
  week: { title: "This week", icon: Activity },
};

function Gauge({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="relative h-40">
      <ResponsiveContainer>
        <RadialBarChart innerRadius="78%" outerRadius="100%" data={[{ v: value }]} startAngle={220} endAngle={-40}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="v" cornerRadius={20} fill={color} background={{ fill: "var(--muted)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-4xl font-semibold tabular-nums tracking-tight">{value}</div>
          <div className="text-[12px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

function renderWidget(id: WidgetId): ReactNode {
  switch (id) {
    case "readiness":
      return <Gauge value={78} color="var(--chart-1)" label="Ready to train" />;
    case "steps":
      return <Gauge value={84} color="var(--chart-3)" label="8,412 / 10,000" />;
    case "battery":
      return (
        <div className="h-44">
          <ResponsiveContainer>
            <AreaChart data={battery}>
              <defs>
                <linearGradient id="bb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="h" tick={{ fontSize: 11 }} interval={5} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} hide />
              <Tooltip {...tip} />
              <Area dataKey="v" name="Battery" stroke="var(--chart-1)" strokeWidth={2} fill="url(#bb)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    case "sleep":
      return (
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={sleep}>
              <XAxis dataKey="d" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis hide />
              <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="deep" name="Deep (h)" stackId="s" fill="var(--chart-5)" />
              <Bar dataKey="light" name="Light (h)" stackId="s" fill="var(--chart-1)" />
              <Bar dataKey="rem" name="REM (h)" stackId="s" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case "hrv":
      return (
        <div className="h-44">
          <ResponsiveContainer>
            <LineChart data={hrv}>
              <XAxis dataKey="d" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[45, 75]} hide />
              <Tooltip {...tip} />
              <Line dataKey="base" name="Baseline" stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} />
              <Line dataKey="v" name="HRV (ms)" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    case "load":
      return (
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={load}>
              <XAxis dataKey="d" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis hide />
              <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="acute" name="Load" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case "zones":
      return (
        <div className="flex h-40 items-center gap-3">
          <div className="h-full flex-1">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={zones} dataKey="v" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
                  {zones.map((z) => (
                    <Cell key={z.name} fill={z.c} stroke="none" />
                  ))}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-[12px]">
            {zones.map((z) => (
              <li key={z.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: z.c }} />
                {z.name} <span className="text-muted-foreground">{z.v}%</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "week":
      return (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Distance", "42.6 km"],
            ["Time", "5h 12m"],
            ["Activities", "6"],
            ["Resting HR", "48 bpm"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-muted p-3">
              <div className="text-[11px] text-muted-foreground">{k}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      );
  }
}

export function Dashboard() {
  const [layout, setLayout] = useState<WidgetSlot[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLayout(parseLayout(localStorage.getItem(STORAGE_KEY)));
  }, []);

  const save = (next: WidgetSlot[]) => {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const shown = editing ? layout : layout.filter((w) => w.visible);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4">
        <a
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to chat
        </a>
        <div className="flex items-center gap-1.5">
          {editing && (
            <button
              onClick={() => save(DEFAULT_LAYOUT)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-accent"
            >
              <RotateCcw className="size-3.5" /> Reset
            </button>
          )}
          <button
            onClick={() => setEditing((e) => !e)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              editing ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent",
            )}
          >
            <SlidersHorizontal className="size-3.5" /> {editing ? "Done" : "Customize"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 pb-16 sm:px-4">
        <div className="flex flex-wrap items-end justify-between gap-2 pt-2 pb-5">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Dashboard</h1>
            <p className="text-[13.5px] text-muted-foreground">Your training at a glance.</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] text-muted-foreground">
            Sample data · live Garmin data coming soon
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {shown.map((w, i) => {
            const meta = META[w.id];
            return (
              <section
                key={w.id}
                className={cn(
                  "animate-in fade-in-0 rounded-[22px] border border-border bg-card p-4 shadow-sm transition-opacity",
                  w.size === "lg" && "md:col-span-2",
                  editing && !w.visible && "opacity-45",
                  editing && "ring-1 ring-dashed ring-brand/40",
                )}
              >
                <div className="mb-2 flex min-w-0 items-center gap-2">
                  <meta.icon className="size-4 shrink-0 text-muted-foreground" />
                  <h2 className="truncate text-[13.5px] font-medium">{meta.title}</h2>
                  {editing && (
                    <div className="ml-auto flex shrink-0 items-center gap-0.5">
                      {[
                        { label: "Move up", Icon: ArrowUp, on: () => save(moveWidget(layout, w.id, -1)), off: i === 0 },
                        { label: "Move down", Icon: ArrowDown, on: () => save(moveWidget(layout, w.id, 1)), off: i === layout.length - 1 },
                        {
                          label: w.size === "lg" ? "Make smaller" : "Make wider",
                          Icon: w.size === "lg" ? Minimize2 : Maximize2,
                          on: () => save(updateWidget(layout, w.id, { size: w.size === "lg" ? "sm" : "lg" })),
                          off: false,
                        },
                        {
                          label: w.visible ? "Hide" : "Show",
                          Icon: w.visible ? Eye : EyeOff,
                          on: () => save(updateWidget(layout, w.id, { visible: !w.visible })),
                          off: false,
                        },
                      ].map(({ label, Icon, on, off }) => (
                        <button
                          key={label}
                          aria-label={label}
                          title={label}
                          disabled={off}
                          onClick={on}
                          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        >
                          <Icon className="size-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {renderWidget(w.id)}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
