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
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(
    null,
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
        x.sgst += s.sgst || 0;
        x.cgst += s.cgst || 0;
        x.igst += s.igst || 0;
        x.total += s.total;
      } else {
        map.set(s.invoiceNo, {
          invoiceNo: s.invoiceNo,
          date: s.date,
          partyName: "Nature Biotic",
          placeOfSupply: s.placeOfSupply || s.storeLocation || "-",
          items: 1,
          quantity: s.quantity,
          withoutTax: s.withoutTax,
          sgst: s.sgst || 0,
          cgst: s.cgst || 0,
          igst: s.igst || 0,
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

  const selectedInvoice = invoices.find(
    (invoice: any) => invoice.invoiceNo === selectedInvoiceNo,
  );

  const selectedItems = selectedInvoiceNo
    ? rows.filter((row) => row.invoiceNo === selectedInvoiceNo)
    : [];

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
          <div className="w-full">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  <th
                    rowSpan={2}
                    className="w-[5%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[9%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Date
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Invoice No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[13%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Supplier
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Place of Supply
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[10%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Without Tax
                  </th>
                  <th
                    colSpan={3}
                    className="w-[18%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Tax
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[9%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Total
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[7%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Status
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[10%] px-2 py-3 text-center font-semibold"
                  >
                    Action
                  </th>
                </tr>

                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    SGST
                  </th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    CGST
                  </th>
                  <th className="border-r border-slate-200 px-1 py-2 text-center font-semibold">
                    IGST
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((r: any, i: number) => (
                  <tr
                    key={r.invoiceNo}
                    onClick={() => setSelectedInvoiceNo(r.invoiceNo)}
                    className={`cursor-pointer border-b border-slate-100 ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    } transition hover:bg-brand-50/40`}
                    title="Click to view purchase invoice"
                  >
                    <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-600">
                      {i + 1}
                    </td>

                    <td className="whitespace-nowrap border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {formatDate(r.date)}
                    </td>

                    <td className="truncate border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                      {r.invoiceNo}
                    </td>

                    <td className="truncate border-r border-slate-100 px-2 py-3 text-center text-slate-700">
                      {r.partyName}
                    </td>

                    <td className="truncate border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                      {r.placeOfSupply || "-"}
                    </td>

                    <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-700">
                      {formatCurrency(r.withoutTax)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.sgst)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.cgst)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.igst)}
                    </td>

                    <td className="border-r border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                      {formatCurrency(r.total)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-center">
                      {(statuses[r.invoiceNo] ?? "Dispatched") ===
                      "Received" ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          Received
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          Dispatched
                        </span>
                      )}
                    </td>

                    <td className="px-1 py-3 text-center">
                      {(statuses[r.invoiceNo] ?? "Dispatched") ===
                      "Dispatched" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            markReceived(r.invoiceNo);
                          }}
                          className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Mark Received
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">
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

      {selectedInvoice && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 px-7 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                  Purchase Invoice
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-800">
                  {selectedInvoice.invoiceNo}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Nature Biotic → Sairam Agri Input
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInvoiceNo(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
              >
                <Icon name="close" size={21} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-7">
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <InvoiceInfo
                  label="Invoice No"
                  value={selectedInvoice.invoiceNo}
                />
                <InvoiceInfo
                  label="Invoice Date"
                  value={formatDate(selectedInvoice.date)}
                />
                <InvoiceInfo
                  label="Supplier"
                  value={selectedInvoice.partyName}
                />
                <InvoiceInfo
                  label="Status"
                  value={statuses[selectedInvoice.invoiceNo] ?? "Dispatched"}
                />
                <InvoiceInfo
                  label="Place of Supply"
                  value={selectedInvoice.placeOfSupply || "-"}
                />
                <InvoiceInfo
                  label="No. of Products"
                  value={String(selectedItems.length)}
                />
                <InvoiceInfo
                  label="Total Quantity"
                  value={String(selectedInvoice.quantity)}
                />
                <InvoiceInfo
                  label="Invoice Value"
                  value={formatCurrency(selectedInvoice.total)}
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h3 className="font-bold text-slate-800">Product Details</h3>
                </div>

                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[6%] px-2 py-3 text-center">S.No</th>
                      <th className="w-[19%] px-3 py-3 text-left">Product</th>
                      <th className="w-[11%] px-2 py-3 text-center">Size</th>
                      <th className="w-[8%] px-2 py-3 text-center">Qty</th>
                      <th className="w-[10%] px-2 py-3 text-right">Price</th>
                      <th className="w-[12%] px-2 py-3 text-right">
                        Without Tax
                      </th>
                      <th className="w-[8%] px-2 py-3 text-right">SGST</th>
                      <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                      <th className="w-[8%] px-2 py-3 text-right">IGST</th>
                      <th className="w-[10%] px-2 py-3 text-right">Total</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedItems.map((item: any, index: number) => {
                      const unitPrice =
                        item.price ??
                        item.sellingPrice ??
                        (item.quantity ? item.withoutTax / item.quantity : 0);

                      const size =
                        item.packSize ??
                        item.pkgsize ??
                        item.size ??
                        item.unit ??
                        "-";

                      return (
                        <tr key={item.id ?? `${item.invoiceNo}-${index}`}>
                          <td className="px-2 py-3 text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td className="truncate px-3 py-3 font-semibold text-slate-800">
                            {item.productName ?? item.product ?? "-"}
                          </td>
                          <td className="px-2 py-3 text-center text-slate-600">
                            {size}
                          </td>
                          <td className="px-2 py-3 text-center font-semibold text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="px-2 py-3 text-right text-slate-600">
                            {formatCurrency(unitPrice)}
                          </td>
                          <td className="px-2 py-3 text-right text-slate-600">
                            {formatCurrency(item.withoutTax)}
                          </td>
                          <td className="px-2 py-3 text-right text-slate-600">
                            {formatCurrency(item.sgst || 0)}
                          </td>
                          <td className="px-2 py-3 text-right text-slate-600">
                            {formatCurrency(item.cgst || 0)}
                          </td>
                          <td className="px-2 py-3 text-right text-slate-600">
                            {formatCurrency(item.igst || 0)}
                          </td>
                          <td className="px-2 py-3 text-right font-bold text-slate-800">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 ml-auto w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <InvoiceTotal
                  label="Without Tax"
                  value={formatCurrency(selectedInvoice.withoutTax)}
                />
                <InvoiceTotal
                  label="SGST"
                  value={formatCurrency(selectedInvoice.sgst)}
                />
                <InvoiceTotal
                  label="CGST"
                  value={formatCurrency(selectedInvoice.cgst)}
                />
                <InvoiceTotal
                  label="IGST"
                  value={formatCurrency(selectedInvoice.igst)}
                />
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <InvoiceTotal
                    label="Grand Total"
                    value={formatCurrency(selectedInvoice.total)}
                    bold
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-7 py-4">
              <button
                type="button"
                onClick={() => setSelectedInvoiceNo(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate font-bold text-slate-800">{value}</p>
    </div>
  );
}

function InvoiceTotal({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={bold ? "font-bold text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={
          bold
            ? "text-lg font-bold text-slate-900"
            : "font-semibold text-slate-700"
        }
      >
        {value}
      </span>
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
