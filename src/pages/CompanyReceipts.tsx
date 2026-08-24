import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Card,
  Button,
  Input,
  Select,
  EmptyState,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { stores } from "@/lib/data";

type ReceiptStatus = "Completed" | "Pending";

type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  storeId: string;
  storeName: string;
  method: string;
  invoiceNo: string;
  invoiceAmount: number;
  amount: number;
  receivedBy?: string;
  remarks?: string;
};

const methods = ["Cash", "Bank Transfer", "UPI", "Cheque"];
const receivers = ["Ramesh Kumar", "Priya S", "Karthik N"];
const statuses: ReceiptStatus[] = ["Completed", "Pending"];

const receipts: Receipt[] = Array.from({ length: 16 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 2 + 1));
  const store = stores[i % stores.length];
  return {
    id: `r${i}`,
    receiptNo: `RCP-${String(3001 + i)}`,
    date: d.toISOString().split("T")[0],
    storeId: store.id,
    storeName: store.name,
    method: methods[i % methods.length],
    invoiceNo: `NB-INV-${String(1001 + i).padStart(4, "0")}`,
    invoiceAmount: 5000 + (i % 8) * 3000,
    amount: 1500 + (i % 8) * 2300,
  };
});

const statusColor: Record<ReceiptStatus, "green" | "amber"> = {
  Completed: "green",
  Pending: "amber",
};

export default function CompanyReceipts() {
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [createdReceipts, setCreatedReceipts] = useState<Receipt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [receiptNo, setReceiptNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [createStoreId, setCreateStoreId] = useState("");
  const [method, setMethod] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amountReceived, setAmountReceived] = useState(0);
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  const createStore = stores.find((s) => s.id === createStoreId);
  const canCreate =
    !!createStoreId &&
    !!receiptNo &&
    !!invoiceNo &&
    !!method &&
    amountReceived > 0;

  function resetCreateForm() {
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setReceiptNo("");
    setInvoiceNo("");
    setCreateStoreId("");
    setMethod("");
    setInvoiceAmount(0);
    setAmountReceived(0);
    setReceivedBy("");
    setRemarks("");
  }

  function closeCreateForm() {
    setShowCreate(false);
    resetCreateForm();
  }

  function handleCreateReceipt() {
    if (!canCreate || !createStore) return;
    const newReceipt: Receipt = {
      id: `r-new-${Date.now()}`,
      receiptNo,
      date: receiptDate,
      storeId: createStore.id,
      storeName: createStore.name,
      method,
      invoiceNo,
      invoiceAmount,
      amount: amountReceived,
      receivedBy,
      remarks,
    };
    setCreatedReceipts((prev) => [newReceipt, ...prev]);
    closeCreateForm();
  }

  const filtered = useMemo(() => {
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

    return [...createdReceipts, ...receipts].filter((r) => {
      const matchesSearch =
        !q ||
        r.receiptNo.toLowerCase().includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q);

      const matchesStore =
        storeFilter === "all" || r.storeId === storeFilter;

      return matchesSearch && matchesStore && matchesDate(r.date);
    });
  }, [
    search,
    storeFilter,
    dateFilter,
    customFrom,
    customTo,
    createdReceipts,
  ]);


  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Receipts
          </h1>
          <p className="text-slate-500 mt-1">
            Payment receipts collected from stores. Read-only overview.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowCreate(true)}>
            <Icon name="add" size={20} fill /> Create Receipt
          </Button>
          <Button variant="secondary">
            <Icon name="download" size={20} /> Export
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-end xl:gap-2">
          <div className="w-full xl:w-[245px] xl:shrink-0">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search receipt, store, invoice..."
              icon="search"
            />
          </div>

          <div className="w-full xl:w-[175px] xl:shrink-0">
            <Select
              label="Store"
              value={storeFilter}
              onChange={setStoreFilter}
              placeholder="All Stores"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
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

          {(search ||
            storeFilter !== "all" ||
            dateFilter !== "all" ||
            customFrom ||
            customTo) && (
            <Button
              variant="secondary"
              className="xl:shrink-0"
              onClick={() => {
                setSearch("");
                setStoreFilter("all");
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

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="receipt"
            title="No receipts found"
            description="Adjust your filters."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <th className="w-[6%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  S.No
                </th>
                <th className="w-[11%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Date
                </th>
                <th className="w-[14%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Receipt No
                </th>
                <th className="w-[14%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Invoice No
                </th>
                <th className="w-[18%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Store Name
                </th>
                <th className="w-[13%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Pay Method
                </th>
                <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-right font-semibold">
                  Amount
                </th>
                <th className="w-[12%] px-2 py-3 text-right font-semibold">
                  Balance
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => setViewReceipt(r)}
                  title="Click to view receipt details"
                  className={`cursor-pointer border-b border-slate-100 ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  } transition hover:bg-brand-50/40`}
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-600">
                    {i + 1}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                    {formatDate(r.date)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                    {r.receiptNo}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-700">
                    {r.invoiceNo}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-700">
                    {r.storeName}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {r.method}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                    {formatCurrency(
                      Math.max(r.invoiceAmount - r.amount, 0),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* View Receipt */}
      {viewReceipt &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 8mm;
                }

                body * {
                  visibility: hidden !important;
                }

                .receipt-print-area,
                .receipt-print-area * {
                  visibility: visible !important;
                }

                .receipt-print-area {
                  position: absolute !important;
                  inset: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: #fff !important;
                }

                .receipt-screen-only {
                  display: none !important;
                }

                .receipt-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }
              }
            `}</style>

            <div className="receipt-print-area flex max-h-[94vh] w-[94vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="receipt-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Receipt
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {viewReceipt.receiptNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setViewReceipt(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="receipt-scroll min-h-0 flex-1 overflow-y-auto p-4">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>

                        <div>
                          <h3 className="text-base font-extrabold tracking-wide text-slate-900">
                            NATURE BIOTIC
                          </h3>
                          <p className="mt-1 text-[11px] leading-4 text-slate-600">
                            4/130/A1, Velavan Nagar, Velayudhampuram,
                            Rajapalayam, Tamil Nadu - 626102
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            GSTIN: 33AEZPV5328P1ZC
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Cell: 96008 44446
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center p-4">
                      <h3 className="text-2xl font-bold uppercase text-slate-900">
                        Payment Receipt
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300 text-sm">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Received From
                      </p>
                      <p className="mt-2 font-bold text-slate-900">
                        {viewReceipt.storeName}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {stores.find((s) => s.id === viewReceipt.storeId)
                          ?.address || "-"}
                      </p>
                      <p className="mt-1 text-slate-500">
                        GSTIN:{" "}
                        {stores.find((s) => s.id === viewReceipt.storeId)
                          ?.gst || "-"}
                      </p>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-[120px_1fr] gap-y-2">
                        <span className="text-slate-500">Receipt No</span>
                        <span className="font-semibold text-slate-800">
                          {viewReceipt.receiptNo}
                        </span>

                        <span className="text-slate-500">Receipt Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(viewReceipt.date)}
                        </span>

                        <span className="text-slate-500">Invoice No</span>
                        <span className="font-semibold text-slate-800">
                          {viewReceipt.invoiceNo}
                        </span>

                        <span className="text-slate-500">Payment Method</span>
                        <span className="font-semibold text-slate-800">
                          {viewReceipt.method}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 border-b border-slate-300 bg-slate-50">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Invoice Amount
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {formatCurrency(viewReceipt.invoiceAmount)}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Amount Received
                      </p>
                      <p className="mt-1 text-lg font-bold text-brand-700">
                        {formatCurrency(viewReceipt.amount)}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Balance
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {formatCurrency(
                          Math.max(
                            viewReceipt.invoiceAmount - viewReceipt.amount,
                            0,
                          ),
                        )}
                      </p>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Received By
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {viewReceipt.receivedBy || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_280px]">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Remarks
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {viewReceipt.remarks ||
                          `Payment received against invoice ${viewReceipt.invoiceNo}.`}
                      </p>
                    </div>

                    <div className="p-4 text-sm">
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">Invoice Amount</span>
                        <span className="font-semibold">
                          {formatCurrency(viewReceipt.invoiceAmount)}
                        </span>
                      </div>

                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">Received</span>
                        <span className="font-semibold text-brand-700">
                          {formatCurrency(viewReceipt.amount)}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between border-t border-slate-300 pt-2">
                        <span className="font-bold text-slate-900">
                          Balance
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(
                            Math.max(
                              viewReceipt.invoiceAmount - viewReceipt.amount,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-300 p-4">
                    <div className="w-52 text-center">
                      <div className="h-12 border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="receipt-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setViewReceipt(null)}
                >
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Receipt
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Create Receipt — same popup shell as Credit Note / Sales */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Fixed header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Receipt
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Record a payment receipt collected from a store.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Date"
                    type="date"
                    value={receiptDate}
                    onChange={setReceiptDate}
                    required
                  />

                  <Input
                    label="Receipt Number"
                    placeholder="e.g. RCP-3050"
                    value={receiptNo}
                    onChange={setReceiptNo}
                    required
                  />

                  <Input
                    label="Invoice Number"
                    placeholder="e.g. NB-INV-0009"
                    value={invoiceNo}
                    onChange={setInvoiceNo}
                    required
                  />

                  <Select
                    label="Select Store"
                    value={createStoreId}
                    onChange={setCreateStoreId}
                    placeholder="Choose a registered store"
                    options={stores.map((s) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                    required
                  />

                  <Select
                    label="Payment Method"
                    value={method}
                    onChange={setMethod}
                    placeholder="Select method"
                    options={methods.map((m) => ({ value: m, label: m }))}
                    required
                  />

                  <Input
                    label="Invoice Amount"
                    type="number"
                    value={String(invoiceAmount)}
                    onChange={(v) => setInvoiceAmount(Number(v) || 0)}
                    placeholder="Total invoice value"
                  />

                  <Input
                    label="Amount Received"
                    type="number"
                    value={String(amountReceived)}
                    onChange={(v) => setAmountReceived(Number(v) || 0)}
                    placeholder="Amount collected now"
                    required
                  />

                  <Select
                    label="Received By"
                    value={receivedBy}
                    onChange={setReceivedBy}
                    placeholder="Select staff"
                    options={receivers.map((p) => ({ value: p, label: p }))}
                  />

                  <Input
                    label="Remarks"
                    value={remarks}
                    onChange={setRemarks}
                    placeholder="Optional receipt notes"
                  />

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Balance
                    </label>
                    <div className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-base font-bold text-slate-800">
                      {formatCurrency(
                        Math.max(invoiceAmount - amountReceived, 0),
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeCreateForm}>
                  Cancel
                </Button>
                <Button onClick={handleCreateReceipt} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Receipt
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DetailField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p
        className={`text-sm font-bold ${highlight ? "text-brand-700" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}
