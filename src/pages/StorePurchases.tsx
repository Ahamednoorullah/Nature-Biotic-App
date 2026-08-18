import { useEffect, useMemo, useState } from "react";
import { Card, Icon, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getStorePurchasesFromCompanySales,
  type CompanyStoreSaleRecord,
} from "@/lib/data";

type PurchaseStatus = "Dispatched" | "Received";

const PURCHASE_STATUS_KEY = "nature-biotic-store-purchase-status-v1";

function getSavedStatuses(): Record<string, PurchaseStatus> {
  try {
    const raw = localStorage.getItem(PURCHASE_STATUS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStatuses(statuses: Record<string, PurchaseStatus>) {
  try {
    localStorage.setItem(PURCHASE_STATUS_KEY, JSON.stringify(statuses));
  } catch {}
}

export default function StorePurchases({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<CompanyStoreSaleRecord[]>(() =>
    getStorePurchasesFromCompanySales(storeId),
  );
  const [statuses, setStatuses] = useState<Record<string, PurchaseStatus>>(() =>
    getSavedStatuses(),
  );

  useEffect(() => {
    const refresh = () => setRows(getStorePurchasesFromCompanySales(storeId));
    refresh();
    window.addEventListener("company-store-sales-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("company-store-sales-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [storeId]);

  const invoices = useMemo(() => {
    const map = new Map<string, any>();
    rows.forEach((s) => {
      const x = map.get(s.invoiceNo);
      if (x) {
        x.items += 1;
        x.quantity += s.quantity;
        x.withoutTax += s.withoutTax;
        x.tax += s.taxAmount;
        x.total += s.total;
      } else {
        map.set(s.invoiceNo, {
          invoiceNo: s.invoiceNo,
          date: s.date,
          supplier: "Nature Biotic",
          items: 1,
          quantity: s.quantity,
          withoutTax: s.withoutTax,
          tax: s.taxAmount,
          total: s.total,
        });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [rows]);

  const totalValue = invoices.reduce((s: any, r: any) => s + r.total, 0);
  const totalQty = invoices.reduce((s: any, r: any) => s + r.quantity, 0);

  function markReceived(invoiceNo: string) {
    const next = { ...statuses, [invoiceNo]: "Received" as PurchaseStatus };
    setStatuses(next);
    saveStatuses(next);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Purchases
        </h1>
        <p className="mt-1 text-slate-500">
          Nature Biotic company creates a sale for this store → it automatically
          appears here as a purchase.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Summary
          label="Purchase Bills"
          value={String(invoices.length)}
          icon="receipt_long"
        />
        <Summary
          label="Purchased Quantity"
          value={String(totalQty)}
          icon="inventory_2"
        />
        <Summary
          label="Purchase Value"
          value={formatCurrency(totalValue)}
          icon="payments"
        />
      </div>

      {invoices.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="shopping_cart"
            title="No purchases found"
            description="Company sales created for this store will appear here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Purchase / Invoice No</th>
                  <th className="px-5 py-3 text-left">Supplier</th>
                  <th className="px-5 py-3 text-center">Products</th>
                  <th className="px-5 py-3 text-center">Qty</th>
                  <th className="px-5 py-3 text-right">Without Tax</th>
                  <th className="px-5 py-3 text-right">Tax</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((r: any) => (
                  <tr key={r.invoiceNo}>
                    <td className="px-5 py-4">{formatDate(r.date)}</td>
                    <td className="px-5 py-4 font-bold">{r.invoiceNo}</td>
                    <td className="px-5 py-4">{r.supplier}</td>
                    <td className="px-5 py-4 text-center">{r.items}</td>
                    <td className="px-5 py-4 text-center font-semibold">
                      {r.quantity}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {formatCurrency(r.withoutTax)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {formatCurrency(r.tax)}
                    </td>
                    <td className="px-5 py-4 text-right font-bold">
                      {formatCurrency(r.total)}
                    </td>
                    <td className="px-5 py-4">
                      {(statuses[r.invoiceNo] ?? "Dispatched") ===
                      "Received" ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Received
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Dispatched
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {(statuses[r.invoiceNo] ?? "Dispatched") ===
                      "Dispatched" ? (
                        <button
                          type="button"
                          onClick={() => markReceived(r.invoiceNo)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Mark Received
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon name={icon} size={19} />
        </div>
      </div>
    </Card>
  );
}
