import {
  Activity,
  BatteryCharging,
  Droplets,
  Eye,
  EyeOff,
  Footprints,
  Gauge,
  HeartPulse,
  Maximize2,
  Minimize2,
  Moon,
  Scale,
  Sparkles,
  Timer,
  Trash2,
  TriangleAlert,
  Utensils,
  Waves,
} from "lucide-react";

import { ChatChart } from "@/components/chat/ChatChart";
import { factList, type Gadget, type GadgetReading } from "@/lib/dashboard-ai";
import { cn } from "@/lib/utils";

/** Pick an icon from the gadget's own wording; the tool name is the fallback. */
const ICONS: { match: RegExp; Icon: typeof Activity }[] = [
  { match: /sleep|nap|bed/i, Icon: Moon },
  { match: /hrv|variability|respiration|breath/i, Icon: Waves },
  { match: /battery|recovery|recharge/i, Icon: BatteryCharging },
  { match: /step|walk|floor|wellness/i, Icon: Footprints },
  { match: /heart|zone|pulse|spo2|oxygen/i, Icon: HeartPulse },
  { match: /stress/i, Icon: Gauge },
  { match: /hydrat|water|fluid/i, Icon: Droplets },
  { match: /nutrition|calorie|macro|meal|food/i, Icon: Utensils },
  { match: /weight|body|composition|fat/i, Icon: Scale },
  { match: /activit|workout|session|split|gear/i, Icon: Timer },
  { match: /load|readiness|training|vo2|fitness|race|endurance/i, Icon: Activity },
];

function iconFor(gadget: Gadget): typeof Activity {
  const haystack = `${gadget.title} ${gadget.tool}`;
  return ICONS.find((entry) => entry.match.test(haystack))?.Icon ?? Activity;
}

function Skeleton() {
  return (
    <div className="space-y-2 py-1" aria-hidden>
      <span className="block h-3 w-2/5 animate-pulse rounded-full bg-muted" />
      <span className="block h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      <span className="block h-3 w-4/5 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-2.5 py-1.5"
        >
          <dt className="min-w-0 text-[11.5px] leading-snug text-muted-foreground">{row.label}</dt>
          <dd className="max-w-[58%] break-words text-right text-[12px] font-medium tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One AI-chosen dashboard reading: a headline number, a chart, or a short
 * table. Rendering adapts to what the model managed to extract, so a gadget
 * still shows real Garmin numbers when the note or chart is missing.
 */
export function GadgetCard({
  gadget,
  reading,
  editing,
  className,
  onToggle,
  onSpan,
  onRemove,
}: {
  gadget: Gadget;
  reading: GadgetReading | undefined;
  editing: boolean;
  className?: string | undefined;
  onToggle: () => void;
  onSpan: () => void;
  onRemove: () => void;
}) {
  const Icon = iconFor(gadget);
  const loaded = reading?.state === "loaded";
  const facts = loaded ? factList(reading.text, gadget.kind === "list" ? 8 : 6) : null;

  return (
    <section
      aria-label={gadget.title}
      className={cn(
        "animate-in fade-in-0 group relative flex flex-col overflow-hidden rounded-[20px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(16,18,20,0.04)] transition-colors hover:border-foreground/15",
        gadget.span === "lg" && "md:col-span-2",
        editing && "ring-1 ring-dashed ring-brand/40",
        editing && !gadget.visible && "opacity-45",
        className,
      )}
    >
      <div className="mb-2.5 flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70">
          <Icon className="size-3.5" strokeWidth={2} />
        </span>
        <h2 className="truncate text-[13px] font-medium tracking-tight">{gadget.title}</h2>
        <span className="ml-auto shrink-0">
          {editing ? (
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onSpan}
                aria-label={gadget.span === "lg" ? "Make smaller" : "Make wider"}
                title={gadget.span === "lg" ? "Make smaller" : "Make wider"}
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {gadget.span === "lg" ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onToggle}
                aria-label={gadget.visible ? "Hide" : "Show"}
                title={gadget.visible ? "Hide" : "Show"}
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {gadget.visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove"
                title="Remove"
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ) : (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/60">
              {gadget.kind}
            </span>
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {!reading || reading.state === "loading" ? (
          <Skeleton />
        ) : reading.state === "error" ? (
          <p className="flex items-start gap-1.5 py-2 text-[12px] leading-relaxed text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-600" />
            <span className="min-w-0">{reading.text}</span>
          </p>
        ) : reading.state === "empty" ? (
          <p className="py-2 text-[12px] leading-relaxed text-muted-foreground">
            Garmin has no data for this reading yet.
          </p>
        ) : gadget.series ? (
          <>
            <ChatChart
              bare
              spec={{
                type: gadget.series.type,
                x: gadget.series.x,
                series: [{ name: gadget.series.label, data: gadget.series.y }],
                ...(gadget.series.unit ? { unit: gadget.series.unit } : {}),
              }}
            />
            {gadget.note && (
              <p className="mt-1 px-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {gadget.note}
              </p>
            )}
          </>
        ) : gadget.kind === "stat" && gadget.value ? (
          <div className="py-1">
            <p className="text-[26px] font-semibold leading-tight tracking-tight tabular-nums">
              {gadget.value}
            </p>
            {gadget.note && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {gadget.note}
              </p>
            )}
            {facts && facts.rows.length > 0 && (
              <div className="mt-2.5">
                <Rows rows={facts.rows.slice(0, 3)} />
              </div>
            )}
          </div>
        ) : (
          <>
            {gadget.value && (
              <p className="mb-1.5 text-[20px] font-semibold leading-tight tabular-nums">
                {gadget.value}
              </p>
            )}
            {gadget.note && (
              <p className="mb-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {gadget.note}
              </p>
            )}
            {facts && facts.rows.length > 0 ? (
              <Rows rows={facts.rows} />
            ) : (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {facts?.raw || reading.text.slice(0, 2400)}
              </pre>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** The card shown while the model is choosing a layout. */
export function DesigningCard({ className }: { className?: string | undefined }) {
  return (
    <section
      className={cn(
        "flex min-h-32 flex-col justify-center gap-2 rounded-[20px] border border-dashed border-border bg-card/60 p-3.5",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Sparkles className="size-3.5 animate-pulse" />
        Designing a gadget
      </span>
      <Skeleton />
    </section>
  );
}
