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
  companyRefundParts,
  companyRefundsUpdatedEvent,
  getCompanyRefunds,
  getCompanyStoreOutstanding,
  previewRefundSettlement,
  getDatabasePurchaseReturns,
  getStoreApprovalRequests,
  nextStoreDocumentNo,
  purchaseReturnRefundable,
  rememberStoreDocumentNo,
  storeApprovalRequestsUpdatedEvent,
  type CompanyRefund,
} from "@/lib/data";
import { purchaseReturnsUpdatedEvent } from "@/pages/StorePurchaseReturn";
import { refreshPurchasingData } from "@/lib/db/purchasing";
import { usesSupabaseData } from "@/lib/db/mode";
import {
  loadCompanyRefunds,
  loadReturnRefundSources,
  createCompanyRefundForReturnDb,
  type ReturnRefundSource,
} from "@/lib/db/financials";
import { peekDocumentNo } from "@/lib/db/rpc";
import { dbErrorMessage } from "@/lib/db/errors";

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
  sourceId: string;
  purchaseReturnId: string;
  creditNoteId: string;
  creditNoteNo: string;
  storeId: string;
  storeName: string;
  returnNo: string;
  date: string;
  purchaseRef: string;
  total: number;
  refundedTotal: number;
  remaining: number;
  outstanding: number;
  items: Array<{
    product?: string;
    packSize?: string;
    quantity?: number;
    total?: number;
  }>;
};

function refundMethod(label: string) {
  const value = label.trim().toLowerCase();
  if (value === "cash") return "cash";
  if (value === "upi") return "upi";
  if (value === "cheque") return "cheque";
  if (value === "bank transfer" || value === "bank_transfer") return "bank_transfer";
  return null;
}

function sourceToReturn(source: ReturnRefundSource): ApprovedReturn {
  const cached = getDatabasePurchaseReturns().find(
    (row) => row.id === source.purchaseReturnId,
  );
  return {
    sourceId: source.purchaseReturnId,
    purchaseReturnId: source.purchaseReturnId,
    creditNoteId: source.creditNoteId,
    creditNoteNo: source.creditNoteNo,
    storeId: source.storeId,
    storeName: source.storeName,
    returnNo: source.returnNo,
    date: source.date,
    purchaseRef: source.invoiceNo,
    total: source.returnAmount,
    refundedTotal: source.refundedTotal,
    remaining: source.remaining,
    outstanding: source.outstanding,
    items: (cached?.items || []).map((item) => ({
      product: item.product,
      packSize: item.packSize,
      quantity: item.quantity,
      total: item.total,
    })),
  };
}

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
        sourceId: request.referenceNo,
        purchaseReturnId: request.id,
        creditNoteId: "",
        creditNoteNo: "",
        storeId: request.storeId,
        storeName: request.storeName,
        returnNo: request.referenceNo,
        date: String(match?.date || request.date || ""),
        purchaseRef: String(match?.purchaseRef || ""),
        total: Number(match?.total || request.amount || 0),
        refundedTotal: 0,
        remaining: 0,
        outstanding: 0,
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
  const [applyToOutstanding, setApplyToOutstanding] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [refundError, setRefundError] = useState("");
  const [listError, setListError] = useState("");
  const savingRefund = useRef(false);

  const reloadDbCompanyRefunds = async () => {
    const [dbRows, sourceRows] = await Promise.all([
      loadCompanyRefunds(),
      loadReturnRefundSources(),
    ]);
    const byReturn = new Map(sourceRows.map((row) => [row.purchaseReturnId, row]));
    const byCredit = new Map(
      sourceRows.filter((row) => row.creditNoteId).map((row) => [row.creditNoteId, row]),
    );
    setReturns(sourceRows.map(sourceToReturn));
    setRows(
      dbRows.map((r) => {
        const source = byReturn.get(r.purchaseReturnId) || byCredit.get(r.creditNoteId);
        return {
          id: r.id,
          refundNo: r.refundNo,
          date: r.date,
          storeId: r.storeId,
          storeName: r.storeName,
          referenceNo: source?.returnNo || r.creditNoteNo,
          amount: r.amount,
          reason: r.reason,
          paymentMethod: r.method,
          remarks: r.remarks,
          balance: r.paidOutAmount,
          purchaseRef: source?.invoiceNo || "",
          applyToOutstanding: r.appliedToOutstanding > 0,
          appliedToOutstanding: r.appliedToOutstanding,
        };
      }),
    );
    setListError("");
  };

  useEffect(() => {
    let active = true;
    const fail = (error: unknown) => {
      if (!active) return;
      setRows([]);
      setReturns([]);
      setListError(dbErrorMessage(error, "Could not load company refunds."));
    };
    const loadDb = () => {
      if (!usesSupabaseData()) {
        setReturns(loadApprovedReturns());
        setRows(getCompanyRefunds());
        setListError("");
        return;
      }
      reloadDbCompanyRefunds().catch(fail);
    };
    const refresh = () => {
      if (usesSupabaseData()) {
        refreshPurchasingData().catch(() => undefined).then(loadDb);
        return;
      }
      setReturns(loadApprovedReturns());
      setRows(getCompanyRefunds());
      setListError("");
    };
    refresh();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, refresh);
    window.addEventListener(purchaseReturnsUpdatedEvent, loadDb);
    window.addEventListener(companyRefundsUpdatedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(storeApprovalRequestsUpdatedEvent, refresh);
      window.removeEventListener(purchaseReturnsUpdatedEvent, loadDb);
      window.removeEventListener(companyRefundsUpdatedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const selectedReturn = useMemo(
    () => returns.find((row) => row.sourceId === referenceNo),
    [returns, referenceNo],
  );

  const alreadyRefunded = useMemo(() => {
    if (!selectedReturn) return 0;
    if (usesSupabaseData()) return selectedReturn.refundedTotal;
    return rows
      .filter(
        (row) =>
          row.storeId === selectedReturn.storeId &&
          row.referenceNo === selectedReturn.returnNo,
      )
      .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
  }, [rows, selectedReturn]);

  const refundable = selectedReturn
    ? usesSupabaseData()
      ? selectedReturn.remaining
      : purchaseReturnRefundable(selectedReturn.storeId, selectedReturn.returnNo)
    : 0;
  const accountOutstanding = selectedReturn
    ? usesSupabaseData()
      ? selectedReturn.outstanding
      : getCompanyStoreOutstanding(selectedReturn.storeId)
    : 0;
  const settlement = previewRefundSettlement({
    refundable,
    outstanding: accountOutstanding,
    apply: applyToOutstanding,
    cash: amount,
  });
  const balanceValue = Math.max(0, settlement.settled - settlement.applied);

  const returnOptions = useMemo(
    () =>
      returns
        .filter((row) =>
          usesSupabaseData()
            ? row.remaining > 0
            : purchaseReturnRefundable(row.storeId, row.returnNo) > 0,
        )
        .map((row) => ({
          value: row.sourceId,
          label: usesSupabaseData()
            ? `${row.returnNo} - ${row.storeName} - ${row.purchaseRef} - ${formatCurrency(row.remaining)}`
            : `${row.returnNo} - ${row.storeName}`,
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
    if (usesSupabaseData()) {
      peekDocumentNo("company_refund").then((nextNo) => {
        setRefundNo(nextNo || "");
      }).catch((error) => {
        setRefundNo("");
        setRefundError(dbErrorMessage(error, "Could not reserve the next refund number."));
      });
    } else {
      setRefundNo(
        nextStoreDocumentNo(
          "NB",
          "REF",
          getCompanyRefunds().map((row) => String(row.refundNo || "")),
        ),
      );
    }
    setReferenceNo("");
    setReason("");
    setPaymentMethod("");
    setAmount(0);
    setApplyToOutstanding(false);
    setRemarks("");
    setRefundError("");
  }

  function closeForm() {
    setShowCreate(false);
    savingRefund.current = false;
  }

  function selectReturn(value: string) {
    setReferenceNo(value);
    const row = returns.find((item) => item.sourceId === value);
    if (usesSupabaseData()) {
      const available = row?.remaining || 0;
      const due = row?.outstanding || 0;
      const applied = Math.min(available, Math.max(0, due));
      setApplyToOutstanding(true);
      setAmount(Math.max(0, available - applied));
    } else {
      const full = row ? purchaseReturnRefundable(row.storeId, row.returnNo) : 0;
      setAmount(full);
      setApplyToOutstanding(false);
    }
    setRefundError("");
  }

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

  function changeRefundAmount(raw: string) {
    const parsed = Number(String(raw).trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmount(0);
      setRefundError(parsed < 0 ? "Refund amount cannot be negative." : "");
      return;
    }
    setAmount(parsed);
    if (selectedReturn && parsed > settlement.maxCash) {
      setRefundError(
        `Refund cannot exceed ${formatCurrency(settlement.maxCash)}.`,
      );
      return;
    }
    setRefundError("");
  }

  async function createRefund() {
    if (savingRefund.current || !selectedReturn) return;
    savingRefund.current = true;
    if (settlement.exceeds || settlement.settled <= 0) {
      setRefundError(
        settlement.settled <= 0
          ? "Enter a refund amount for this purchase return."
          : `Refund cannot exceed ${formatCurrency(settlement.maxCash)}.`,
      );
      savingRefund.current = false;
      return;
    }

    if (usesSupabaseData()) {
      const cashPaid = Math.min(Math.max(0, amount), settlement.maxCash);
      const methodCode = cashPaid > 0 ? refundMethod(paymentMethod) : null;
      if (cashPaid > 0 && !methodCode) {
        setRefundError("Choose a payment method for the cash portion of this refund.");
        savingRefund.current = false;
        return;
      }
      try {
        await createCompanyRefundForReturnDb({
          p_return_id: selectedReturn.purchaseReturnId,
          p_amount: settlement.settled,
          p_method: methodCode,
          p_reason: reason,
          p_remarks: remarks || null,
          p_refund_date: date,
        });
        await reloadDbCompanyRefunds();
        savingRefund.current = false;
        closeForm();
        return;
      } catch (err: any) {
        savingRefund.current = false;
        setRefundError(dbErrorMessage(err, "Failed to save company refund."));
        return;
      }
    }
    const result = addCompanyRefund({
      storeId: selectedReturn.storeId,
      storeName: selectedReturn.storeName,
      referenceNo: selectedReturn.returnNo,
      amount: settlement.settled,
      date,
      refundNo,
      reason,
      paymentMethod,
      remarks,
      balance: Math.max(0, refundable - settlement.settled),
      purchaseRef: selectedReturn.purchaseRef,
      applyToOutstanding: settlement.applied > 0,
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

  const cashPaidNow = Math.min(Math.max(0, amount), settlement.maxCash);
  const canCreate =
    !!selectedReturn &&
    settlement.settled > 0 &&
    !settlement.exceeds &&
    !!reason &&
    (cashPaidNow <= 0 || !!paymentMethod) &&
    !refundError;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Refund
          </h1>
          {listError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {listError}
            </p>
          ) : null}
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
                      {formatCurrency(companyRefundParts(row).paid)}
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
                    menuPortal
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
                      {selectedReturn.creditNoteNo ? (
                        <p className="mt-1">
                          <span className="font-semibold">Credit note:</span>{" "}
                          {selectedReturn.creditNoteNo}
                        </p>
                      ) : null}
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
                    label="Outstanding"
                    value={selectedReturn ? formatCurrency(accountOutstanding) : ""}
                    onChange={() => {}}
                    readOnly
                  />
                  {selectedReturn && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700 md:col-span-2 lg:col-span-3">
                      <p>
                        <span className="font-semibold">Outstanding:</span>{" "}
                        {formatCurrency(accountOutstanding)}
                      </p>
                      <p className="mt-1">
                        <span className="font-semibold">Return Amount:</span>{" "}
                        {formatCurrency(refundable)}
                      </p>
                      <label className="mt-2 flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={usesSupabaseData() || applyToOutstanding}
                          disabled={usesSupabaseData()}
                          onChange={(event) =>
                            toggleApplyOutstanding(event.target.checked)
                          }
                        />
                        <span>
                          {usesSupabaseData()
                            ? "Outstanding is applied first. Only the remaining amount is paid in cash."
                            : accountOutstanding > 0
                              ? "Outstanding exists for this account. Apply refund against outstanding?"
                              : "Apply refund against outstanding? There is no outstanding, so the full return stays refundable."}
                        </span>
                      </label>
                      {applyToOutstanding && (
                        <>
                          <p className="mt-2">
                            <span className="font-semibold">Applied to Outstanding:</span>{" "}
                            {formatCurrency(settlement.applied)}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Remaining Refund:</span>{" "}
                            {formatCurrency(settlement.maxCash)}
                          </p>
                          <p className="mt-1 font-semibold">
                            Outstanding {formatCurrency(accountOutstanding)} −{" "}
                            {formatCurrency(settlement.applied)} ={" "}
                            {formatCurrency(settlement.outstandingAfter)}
                          </p>
                        </>
                      )}
                    </div>
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
                <p><span className="font-semibold">Applied to outstanding:</span> {formatCurrency(companyRefundParts(selected).applied)}</p>
                <p><span className="font-semibold">Cash refund:</span> {formatCurrency(companyRefundParts(selected).paid)}</p>
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
