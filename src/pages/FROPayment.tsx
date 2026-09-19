import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";

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

type Handover = {
  id: string;
  date: string;
  amount: number;
  method: string;
  handedOverBy: string;
  remarks?: string;
  status?: "pending" | "accepted";
  acceptedAt?: string;
  acceptedBy?: string;
};

const RECEIPT_STORAGE_PREFIX = "nature-biotic-store-receipts-v3";
const HANDOVER_STORAGE_PREFIX = "nature-biotic-fro-handovers-v1";
const handoverMethods = ["Cash", "Bank Transfer", "UPI", "Cheque"];

type PaymentDateFilter = "today" | "monthly" | "custom";

export default function FROPayment({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage } = useNav();
  const receiptStorageKey = `${RECEIPT_STORAGE_PREFIX}:${storeId}`;
  const handoverStorageKey = `${HANDOVER_STORAGE_PREFIX}:${storeId}`;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [showHandover, setShowHandover] = useState(false);
  const [showHandoverDetails, setShowHandoverDetails] = useState(false);
  const [dateFilter, setDateFilter] = useState<PaymentDateFilter>("today");
  const [customDate, setCustomDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [handoverDate, setHandoverDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverMethod, setHandoverMethod] = useState("Cash");
  const [handoverRemarks, setHandoverRemarks] = useState("");

  const froReceipts = useMemo(() => {
    const froName = user?.name?.trim().toLowerCase();
    if (!froName) return [];
    return receipts.filter(
      (receipt) => receipt.receivedBy?.trim().toLowerCase() === froName,
    );
  }, [receipts, user?.name]);

  const isSameDay = (value: string, selectedDate: string) => {
    const d = new Date(value);
    const target = new Date(selectedDate);
    return (
      d.getFullYear() === target.getFullYear() &&
      d.getMonth() === target.getMonth() &&
      d.getDate() === target.getDate()
    );
  };

  const isInSelectedPeriod = (value: string) => {
    const d = new Date(value);
    const now = new Date();

    if (dateFilter === "today")
      return isSameDay(value, now.toISOString().split("T")[0]);

    if (dateFilter === "monthly") {
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    }

    return isSameDay(value, customDate);
  };

  const filteredFroReceipts = useMemo(
    () => froReceipts.filter((receipt) => isInSelectedPeriod(receipt.date)),
    [froReceipts, dateFilter, customDate],
  );

  // Old records without a status are treated as accepted so existing data keeps working.
  const acceptedHandovers = useMemo(
    () =>
      handovers.filter(
        (handover) => !handover.status || handover.status === "accepted",
      ),
    [handovers],
  );

  const filteredAcceptedHandovers = useMemo(
    () =>
      acceptedHandovers.filter((handover) => isInSelectedPeriod(handover.date)),
    [acceptedHandovers, dateFilter, customDate],
  );

  const collectedAmount = useMemo(
    () =>
      filteredFroReceipts.reduce(
        (sum, receipt) => sum + (Number(receipt.amount) || 0),
        0,
      ),
    [filteredFroReceipts],
  );

  const handedOverAmount = useMemo(
    () =>
      filteredAcceptedHandovers.reduce(
        (sum, handover) => sum + (Number(handover.amount) || 0),
        0,
      ),
    [filteredAcceptedHandovers],
  );

  const allCollectedAmount = useMemo(
    () =>
      froReceipts.reduce(
        (sum, receipt) => sum + (Number(receipt.amount) || 0),
        0,
      ),
    [froReceipts],
  );

  const allHandedOverAmount = useMemo(
    () =>
      acceptedHandovers.reduce(
        (sum, handover) => sum + (Number(handover.amount) || 0),
        0,
      ),
    [acceptedHandovers],
  );

  const currentCashInHand = Math.max(
    allCollectedAmount - allHandedOverAmount,
    0,
  );
  const balanceAmount = Math.max(collectedAmount - handedOverAmount, 0);
  const requestedAmount = Number(handoverAmount) || 0;
  const canCreateHandover =
    requestedAmount > 0 && requestedAmount <= currentCashInHand && !!user?.name;

  function loadPaymentData() {
    try {
      const rawReceipts = localStorage.getItem(receiptStorageKey);
      const rawHandovers = localStorage.getItem(handoverStorageKey);

      setReceipts(rawReceipts ? JSON.parse(rawReceipts) : []);
      setHandovers(rawHandovers ? JSON.parse(rawHandovers) : []);
    } catch {
      setReceipts([]);
      setHandovers([]);
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    loadPaymentData();

    const refresh = () => loadPaymentData();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-handover-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("nature-biotic-handover-updated", refresh);
    };
  }, [receiptStorageKey, handoverStorageKey]);

  function resetHandoverForm() {
    setHandoverDate(new Date().toISOString().split("T")[0]);
    setHandoverAmount("");
    setHandoverMethod("Cash");
    setHandoverRemarks("");
  }

  function closeHandoverForm() {
    setShowHandover(false);
    resetHandoverForm();
  }

  function handleCreateHandover() {
    if (!canCreateHandover || !user?.name) return;

    const newHandover: Handover = {
      id: `fro-ho-${Date.now()}`,
      date: handoverDate,
      amount: requestedAmount,
      method: handoverMethod,
      handedOverBy: user.name,
      remarks: handoverRemarks.trim() || undefined,
      status: "pending",
    };

    const nextHandovers = [...handovers, newHandover];
    setHandovers(nextHandovers);
    localStorage.setItem(handoverStorageKey, JSON.stringify(nextHandovers));
    closeHandoverForm();
    setShowHandoverDetails(true);
    window.dispatchEvent(new Event("nature-biotic-handover-updated"));
  }

  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-md px-0 pb-24 pt-3">
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={() => goStorePage("sales")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-600 shadow-sm"
              aria-label="Back to Sales"
            >
              <Icon name="arrow_back" size={21} />
            </button>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                SALES
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-slate-800">
                Payment
              </h1>
            </div>
          </div>

          <div className="shrink-0">
            <PaymentDateFilter
              value={dateFilter}
              customDate={customDate}
              onChange={setDateFilter}
              onCustomDateChange={setCustomDate}
            />
          </div>
        </div>

        {/* Only these two boxes are shown on this page. */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Cash in Hand"
            value={formatCurrency(balanceAmount)}
            icon="payments"
            tone="bg-emerald-50 text-emerald-700"
          />

          <button
            type="button"
            onClick={() => setShowHandoverDetails(true)}
            className="text-left"
          >
            <SummaryCard
              label="Handover Amount"
              value={formatCurrency(handedOverAmount)}
              icon="account_balance"
              tone="bg-blue-50 text-blue-700"
              clickable
            />
          </button>
        </div>

        {/* Handover details / create */}
        {showHandoverDetails &&
          createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setShowHandoverDetails(false);
                }
              }}
            >
              <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                      STORE HANDOVER
                    </p>
                    <h2 className="mt-1 text-lg font-extrabold text-slate-800">
                      Handover Details
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <PaymentDateFilter
                      value={dateFilter}
                      customDate={customDate}
                      onChange={setDateFilter}
                      onCustomDateChange={setCustomDate}
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowHandoverDetails(false);
                        resetHandoverForm();
                        setShowHandover(true);
                      }}
                      disabled={balanceAmount <= 0}
                      aria-label="Create Store Handover"
                      title="Create Store Handover"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="add" size={20} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowHandoverDetails(false)}
                      aria-label="Close"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                    >
                      <Icon name="close" size={20} />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  {handovers.filter((handover) =>
                    isInSelectedPeriod(handover.date),
                  ).length === 0 ? (
                    <div className="py-10 text-center">
                      <Icon
                        name="account_balance"
                        size={32}
                        className="mx-auto text-slate-300"
                      />
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        No handover yet
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Tap + to create a handover request.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {handovers
                        .filter((handover) => isInSelectedPeriod(handover.date))
                        .map((handover) => (
                          <div
                            key={handover.id}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-3.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800">
                                  {formatCurrency(handover.amount)}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {formatDate(handover.date)} ·{" "}
                                  {handover.method}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  By {handover.handedOverBy}
                                </p>
                              </div>

                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  handover.status === "accepted"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {handover.status === "accepted"
                                  ? "Accepted"
                                  : "Pending Store"}
                              </span>
                            </div>

                            {handover.remarks && (
                              <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] text-slate-500">
                                {handover.remarks}
                              </p>
                            )}

                            {handover.status === "accepted" &&
                              handover.acceptedAt && (
                                <p className="mt-2 text-[10px] font-medium text-emerald-600">
                                  Accepted {formatDate(handover.acceptedAt)}
                                  {handover.acceptedBy
                                    ? ` by ${handover.acceptedBy}`
                                    : ""}
                                </p>
                              )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setShowHandoverDetails(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Create handover */}
        {showHandover &&
          createPortal(
            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4">
              <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                      STORE HANDOVER
                    </p>
                    <h2 className="mt-1 text-lg font-extrabold text-slate-800">
                      Create Handover
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeHandoverForm}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Handover Date"
                      type="date"
                      value={handoverDate}
                      onChange={setHandoverDate}
                      required
                    />
                    <Input
                      label="Handover Amount"
                      type="number"
                      value={handoverAmount}
                      onChange={(value) => {
                        const n = Number(value) || 0;
                        setHandoverAmount(String(Math.min(n, balanceAmount)));
                      }}
                      placeholder="Enter amount"
                      required
                    />
                    <Select
                      label="Payment Method"
                      value={handoverMethod}
                      onChange={setHandoverMethod}
                      options={handoverMethods.map((method) => ({
                        value: method,
                        label: method,
                      }))}
                      required
                    />
                    <Input
                      label="Handed Over By"
                      value={user?.name || ""}
                      onChange={() => {}}
                      readOnly
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Remarks"
                        value={handoverRemarks}
                        onChange={setHandoverRemarks}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-emerald-700">
                          Cash in Hand after request
                        </span>
                        <span className="text-base font-extrabold text-emerald-800">
                          {formatCurrency(
                            Math.max(
                              currentCashInHand - (Number(handoverAmount) || 0),
                              0,
                            ),
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-emerald-600">
                        Handover amount will be added after the Store accepts
                        it.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={closeHandoverForm}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleCreateHandover}
                    disabled={!canCreateHandover}
                  >
                    <Icon name="save" size={18} /> Create Handover
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}

function PaymentDateFilter({
  value,
  customDate,
  onChange,
  onCustomDateChange,
  compact = false,
}: {
  value: PaymentDateFilter;
  customDate: string;
  onChange: (value: PaymentDateFilter) => void;
  onCustomDateChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? "shrink-0" : "shrink-0"}`}>
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as PaymentDateFilter)}
          className={`rounded-lg border-0 bg-slate-50 font-semibold text-slate-600 outline-none focus:ring-0 ${
            compact
              ? "px-2 py-2 text-[10px]"
              : "w-[118px] shrink-0 px-2.5 py-2 text-[11px] sm:w-[128px] sm:text-xs"
          }`}
          aria-label="Payment date filter"
        >
          <option value="today">Today</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom Date</option>
        </select>

        {value === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => onCustomDateChange(e.target.value)}
            className={`min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 font-medium text-slate-600 outline-none focus:border-brand-300 ${
              compact
                ? "w-[112px] text-[10px]"
                : "w-[118px] text-[10px] sm:w-[132px] sm:text-xs"
            }`}
            aria-label="Custom payment date"
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  clickable,
}: {
  label: string;
  value: string;
  icon: string;
  tone: string;
  clickable?: boolean;
}) {
  return (
    <Card
      className={`min-h-[108px] rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_7px_24px_rgba(15,23,42,0.05)] ${
        clickable ? "transition hover:-translate-y-0.5 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
        >
          <Icon name={icon} size={21} />
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-semibold text-slate-400">{label}</p>
        <p className="mt-0.5 text-base font-extrabold text-slate-800">
          {value}
        </p>
      </div>
    </Card>
  );
}
