import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-card-foreground)",
};

function withUnit(value: number, unit?: string): string {
  const text = formatChartValue(value);
  if (!unit) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

function seriesAxis(series: ChartSeries): "left" | "right" {
  return series.axis === "right" ? "right" : "left";
}

/** Render a chart the assistant asked for, using the shared theme tokens. */
export function ChatChart({ spec }: { spec: ChartSpec }) {
  const [mounted, setMounted] = useState(false);
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

  const axisProps = {
    tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
    tickLine: false,
    axisLine: false,
  } as const;

  const tooltip = (
    <Tooltip
      cursor={{ stroke: "var(--color-border)" }}
      contentStyle={TOOLTIP_STYLE}
      labelStyle={{ color: "var(--color-muted-foreground)", fontSize: 11 }}
      formatter={(value, name) => [withUnit(Number(value), spec.unit), name]}
    />
  );

  const plot = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
      <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={18} {...axisProps} />
      <YAxis
        yAxisId="left"
        width={38}
        domain={leftDomain}
        tickFormatter={formatChartValue}
        {...axisProps}
      />
      {hasRightAxis && (
        <YAxis
          yAxisId="right"
          orientation="right"
          width={38}
          domain={rightDomain}
          tickFormatter={formatChartValue}
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
      {tooltip}
    </>
  );

  const legend =
    spec.type === "pie"
      ? slices.map((slice, index) => ({
          label: `${slice.label} · ${withUnit(slice.value, spec.unit)} · ${slice.share}%`,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
        }))
      : spec.series.length > 1
        ? spec.series.map((series, index) => ({
            label: series.name ?? `Series ${index + 1}`,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
          }))
        : [];

  return (
    <figure
      aria-label={spec.title ?? "Chart"}
      className="my-4 overflow-hidden rounded-xl border border-border bg-card p-3"
    >
      {(spec.title || spec.unit) && (
        <figcaption className="mb-2 flex items-baseline gap-2 px-1">
          {spec.title && <span className="text-[12.5px] font-medium">{spec.title}</span>}
          {spec.unit && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {spec.unit}
            </span>
          )}
        </figcaption>
      )}

      {stats.length > 0 && (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
          {stats.map((stat) => (
            <span key={stat.name} className="inline-flex items-baseline gap-1.5 text-[11px]">
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

      <div className="h-[220px] w-full">
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
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [withUnit(Number(value), spec.unit), name]}
                />
              </PieChart>
            ) : spec.type === "bar" ? (
              <BarChart data={rows} margin={{ top: 4, right: 6, bottom: 0, left: -8 }}>
                {plot}
                {spec.series.map((series, index) => (
                  <Bar
                    key={index}
                    yAxisId={seriesAxis(series)}
                    dataKey={`s${index}`}
                    name={series.name ?? `Series ${index + 1}`}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                ))}
              </BarChart>
            ) : spec.type === "area" ? (
              <AreaChart data={rows} margin={{ top: 4, right: 6, bottom: 0, left: -8 }}>
                {plot}
                {spec.series.map((series, index) => (
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
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={rows} margin={{ top: 4, right: 6, bottom: 0, left: -8 }}>
                {plot}
                {spec.series.map((series, index) => (
                  <Line
                    key={index}
                    yAxisId={seriesAxis(series)}
                    type="monotone"
                    dataKey={`s${index}`}
                    name={series.name ?? `Series ${index + 1}`}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {legend.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          {legend.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className="size-1.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
