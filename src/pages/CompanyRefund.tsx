import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, EmptyState, Icon, Input, Select } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  matchesSimpleDate,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";
import {
  addCompanyRefund,
  companyRefundsUpdatedEvent,
  getCompanyRefunds,
  getStoreApprovalRequests,
  nextStoreDocumentNo,
  purchaseReturnRefundable,
  rememberStoreDocumentNo,
  storeApprovalRequestsUpdatedEvent,
  type CompanyRefund,
} from "@/lib/data";
import { purchaseReturnsUpdatedEvent } from "@/pages/StorePurchaseReturn";

const methods = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const reasons = [
  "Product Return",
  "Billing Correction",
  "Over Payment",
  "Cancelled Sale",
  "Wrong Product",
  "Other",
];

type ApprovedReturn = {
  storeId: string;
  storeName: string;
  returnNo: string;
  date: string;
  purchaseRef: string;
  total: number;
  items: Array<{
    product?: string;
    packSize?: string;
    quantity?: number;
    total?: number;
  }>;
};

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function loadApprovedReturns(): ApprovedReturn[] {
  return getStoreApprovalRequests()
    .filter(
      (request) =>
        request.type === "Purchase Return" && request.status === "Approved",
    )
    .map((request) => {
      let match: any = null;
      try {
        const raw = localStorage.getItem(
          `naturebiotic:purchase-returns:${request.storeId}`,
        );
        const saved = raw ? JSON.parse(raw) : [];
        match = Array.isArray(saved)
          ? saved.find((row) => row?.returnNo === request.referenceNo)
          : null;
      } catch {
        match = null;
      }
      return {
        storeId: request.storeId,
        storeName: request.storeName,
        returnNo: request.referenceNo,
        date: String(match?.date || request.date || ""),
        purchaseRef: String(match?.purchaseRef || ""),
        total: Number(match?.total || request.amount || 0),
        items: Array.isArray(match?.items) ? match.items : [],
      };
    });
}

export default function CompanyRefund() {
  const [returns, setReturns] = useState<ApprovedReturn[]>([]);
  const [rows, setRows] = useState<CompanyRefund[]>([]);
  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<CompanyRefund | null>(null);
  const [date, setDate] = useState(localDate());
  const [refundNo, setRefundNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [refundError, setRefundError] = useState("");
  const savingRefund = useRef(false);

  useEffect(() => {
    const refresh = () => {
      setReturns(loadApprovedReturns());
      setRows(getCompanyRefunds());
    };
    refresh();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, refresh);
    window.addEventListener(purchaseReturnsUpdatedEvent, refresh);
    window.addEventListener(companyRefundsUpdatedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(storeApprovalRequestsUpdatedEvent, refresh);
      window.removeEventListener(purchaseReturnsUpdatedEvent, refresh);
      window.removeEventListener(companyRefundsUpdatedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const selectedReturn = useMemo(
    () => returns.find((row) => row.returnNo === referenceNo),
    [returns, referenceNo],
  );

  const alreadyRefunded = useMemo(() => {
    if (!selectedReturn) return 0;
    return rows
      .filter(
        (row) =>
          row.storeId === selectedReturn.storeId &&
          row.referenceNo === selectedReturn.returnNo,
      )
      .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
  }, [rows, selectedReturn]);

  const refundable = selectedReturn
    ? purchaseReturnRefundable(selectedReturn.storeId, selectedReturn.returnNo)
    : 0;
  const balanceValue = Math.max(0, refundable - Math.max(0, amount));

  const returnOptions = useMemo(
    () =>
      returns
        .filter(
          (row) => purchaseReturnRefundable(row.storeId, row.returnNo) > 0,
        )
        .map((row) => ({
          value: row.returnNo,
          label: `${row.returnNo} - ${row.storeName}`,
        })),
    [returns, rows],
  );

  const filtered = rows.filter((row) => {
    const matchesDate = matchesSimpleDate(row.date, dateFilter, customFrom, customTo);
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      String(row.refundNo || "").toLowerCase().includes(query) ||
      row.storeName.toLowerCase().includes(query) ||
      row.referenceNo.toLowerCase().includes(query);
    return matchesDate && matchesSearch;
  });

  function resetForm() {
    setDate(localDate());
    setRefundNo(
      nextStoreDocumentNo(
        "NB",
        "REF",
        getCompanyRefunds().map((row) => String(row.refundNo || "")),
      ),
    );
    setReferenceNo("");
    setReason("");
    setPaymentMethod("");
    setAmount(0);
    setRemarks("");
    setRefundError("");
  }

  function closeForm() {
    setShowCreate(false);
    savingRefund.current = false;
  }

  function selectReturn(value: string) {
    setReferenceNo(value);
    setAmount(0);
    setRefundError("");
  }

  function changeRefundAmount(raw: string) {
    const parsed = Number(String(raw).trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmount(0);
      setRefundError(parsed < 0 ? "Refund amount cannot be negative." : "");
      return;
    }
    setAmount(parsed);
    if (selectedReturn && parsed > refundable) {
      setRefundError(
        `Refund cannot exceed the remaining ${formatCurrency(refundable)}.`,
      );
      return;
    }
    setRefundError("");
  }

  function createRefund() {
    if (savingRefund.current || !selectedReturn) return;
    savingRefund.current = true;
    if (!(amount > 0) || amount > refundable) {
      setRefundError(
        `Refund cannot exceed the remaining ${formatCurrency(refundable)}.`,
      );
      savingRefund.current = false;
      return;
    }
    const result = addCompanyRefund({
      storeId: selectedReturn.storeId,
      storeName: selectedReturn.storeName,
      referenceNo: selectedReturn.returnNo,
      amount,
      date,
      refundNo,
      reason,
      paymentMethod,
      remarks,
      balance: Math.max(0, refundable - amount),
      purchaseRef: selectedReturn.purchaseRef,
    });
    savingRefund.current = false;
    if (!result.ok) {
      setRefundError(result.error);
      return;
    }
    rememberStoreDocumentNo("NB", "REF", refundNo);
    setRows(getCompanyRefunds());
    closeForm();
  }

  const canCreate =
    !!selectedReturn &&
    amount > 0 &&
    amount <= refundable &&
    !!reason &&
    !!paymentMethod &&
    !refundError;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Refund
          </h1>
          <p className="mt-1 text-slate-500">
            Refunds issued against approved store purchase returns.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
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
      </div>

      <Card className="mb-5 p-4">
        <div className="max-w-md">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search by refund no, store, purchase return..."
            icon="search"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="sync"
            title="No refunds found"
            description="Create a refund for an approved purchase return."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  {["S.No", "Date", "Ref No", "Store", "Purchase Return", "Reason", "Pay Method", "Amount"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="border-r border-slate-200 px-2 py-3 text-center font-semibold last:border-r-0 last:text-right"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`cursor-pointer border-b border-slate-100 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    } hover:bg-brand-50/40`}
                  >
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {formatDate(row.date)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                      {row.refundNo || "-"}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-700">
                      {row.storeName}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-700">
                      {row.referenceNo}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                      {row.reason || "-"}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                      {row.paymentMethod || "-"}
                    </td>
                    <td className="px-2 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Company Refund
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    Create Refund
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="overflow-y-auto px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Input label="Date" type="date" value={date} onChange={setDate} required />
                  <Input label="Refund No" value={refundNo} onChange={() => {}} readOnly required />
                  <Select
                    label="Purchase Return Number"
                    value={referenceNo}
                    onChange={selectReturn}
                    placeholder="Select approved purchase return"
                    options={returnOptions}
                    required
                  />
                  <Input
                    label="Store Name"
                    value={selectedReturn?.storeName || ""}
                    onChange={() => {}}
                    placeholder="Auto-filled from purchase return"
                    readOnly
                  />
                  <Input
                    label="Purchase Reference"
                    value={selectedReturn?.purchaseRef || ""}
                    onChange={() => {}}
                    placeholder="Auto-filled from purchase return"
                    readOnly
                  />
                  <Input
                    label="Return Amount"
                    value={selectedReturn ? formatCurrency(selectedReturn.total) : ""}
                    onChange={() => {}}
                    placeholder="Auto-filled from purchase return"
                    readOnly
                  />
                  {selectedReturn && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2 lg:col-span-3">
                      <p>
                        <span className="font-semibold">Purchase return:</span>{" "}
                        {selectedReturn.returnNo}
                      </p>
                      <p className="mt-1">
                        <span className="font-semibold">Already refunded:</span>{" "}
                        {formatCurrency(alreadyRefunded)}
                      </p>
                      <div className="mt-2 space-y-1">
                        {selectedReturn.items.map((item, index) => (
                          <p key={`${item.product || "product"}-${index}`}>
                            {item.product || "Product"}
                            {item.packSize ? ` · ${item.packSize}` : ""} · Qty{" "}
                            {Number(item.quantity || 0)} ·{" "}
                            {formatCurrency(Number(item.total || 0))}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 font-semibold">
                        Remaining refundable: {formatCurrency(refundable)}
                      </p>
                    </div>
                  )}
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

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Refund
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selected.refundNo || selected.referenceNo}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Date:</span> {formatDate(selected.date)}</p>
                <p><span className="font-semibold">Store:</span> {selected.storeName}</p>
                <p><span className="font-semibold">Purchase return:</span> {selected.referenceNo}</p>
                <p><span className="font-semibold">Reason:</span> {selected.reason || "-"}</p>
                <p><span className="font-semibold">Payment method:</span> {selected.paymentMethod || "-"}</p>
                <p><span className="font-semibold">Amount:</span> {formatCurrency(selected.amount)}</p>
                <p><span className="font-semibold">Remarks:</span> {selected.remarks || "-"}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
