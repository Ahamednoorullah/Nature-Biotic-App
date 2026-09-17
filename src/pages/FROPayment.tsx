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
};

const RECEIPT_STORAGE_PREFIX = "nature-biotic-store-receipts-v3";
const HANDOVER_STORAGE_PREFIX = "nature-biotic-fro-handovers-v1";

const handoverMethods = ["Cash", "Bank Transfer", "UPI", "Cheque"];

export default function FROPayment({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage } = useNav();
  const isFRO = user?.role === "fro";

  const receiptStorageKey = `${RECEIPT_STORAGE_PREFIX}:${storeId}`;
  const handoverStorageKey = `${HANDOVER_STORAGE_PREFIX}:${storeId}`;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [showHandover, setShowHandover] = useState(false);

  const [handoverDate, setHandoverDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverMethod, setHandoverMethod] = useState("Cash");
  const [handoverRemarks, setHandoverRemarks] = useState("");

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

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [receiptStorageKey, handoverStorageKey]);

  const froReceipts = useMemo(() => {
    if (!isFRO || !user?.name) return [];

    const froName = user.name.trim().toLowerCase();

    return receipts.filter(
      (receipt) =>
        String(receipt.receivedBy || "")
          .trim()
          .toLowerCase() === froName,
    );
  }, [receipts, isFRO, user?.name]);

  const collectedAmount = useMemo(
    () =>
      froReceipts.reduce(
        (total, receipt) => total + Number(receipt.amount || 0),
        0,
      ),
    [froReceipts],
  );

  const handedOverAmount = useMemo(
    () =>
      handovers.reduce(
        (total, handover) => total + Number(handover.amount || 0),
        0,
      ),
    [handovers],
  );

  const balanceAmount = Math.max(collectedAmount - handedOverAmount, 0);

  const canCreateHandover =
    Number(handoverAmount) > 0 &&
    Number(handoverAmount) <= balanceAmount &&
    !!handoverDate &&
    !!handoverMethod;

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
    const amount = Number(handoverAmount) || 0;

    if (!canCreateHandover || !user?.name) return;

    const newHandover: Handover = {
      id: `handover-${Date.now()}`,
      date: handoverDate,
      amount,
      method: handoverMethod,
      handedOverBy: user.name,
      remarks: handoverRemarks.trim(),
    };

    setHandovers((prev) => {
      const next = [newHandover, ...prev];

      try {
        localStorage.setItem(handoverStorageKey, JSON.stringify(next));
      } catch {}

      return next;
    });

    closeHandoverForm();
  }

  return (
    <>
      <div className="px-3 pt-2 pb-24 sm:px-4 sm:pt-3 max-w-md mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => goStorePage("sales")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-600 shadow-sm"
            aria-label="Back to Sales"
          >
            <Icon name="arrow_back" size={21} />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
              SALES
            </p>
            <h1 className="text-xl font-extrabold text-slate-800">Payment</h1>
            <p className="text-[11px] text-slate-400">
              Manage collected amount and store handover
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Collected"
            value={formatCurrency(collectedAmount)}
            icon="payments"
            tone="bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            label="Handed Over"
            value={formatCurrency(handedOverAmount)}
            icon="account_balance"
            tone="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            label="FRO Balance"
            value={formatCurrency(balanceAmount)}
            icon="account_balance_wallet"
            tone="bg-amber-50 text-amber-700"
          />
          <SummaryCard
            label="Receipts"
            value={String(froReceipts.length)}
            icon="receipt_long"
            tone="bg-purple-50 text-purple-700"
          />
        </div>

        {/* Handover */}
        <Card className="mt-4 rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                Store Handover
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Record the amount given to the store
              </p>
            </div>

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Icon name="account_balance_wallet" size={21} />
            </span>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold text-slate-400">
              Amount currently with FRO
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-800">
              {formatCurrency(balanceAmount)}
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setShowHandover(true)}
            disabled={balanceAmount <= 0}
            className="mt-3 w-full"
          >
            <Icon name="add" size={18} />
            Record Store Handover
          </Button>
        </Card>

        {/* Receipt collections */}
        <div className="mt-5">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
              RECEIPTS
            </p>
            <h2 className="mt-1 text-base font-extrabold text-slate-800">
              Collected from Farmers
            </h2>
          </div>

          {froReceipts.length === 0 ? (
            <Card className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-[0_6px_22px_rgba(15,23,42,0.05)]">
              <Icon
                name="receipt_long"
                size={30}
                className="mx-auto text-slate-300"
              />
              <p className="mt-2 text-sm font-bold text-slate-700">
                No receipts yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Amounts from receipts created by this FRO will appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {froReceipts.map((receipt) => (
                <Card
                  key={receipt.id}
                  className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_6px_22px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon name="receipt" size={20} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {receipt.farmerName}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {receipt.receiptNo} · {formatDate(receipt.date)}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-extrabold text-slate-800">
                          {formatCurrency(receipt.amount)}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          Collected
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {receipt.method}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Handover history */}
        <div className="mt-5">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
              HANDOVER HISTORY
            </p>
            <h2 className="mt-1 text-base font-extrabold text-slate-800">
              Store Payments
            </h2>
          </div>

          {handovers.length === 0 ? (
            <Card className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-[0_6px_22px_rgba(15,23,42,0.05)]">
              <Icon
                name="account_balance"
                size={30}
                className="mx-auto text-slate-300"
              />
              <p className="mt-2 text-sm font-bold text-slate-700">
                No handover recorded
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Store handover entries will appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {handovers.map((handover) => (
                <Card
                  key={handover.id}
                  className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_6px_22px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Store Handover
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatDate(handover.date)} · {handover.method}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        By {handover.handedOverBy}
                      </p>
                    </div>

                    <p className="text-sm font-extrabold text-blue-700">
                      {formatCurrency(handover.amount)}
                    </p>
                  </div>

                  {handover.remarks && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                      {handover.remarks}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Store Handover */}
      {showHandover &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 sm:p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                    PAYMENT
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">
                    Record Store Handover
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Enter the amount you handed over to the store.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeHandoverForm}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close handover form"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable form body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
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
                      const amount = Number(value) || 0;
                      setHandoverAmount(
                        String(Math.min(amount, balanceAmount)),
                      );
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
                      placeholder="Optional notes"
                    />
                  </div>

                  <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="text-xs font-semibold text-emerald-700">
                        Balance after handover
                      </span>
                      <span className="text-base font-extrabold text-emerald-800">
                        {formatCurrency(
                          Math.max(
                            balanceAmount - (Number(handoverAmount) || 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed footer */}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-5 sm:py-4">
                <Button
                  variant="secondary"
                  onClick={closeHandoverForm}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateHandover}
                  disabled={!canCreateHandover}
                  className="w-full sm:w-auto"
                >
                  <Icon name="save" size={18} />
                  Save Handover
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone: string;
}) {
  return (
    <Card className="min-h-[108px] rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_7px_24px_rgba(15,23,42,0.05)]">
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
