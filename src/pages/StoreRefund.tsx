import { ReactNode, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, EmptyState, Icon } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  matchesSimpleDate,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";
import {
  getFarmersByStore,
  getStore,
  getStoreFarmerOutstanding,
  previewRefundSettlement,
  companyRefundParts,
  nextStoreDocumentNo,
  rememberStoreDocumentNo,
} from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";

type SalesReturnSource = {
  id: string;
  date: string;
  returnNo: string;
  invoiceNo: string;
  through: "Direct" | "Executive";
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  placeOfSupply?: string;
  executiveName?: string;
  discountAmount?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total: number;
  items?: Array<{
    product?: { name?: string };
    packSize?: string;
    quantity?: number;
    total?: number;
  }>;
};

const STORE_SALES_RETURN_STORAGE_KEY = "nature-biotic-store-sales-returns-v2";

function ReturnSummary({ row }: { row: SalesReturnSource }) {
  const tax =
    Number(row.sgst || 0) + Number(row.cgst || 0) + Number(row.igst || 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2 lg:col-span-3">
      <p>
        <span className="font-semibold">Original invoice:</span>{" "}
        {row.invoiceNo || "-"}
      </p>
      <p className="mt-1">
        <span className="font-semibold">Discount:</span>{" "}
        {formatCurrency(Number(row.discountAmount || 0))}
      </p>
      <p>
        <span className="font-semibold">Tax:</span> {formatCurrency(tax)}
      </p>
      <div className="mt-2 space-y-1">
        {(row.items || []).map((item, index) => (
          <p key={`${item.product?.name || "product"}-${index}`}>
            {item.product?.name || "Product"}
            {item.packSize ? ` · ${item.packSize}` : ""} · Qty{" "}
            {Number(item.quantity || 0)} · {formatCurrency(Number(item.total || 0))}
          </p>
        ))}
      </div>
      <p className="mt-2 font-semibold">
        Return total: {formatCurrency(Number(row.total || 0))}
      </p>
    </div>
  );
}

type RefundRow = {
  id: string;
  date: string;
  refundNo: string;
  farmerId: string;
  farmerName: string;
  phone: string;
  village: string;
  referenceNo: string;
  invoiceNo?: string;
  invoiceAmount: number;
  reason: string;
  paymentMethod: string;
  amount: number;
  appliedToOutstanding?: number;
  balance?: number;
  remarks: string;
  through?: "Direct" | "Executive";
  executiveName?: string;
  placeOfSupply?: string;
};

const methods = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const reasons = [
  "Product Return",
  "Billing Correction",
  "Over Payment",
  "Cancelled Sale",
  "Wrong Product",
  "Other",
];

const STORAGE_PREFIX = "nature-biotic-store-refunds-v2";

function DetailField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-bold ${
          highlight ? "text-brand-700" : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RefundOutstandingNotice({
  outstanding,
  returnAmount,
  applied,
  maxCash,
  outstandingAfter,
  apply,
  onApply,
}: {
  outstanding: number;
  returnAmount: number;
  applied: number;
  maxCash: number;
  outstandingAfter: number;
  apply: boolean;
  onApply: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700 md:col-span-2 lg:col-span-3">
      <p>
        <span className="font-semibold">Outstanding:</span> {formatCurrency(outstanding)}
      </p>
      <p className="mt-1">
        <span className="font-semibold">Return Amount:</span> {formatCurrency(returnAmount)}
      </p>
      <label className="mt-2 flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={apply}
          onChange={(event) => onApply(event.target.checked)}
        />
        <span>
          {outstanding > 0
            ? "Outstanding exists for this account. Apply refund against outstanding?"
            : "Apply refund against outstanding? There is no outstanding, so the full return stays refundable."}
        </span>
      </label>
      {apply && (
        <>
          <p className="mt-2">
            <span className="font-semibold">Applied to Outstanding:</span>{" "}
            {formatCurrency(applied)}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Remaining Refund:</span> {formatCurrency(maxCash)}
          </p>
          <p className="mt-1 font-semibold">
            Outstanding {formatCurrency(outstanding)} − {formatCurrency(applied)} ={" "}
            {formatCurrency(outstandingAfter)}
          </p>
        </>
      )}
    </div>
  );
}

function loadRows(storageKey: string): RefundRow[] {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function StoreRefund({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage } = useNav();
  const isFRO = user?.role === "fro";
  const savingRefund = useRef(false);
  const farmers = getFarmersByStore(storeId);
  const currentStore = getStore(storeId);
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  // Declare these before memo hooks that depend on them.
  const [showCreate, setShowCreate] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");

  const salesReturns = useMemo<SalesReturnSource[]>(() => {
    try {
      const raw = localStorage.getItem(
        `${STORE_SALES_RETURN_STORAGE_KEY}:${storeId}`,
      );
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [storeId, showCreate]);

  const visibleSalesReturns = useMemo(() => {
    if (!isFRO || !user?.name) return salesReturns;

    const froName = user.name.trim().toLowerCase();

    return salesReturns.filter(
      (row) =>
        row.through === "Executive" &&
        String(row.executiveName || "")
          .trim()
          .toLowerCase() === froName,
    );
  }, [salesReturns, isFRO, user?.name]);

  const selectedReturn = useMemo(
    () => visibleSalesReturns.find((row) => row.returnNo === referenceNo),
    [visibleSalesReturns, referenceNo],
  );

  function selectSalesReturn(value: string) {
    setReferenceNo(value);
    const salesReturn = visibleSalesReturns.find((row) => row.returnNo === value);
    const original = Number(salesReturn?.total || 0);
    const refunded = rows
      .filter((row) => row.referenceNo === value)
      .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
    setInvoiceAmount(original);
    setAmount(Math.max(0, original - refunded));
    setApplyToOutstanding(false);
    setRefundError("");
  }

  const [rows, setRows] = useState<RefundRow[]>(() => {
    return loadRows(storageKey);
  });

  const [search, setSearch] = useState("");
  const [selectedRefund, setSelectedRefund] = useState<RefundRow | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [refundNo, setRefundNo] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [applyToOutstanding, setApplyToOutstanding] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [remarks, setRemarks] = useState("");

  const alreadyRefunded = useMemo(() => {
    if (!selectedReturn) return 0;
    return rows
      .filter((row) => row.referenceNo === selectedReturn.returnNo)
      .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
  }, [rows, selectedReturn]);

  const refundable = Math.max(
    0,
    Number(selectedReturn?.total || 0) - alreadyRefunded,
  );

  const returnOptions = useMemo(
    () =>
      visibleSalesReturns
        .filter((salesReturn) => {
          const refunded = rows
            .filter((row) => row.referenceNo === salesReturn.returnNo)
            .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
          return Number(salesReturn.total || 0) - refunded > 0;
        })
        .map((row) => ({
          value: row.returnNo,
          label: `${row.returnNo} - ${row.partyName}`,
        })),
    [visibleSalesReturns, rows],
  );

  function changeRefundAmount(raw: string) {
    const parsed = Number(String(raw).trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmount(0);
      setRefundError(
        parsed < 0 ? "Refund amount cannot be negative." : "",
      );
      return;
    }
    setAmount(parsed);
    if (!selectedReturn) {
      setRefundError("");
      return;
    }
    const preview = previewRefundSettlement({
      refundable,
      outstanding: accountOutstanding,
      apply: applyToOutstanding,
      cash: parsed,
    });
    if (preview.exceeds) {
      setRefundError(`Refund cannot exceed ${formatCurrency(preview.maxCash)}.`);
      return;
    }
    setRefundError("");
  }

  const selectedFarmer = farmers.find(
    (farmer) => farmer.id === selectedReturn?.farmerId,
  );
  const accountOutstanding = selectedReturn
    ? getStoreFarmerOutstanding(
        storeId,
        String(selectedReturn.farmerId || selectedFarmer?.id || ""),
        selectedReturn.partyName,
      )
    : 0;
  const settlement = previewRefundSettlement({
    refundable,
    outstanding: accountOutstanding,
    apply: applyToOutstanding,
    cash: amount,
  });
  const balanceValue = Math.max(0, settlement.settled - settlement.applied);

  function toggleApplyOutstanding(checked: boolean) {
    const next = previewRefundSettlement({
      refundable,
      outstanding: accountOutstanding,
      apply: checked,
      cash: refundable,
    });
    setApplyToOutstanding(checked);
    setAmount(next.maxCash);
    setRefundError("");
  }

  const canCreate =
    !!date &&
    !!refundNo.trim() &&
    !!selectedReturn &&
    !!reason &&
    !!paymentMethod &&
    settlement.settled > 0 &&
    !settlement.exceeds &&
    !refundError;

  const scopedRows = useMemo(() => {
    if (!isFRO || !user?.name) return rows;

    const froName = user.name.trim().toLowerCase();

    return rows.filter(
      (row) =>
        row.through === "Executive" &&
        String(row.executiveName || "")
          .trim()
          .toLowerCase() === froName,
    );
  }, [rows, isFRO, user?.name]);

  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const searched = !q
      ? scopedRows
      : scopedRows.filter(
          (row) =>
            row.refundNo.toLowerCase().includes(q) ||
            row.farmerName.toLowerCase().includes(q) ||
            row.referenceNo.toLowerCase().includes(q) ||
            row.reason.toLowerCase().includes(q),
        );
    if (isFRO) return searched;
    return searched.filter((row) =>
      matchesSimpleDate(row.date, dateFilter, customFrom, customTo),
    );
  }, [scopedRows, search, isFRO, dateFilter, customFrom, customTo]);

  function nextRefundNo(current = rows) {
    return nextStoreDocumentNo(
      getStore(storeId)?.code || "ST",
      "REF",
      current.map((row) => row.refundNo),
    );
  }

  function resetForm() {
    setDate(new Date().toISOString().split("T")[0]);
    setRefundNo(nextRefundNo());
    setReferenceNo("");
    setInvoiceAmount(0);
    setReason("");
    setPaymentMethod("");
    setAmount(0);
    setApplyToOutstanding(false);
    setRefundError("");
    setRemarks("");
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function saveRows(next: RefundRow[]) {
    setRows(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("nature-biotic-store-refunds-updated"));
    } catch {}
  }

  function createRefund() {
    if (savingRefund.current || !canCreate || !selectedReturn) return;
    savingRefund.current = true;
    const originalTotal = Number(selectedReturn.total || 0);
    const already = rows
      .filter((row) => row.referenceNo === selectedReturn.returnNo)
      .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
    const remaining = Math.max(0, originalTotal - already);
    const preview = previewRefundSettlement({
      refundable: remaining,
      outstanding: accountOutstanding,
      apply: applyToOutstanding,
      cash: amount,
    });
    if (preview.exceeds || preview.settled <= 0) {
      setRefundError(
        preview.settled <= 0
          ? "Enter a refund amount for this sales return."
          : `Refund cannot exceed ${formatCurrency(preview.maxCash)}.`,
      );
      savingRefund.current = false;
      return;
    }

    const allocatedNo = nextRefundNo();
    if (rows.some((row) => row.refundNo === allocatedNo)) {
      savingRefund.current = false;
      return;
    }
    let sourceInvoice: { farmerId?: string; partyName?: string } | undefined;
    try {
      const raw = localStorage.getItem(
        `nature-biotic-store-sales-invoices-v2:${storeId}`,
      );
      const invoices = raw ? JSON.parse(raw) : [];
      sourceInvoice = Array.isArray(invoices)
        ? invoices.find(
            (invoice) =>
              String(invoice?.invoiceNo || "") === String(selectedReturn.invoiceNo || ""),
          )
        : undefined;
    } catch {
      sourceInvoice = undefined;
    }
    const row: RefundRow = {
      id: `refund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      refundNo: allocatedNo,
      farmerId: String(sourceInvoice?.farmerId || selectedReturn.farmerId || ""),
      farmerName:
        String(sourceInvoice?.partyName || selectedReturn.partyName || "Farmer"),
      phone: selectedReturn.farmerPhone || selectedFarmer?.phone || "",
      village: selectedReturn.farmerVillage || selectedFarmer?.village || "",
      referenceNo: selectedReturn.returnNo,
      invoiceNo: selectedReturn.invoiceNo,
      invoiceAmount: originalTotal,
      reason,
      paymentMethod,
      amount: preview.settled,
      appliedToOutstanding: preview.applied,
      balance: Math.max(0, remaining - preview.settled),
      remarks,
      through: selectedReturn.through,
      executiveName:
        selectedReturn.through === "Executive"
          ? selectedReturn.executiveName || ""
          : "",
      placeOfSupply: selectedReturn.placeOfSupply || "Tamil Nadu",
    };

    saveRows([row, ...rows]);
    rememberStoreDocumentNo(getStore(storeId)?.code || "ST", "REF", allocatedNo);
    savingRefund.current = false;
    closeForm();
  }

  return (
    <div>
      {(!isFRO || (!showCreate && !selectedRefund)) && (
        <div
          className={
            isFRO
              ? "mb-5 flex items-center justify-between gap-3"
              : "mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
          }
        >
          <div>
            <div className="flex items-center gap-2">
              {isFRO && (
                <button
                  type="button"
                  onClick={() => goStorePage("sales")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  aria-label="Back to Sales"
                >
                  <Icon name="arrow_back" size={21} />
                </button>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Refund
              </h1>
            </div>
            {!isFRO && (
              <p className="mt-1 text-slate-500">
                Refunds issued against store sales and farmer transactions.
              </p>
            )}
          </div>

          {isFRO ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm hover:bg-brand-800"
              aria-label="Create Refund"
              title="Create Refund"
            >
              <Icon name="add" size={21} />
            </button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
              <div className="w-full sm:w-44">
                <Select
                  label="Date Filter"
                  value={dateFilter}
                  onChange={(value) => setDateFilter(value as SimpleDateFilter)}
                  options={simpleDateFilterOptions}
                />
              </div>
              {dateFilter === "custom" && (
                <>
                  <div className="w-full sm:w-40">
                    <Input
                      label="From Date"
                      type="date"
                      value={customFrom}
                      onChange={setCustomFrom}
                    />
                  </div>
                  <div className="w-full sm:w-40">
                    <Input
                      label="To Date"
                      type="date"
                      value={customTo}
                      onChange={setCustomTo}
                    />
                  </div>
                </>
              )}
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
              >
                <Icon name="add" size={18} />
                Create Refund
              </Button>
            </div>
          )}
        </div>
      )}

      {(!isFRO || (!showCreate && !selectedRefund)) && (
        <Card className="mb-5 p-4">
          <div className="max-w-md">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by refund no, farmer, reference..."
              icon="search"
            />
          </div>
        </Card>
      )}

      {(!isFRO || (!showCreate && !selectedRefund)) && (filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="sync"
            title="No refunds found"
            description="Create a refund or adjust your search."
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
                {filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRefund(row)}
                    title="Click to view refund details"
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                  >
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center font-semibold text-slate-600">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center whitespace-nowrap text-slate-500">
                      {formatDate(row.date)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-left">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {row.farmerName || "-"}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {row.village || "-"}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">
                        {row.phone || "-"}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-right font-bold tabular-nums text-brand-700 whitespace-nowrap">
                      {formatCurrency(companyRefundParts(row).paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  <th className="w-[6%] border-r border-slate-200 px-2 py-3 text-center">
                    S.No
                  </th>
                  <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                    Date
                  </th>
                  <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-center">
                    Ref No
                  </th>
                  <th className="w-[15%] border-r border-slate-200 px-2 py-3 text-center">
                    Farmer Details
                  </th>
                  <th className="w-[16%] border-r border-slate-200 px-2 py-3 text-center">
                    Invoice No
                  </th>
                  <th className="w-[16%] border-r border-slate-200 px-2 py-3 text-center">
                    Reason
                  </th>
                  <th className="w-[13%] border-r border-slate-200 px-2 py-3 text-center">
                    Pay Method
                  </th>
                  <th className="w-[12%] px-2 py-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRefund(row)}
                    className={`cursor-pointer border-b border-slate-100 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    } transition hover:bg-brand-50/40`}
                    title="Click to view refund details"
                  >
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {formatDate(row.date)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                      {row.refundNo}
                    </td>
                    {/* Farmer Details */}
                    <td className="w-[15%] border-r border-slate-200 px-3 py-3.5 text-center">
                      <p className="font-semibold text-slate-800">
                        {row.farmerName}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.village || "-"}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.phone || "-"}
                      </p>
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                      {row.referenceNo}
                    </td>
                    <td className="truncate border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                      {row.reason}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                      {row.paymentMethod}
                    </td>
                    <td className="px-2 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(companyRefundParts(row).paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {filtered.map((row, index) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedRefund(row)}
                className="block w-full p-4 text-left active:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      #{index + 1} · {formatDate(row.date)}
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-800">
                      {row.refundNo}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-extrabold text-brand-700">
                    {formatCurrency(companyRefundParts(row).paid)}
                  </p>
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-800">
                    {row.farmerName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Invoice: {row.referenceNo}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.reason} · {row.paymentMethod}
                  </p>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-[10px] text-slate-400">Invoice Amount</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">
                      {formatCurrency(row.invoiceAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-[10px] text-slate-400">Balance</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">
                      {formatCurrency(
                        Math.max(row.invoiceAmount - row.amount, 0),
                      )}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      ))}

      {!isFRO && showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Refund
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select a sales return, then refund that return amount to
                    the farmer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />

                  <Input
                    label="Refund No"
                    value={refundNo}
                    onChange={() => {}}
                    readOnly
                    required
                  />

                  <Select
                    label="Sales Return Number"
                    value={referenceNo}
                    onChange={selectSalesReturn}
                    placeholder="Select sales return"
                    options={returnOptions}
                    required
                  />

                  <Input
                    label="Farmer Name"
                    value={selectedReturn?.partyName || ""}
                    onChange={() => {}}
                    placeholder="Auto-filled from sales return"
                    readOnly
                  />

                  <Input
                    label="Mobile Number"
                    value={
                      selectedReturn?.farmerPhone ||
                      selectedFarmer?.phone ||
                      ""
                    }
                    onChange={() => {}}
                    placeholder="Auto-filled from sales return"
                    readOnly
                  />

                  <Input
                    label="Village"
                    value={
                      selectedReturn?.farmerVillage ||
                      selectedFarmer?.village ||
                      ""
                    }
                    onChange={() => {}}
                    placeholder="Auto-filled from sales return"
                    readOnly
                  />

                  <Input
                    label="Original Invoice"
                    value={selectedReturn?.invoiceNo || ""}
                    onChange={() => {}}
                    placeholder="Auto-filled from sales return"
                    readOnly
                  />

                  <Input
                    label="Return Amount"
                    type="number"
                    value={String(invoiceAmount)}
                    onChange={() => {}}
                    placeholder="Auto-filled from sales return"
                    readOnly
                  />

                  {selectedReturn && <ReturnSummary row={selectedReturn} />}

                  <Select
                    label="Reason"
                    value={reason}
                    onChange={setReason}
                    placeholder="Select reason"
                    options={reasons.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  <Select
                    label="Payment Method"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Select method"
                    options={methods.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  {selectedReturn && (
                    <RefundOutstandingNotice
                      outstanding={accountOutstanding}
                      returnAmount={refundable}
                      applied={settlement.applied}
                      maxCash={settlement.maxCash}
                      outstandingAfter={settlement.outstandingAfter}
                      apply={applyToOutstanding}
                      onApply={toggleApplyOutstanding}
                    />
                  )}

                  <Input
                    label="Refund Amount"
                    type="number"
                    value={String(amount)}
                    onChange={changeRefundAmount}
                    placeholder="Enter refund amount"
                    required
                  />

                  {refundError && (
                    <p className="text-sm font-medium text-red-600 md:col-span-2 lg:col-span-3">
                      {refundError}
                    </p>
                  )}

                  <Input
                    label="Balance Value"
                    value={formatCurrency(balanceValue)}
                    onChange={() => {}}
                    readOnly
                  />

                  <div className="md:col-span-2">
                    <Input
                      label="Remarks"
                      value={remarks}
                      onChange={setRemarks}
                      placeholder="Optional remarks"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>

                <Button onClick={createRefund} disabled={!canCreate}>
                  <Icon name="save" size={17} />
                  Create Refund
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {!isFRO && selectedRefund &&
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

                .refund-print-area,
                .refund-print-area * {
                  visibility: visible !important;
                }

                .refund-print-area {
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

                .refund-screen-only {
                  display: none !important;
                }

                .refund-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }
              }
            `}</style>

            <div className="refund-print-area flex max-h-[94vh] w-[94vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="refund-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Refund
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedRefund.refundNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRefund(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="refund-scroll min-h-0 flex-1 overflow-y-auto p-4">
                {isFRO && (
                  <div className="space-y-3 md:hidden">
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
                            {currentStore?.address ||
                              currentStore?.location ||
                              "Rajapalayam, Tamil Nadu"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-lg font-extrabold uppercase text-slate-900">
                          Refund Receipt
                        </p>
                        <p className="mt-1 text-xs font-semibold text-brand-700">
                          {selectedRefund.refundNo}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Refund To
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">
                        {selectedRefund.farmerName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedRefund.village || "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Mobile: {selectedRefund.phone || "-"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <DetailField
                        label="Refund No"
                        value={selectedRefund.refundNo}
                      />
                      <DetailField
                        label="Refund Date"
                        value={formatDate(selectedRefund.date)}
                      />
                      <DetailField
                        label="Invoice No"
                        value={selectedRefund.referenceNo}
                      />
                      <DetailField
                        label="Payment Method"
                        value={selectedRefund.paymentMethod}
                      />
                      <DetailField
                        label="Invoice Amount"
                        value={formatCurrency(selectedRefund.invoiceAmount)}
                      />
                      <DetailField
                        label="Refund Amount"
                        value={formatCurrency(selectedRefund.amount)}
                        highlight
                      />
                      <DetailField
                        label="Balance"
                        value={formatCurrency(
                          Math.max(
                            selectedRefund.invoiceAmount -
                              selectedRefund.amount,
                            0,
                          ),
                        )}
                      />
                      <DetailField
                        label="Reason"
                        value={selectedRefund.reason}
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Received / Created By
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedRefund.executiveName || "-"}
                      </p>
                    </div>

                    {selectedRefund.remarks && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Remarks
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {selectedRefund.remarks}
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
                          Refund Receipt
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 border-b border-slate-300 text-sm">
                      <div className="border-r border-slate-300 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Refund To
                        </p>

                        <p className="mt-2 font-bold text-slate-900">
                          {selectedRefund.farmerName}
                        </p>
                        <p className="mt-1 text-slate-500">
                          {selectedRefund.village || "-"}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Mobile: {selectedRefund.phone || "-"}
                        </p>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-[120px_1fr] gap-y-2">
                          <span className="text-slate-500">Refund No</span>
                          <span className="font-semibold text-slate-800">
                            {selectedRefund.refundNo}
                          </span>

                          <span className="text-slate-500">Refund Date</span>
                          <span className="font-semibold text-slate-800">
                            {formatDate(selectedRefund.date)}
                          </span>

                          <span className="text-slate-500">Invoice No</span>
                          <span className="font-semibold text-slate-800">
                            {selectedRefund.referenceNo}
                          </span>

                          <span className="text-slate-500">Payment Method</span>
                          <span className="font-semibold text-slate-800">
                            {selectedRefund.paymentMethod}
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
                          {formatCurrency(selectedRefund.invoiceAmount || 0)}
                        </p>
                      </div>

                      <div className="border-r border-slate-300 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Refund Amount
                        </p>
                        <p className="mt-1 text-lg font-bold text-brand-700">
                          {formatCurrency(selectedRefund.amount)}
                        </p>
                      </div>

                      <div className="border-r border-slate-300 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Balance Value
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-800">
                          {formatCurrency(
                            Math.max(
                              (selectedRefund.invoiceAmount || 0) -
                                selectedRefund.amount,
                              0,
                            ),
                          )}
                        </p>
                      </div>

                      <div className="p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Reason
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {selectedRefund.reason}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_280px]">
                      <div className="border-r border-slate-300 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Remarks
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {selectedRefund.remarks ||
                            `Refund issued against invoice ${selectedRefund.referenceNo}.`}
                        </p>
                      </div>

                      <div className="p-4 text-sm">
                        <div className="flex justify-between py-1.5">
                          <span className="text-slate-500">Invoice Amount</span>
                          <span className="font-semibold">
                            {formatCurrency(selectedRefund.invoiceAmount || 0)}
                          </span>
                        </div>

                        <div className="flex justify-between py-1.5">
                          <span className="text-slate-500">Refunded</span>
                          <span className="font-semibold text-brand-700">
                            {formatCurrency(selectedRefund.amount)}
                          </span>
                        </div>

                        <div className="mt-2 flex justify-between border-t border-slate-300 pt-2">
                          <span className="font-bold text-slate-900">
                            Balance Value
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(
                              Math.max(
                                (selectedRefund.invoiceAmount || 0) -
                                  selectedRefund.amount,
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
              </div>

              <div className="refund-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedRefund(null)}
                >
                  Close
                </Button>
                {!isFRO && (
                  <Button onClick={() => window.print()}>
                    <Icon name="print" size={18} />
                    Print Refund
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {isFRO && showCreate && (
        <div className="min-h-[calc(100vh-180px)] bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 px-1 py-4">
            <button
              type="button"
              onClick={closeForm}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back"
            >
              <Icon name="arrow_back" size={21} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Create Refund</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Select a sales return, then refund that return amount to the farmer.
              </p>
            </div>
          </div>

          <div className="max-h-[calc(100vh-290px)] overflow-y-auto py-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Input label="Date" type="date" value={date} onChange={setDate} required />
              <Input label="Refund No" value={refundNo} onChange={() => {}} readOnly required />
              <Select
                label="Sales Return Number"
                value={referenceNo}
                onChange={selectSalesReturn}
                placeholder="Select sales return"
                options={returnOptions}
                required
              />
              <Input label="Farmer Name" value={selectedReturn?.partyName || ""} onChange={() => {}} placeholder="Auto-filled from sales return" readOnly />
              <Input
                label="Mobile Number"
                value={selectedReturn?.farmerPhone || selectedFarmer?.phone || ""}
                onChange={() => {}}
                placeholder="Auto-filled from sales return"
                readOnly
              />
              <Input
                label="Village"
                value={selectedReturn?.farmerVillage || selectedFarmer?.village || ""}
                onChange={() => {}}
                placeholder="Auto-filled from sales return"
                readOnly
              />
              <Input label="Original Invoice" value={selectedReturn?.invoiceNo || ""} onChange={() => {}} placeholder="Auto-filled from sales return" readOnly />
              <Input label="Return Amount" type="number" value={String(invoiceAmount)} onChange={() => {}} placeholder="Auto-filled from sales return" readOnly />
              {selectedReturn && <ReturnSummary row={selectedReturn} />}
              <Select
                label="Reason"
                value={reason}
                onChange={setReason}
                placeholder="Select reason"
                options={reasons.map((item) => ({ value: item, label: item }))}
                required
              />
              <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                placeholder="Select method"
                options={methods.map((item) => ({ value: item, label: item }))}
                required
              />
              {selectedReturn && (
                <RefundOutstandingNotice
                  outstanding={accountOutstanding}
                  returnAmount={refundable}
                  applied={settlement.applied}
                  maxCash={settlement.maxCash}
                  outstandingAfter={settlement.outstandingAfter}
                  apply={applyToOutstanding}
                  onApply={toggleApplyOutstanding}
                />
              )}
              <Input
                label="Refund Amount"
                type="number"
                value={String(amount)}
                onChange={changeRefundAmount}
                placeholder="Enter refund amount"
                required
              />
              {refundError && (
                <p className="text-sm font-medium text-red-600 md:col-span-2 lg:col-span-3">
                  {refundError}
                </p>
              )}
              <Input
                label="Balance Value"
                value={formatCurrency(balanceValue)}
                onChange={() => {}}
                readOnly
              />
              <div className="md:col-span-2">
                <Input label="Remarks" value={remarks} onChange={setRemarks} placeholder="Optional remarks" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-white py-4">
            <Button variant="secondary" onClick={closeForm}>Cancel</Button>
            <Button onClick={createRefund} disabled={!canCreate}>
              <Icon name="save" size={17} />
              Create Refund
            </Button>
          </div>
        </div>
      )}

      {isFRO && selectedRefund && !showCreate && (
        <div className="min-h-[calc(100vh-180px)] bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 px-1 py-4">
            <button
              type="button"
              onClick={() => setSelectedRefund(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back"
            >
              <Icon name="arrow_back" size={21} />
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Refund</p>
              <h2 className="text-xl font-bold text-slate-800">{selectedRefund.refundNo}</h2>
              <p className="text-xs text-slate-500">{formatDate(selectedRefund.date)}</p>
            </div>
          </div>

          <div className="space-y-3 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Farmer Details</p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">{selectedRefund.farmerName}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedRefund.village || "-"}</p>
                <p className="text-xs text-slate-500">{selectedRefund.phone || "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Refund Details</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <DetailField label="Invoice No" value={selectedRefund.referenceNo} />
                  <DetailField label="Refund Date" value={formatDate(selectedRefund.date)} />
                  <DetailField label="Reason" value={selectedRefund.reason} />
                  <DetailField label="Payment Method" value={selectedRefund.paymentMethod} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Refund Summary</p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Invoice Amount</span><span className="font-semibold">{formatCurrency(selectedRefund.invoiceAmount || 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Applied to Outstanding</span><span className="font-bold text-slate-800">{formatCurrency(companyRefundParts(selectedRefund).applied)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Refund Paid</span><span className="font-bold text-brand-700">{formatCurrency(companyRefundParts(selectedRefund).paid)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-3"><span className="font-bold text-slate-900">Balance Value</span><span className="font-bold text-slate-900">{formatCurrency(Math.max((selectedRefund.invoiceAmount || 0) - selectedRefund.amount, 0))}</span></div>
              </div>
            </div>

            {selectedRefund.remarks && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Remarks</p>
                <p className="mt-1 text-sm text-slate-600">{selectedRefund.remarks}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
