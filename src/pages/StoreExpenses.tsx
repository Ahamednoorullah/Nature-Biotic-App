import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { expenses as allExpenses, type Expense } from "@/lib/purchaseData";

const categories = [
  "Transport",
  "Electricity",
  "Salary",
  "Office Expense",
  "Maintenance",
  "Miscellaneous",
];
const methods = ["Cash", "UPI", "Bank Transfer", "Cheque"];

export default function StoreExpenses({
  storeId: _storeId,
}: {
  storeId: string;
}) {
  const [expenses, setExpenses] = useState<Expense[]>(allExpenses);
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

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        const ms =
          e.expenseNo.toLowerCase().includes(search.toLowerCase()) ||
          e.description.toLowerCase().includes(search.toLowerCase()) ||
          e.enteredBy.toLowerCase().includes(search.toLowerCase());
        const mc = categoryFilter === "all" || e.category === categoryFilter;
        return ms && mc;
      }),
    [search, categoryFilter, expenses],
  );

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const today = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.amount, 0);
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);
  const monthlyExpenses = expenses
    .filter((e) => e.date >= monthStart.toISOString().split("T")[0])
    .reduce((s, e) => s + e.amount, 0);
  const noOfEntries = expenses.length;

  const canCreate =
    date &&
    category &&
    description.trim() &&
    Number(amount) > 0 &&
    method &&
    enteredBy.trim();

  function resetCreateForm() {
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("");
    setDescription("");
    setAmount("");
    setMethod("");
    setEnteredBy("");
  }

  function handleCreateExpense() {
    if (!canCreate) return;

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      expenseNo: `EXP-${String(401 + expenses.length).padStart(3, "0")}`,
      date,
      category: category as Expense["category"],
      description: description.trim(),
      amount: Number(amount),
      method: method as Expense["method"],
      enteredBy: enteredBy.trim(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    resetCreateForm();
    setShowCreate(false);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Expenses
          </h1>
          <p className="text-slate-500 mt-1">
            Track all store-level expenses and spending.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Total Expenses
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Icon name="receipt_long" size={22} className="text-brand-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Today Expenses
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatCurrency(todayExpenses)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Icon name="today" size={22} className="text-amber-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Monthly Expenses
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatCurrency(monthlyExpenses)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Icon name="calendar_month" size={22} className="text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">
                No of Entries
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {noOfEntries}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Icon
                name="format_list_numbered"
                size={22}
                className="text-emerald-600"
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <span
                className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                style={{ fontSize: 20 }}
              >
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by expense no, description, entered by..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-52">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
            >
              <Icon name="filter_alt_off" size={18} /> Clear
            </Button>
          </div>
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
            <table className="w-full text-sm min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b-2 border-slate-200">
                  {[
                    "Expense No",
                    "Date",
                    "Category",
                    "Description",
                    "Amount",
                    "Payment Method",
                    "Entered By",
                    "View",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`font-semibold px-3 py-3 border-r border-slate-200 last:border-r-0 ${i === 4 ? "text-right" : i === 7 ? "text-center" : "text-left"}`}
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
                    className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-brand-50/40 transition-base`}
                  >
                    <td className="px-3 py-3 border-r border-slate-100 font-semibold text-slate-800">
                      {e.expenseNo}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-500">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-medium text-xs">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">
                      {e.description}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">
                      {e.method}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">
                      {e.enteredBy}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => setViewing(e)}
                        className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base"
                        title="View"
                      >
                        <Icon name="visibility" size={18} />
                      </button>
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
            <div className="flex w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Add Expense
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Create a new store-level expense entry.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={19} />
                </button>
              </div>

              {/* Form Content */}
              <div className="max-h-[70vh] overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:outline-none focus:border-brand-500 focus:shadow-focus"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:shadow-focus"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">Select payment method</option>
                      {methods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Entered By <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={enteredBy}
                      onChange={(e) => setEnteredBy(e.target.value)}
                      placeholder="Enter staff name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:shadow-focus"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter expense description"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:shadow-focus"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                >
                  Cancel
                </Button>

                <Button onClick={handleCreateExpense} disabled={!canCreate}>
                  <Icon name="save" size={17} />
                  Save Expense
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setViewing(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Expense Detail
              </h3>
              <button
                onClick={() => setViewing(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-base"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              <Detail label="Expense No" value={viewing.expenseNo} />
              <Detail label="Date" value={formatDate(viewing.date)} />
              <Detail label="Category" value={viewing.category} />
              <Detail label="Amount" value={formatCurrency(viewing.amount)} />
              <Detail label="Payment Method" value={viewing.method} />
              <Detail label="Entered By" value={viewing.enteredBy} />
              <div className="col-span-2">
                <Detail label="Description" value={viewing.description} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
