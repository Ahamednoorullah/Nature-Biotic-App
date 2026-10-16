import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  froOwnsTransaction,
  getFROCashPosition,
  handoverBelongsToFro,
} from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";
import { usesSupabaseData } from "@/lib/db/mode";
import { loadCashHandovers, createCashHandoverDb, loadFroMoneyPosition, loadDigitalSettlements, createDigitalSettlementDb, type DbHandover } from "@/lib/db/operations";
import { dbErrorMessage } from "@/lib/db/errors";

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
  createdByStaffId?: string;
  remarks?: string;
  status?: "pending" | "accepted" | "rejected";
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
  const savingHandover = useRef(false);
  const receiptStorageKey = `${RECEIPT_STORAGE_PREFIX}:${storeId}`;
  const handoverStorageKey = `${HANDOVER_STORAGE_PREFIX}:${storeId}`;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [listError, setListError] = useState("");
  const [moneyPosition, setMoneyPosition] = useState<{ cashInHand: number; digitalInAccount: number } | null>(null);
  const [digitalRows, setDigitalRows] = useState<Handover[]>([]);
  const [showDigital, setShowDigital] = useState(false);
  const [digitalDate, setDigitalDate] = useState(new Date().toISOString().split("T")[0]);
  const [digitalAmount, setDigitalAmount] = useState("");
  const [digitalMethod, setDigitalMethod] = useState<"UPI" | "Bank Transfer">("UPI");
  const [digitalRemarks, setDigitalRemarks] = useState("");
  const savingDigital = useRef(false);

  const reloadDbHandovers = async () => {
    try {
      const rows = await loadCashHandovers(storeId);
      setHandovers(
        rows.map((r) => ({
          id: r.id,
          date: r.date,
          amount: r.amount,
          method: r.method,
          handedOverBy: r.handedOverBy,
          remarks: r.remarks,
          status: r.status,
          acceptedAt: r.decidedAt,
        })),
      );
      setListError("");
    } catch (error) {
      setListError(dbErrorMessage(error, "Could not load cash handovers."));
    }
  };

  const reloadMoney = async () => {
    if (!user?.staffId) return;
    try {
      const position = await loadFroMoneyPosition(user.staffId);
      if (position) setMoneyPosition(position);
    } catch (error) {
      setListError(dbErrorMessage(error, "Could not load cash in hand."));
    }
  };

  const reloadDigital = async () => {
    try {
      const rows = await loadDigitalSettlements(storeId);
      setDigitalRows(
        rows.map((row) => ({
          id: row.id,
          date: row.date,
          amount: row.amount,
          method: row.method,
          handedOverBy: row.handedOverBy,
          remarks: row.remarks,
          status: row.status,
          acceptedAt: row.decidedAt,
          createdByStaffId: row.froStaffId,
        })),
      );
    } catch (error) {
      setListError(dbErrorMessage(error, "Could not load digital collections."));
    }
  };

  useEffect(() => {
    if (!usesSupabaseData()) return;
    void reloadDbHandovers();
    void reloadMoney();
    void reloadDigital();
  }, [storeId, user?.staffId]);
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
    if (!user?.name && !user?.staffId) return [];
    return receipts.filter((receipt) =>
      froOwnsTransaction(receipt, user?.name || "", user?.staffId || user?.id),
    );
  }, [receipts, user?.name, user?.staffId, user?.id]);

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
  const ownedHandovers = useMemo(
    () =>
      handovers.filter((handover) =>
        handoverBelongsToFro(handover, user?.name || "", [
          user?.staffId,
          user?.id,
        ]),
      ),
    [handovers, user?.name, user?.staffId, user?.id],
  );

  const acceptedHandovers = useMemo(
    () =>
      ownedHandovers.filter(
        (handover) => !handover.status || handover.status === "accepted",
      ),
    [ownedHandovers],
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

  const currentCashInHand = usesSupabaseData()
    ? (moneyPosition?.cashInHand ?? null)
    : getFROCashPosition(storeId, user?.name || "", user?.staffId, user?.id).cashInHand;
  const froNameKey = (user?.name || "").trim().toLowerCase();
  const pendingCashReserved = useMemo(
    () =>
      handovers
        .filter((handover) => {
          if (String(handover.status || "").toLowerCase() !== "pending") return false;
          if (String(handover.method || "cash").toLowerCase() !== "cash") return false;
          return handoverBelongsToFro(handover, user?.name || "", [
            user?.staffId,
            user?.id,
          ]);
        })
        .reduce((sum, handover) => sum + (Number(handover.amount) || 0), 0),
    [handovers, froNameKey],
  );
  const cashAvailableForHandover = Math.max(
    (currentCashInHand ?? 0) - pendingCashReserved,
    0,
  );
  const cashHandover = usesSupabaseData() || handoverMethod === "Cash";
  const requestedAmount = Number(handoverAmount) || 0;
  const handoverExceedsCash =
    cashHandover && requestedAmount > cashAvailableForHandover;
  const canCreateHandover =
    requestedAmount > 0 &&
    !!user?.name &&
    (!cashHandover || requestedAmount <= cashAvailableForHandover);
  const balanceAmount = currentCashInHand ?? 0;
  const pendingDigital = digitalRows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const digitalAvailable = Math.max((moneyPosition?.digitalInAccount ?? 0) - pendingDigital, 0);

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
    if (!usesSupabaseData()) loadPaymentData();

    const refresh = () => {
      if (usesSupabaseData()) {
        void reloadDbHandovers();
        void reloadMoney();
        void reloadDigital();
        return;
      }
      loadPaymentData();
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-handover-updated", refresh);
    window.addEventListener("nature-biotic-store-receipts-updated", refresh);
    window.addEventListener("nature-biotic-store-refunds-updated", refresh);
    window.addEventListener("nature-biotic-cash-received-updated", refresh);
    window.addEventListener("nature-biotic-digital-settlement-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("nature-biotic-handover-updated", refresh);
      window.removeEventListener("nature-biotic-store-receipts-updated", refresh);
      window.removeEventListener("nature-biotic-store-refunds-updated", refresh);
      window.removeEventListener("nature-biotic-cash-received-updated", refresh);
      window.removeEventListener("nature-biotic-digital-settlement-updated", refresh);
    };
  }, [receiptStorageKey, handoverStorageKey, storeId, user?.staffId]);

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

  async function handleCreateHandover() {
    if (savingHandover.current || !canCreateHandover || !user?.name) return;
    savingHandover.current = true;

    if (usesSupabaseData()) {
      try {
        const methodKey = "cash" as const;

        await createCashHandoverDb(
          requestedAmount,
          methodKey,
          handoverDate,
          handoverRemarks.trim() || undefined,
        );
        savingHandover.current = false;
        closeHandoverForm();
        setShowHandoverDetails(true);
        await reloadDbHandovers();
        return;
      } catch (err) {
        window.alert(dbErrorMessage(err, "Failed to submit cash handover"));
        savingHandover.current = false;
        return;
      }
    }

    const newHandover: Handover = {
      id: `fro-ho-${Date.now()}`,
      date: handoverDate,
      amount: requestedAmount,
      method: handoverMethod,
      handedOverBy: user.name,
      createdByStaffId: user.staffId || user.id,
      remarks: handoverRemarks.trim() || undefined,
      status: "pending",
    };

    const nextHandovers = [...handovers, newHandover];
    setHandovers(nextHandovers);
    localStorage.setItem(handoverStorageKey, JSON.stringify(nextHandovers));
    savingHandover.current = false;
    closeHandoverForm();
    setShowHandoverDetails(true);
    window.dispatchEvent(new Event("nature-biotic-handover-updated"));
  }

  const digitalRequested = Number(digitalAmount) || 0;
  const canSettleDigital =
    usesSupabaseData() &&
    digitalRequested > 0 &&
    digitalRequested <= digitalAvailable;

  async function handleCreateDigitalSettlement() {
    if (savingDigital.current || !canSettleDigital) return;
    savingDigital.current = true;
    try {
      await createDigitalSettlementDb(
        digitalRequested,
        digitalMethod === "Bank Transfer" ? "bank_transfer" : "upi",
        digitalDate,
        digitalRemarks.trim() || undefined,
      );
      setDigitalAmount("");
      setDigitalRemarks("");
      await reloadDigital();
      window.dispatchEvent(new Event("nature-biotic-digital-settlement-updated"));
    } catch (error) {
      window.alert(dbErrorMessage(error, "Could not submit the digital settlement."));
    } finally {
      savingDigital.current = false;
    }
  }

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-md px-0 pb-24 pt-3 lg:max-w-none">
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
              {listError ? (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {listError}
                </p>
              ) : null}
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

        {/* Only these two boxes are shown on the main Payment page. */}
        {!showHandoverDetails && !showHandover && !showDigital && (
          <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Cash in Hand"
            value={currentCashInHand == null ? "—" : formatCurrency(currentCashInHand)}
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
          {usesSupabaseData() && (
            <button
              type="button"
              onClick={() => setShowDigital(true)}
              className="col-span-2 text-left"
            >
              <SummaryCard
                label="Digital Collection"
                value={moneyPosition == null ? "—" : formatCurrency(moneyPosition.digitalInAccount)}
                icon="account_balance_wallet"
                tone="bg-violet-50 text-violet-700"
                clickable
              />
            </button>
          )}
          </div>
        )}

        {showDigital && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
              <button
                type="button"
                onClick={() => setShowDigital(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                aria-label="Back to Payment"
              >
                <Icon name="arrow_back" size={21} />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  MY ACCOUNT
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-800">
                  Digital Collection
                </h2>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-sm text-slate-500">
                UPI and bank receipts collected into My Account stay here. This transfer does not change Cash in Hand, and it stays pending until the store accepts it.
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Available to transfer {formatCurrency(digitalAvailable)}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Date" type="date" value={digitalDate} onChange={setDigitalDate} required />
                <Input
                  label="Amount"
                  type="number"
                  value={digitalAmount}
                  onChange={setDigitalAmount}
                  placeholder="Enter amount"
                  required
                />
                <Select
                  label="Transfer Method"
                  value={digitalMethod}
                  onChange={(value) => setDigitalMethod(value === "Bank Transfer" ? "Bank Transfer" : "UPI")}
                  options={[
                    { value: "UPI", label: "UPI" },
                    { value: "Bank Transfer", label: "Bank Transfer" },
                  ]}
                  required
                />
                <Input label="Remarks" value={digitalRemarks} onChange={setDigitalRemarks} />
              </div>
              <Button onClick={handleCreateDigitalSettlement} disabled={!canSettleDigital}>
                <Icon name="save" size={18} /> Transfer to Store
              </Button>
              <div className="space-y-2">
                {digitalRows.length === 0 ? (
                  <p className="text-sm text-slate-400">No digital transfers yet.</p>
                ) : (
                  digitalRows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{formatCurrency(row.amount)}</p>
                        <p className="text-xs text-slate-500">{row.method} · {formatDate(row.date)}</p>
                      </div>
                      <span className="text-xs font-bold uppercase text-slate-500">{row.status || "pending"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Handover details — in-page for FRO */}
        {showHandoverDetails && !showHandover ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowHandoverDetails(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  aria-label="Back to Payment"
                >
                  <Icon name="arrow_back" size={21} />
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                    STORE HANDOVER
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-slate-800">
                    Handover Details
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetHandoverForm();
                  setShowHandover(true);
                  setShowHandoverDetails(false);
                }}
                disabled={balanceAmount <= 0}
                aria-label="Create Store Handover"
                title="Create Store Handover"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="add" size={21} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              {ownedHandovers.filter((handover) =>
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
                  {ownedHandovers
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
                              {formatDate(handover.date)} · {handover.method}
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
          </div>
        ) : null}

        {/* Create handover — in-page for FRO */}
        {showHandover && (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  closeHandoverForm();
                  setShowHandoverDetails(true);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label="Back to Handover Details"
              >
                <Icon name="arrow_back" size={21} />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  STORE HANDOVER
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-800">
                  Create Handover
                </h2>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
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
                  value={usesSupabaseData() ? "Cash" : handoverMethod}
                  onChange={setHandoverMethod}
                  options={(usesSupabaseData() ? ["Cash"] : handoverMethods).map((method) => ({
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
                      Cash in Hand
                    </span>
                    <span className="text-base font-extrabold text-emerald-800">
                      {formatCurrency(currentCashInHand ?? 0)}
                    </span>
                  </div>
                  {handoverExceedsCash && (
                    <p className="mt-1 text-[11px] font-semibold text-red-600">
                      Handover cannot exceed available cash (
                      {formatCurrency(cashAvailableForHandover)}).
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-emerald-600">
                    This handover stays pending. Cash in Hand changes only after the Store accepts it.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  closeHandoverForm();
                  setShowHandoverDetails(true);
                }}
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
