import { downloadDataTablePdf } from "@/lib/documentPdf";
import { formatCurrency, formatDate, type SimpleDateFilter } from "@/lib/format";

export function reportPeriodLabel(
  filter: SimpleDateFilter,
  customFrom = "",
  customTo = "",
) {
  if (filter === "custom" && (customFrom || customTo)) {
    return `${customFrom || "Start"} to ${customTo || "Today"}`;
  }
  return filter[0].toUpperCase() + filter.slice(1);
}

/** Empty string when the custom range is usable; otherwise a short validation message. */
export function customDateRangeError(from: string, to: string) {
  if (!from || !to) return "Select both start and end dates.";
  if (from > to) return "Start date cannot be after end date.";
  return "";
}

/** Effective from/to for filtering — blank when custom range is incomplete/invalid. */
export function effectiveCustomRange(
  filter: SimpleDateFilter,
  from: string,
  to: string,
): { from: string; to: string; error: string } {
  if (filter !== "custom") return { from: "", to: "", error: "" };
  const error = customDateRangeError(from, to);
  if (error) return { from: "", to: "", error };
  return { from, to, error: "" };
}

export function moneyPdf(value: number) {
  return formatCurrency(value).replace("₹", "Rs. ");
}

/** Export the currently filtered report rows/totals as PDF (same helper used elsewhere). */
export async function exportReportTablePdf(args: {
  fileName: string;
  title: string;
  scopeLabel: string;
  filter: SimpleDateFilter;
  customFrom?: string;
  customTo?: string;
  headers: string[];
  aligns?: Array<"left" | "right" | "center">;
  rows: string[][];
  total?: string[];
  emptyMessage?: string;
}) {
  const period = reportPeriodLabel(
    args.filter,
    args.customFrom || "",
    args.customTo || "",
  );
  await downloadDataTablePdf({
    fileName: args.fileName,
    heading: "Nature Biotic",
    title: args.title,
    storeName: args.scopeLabel,
    generatedOn: `Period: ${period} · Generated ${formatDate(new Date().toISOString().split("T")[0])}`,
    headers: args.headers,
    aligns: args.aligns,
    rows: args.rows,
    total: args.total,
    emptyMessage: args.emptyMessage || "No rows match the current filters.",
  });
}
