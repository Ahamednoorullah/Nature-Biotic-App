import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Icon, EmptyState, Input, Select, Button } from "@/components/ui";
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
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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
      const unitPrice = Number(
        (s as any).sellingPrice ??
          (s as any).price ??
          ((s as any).quantity
            ? Number((s as any).beforeDiscount ?? (s as any).withoutTax ?? 0) /
              Number((s as any).quantity)
            : 0),
      );

      const beforeDiscount = Number(
        (s as any).beforeDiscount ??
          unitPrice * Number((s as any).quantity || 0),
      );

      const discountAmount = Number(
        (s as any).discountAmount ??
          (beforeDiscount *
            Number(
              (s as any).discountPercent ??
                (s as any).discount ??
                0,
            )) /
            100,
      );

      const taxableAmount = Number(
        (s as any).taxableAmount ??
          (s as any).withoutTax ??
          beforeDiscount - discountAmount,
      );

      if (x) {
        x.items += 1;
        x.quantity += s.quantity;
        x.beforeDiscount += beforeDiscount;
        x.discount += discountAmount;
        x.withoutTax += taxableAmount;
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
          beforeDiscount,
          discount: discountAmount,
          withoutTax: taxableAmount,
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

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date();

    const normalize = (value: string) => new Date(`${value}T00:00:00`);

    const matchesDate = (value: string) => {
      const rowDate = normalize(value);

      if (dateFilter === "all") return true;

      if (dateFilter === "today") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowDate.getMonth() === today.getMonth() &&
          rowDate.getDate() === today.getDate()
        );
      }

      if (dateFilter === "monthly") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowDate.getMonth() === today.getMonth()
        );
      }

      if (dateFilter === "quarterly") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          Math.floor(rowDate.getMonth() / 3) ===
            Math.floor(today.getMonth() / 3)
        );
      }

      if (dateFilter === "yearly") {
        return rowDate.getFullYear() === today.getFullYear();
      }

      if (dateFilter === "custom") {
        if (!customFrom && !customTo) return true;

        const from = customFrom ? normalize(customFrom) : null;
        const to = customTo ? normalize(customTo) : null;

        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
      }

      return true;
    };

    return invoices.filter((invoice: any) => {
      const matchesSearch =
        !q ||
        invoice.invoiceNo.toLowerCase().includes(q) ||
        invoice.partyName.toLowerCase().includes(q);

      return matchesSearch && matchesDate(invoice.date);
    });
  }, [invoices, search, dateFilter, customFrom, customTo]);

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

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-end xl:gap-2">
          <div className="w-full xl:w-[245px] xl:shrink-0">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search invoice or supplier..."
              icon="search"
            />
          </div>

          <div className="w-full xl:w-[155px] xl:shrink-0">
            <Select
              label="Date Filter"
              value={dateFilter}
              onChange={(value) =>
                setDateFilter(
                  value as
                    | "all"
                    | "today"
                    | "monthly"
                    | "quarterly"
                    | "yearly"
                    | "custom",
                )
              }
              options={[
                { value: "all", label: "All Dates" },
                { value: "today", label: "Today" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
                { value: "custom", label: "Custom Date" },
              ]}
            />
          </div>

          {dateFilter === "custom" && (
            <>
              <div className="w-full xl:w-[140px] xl:shrink-0">
                <Input
                  label="From"
                  type="date"
                  value={customFrom}
                  onChange={setCustomFrom}
                />
              </div>

              <div className="w-full xl:w-[140px] xl:shrink-0">
                <Input
                  label="To"
                  type="date"
                  value={customTo}
                  onChange={setCustomTo}
                />
              </div>
            </>
          )}

          {(search || dateFilter !== "all" || customFrom || customTo) && (
            <Button
              variant="secondary"
              className="xl:shrink-0"
              onClick={() => {
                setSearch("");
                setDateFilter("all");
                setCustomFrom("");
                setCustomTo("");
              }}
            >
              <Icon name="filter_alt_off" size={17} />
              Clear
            </Button>
          )}
        </div>
      </Card>

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
                  <th rowSpan={2} className="w-[5%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    S.No
                  </th>
                  <th rowSpan={2} className="w-[9%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Date
                  </th>
                  <th rowSpan={2} className="w-[12%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Invoice No
                  </th>
                  <th rowSpan={2} className="w-[14%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Supplier
                  </th>
                  <th rowSpan={2} className="w-[11%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Without Tax
                  </th>

                  <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold">
                    SGST
                  </th>
                  <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold">
                    CGST
                  </th>
                  <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold">
                    IGST
                  </th>

                  <th rowSpan={2} className="w-[10%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Total
                  </th>
                  <th rowSpan={2} className="w-[7%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Status
                  </th>
                  <th rowSpan={2} className="w-[9%] px-2 py-3 text-center font-semibold">
                    Action
                  </th>
                </tr>

                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">%</th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">Amt</th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">%</th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">Amt</th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">%</th>
                  <th className="border-r border-slate-200 px-1 py-2 text-center font-semibold">Amt</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((r: any, i: number) => (
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

                    <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-700">
                      {formatCurrency(r.withoutTax)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                      {r.sgst > 0 && r.withoutTax > 0
                        ? ((r.sgst / r.withoutTax) * 100).toFixed(2)
                        : "0.00"}
                    </td>
                    <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.sgst)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                      {r.cgst > 0 && r.withoutTax > 0
                        ? ((r.cgst / r.withoutTax) * 100).toFixed(2)
                        : "0.00"}
                    </td>
                    <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.cgst)}
                    </td>

                    <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                      {r.igst > 0 && r.withoutTax > 0
                        ? ((r.igst / r.withoutTax) * 100).toFixed(2)
                        : "0.00"}
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

      {selectedInvoice &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 6mm;
              }

              body * {
                visibility: hidden !important;
              }

              .store-purchase-print-area,
              .store-purchase-print-area * {
                visibility: visible !important;
              }

              .store-purchase-print-area {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                max-width: none !important;
                max-height: none !important;
                overflow: visible !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                background: white !important;
              }

              .store-purchase-screen-only {
                display: none !important;
              }

              .store-purchase-scroll {
                overflow: visible !important;
                padding: 0 !important;
              }
            }
          `}</style>

          <div className="store-purchase-print-area flex h-[96vh] w-[98.5vw] max-w-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="store-purchase-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                  Purchase Invoice
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-800">
                  {selectedInvoice.invoiceNo}
                </h2>

                <span
                  className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                    (statuses[selectedInvoice.invoiceNo] ?? "Dispatched") === "Received"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {statuses[selectedInvoice.invoiceNo] ?? "Dispatched"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInvoiceNo(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="store-purchase-scroll min-h-0 flex-1 overflow-y-auto p-3">
              <div className="min-h-full w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                  <div className="border-r border-slate-300 px-6 py-3">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                        <img
                          src="/logo_NB.webp"
                          alt="Nature Biotic"
                          className="max-h-14 max-w-full object-contain"
                        />
                      </div>

                      <div>
                        <h3 className="text-lg font-extrabold tracking-wide text-slate-900">
                          NATURE BIOTIC
                        </h3>
                        <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                          4/130/A1, Velavan Nagar, Velayudhampuram,
                          Rajapalayam, Tamil Nadu - 626102
                        </p>
                        <p className="text-[10px] text-slate-600">
                          GSTIN: 33AEZPV5328P1ZC
                        </p>
                        <p className="text-[10px] text-slate-600">
                          Cell: 96008 44446
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center px-4 py-3">
                    <div className="text-center">
                      <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                        Purchase Invoice
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Nature Biotic to Store
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                  <div className="border-r border-slate-300 px-3 py-2.5">
                    <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                      Supplier
                    </p>
                    <p className="font-bold text-slate-900">Nature Biotic</p>
                    <p className="text-slate-600">Rajapalayam, Tamil Nadu</p>
                    <p className="text-slate-600">
                      GSTIN: 33AEZPV5328P1ZC
                    </p>
                  </div>

                  <div className="border-r border-slate-300 px-3 py-2.5">
                    <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                      Purchase Summary
                    </p>
                    <p className="text-slate-600">
                      No. of Products:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedItems.length}
                      </span>
                    </p>
                    <p className="text-slate-600">
                      Total Quantity:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedInvoice.quantity}
                      </span>
                    </p>
                    <p className="text-slate-600">
                      Before Discount:{" "}
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(selectedInvoice.beforeDiscount || 0)}
                      </span>
                    </p>
                    <p className="text-slate-600">
                      Discount:{" "}
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(selectedInvoice.discount || 0)}
                      </span>
                    </p>
                    <p className="text-slate-600">
                      Invoice Value:{" "}
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(selectedInvoice.total)}
                      </span>
                    </p>
                  </div>

                  <div className="px-3 py-2.5">
                    <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                      Invoice Details
                    </p>

                    <div className="grid grid-cols-[100px_1fr] gap-y-0.5">
                      <span className="text-slate-500">Invoice No</span>
                      <span className="font-semibold text-slate-800">
                        {selectedInvoice.invoiceNo}
                      </span>

                      <span className="text-slate-500">Invoice Date</span>
                      <span className="font-semibold text-slate-800">
                        {formatDate(selectedInvoice.date)}
                      </span>

                      <span className="text-slate-500">Status</span>
                      <span className="font-semibold text-slate-800">
                        {statuses[selectedInvoice.invoiceNo] ?? "Dispatched"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed border-collapse text-[9px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                        <th rowSpan={2} className="w-[4%] border-r border-slate-300 px-2 py-2 text-center">
                          S.No
                        </th>
                        <th rowSpan={2} className="w-[12%] border-r border-slate-300 px-2 py-2 text-left">
                          Product
                        </th>
                        <th rowSpan={2} className="w-[7%] border-r border-slate-300 px-2 py-2 text-center">
                          Size
                        </th>
                        <th rowSpan={2} className="w-[5%] border-r border-slate-300 px-2 py-2 text-center">
                          Qty
                        </th>
                        <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-2 py-2 text-right">
                          Unit Price
                        </th>
                        <th rowSpan={2} className="w-[10%] border-r border-slate-300 px-2 py-2 text-right">
                          Before Discount
                        </th>

                        <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                          Discount
                        </th>

                        <th rowSpan={2} className="w-[9%] border-r border-slate-300 px-2 py-2 text-right">
                          Taxable
                        </th>

                        <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                          SGST
                        </th>
                        <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                          CGST
                        </th>
                        <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                          IGST
                        </th>

                        <th rowSpan={2} className="w-[10%] px-2 py-2 text-right">
                          Line Total
                        </th>
                      </tr>

                      <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                        <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                        <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>

                        <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                        <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>

                        <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                        <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>

                        <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                        <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedItems.map((item: any, index: number) => {
                        const unitPrice = Number(
                          item.sellingPrice ??
                            item.price ??
                            (item.quantity
                              ? Number(
                                  item.beforeDiscount ??
                                    item.withoutTax ??
                                    0,
                                ) / Number(item.quantity)
                              : 0),
                        );

                        const size =
                          item.packSize ??
                          item.pkgsize ??
                          item.size ??
                          item.unit ??
                          "-";

                        const beforeDiscount = Number(
                          item.beforeDiscount ??
                            unitPrice * Number(item.quantity || 0),
                        );

                        const discountPercent = Number(
                          item.discountPercent ??
                            item.discount ??
                            0,
                        );

                        const discountAmount = Number(
                          item.discountAmount ??
                            (beforeDiscount * discountPercent) / 100,
                        );

                        const taxableAmount = Number(
                          item.taxableAmount ??
                            item.withoutTax ??
                            beforeDiscount - discountAmount,
                        );

                        const taxPercent = Number(item.taxPercent || 0);
                        const sgstRate =
                          item.sgst > 0
                            ? taxPercent
                              ? taxPercent / 2
                              : (item.sgst / item.withoutTax) * 100
                            : 0;
                        const cgstRate =
                          item.cgst > 0
                            ? taxPercent
                              ? taxPercent / 2
                              : (item.cgst / item.withoutTax) * 100
                            : 0;
                        const igstRate =
                          item.igst > 0
                            ? taxPercent ||
                              (item.igst / item.withoutTax) * 100
                            : 0;

                        return (
                          <tr
                            key={item.id ?? `${item.invoiceNo}-${index}`}
                            className="border-b border-slate-300"
                          >
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {index + 1}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                              {item.productName ?? item.product ?? "-"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center text-slate-600">
                              {size}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right text-slate-600">
                              {formatCurrency(unitPrice)}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                              {formatCurrency(beforeDiscount)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-2 text-center">
                              {discountPercent.toFixed(2)}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(discountAmount)}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                              {formatCurrency(taxableAmount)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-2 text-center">
                              {sgstRate.toFixed(2)}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(item.sgst || 0)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-2 text-center">
                              {cgstRate.toFixed(2)}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(item.cgst || 0)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-2 text-center">
                              {igstRate.toFixed(2)}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(item.igst || 0)}
                            </td>

                            <td className="px-2 py-2 text-right font-bold text-slate-800">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid min-h-[130px] grid-cols-[1fr_320px] border-t border-slate-300">
                  <div className="border-r border-slate-300 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Notes
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Purchase invoice received from Nature Biotic against the
                      company sale created for this store.
                    </p>
                  </div>

                  <div className="p-4 text-sm">
                    <InvoiceTotal
                      label="Total Before Discount"
                      value={formatCurrency(
                        selectedInvoice.beforeDiscount || 0,
                      )}
                    />
                    <InvoiceTotal
                      label="Discount"
                      value={formatCurrency(
                        selectedInvoice.discount || 0,
                      )}
                    />
                    <InvoiceTotal
                      label="Taxable Total"
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

                    <div className="mt-3 border-t border-slate-300 pt-3">
                      <InvoiceTotal
                        label="Grand Total"
                        value={formatCurrency(selectedInvoice.total)}
                        bold
                      />
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[80px] justify-end border-t border-slate-300 px-6 py-3">
                  <div className="mt-auto w-56 text-center">
                    <div className="border-b border-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Authorised Signatory
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="store-purchase-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              {(statuses[selectedInvoice.invoiceNo] ?? "Dispatched") ===
                "Dispatched" && (
                <Button onClick={() => markReceived(selectedInvoice.invoiceNo)}>
                  <Icon name="check_circle" size={18} />
                  Mark Received
                </Button>
              )}

              <Button variant="secondary" onClick={() => setSelectedInvoiceNo(null)}>
                Close
              </Button>

              <Button onClick={() => window.print()}>
                <Icon name="print" size={18} />
                Print Invoice
              </Button>
            </div>
          </div>
        </div>,
          document.body,
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
