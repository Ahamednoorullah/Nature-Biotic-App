import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { createPortal } from "react-dom";

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

    function resetForm() {
    setDcNo(""); setExecutive(""); setProduct(""); setPackSize(""); setQty("");
  }

  function closeForm() {
    setShowAdd(false);
    resetForm();
  }

  function save() {
    if (!dcNo || !executive || !product || !qty) return;
    setRows((prev) => [{
      id: String(Date.now()),
      rcNo: `RC-${String(prev.length + 1).padStart(3, "0")}`,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      dcNo, executive, product, packSize, qty: Number(qty),
    }, ...prev]);
    closeForm();
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

            {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Create Return Challan</h2>
                  <p className="text-sm text-slate-500 mt-1">Record unsold products returned against a delivery challan.</p>
                </div>
                <button type="button" onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="DC No" value={dcNo} onChange={setDcNo} placeholder="DC-1001" required />
                  <Input label="Executive" value={executive} onChange={setExecutive} placeholder="Executive" required />
                  <Input label="Product" value={product} onChange={setProduct} placeholder="Product" required />
                  <Input label="Pack Size" value={packSize} onChange={setPackSize} placeholder="250 ml" />
                  <Input label="Return Qty" type="number" value={qty} onChange={setQty} placeholder="Qty" required />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>Cancel</Button>
                <Button onClick={save} disabled={!dcNo || !executive || !product || !qty}>
                  <Icon name="save" size={18} /> Save Return Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 border-b border text-left">Date</th>
              <th className="px-5 py-3 border-b border text-left">RC No</th>
              <th className="px-5 py-3 border-b border text-left">DC No</th>
              <th className="px-5 py-3 border-b border text-left">Executive</th>
              <th className="px-5 py-3 border-b border text-left">Product</th>
              <th className="px-5 py-3 border-b border text-left">Pack Size</th>
              <th className="px-5 py-3 border-b border text-center">Return Qty</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => <tr key={r.id}>
                <td className="px-5 py-4 border-b border">{r.date}</td>
                <td className="px-5 py-4 border-b border font-semibold">{r.rcNo}</td>
                <td className="px-5 py-4 border-b border">{r.dcNo}</td>
                <td className="px-5 py-4 border-b border">{r.executive}</td>
                <td className="px-5 py-4 border-b border font-semibold">{r.product}</td>
                <td className="px-5 py-4 border-b border">{r.packSize}</td>
                <td className="px-5 py-4 border-b border text-center font-bold">{r.qty}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
