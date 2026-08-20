import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Card,
  Button,
  Input,
  Select,
  EmptyState,
  Icon,
  Modal,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { getFarmersByStore } from "@/lib/data";

type RefundRow = {
  id: string;
  date: string;
  refundNo: string;
  farmerId: string;
  farmerName: string;
  referenceNo: string;
  reason: string;
  paymentMethod: string;
  amount: number;
  remarks: string;
};

const methods = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const reasons = [
  "Product Return",
  "Billing Correction",
  "Over Payment",
  "Cancelled Sale",
  "Wrong Product",
  "Other",
];

const STORAGE_PREFIX = "nature-biotic-store-refunds-v2";

function loadRows(storageKey: string): RefundRow[] {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function StoreRefund({ storeId }: { storeId: string }) {
  const farmers = getFarmersByStore(storeId);
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [rows, setRows] = useState<RefundRow[]>(() => {
    const saved = loadRows(storageKey);

    if (saved.length > 0) return saved;

    return [
      {
        id: "refund-1",
        date: "2026-08-16",
        refundNo: "REF-101",
        farmerId: farmers[0]?.id || "",
        farmerName: farmers[0]?.name || "Selvam",
        referenceNo: "INV-D-1198",
        reason: "Product Return",
        paymentMethod: "Cash",
        amount: 800,
        remarks: "",
      },
      {
        id: "refund-2",
        date: "2026-08-15",
        refundNo: "REF-100",
        farmerId: farmers[1]?.id || "",
        farmerName: farmers[1]?.name || "Kannan",
        referenceNo: "INV-RK-1038",
        reason: "Billing Correction",
        paymentMethod: "UPI",
        amount: 500,
        remarks: "",
      },
    ];
  });

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<RefundRow | null>(null);

  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [refundNo, setRefundNo] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState("");

  const selectedFarmer = farmers.find((farmer) => farmer.id === farmerId);

  const canCreate =
    date &&
    refundNo.trim() &&
    farmerId &&
    referenceNo.trim() &&
    reason &&
    paymentMethod &&
    amount > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return rows;

    return rows.filter(
      (row) =>
        row.refundNo.toLowerCase().includes(q) ||
        row.farmerName.toLowerCase().includes(q) ||
        row.referenceNo.toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function resetForm() {
    setDate(new Date().toISOString().split("T")[0]);
    setRefundNo("");
    setFarmerId("");
    setReferenceNo("");
    setReason("");
    setPaymentMethod("");
    setAmount(0);
    setRemarks("");
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function saveRows(next: RefundRow[]) {
    setRows(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function createRefund() {
    if (!canCreate || !selectedFarmer) return;

    const row: RefundRow = {
      id: `refund-${Date.now()}`,
      date,
      refundNo: refundNo.trim(),
      farmerId: selectedFarmer.id,
      farmerName: selectedFarmer.name,
      referenceNo: referenceNo.trim(),
      reason,
      paymentMethod,
      amount,
      remarks,
    };

    saveRows([row, ...rows]);
    closeForm();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Refund
          </h1>
          <p className="mt-1 text-slate-500">
            Refunds issued against store sales and farmer transactions.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Create Refund
        </Button>
      </div>

      <Card className="mb-5 p-4">
        <div className="max-w-md">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search by refund no, farmer, reference..."
            icon="search"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="sync"
            title="No refunds found"
            description="Create a refund or adjust your search."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <th className="w-[6%] border-r border-slate-200 px-2 py-3 text-center">
                  S.No
                </th>
                <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                  Date
                </th>
                <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-center">
                  Ref No
                </th>
                <th className="w-[15%] border-r border-slate-200 px-2 py-3 text-center">
                  Farmer
                </th>
                <th className="w-[16%] border-r border-slate-200 px-2 py-3 text-center">
                  Reference / Invoice
                </th>
                <th className="w-[16%] border-r border-slate-200 px-2 py-3 text-center">
                  Reason
                </th>
                <th className="w-[13%] border-r border-slate-200 px-2 py-3 text-center">
                  Pay Method
                </th>
                <th className="w-[12%] px-2 py-3 text-right">
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRefund(row)}
                  className={`cursor-pointer border-b border-slate-100 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  } transition hover:bg-brand-50/40`}
                  title="Click to view refund details"
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                    {index + 1}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                    {formatDate(row.date)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                    {row.refundNo}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-700">
                    {row.farmerName}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.referenceNo}
                  </td>
                  <td className="truncate border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.reason}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.paymentMethod}
                  </td>
                  <td className="px-2 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Refund
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a refund against an invoice or farmer transaction.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />

                  <Input
                    label="Refund No"
                    value={refundNo}
                    onChange={setRefundNo}
                    placeholder="e.g. REF-102"
                    required
                  />

                  <Select
                    label="Farmer"
                    value={farmerId}
                    onChange={setFarmerId}
                    placeholder="Select farmer"
                    options={farmers.map((farmer) => ({
                      value: farmer.id,
                      label: farmer.name,
                    }))}
                    required
                  />

                  <Input
                    label="Reference / Invoice No"
                    value={referenceNo}
                    onChange={setReferenceNo}
                    placeholder="e.g. INV-D-1201"
                    required
                  />

                  <Select
                    label="Reason"
                    value={reason}
                    onChange={setReason}
                    placeholder="Select reason"
                    options={reasons.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  <Select
                    label="Payment Method"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Select method"
                    options={methods.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  <Input
                    label="Refund Amount"
                    type="number"
                    value={String(amount)}
                    onChange={(value) => setAmount(Number(value) || 0)}
                    placeholder="Enter refund amount"
                    required
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

                <Button
                  onClick={createRefund}
                  disabled={!canCreate}
                >
                  <Icon name="save" size={17} />
                  Create Refund
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Modal
        open={!!selectedRefund}
        onClose={() => setSelectedRefund(null)}
        title="Refund Details"
        size="lg"
        footer={
          <Button
            variant="secondary"
            onClick={() => setSelectedRefund(null)}
          >
            Close
          </Button>
        }
      >
        {selectedRefund && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail
                label="Date"
                value={formatDate(selectedRefund.date)}
              />
              <Detail
                label="Refund No"
                value={selectedRefund.refundNo}
              />
              <Detail
                label="Farmer"
                value={selectedRefund.farmerName}
              />
              <Detail
                label="Reference / Invoice"
                value={selectedRefund.referenceNo}
              />
              <Detail
                label="Reason"
                value={selectedRefund.reason}
              />
              <Detail
                label="Payment Method"
                value={selectedRefund.paymentMethod}
              />
              <Detail
                label="Amount"
                value={formatCurrency(selectedRefund.amount)}
                highlight
              />
            </div>

            {selectedRefund.remarks && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Remarks
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {selectedRefund.remarks}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({
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
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
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
