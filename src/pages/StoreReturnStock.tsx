import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";

type ReturnStockRow = {
  id: string;
  returnNo: string;
  issueDate: string;
  returnDate: string;
  executive: string;
  product: string;
  packSize: string;
  issuedQty: number;
  returnedQty: number;
  soldQty: number;
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

const productOptions = [
  "Electra",
  "Aalga",
  "Astra",
  "Alpha",
  "Nuetra",
  "Ultra",
].map((name) => ({ value: name, label: name }));

const initialRows: ReturnStockRow[] = [
  {
    id: "1",
    returnNo: "RET-001",
    issueDate: "2026-08-17",
    returnDate: "2026-08-18",
    executive: "Ram Kumar",
    product: "Electra",
    packSize: "250 ml",
    issuedQty: 25,
    returnedQty: 10,
    soldQty: 15,
  },
  {
    id: "2",
    returnNo: "RET-002",
    issueDate: "2026-08-17",
    returnDate: "2026-08-18",
    executive: "Ajith Kumar",
    product: "Astra",
    packSize: "100 ml",
    issuedQty: 20,
    returnedQty: 6,
    soldQty: 14,
  },
];

export default function StoreReturnStock({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<ReturnStockRow[]>(initialRows);
  const [showAdd, setShowAdd] = useState(false);

  const [executive, setExecutive] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [product, setProduct] = useState("");
  const [packSize, setPackSize] = useState("");
  const [issuedQty, setIssuedQty] = useState("");
  const [returnedQty, setReturnedQty] = useState("");

  const soldQty = Math.max(
    0,
    Number(issuedQty || 0) - Number(returnedQty || 0),
  );

  const canSave =
    executive &&
    issueDate &&
    returnDate &&
    product &&
    packSize &&
    Number(issuedQty) > 0 &&
    Number(returnedQty) >= 0 &&
    Number(returnedQty) <= Number(issuedQty);

  function resetForm() {
    setExecutive("");
    setIssueDate("");
    setReturnDate("");
    setProduct("");
    setPackSize("");
    setIssuedQty("");
    setReturnedQty("");
  }

  function addReturn() {
    if (!canSave) return;

    const newRow: ReturnStockRow = {
      id: String(Date.now()),
      returnNo: `RET-${String(rows.length + 1).padStart(3, "0")}`,
      issueDate,
      returnDate,
      executive,
      product,
      packSize,
      issuedQty: Number(issuedQty),
      returnedQty: Number(returnedQty),
      soldQty,
    };

    setRows((prev) => [newRow, ...prev]);
    resetForm();
    setShowAdd(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Purchase Return
          </h1>
          <p className="mt-1 text-slate-500">
            Track products issued to executives and the unsold stock returned to
            the store.
          </p>
        </div>

        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={18} />
          Create Return
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Total Returns"
          value={String(rows.length)}
          icon="assignment_return"
        />
        <SummaryCard
          label="Issued Qty"
          value={String(rows.reduce((s, r) => s + r.issuedQty, 0))}
          icon="outbox"
        />
        <SummaryCard
          label="Sold Qty"
          value={String(rows.reduce((s, r) => s + r.soldQty, 0))}
          icon="sell"
        />
        <SummaryCard
          label="Returned Qty"
          value={String(rows.reduce((s, r) => s + r.returnedQty, 0))}
          icon="keyboard_return"
        />
      </div>

      {showAdd && (
        <Card className="mb-6 p-5">
          <div className="mb-4">
            <h2 className="font-bold text-slate-800">Create Purchase Return</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter issued quantity and the unsold quantity returned by the
              executive.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Executive"
              value={executive}
              onChange={setExecutive}
              placeholder="Select executive"
              options={executives.map((name) => ({ value: name, label: name }))}
              required
            />

            <Input
              label="Issue Date"
              type="date"
              value={issueDate}
              onChange={setIssueDate}
              required
            />
            <Input
              label="Return Date"
              type="date"
              value={returnDate}
              onChange={setReturnDate}
              required
            />

            <Select
              label="Product"
              value={product}
              onChange={setProduct}
              placeholder="Select product"
              options={productOptions}
              required
            />

            <Input
              label="Pack Size"
              value={packSize}
              onChange={setPackSize}
              placeholder="e.g. 250 ml"
              required
            />
            <Input
              label="Issued Qty"
              type="number"
              value={issuedQty}
              onChange={setIssuedQty}
              placeholder="e.g. 25"
              required
            />
            <Input
              label="Returned Qty"
              type="number"
              value={returnedQty}
              onChange={setReturnedQty}
              placeholder="e.g. 10"
              required
            />
            <Input
              label="Sold Qty"
              type="number"
              value={String(soldQty)}
              onChange={() => {}}
              readOnly
            />
          </div>

          {Number(returnedQty) > Number(issuedQty) && issuedQty && (
            <p className="mt-3 text-sm font-medium text-red-600">
              Returned quantity cannot be greater than issued quantity.
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={addReturn} disabled={!canSave}>
              <Icon name="save" size={17} /> Save Return
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-left">Return No</th>
                <th className="px-5 py-3 text-left">Executive</th>
                <th className="px-5 py-3 text-left">Product</th>
                <th className="px-5 py-3 text-left">Pack Size</th>
                <th className="px-5 py-3 text-left">Issue Date</th>
                <th className="px-5 py-3 text-left">Return Date</th>
                <th className="px-5 py-3 text-center">Issued Qty</th>
                <th className="px-5 py-3 text-center">Sold Qty</th>
                <th className="px-5 py-3 text-center">Returned Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-brand-50/30">
                  <td className="px-5 py-4 font-bold text-slate-800">
                    {row.returnNo}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">
                    {row.executive}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">
                    {row.product}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{row.packSize}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatSimpleDate(row.issueDate)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatSimpleDate(row.returnDate)}
                  </td>
                  <td className="px-5 py-4 text-center font-semibold">
                    {row.issuedQty}
                  </td>
                  <td className="px-5 py-4 text-center font-semibold text-emerald-700">
                    {row.soldQty}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
                      {row.returnedQty}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon name={icon} size={19} />
        </div>
      </div>
    </Card>
  );
}

function formatSimpleDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
