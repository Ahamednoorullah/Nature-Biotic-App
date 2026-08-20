import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { getFarmersByStore } from "@/lib/data";

type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  farmerId: string;
  farmerName: string;
  method: string;
  invoiceAmount: number;
  amount: number;
  receivedBy: string;
  remarks: string;
};

const methods = ["Cash", "Bank Transfer", "UPI", "Cheque"];
const receivers = ["Ramesh Kumar", "Priya S", "Karthik N"];

const STORAGE_PREFIX = "nature-biotic-store-receipts-v2";

function readStoredReceipts(storageKey: string): Receipt[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function StoreReceipt({ storeId }: { storeId: string }) {
  const farmers = getFarmersByStore(storeId);
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [search, setSearch] = useState("");
  const [farmerFilter, setFarmerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    const stored = readStoredReceipts(storageKey);

    if (stored.length > 0) return stored;

    return [
      {
        id: "store-r-1",
        receiptNo: "RCPT-501",
        date: "2026-08-17",
        farmerId: farmers[0]?.id || "",
        farmerName: farmers[0]?.name || "Murugan",
        method: "Cash",
        invoiceAmount: 7200,
        amount: 5200,
        receivedBy: "Ramesh Kumar",
        remarks: "",
      },
      {
        id: "store-r-2",
        receiptNo: "RCPT-502",
        date: "2026-08-17",
        farmerId: farmers[1]?.id || "",
        farmerName: farmers[1]?.name || "Selvam",
        method: "UPI",
        invoiceAmount: 4300,
        amount: 4300,
        receivedBy: "Priya S",
        remarks: "",
      },
    ];
  });

  const [showCreate, setShowCreate] = useState(false);
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [receiptNo, setReceiptNo] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [method, setMethod] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amountReceived, setAmountReceived] = useState(0);
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  const selectedFarmer = farmers.find((farmer) => farmer.id === farmerId);

  const canCreate =
    !!farmerId &&
    !!receiptNo.trim() &&
    !!method &&
    amountReceived > 0;

  function resetCreateForm() {
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setReceiptNo("");
    setFarmerId("");
    setMethod("");
    setInvoiceAmount(0);
    setAmountReceived(0);
    setReceivedBy("");
    setRemarks("");
  }

  function closeCreateForm() {
    setShowCreate(false);
    resetCreateForm();
  }

  function persist(next: Receipt[]) {
    setReceipts(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function handleCreateReceipt() {
    if (!canCreate || !selectedFarmer) return;

    const newReceipt: Receipt = {
      id: `r-new-${Date.now()}`,
      receiptNo: receiptNo.trim(),
      date: receiptDate,
      farmerId: selectedFarmer.id,
      farmerName: selectedFarmer.name,
      method,
      invoiceAmount,
      amount: amountReceived,
      receivedBy,
      remarks,
    };

    persist([newReceipt, ...receipts]);
    closeCreateForm();
  }

  const filtered = useMemo(
    () =>
      receipts.filter((receipt) => {
        const q = search.toLowerCase().trim();

        const matchesSearch =
          !q ||
          receipt.receiptNo.toLowerCase().includes(q) ||
          receipt.farmerName.toLowerCase().includes(q);

        const matchesFarmer =
          farmerFilter === "all" || receipt.farmerId === farmerFilter;

        let matchesDate = true;

        if (dateFilter !== "all") {
          const d = new Date(receipt.date);
          const now = new Date();
          const days =
            (now.getTime() - d.getTime()) / 86400000;

          if (dateFilter === "week") matchesDate = days <= 7;
          else if (dateFilter === "month") matchesDate = days <= 30;
          else if (dateFilter === "quarter") matchesDate = days <= 90;
        }

        return matchesSearch && matchesFarmer && matchesDate;
      }),
    [receipts, search, farmerFilter, dateFilter],
  );

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Receipts
          </h1>
          <p className="mt-1 text-slate-500">
            Payment receipts collected from farmers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setShowCreate(true)}>
            <Icon name="add" size={20} />
            Create Receipt
          </Button>

          <Button variant="secondary">
            <Icon name="download" size={20} />
            Export
          </Button>
        </div>
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="max-w-md flex-1">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by receipt no, farmer..."
              icon="search"
            />
          </div>

          <div className="w-full sm:w-56">
            <Select
              value={farmerFilter}
              onChange={setFarmerFilter}
              placeholder="All Farmers"
              options={farmers.map((farmer) => ({
                value: farmer.id,
                label: farmer.name,
              }))}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="All Dates"
              options={[
                { value: "week", label: "Last 7 days" },
                { value: "month", label: "Last 30 days" },
                { value: "quarter", label: "Last 90 days" },
              ]}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="receipt"
            title="No receipts found"
            description="Adjust your filters or create a receipt."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <th className="w-[7%] border-r border-slate-200 px-3 py-3 text-center font-semibold">
                  S.No
                </th>
                <th className="w-[14%] border-r border-slate-200 px-3 py-3 text-center font-semibold">
                  Date
                </th>
                <th className="w-[18%] border-r border-slate-200 px-3 py-3 text-center font-semibold">
                  Receipt Number
                </th>
                <th className="w-[22%] border-r border-slate-200 px-3 py-3 text-center font-semibold">
                  Farmer Name
                </th>
                <th className="w-[16%] border-r border-slate-200 px-3 py-3 text-center font-semibold">
                  Payment Method
                </th>
                <th className="w-[13%] border-r border-slate-200 px-3 py-3 text-right font-semibold">
                  Amount Received
                </th>
                <th className="w-[10%] px-3 py-3 text-right font-semibold">
                  Balance
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((receipt, index) => (
                <tr
                  key={receipt.id}
                  onClick={() => setViewReceipt(receipt)}
                  title="Click to view receipt details"
                  className={`cursor-pointer border-b border-slate-100 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  } transition hover:bg-brand-50/40`}
                >
                  <td className="border-r border-slate-100 px-3 py-3 text-center text-slate-500">
                    {index + 1}
                  </td>

                  <td className="border-r border-slate-100 px-3 py-3 text-center text-slate-500">
                    {formatDate(receipt.date)}
                  </td>

                  <td className="border-r border-slate-100 px-3 py-3 text-center font-semibold text-slate-800">
                    {receipt.receiptNo}
                  </td>

                  <td className="border-r border-slate-100 px-3 py-3 text-center text-slate-700">
                    {receipt.farmerName}
                  </td>

                  <td className="border-r border-slate-100 px-3 py-3 text-center text-slate-600">
                    {receipt.method}
                  </td>

                  <td className="border-r border-slate-100 px-3 py-3 text-right font-bold tabular-nums text-slate-800">
                    {formatCurrency(receipt.amount)}
                  </td>

                  <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-800">
                    {formatCurrency(
                      Math.max(receipt.invoiceAmount - receipt.amount, 0),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={!!viewReceipt}
        onClose={() => setViewReceipt(null)}
        title="Receipt Details"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewReceipt(null)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Icon name="print" size={18} />
              Print Receipt
            </Button>
          </>
        }
      >
        {viewReceipt && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                <Icon
                  name="receipt"
                  size={24}
                  className="text-brand-600"
                />
              </div>

              <div>
                <p className="text-lg font-bold text-slate-800">
                  {viewReceipt.receiptNo}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(viewReceipt.date)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField
                label="Farmer Name"
                value={viewReceipt.farmerName}
              />
              <DetailField
                label="Payment Method"
                value={viewReceipt.method}
              />
              <DetailField
                label="Invoice Amount"
                value={formatCurrency(viewReceipt.invoiceAmount)}
              />
              <DetailField
                label="Amount Received"
                value={formatCurrency(viewReceipt.amount)}
                highlight
              />
              <DetailField
                label="Balance"
                value={formatCurrency(
                  Math.max(
                    viewReceipt.invoiceAmount - viewReceipt.amount,
                    0,
                  ),
                )}
              />
              <DetailField
                label="Received By"
                value={viewReceipt.receivedBy || "-"}
              />
            </div>

            {viewReceipt.remarks && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Remarks
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {viewReceipt.remarks}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Receipt
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Record a payment receipt collected from a farmer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Date"
                    type="date"
                    value={receiptDate}
                    onChange={setReceiptDate}
                    required
                  />

                  <Input
                    label="Receipt Number"
                    placeholder="e.g. RCP-3050"
                    value={receiptNo}
                    onChange={setReceiptNo}
                    required
                  />

                  <Select
                    label="Select Farmer"
                    value={farmerId}
                    onChange={setFarmerId}
                    placeholder="Choose farmer"
                    options={farmers.map((farmer) => ({
                      value: farmer.id,
                      label: farmer.name,
                    }))}
                    required
                  />

                  <Select
                    label="Payment Method"
                    value={method}
                    onChange={setMethod}
                    placeholder="Select method"
                    options={methods.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  <Input
                    label="Invoice Amount"
                    type="number"
                    value={String(invoiceAmount)}
                    onChange={(value) =>
                      setInvoiceAmount(Number(value) || 0)
                    }
                    placeholder="Total invoice value"
                  />

                  <Input
                    label="Amount Received"
                    type="number"
                    value={String(amountReceived)}
                    onChange={(value) =>
                      setAmountReceived(Number(value) || 0)
                    }
                    placeholder="Amount collected now"
                    required
                  />

                  <Select
                    label="Received By"
                    value={receivedBy}
                    onChange={setReceivedBy}
                    placeholder="Select staff"
                    options={receivers.map((receiver) => ({
                      value: receiver,
                      label: receiver,
                    }))}
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Balance
                    </label>
                    <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-800">
                      {formatCurrency(
                        Math.max(invoiceAmount - amountReceived, 0),
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <Input
                      label="Remarks"
                      value={remarks}
                      onChange={setRemarks}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={closeCreateForm}
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleCreateReceipt}
                  disabled={!canCreate}
                >
                  <Icon name="save" size={18} />
                  Create Receipt
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DetailField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="mb-1 text-xs font-medium text-slate-500">
        {label}
      </p>
      <p
        className={`text-sm font-bold ${
          highlight ? "text-brand-700" : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
