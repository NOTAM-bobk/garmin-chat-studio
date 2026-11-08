import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  axisValues,
  chartBounds,
  formatChartValue,
  seriesChange,
  type ChartSeries,
  type ChartSpec,
} from "@/lib/chart";
import { cn } from "@/lib/utils";

const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const AXIS_TEXT = { fontSize: 10, fill: "var(--color-muted-foreground)" } as const;

function withUnit(value: number, unit?: string): string {
  const text = formatChartValue(value);
  if (!unit) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

function seriesAxis(series: ChartSeries): "left" | "right" {
  return series.axis === "right" ? "right" : "left";
}

type TooltipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: { fill?: string; label?: string; value?: number } | null;
};

/**
 * Hover/tap readout. Shows every visible series at the hovered x, so a bar does
 * not have to be guessed from its height, plus the shared unit once.
 */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
  names,
}: {
  active?: boolean | undefined;
  payload?: TooltipEntry[] | undefined;
  label?: string | number | undefined;
  unit?: string | undefined;
  names?: Record<string, string> | undefined;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2 text-[11.5px] shadow-sm">
      {label !== undefined && (
        <p className="mb-1 font-medium text-muted-foreground">{String(label)}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => {
          const key = String(entry.dataKey ?? entry.name ?? index);
          const name =
            names?.[key] ?? (typeof entry.name === "string" ? entry.name : undefined) ?? key;
          const color = entry.color ?? entry.payload?.fill ?? SERIES_COLORS[index % 5];
          return (
            <li key={key} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: color }} />
              <span className="text-muted-foreground">{name}</span>
              <span className="ml-auto pl-2 font-medium tabular-nums">
                {withUnit(Number(entry.value), unit)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Render a chart the assistant asked for, using the shared theme tokens.
 * `bare` drops the figure chrome so the chart can sit inside another card.
 */
export function ChatChart({ spec, bare = false }: { spec: ChartSpec; bare?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setMounted(true), []);

  const hasRightAxis = spec.series.some((series) => seriesAxis(series) === "right");

  const rows = useMemo(
    () =>
      spec.x.map((label, index) => {
        const row: Record<string, string | number> = { label };
        spec.series.forEach((series, seriesIndex) => {
          row[`s${seriesIndex}`] = series.data[index] ?? 0;
        });
        return row;
      }),
    [spec],
  );

  const slices = useMemo(() => {
    const total = spec.x.reduce(
      (sum, _, index) => sum + Math.abs(spec.series[0]?.data[index] ?? 0),
      0,
    );
    return spec.x.map((label, index) => {
      const value = spec.series[0]?.data[index] ?? 0;
      return {
        label,
        value,
        share: total > 0 ? Math.round((Math.abs(value) / total) * 100) : 0,
      };
    });
  }, [spec]);

  const stats = useMemo(
    () =>
      spec.type === "pie"
        ? []
        : spec.series.flatMap((series, index) => {
            const change = seriesChange(series);
            if (!change) return [];
            return [
              {
                key: `s${index}`,
                name: series.name ?? `Series ${index + 1}`,
                last: change.last,
                delta: change.delta,
              },
            ];
          }),
    [spec],
  );

  const leftValues = useMemo(() => {
    const values = axisValues(spec, "left");
    return spec.target !== undefined ? [...values, spec.target] : values;
  }, [spec]);

  const rightValues = useMemo(() => axisValues(spec, "right"), [spec]);

  const leftDomain = useMemo(
    () => chartBounds(leftValues, spec.type !== "line"),
    [leftValues, spec.type],
  );
  const rightDomain = useMemo(
    () => chartBounds(rightValues, spec.type !== "line"),
    [rightValues, spec.type],
  );

  // Series names by row key, so the tooltip can label `s0` as "Sleep score".
  const names = useMemo(() => {
    const map: Record<string, string> = {};
    spec.series.forEach((series, index) => {
      map[`s${index}`] = series.name ?? `Series ${index + 1}`;
    });
    return map;
  }, [spec]);

  const toggleSeries = (key: string) => {
    setHidden((previous) => {
      if (previous.includes(key)) return previous.filter((entry) => entry !== key);
      // Keep at least one series on screen; an empty plot reads as a broken chart.
      if (previous.length >= spec.series.length - 1) return previous;
      return [...previous, key];
    });
  };

  const axisProps = {
    tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
    tickLine: false,
    axisLine: { stroke: "var(--color-border)" },
  } as const;

  // Keep both axes explicit even when the model omits captions.
  const xLabel = spec.xLabel ?? "Date / period";
  const leftSeries = spec.series.filter((series) => seriesAxis(series) === "left");
  const rightSeries = spec.series.filter((series) => seriesAxis(series) === "right");
  const yLabel =
    spec.yLabel ??
    spec.unit ??
    (leftSeries.length === 1 ? (leftSeries[0]?.name ?? "Value") : "Value");
  const rightLabel = rightSeries.length === 1 ? (rightSeries[0]?.name ?? "Value") : "Value";
  const canBrush = spec.type !== "pie" && rows.length >= 10;

  const plot = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
      <XAxis
        dataKey="label"
        interval="preserveStartEnd"
        minTickGap={18}
        height={36}
        label={{
          value: xLabel,
          position: "insideBottom",
          offset: 0,
          fontSize: AXIS_TEXT.fontSize,
          fill: AXIS_TEXT.fill,
        }}
        {...axisProps}
      />
      <YAxis
        yAxisId="left"
        width={58}
        domain={leftDomain}
        tickFormatter={formatChartValue}
        label={{
          value: yLabel,
          angle: -90,
          position: "insideLeft",
          offset: 4,
          fontSize: AXIS_TEXT.fontSize,
          fill: AXIS_TEXT.fill,
        }}
        {...axisProps}
      />
      {hasRightAxis && (
        <YAxis
          yAxisId="right"
          orientation="right"
          width={58}
          domain={rightDomain}
          tickFormatter={formatChartValue}
          label={{
            value: rightLabel,
            angle: 90,
            position: "insideRight",
            offset: 4,
            fontSize: AXIS_TEXT.fontSize,
            fill: AXIS_TEXT.fill,
          }}
          {...axisProps}
        />
      )}
      {spec.target !== undefined && (
        <ReferenceLine
          y={spec.target}
          yAxisId="left"
          stroke="var(--color-muted-foreground)"
          strokeDasharray="4 4"
          strokeWidth={1}
          label={{
            value: spec.targetLabel ?? formatChartValue(spec.target),
            position: "insideTopRight",
            fontSize: 10,
            fill: "var(--color-muted-foreground)",
          }}
        />
      )}
      <Tooltip
        cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 3" }}
        wrapperStyle={{ outline: "none" }}
        content={<ChartTooltip unit={spec.unit} names={names} />}
      />
    </>
  );

  const legend =
    spec.type === "pie"
      ? slices.map((slice, index) => ({
          key: `slice-${index}`,
          label: `${slice.label} · ${withUnit(slice.value, spec.unit)} · ${slice.share}%`,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
          hidden: false,
        }))
      : spec.series.length > 1
        ? spec.series.map((series, index) => ({
            key: `s${index}`,
            label: series.name ?? `Series ${index + 1}`,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
            hidden: hidden.includes(`s${index}`),
          }))
        : [];

  const chartHeight = bare
    ? spec.type === "pie"
      ? 190
      : canBrush
        ? 258
        : 236
    : spec.type === "pie"
      ? 220
      : canBrush
        ? 282
        : 260;

  return (
    <figure
      aria-label={spec.title ?? "Chart"}
      className={
        bare
          ? "overflow-hidden"
          : "my-4 overflow-hidden rounded-xl border border-border bg-card p-3"
      }
    >
      {(spec.title || spec.unit) && (
        <figcaption className={cn("mb-2 flex items-baseline gap-2", !bare && "px-1")}>
          {spec.title && <span className="text-[12.5px] font-medium">{spec.title}</span>}
          {spec.unit && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {spec.unit}
            </span>
          )}
        </figcaption>
      )}

      {stats.length > 0 && (
        <div className={cn("mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1", !bare && "px-1")}>
          {stats.map((stat) => (
            <span
              key={stat.key}
              className={
                hidden.includes(stat.key)
                  ? "hidden"
                  : "inline-flex items-baseline gap-1.5 text-[11px]"
              }
            >
              {spec.series.length > 1 && <span className="text-muted-foreground">{stat.name}</span>}
              <span className="font-medium tabular-nums">{withUnit(stat.last, spec.unit)}</span>
              {stat.delta !== 0 && (
                <span className="tabular-nums text-muted-foreground">
                  {stat.delta > 0 ? "↑" : "↓"} {withUnit(Math.abs(stat.delta), spec.unit)} since{" "}
                  {spec.x[0]}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="w-full" style={{ height: chartHeight }}>
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            {spec.type === "pie" ? (
              <PieChart margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={84}
                  paddingAngle={1.5}
                  stroke="var(--color-card)"
                  strokeWidth={1.5}
                >
                  {slices.map((slice, index) => (
                    <Cell key={slice.label} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ outline: "none" }}
                  content={<ChartTooltip unit={spec.unit} />}
                />
              </PieChart>
            ) : spec.type === "bar" ? (
              <BarChart
                data={rows}
                margin={{ top: 6, right: hasRightAxis ? 4 : 8, bottom: 0, left: 0 }}
              >
                {plot}
                {canBrush && (
                  <Brush
                    dataKey="label"
                    height={20}
                    travellerWidth={10}
                    ariaLabel="Chart date range"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-muted)"
                  />
                )}
                {spec.series.map((series, index) =>
                  hidden.includes(`s${index}`) ? null : (
                    <Bar
                      key={index}
                      yAxisId={seriesAxis(series)}
                      dataKey={`s${index}`}
                      name={series.name ?? `Series ${index + 1}`}
                      fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={38}
                      activeBar={{ stroke: "var(--color-foreground)", strokeWidth: 1 }}
                    />
                  ),
                )}
              </BarChart>
            ) : spec.type === "area" ? (
              <AreaChart
                data={rows}
                margin={{ top: 6, right: hasRightAxis ? 4 : 8, bottom: 0, left: 0 }}
              >
                {plot}
                {canBrush && (
                  <Brush
                    dataKey="label"
                    height={20}
                    travellerWidth={10}
                    ariaLabel="Chart date range"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-muted)"
                  />
                )}
                {spec.series.map((series, index) =>
                  hidden.includes(`s${index}`) ? null : (
                    <Area
                      key={index}
                      yAxisId={seriesAxis(series)}
                      type="monotone"
                      dataKey={`s${index}`}
                      name={series.name ?? `Series ${index + 1}`}
                      stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                      fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                      fillOpacity={0.16}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ),
                )}
              </AreaChart>
            ) : (
              <LineChart
                data={rows}
                margin={{ top: 6, right: hasRightAxis ? 4 : 8, bottom: 0, left: 0 }}
              >
                {plot}
                {canBrush && (
                  <Brush
                    dataKey="label"
                    height={20}
                    travellerWidth={10}
                    ariaLabel="Chart date range"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-muted)"
                  />
                )}
                {spec.series.map((series, index) =>
                  hidden.includes(`s${index}`) ? null : (
                    <Line
                      key={index}
                      yAxisId={seriesAxis(series)}
                      type="monotone"
                      dataKey={`s${index}`}
                      name={series.name ?? `Series ${index + 1}`}
                      stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ),
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {legend.length > 0 && (
        <div className={cn("mt-1 flex flex-wrap items-center gap-x-1 gap-y-1", !bare && "px-1")}>
          {legend.map((item) =>
            spec.type === "pie" ? (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
              >
                <span className="size-1.5 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
            ) : (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleSeries(item.key)}
                aria-pressed={!item.hidden}
                aria-label={`${item.hidden ? "Show" : "Hide"} ${item.label}`}
                className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground"
                style={item.hidden ? { opacity: 0.45 } : undefined}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: item.hidden ? "var(--color-muted-foreground)" : item.color }}
                />
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </figure>
  );
}
