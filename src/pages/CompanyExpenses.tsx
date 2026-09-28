import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
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

type CompanyExpense = {
  id: string;
  expenseNo: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  method: string;
  enteredBy: string;
};

const EXPENSE_STORAGE_KEY = "nature-biotic-company-expenses-v1";
const EXPENSE_SEQUENCE_KEY = "nature-biotic-company-expense-sequence-v1";

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

function expenseSequence(expenseNo: string) {
  const match = String(expenseNo || "")
    .trim()
    .match(/^NB-EXP-(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function nextExpenseNo(expenses: CompanyExpense[]) {
  let highest = expenses.reduce(
    (max, expense) => Math.max(max, expenseSequence(expense.expenseNo)),
    0,
  );
  try {
    highest = Math.max(
      highest,
      Number(localStorage.getItem(EXPENSE_SEQUENCE_KEY) || 0),
    );
  } catch {
    // Existing company expenses still set the next number.
  }
  return `NB-EXP-${String(highest + 1).padStart(4, "0")}`;
}

function rememberExpenseNo(expenseNo: string) {
  const value = expenseSequence(expenseNo);
  if (!value) return;
  try {
    const current = Number(localStorage.getItem(EXPENSE_SEQUENCE_KEY) || 0);
    if (value > current) {
      localStorage.setItem(EXPENSE_SEQUENCE_KEY, String(value));
    }
  } catch {
    // The saved expense still keeps its number.
  }
}

export default function CompanyExpenses() {
  const { user } = useAuth();
  const savingRef = useRef(false);
  const [expenses, setExpenses] = useState<CompanyExpense[]>(() =>
    readJSON(EXPENSE_STORAGE_KEY, []),
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewing, setViewing] = useState<CompanyExpense | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [enteredBy, setEnteredBy] = useState(user?.name ?? "");

  useEffect(() => {
    const refresh = () => setExpenses(readJSON(EXPENSE_STORAGE_KEY, []));
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesSearch =
        !q ||
        expense.expenseNo.toLowerCase().includes(q) ||
        expense.description.toLowerCase().includes(q) ||
        expense.enteredBy.toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === "all" || expense.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );
  const today = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses
    .filter((expense) => expense.date === today)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const monthlyExpenses = expenses
    .filter(
      (expense) =>
        expense.date >=
        new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    )
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

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
    setEnteredBy(user?.name ?? "");
  };

  const openCreate = () => {
    savingRef.current = false;
    resetCreateForm();
    setShowCreate(true);
  };

  const handleCreateExpense = () => {
    if (savingRef.current || !canCreate) return;
    savingRef.current = true;

    const latest = readJSON<CompanyExpense[]>(EXPENSE_STORAGE_KEY, []);
    const expenseNo = nextExpenseNo(latest);
    if (
      latest.some(
        (expense) => expense.expenseNo.toLowerCase() === expenseNo.toLowerCase(),
      )
    ) {
      savingRef.current = false;
      window.alert("This expense number is already saved.");
      return;
    }

    const nextExpense: CompanyExpense = {
      id: `company-exp-${expenseNo}`,
      expenseNo,
      date,
      category,
      description: description.trim(),
      amount: Number(amount),
      method,
      enteredBy: enteredBy.trim(),
    };

    const next = [nextExpense, ...latest];
    setExpenses(next);
    localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(next));
    rememberExpenseNo(expenseNo);
    window.dispatchEvent(new Event("nature-biotic-company-expense-updated"));

    resetCreateForm();
    setShowCreate(false);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Expenses
          </h1>
          <p className="mt-1 text-slate-500">
            Track Nature Biotic company expenses.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <Icon name="add" size={18} /> Add Expense
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Total Expenses" value={totalExpenses} icon="receipt_long" />
        <Stat title="Today Expenses" value={todayExpenses} icon="today" />
        <Stat title="Monthly Expenses" value={monthlyExpenses} icon="calendar_month" />
        <Stat
          title="No of Entries"
          value={expenses.length}
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
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
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
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      className={`border-r border-slate-200 px-3 py-3 font-semibold ${index === 4 ? "text-right" : "text-left"}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense, index) => (
                  <tr
                    key={expense.id}
                    onClick={() => setViewing(expense)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setViewing(expense);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    className={`cursor-pointer border-b border-slate-100 outline-none transition hover:bg-brand-50/40 focus:bg-brand-50/40 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                  >
                    <td className="border-r px-3 py-3 font-semibold">
                      {expense.expenseNo}
                    </td>
                    <td className="border-r px-3 py-3 text-slate-500">
                      {formatExpenseDate(expense.date)}
                    </td>
                    <td className="border-r px-3 py-3">{expense.category}</td>
                    <td className="border-r px-3 py-3 text-slate-600">
                      {expense.description}
                    </td>
                    <td className="border-r px-3 py-3 text-right font-semibold">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="border-r px-3 py-3">{expense.method}</td>
                    <td className="border-r px-3 py-3">
                      {expense.enteredBy || "-"}
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
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4">
            <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-4 sm:px-5">
                <div>
                  <h3 className="font-bold text-slate-900">Add Expense</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Create a company expense.
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
                  <InputField label="Date" type="date" value={date} onChange={setDate} />
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
                    placeholder="Staff name"
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

function formatExpenseDate(value: string): string {
  if (!value) return "-";
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? value : String(formatDate(value));
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
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none"
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
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
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
