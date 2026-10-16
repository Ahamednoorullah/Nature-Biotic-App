import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { usesSupabaseData } from "@/lib/db/mode";
import {
  finalizeStoreMonthClosingDb,
  loadStoreClosingStocks,
  loadStoreStockAsOf,
  type DbClosingStock,
  type DbClosingStockLine,
} from "@/lib/db/operations";
import { dbErrorMessage } from "@/lib/db/errors";

type MonthRow = {
  id: string;
  label: string;
  closingDate: string;
  yearMonth: string;
  qty: number;
  value: number;
  kind: "snapshot" | "live";
  source?: string;
  lines: DbClosingStockLine[];
};

type DateView =
  | {
      mode: "snapshot";
      label: string;
      asOf: string;
      lines: DbClosingStockLine[];
      qty: number;
      value: number;
      snapshotId: string;
    }
  | {
      mode: "ledger";
      label: string;
      asOf: string;
      lines: DbClosingStockLine[];
      qty: number;
      value: number;
    }
  | {
      mode: "error";
      asOf: string;
      message: string;
    }
  | {
      mode: "loading";
      asOf: string;
    };

function kolkataTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function monthLabel(yearMonth: string, closingDate: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (y && m) {
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  }
  return formatDate(closingDate);
}

function lastCompletedYearMonth() {
  const today = kolkataTodayISO();
  const [year, month] = today.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  d.setDate(0);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    closingDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  };
}

function toMonthRow(snapshot: DbClosingStock): MonthRow {
  return {
    id: snapshot.id,
    label: monthLabel(snapshot.yearMonth, snapshot.closingDate),
    closingDate: snapshot.closingDate,
    yearMonth: snapshot.yearMonth,
    qty: snapshot.totalQty,
    value: snapshot.totalValue,
    kind: snapshot.kind,
    source: snapshot.source,
    lines: snapshot.lines,
  };
}

function totals(lines: DbClosingStockLine[]) {
  return {
    qty: lines.reduce((sum, line) => sum + line.qty, 0),
    value: lines.reduce((sum, line) => sum + line.lineValue, 0),
  };
}

export default function ClosingStock({ storeId }: { storeId: string }) {
  const [selectedRow, setSelectedRow] = useState<MonthRow | null>(null);
  const [snapshots, setSnapshots] = useState<DbClosingStock[]>([]);
  const [listError, setListError] = useState("");
  const [closingBusy, setClosingBusy] = useState(false);
  const [closeMessage, setCloseMessage] = useState("");
  const [filterDate, setFilterDate] = useState(kolkataTodayISO);
  const [dateView, setDateView] = useState<DateView>({
    mode: "loading",
    asOf: kolkataTodayISO(),
  });

  const eligible = useMemo(() => lastCompletedYearMonth(), []);
  const todayISO = useMemo(() => kolkataTodayISO(), []);

  const reloadSnapshots = useCallback(async () => {
    if (!usesSupabaseData() || !storeId) {
      setSnapshots([]);
      return;
    }
    const saved = await loadStoreClosingStocks(storeId);
    setSnapshots(saved);
    setListError("");
  }, [storeId]);

  useEffect(() => {
    let active = true;
    reloadSnapshots().catch((error) => {
      if (!active) return;
      setSnapshots([]);
      setListError(dbErrorMessage(error, "Could not load closing stock."));
    });
    return () => {
      active = false;
    };
  }, [reloadSnapshots]);

  useEffect(() => {
    if (!usesSupabaseData() || !storeId || !filterDate) {
      setDateView({
        mode: "error",
        asOf: filterDate,
        message: "Select a date to view store stock.",
      });
      return;
    }

    let active = true;
    setDateView({ mode: "loading", asOf: filterDate });

    const snapshot = snapshots.find((row) => row.closingDate === filterDate);
    if (snapshot) {
      setDateView({
        mode: "snapshot",
        label: "Finalized Closing Snapshot",
        asOf: filterDate,
        lines: snapshot.lines,
        qty: snapshot.totalQty,
        value: snapshot.totalValue,
        snapshotId: snapshot.id,
      });
      return () => {
        active = false;
      };
    }

    loadStoreStockAsOf(storeId, filterDate)
      .then((lines) => {
        if (!active) return;
        const { qty, value } = totals(lines);
        setDateView({
          mode: "ledger",
          label: "Historical/Live Stock View",
          asOf: filterDate,
          lines,
          qty,
          value,
        });
      })
      .catch((error) => {
        if (!active) return;
        setDateView({
          mode: "error",
          asOf: filterDate,
          message: dbErrorMessage(
            error,
            "Could not reconstruct store stock for this date from the stock ledger.",
          ),
        });
      });

    return () => {
      active = false;
    };
  }, [storeId, filterDate, snapshots, todayISO]);

  const rows = useMemo<MonthRow[]>(() => snapshots.map(toMonthRow), [snapshots]);

  const needsFinalize = !snapshots.some(
    (row) => row.yearMonth === eligible.yearMonth,
  );

  async function finalizeEligibleMonth() {
    if (!usesSupabaseData()) return;
    setClosingBusy(true);
    setCloseMessage("");
    try {
      const result = await finalizeStoreMonthClosingDb(
        storeId,
        eligible.year,
        eligible.month,
      );
      await reloadSnapshots();
      setCloseMessage(
        result.already_finalized
          ? `Closing for ${result.year_month} was already finalized.`
          : `Finalized closing stock for ${result.year_month} (as of ${result.closing_date}).`,
      );
    } catch (error) {
      setCloseMessage(dbErrorMessage(error, "Could not finalize month-end closing."));
    } finally {
      setClosingBusy(false);
    }
  }

  function renderLinesTable(lines: DbClosingStockLine[], emptyMessage: string) {
    return (
      <table className="w-full min-w-[720px] table-fixed text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="w-[7%] px-4 py-3 text-center">S.No</th>
            <th className="w-[24%] px-4 py-3 text-left">Product</th>
            <th className="w-[12%] px-4 py-3 text-center">Pack Size</th>
            <th className="w-[14%] px-4 py-3 text-center">Batch</th>
            <th className="w-[13%] px-4 py-3 text-center">Expiry</th>
            <th className="w-[10%] px-4 py-3 text-right">Qty</th>
            <th className="w-[20%] px-4 py-3 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            lines.map((item, index) => (
              <tr
                key={`${item.variantId}-${item.batchId || index}`}
                className="hover:bg-slate-50"
              >
                <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {item.productName}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {item.packSize}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {item.batchNo || "-"}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {item.expiryDate ? formatDate(item.expiryDate) : "-"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">
                  {item.qty}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                  {formatCurrency(item.lineValue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .closing-stock-print, .closing-stock-print * { visibility: visible !important; }
          .closing-stock-print {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 700px !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 12px !important;
            max-height: none !important;
            height: auto !important;
          }
          .closing-stock-print-hide { display: none !important; }
          .closing-stock-print-total-value {
            font-size: 20px !important;
          }
        }
      `}</style>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Closing Stock</h1>
          <p className="mt-1 text-slate-500">
            Filter store stock by date (Asia/Kolkata). Finalized month-end
            snapshots are shown when the selected date matches a closing date;
            otherwise stock is reconstructed from the store ledger only.
          </p>
        </div>
        {usesSupabaseData() ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Button
              onClick={() => void finalizeEligibleMonth()}
              disabled={closingBusy || !needsFinalize}
            >
              <Icon name="event_available" size={18} />
              {closingBusy
                ? "Finalizing…"
                : needsFinalize
                  ? `Finalize ${eligible.yearMonth} closing`
                  : `${eligible.yearMonth} already finalized`}
            </Button>
            <p className="max-w-sm text-right text-[11px] text-slate-500">
              Changing the date filter never creates or overwrites a snapshot.
              Month-end finalize remains an explicit, idempotent action.
            </p>
          </div>
        ) : null}
      </div>

      {listError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {listError}
        </p>
      ) : null}
      {closeMessage ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {closeMessage}
        </p>
      ) : null}

      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stock as of date
            <input
              type="date"
              value={filterDate}
              max={todayISO}
              onChange={(e) => setFilterDate(e.target.value || todayISO)}
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilterDate(todayISO)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
          {dateView.mode === "snapshot" || dateView.mode === "ledger" ? (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  dateView.mode === "snapshot"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-sky-100 text-sky-700"
                }`}
              >
                {dateView.label}
              </span>
              <span className="text-sm text-slate-500">
                Qty{" "}
                <b className="text-slate-800">{dateView.qty}</b>
              </span>
              <span className="text-sm text-slate-500">
                Value{" "}
                <b className="text-indigo-700">
                  {formatCurrency(dateView.value)}
                </b>
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-h-[240px] overflow-auto">
          {dateView.mode === "loading" ? (
            <p className="px-4 py-10 text-center text-slate-400">
              Loading store stock for {formatDate(dateView.asOf)}…
            </p>
          ) : dateView.mode === "error" ? (
            <p className="px-4 py-10 text-center text-sm font-medium text-red-600">
              {dateView.message}
            </p>
          ) : (
            renderLinesTable(
              dateView.lines,
              dateView.mode === "snapshot"
                ? "No lines on this finalized closing snapshot."
                : "No store stock on this date (FRO hand stock is excluded).",
            )
          )}
        </div>
        {dateView.mode === "ledger" ? (
          <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
            Quantities are reconstructed from store stock movements with
            movement_date ≤ {formatDate(dateView.asOf)}. This is not a finalized
            closing snapshot.
          </p>
        ) : null}
        {dateView.mode === "snapshot" ? (
          <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
            Showing the saved month-end snapshot for {formatDate(dateView.asOf)}.
            Values are frozen at finalize time.
          </p>
        ) : null}
      </Card>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">
        Finalized month-end snapshots
      </h2>
      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th className="w-[10%] px-2 py-3 text-center font-semibold border-r border-slate-200">
                S.No
              </th>
              <th className="w-[35%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                Period
              </th>
              <th className="w-[20%] px-2 py-3 text-center font-semibold border-r border-slate-200">
                Type
              </th>
              <th className="w-[15%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                Qty
              </th>
              <th className="w-[20%] px-2 py-3 text-right font-semibold">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No finalized closing snapshots yet.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    setFilterDate(row.closingDate);
                    setSelectedRow(row);
                  }}
                  className={`cursor-pointer border-b border-slate-100 ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  } transition hover:bg-brand-50/30`}
                >
                  <td className="px-2 py-3 text-center font-medium text-slate-500">
                    {i + 1}
                  </td>
                  <td className="px-2 py-3 font-semibold text-slate-800">
                    {row.label}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      (closed {formatDate(row.closingDate)})
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Finalized Closing Snapshot
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-700">
                    {row.qty}
                  </td>
                  <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {selectedRow &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="closing-stock-print flex h-[76vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <h3 className="font-bold text-slate-800">
                    Closing Stock — {selectedRow.label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Finalized Closing Snapshot as of{" "}
                    {formatDate(selectedRow.closingDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 closing-stock-print-hide">
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Icon name="print" size={16} /> Print
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    <Icon name="close" size={19} />
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total Qty
                    </span>
                    <span className="text-lg font-extrabold text-slate-800">
                      {selectedRow.qty}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total Value
                    </span>
                    <span className="closing-stock-print-total-value text-lg font-extrabold text-indigo-700">
                      {formatCurrency(selectedRow.value)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {renderLinesTable(
                  selectedRow.lines,
                  "No store stock lines for this snapshot.",
                )}
              </div>
              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 closing-stock-print-hide">
                <Button variant="secondary" onClick={() => setSelectedRow(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
