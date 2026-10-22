import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartSpec } from "@/lib/chart";

const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

/** Render a chart the assistant asked for, using the shared theme tokens. */
export function ChatChart({ spec }: { spec: ChartSpec }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const axisProps = {
    tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
    tickLine: false,
    axisLine: false,
  } as const;

  const plot = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
      <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={18} {...axisProps} />
      <YAxis width={38} {...axisProps} />
      <Tooltip
        cursor={{ stroke: "var(--color-border)" }}
        contentStyle={{
          fontSize: 12,
          borderRadius: 10,
          border: "1px solid var(--color-border)",
          background: "var(--color-card)",
          color: "var(--color-card-foreground)",
        }}
        labelStyle={{ color: "var(--color-muted-foreground)", fontSize: 11 }}
      />
    </>
  );

  return (
    <figure className="my-4 overflow-hidden rounded-xl border border-border bg-card p-3">
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

      <div className="h-[220px] w-full">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            {spec.type === "bar" ? (
              <BarChart data={rows} margin={{ top: 4, right: 6, bottom: 0, left: -8 }}>
                {plot}
                {spec.series.map((series, index) => (
                  <Bar
                    key={index}
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

      {spec.series.length > 1 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          {spec.series.map((series, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
              />
              {series.name ?? `Series ${index + 1}`}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
