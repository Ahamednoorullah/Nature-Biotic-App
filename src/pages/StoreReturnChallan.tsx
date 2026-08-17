import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";

type ReturnChallan = {
  id: string;
  rcNo: string;
  date: string;
  dcNo: string;
  executive: string;
  product: string;
  packSize: string;
  qty: number;
};

export default function StoreReturnChallan({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<ReturnChallan[]>([
    { id: "1", rcNo: "RC-001", date: "17 Aug 2026", dcNo: "DC-1001", executive: "Ram Kumar", product: "Electra", packSize: "250 ml", qty: 3 },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [dcNo, setDcNo] = useState("");
  const [executive, setExecutive] = useState("");
  const [product, setProduct] = useState("");
  const [packSize, setPackSize] = useState("");
  const [qty, setQty] = useState("");

  function save() {
    if (!dcNo || !executive || !product || !qty) return;
    setRows((prev) => [{
      id: String(Date.now()),
      rcNo: `RC-${String(prev.length + 1).padStart(3, "0")}`,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      dcNo, executive, product, packSize, qty: Number(qty),
    }, ...prev]);
    setDcNo(""); setExecutive(""); setProduct(""); setPackSize(""); setQty(""); setShowAdd(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Return Challan</h1>
          <p className="mt-1 text-slate-500">Unsold products returned by executives against delivery challans.</p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          <Icon name="add" size={18} /> Create Return Challan
        </Button>
      </div>

      {showAdd && <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-5">
          <Input label="Delivery Challan No" value={dcNo} onChange={setDcNo} placeholder="DC-1001" />
          <Input label="Executive" value={executive} onChange={setExecutive} placeholder="Executive" />
          <Input label="Product" value={product} onChange={setProduct} placeholder="Product" />
          <Input label="Pack Size" value={packSize} onChange={setPackSize} placeholder="250 ml" />
          <Input label="Return Qty" type="number" value={qty} onChange={setQty} placeholder="Qty" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={save}>Save Return Challan</Button>
        </div>
      </Card>}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Return Challan No</th>
              <th className="px-5 py-3 text-left">DC No</th>
              <th className="px-5 py-3 text-left">Executive</th>
              <th className="px-5 py-3 text-left">Product</th>
              <th className="px-5 py-3 text-left">Pack Size</th>
              <th className="px-5 py-3 text-center">Return Qty</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => <tr key={r.id}>
                <td className="px-5 py-4">{r.date}</td>
                <td className="px-5 py-4 font-semibold">{r.rcNo}</td>
                <td className="px-5 py-4">{r.dcNo}</td>
                <td className="px-5 py-4">{r.executive}</td>
                <td className="px-5 py-4 font-semibold">{r.product}</td>
                <td className="px-5 py-4">{r.packSize}</td>
                <td className="px-5 py-4 text-center font-bold">{r.qty}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
