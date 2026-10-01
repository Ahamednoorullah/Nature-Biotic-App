import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { getFROStockTxns, getProductsByStore } from "@/lib/data";
import { buildInventoryRows, getRealPurchases } from "./StoreInventory";


// Same executive list used across the app (Store Dashboard, etc.)


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

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const stockKey = (name: unknown, pack: unknown) =>
  `${norm(name)}|${norm(pack).replace(/\s+/g, "")}`;

// Stock as on a given date = purchases - delivered to FRO + returned by FRO - direct sales
export function computeClosingStock(storeId: string, asOfDate: Date) {
  const qtyMap = new Map<
    string,
    { productName: string; packSize: string; qty: number; fallbackPrice: number }
  >();

  const add = (
    name: unknown,
    pack: unknown,
    qty: number,
    fallbackPrice = 0,
  ) => {
    const productName = String(name || "").trim();
    if (!productName) return;
    const key = stockKey(productName, pack);
    const existing = qtyMap.get(key);
    if (existing) {
      existing.qty += qty;
      if (!existing.fallbackPrice && fallbackPrice) {
        existing.fallbackPrice = fallbackPrice;
      }
    } else {
      qtyMap.set(key, {
        productName,
        packSize: String(pack || "-"),
        qty,
        fallbackPrice,
      });
    }
  };

  const isAfter = (value: unknown) => {
    const d = new Date(String(value));
    return !Number.isNaN(d.getTime()) && d > asOfDate;
  };

  // 1) Stock received from Company (+)  (only real data)
  getRealPurchases(storeId).forEach((row: any) => {
    if (isAfter(row.date)) return;
    add(
      row.product || row.productName,
      row.packSize || row.pkgsize,
      Number(row.quantity || 0),
      Number(row.unitPrice ?? row.rate ?? row.price ?? 0),
    );
  });

  // 2) Delivered to FRO (-) and Returned by FRO (+)
  getFROStockTxns(storeId).forEach((t) => {
    if (isAfter(t.date)) return;
    if (t.type === "Delivery") {
      add(t.productName, t.packSize, -Math.abs(t.qty), Number(t.unitValue || 0));
    } else if (t.type === "Return") {
      add(t.productName, t.packSize, Math.abs(t.qty), Number(t.unitValue || 0));
    }
  });

  // 3) Direct sales from store (-)
  try {
    const raw = localStorage.getItem(`${SALES_STORAGE_KEY}:${storeId}`);
    const sales = raw ? JSON.parse(raw) : [];
    sales.forEach((sale: any) => {
      if (String(sale.through || "").toLowerCase() === "executive") return;
      const [d, m, y] = String(sale.date || "").split("/");
      if (!d || !m || !y) return;
      const saleDate = new Date(Number(`20${y}`), Number(m) - 1, Number(d));
      if (saleDate > asOfDate) return;
      (sale.products || []).forEach((p: any) => {
        add(
          p.product?.name,
          p.packSize || p.pkgsize,
          -Number(p.quantity || 0),
        );
      });
    });
  } catch {
    // ignore malformed local data
  }

  // Value = qty x selling price (same rule as Store Overview)
  const master = getProductsByStore(storeId);
  const priceOf = (name: string, pack: string, fallback: number) => {
    const m =
      master.find((p) => stockKey(p.name, p.size) === stockKey(name, pack)) ||
      master.find((p) => norm(p.name) === norm(name));
    const selling = Number(m?.sellingPrice ?? 0);
    return Math.round(selling > 0 ? selling : fallback);
  };

  const breakdown: Breakdown[] = Array.from(qtyMap.entries())
    .filter(([, r]) => r.qty > 0)
    .map(([key, r]) => ({
      key,
      productName: r.productName,
      packSize: r.packSize,
      qty: r.qty,
      value: r.qty * priceOf(r.productName, r.packSize, r.fallbackPrice),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalQty: breakdown.reduce((s, b) => s + b.qty, 0),
    totalValue: breakdown.reduce((s, b) => s + b.value, 0),
    breakdown,
  };
}

// Today's stock = exactly what Store Overview shows (Store Stock only)
export function liveStoreStock(storeId: string): Breakdown[] {
  const map = new Map<string, Breakdown>();
  const inventoryRows = buildInventoryRows(storeId, getRealPurchases(storeId));

  inventoryRows.forEach((p) => {
    p.packSizes.forEach((pack) => {
      const qty = Number(pack.availableStock || 0);
      if (qty <= 0) return;
      const total = pack.availableStock + pack.stockInHand;
      const unitPrice =
        pack.unitPrice ?? (total > 0 ? pack.stockValue / total : 0);
      addToMap(
        map,
        stockKey(p.productName, pack.packSize),
        p.productName,
        pack.packSize,
        qty,
        qty * unitPrice,
      );
    });
  });

  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function StockByDateFilter({
  selectedDate,
  onDateChange,
  items,
  totalQty,
  totalValue,
}: {
  selectedDate: string;
  onDateChange: (v: string) => void;
  items: Breakdown[];
  totalQty: number;
  totalValue: number;
}) {
  const dateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Select Date
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          />
        </label>
        <button
          type="button"
          onClick={() => onDateChange("")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Clear
        </button>
        <div className="ml-auto flex gap-4 text-sm text-slate-500">
          <span>Store Stock Qty: <b className="text-slate-800">{totalQty}</b></span>
          <span>Stock Value: <b className="text-indigo-700">{formatCurrency(totalValue)}</b></span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[600px] table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="w-[8%] px-4 py-3 text-center">S.No</th>
              <th className="w-[16%] px-4 py-3 text-left">Date</th>
              <th className="w-[30%] px-4 py-3 text-left">Product</th>
              <th className="w-[16%] px-4 py-3 text-center">Pack Size</th>
              <th className="w-[14%] px-4 py-3 text-right">Qty</th>
              <th className="w-[16%] px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {selectedDate
                    ? "No store stock on this date."
                    : "Select a date to see the store stock."}
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-center text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-600">{dateLabel}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.productName}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{item.packSize}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{item.qty}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatCurrency(item.value)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ClosingStock({ storeId }: { storeId: string }) {
  const [selectedRow, setSelectedRow] = useState<MonthRow | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [filterDate, setFilterDate] = useState(""); // "YYYY-MM-DD"

  const dateStock = useMemo(() => {
  if (!filterDate) return { items: [] as Breakdown[], qty: 0, value: 0 };
  const [y, m, d] = filterDate.split("-").map(Number);
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59);
  const isToday = endOfDay.toDateString() === new Date().toDateString();

  const items = (
    isToday ? liveStoreStock(storeId) : computeClosingStock(storeId, endOfDay).breakdown
  ).filter((b) => b.qty > 0);

  return {
    items,
    qty: items.reduce((s, b) => s + b.qty, 0),
    value: items.reduce((s, b) => s + b.value, 0),
  };
}, [storeId, filterDate]);


    const rows = useMemo<MonthRow[]>(() => {
    const periods = getLastNMonthEnds(6);

    return periods
      .map(({ label, date }, index) => {
        const isCurrent = index === periods.length - 1;
        const breakdown = isCurrent
          ? liveStoreStock(storeId)
          : computeClosingStock(storeId, date).breakdown;

        return {
          label,
          isoDate: date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          qty: breakdown.reduce((s, b) => s + b.qty, 0),
          value: breakdown.reduce((s, b) => s + b.value, 0),
          breakdown,
        };
      })
      // hide old months that have no stock; always keep the current month
      .filter((r, i, arr) => i === arr.length - 1 || r.qty > 0);
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
                      {showDateFilter && filterDate ? dateStock.qty : selectedRow.qty}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total Value
                    </span>
                    <span className="closing-stock-print-total-value text-lg font-extrabold text-indigo-700">
                      {formatCurrency(showDateFilter && filterDate ? dateStock.value : selectedRow.value)}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setShowDateFilter((v) => !v)}
                    className={`inline-flex items-center rounded-xl border px-4 py-3 text-xs font-semibold uppercase tracking-wide transition closing-stock-print-hide ${
                      showDateFilter
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                  Date Filter
                  </button>
                </div>
              </div>

              {showDateFilter ? (
                <StockByDateFilter
                  selectedDate={filterDate}
                  onDateChange={setFilterDate}
                  items={dateStock.items}
                  totalQty={dateStock.qty}
                  totalValue={dateStock.value}
                />
              ) : (
                <>
             
                
                  <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[600px] table-fixed text-sm">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="w-[8%] px-4 py-3 text-center">S.No</th>
                          <th className="w-[16%] px-4 py-3 text-left">Date</th>
                          <th className="w-[30%] px-4 py-3 text-left">Product</th>
                          <th className="w-[16%] px-4 py-3 text-center">Pack Size</th>
                          <th className="w-[14%] px-4 py-3 text-right">Qty</th>
                          <th className="w-[16%] px-4 py-3 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedRow.breakdown.length === 0 ? (
                          <tr> 
                            <td
                              colSpan={6}
                              className="px-4 py-10 text-center text-slate-400"
                            >
                              No stock records for this period.
                            </td>
                          </tr>
                        ) : (
                          selectedRow.breakdown.map((item, index) => (
                            <tr key={item.key} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                            <td className="px-4 py-3 text-slate-600">{selectedRow.isoDate}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.productName}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{item.packSize}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{item.qty}</td>
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
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
      </div>
    );
  }
