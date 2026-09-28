import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { expenses as allExpenses, type Expense } from "@/lib/purchaseData";
import { staff as staffList } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";

const categories = [
  "Transport",
  "Electricity",
  "Salary",
  "Office Expense",
  "Maintenance",
  "Miscellaneous",
  "Food",
  "Travel",
  "Fuel",
  "Accommodation",
];

const methods = ["Cash", "UPI", "Bank Transfer", "Cheque"];

type CashReceivedRequest = {
  id: string;
  date: string;
  amount: number;
  method: string;
  receivedFrom: string;
  requestedFor?: string;
  remarks?: string;
  status?: "pending" | "accepted";
  acceptedBy?: string;
  acceptedAt?: string;
  settlementId?: string;
};

const EXPENSE_STORAGE_KEY = "naturebiotic_shared_expenses";
const CASH_RECEIVED_PREFIX = "nature-biotic-fro-cash-received-v1";

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const getNextExpenseNo = (expenses: Expense[]) => {
  const highestNo = expenses.reduce((highest, expense) => {
    const number = Number(String(expense.expenseNo).match(/\d+/)?.[0] ?? 0);
    return Math.max(highest, number);
  }, 0);

  return `EXP-${String(highestNo + 1).padStart(3, "0")}`;
};

export default function StoreExpenses({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const isFRO = user?.role === "fro";

  const cashKey = `${CASH_RECEIVED_PREFIX}:${storeId}`;

  // Only staff assigned to this store are available when the Store gives cash
  // to an FRO/Executive.
  const froOptions = useMemo(
    () =>
      staffList
        .filter(
          (member) =>
            member.storeId === storeId && member.status !== "Inactive",
        )
        .map((member) => member.name.trim())
        .filter(Boolean)
        .filter((name, index, list) => list.indexOf(name) === index),
    [storeId],
  );

  const [expenses, setExpenses] = useState<Expense[]>(() =>
    readJSON(EXPENSE_STORAGE_KEY, allExpenses),
  );
  const [cashRequests, setCashRequests] = useState<CashReceivedRequest[]>(() =>
    readJSON(cashKey, []),
  );

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [enteredBy, setEnteredBy] = useState("");

  const [showCashCreate, setShowCashCreate] = useState(false);
  const [cashDate, setCashDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [cashFRO, setCashFRO] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashMethod, setCashMethod] = useState("Cash");
  const [cashRemarks, setCashRemarks] = useState("");

  const loadSharedData = () => {
    setExpenses(readJSON(EXPENSE_STORAGE_KEY, allExpenses));
    setCashRequests(readJSON(cashKey, []));
  };

  useEffect(() => {
    loadSharedData();
    const refresh = () => loadSharedData();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [cashKey]);

  useEffect(() => {
    if (isFRO) setEnteredBy(user?.name ?? "");
  }, [isFRO, user?.name]);

  const scopedExpenses = useMemo(() => {
    if (!isFRO || !user?.name) return expenses;
    const name = user.name.trim().toLowerCase();
    return expenses.filter(
      (e) =>
        String(e.enteredBy || "")
          .trim()
          .toLowerCase() === name,
    );
  }, [expenses, isFRO, user?.name]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedExpenses.filter((e) => {
      const matchesSearch =
        !q ||
        String(e.expenseNo || "")
          .toLowerCase()
          .includes(q) ||
        e.description.toLowerCase().includes(q) ||
        String(e.enteredBy || "")
          .toLowerCase()
          .includes(q);
      const matchesCategory =
        categoryFilter === "all" || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [scopedExpenses, search, categoryFilter]);

  const totalExpenses = scopedExpenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0,
  );
  const today = new Date().toISOString().split("T")[0];
  const todayExpenses = scopedExpenses
    .filter((e) => e.date === today)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const pendingRequests = isFRO
    ? []
    : cashRequests.filter((x) => x.status !== "accepted");

  const acceptedFROCash = cashRequests
    .filter((x) => x.status === "accepted")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const canCreate =
    !!date &&
    !!category &&
    !!description.trim() &&
    Number(amount) > 0 &&
    !!method &&
    !!enteredBy.trim();

  const resetCreateForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("");
    setDescription("");
    setAmount("");
    setMethod("");
    setEnteredBy(isFRO ? (user?.name ?? "") : "");
  };

  const handleCreateExpense = () => {
    if (!canCreate) return;

    const nextExpense: Expense = {
      id: `exp-${Date.now()}`,
      expenseNo: getNextExpenseNo(expenses),
      date,
      category: category as Expense["category"],
      description: description.trim(),
      amount: Number(amount),
      method: method as Expense["method"],
      enteredBy: isFRO ? (user?.name?.trim() ?? "") : enteredBy.trim(),
    };

    const next = [nextExpense, ...expenses];
    setExpenses(next);
    localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("nature-biotic-expense-updated"));

    resetCreateForm();
    setShowCreate(false);
  };

  const resetCashForm = () => {
    setCashDate(new Date().toISOString().split("T")[0]);
    setCashFRO("");
    setCashAmount("");
    setCashMethod("Cash");
    setCashRemarks("");
  };

  const canCreateCash =
    !!cashDate && !!cashFRO.trim() && Number(cashAmount) > 0 && !!cashMethod;

  const handleCreateCashForFRO = () => {
    if (!canCreateCash) return;

    const item: CashReceivedRequest = {
      id: `cash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: cashDate,
      amount: Number(cashAmount),
      method: cashMethod,
      receivedFrom: "Store",
      requestedFor: cashFRO.trim(),
      remarks: cashRemarks.trim(),
      status: "pending",
    };

    const next = [item, ...cashRequests];
    setCashRequests(next);
    localStorage.setItem(cashKey, JSON.stringify(next));
    window.dispatchEvent(new Event("nature-biotic-cash-received-updated"));

    resetCashForm();
    setShowCashCreate(false);
  };

  function formatExpenseDate(date: string): string {
    if (!date) return "-";

    const parsedDate = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsedDate.getTime()) ? date : String(formatDate(date));
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Expenses
          </h1>
          <p className="mt-1 text-slate-500">
            Track all store-level expenses and FRO cash requests.
          </p>
        </div>
        {!isFRO && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setShowCashCreate(true)}
            >
              <Icon name="payments" size={18} /> Give Cash to FRO
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setShowCreate(true)}
            >
              <Icon name="add" size={18} /> Add Expense
            </Button>
          </div>
        )}
      </div>

      {!isFRO && pendingRequests.length > 0 && (
        <Card className="mb-5 overflow-hidden border-amber-200">
          <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3">
            <div>
              <h2 className="font-bold text-amber-900">Pending Cash to FRO</h2>
              <p className="mt-0.5 text-xs text-amber-700">
                Waiting for the selected FRO to accept the cash.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
              {pendingRequests.length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingRequests.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    To: {item.requestedFor || "FRO"} • {item.method} •{" "}
                    {formatExpenseDate(item.date)}
                  </p>
                  {item.remarks && (
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.remarks}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Awaiting FRO
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          title="Total Expenses"
          value={totalExpenses}
          icon="receipt_long"
        />
        <Stat title="Today Expenses" value={todayExpenses} icon="today" />
        <Stat
          title="Monthly Expenses"
          value={scopedExpenses
            .filter(
              (e) =>
                e.date >=
                new Date(Date.now() - 30 * 86400000)
                  .toISOString()
                  .split("T")[0],
            )
            .reduce((s, e) => s + Number(e.amount || 0), 0)}
          icon="calendar_month"
        />
        <Stat
          title="No of Entries"
          value={scopedExpenses.length}
          icon="format_list_numbered"
          isCount
        />
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by expense no, description, entered by..."
            className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 lg:w-56"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(search || categoryFilter !== "all") && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
            >
              <Icon name="filter_alt_off" size={18} /> Clear
            </Button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="receipt_long"
            title="No expenses found"
            description="Adjust your search or filters to find expense entries."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  {[
                    "Expense No",
                    "Date",
                    "Category",
                    "Description",
                    "Amount",
                    "Payment Method",
                    "Entered By",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`border-r border-slate-200 px-3 py-3 font-semibold ${i === 4 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.id}
                    onClick={() => setViewing(e)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setViewing(e);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    className={`cursor-pointer border-b border-slate-100 outline-none transition hover:bg-brand-50/40 focus:bg-brand-50/40 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                  >
                    <td className="border-r px-3 py-3 font-semibold">
                      {e.expenseNo}
                    </td>
                    <td className="border-r px-3 py-3 text-slate-500">
                      {formatExpenseDate(e.date)}
                    </td>
                    <td className="border-r px-3 py-3">{e.category}</td>
                    <td className="border-r px-3 py-3 text-slate-600">
                      {e.description}
                    </td>
                    <td className="border-r px-3 py-3 text-right font-semibold">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="border-r px-3 py-3">{e.method}</td>
                    <td className="border-r px-3 py-3">{e.enteredBy || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCashCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4">
            <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-4 sm:px-5">
                <div>
                  <h3 className="font-bold text-slate-900">Give Cash to FRO</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Create a cash allocation. The FRO must accept it before it
                    is added to their balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetCashForm();
                    setShowCashCreate(false);
                  }}
                  aria-label="Close"
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    label="Date"
                    type="date"
                    value={cashDate}
                    onChange={setCashDate}
                  />
                  <SelectField
                    label="Executive / FRO"
                    value={cashFRO}
                    onChange={setCashFRO}
                    options={froOptions}
                    placeholder={
                      froOptions.length
                        ? "Select executive / FRO"
                        : "No FRO assigned to this store"
                    }
                  />
                  <InputField
                    label="Amount"
                    type="number"
                    value={cashAmount}
                    onChange={setCashAmount}
                    placeholder="Enter amount"
                  />
                  <SelectField
                    label="Payment Method"
                    value={cashMethod}
                    onChange={setCashMethod}
                    options={methods}
                    placeholder="Select method"
                  />
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Remarks
                    </label>
                    <textarea
                      value={cashRemarks}
                      onChange={(e) => setCashRemarks(e.target.value)}
                      rows={3}
                      placeholder="Optional"
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    resetCashForm();
                    setShowCashCreate(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleCreateCashForFRO}
                  disabled={!canCreateCash}
                >
                  <Icon name="save" size={17} /> Create Cash
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4">
            <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-4 sm:px-5">
                <div>
                  <h3 className="font-bold text-slate-900">Add Expense</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Create a store expense.
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    label="Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                  />
                  <SelectField
                    label="Category"
                    value={category}
                    onChange={setCategory}
                    options={categories}
                    placeholder="Select category"
                  />
                  <InputField
                    label="Amount"
                    type="number"
                    value={amount}
                    onChange={setAmount}
                    placeholder="Enter amount"
                  />
                  <SelectField
                    label="Payment Method"
                    value={method}
                    onChange={setMethod}
                    options={methods}
                    placeholder="Select method"
                  />
                  <InputField
                    label="Entered By"
                    value={enteredBy}
                    onChange={setEnteredBy}
                    placeholder="Staff/FRO name"
                    readOnly={isFRO}
                  />
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Description *
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 focus:border-brand-500 focus:outline-none"
                      placeholder="Enter expense description"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleCreateExpense}
                  disabled={!canCreate}
                >
                  <Icon name="save" size={17} /> Save Expense
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {viewing &&
        createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                  Expense Detail
                </h3>
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-4 sm:gap-3 sm:p-5">
                <Detail label="Expense No" value={viewing.expenseNo} />
                <Detail label="Date" value={formatExpenseDate(viewing.date)} />
                <Detail label="Category" value={viewing.category} />
                <Detail label="Amount" value={formatCurrency(viewing.amount)} />
                <Detail label="Payment Method" value={viewing.method} />
                <Detail label="Entered By" value={viewing.enteredBy || "-"} />
                <div className="col-span-2">
                  <Detail label="Description" value={viewing.description} />
                </div>
              </div>
              <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                <Button variant="secondary" onClick={() => setViewing(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Stat({
  title,
  value,
  icon,
  isCount,
}: {
  title: string;
  value: number;
  icon: string;
  isCount?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {title}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-800 sm:text-2xl">
            {isCount ? value : formatCurrency(value)}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
          <Icon name={icon} size={21} className="text-brand-600" />
        </div>
      </div>
    </Card>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} *
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-brand-500 focus:outline-none ${readOnly ? "bg-slate-100" : "bg-white"}`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} *
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
