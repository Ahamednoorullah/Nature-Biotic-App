import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, Select, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  getProductMaster,
  productMasterUpdatedEvent,
  type Product,
} from "@/lib/data";
import { usesSupabaseData } from "@/lib/db/mode";
import { loadCatalog } from "@/lib/db/products";
import {
  loadPhysicalCounts,
  loadStoreBatchesForVariant,
  recordPhysicalCountDb,
  type DbPhysicalCount,
  type DbStoreBatchOption,
} from "@/lib/db/operations";
import { dbErrorMessage } from "@/lib/db/errors";

const PHYSICAL_STORAGE_KEY = "nature-biotic-physical-stock-entries-v1";

type EntryRow = {
  key: string;
  productName: string;
  variantId: string;
  packSize: string;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  unitPrice: number;
  systemQty?: number;
  systemValue?: number;
  hasCapturedSystem?: boolean;
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
  systemBalanceSource?: "captured" | "unavailable";
};

function emptyRow(): EntryRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productName: "",
    variantId: "",
    packSize: "",
    batchId: "",
    batchNo: "",
    expiryDate: "",
    qty: 0,
    unitPrice: 0,
  };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function activeCatalog(): Product[] {
  return getProductMaster().filter(
    (product) => String(product.status || "").toLowerCase() !== "inactive",
  );
}

function mapDbCount(row: DbPhysicalCount): SavedEntry {
  const captured = row.lines.every((line) => line.hasCapturedSystem);
  return {
    id: row.id,
    date: row.date,
    totalQty: row.totalQty,
    totalValue: row.totalValue,
    systemQty: row.systemQty,
    systemValue: row.systemValue,
    isMatch: row.isMatch,
    systemBalanceSource: captured ? "captured" : "unavailable",
    rows: row.lines.map((line, index) => ({
      key: `${row.id}-${index}`,
      productName: line.productName,
      variantId: line.variantId,
      packSize: line.packSize,
      batchId: line.batchId || "",
      batchNo: line.batchNo || "",
      expiryDate: line.expiryDate || "",
      qty: line.qty,
      unitPrice: line.unitPrice,
      systemQty: line.systemQty,
      systemValue: line.systemValue,
      hasCapturedSystem: line.hasCapturedSystem,
    })),
  };
}

function diffClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-slate-600";
}

function formatSigned(value: number, asCurrency = false) {
  const abs = asCurrency ? formatCurrency(Math.abs(value)) : String(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return asCurrency ? formatCurrency(0) : "0";
}

export default function PhysicalStockEntry({ storeId }: { storeId: string }) {
  const storageKey = `${PHYSICAL_STORAGE_KEY}:${storeId}`;
  const [selectedEntry, setSelectedEntry] = useState<SavedEntry | null>(null);
  const [entryDate, setEntryDate] = useState(todayISO());
  const [catalog, setCatalog] = useState<Product[]>(() => activeCatalog());
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [batchOptions, setBatchOptions] = useState<Record<string, DbStoreBatchOption[]>>({});
  const [batchError, setBatchError] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>(() => {
    if (usesSupabaseData()) return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [rows, setRows] = useState<EntryRow[]>([emptyRow()]);
  const [lastResult, setLastResult] = useState<SavedEntry | null>(null);

  useEffect(() => {
    const sync = () => setCatalog(activeCatalog());
    sync();
    window.addEventListener(productMasterUpdatedEvent, sync);
    return () => window.removeEventListener(productMasterUpdatedEvent, sync);
  }, []);

  useEffect(() => {
    if (!usesSupabaseData()) return;
    let active = true;
    setCatalogLoading(true);
    setCatalogError("");
    loadCatalog()
      .then((rows) => {
        if (!active) return;
        setCatalog(
          rows.filter(
            (product) => String(product.status || "").toLowerCase() !== "inactive",
          ),
        );
        setCatalogError("");
      })
      .catch((error) => {
        if (!active) return;
        setCatalog([]);
        setCatalogError(dbErrorMessage(error, "Could not load company products."));
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!usesSupabaseData() || !storeId) return;
    let active = true;
    loadPhysicalCounts(storeId)
      .then((rows) => {
        if (!active) return;
        setSavedEntries(rows.map(mapDbCount));
        setListError("");
      })
      .catch((error) => {
        if (!active) return;
        setSavedEntries([]);
        setListError(dbErrorMessage(error, "Could not load physical stock entries."));
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const productNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    catalog.forEach((product) => {
      const name = product.name.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      names.push(name);
    });
    return names.sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  function variantsForName(name: string) {
    const key = name.trim().toLowerCase();
    return catalog.filter((product) => product.name.trim().toLowerCase() === key);
  }

  function sizesForName(name: string) {
    const sizes = new Set<string>();
    variantsForName(name).forEach((product) => {
      const size = String(product.size || "").trim();
      if (size) sizes.add(size);
    });
    return Array.from(sizes);
  }

  function variantFor(name: string, size: string) {
    return variantsForName(name).find(
      (product) => String(product.size || "").trim() === size,
    );
  }

  function updateRow(key: string, patch: Partial<EntryRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  async function loadBatches(rowKey: string, variantId: string) {
    if (!usesSupabaseData() || !variantId || !storeId) {
      setBatchOptions((current) => ({ ...current, [rowKey]: [] }));
      return;
    }
    try {
      const options = await loadStoreBatchesForVariant(storeId, variantId);
      setBatchOptions((current) => ({ ...current, [rowKey]: options }));
      setBatchError((current) => ({ ...current, [rowKey]: "" }));
      return options;
    } catch (error) {
      setBatchOptions((current) => ({ ...current, [rowKey]: [] }));
      setBatchError((current) => ({
        ...current,
        [rowKey]: dbErrorMessage(error, "Could not load batches for this product."),
      }));
      return [] as DbStoreBatchOption[];
    }
  }

  async function selectProduct(key: string, name: string) {
    const sizes = sizesForName(name);
    const size = sizes.length === 1 ? sizes[0] : "";
    const variant = size ? variantFor(name, size) : undefined;
    const variantId = String(variant?.variantId || variant?.id || "");
    updateRow(key, {
      productName: name,
      packSize: size,
      variantId,
      batchId: "",
      batchNo: "",
      expiryDate: "",
      unitPrice: size ? Number(variant?.sellingPrice || 0) : 0,
    });
    if (variantId) {
      const options = await loadBatches(key, variantId);
      if (options && options.length === 1) {
        updateRow(key, {
          batchId: options[0].batchId,
          batchNo: options[0].batchNo,
          expiryDate: options[0].expiryDate,
        });
      }
    } else {
      setBatchOptions((current) => ({ ...current, [key]: [] }));
    }
  }

  async function selectSize(key: string, name: string, size: string) {
    const variant = variantFor(name, size);
    const variantId = String(variant?.variantId || variant?.id || "");
    updateRow(key, {
      productName: name,
      packSize: size,
      variantId,
      batchId: "",
      batchNo: "",
      expiryDate: "",
      unitPrice: Number(variant?.sellingPrice || 0),
    });
    if (variantId) {
      const options = await loadBatches(key, variantId);
      if (options && options.length === 1) {
        updateRow(key, {
          batchId: options[0].batchId,
          batchNo: options[0].batchNo,
          expiryDate: options[0].expiryDate,
        });
      }
    }
  }

  function selectBatch(key: string, batchId: string) {
    const option = (batchOptions[key] || []).find((item) => item.batchId === batchId);
    updateRow(key, {
      batchId,
      batchNo: option?.batchNo || "",
      expiryDate: option?.expiryDate || "",
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

  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.variantId) return;
      const key = `${row.variantId}|${row.batchId || ""}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    return new Set(
      Array.from(seen.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key),
    );
  }, [rows]);

  const rowsValid =
    rows.some((row) => row.variantId && row.qty >= 0) &&
    rows.every((row) => {
      if (!row.productName && !row.variantId && row.qty === 0) return true;
      if (!row.variantId) return false;
      if ((batchOptions[row.key] || []).length > 0 && !row.batchId) return false;
      if (duplicateKeys.has(`${row.variantId}|${row.batchId || ""}`)) return false;
      return Number(row.qty || 0) >= 0;
    });

  const submitEvent = async () => {
    const validRows = rows.filter((row) => row.variantId);
    if (validRows.length === 0 || !rowsValid) {
      window.alert("Select a product, package size, and batch for each counted line.");
      return;
    }
    if (duplicateKeys.size > 0) {
      window.alert("Each product / package / batch can appear only once.");
      return;
    }

    if (usesSupabaseData()) {
      setSaving(true);
      try {
        const saved = await recordPhysicalCountDb(
          storeId,
          entryDate,
          validRows.map((row) => ({
            variant_id: row.variantId,
            batch_id: row.batchId || null,
            qty: Number(row.qty || 0),
            unit_price: Number(row.unitPrice || 0),
          })),
          `Physical count by store on ${entryDate}`,
        );
        const result: SavedEntry = {
          id: String(saved.id),
          date: entryDate,
          rows: validRows,
          totalQty: Number(saved.total_qty ?? enteredTotalQty),
          totalValue: Number(saved.total_value ?? enteredTotalValue),
          systemQty: Number(saved.system_qty || 0),
          systemValue: Number(saved.system_value || 0),
          isMatch: Boolean(saved.is_match),
        };
        setLastResult(result);
        const refreshed = await loadPhysicalCounts(storeId);
        setSavedEntries(refreshed.map(mapDbCount));
        setRows([emptyRow()]);
      } catch (err) {
        window.alert(dbErrorMessage(err, "Failed to record physical count"));
      } finally {
        setSaving(false);
      }
      return;
    }

    const result: SavedEntry = {
      id: `${Date.now()}`,
      date: entryDate,
      rows: validRows,
      totalQty: enteredTotalQty,
      totalValue: enteredTotalValue,
      systemQty: 0,
      systemValue: 0,
      isMatch: false,
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
          Enter the actual store stock counted on site. Compared against store
          ledger balances only (FRO hand stock is excluded).
        </p>
      </div>

      {catalogError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {catalogError}
        </p>
      ) : null}
      {listError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {listError}
        </p>
      ) : null}

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

        {!catalogLoading && !catalogError && productNames.length === 0 ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No active products found in Company Product Management.
          </p>
        ) : null}

        <div className="space-y-3">
          {rows.map((row) => {
            const sizes = sizesForName(row.productName);
            const batches = batchOptions[row.key] || [];
            const rowDup = row.variantId
              ? duplicateKeys.has(`${row.variantId}|${row.batchId || ""}`)
              : false;
            return (
              <div key={row.key} className="space-y-2 rounded-xl border border-slate-100 p-3">
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Select
                    label="Product"
                    value={row.productName}
                    onChange={(v) => void selectProduct(row.key, v)}
                    placeholder={catalogLoading ? "Loading…" : "Select product"}
                    options={productNames.map((name) => ({
                      value: name,
                      label: name,
                    }))}
                  />
                  {sizes.length > 1 ? (
                    <Select
                      label="Package Size"
                      value={row.packSize}
                      onChange={(v) => void selectSize(row.key, row.productName, v)}
                      placeholder="Select size"
                      options={sizes.map((size) => ({
                        value: size,
                        label: size,
                      }))}
                    />
                  ) : (
                    <Input
                      label="Package Size"
                      value={row.packSize}
                      onChange={() => {}}
                      placeholder="Auto"
                      readOnly
                    />
                  )}
                  {usesSupabaseData() ? (
                    <Select
                      label="Batch"
                      value={row.batchId}
                      onChange={(v) => selectBatch(row.key, v)}
                      placeholder={
                        !row.variantId
                          ? "Select product first"
                          : batches.length === 0
                            ? "No store stock batches"
                            : "Select batch"
                      }
                      options={batches.map((batch) => ({
                        value: batch.batchId,
                        label: `${batch.batchNo || "Batch"}${batch.expiryDate ? ` · exp ${batch.expiryDate}` : ""} · qty ${batch.quantity}`,
                      }))}
                    />
                  ) : null}
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
                {batchError[row.key] ? (
                  <p className="text-[11px] font-semibold text-red-600">{batchError[row.key]}</p>
                ) : null}
                {rowDup ? (
                  <p className="text-[11px] font-semibold text-red-600">
                    Duplicate product / package / batch on this count.
                  </p>
                ) : null}
              </div>
            );
          })}
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

          <Button onClick={() => void submitEvent()} disabled={saving || !rowsValid}>
            <Icon name="check_circle" size={18} />
            {saving ? "Saving…" : "Submit & Verify"}
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
                {formatCurrency(lastResult.totalValue)} — Store system:{" "}
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
            <div className="flex h-[76vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <h3 className="font-bold text-slate-800">
                    Physical Stock — {selectedEntry.date}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        selectedEntry.isMatch
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {selectedEntry.isMatch ? "Correct" : "Mismatch"}
                    </span>
                    <span className="text-xs text-slate-500">
                      Physical vs Store system (FRO hand stock excluded)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={19} />
                </button>
              </div>

              <div className="border-b border-slate-200 bg-white px-5 py-3 text-xs text-slate-600">
                {selectedEntry.systemBalanceSource === "captured" ? (
                  <p>
                    System qty/value are the Store ledger balances captured when
                    this physical count was saved.
                  </p>
                ) : (
                  <p className="font-medium text-amber-700">
                    This entry has no captured per-line system balance. Difference
                    columns are unavailable — today’s stock is not shown as
                    historical stock.
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[980px] table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="w-[5%] px-2 py-3 text-center">S.No</th>
                      <th className="w-[16%] px-2 py-3 text-left">Product</th>
                      <th className="w-[9%] px-2 py-3 text-center">Package Size</th>
                      <th className="w-[9%] px-2 py-3 text-center">Batch</th>
                      <th className="w-[8%] px-2 py-3 text-right">Physical Qty</th>
                      <th className="w-[8%] px-2 py-3 text-right">System Qty</th>
                      <th className="w-[9%] px-2 py-3 text-right">Difference Qty</th>
                      <th className="w-[10%] px-2 py-3 text-right">Physical Value</th>
                      <th className="w-[10%] px-2 py-3 text-right">System Value</th>
                      <th className="w-[11%] px-2 py-3 text-right">Difference Value</th>
                      <th className="w-[5%] px-2 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.rows.map((row, index) => {
                      const physicalQty = Number(row.qty || 0);
                      const physicalValue = physicalQty * Number(row.unitPrice || 0);
                      const hasSystem = row.hasCapturedSystem === true;
                      const systemQty = hasSystem ? Number(row.systemQty || 0) : null;
                      const systemValue = hasSystem
                        ? Number(
                            row.systemValue ??
                              systemQty! * Number(row.unitPrice || 0),
                          )
                        : null;
                      const diffQty =
                        systemQty == null ? null : physicalQty - systemQty;
                      const diffValue =
                        systemValue == null ? null : physicalValue - systemValue;
                      const matched = diffQty === 0 && diffValue === 0;
                      const highlight =
                        diffQty != null && diffQty !== 0
                          ? "bg-red-50/70"
                          : matched
                            ? "bg-emerald-50/40"
                            : "";
                      return (
                        <tr key={row.key} className={`hover:bg-slate-50 ${highlight}`}>
                          <td className="px-2 py-3 text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-2 py-3 font-semibold text-slate-700">
                            {row.productName}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-600">
                            {row.packSize}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-600">
                            {row.batchNo || "-"}
                          </td>
                          <td className="px-2 py-3 text-right font-bold text-slate-800">
                            {physicalQty}
                          </td>
                          <td className="px-2 py-3 text-right font-semibold text-slate-700">
                            {systemQty == null ? "—" : systemQty}
                          </td>
                          <td
                            className={`px-2 py-3 text-right font-bold ${
                              diffQty == null ? "text-slate-400" : diffClass(diffQty)
                            }`}
                          >
                            {diffQty == null ? "—" : formatSigned(diffQty)}
                          </td>
                          <td className="px-2 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                            {formatCurrency(physicalValue)}
                          </td>
                          <td className="px-2 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                            {systemValue == null ? "—" : formatCurrency(systemValue)}
                          </td>
                          <td
                            className={`px-2 py-3 text-right font-bold whitespace-nowrap ${
                              diffValue == null ? "text-slate-400" : diffClass(diffValue)
                            }`}
                          >
                            {diffValue == null
                              ? "—"
                              : formatSigned(diffValue, true)}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {diffQty == null ? (
                              <span className="text-[10px] font-bold text-slate-400">N/A</span>
                            ) : matched ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Matched
                              </span>
                            ) : diffQty > 0 ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Excess
                              </span>
                            ) : (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                Shortage
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600">
                <p>
                  + Difference = excess physical · − Difference = shortage · 0 =
                  matched
                </p>
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
