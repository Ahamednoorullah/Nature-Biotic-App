import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, Select, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { products as allProducts } from "@/lib/data";
import { computeClosingStock, liveStoreStock } from "./ClosingStock";

const PHYSICAL_STORAGE_KEY = "nature-biotic-physical-stock-entries-v1";

type EntryRow = {
  key: string;
  productId: string;
  productName: string;
  packSize: string;
  qty: number;
  unitPrice: number;
};

type SavedEntry = {
  id: string;
  date: string;
  rows: EntryRow[];
  totalQty: number;
  totalValue: number;
  systemQty: number;
  systemValue: number;
  isMatch: boolean;
};

function emptyRow(): EntryRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productId: "",
    productName: "",
    packSize: "",
    qty: 0,
    unitPrice: 0,
  };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// System stock for the selected date = same logic as Closing Stock
// (Store Stock only, Hand Stock is not counted)
function systemTotalsFor(storeId: string, dateISO: string) {
  const [y, m, d] = (dateISO || "").split("-").map(Number);
  const now = new Date();
  const endOfDay = y && m && d ? new Date(y, m - 1, d, 23, 59, 59) : now;
  const isToday = endOfDay.toDateString() === now.toDateString();

  const items = isToday
    ? liveStoreStock(storeId)
    : computeClosingStock(storeId, endOfDay).breakdown;

  return {
    totalQty: items.reduce((s, b) => s + b.qty, 0),
    totalValue: items.reduce((s, b) => s + b.value, 0),
  };
}

export default function PhysicalStockEntry({ storeId }: { storeId: string }) {
  const storageKey = `${PHYSICAL_STORAGE_KEY}:${storeId}`;
  const [selectedEntry, setSelectedEntry] = useState<SavedEntry | null>(null);
  const [entryDate, setEntryDate] = useState(todayISO());

  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [rows, setRows] = useState<EntryRow[]>([emptyRow()]);
  const [lastResult, setLastResult] = useState<SavedEntry | null>(null);

  const productChoices = useMemo(
    () => allProducts.map((p) => ({ value: p.id, label: p.name })),
    [],
  );

  function updateRow(key: string, patch: Partial<EntryRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function selectProduct(key: string, productId: string) {
    const product = allProducts.find((p) => p.id === productId);
    updateRow(key, {
      productId,
      productName: product?.name || "",
      packSize: product?.size || "",
      unitPrice: product?.sellingPrice || 0,
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.key !== key) : prev,
    );
  }

  const enteredTotalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
  const enteredTotalValue = rows.reduce(
    (s, r) => s + Number(r.qty || 0) * Number(r.unitPrice || 0),
    0,
  );

  const { totalQty: systemQty, totalValue: systemValue } = systemTotalsFor(
    storeId,
    entryDate,
  );

  const submitEvent = () => {
    const validRows = rows.filter(
      (row) => row.productId || row.qty > 0 || row.unitPrice > 0,
    );
    if (validRows.length === 0) return;

    const result: SavedEntry = {
      id: `${Date.now()}`,
      date: entryDate,
      rows: validRows,
      totalQty: enteredTotalQty,
      totalValue: enteredTotalValue,
      systemQty,
      systemValue,
      isMatch:
        enteredTotalQty === systemQty &&
        Math.round(enteredTotalValue) === Math.round(systemValue),
    };

    const next = [result, ...savedEntries];
    setLastResult(result);
    setSavedEntries(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .physical-stock-print, .physical-stock-print * { visibility: visible !important; }
          .physical-stock-print {
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
        }
      `}</style>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Physical Stock Entry
        </h1>
        <p className="mt-1 text-slate-500">
          Enter the actual stock counted at the store. It's checked against
          the calculated closing stock.
        </p>
      </div>

      <Card className="p-4 mb-6">
        <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
          Enter Physical Stock
        </h4>

        <div className="mb-4 max-w-[220px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="mt-1 block h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
            />
          </label>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <Select
                label="Product"
                value={row.productId}
                onChange={(v) => selectProduct(row.key, v)}
                placeholder="Select product"
                options={productChoices}
              />
              <Input
                label="Pack Size"
                value={row.packSize}
                onChange={() => {}}
                readOnly
              />
              <Input
                label="Qty (counted)"
                type="number"
                value={String(row.qty)}
                onChange={(v) => updateRow(row.key, { qty: Number(v) || 0 })}
              />
              <Input
                label="Unit Price"
                type="number"
                value={String(row.unitPrice)}
                onChange={(v) =>
                  updateRow(row.key, { unitPrice: Number(v) || 0 })
                }
              />
              <Button
                variant="secondary"
                onClick={() => removeRow(row.key)}
                className="h-[42px]"
              >
                <Icon name="delete" size={16} />
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <Button variant="secondary" onClick={addRow}>
            <Icon name="add" size={18} />
            Add Row
          </Button>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              Total Qty:{" "}
              <span className="font-bold text-slate-800">
                {enteredTotalQty}
              </span>
            </span>
            <span className="text-slate-500">
              Total Value:{" "}
              <span className="font-bold text-slate-800">
                {formatCurrency(enteredTotalValue)}
              </span>
            </span>
          </div>

          <Button onClick={submitEvent}>
            <Icon name="check_circle" size={18} />
            Submit & Verify
          </Button>
        </div>
      </Card>

      {lastResult && (
        <Card
          className={`physical-stock-print p-5 mb-6 border-2 ${
            lastResult.isMatch
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-red-200 bg-red-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon
              name={lastResult.isMatch ? "check_circle" : "error"}
              size={28}
              className={lastResult.isMatch ? "text-emerald-600" : "text-red-600"}
            />
            <div>
              <p
                className={`font-bold ${
                  lastResult.isMatch ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {lastResult.isMatch
                  ? "Stock Verified — Correct"
                  : "Mismatch Found"}
              </p>
              <p className="text-sm text-slate-600">
                Physical: {lastResult.totalQty} qty /{" "}
                {formatCurrency(lastResult.totalValue)} — System:{" "}
                {lastResult.systemQty} qty /{" "}
                {formatCurrency(lastResult.systemValue)}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th className="w-[8%] px-2 py-3 text-center font-semibold border-r border-slate-200">
                S.No
              </th>
              <th className="w-[17%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                Date
              </th>
              <th className="w-[15%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                Physical Qty
              </th>
              <th className="w-[20%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                Physical Value
              </th>
              <th className="w-[15%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                System Qty
              </th>
              <th className="w-[15%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                System Value
              </th>
              <th className="w-[10%] px-2 py-3 text-center font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {savedEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No physical stock entries yet.
                </td>
              </tr>
            ) : (
              savedEntries.map((entry, i) => (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`cursor-pointer border-b border-slate-100 ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  } hover:bg-slate-50`}
                >
                  <td className="px-2 py-3 text-center text-slate-500">
                    {i + 1}
                  </td>
                  <td className="px-2 py-3 font-semibold text-slate-800">
                    {entry.date}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {entry.totalQty}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {formatCurrency(entry.totalValue)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {entry.systemQty}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {formatCurrency(entry.systemValue)}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        entry.isMatch
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {entry.isMatch ? "Correct" : "Mismatch"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {selectedEntry &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex h-[76vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <h3 className="font-bold text-slate-800">
                    Physical Stock — {selectedEntry.date}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      selectedEntry.isMatch
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {selectedEntry.isMatch ? "Correct" : "Mismatch"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={19} />
                </button>
              </div>

              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Physical Qty
                    </span>
                    <span className="text-lg font-extrabold text-slate-800">
                      {selectedEntry.totalQty}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Physical Value
                    </span>
                    <span className="text-lg font-extrabold text-indigo-700">
                      {formatCurrency(selectedEntry.totalValue)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[600px] table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[8%] px-4 py-3 text-center">S.No</th>
                      <th className="w-[42%] px-4 py-3 text-left">Product</th>
                      <th className="w-[20%] px-4 py-3 text-center">
                        Pack Size
                      </th>
                      <th className="w-[15%] px-4 py-3 text-right">Qty</th>
                      <th className="w-[15%] px-4 py-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.rows.map((row, index) => (
                      <tr key={row.key} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {row.productName}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.packSize}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {row.qty}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {formatCurrency(row.qty * row.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedEntry(null)}
                >
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