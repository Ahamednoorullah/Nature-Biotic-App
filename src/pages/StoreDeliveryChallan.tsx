import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";

type Item = { product: string; packSize: string; qty: string };
type Challan = {
  id: string;
  dcNo: string;
  date: string;
  executive: string;
  items: Item[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

export default function StoreDeliveryChallan({ storeId }: { storeId: string }) {
  const [challans, setChallans] = useState<Challan[]>([
    { id: "1", dcNo: "DC-1001", date: "17 Aug 2026", executive: "Ram Kumar", items: [{ product: "Electra", packSize: "250 ml", qty: "10" }] },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [executive, setExecutive] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Item[]>([{ product: "", packSize: "", qty: "" }]);

  function updateItem(i: number, key: keyof Item, value: string) {
    setItems((prev) => prev.map((x, idx) => idx === i ? { ...x, [key]: value } : x));
  }

  function createChallan() {
    if (!executive || !date || items.some((i) => !i.product || !i.qty)) return;
    setChallans((prev) => [
      {
        id: String(Date.now()),
        dcNo: `DC-${1001 + prev.length}`,
        date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        executive,
        items,
      },
      ...prev,
    ]);
    setExecutive(""); setDate(""); setItems([{ product: "", packSize: "", qty: "" }]); setShowAdd(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Delivery Challan</h1>
          <p className="mt-1 text-slate-500">Issue products from store stock to field executives.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={18} /> Create Challan
        </Button>
      </div>

      {showAdd && (
        <Card className="mb-6 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Issue To / Executive" value={executive} onChange={setExecutive} placeholder="Select executive"
              options={executives.map((x) => ({ value: x, label: x }))} />
            <Input label="Date" type="date" value={date} onChange={setDate} />
          </div>

          <div className="mt-5 space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                <Input label="Product" value={item.product} onChange={(v) => updateItem(i, "product", v)} placeholder="Product" />
                <Input label="Pack Size" value={item.packSize} onChange={(v) => updateItem(i, "packSize", v)} placeholder="250 ml" />
                <Input label="Qty" type="number" value={item.qty} onChange={(v) => updateItem(i, "qty", v)} placeholder="Qty" />
                <div className="flex items-end">
                  <button disabled={items.length === 1} onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                    className="h-11 w-11 rounded-xl border border-red-200 text-red-500 disabled:opacity-30">
                    <Icon name="delete" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between">
            <Button variant="secondary" onClick={() => setItems((p) => [...p, { product: "", packSize: "", qty: "" }])}>
              <Icon name="add" size={16} /> Add Product
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={createChallan}>Create Challan</Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">DC No</th>
              <th className="px-5 py-3 text-left">Executive</th>
              <th className="px-5 py-3 text-center">Products</th>
              <th className="px-5 py-3 text-center">Total Qty</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {challans.map((c) => <tr key={c.id}>
                <td className="px-5 py-4">{c.date}</td>
                <td className="px-5 py-4 font-semibold">{c.dcNo}</td>
                <td className="px-5 py-4">{c.executive}</td>
                <td className="px-5 py-4 text-center">{c.items.length}</td>
                <td className="px-5 py-4 text-center font-bold">{c.items.reduce((s, x) => s + Number(x.qty || 0), 0)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
