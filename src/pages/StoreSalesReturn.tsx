import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";

type SalesReturnRow = {
  id: string;
  returnNo: string;
  date: string;
  invoiceNo: string;
  farmer: string;
  product: string;
  quantity: number;
  amount: number;
};

const initialRows: SalesReturnRow[] = [
  {
    id: "sr1",
    returnNo: "SR-001",
    date: "2026-08-19",
    invoiceNo: "INV-D-1201",
    farmer: "Murugan",
    product: "Electra",
    quantity: 2,
    amount: 1200,
  },
];

export default function StoreSalesReturn({ storeId: _storeId }: { storeId: string }) {
  const [rows, setRows] = useState(initialRows);
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [farmer, setFarmer] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");

  const canSave =
    date &&
    invoiceNo &&
    farmer &&
    product &&
    Number(quantity) > 0 &&
    Number(amount) >= 0;

  function saveReturn() {
    if (!canSave) return;

    const next: SalesReturnRow = {
      id: `sr-${Date.now()}`,
      returnNo: `SR-${String(rows.length + 1).padStart(3, "0")}`,
      date,
      invoiceNo,
      farmer,
      product,
      quantity: Number(quantity),
      amount: Number(amount),
    };

    setRows((prev) => [next, ...prev]);
    setDate("");
    setInvoiceNo("");
    setFarmer("");
    setProduct("");
    setQuantity("");
    setAmount("");
    setShowCreate(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Sales Return</h1>
          <p className="mt-1 text-slate-500">
            Record products returned against store sales invoices.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Create Sales Return
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Date" type="date" value={date} onChange={setDate} required />
            <Input
              label="Invoice No"
              value={invoiceNo}
              onChange={setInvoiceNo}
              placeholder="Enter invoice no"
              required
            />
            <Input
              label="Farmer"
              value={farmer}
              onChange={setFarmer}
              placeholder="Farmer name"
              required
            />
            <Select
              label="Product"
              value={product}
              onChange={setProduct}
              placeholder="Select product"
              options={[
                { value: "Electra", label: "Electra" },
                { value: "Aalga", label: "Aalga" },
                { value: "Astra", label: "Astra" },
                { value: "Rootra", label: "Rootra" },
              ]}
              required
            />
            <Input
              label="Quantity"
              type="number"
              value={quantity}
              onChange={setQuantity}
              placeholder="Returned qty"
              required
            />
            <Input
              label="Return Amount"
              type="number"
              value={amount}
              onChange={setAmount}
              placeholder="Enter amount"
              required
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={saveReturn} disabled={!canSave}>
              <Icon name="save" size={17} />
              Save Sales Return
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b bg-slate-100 text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left">Return No</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Invoice No</th>
              <th className="px-4 py-3 text-left">Farmer</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold">{row.returnNo}</td>
                <td className="px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">{row.invoiceNo}</td>
                <td className="px-4 py-3">{row.farmer}</td>
                <td className="px-4 py-3">{row.product}</td>
                <td className="px-4 py-3 text-center">{row.quantity}</td>
                <td className="px-4 py-3 text-right font-semibold">₹{row.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
