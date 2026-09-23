import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

type CashReceived = {
  id: string;
  date: string;
  amount: number;
  method: string;
  receivedFrom: string;
  remarks?: string;
  status?: "pending" | "accepted";
  requestedFor?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  settlementId?: string;
};
type Expense = {
  id: string;
  expenseNo?: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  method: string;
  enteredBy?: string;
  settlementId?: string;
};
type CashRefund = {
  id: string;
  date: string;
  amount: number;
  method: string;
  refundedTo: string;
  remarks?: string;
  settlementId?: string;
};

type Props = { storeId?: string };

const RECEIVED_PREFIX = "nature-biotic-fro-cash-received-v1";
const EXPENSE_STORAGE_KEY = "naturebiotic_shared_expenses";
const REFUND_PREFIX = "nature-biotic-fro-cash-refunds-v1";
const SETTLEMENT_PREFIX = "nature-biotic-fro-expense-settlement-v1";

const expenseCategories = [
  "Travel",
  "Food",
  "Fuel",
  "Accommodation",
  "Transport",
  "Other",
];
const paymentMethods = ["Cash", "UPI", "Bank Transfer", "Cheque"];

const getNextExpenseNo = <T extends { expenseNo?: string }>(rows: T[]) => {
  const maxNo = rows.reduce((max, row) => {
    const match = String(row.expenseNo ?? "").match(/EXP-(\d+)/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 400);
  return `EXP-${String(maxNo + 1).padStart(3, "0")}`;
};

const formatExpenseDate = (value: string) => {
  if (!value) return "-";

  // Handle ISO timestamps as well as the normal YYYY-MM-DD value.
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;

  // Existing old entries may already be stored as DD/MM/YYYY.
  const simple = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (simple)
    return `${simple[1].padStart(2, "0")}/${simple[2].padStart(2, "0")}/${simple[3].slice(-2)}`;

  return formatDate(value);
};

const read = <T,>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function FROExpenses({ storeId = "default" }: Props) {
  const { user } = useAuth();
  const receivedKey = `${RECEIVED_PREFIX}:${storeId}`;
  const expenseKey = EXPENSE_STORAGE_KEY;
  const refundKey = `${REFUND_PREFIX}:${storeId}`;

  const [received, setReceived] = useState<CashReceived[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refunds, setRefunds] = useState<CashRefund[]>([]);
  const [form, setForm] = useState<"expense" | "refund" | null>(null);
  const settlementKey = `${SETTLEMENT_PREFIX}:${storeId}`;
  const completedSettlementKey = `${SETTLEMENT_PREFIX}-completed:${storeId}`;
  const [activeSettlementId, setActiveSettlementId] = useState<string>(() => {
    return localStorage.getItem(settlementKey) || `settlement-${Date.now()}`;
  });
  const [showAllList, setShowAllList] = useState<
    "expenses" | "received" | "refund" | null
  >(null);
  const [showPendingCash, setShowPendingCash] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [activePage, setActivePage] = useState<
    "expenses" | "refunds" | "expenseForm" | "refundForm" | null
  >(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Travel");
  const [remarks, setRemarks] = useState("");

  const load = () => {
    setReceived(read<CashReceived>(receivedKey));
    setExpenses(read<Expense>(expenseKey));
    setRefunds(read<CashRefund>(refundKey));
  };
  const saveActiveSettlement = (value: string) => {
    setActiveSettlementId(value);
    localStorage.setItem(settlementKey, value);
  };

  const makeNewSettlement = () => {
    const nextId = `settlement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    saveActiveSettlement(nextId);
    return nextId;
  };

  const getCompletedSettlements = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(completedSettlementKey) || "[]");
    } catch {
      return [];
    }
  };

  const markSettlementCompleted = (settlementId: string) => {
    const completed = getCompletedSettlements();
    if (!completed.includes(settlementId)) {
      localStorage.setItem(
        completedSettlementKey,
        JSON.stringify([...completed, settlementId]),
      );
    }
  };

  useEffect(() => {
    if (!localStorage.getItem(settlementKey)) {
      localStorage.setItem(settlementKey, activeSettlementId);
    }
    load();
    const refresh = () => load();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-cash-received-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nature-biotic-cash-received-updated",
        refresh,
      );
    };
  }, [receivedKey, expenseKey, refundKey, settlementKey]);

  const currentFROName = (user?.name ?? "").trim();
  const currentFROKey = currentFROName.toLowerCase();

  // Only the current/open settlement is shown in the four summary cards.
  // All older settlements remain in History.
  const activeReceived = useMemo(
    () =>
      received.filter(
        (x) =>
          x.status === "accepted" &&
          x.settlementId === activeSettlementId &&
          (x.requestedFor ?? "").trim().toLowerCase() === currentFROKey,
      ),
    [received, activeSettlementId, currentFROKey],
  );

  // Cash is created by Store for this FRO. It becomes part of the
  // settlement only after the FRO accepts it.
  const pendingCashRequests = useMemo(
    () =>
      received.filter(
        (x) =>
          x.status !== "accepted" &&
          (x.requestedFor ?? "").trim().toLowerCase() === currentFROKey,
      ),
    [received, currentFROKey],
  );

  const totalReceived = useMemo(
    () => activeReceived.reduce((s, x) => s + Number(x.amount || 0), 0),
    [activeReceived],
  );

  const froExpenses = useMemo(() => {
    const currentFRO = (user?.name ?? "").trim().toLowerCase();
    if (!currentFRO) return [];

    return expenses.filter(
      (x) =>
        (x.enteredBy ?? "").trim().toLowerCase() === currentFRO &&
        x.settlementId === activeSettlementId,
    );
  }, [expenses, user?.name, activeSettlementId]);

  const totalExpenses = useMemo(
    () => froExpenses.reduce((s, x) => s + Number(x.amount || 0), 0),
    [froExpenses],
  );

  const activeRefunds = useMemo(
    () => refunds.filter((x) => x.settlementId === activeSettlementId),
    [refunds, activeSettlementId],
  );

  const totalRefund = useMemo(
    () => activeRefunds.reduce((s, x) => s + Number(x.amount || 0), 0),
    [activeRefunds],
  );

  const balance = Math.max(totalReceived - totalExpenses - totalRefund, 0);

  // When a settlement is fully settled, move the dashboard to a new empty
  // settlement. The old transactions stay available in History.
  useEffect(() => {
    if (totalReceived > 0 && balance === 0) {
      markSettlementCompleted(activeSettlementId);
      makeNewSettlement();
    }
  }, [balance, totalReceived, activeSettlementId]);

  // A Store acceptance creates a new settlementId. Pick that newly accepted
  // cash as the active settlement when the current dashboard is empty.
  useEffect(() => {
    if (totalReceived !== 0 || balance !== 0) return;

    const completed = getCompletedSettlements();
    const nextAccepted = [...received]
      .filter(
        (x) =>
          x.status === "accepted" &&
          !!x.settlementId &&
          !completed.includes(x.settlementId),
      )
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    if (
      nextAccepted?.settlementId &&
      nextAccepted.settlementId !== activeSettlementId
    ) {
      saveActiveSettlement(nextAccepted.settlementId);
    }
  }, [received, totalReceived, balance, activeSettlementId]);

  const acceptCash = (requestId: string) => {
    const next = received.map((x) =>
      x.id === requestId
        ? {
            ...x,
            status: "accepted" as const,
            acceptedBy: currentFROName,
            acceptedAt: new Date().toISOString(),
            settlementId: activeSettlementId,
          }
        : x,
    );

    setReceived(next);
    localStorage.setItem(receivedKey, JSON.stringify(next));
    window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));
  };

  const saveExpense = () => {
    const value = Number(amount);
    if (value <= 0 || value > balance) return;
    const item: Expense = {
      id: id("expense"),
      expenseNo: getNextExpenseNo(expenses),
      date: new Date().toISOString().split("T")[0],
      category,
      description: description.trim() || category,
      amount: value,
      method,
      enteredBy: user?.name?.trim() ?? "",
      settlementId: activeSettlementId,
    };
    const next = [item, ...expenses];
    setExpenses(next);
    localStorage.setItem(expenseKey, JSON.stringify(next));
    reset();
  };

  const saveRefund = () => {
    const value = Number(amount);
    if (value <= 0 || value > balance) return;
    const item: CashRefund = {
      id: id("refund"),
      date: new Date().toISOString(),
      amount: value,
      method,
      refundedTo: "Store",
      remarks: remarks.trim(),
      settlementId: activeSettlementId,
    };
    const next = [item, ...refunds];
    setRefunds(next);
    localStorage.setItem(refundKey, JSON.stringify(next));
    reset();
  };

  const reset = () => {
    setAmount("");
    setDescription("");
    setRemarks("");
    setMethod("Cash");
    setForm(null);
  };

  const save = form === "expense" ? saveExpense : saveRefund;

  const currentFRO = (user?.name ?? "").trim().toLowerCase();

  const expenseHistoryItems = [...expenses]
    .filter((x) => (x.enteredBy ?? "").trim().toLowerCase() === currentFRO)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((x) => ({
      id: x.id,
      title: x.expenseNo ? `${x.expenseNo} • ${x.description}` : x.description,
      sub: `${x.category} • ${x.method}`,
      amount: x.amount,
      date: x.date,
      cls: "text-red-600",
    }));

  const refundHistoryItems = [...refunds]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((x) => ({
      id: x.id,
      title: "Refund to Store",
      sub: `${x.method}${x.remarks ? ` • ${x.remarks}` : ""}`,
      amount: x.amount,
      date: x.date,
      cls: "text-orange-600",
    }));

  const filteredExpenseHistory = expenseHistoryItems.filter((x) => {
    const q = historySearch.trim().toLowerCase();
    return (
      !q ||
      x.title.toLowerCase().includes(q) ||
      x.sub.toLowerCase().includes(q) ||
      formatExpenseDate(x.date).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {!activePage && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Expenses</h1>
              <p className="mt-1 text-sm text-slate-500">Manage FRO cash, expenses and store refunds.</p>
            </div>
            <button type="button"
              onClick={() => { setForm("expense"); setActivePage("expenseForm"); }}
              disabled={balance <= 0} aria-label="Add Expense" title="Add Expense"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon name="add" size={21} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <button type="button" onClick={() => { setHistorySearch(""); setActivePage("expenses"); }} className="text-left">
              <Summary title="Total Expenses" value={totalExpenses} icon="receipt_long" tone="bg-red-50 text-red-700" clickable />
            </button>
            <Summary title="Amount Received" value={totalReceived} icon="payments" tone="bg-blue-50 text-blue-700" />
            <Summary title="Amount Balance" value={balance} icon="account_balance_wallet" tone="bg-green-50 text-green-700" />
            <button type="button" onClick={() => setActivePage("refunds")} className="text-left">
              <Summary title="Amount Refund" value={totalRefund} icon="undo" tone="bg-orange-50 text-orange-700" clickable />
            </button>
          </div>

          {pendingCashRequests.length > 0 && (
            <button type="button" onClick={() => setShowPendingCash(true)} className="w-full text-left">
              <Card className="overflow-hidden border-amber-200 transition hover:shadow-md">
                <div className="flex items-center gap-3 bg-amber-50 px-4 py-4">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Icon name="pending_actions" size={22} />
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{pendingCashRequests.length}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-900">Cash Received</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{pendingCashRequests.length} pending cash request{pendingCashRequests.length === 1 ? "" : "s"} from Store</p>
                  </div>
                  <Icon name="chevron_right" size={20} />
                </div>
              </Card>
            </button>
          )}

          <Card className="overflow-hidden">
            <div className="border-b px-4 py-4 sm:px-5"><h2 className="font-semibold">Cash Summary</h2></div>
            <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Row label="Cash Received" value={totalReceived} />
              <Row label="Less: Total Expenses" value={totalExpenses} negative />
              <Row label="Less: Cash Refund" value={totalRefund} negative />
            </div>
            <div className="flex flex-col gap-1 border-t bg-slate-50 px-4 py-4 sm:flex-row sm:justify-between">
              <span className="font-semibold text-slate-700">Available Balance</span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(balance)}</span>
            </div>
          </Card>

          <List title="Cash Refund History" empty="No cash refunds yet." items={refundHistoryItems.slice(0, 5)} totalCount={refundHistoryItems.length} onAll={() => setActivePage("refunds")} />
        </>
      )}

      {activePage === "expenses" && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <PageHeader title="Total Expenses" subtitle="Expense History" onBack={() => { setActivePage(null); setHistorySearch(""); }} />
          <div className="space-y-3 p-4 sm:p-5">
            <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search by name, description, method or date..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-500" />
            {filteredExpenseHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No matching entries found.</div>
            ) : (
              <div className="space-y-2">{filteredExpenseHistory.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{x.title}</p>
                    <p className="truncate text-xs text-slate-500">{x.sub} • {formatExpenseDate(x.date)}</p></div>
                  <span className={`shrink-0 text-sm font-bold ${x.cls}`}>{formatCurrency(x.amount)}</span>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      )}

      {activePage === "expenseForm" && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <PageHeader title="Add Expense" onBack={() => { reset(); setActivePage("expenses"); }} />
          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-lg bg-green-50 px-3 py-3 text-sm">Available Balance: <b className="text-green-700">{formatCurrency(balance)}</b></div>
            <Select label="Expense Category" value={category} onChange={setCategory} options={expenseCategories.map((x) => ({ value: x, label: x }))} required />
            <Input label="Description" value={description} onChange={setDescription} placeholder="Enter expense description" required />
            <Input label="Amount" type="number" value={amount} onChange={setAmount} placeholder="Enter amount" required />
            <Select label="Payment Method" value={method} onChange={setMethod} options={paymentMethods.map((x) => ({ value: x, label: x }))} required />
            {Number(amount) > balance && <p className="text-sm text-red-600">Expense cannot be greater than the available balance.</p>}
          </div>
          <div className="flex justify-end gap-2 border-t bg-slate-50 px-4 py-3">
            <Button variant="secondary" onClick={() => { reset(); setActivePage("expenses"); }}>Back</Button>
            <Button onClick={() => { saveExpense(); setActivePage(null); }}>Save Expense</Button>
          </div>
        </div>
      )}

      {activePage === "refunds" && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
            <PageHeader title="Amount Refund" subtitle="Refund History" onBack={() => setActivePage(null)} />
            <button type="button" onClick={() => { setForm("refund"); setActivePage("refundForm"); }} disabled={balance <= 0}
              aria-label="Create Cash Refund" title="Create Cash Refund"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon name="add" size={21} />
            </button>
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            {refundHistoryItems.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">No cash refunds yet.</div> :
              refundHistoryItems.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                  <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">Refund to Store</p><p className="truncate text-xs text-slate-500">{x.sub} • {formatExpenseDate(x.date)}</p></div>
                  <span className="shrink-0 text-sm font-bold text-orange-600">{formatCurrency(x.amount)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {activePage === "refundForm" && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <PageHeader title="Cash Refund" onBack={() => { reset(); setActivePage("refunds"); }} />
          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-lg bg-green-50 px-3 py-3 text-sm">Available Balance: <b className="text-green-700">{formatCurrency(balance)}</b></div>
            <Input label="Refund Amount" type="number" value={amount} onChange={setAmount} placeholder="Enter amount" required />
            <Select label="Payment Method" value={method} onChange={setMethod} options={paymentMethods.map((x) => ({ value: x, label: x }))} required />
            <Input label="Refund To" value="Store" onChange={() => {}} readOnly />
            <Input label="Remarks" value={remarks} onChange={setRemarks} placeholder="Optional" />
            {Number(amount) > balance && <p className="text-sm text-red-600">Refund cannot be greater than the available balance.</p>}
          </div>
          <div className="flex justify-end gap-2 border-t bg-slate-50 px-4 py-3">
            <Button variant="secondary" onClick={() => { reset(); setActivePage("refunds"); }}>Back</Button>
            <Button onClick={() => { saveRefund(); setActivePage(null); }}>Save Refund</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-4 sm:px-5">
      <button type="button" onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        aria-label="Back">
        <Icon name="arrow_back" size={21} />
      </button>
      <div className="min-w-0">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );

}

function Summary({
  title,
  value,
  icon,
  tone,
  clickable,
}: {
  title: string;
  value: number;
  icon: string;
  tone: string;
  clickable?: boolean;
}) {
  return (
    <Card
      className={`p-3 sm:p-4 ${
        clickable ? "transition hover:-translate-y-0.5 hover:shadow-md" : ""
      }`}
    >
      <div className={`w-fit rounded-lg p-2 ${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <p className="mt-3 text-xs text-slate-500 sm:text-sm">{title}</p>
      <p className="mt-1 text-base font-bold sm:text-xl">
        {formatCurrency(value)}
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={`font-semibold ${negative ? "text-red-600" : "text-blue-700"}`}
      >
        {negative ? "-" : ""}
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function List({
  title,
  empty,
  items,
  totalCount,
  onAll,
}: {
  title: string;
  empty: string;
  items: {
    id: string;
    title: string;
    sub: string;
    amount: number;
    date: string;
    cls: string;
  }[];
  totalCount?: number;
  onAll?: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <h2 className="font-semibold">{title}</h2>
        {(totalCount ?? items.length) > 5 && onAll && (
          <button
            type="button"
            onClick={onAll}
            className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            All ({totalCount})
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          {empty}
        </div>
      ) : (
        <div className="divide-y">
          {items.map((x) => (
            <div
              key={x.id}
              className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{x.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {x.sub} • {formatExpenseDate(x.date)}
                </p>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${x.cls}`}>
                {formatCurrency(x.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function HistoryRow({
  type,
  date,
  amount,
  method,
  tone,
}: {
  type: string;
  date: string;
  amount: number;
  method: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-700">{type}</p>
        <p className="truncate text-[11px] text-slate-500">
          {formatExpenseDate(date)} • {method}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-bold ${tone}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  onSave,
  saveLabel = "Save",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[92vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
          <h3 className="truncate text-base font-bold text-slate-900 sm:text-lg">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <div className="space-y-4">{children}</div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:pb-3">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="w-full sm:w-auto" onClick={onSave}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
