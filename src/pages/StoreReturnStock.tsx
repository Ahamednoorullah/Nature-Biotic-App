import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";

type ReturnStockRow = {
  id: string;
  date: string;
  returnNo: string;
  supplier: string;
  product: string;
  packSize: string;
  quantity: number;
  reason: string;
};

const initialRows: ReturnStockRow[] = [
  { id: "1", date: "17 Aug 2026", returnNo: "PRS-001", supplier: "Nature Biotic Pvt. Ltd.", product: "Electra", packSize: "250 ml", quantity: 4, reason: "Damaged" },
  { id: "2", date: "16 Aug 2026", returnNo: "PRS-002", supplier: "Nature Biotic Pvt. Ltd.", product: "Astra", packSize: "100 ml", quantity: 2, reason: "Wrong supply" },
];

export default function StoreReturnStock({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState(initialRows);
  const [showAdd, setShowAdd] = useState(false);
  const [product, setProduct] = useState("");
  const [packSize, setPackSize] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  function addReturn() {
    if (!product || !quantity || !reason) return;
    setRows((prev) => [
      {
        id: String(Date.now()),
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        returnNo: `PRS-${String(prev.length + 1).padStart(3, "0")}`,
        supplier: "Nature Biotic Pvt. Ltd.",
        product,
        packSize: packSize || "-",
        quantity: Number(quantity),
        reason,
      },
      ...prev,
    ]);
    setProduct(""); setPackSize(""); setQuantity(""); setReason(""); setShowAdd(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Return Stock</h1>
          <p className="mt-1 text-slate-500">Products returned by the store to supplier/company.</p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          <Icon name="add" size={18} /> Add Return
        </Button>
      </div>

      {showAdd && (
        <Card className="mb-6 p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Input label="Product" value={product} onChange={setProduct} placeholder="Product name" />
            <Input label="Pack Size" value={packSize} onChange={setPackSize} placeholder="e.g. 250 ml" />
            <Input label="Quantity" type="number" value={quantity} onChange={setQuantity} placeholder="Qty" />
            <Select
              label="Reason"
              value={reason}
              onChange={setReason}
              placeholder="Select reason"
              options={["Damaged", "Expired", "Wrong supply", "Other"].map((x) => ({ value: x, label: x }))}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addReturn}>Save Return</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Return No</th>
              <th className="px-5 py-3 text-left">Supplier</th>
              <th className="px-5 py-3 text-left">Product</th>
              <th className="px-5 py-3 text-left">Pack Size</th>
              <th className="px-5 py-3 text-center">Qty</th>
              <th className="px-5 py-3 text-left">Reason</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => <tr key={r.id}>
                <td className="px-5 py-4">{r.date}</td>
                <td className="px-5 py-4 font-semibold">{r.returnNo}</td>
                <td className="px-5 py-4">{r.supplier}</td>
                <td className="px-5 py-4 font-semibold">{r.product}</td>
                <td className="px-5 py-4">{r.packSize}</td>
                <td className="px-5 py-4 text-center font-bold">{r.quantity}</td>
                <td className="px-5 py-4">{r.reason}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
