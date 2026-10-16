import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, Icon } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  matchesSimpleDate,
  type SimpleDateFilter,
} from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { usesSupabaseData } from "@/lib/db/mode";
import {
  loadExpenses,
  loadExpenseCategories,
  createExpenseDb,
  loadCashAdvances,
  acceptCashAdvanceDb,
  loadFroMoneyPosition,
  loadFroCashRefunds,
  createFroCashRefundDb,
  froExpenseRefundFromLabel,
  buildActiveExpenseAdvanceSummary,
  type FroMoneyPosition,
  type FroRefundFrom,
} from "@/lib/db/operations";
import { dbErrorMessage } from "@/lib/db/errors";

const expenseListDateFilters: { value: SimpleDateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

type CashReceived = {
  id: string;
  date: string;
  amount: number;
  method: string;
  receivedFrom: string;
  remarks?: string;
  status?: "pending" | "accepted";
  requestedFor?: string;
  froStaffId?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  settlementId?: string;
  referenceNo?: string;
};

const formatPaymentMethod = (value: string) =>
  String(value || "cash")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  status?: string;
};
type CashRefund = {
  id: string;
  date: string;
  amount: number;
  method: string;
  refundedTo: string;
  remarks?: string;
  settlementId?: string;
  enteredBy?: string;
  status?: string;
  refundNo?: string;
  refundFrom?: FroRefundFrom;
};

const refundFromOptions: { value: FroRefundFrom; label: string }[] = [
  { value: "fro_cash", label: "My Account (Expense Advance)" },
  { value: "store_account", label: "Store Account" },
];

type FroLedgerPage = "expenses" | "refunds" | "expenseForm" | "refundForm";

type Props = {
  storeId?: string;
  /** Open a sub-view immediately (e.g. Sales → Refund). */
  initialPage?: FroLedgerPage | null;
};

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
  "Driver",
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

export default function FROExpenses({
  storeId = "default",
  initialPage = null,
}: Props) {
  const { user } = useAuth();
  const receivedKey = `${RECEIVED_PREFIX}:${storeId}`;
  const expenseKey = EXPENSE_STORAGE_KEY;
  const refundKey = `${REFUND_PREFIX}:${storeId}`;

  const [received, setReceived] = useState<CashReceived[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refunds, setRefunds] = useState<CashRefund[]>([]);
  const [moneyPosition, setMoneyPosition] = useState<FroMoneyPosition | null>(null);
  const [form, setForm] = useState<"expense" | "refund" | null>(
    initialPage === "refundForm" ? "refund" : initialPage === "expenseForm" ? "expense" : null,
  );
  const settlementKey = `${SETTLEMENT_PREFIX}:${storeId}`;
  const completedSettlementKey = `${SETTLEMENT_PREFIX}-completed:${storeId}`;
  const [activeSettlementId, setActiveSettlementId] = useState<string>(() => {
    return localStorage.getItem(settlementKey) || `settlement-${Date.now()}`;
  });
  const [showAllList, setShowAllList] = useState<
    "expenses" | "received" | "refund" | null
  >(null);
  const [showPendingCash, setShowPendingCash] = useState(false);
  const [focusAdvanceId, setFocusAdvanceId] = useState<string>("");
  const [acceptError, setAcceptError] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [expenseDateFilter, setExpenseDateFilter] =
    useState<SimpleDateFilter>("monthly");
  const [refundDateFilter, setRefundDateFilter] =
    useState<SimpleDateFilter>("monthly");
  const [activePage, setActivePage] = useState<FroLedgerPage | null>(
    initialPage ?? null,
  );
  const [listError, setListError] = useState("");
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Travel");
  const [remarks, setRemarks] = useState("");
  const [refundFrom, setRefundFrom] = useState<FroRefundFrom>("fro_cash");

  const currentStaffId = String(
    (user as { staffId?: string } | null)?.staffId || "",
  );
  const supabaseMode = usesSupabaseData();

  const mapAdvances = (rows: Awaited<ReturnType<typeof loadCashAdvances>>): CashReceived[] =>
    rows
      .filter(
        (row) =>
          !currentStaffId ||
          row.froStaffId === currentStaffId ||
          row.froName.trim().toLowerCase() === (user?.name ?? "").trim().toLowerCase(),
      )
      .map((row) => ({
        id: row.id,
        date: row.date,
        amount: row.amount,
        method: formatPaymentMethod(row.method),
        receivedFrom: row.receivedFrom || "Store",
        remarks: row.remarks,
        status: row.status,
        requestedFor: row.froName,
        froStaffId: row.froStaffId,
        acceptedAt: row.acceptedAt,
        settlementId: row.settlementId,
        referenceNo: row.referenceNo,
      }));

  const reloadDbLedger = async () => {
    if (!supabaseMode || !storeId || storeId === "default") return;
    // Use profiles.staff_id only — never auth user id / localStorage (RLS keys on fro_staff_id).
    const staffKey = currentStaffId || undefined;
    setLedgerLoading(true);
    const settled = await Promise.allSettled([
      loadCashAdvances(storeId),
      staffKey ? loadFroMoneyPosition(staffKey) : Promise.resolve(null),
      loadExpenses("fro", storeId),
      // Prefer staff filter when known; otherwise RLS returns this FRO's rows.
      loadFroCashRefunds(staffKey),
    ]);

    const errors: string[] = [];
    const take = <T,>(index: number, fallback: T, label: string): T => {
      const result = settled[index];
      if (result.status === "fulfilled") return result.value as T;
      const message = dbErrorMessage(result.reason, `Could not load ${label}.`);
      console.error(`[FROExpenses] ${label}`, result.reason);
      errors.push(message);
      return fallback;
    };

    const rows = take(0, [] as Awaited<ReturnType<typeof loadCashAdvances>>, "cash advances");
    const position = take(1, null as FroMoneyPosition | null, "cash position");
    const expenseRows = take(2, [] as Awaited<ReturnType<typeof loadExpenses>>, "expenses");
    const refundRows = take(3, [] as Awaited<ReturnType<typeof loadFroCashRefunds>>, "cash refunds");

    setReceived(mapAdvances(rows));
    setMoneyPosition(position);
    setExpenses(
      expenseRows
        .filter(
          (r) =>
            !staffKey ||
            r.froStaffId === staffKey ||
            (r.enteredBy || "").trim().toLowerCase() ===
              (user?.name ?? "").trim().toLowerCase(),
        )
        .map((r) => ({
          id: r.id,
          expenseNo: r.expenseNo,
          date: r.date,
          category: r.category,
          description: r.description,
          amount: r.amount,
          method: r.method,
          enteredBy: r.enteredBy,
          status: r.status,
        })),
    );
    setRefunds(
      refundRows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: r.amount,
        method: r.method,
        refundedTo: r.refundedTo,
        remarks: r.remarks,
        settlementId: r.settlementId,
        status: r.status,
        refundNo: r.refundNo,
        refundFrom: r.refundFrom,
      })),
    );
    setListError(errors[0] || "");
    setLedgerLoading(false);
  };

  const load = () => {
    if (supabaseMode) {
      void reloadDbLedger();
      return;
    }
    setReceived(read<CashReceived>(receivedKey));
    setExpenses(read<Expense>(expenseKey));
    setRefunds(read<CashRefund>(refundKey));
  };

  useEffect(() => {
    if (initialPage) {
      setActivePage(initialPage);
      if (initialPage === "refundForm") setForm("refund");
      if (initialPage === "expenseForm") setForm("expense");
    }
  }, [initialPage]);

  useEffect(() => {
    if (!supabaseMode) return;
    void reloadDbLedger();
  }, [storeId, currentStaffId]);

  useEffect(() => {
    const openPending = (event?: Event) => {
      const detail = (event as CustomEvent<{ advanceId?: string }> | undefined)?.detail;
      let advanceId = String(detail?.advanceId || "").trim();
      if (!advanceId) {
        try {
          advanceId = sessionStorage.getItem("nature-biotic-open-pending-cash") || "";
          sessionStorage.removeItem("nature-biotic-open-pending-cash");
        } catch {
          advanceId = "";
        }
      }
      setFocusAdvanceId(advanceId);
      setAcceptError("");
      setShowPendingCash(true);
      setActivePage(null);
      if (supabaseMode) void reloadDbLedger();
      else load();
    };
    try {
      if (sessionStorage.getItem("nature-biotic-open-pending-cash") != null) {
        openPending();
      }
    } catch {
      // ignore
    }
    window.addEventListener(
      "nature-biotic-open-pending-cash",
      openPending as EventListener,
    );
    return () => {
      window.removeEventListener(
        "nature-biotic-open-pending-cash",
        openPending as EventListener,
      );
    };
  }, [storeId, receivedKey]);

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
    if (!localStorage.getItem(settlementKey) && !supabaseMode) {
      localStorage.setItem(settlementKey, activeSettlementId);
    }
    load();
    const refresh = () => load();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-cash-received-updated", refresh);
    window.addEventListener("nature-biotic-expense-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nature-biotic-cash-received-updated",
        refresh,
      );
      window.removeEventListener("nature-biotic-expense-updated", refresh);
    };
  }, [receivedKey, expenseKey, refundKey, settlementKey, supabaseMode]);

  const currentFROName = (user?.name ?? "").trim();
  const currentFROKey = currentFROName.toLowerCase();

  const isForCurrentFro = (x: CashReceived) => {
    if (currentStaffId && x.froStaffId) return x.froStaffId === currentStaffId;
    return (x.requestedFor ?? "").trim().toLowerCase() === currentFROKey;
  };

  // Accepted Store→FRO cash advances (Supabase: all accepted; offline: open settlement).
  const activeReceived = useMemo(
    () =>
      received.filter(
        (x) =>
          x.status === "accepted" &&
          isForCurrentFro(x) &&
          (supabaseMode || x.settlementId === activeSettlementId),
      ),
    [received, activeSettlementId, currentFROKey, currentStaffId, supabaseMode],
  );

  const pendingCashRequests = useMemo(
    () => received.filter((x) => x.status !== "accepted" && isForCurrentFro(x)),
    [received, currentFROKey, currentStaffId],
  );

  const focusedPendingRequest = useMemo(() => {
    if (!focusAdvanceId) return pendingCashRequests[0] ?? null;
    return (
      pendingCashRequests.find((x) => x.id === focusAdvanceId) ||
      received.find((x) => x.id === focusAdvanceId) ||
      null
    );
  }, [focusAdvanceId, pendingCashRequests, received]);

  const froExpenses = useMemo(() => {
    if (supabaseMode) {
      return expenses.filter((x) => {
        const methodKey = String(x.method || "").toLowerCase().replace(/\s+/g, "_");
        return methodKey === "cash";
      });
    }
    const currentFRO = (user?.name ?? "").trim().toLowerCase();
    if (!currentFRO) return [];
    return expenses.filter(
      (x) =>
        (x.enteredBy ?? "").trim().toLowerCase() === currentFRO &&
        x.settlementId === activeSettlementId,
    );
  }, [expenses, user?.name, activeSettlementId, supabaseMode]);

  const activeRefunds = useMemo(
    () =>
      supabaseMode
        ? refunds
        : refunds.filter((x) => x.settlementId === activeSettlementId),
    [refunds, activeSettlementId, supabaseMode],
  );

  // Active cycle only: after the advance pool last settles to ₹0, summary cards reset.
  // Historical rows remain in the Total Expenses / Amount Refund lists.
  const activeAdvanceSummary = useMemo(() => {
    if (supabaseMode) {
      return buildActiveExpenseAdvanceSummary({
        advances: received.map((row) => ({
          id: row.id,
          amount: row.amount,
          status: row.status,
          method: row.method,
          acceptedAt: row.acceptedAt,
          date: row.date,
        })),
        expenses: expenses.map((row) => ({
          id: row.id,
          amount: row.amount,
          status: row.status,
          method: row.method,
          date: row.date,
        })),
        refunds: refunds.map((row) => ({
          id: row.id,
          amount: row.amount,
          status: row.status,
          method: row.method,
          date: row.date,
          refundFrom: row.refundFrom,
        })),
      });
    }
    const receivedAmt = activeReceived.reduce((s, x) => s + Number(x.amount || 0), 0);
    const expenseAmt = froExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
    const refundAmt = activeRefunds
      .filter((x) => String(x.status || "accepted").toLowerCase() === "accepted")
      .reduce((s, x) => s + Number(x.amount || 0), 0);
    return {
      amountReceived: receivedAmt,
      totalExpenses: expenseAmt,
      amountRefund: refundAmt,
      balance: Math.max(receivedAmt - expenseAmt - refundAmt, 0),
    };
  }, [
    supabaseMode,
    received,
    expenses,
    refunds,
    activeReceived,
    froExpenses,
    activeRefunds,
  ]);

  const totalReceived = activeAdvanceSummary.amountReceived;
  const totalExpenses = activeAdvanceSummary.totalExpenses;
  const totalRefund = activeAdvanceSummary.amountRefund;

  // Available Balance = active expense-advance pool (authoritative DB when available).
  const balance = useMemo(() => {
    if (supabaseMode) {
      if (listError && !moneyPosition) return 0;
      if (moneyPosition) {
        // Prefer DB pool; when settled to zero it matches the active-cycle summary.
        return Math.max(Number(moneyPosition.expenseAdvanceBalance || 0), 0);
      }
      return activeAdvanceSummary.balance;
    }
    return activeAdvanceSummary.balance;
  }, [supabaseMode, moneyPosition, activeAdvanceSummary.balance, listError]);

  // Offline-only settlement rotation. Supabase uses fro_cash_position / open settlements in DB.
  useEffect(() => {
    if (supabaseMode) return;
    if (totalReceived > 0 && balance === 0) {
      markSettlementCompleted(activeSettlementId);
      makeNewSettlement();
    }
  }, [balance, totalReceived, activeSettlementId, supabaseMode]);

  useEffect(() => {
    if (supabaseMode) return;
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
  }, [received, totalReceived, balance, activeSettlementId, supabaseMode]);

  const acceptCash = async (requestId: string) => {
    if (!requestId || acceptingId) return;
    setAcceptError("");
    setAcceptingId(requestId);

    if (supabaseMode) {
      try {
        await acceptCashAdvanceDb(requestId);
        await reloadDbLedger();
        window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));
        setShowPendingCash(false);
        setFocusAdvanceId("");
      } catch (error) {
        setAcceptError(dbErrorMessage(error, "Could not accept cash request."));
      } finally {
        setAcceptingId(null);
      }
      return;
    }

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
    setShowPendingCash(false);
    setFocusAdvanceId("");
    setAcceptingId(null);
  };

  const saveExpense = async () => {
    const value = Number(amount);
    if (value <= 0 || value > balance || savingExpense) return;

    if (supabaseMode) {
      setSavingExpense(true);
      try {
        const catList = await loadExpenseCategories("fro");
        const matchedCat = catList.find((c) => c.name.toLowerCase() === category.toLowerCase()) || catList[0];
        const methodKey = (method.toLowerCase().replace(/\s+/g, "_")) as "cash" | "upi" | "bank_transfer" | "cheque";
        await createExpenseDb({
          p_scope: "fro",
          p_category_id: matchedCat?.id || "",
          p_amount: value,
          p_method: methodKey,
          p_expense_date: new Date().toISOString().split("T")[0],
          p_description: description.trim() || category,
          p_entered_by_name: user?.name?.trim() ?? "",
        });
        reset();
        await reloadDbLedger();
        window.dispatchEvent(new Event("nature-biotic-expense-updated"));
        window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));
        setActivePage(null);
      } catch (err) {
        window.alert(dbErrorMessage(err, "Failed to record FRO expense"));
      } finally {
        setSavingExpense(false);
      }
      return;
    }

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
    window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));
    reset();
  };

  const saveRefund = async () => {
    const value = Number(amount);
    if (value <= 0 || savingExpense) return;
    if (refundFrom === "fro_cash" && value > balance) return;
    if (!refundFrom) {
      window.alert("Select Refund From: My Account or Store Account.");
      return;
    }

    if (supabaseMode) {
      setSavingExpense(true);
      try {
        const methodKey = (method.toLowerCase().replace(/\s+/g, "_")) as
          | "cash"
          | "upi"
          | "bank_transfer"
          | "cheque";
        await createFroCashRefundDb({
          amount: value,
          method: methodKey,
          remarks: remarks.trim() || null,
          refundFrom,
        });
        reset();
        await reloadDbLedger();
        window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));
        setActivePage("refunds");
      } catch (err) {
        window.alert(dbErrorMessage(err, "Failed to record cash refund"));
      } finally {
        setSavingExpense(false);
      }
      return;
    }

    const item: CashRefund = {
      id: id("refund"),
      date: new Date().toISOString(),
      amount: value,
      method,
      refundedTo: "Store",
      remarks: remarks.trim(),
      settlementId: activeSettlementId,
      enteredBy: user?.name?.trim() ?? "",
      status: "pending",
      refundFrom,
    };
    const next = [item, ...refunds];
    setRefunds(next);
    localStorage.setItem(refundKey, JSON.stringify(next));
    window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));
    reset();
    setActivePage("refunds");
  };

  const reset = () => {
    setAmount("");
    setDescription("");
    setRemarks("");
    setMethod("Cash");
    setRefundFrom("fro_cash");
    setForm(null);
  };

  const save = form === "expense" ? saveExpense : saveRefund;

  const currentFRO = (user?.name ?? "").trim().toLowerCase();

  const expenseListRows = useMemo(() => {
    const source = supabaseMode
      ? expenses
      : expenses.filter(
          (x) => (x.enteredBy ?? "").trim().toLowerCase() === currentFRO,
        );
    return [...source]
      .filter((row) => matchesSimpleDate(row.date, expenseDateFilter))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [supabaseMode, expenses, currentFRO, expenseDateFilter]);

  const refundListRows = useMemo(() => {
    return [...activeRefunds]
      .filter((row) => matchesSimpleDate(row.date, refundDateFilter))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [activeRefunds, refundDateFilter]);

  const filteredExpenseListTotal = expenseListRows.reduce(
    (sum, row) =>
      sum +
      (String(row.status || "accepted").toLowerCase() === "accepted"
        ? Number(row.amount || 0)
        : 0),
    0,
  );

  const filteredRefundListTotal = refundListRows.reduce(
    (sum, row) =>
      sum +
      (String(row.status || "accepted").toLowerCase() === "accepted"
        ? Number(row.amount || 0)
        : 0),
    0,
  );

  const refundHistoryItems = [...activeRefunds]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((x) => {
      const status = String(x.status || "accepted");
      const statusLabel =
        status === "pending"
          ? "Pending"
          : status === "rejected"
            ? "Rejected"
            : "Accepted";
      return {
        id: x.id,
        title: x.refundNo || "Refund to Store",
        sub: `${froExpenseRefundFromLabel(x.refundFrom)} • ${x.method}${x.remarks ? ` • ${x.remarks}` : ""} • ${statusLabel}`,
        amount: x.amount,
        date: x.date,
        status: statusLabel,
        cls:
          status === "pending"
            ? "text-amber-600"
            : status === "rejected"
              ? "text-slate-400"
              : "text-orange-600",
      };
    });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {!activePage && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Expenses</h1>
              {listError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {listError}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-slate-500">
                Expense advances, FRO expenses, and unused advance refunds to Store. Farmer sales refunds are under Sales → Refund.
              </p>
            </div>
            <button type="button"
              onClick={() => { setForm("expense"); setActivePage("expenseForm"); }}
              disabled={balance <= 0} aria-label="Add Expense" title="Add Expense"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon name="add" size={21} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                setHistorySearch("");
                setExpenseDateFilter("monthly");
                setActivePage("expenses");
              }}
              className="text-left"
            >
              <Summary title="Total Expenses" value={totalExpenses} icon="receipt_long" tone="bg-red-50 text-red-700" clickable />
            </button>
            <Summary title="Amount Received" value={totalReceived} icon="payments" tone="bg-blue-50 text-blue-700" />
            <Summary title="Amount Balance" value={balance} icon="account_balance_wallet" tone="bg-green-50 text-green-700" />
            <button
              type="button"
              onClick={() => {
                setRefundDateFilter("monthly");
                setActivePage("refunds");
              }}
              className="text-left"
            >
              <Summary title="Amount Refund" value={totalRefund} icon="undo" tone="bg-orange-50 text-orange-700" clickable />
            </button>
          </div>

          {pendingCashRequests.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFocusAdvanceId(pendingCashRequests[0]?.id || "");
                setAcceptError("");
                setShowPendingCash(true);
              }}
              className="w-full text-left"
            >
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
          <PageHeader
            title="Total Expenses"
            subtitle="FRO expense history from Supabase"
            onBack={() => {
              setActivePage(null);
              setHistorySearch("");
            }}
          />
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {expenseListDateFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setExpenseDateFilter(filter.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    expenseDateFilter === filter.value
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-600">Accepted total (filter)</span>
              <span className="font-bold text-red-600">{formatCurrency(filteredExpenseListTotal)}</span>
            </div>
            {listError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {listError}
              </div>
            ) : null}
            {ledgerLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading expenses…</div>
            ) : expenseListRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No expenses found for this date filter.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 text-center font-semibold">S.No</th>
                      <th className="px-2 py-2 text-left font-semibold">Date</th>
                      <th className="px-2 py-2 text-left font-semibold">Expense No</th>
                      <th className="px-2 py-2 text-left font-semibold">Category</th>
                      <th className="px-2 py-2 text-left font-semibold">Description</th>
                      <th className="px-2 py-2 text-right font-semibold">Amount</th>
                      <th className="px-2 py-2 text-left font-semibold">Method</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseListRows.map((row, index) => {
                      const status = String(row.status || "accepted");
                      const statusLabel =
                        status === "pending"
                          ? "Pending"
                          : status === "rejected"
                            ? "Rejected"
                            : "Accepted";
                      return (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 text-center text-slate-500">{index + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                            {formatExpenseDate(row.date)}
                          </td>
                          <td className="px-2 py-2 font-medium text-slate-800">
                            {row.expenseNo || "—"}
                          </td>
                          <td className="px-2 py-2 text-slate-600">{row.category || "—"}</td>
                          <td className="max-w-[12rem] truncate px-2 py-2 text-slate-600">
                            {row.description || "—"}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-red-600">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-2 py-2 text-slate-600">{row.method || "—"}</td>
                          <td
                            className={`px-2 py-2 font-semibold ${
                              status === "pending"
                                ? "text-amber-600"
                                : status === "rejected"
                                  ? "text-slate-400"
                                  : "text-emerald-700"
                            }`}
                          >
                            {statusLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
            <PageHeader
              title="Amount Refund"
              subtitle="Unused expense-advance returns to Store"
              onBack={() => setActivePage(null)}
            />
            <button
              type="button"
              onClick={() => {
                setForm("refund");
                setActivePage("refundForm");
              }}
              disabled={balance <= 0}
              aria-label="Create Cash Refund"
              title="Create Cash Refund"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="add" size={21} />
            </button>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {expenseListDateFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRefundDateFilter(filter.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    refundDateFilter === filter.value
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-600">Accepted total (filter)</span>
              <span className="font-bold text-orange-600">{formatCurrency(filteredRefundListTotal)}</span>
            </div>
            {listError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {listError}
              </div>
            ) : null}
            {ledgerLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading refunds…</div>
            ) : refundListRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No expense-advance refunds found for this date filter.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 text-center font-semibold">S.No</th>
                      <th className="px-2 py-2 text-left font-semibold">Date</th>
                      <th className="px-2 py-2 text-left font-semibold">Refund No</th>
                      <th className="px-2 py-2 text-left font-semibold">Refund From</th>
                      <th className="px-2 py-2 text-right font-semibold">Amount</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundListRows.map((row, index) => {
                      const status = String(row.status || "accepted");
                      const statusLabel =
                        status === "pending"
                          ? "Pending"
                          : status === "rejected"
                            ? "Rejected"
                            : "Accepted";
                      return (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 text-center text-slate-500">{index + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                            {formatExpenseDate(row.date)}
                          </td>
                          <td className="px-2 py-2 font-medium text-slate-800">
                            {row.refundNo || "—"}
                          </td>
                          <td className="px-2 py-2 text-slate-600">
                            {froExpenseRefundFromLabel(row.refundFrom)}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-orange-600">
                            {formatCurrency(row.amount)}
                          </td>
                          <td
                            className={`px-2 py-2 font-semibold ${
                              status === "pending"
                                ? "text-amber-600"
                                : status === "rejected"
                                  ? "text-slate-400"
                                  : "text-emerald-700"
                            }`}
                          >
                            {statusLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activePage === "refundForm" && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <PageHeader title="Cash Refund" onBack={() => { reset(); setActivePage("refunds"); }} />
          <div className="space-y-4 p-4 sm:p-5">
            {refundFrom === "fro_cash" ? (
              <div className="rounded-lg bg-green-50 px-3 py-3 text-sm">
                Expense advance available: <b className="text-green-700">{formatCurrency(balance)}</b>
                <p className="mt-1 text-xs text-slate-600">
                  Pending refunds do not reduce the expense advance balance until the Store accepts.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Store Account refunds do not change FRO Cash in Hand. They still require Store acceptance.
              </div>
            )}
            <Select
              label="Refund From"
              value={refundFrom}
              onChange={(value) => setRefundFrom(value as FroRefundFrom)}
              options={refundFromOptions}
              required
            />
            <Input label="Refund Amount" type="number" value={amount} onChange={setAmount} placeholder="Enter amount" required />
            <Select label="Payment Method" value={method} onChange={setMethod} options={paymentMethods.map((x) => ({ value: x, label: x }))} required />
            <Input label="Refund To" value="Store" onChange={() => {}} readOnly />
            <Input label="Remarks" value={remarks} onChange={setRemarks} placeholder="Optional" />
            {refundFrom === "fro_cash" && Number(amount) > balance && (
              <p className="text-sm text-red-600">Refund cannot be greater than the available expense advance.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t bg-slate-50 px-4 py-3">
            <Button variant="secondary" onClick={() => { reset(); setActivePage("refunds"); }}>Back</Button>
            <Button
              disabled={
                savingExpense ||
                Number(amount) <= 0 ||
                (refundFrom === "fro_cash" && Number(amount) > balance)
              }
              onClick={() => void saveRefund()}
            >
              {savingExpense ? "Saving…" : "Save Refund"}
            </Button>
          </div>
        </div>
      )}

      {showPendingCash &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-4 sm:px-5">
                <div>
                  <h3 className="font-bold text-slate-900">Cash Received Request</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Review the Store cash request and accept to add it to your balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPendingCash(false);
                    setFocusAdvanceId("");
                    setAcceptError("");
                  }}
                  aria-label="Close"
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {pendingCashRequests.length > 1 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pending requests
                    </p>
                    {pendingCashRequests.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setFocusAdvanceId(row.id);
                          setAcceptError("");
                        }}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          focusedPendingRequest?.id === row.id
                            ? "border-brand-500 bg-brand-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {row.referenceNo || row.id}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {formatExpenseDate(row.date)} · {row.method}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-slate-800">
                            {formatCurrency(row.amount)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!focusedPendingRequest ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                    {listError || "No pending cash request found."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Detail
                      label="Reference No"
                      value={focusedPendingRequest.referenceNo || focusedPendingRequest.id}
                    />
                    <Detail
                      label="Date"
                      value={formatExpenseDate(focusedPendingRequest.date)}
                    />
                    <Detail label="From" value={focusedPendingRequest.receivedFrom || "Store"} />
                    <Detail
                      label="Amount"
                      value={formatCurrency(focusedPendingRequest.amount)}
                    />
                    <Detail label="Payment Method" value={focusedPendingRequest.method} />
                    <Detail
                      label="Status"
                      value={
                        focusedPendingRequest.status === "accepted" ? "Accepted" : "Pending"
                      }
                    />
                    <div className="col-span-2">
                      <Detail
                        label="Description / Remarks"
                        value={focusedPendingRequest.remarks?.trim() || "—"}
                      />
                    </div>
                  </div>
                )}

                {acceptError && (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {acceptError}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t bg-slate-50 px-4 py-3 sm:px-5">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowPendingCash(false);
                    setFocusAdvanceId("");
                    setAcceptError("");
                  }}
                >
                  Close
                </Button>
                {focusedPendingRequest?.status !== "accepted" && (
                  <Button
                    disabled={!focusedPendingRequest || !!acceptingId}
                    onClick={() => void acceptCash(focusedPendingRequest!.id)}
                  >
                    {acceptingId === focusedPendingRequest?.id ? "Accepting…" : "Accept"}
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
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
