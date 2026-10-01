import { formatCurrency } from "@/lib/format";

export type ChartPoint = { label: string; value: number };

export function ReportChartEmpty() {
  return (
    <p className="mt-4 text-sm text-slate-500">No data available for this period.</p>
  );
}

function hasValue(points: ChartPoint[]) {
  return points.some((point) => point.value > 0);
}

export function TrendBars({
  title,
  points,
  format = "currency",
}: {
  title: string;
  points: ChartPoint[];
  format?: "currency" | "count";
}) {
  const label = (value: number) =>
    format === "count" ? String(value) : formatCurrency(value);
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {!hasValue(points) ? (
        <ReportChartEmpty />
      ) : (
        <div className="mt-4">
          <div className="flex h-36 items-end gap-1">
            {points.map((point, index) => {
              const max = Math.max(...points.map((item) => item.value), 1);
              return (
                <div
                  key={`${point.label}-${index}`}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end"
                  title={`${point.label}: ${label(point.value)}`}
                >
                  <div
                    className="w-full max-w-8 rounded-t bg-brand-700"
                    style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 4 : 0)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1">
            {points.map((point, index) => (
              <span
                key={`label-${point.label}-${index}`}
                className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500"
              >
                {points.length > 14 ? "" : point.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CompareBars({
  title,
  points,
}: {
  title: string;
  points: { label: string; sales: number; collection: number }[];
}) {
  const visible = points.some((point) => point.sales > 0 || point.collection > 0);
  const max = Math.max(
    1,
    ...points.map((point) => Math.max(point.sales, point.collection)),
  );
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {!visible ? (
        <ReportChartEmpty />
      ) : (
        <div className="mt-4">
          <div className="flex h-36 items-end gap-1">
            {points.map((point) => (
              <div
                key={point.label}
                className="flex min-w-0 flex-1 items-end gap-0.5"
                title={`Sales ${formatCurrency(point.sales)} · Collection ${formatCurrency(point.collection)}`}
              >
                <div
                  className="w-1/2 rounded-t bg-brand-700"
                  style={{ height: `${(point.sales / max) * 100}%` }}
                />
                <div
                  className="w-1/2 rounded-t bg-brand-300"
                  style={{ height: `${(point.collection / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-700" /> Sales
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-300" /> Collection
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HorizontalBars({
  title,
  points,
  format = "currency",
}: {
  title: string;
  points: ChartPoint[];
  format?: "currency" | "count";
}) {
  const rows = points.filter((point) => point.value > 0);
  const max = Math.max(1, ...rows.map((point) => point.value));
  const label = (value: number) =>
    format === "count" ? String(value) : formatCurrency(value);
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {rows.length === 0 ? (
        <ReportChartEmpty />
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((point) => (
            <div key={point.label}>
              <div className="mb-1 flex justify-between gap-3 text-xs text-slate-500">
                <span className="truncate">{point.label}</span>
                <span className="shrink-0">{label(point.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-brand-600"
                  style={{ width: `${(point.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const donutColors = ["#166534", "#22c55e", "#86efac", "#14532d", "#4ade80", "#064e3b"];

export function CategoryDonut({
  title,
  points,
  format = "currency",
}: {
  title: string;
  points: ChartPoint[];
  format?: "currency" | "count";
}) {
  const rows = points.filter((point) => point.value > 0);
  const total = rows.reduce((sum, point) => sum + point.value, 0);
  const label = (value: number) =>
    format === "count" ? String(value) : formatCurrency(value);
  let cursor = 0;
  const stops = rows.map((point, index) => {
    const start = cursor;
    cursor += (point.value / total) * 100;
    return `${donutColors[index % donutColors.length]} ${start}% ${cursor}%`;
  });
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {total <= 0 ? (
        <ReportChartEmpty />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div
            className="h-28 w-28 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${stops.join(", ")})` }}
          />
          <div className="min-w-0 space-y-2 text-sm">
            {rows.map((point, index) => (
              <div key={point.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: donutColors[index % donutColors.length] }}
                />
                <span className="truncate text-slate-500">{point.label}</span>
                <span className="font-semibold text-slate-800">{label(point.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
