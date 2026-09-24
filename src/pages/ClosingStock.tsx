import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  getStorePurchasesFromCompanySales,
  getFROStockTxnsByExecutive,
} from "@/lib/data";

// Same executive list used across the app (Store Dashboard, etc.)
const EXECUTIVE_NAMES = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

const SALES_STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

type Breakdown = {
  key: string;
  productName: string;
  packSize: string;
  qty: number;
  value: number;
};

type MonthRow = {
  label: string;
  isoDate: string; // the "as of" date used for calculation
  qty: number;
  value: number;
  breakdown: Breakdown[];
};

function addToMap(
  map: Map<string, Breakdown>,
  key: string,
  productName: string,
  packSize: string,
  qty: number,
  value: number,
) {
  const existing = map.get(key);
  if (existing) {
    existing.qty += qty;
    existing.value += value;
  } else {
    map.set(key, { key, productName, packSize, qty, value });
  }
}

function computeClosingStock(storeId: string, asOfDate: Date) {
  const map = new Map<string, Breakdown>();
  let totalQty = 0;
  let totalValue = 0;

  // 1) Stock received from Company (+)
  const purchases = getStorePurchasesFromCompanySales(storeId) || [];
  purchases.forEach((row: any) => {
    const rowDate = new Date(row.date);
    if (rowDate > asOfDate) return;
    const qty = Number(row.quantity || 0);
    const value = Number(row.total || 0);
    totalQty += qty;
    totalValue += value;
    addToMap(
      map,
      `${row.product || row.productName || "Unknown"}|${row.packSize || ""}`,
      row.product || row.productName || "Unknown",
      row.packSize || "-",
      qty,
      value,
    );
  });

  // 2) Delivered to Executives (−) and Returned by Executives (+)
  EXECUTIVE_NAMES.forEach((name) => {
    const txns = getFROStockTxnsByExecutive(storeId, name) || [];
    txns.forEach((t: any) => {
      const txnDate = new Date(t.date);
      if (txnDate > asOfDate) return;
      const key = `${t.productName}|${t.packSize}`;
      const lineValue = Math.abs(t.qty) * Number(t.unitValue || 0);

      if (t.type === "Delivery") {
        totalQty -= Math.abs(t.qty);
        totalValue -= lineValue;
        addToMap(map, key, t.productName, t.packSize, -Math.abs(t.qty), -lineValue);
      } else if (t.type === "Return") {
        totalQty += Math.abs(t.qty);
        totalValue += lineValue;
        addToMap(map, key, t.productName, t.packSize, Math.abs(t.qty), lineValue);
      }
    });
  });

  // 3) Direct Sales from store (−)
  try {
    const raw = localStorage.getItem(`${SALES_STORAGE_KEY}:${storeId}`);
    const sales = raw ? JSON.parse(raw) : [];
    sales.forEach((sale: any) => {
      if (sale.through !== "Direct") return;
      const [d, m, y] = String(sale.date || "").split("/");
      if (!d || !m || !y) return;
      const saleDate = new Date(Number(`20${y}`), Number(m) - 1, Number(d));
      if (saleDate > asOfDate) return;

      (sale.products || []).forEach((p: any) => {
        const key = `${p.product?.name || "Unknown"}|${p.packSize || p.pkgsize || ""}`;
        totalQty -= Number(p.quantity || 0);
        totalValue -= Number(p.rowTotal || 0);
        addToMap(
          map,
          key,
          p.product?.name || "Unknown",
          p.packSize || p.pkgsize || "-",
          -Number(p.quantity || 0),
          -Number(p.rowTotal || 0),
        );
      });
    });
  } catch {
    // ignore malformed local data
  }

  const breakdown = Array.from(map.values()).sort(
    (a, b) => b.value - a.value,
  );

  return { totalQty, totalValue, breakdown };
}

function getLastNMonthEnds(n: number): { label: string; date: Date }[] {
  const result: { label: string; date: Date }[] = [];
  const now = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const isCurrentMonth = i === 0;
    const monthEnd = isCurrentMonth
      ? now
      : new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);

    const label = target.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });

    result.push({ label, date: monthEnd });
  }

  return result;
}

export default function ClosingStock({ storeId }: { storeId: string }) {
  const [selectedRow, setSelectedRow] = useState<MonthRow | null>(null);

  const rows = useMemo<MonthRow[]>(() => {
    const periods = getLastNMonthEnds(6);
    return periods.map(({ label, date }) => {
      const { totalQty, totalValue, breakdown } = computeClosingStock(
        storeId,
        date,
      );
      return {
        label,
        isoDate: date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        qty: totalQty,
        value: totalValue,
        breakdown,
      };
    });
  }, [storeId]);

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

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Closing Stock</h1>
        <p className="mt-1 text-slate-500">
          Month-end stock balance, calculated automatically from stock
          received, delivered, returned and direct sales.
        </p>
      </div>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th className="w-[10%] px-2 py-3 text-center font-semibold border-r border-slate-200">
                S.No
              </th>
              <th className="w-[35%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                Date
              </th>
              <th className="w-[25%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                Qty
              </th>
              <th className="w-[30%] px-2 py-3 text-right font-semibold">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                onClick={() => setSelectedRow(row)}
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
                    (as of {row.isoDate})
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-700">
                  {row.qty}
                </td>
                <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                  {formatCurrency(row.value)}
                </td>
              </tr>
            ))}
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
                    As of {selectedRow.isoDate}
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
                <table className="w-full min-w-[600px] table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[8%] px-4 py-3 text-center">S.No</th>
                      <th className="w-[35%] px-4 py-3 text-left">Product</th>
                      <th className="w-[20%] px-4 py-3 text-center">
                        Pack Size
                      </th>
                      <th className="w-[15%] px-4 py-3 text-right">Qty</th>
                      <th className="w-[15%] px-4 py-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRow.breakdown.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-slate-400"
                        >
                          No stock records for this period.
                        </td>
                      </tr>
                    ) : (
                        selectedRow.breakdown.map((item, index) => (
                        <tr key={item.key} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {item.packSize}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {item.qty}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                            {formatCurrency(item.value)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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