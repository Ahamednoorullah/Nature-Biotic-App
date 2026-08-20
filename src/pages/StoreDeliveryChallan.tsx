import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { createPortal } from "react-dom";

type Item = { product: string; packSize: string; qty: string };
type Challan = {
  id: string;
  dcNo: string;
  date: string;
  executive: string;
  items: Item[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

function emptyItems(): Item[] {
  return [{ product: "", packSize: "", qty: "" }];
}

export default function StoreDeliveryChallan({ storeId }: { storeId: string }) {
  const [challans, setChallans] = useState<Challan[]>([
    {
      id: "1",
      dcNo: "DC-1001",
      date: "17 Aug 2026",
      executive: "Ram Kumar",
      items: [{ product: "Electra", packSize: "250 ml", qty: "10" }],
    },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [executive, setExecutive] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Item[]>(emptyItems());

  const canCreate =
    !!executive && !!date && items.every((i) => i.product && i.qty);

  function updateItem(i: number, key: keyof Item, value: string) {
    setItems((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)),
    );
  }

  function resetForm() {
    setExecutive("");
    setDate("");
    setItems(emptyItems());
  }

  function closeForm() {
    setShowAdd(false);
    resetForm();
  }

  function createChallan() {
    if (!canCreate) return;
    setChallans((prev) => [
      {
        id: String(Date.now()),
        dcNo: `DC-${1001 + prev.length}`,
        date: new Date(date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        executive,
        items,
      },
      ...prev,
    ]);
    closeForm();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Delivery Challan
          </h1>
          <p className="mt-1 text-slate-500">
            Issue products from store stock to field executives.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={18} /> Create Challan
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-5 py-3 border-b border text-left">Date</th>
                <th className="px-5 py-3 border-b border text-left">DC No</th>
                <th className="px-5 py-3 border-b border text-left">Executive</th>
                <th className="px-5 py-3 border-b border text-center">Products</th>
                <th className="px-5 py-3 border-b bordertext-center">Total Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {challans.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-4 border-b border">{c.date}</td>
                  <td className="px-5 py-4 border-b border font-semibold">{c.dcNo}</td>
                  <td className="px-5 py-4 border-b border">{c.executive}</td>
                  <td className="px-5 py-4 border-b border text-center">{c.items.length}</td>
                  <td className="px-5 py-4 border-b border text-center font-bold">
                    {c.items.reduce((s, x) => s + Number(x.qty || 0), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Challan — popup, same shell as Credit Note / Sales / Quotation */}
      {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Fixed header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Delivery Challan
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Issue products from store stock to a field executive.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="Issue To / Executive"
                    value={executive}
                    onChange={setExecutive}
                    placeholder="Select executive"
                    options={executives.map((x) => ({ value: x, label: x }))}
                    required
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Products
                    </h4>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setItems((p) => [
                          ...p,
                          { product: "", packSize: "", qty: "" },
                        ])
                      }
                    >
                      <Icon name="add" size={16} /> Add Product
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                      >
                        <Input
                          label="Product"
                          value={item.product}
                          onChange={(v) => updateItem(i, "product", v)}
                          placeholder="Product"
                        />
                        <Input
                          label="Pack Size"
                          value={item.packSize}
                          onChange={(v) => updateItem(i, "packSize", v)}
                          placeholder="250 ml"
                        />
                        <Input
                          label="Qty"
                          type="number"
                          value={item.qty}
                          onChange={(v) => updateItem(i, "qty", v)}
                          placeholder="Qty"
                        />
                        <div className="flex items-end">
                          <button
                            disabled={items.length === 1}
                            onClick={() =>
                              setItems((p) => p.filter((_, idx) => idx !== i))
                            }
                            className="h-11 w-11 rounded-xl border border-red-200 text-red-500 disabled:opacity-30"
                          >
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fixed footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={createChallan} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
