import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Icon, Input, Select } from "@/components/ui";
import { businessDate, formatCurrency, formatDate } from "@/lib/format";
import { getStores } from "@/lib/data";
import {
  createIssuedCompanyCreditNoteDb,
  loadEligibleReturnCredits,
  type EligibleReturnCreditLine,
} from "@/lib/db/financials";
import { dbErrorMessage } from "@/lib/db/errors";

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function wholeCount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) > 0.000001) return null;
  return nearest;
}

function typedWholeCount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

function quantityError(line: EligibleReturnCreditLine, raw: string): string {
  const label = `${line.productName} ${line.packSize}`.trim();
  const available = wholeCount(line.availableQty);
  if (available == null) {
    return `Available quantity for ${label} is not a whole number.`;
  }
  if (!raw.trim()) return "";
  const quantity = typedWholeCount(raw);
  if (quantity == null) {
    return `Credit quantity for ${label} must be a whole number.`;
  }
  if (quantity > available) {
    return `Credit quantity for ${label} cannot exceed ${available}.`;
  }
  return "";
}

function portion(line: EligibleReturnCreditLine, quantity: number) {
  const ratio = line.returnedQty > 0 ? quantity / line.returnedQty : 0;
  const taxable = money(line.taxableAmount * ratio);
  const sgst = money(line.sgst * ratio);
  const cgst = money(line.cgst * ratio);
  const igst = money(line.igst * ratio);
  return {
    discount: money(line.discountAmount * ratio),
    taxable,
    sgst,
    cgst,
    igst,
    total: money(taxable + sgst + cgst + igst),
  };
}

export default function CompanyManualCreditNoteForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const stores = getStores().filter((store) => store.status !== "Inactive");
  const [storeId, setStoreId] = useState("");
  const [noteDate, setNoteDate] = useState(businessDate());
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<EligibleReturnCreditLine[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!storeId) {
      setLines([]);
      setQuantities({});
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    loadEligibleReturnCredits(storeId)
      .then((rows) => {
        if (!active) return;
        setLines(rows);
        setQuantities({});
      })
      .catch((err) => {
        if (!active) return;
        setLines([]);
        setError(dbErrorMessage(err, "Could not load returned products."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const selected = useMemo(
    () =>
      lines.flatMap((line) => {
        const raw = quantities[line.id] || "";
        if (quantityError(line, raw)) return [];
        const quantity = typedWholeCount(raw) ?? 0;
        return quantity > 0 ? [{ line, quantity }] : [];
      }),
    [lines, quantities],
  );
  const totals = selected.reduce(
    (sum, row) => {
      const part = portion(row.line, row.quantity);
      sum.taxable += part.taxable;
      sum.discount += part.discount;
      sum.sgst += part.sgst;
      sum.cgst += part.cgst;
      sum.igst += part.igst;
      sum.total += part.total;
      return sum;
    },
    { taxable: 0, discount: 0, sgst: 0, cgst: 0, igst: 0, total: 0 },
  );

  async function save() {
    if (saving || !storeId) return;
    const invalid = lines.map((line) => quantityError(line, quantities[line.id] || "")).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (selected.length === 0) {
      setError("Enter a credit quantity for at least one returned product.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createIssuedCompanyCreditNoteDb(
        {
          store_id: storeId,
          credit_note_date: noteDate || businessDate(),
          reason: remarks.trim() || "Purchase return",
          notes: remarks.trim() || null,
        },
        selected.map((row) => ({
          source_item_id: row.line.id,
          quantity: row.quantity,
          line_type: "return",
        })),
      );
      await onSaved();
      onClose();
    } catch (err) {
      setError(dbErrorMessage(err, "Could not create the credit note."));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Create Credit Note</h2>
            <p className="mt-1 text-sm text-slate-500">
              Combine approved purchase returns for one store. This GST document does not refund cash or change stock.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Store"
              value={storeId}
              onChange={setStoreId}
              options={[
                { value: "", label: "Select store" },
                ...stores.map((store) => ({ value: store.id, label: store.name })),
              ]}
            />
            <Input label="Credit Note Date" type="date" value={noteDate} onChange={setNoteDate} />
            <Input label="Remarks" value={remarks} onChange={setRemarks} placeholder="Optional" />
          </div>
          {!storeId ? (
            <p className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Select a store to see products returned on approved purchase returns.
            </p>
          ) : loading ? (
            <p className="text-sm text-slate-500">Loading returned products…</p>
          ) : lines.length === 0 ? (
            <p className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              This store has no approved return quantity left to credit.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Size</th>
                    <th className="px-3 py-2 text-left">Batch</th>
                    <th className="px-3 py-2 text-left">Expiry</th>
                    <th className="px-3 py-2 text-right">Available</th>
                    <th className="px-3 py-2 text-right">Credit qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2 text-right">GST %</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => {
                    const raw = quantities[line.id] || "";
                    const available = wholeCount(line.availableQty);
                    const rowError = quantityError(line, raw);
                    const quantity = rowError ? 0 : typedWholeCount(raw) ?? 0;
                    const part = quantity > 0 ? portion(line, quantity) : null;
                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {line.productName}
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">
                            Returned {formatDate(line.returnDate)}
                          </span>
                        </td>
                        <td className="px-3 py-2">{line.packSize || "-"}</td>
                        <td className="px-3 py-2">{line.batchNo || "-"}</td>
                        <td className="px-3 py-2">{line.expiryDate ? formatDate(line.expiryDate) : "-"}</td>
                        <td className="px-3 py-2 text-right">{available ?? line.availableQty}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={available ?? 0}
                            step={1}
                            value={raw}
                            onKeyDown={(event) => {
                              if (["e", "E", "+", "-", "."].includes(event.key)) event.preventDefault();
                            }}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next !== "" && !/^\d+$/.test(next)) {
                                setError(`Credit quantity for ${line.productName} ${line.packSize} must be a whole number.`);
                                return;
                              }
                              setQuantities((current) => ({ ...current, [line.id]: next }));
                              setError(quantityError(line, next));
                            }}
                            className={`w-24 rounded-lg border px-2 py-1 text-right ${rowError ? "border-red-400" : "border-slate-200"}`}
                          />
                          {rowError ? <span className="mt-1 block text-xs text-red-600">{rowError}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(line.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(part?.discount || 0)}</td>
                        <td className="px-3 py-2 text-right">{line.taxPercent.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(part?.taxable || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="ml-auto w-full max-w-sm space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between"><span>Discount</span><span>{formatCurrency(totals.discount)}</span></div>
            <div className="flex justify-between"><span>Taxable amount</span><span>{formatCurrency(totals.taxable)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span>{formatCurrency(totals.sgst)}</span></div>
            <div className="flex justify-between"><span>CGST</span><span>{formatCurrency(totals.cgst)}</span></div>
            <div className="flex justify-between"><span>IGST</span><span>{formatCurrency(totals.igst)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <span>Grand total</span><span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || selected.length === 0}>
            {saving ? "Saving…" : "Create Credit Note"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
