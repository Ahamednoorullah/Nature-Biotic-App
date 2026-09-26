import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { getFarmersByStore, getStore } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";

type StoredSaleInvoice = {
  id: string;
  date: string;
  invoiceNo: string;
  through: "Direct" | "Executive";
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
};

const STORE_SALES_INVOICE_STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  farmerId: string;
  farmerName: string;
  method: string;
  invoiceNo: string;
  invoiceAmount: number;
  amount: number;
  receivedBy?: string;
  remarks?: string;
};

const methods = ["Cash", "Bank Transfer", "UPI", "Cheque"];
const receivers = ["Ramesh Kumar", "Priya S", "Karthik N"];

const STORAGE_PREFIX = "nature-biotic-store-receipts-v3";

const receipts: Receipt[] = [];

export default function StoreReceipt({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage } = useNav();
  const isFRO = user?.role === "fro";
  const farmers = getFarmersByStore(storeId);
  const currentStore = getStore(storeId);

  const [showCreate, setShowCreate] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");

  // Declare create-form state before any memo that depends on it.

  const saleInvoices = useMemo<StoredSaleInvoice[]>(() => {
    try {
      const raw = localStorage.getItem(
        `${STORE_SALES_INVOICE_STORAGE_KEY}:${storeId}`,
      );
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [storeId, showCreate]);

  const visibleSaleInvoices = useMemo(() => {
    if (!isFRO || !user?.name) return saleInvoices;

    const froName = user.name.trim().toLowerCase();

    return saleInvoices.filter(
      (invoice) =>
        String(invoice.executiveName || "")
          .trim()
          .toLowerCase() === froName,
    );
  }, [saleInvoices, isFRO, user?.name]);

  const invoiceOptions = useMemo(
    () =>
      visibleSaleInvoices.map((invoice) => ({
        value: invoice.invoiceNo,
        label: `${invoice.invoiceNo} - ${invoice.partyName}`,
      })),
    [visibleSaleInvoices],
  );

  const selectedInvoice = useMemo(
    () =>
      visibleSaleInvoices.find((invoice) => invoice.invoiceNo === invoiceNo),
    [visibleSaleInvoices, invoiceNo],
  );
  const [search, setSearch] = useState("");
  const [farmerFilter, setFarmerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [froReceiptMode, setFroReceiptMode] = useState<
    "list" | "view" | "create"
  >("list");
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;
  const [createdReceipts, setCreatedReceipts] = useState<Receipt[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [receiptNo, setReceiptNo] = useState("");
  const [method, setMethod] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amountReceived, setAmountReceived] = useState(0);
  const [receivedBy, setReceivedBy] = useState(
    user?.role === "fro" ? user.name : "",
  );
  const [remarks, setRemarks] = useState("");
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState("");
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  const createFarmer = farmers.find((f) => f.id === selectedInvoice?.farmerId);
  const canCreate =
    !!receiptNo.trim() &&
    !!selectedInvoice &&
    !!method &&
    amountReceived > 0 &&
    amountReceived <= invoiceAmount;

  function resetCreateForm() {
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setReceiptNo("");
    setInvoiceNo("");
    setMethod("");
    setInvoiceAmount(0);
    setAmountReceived(0);
    setReceivedBy(isFRO ? (user?.name ?? "") : "");
    setRemarks("");
  }

  function closeCreateForm() {
    setShowCreate(false);
    resetCreateForm();
  }

  function handleCreateReceipt() {
    if (!canCreate || !selectedInvoice) return;
    if (
      createdReceipts.some(
        (receipt) =>
          receipt.receiptNo.trim().toLowerCase() === receiptNo.trim().toLowerCase(),
      )
    ) {
      window.alert("This receipt number is already saved.");
      return;
    }

    const newReceipt: Receipt = {
      id: `r-new-${Date.now()}`,
      receiptNo: receiptNo.trim(),
      date: receiptDate,
      farmerId: selectedInvoice.farmerId || "",
      farmerName: selectedInvoice.partyName || "Farmer",
      method,
      invoiceNo: selectedInvoice.invoiceNo,
      invoiceAmount: selectedInvoice.amount,
      amount: amountReceived,
      receivedBy: isFRO ? (user?.name ?? "") : receivedBy,
      remarks,
    };

    setCreatedReceipts((prev) => {
      const next = [newReceipt, ...prev];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        window.dispatchEvent(new Event("nature-biotic-store-receipts-updated"));
      } catch {}
      return next;
    });

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
        r.farmerName.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q);

      const matchesFarmer =
        farmerFilter === "all" || r.farmerId === farmerFilter;

      return matchesSearch && matchesFarmer && matchesDate(r.date);
    });
  }, [search, farmerFilter, dateFilter, customFrom, customTo, createdReceipts]);
  return (
    <>
      {isFRO ? (
        froReceiptMode === "create" ? (
          <div className="min-h-full">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeCreateForm();
                    setFroReceiptMode("list");
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Back"
                >
                  <Icon name="arrow_back" size={21} />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                    Create Receipt
                  </h1>
                  <p className="text-slate-500 mt-1">
                    Record payment received from farmer.
                  </p>
                </div>
              </div>
            </div>

            <Card className="p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Select
                  label="Invoice Number"
                  value={invoiceNo}
                  onChange={(value) => {
                    setInvoiceNo(value);
                    const invoice = saleInvoices.find(
                      (item) => item.invoiceNo === value,
                    );
                    setInvoiceAmount(invoice ? Number(invoice.amount || 0) : 0);
                    setAmountReceived(0);
                  }}
                  placeholder="Select sales invoice"
                  options={invoiceOptions}
                  required
                />
                <Input
                  label="Farmer Name"
                  value={selectedInvoice?.partyName || ""}
                  onChange={() => {}}
                  placeholder="Auto-filled from invoice"
                  readOnly
                />
                <Input
                  label="Mobile Number"
                  value={
                    selectedInvoice?.farmerPhone || createFarmer?.phone || ""
                  }
                  onChange={() => {}}
                  placeholder="Auto-filled from farmer"
                  readOnly
                />
                <Input
                  label="Village"
                  value={
                    selectedInvoice?.farmerVillage ||
                    createFarmer?.village ||
                    ""
                  }
                  onChange={() => {}}
                  placeholder="Auto-filled from farmer"
                  readOnly
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
                  onChange={() => {}}
                  readOnly
                />
                <Input
                  label="Amount Received"
                  type="number"
                  value={String(amountReceived)}
                  onChange={(v) => {
                    const next = Number(v) || 0;
                    setAmountReceived(Math.min(next, invoiceAmount || next));
                  }}
                  placeholder="Amount collected now"
                  required
                />
                <Input
                  label="Received By"
                  value={user?.name ?? ""}
                  onChange={() => {}}
                  readOnly
                />
                <Input
                  label="Remarks"
                  value={remarks}
                  onChange={setRemarks}
                  placeholder="Optional receipt notes"
                />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Balance
                  </label>
                  <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-800">
                    {formatCurrency(
                      Math.max(invoiceAmount - amountReceived, 0),
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  closeCreateForm();
                  setFroReceiptMode("list");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateReceipt} disabled={!canCreate}>
                <Icon name="save" size={18} />
                Create Receipt
              </Button>
            </div>
          </div>
        ) : froReceiptMode === "view" && viewReceipt ? (
          <div className="min-h-full">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-5">
              <button
                type="button"
                onClick={() => {
                  setViewReceipt(null);
                  setFroReceiptMode("list");
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Back"
              >
                <Icon name="arrow_back" size={21} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
                  Receipt
                </p>
                <h1 className="text-2xl font-bold text-slate-800">
                  {viewReceipt.receiptNo}
                </h1>
                <p className="text-sm text-slate-500">
                  {formatDate(viewReceipt.date)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Received From
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900">
                  {viewReceipt.farmerName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {farmers.find((farmer) => farmer.id === viewReceipt.farmerId)
                    ?.village || "-"}
                </p>
                <p className="text-xs text-slate-500">
                  Mobile:{" "}
                  {farmers.find((farmer) => farmer.id === viewReceipt.farmerId)
                    ?.phone || "-"}
                </p>
              </Card>

              <Card className="p-0 overflow-hidden">
                <div className="grid grid-cols-2 border-b border-slate-200">
                  <DetailField
                    label="Receipt No"
                    value={viewReceipt.receiptNo}
                  />
                  <DetailField
                    label="Receipt Date"
                    value={formatDate(viewReceipt.date)}
                  />
                  <DetailField
                    label="Invoice No"
                    value={viewReceipt.invoiceNo}
                  />
                  <DetailField
                    label="Payment Method"
                    value={viewReceipt.method}
                  />
                </div>
                <div className="grid grid-cols-2 border-t border-slate-200 sm:grid-cols-4">
                  <DetailField
                    label="Invoice Amount"
                    value={formatCurrency(viewReceipt.invoiceAmount)}
                  />
                  <DetailField
                    label="Amount Received"
                    value={formatCurrency(viewReceipt.amount)}
                    highlight
                  />
                  <DetailField
                    label="Balance"
                    value={formatCurrency(
                      Math.max(
                        viewReceipt.invoiceAmount - viewReceipt.amount,
                        0,
                      ),
                    )}
                  />
                  <DetailField
                    label="Received By"
                    value={viewReceipt.receivedBy || "-"}
                  />
                </div>
              </Card>

              {viewReceipt.remarks && (
                <Card className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Remarks
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {viewReceipt.remarks}
                  </p>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => goStorePage("sales")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Back to Sales"
                >
                  <Icon name="arrow_back" size={21} />
                </button>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Receipt
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setFroReceiptMode("create");
                    setShowCreate(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm hover:bg-brand-800"
                  aria-label="Create Receipt"
                >
                  <Icon name="add" size={21} fill />
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Export"
                >
                  <Icon name="download" size={20} />
                </button>
              </div>
            </div>

            <Card className="p-3 mb-5">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={search}
                  onChange={setSearch}
                  placeholder="Search..."
                  icon="search"
                />
                <Select
                  // label="Farmer"
                  value={farmerFilter}
                  onChange={setFarmerFilter}
                  placeholder="All Farmers"
                  options={farmers
                    .filter(
                      (farmer) =>
                        String(farmer.executiveName || "")
                          .trim()
                          .toLowerCase() ===
                        (user?.name || "").trim().toLowerCase(),
                    )
                    .map((farmer) => ({
                      value: farmer.id,
                      label: farmer.name,
                    }))}
                />
                <Select
                  // label="Date"
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    label="From"
                    type="date"
                    value={customFrom}
                    onChange={setCustomFrom}
                  />
                  <Input
                    label="To"
                    type="date"
                    value={customTo}
                    onChange={setCustomTo}
                  />
                </div>
              )}
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
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                        <th className="w-[10%] border-r border-slate-200 px-1.5 py-3 text-center font-semibold">
                          S.No
                        </th>
                        <th className="w-[18%] border-r border-slate-200 px-1.5 py-3 text-center font-semibold">
                          Date
                        </th>
                        <th className="w-[48%] border-r border-slate-200 px-2 py-3 text-left font-semibold">
                          Farmer Details
                        </th>
                        <th className="w-[24%] px-2 py-3 text-right font-semibold">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => {
                        const farmer = farmers.find((f) => f.id === r.farmerId);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => {
                              setViewReceipt(r);
                              setFroReceiptMode("view");
                            }}
                            title="Click to view receipt details"
                            className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                          >
                            <td className="border-r border-slate-100 px-1.5 py-3 text-center font-semibold text-slate-600">
                              {i + 1}
                            </td>
                            <td className="border-r border-slate-100 px-1.5 py-3 text-center whitespace-nowrap text-slate-500">
                              {formatDate(r.date)}
                            </td>
                            <td className="border-r border-slate-100 px-2 py-3 text-left">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {r.farmerName || "-"}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {farmer?.village || "-"}
                              </p>
                              <p className="truncate text-[10px] text-slate-400">
                                {farmer?.phone || "-"}
                              </p>
                            </td>
                            <td className="px-2 py-3 text-right font-bold tabular-nums text-brand-700 whitespace-nowrap">
                              {formatCurrency(r.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )
      ) : (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                {isFRO && (
                  <button
                    type="button"
                    onClick={() => goStorePage("sales")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                    aria-label="Back to Sales"
                  >
                    <Icon name="arrow_back" size={21} />
                  </button>
                )}
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Receipts
                </h1>
              </div>
              <p className="text-slate-500 mt-1">
                Payment receipts collected from farmers.
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
                  placeholder="Search receipt, farmer, invoice..."
                  icon="search"
                />
              </div>

              <div className="w-full xl:w-[175px] xl:shrink-0">
                <Select
                  label="Farmer"
                  value={farmerFilter}
                  onChange={setFarmerFilter}
                  placeholder="All Farmers"
                  options={(isFRO && user?.name
                    ? farmers.filter(
                        (farmer) =>
                          String(farmer.executiveName || "")
                            .trim()
                            .toLowerCase() === user.name.trim().toLowerCase(),
                      )
                    : farmers
                  ).map((farmer) => ({
                    value: farmer.id,
                    label: farmer.name,
                  }))}
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
                farmerFilter !== "all" ||
                dateFilter !== "all" ||
                customFrom ||
                customTo) && (
                <Button
                  variant="secondary"
                  className="xl:shrink-0"
                  onClick={() => {
                    setSearch("");
                    setFarmerFilter("all");
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
          ) : isFRO ? (
            <Card className="overflow-hidden p-0">
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                      <th className="w-[10%] border-r border-slate-200 px-1.5 py-3 text-center font-semibold">
                        S.No
                      </th>
                      <th className="w-[18%] border-r border-slate-200 px-1.5 py-3 text-center font-semibold">
                        Date
                      </th>
                      <th className="w-[48%] border-r border-slate-200 px-2 py-3 text-left font-semibold">
                        Farmer Details
                      </th>
                      <th className="w-[24%] px-2 py-3 text-right font-semibold">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const farmer = farmers.find((f) => f.id === r.farmerId);
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setViewReceipt(r)}
                          title="Click to view receipt details"
                          className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                        >
                          <td className="border-r border-slate-100 px-1.5 py-3 text-center font-semibold text-slate-600">
                            {i + 1}
                          </td>
                          <td className="border-r border-slate-100 px-1.5 py-3 text-center whitespace-nowrap text-slate-500">
                            {formatDate(r.date)}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-left">
                            <p className="truncate text-xs font-semibold text-slate-800">
                              {r.farmerName || "-"}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {farmer?.village || "-"}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              {farmer?.phone || "-"}
                            </p>
                          </td>
                          <td className="px-2 py-3 text-right font-bold tabular-nums text-brand-700 whitespace-nowrap">
                            {formatCurrency(r.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="hidden md:block overflow-x-auto">
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
                        Farmer Name
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
                          {r.farmerName}
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
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {filtered.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setViewReceipt(r)}
                    className="block w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400">
                          #{i + 1} · {formatDate(r.date)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {r.receiptNo}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Invoice: {r.invoiceNo}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-brand-700">
                        {formatCurrency(r.amount)}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">Farmer</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">
                          {r.farmerName}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">Method</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">
                          {r.method}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">
                          Invoice Amount
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-700">
                          {formatCurrency(r.invoiceAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">Balance</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-700">
                          {formatCurrency(
                            Math.max(r.invoiceAmount - r.amount, 0),
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* View Receipt */}
          {viewReceipt && portalRoot
            ? createPortal(
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

    .po-print-hide {
      display: none !important;
    }

    .po-print-only {
      display: block !important;
    }
  }

  @media (max-width: 767px) {
    .receipt-print-area {
      width: calc(100vw - 24px) !important;
      max-width: 420px !important;
      max-height: 92vh !important;
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
                      {isFRO && (
                        <div className="md:hidden space-y-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src="/logo_NB.webp"
                                alt="Nature Biotic"
                                className="h-12 w-16 object-contain"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-extrabold text-slate-900">
                                  {currentStore?.name || "SAIRAM AGRI INPUT"}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {currentStore?.location ||
                                    currentStore?.address ||
                                    "Rajapalayam, Tamil Nadu"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 border-t border-slate-100 pt-3">
                              <p className="text-lg font-extrabold uppercase text-slate-900">
                                Payment Receipt
                              </p>
                              <p className="mt-1 text-xs text-brand-700">
                                {viewReceipt.receiptNo}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Received From
                            </p>
                            <p className="mt-1 text-sm font-extrabold text-slate-900">
                              {viewReceipt.farmerName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {farmers.find(
                                (farmer) => farmer.id === viewReceipt.farmerId,
                              )?.village || "-"}
                            </p>
                            <p className="text-xs text-slate-500">
                              Mobile:{" "}
                              {farmers.find(
                                (farmer) => farmer.id === viewReceipt.farmerId,
                              )?.phone || "-"}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <DetailField
                              label="Receipt No"
                              value={viewReceipt.receiptNo}
                            />
                            <DetailField
                              label="Receipt Date"
                              value={formatDate(viewReceipt.date)}
                            />
                            <DetailField
                              label="Invoice No"
                              value={viewReceipt.invoiceNo}
                            />
                            <DetailField
                              label="Payment Method"
                              value={viewReceipt.method}
                            />
                            <DetailField
                              label="Invoice Amount"
                              value={formatCurrency(viewReceipt.invoiceAmount)}
                            />
                            <DetailField
                              label="Amount Received"
                              value={formatCurrency(viewReceipt.amount)}
                              highlight
                            />
                            <DetailField
                              label="Balance"
                              value={formatCurrency(
                                Math.max(
                                  viewReceipt.invoiceAmount -
                                    viewReceipt.amount,
                                  0,
                                ),
                              )}
                            />
                            <DetailField
                              label="Received By"
                              value={viewReceipt.receivedBy || "-"}
                            />
                          </div>

                          {viewReceipt.remarks && (
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Remarks
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {viewReceipt.remarks}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={isFRO ? "hidden md:block" : "block"}>
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
                                    {currentStore?.name || "SAIRAM AGRI INPUT"}
                                  </h3>
                                  <p className="mt-1 text-[11px] leading-4 text-slate-600">
                                    {currentStore?.address ||
                                      currentStore?.location ||
                                      "Rajapalayam, Tamil Nadu"}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-600">
                                    GSTIN: {currentStore?.gst || "-"}
                                  </p>
                                  <p className="text-[11px] text-slate-600">
                                    Cell: {currentStore?.phone || "-"}
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
                                {viewReceipt.farmerName}
                              </p>
                              <p className="mt-1 text-slate-500">
                                {farmers.find(
                                  (farmer) =>
                                    farmer.id === viewReceipt.farmerId,
                                )?.village || "-"}
                              </p>
                              <p className="mt-1 text-slate-500">
                                Mobile:{" "}
                                {farmers.find(
                                  (farmer) =>
                                    farmer.id === viewReceipt.farmerId,
                                )?.phone || "-"}
                              </p>
                            </div>

                            <div className="p-4">
                              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                                <span className="text-slate-500">
                                  Receipt No
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {viewReceipt.receiptNo}
                                </span>

                                <span className="text-slate-500">
                                  Receipt Date
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {formatDate(viewReceipt.date)}
                                </span>

                                <span className="text-slate-500">
                                  Invoice No
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {viewReceipt.invoiceNo}
                                </span>

                                <span className="text-slate-500">
                                  Payment Method
                                </span>
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
                                    viewReceipt.invoiceAmount -
                                      viewReceipt.amount,
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

                          {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                          <div className="grid min-h-[110px] grid-cols-[1fr_300px] border-t border-slate-300">
                            {/* NOTES */}
                            <div className="flex flex-col justify-end border-r border-slate-300 p-4">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                Notes
                              </p>

                              {(() => {
                                const defaultNotes = `Purchase order raised by ${
                                  currentStore?.name ?? "this store"
                                } to Nature Biotic.`;

                                return (
                                  <>
                                    {/* Screen - Editable Notes */}
                                    <textarea
                                      value={purchaseOrderNotes}
                                      onChange={(e) =>
                                        setPurchaseOrderNotes(e.target.value)
                                      }
                                      rows={2}
                                      placeholder="Enter notes..."
                                      className="po-print-hide mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 focus:border-brand-500 focus:outline-none"
                                    />

                                    {/* Print - Show edited notes */}
                                    <p className="po-print-only mt-1.5 hidden whitespace-pre-line text-xs text-slate-500">
                                      {purchaseOrderNotes || defaultNotes}
                                    </p>
                                  </>
                                );
                              })()}
                            </div>

                            {/* AUTHORISED SIGNATORY */}
                            <div className="flex items-end justify-center p-3">
                              <div className="w-full text-center">
                                <div className="border-b border-slate-300" />
                                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                                  Authorised Signatory
                                </p>
                              </div>
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
                        {!isFRO && (
                          <Button onClick={() => window.print()}>
                            <Icon name="print" size={18} />
                            Print Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}

          {/* Create Receipt — same popup shell as Credit Note / Sales */}
          {showCreate &&
            createPortal(
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
                <div className="nb-modal-panel flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  {/* Fixed header */}
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        Create Receipt
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Select a completed sales invoice, then record the amount
                        received from the farmer.
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

                      <Select
                        label="Invoice Number"
                        value={invoiceNo}
                        onChange={(value) => {
                          setInvoiceNo(value);

                          const invoice = saleInvoices.find(
                            (item) => item.invoiceNo === value,
                          );

                          setInvoiceAmount(
                            invoice ? Number(invoice.amount || 0) : 0,
                          );
                          setAmountReceived(0);
                        }}
                        placeholder="Select sales invoice"
                        options={invoiceOptions}
                        required
                      />

                      <Input
                        label="Farmer Name"
                        value={selectedInvoice?.partyName || ""}
                        onChange={() => {}}
                        placeholder="Auto-filled from invoice"
                        readOnly
                      />

                      <Input
                        label="Mobile Number"
                        value={
                          selectedInvoice?.farmerPhone ||
                          createFarmer?.phone ||
                          ""
                        }
                        onChange={() => {}}
                        placeholder="Auto-filled from farmer"
                        readOnly
                      />

                      <Input
                        label="Village"
                        value={
                          selectedInvoice?.farmerVillage ||
                          createFarmer?.village ||
                          ""
                        }
                        onChange={() => {}}
                        placeholder="Auto-filled from farmer"
                        readOnly
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
                        onChange={() => {}}
                        placeholder="Auto-filled from invoice"
                        readOnly
                      />

                      <Input
                        label="Amount Received"
                        type="number"
                        value={String(amountReceived)}
                        onChange={(v) => {
                          const next = Number(v) || 0;
                          setAmountReceived(
                            Math.min(next, invoiceAmount || next),
                          );
                        }}
                        placeholder="Amount collected now"
                        required
                      />

                      {isFRO ? (
                        <Input
                          label="Received By"
                          value={user?.name ?? ""}
                          onChange={() => {}}
                          readOnly
                        />
                      ) : (
                        <Select
                          label="Received By"
                          value={receivedBy}
                          onChange={setReceivedBy}
                          placeholder="Select staff"
                          options={receivers.map((p) => ({
                            value: p,
                            label: p,
                          }))}
                        />
                      )}

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
      )}
    </>
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
