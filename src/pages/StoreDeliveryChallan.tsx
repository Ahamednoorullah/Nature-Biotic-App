import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { createPortal } from "react-dom";
import { formatCurrency, formatDate } from "@/lib/format";

type Item = { product: string; packSize: string; qty: string; unitValue: string };
type Challan = {
  id: string;
  dcNo: string;
  date: string;
  executive: string;
  customerName: string;
  address: string;
  contactNo: string;
  placeOfSupply: string;
  items: Item[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

function emptyItems(): Item[] {
  return [{ product: "", packSize: "", qty: "", unitValue: "" }];
}

const STORAGE_PREFIX = "nature-biotic-store-delivery-challans-v2";

export default function StoreDeliveryChallan({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [challans, setChallans] = useState<Challan[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}

    return [
      {
        id: "1",
        dcNo: "DC-1001",
        date: "2026-08-17",
        executive: "Ram Kumar",
        customerName: "Murugan",
        address: "Rajapalayam",
        contactNo: "9876543210",
        placeOfSupply: "Tamil Nadu",
        items: [
          { product: "Electra", packSize: "250 ml", qty: "10", unitValue: "250" },
        ],
      },
    ];
  });

  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Challan | null>(null);
  const [dcNo, setDcNo] = useState("");
  const [executive, setExecutive] = useState("");
  const [date, setDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [items, setItems] = useState<Item[]>(emptyItems());

  const canCreate =
    !!dcNo.trim() &&
    !!executive &&
    !!date &&
    !!customerName.trim() &&
    !!placeOfSupply.trim() &&
    items.every(
      (item) =>
        item.product &&
        item.packSize &&
        Number(item.qty) > 0 &&
        Number(item.unitValue) >= 0,
    );

  const totals = useMemo(
    () => ({
      totalQty: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
      approxValue: items.reduce(
        (sum, item) =>
          sum + Number(item.qty || 0) * Number(item.unitValue || 0),
        0,
      ),
    }),
    [items],
  );

  function updateItem(i: number, key: keyof Item, value: string) {
    setItems((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)),
    );
  }

  function resetForm() {
    setDcNo("");
    setExecutive("");
    setDate("");
    setCustomerName("");
    setAddress("");
    setContactNo("");
    setPlaceOfSupply("");
    setItems(emptyItems());
  }

  function closeForm() {
    setShowAdd(false);
    resetForm();
  }

  function createChallan() {
    if (!canCreate) return;

    const next: Challan = {
      id: String(Date.now()),
      dcNo: dcNo.trim(),
      date,
      executive,
      customerName: customerName.trim(),
      address: address.trim(),
      contactNo: contactNo.trim(),
      placeOfSupply: placeOfSupply.trim(),
      items,
    };

    const updated = [next, ...challans];
    setChallans(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
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
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="w-[6%] px-3 py-3 text-center">S.No</th>
              <th className="w-[12%] px-3 py-3 text-center">Date</th>
              <th className="w-[14%] px-3 py-3 text-center">DC No</th>
              <th className="w-[18%] px-3 py-3 text-center">Executive</th>
              <th className="w-[18%] px-3 py-3 text-center">Customer</th>
              <th className="w-[12%] px-3 py-3 text-center">Products</th>
              <th className="w-[10%] px-3 py-3 text-center">Qty</th>
              <th className="w-[10%] px-3 py-3 text-right">Approx Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {challans.map((c, index) => {
              const totalQty = c.items.reduce((s, x) => s + Number(x.qty || 0), 0);
              const approx = c.items.reduce(
                (s, x) => s + Number(x.qty || 0) * Number(x.unitValue || 0),
                0,
              );

              return (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer hover:bg-brand-50/40 transition-base"
                >
                  <td className="px-3 py-4 text-center">{index + 1}</td>
                  <td className="px-3 py-4 text-center">{formatDate(c.date)}</td>
                  <td className="px-3 py-4 text-center font-semibold">{c.dcNo}</td>
                  <td className="px-3 py-4 text-center">{c.executive}</td>
                  <td className="px-3 py-4 text-center">{c.customerName}</td>
                  <td className="px-3 py-4 text-center">{c.items.length}</td>
                  <td className="px-3 py-4 text-center font-bold">{totalQty}</td>
                  <td className="px-3 py-4 text-right font-bold">{formatCurrency(approx)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Input label="D.C No" value={dcNo} onChange={setDcNo} placeholder="e.g. DC-1002" required />
                  <Input label="D.C Date" type="date" value={date} onChange={setDate} required />
                  <Select
                    label="Executive"
                    value={executive}
                    onChange={setExecutive}
                    placeholder="Select executive"
                    options={executives.map((x) => ({ value: x, label: x }))}
                    required
                  />
                  <Input label="Place of Supply" value={placeOfSupply} onChange={setPlaceOfSupply} placeholder="e.g. Tamil Nadu" required />
                  <Input label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Customer name" required />
                  <Input label="Contact No" value={contactNo} onChange={setContactNo} placeholder="Contact number" />
                  <div className="md:col-span-2">
                    <Input label="Address" value={address} onChange={setAddress} placeholder="Customer address" />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Product Details
                    </h4>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setItems((p) => [
                          ...p,
                          { product: "", packSize: "", qty: "", unitValue: "" },
                        ])
                      }
                    >
                      <Icon name="add" size={16} /> Add Product
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                          <th className="w-[6%] px-2 py-3 text-center">S.No</th>
                          <th className="w-[30%] px-2 py-3 text-left">Product Name</th>
                          <th className="w-[13%] px-2 py-3 text-center">Pkg Size</th>
                          <th className="w-[13%] px-2 py-3 text-center">Quantity</th>
                          <th className="w-[15%] px-2 py-3 text-right">Unit Value</th>
                          <th className="w-[18%] px-2 py-3 text-right">Approx Sale Value</th>
                          <th className="w-[5%] px-2 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => {
                          const approx = Number(item.qty || 0) * Number(item.unitValue || 0);
                          return (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-2 py-3 text-center">{i + 1}</td>
                              <td className="px-2 py-3">
                                <Input value={item.product} onChange={(v) => updateItem(i, "product", v)} placeholder="Product" />
                              </td>
                              <td className="px-2 py-3">
                                <Input value={item.packSize} onChange={(v) => updateItem(i, "packSize", v)} placeholder="250 ml" />
                              </td>
                              <td className="px-2 py-3">
                                <Input type="number" value={item.qty} onChange={(v) => updateItem(i, "qty", v)} placeholder="Qty" />
                              </td>
                              <td className="px-2 py-3">
                                <Input type="number" value={item.unitValue} onChange={(v) => updateItem(i, "unitValue", v)} placeholder="₹" />
                              </td>
                              <td className="px-2 py-3 text-right font-bold">{formatCurrency(approx)}</td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={items.length === 1}
                                  onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 ml-auto grid w-full max-w-md grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                    <div>
                      <p className="text-xs text-slate-400">Total Quantity</p>
                      <p className="mt-1 font-bold text-slate-800">{totals.totalQty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Approx Sale Value</p>
                      <p className="mt-1 font-bold text-brand-700">{formatCurrency(totals.approxValue)}</p>
                    </div>
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

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Delivery Challan</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">{selected.dcNo}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                <div className="rounded-xl border border-slate-300">
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-sm font-bold text-slate-900">SAIRAM AGRI INPUTS</p>
                      <p className="text-xs text-slate-600">Rajapalayam, Tamil Nadu</p>
                    </div>
                    <div className="flex items-center justify-center p-4">
                      <h3 className="text-2xl font-bold text-slate-900">Delivery Challan</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="border-r border-slate-300 p-3 text-sm">
                      <p><span className="inline-block w-28 font-medium">D.C No</span>: {selected.dcNo}</p>
                      <p className="mt-2"><span className="inline-block w-28 font-medium">D.C Date</span>: {formatDate(selected.date)}</p>
                    </div>
                    <div className="p-3 text-sm">
                      <p><span className="inline-block w-32 font-medium">Place of Supply</span>: {selected.placeOfSupply}</p>
                      <p className="mt-2"><span className="inline-block w-32 font-medium">Executive</span>: {selected.executive}</p>
                    </div>
                  </div>

                  <div className="border-b border-slate-300 p-3 text-sm">
                    <p><span className="inline-block w-32 font-medium">Customer Name</span>: {selected.customerName}</p>
                    <p className="mt-2"><span className="inline-block w-32 font-medium">Address</span>: {selected.address || "-"}</p>
                    <p className="mt-2"><span className="inline-block w-32 font-medium">Contact No</span>: {selected.contactNo || "-"}</p>
                  </div>

                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="w-[7%] border-r border-slate-300 px-2 py-3 text-center">S.No</th>
                        <th className="w-[32%] border-r border-slate-300 px-2 py-3 text-left">Product Name</th>
                        <th className="w-[13%] border-r border-slate-300 px-2 py-3 text-center">Pkg Size</th>
                        <th className="w-[14%] border-r border-slate-300 px-2 py-3 text-center">Quantity in No's</th>
                        <th className="w-[14%] border-r border-slate-300 px-2 py-3 text-right">Unit Value</th>
                        <th className="w-[20%] px-2 py-3 text-right">Approx Sale Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item, index) => (
                        <tr key={index} className="border-b border-slate-200">
                          <td className="border-r border-slate-300 px-2 py-4 text-center">{index + 1}</td>
                          <td className="border-r border-slate-300 px-2 py-4 font-medium">{item.product}</td>
                          <td className="border-r border-slate-300 px-2 py-4 text-center">{item.packSize}</td>
                          <td className="border-r border-slate-300 px-2 py-4 text-center">{item.qty}</td>
                          <td className="border-r border-slate-300 px-2 py-4 text-right">{formatCurrency(Number(item.unitValue || 0))}</td>
                          <td className="px-2 py-4 text-right font-bold">{formatCurrency(Number(item.qty || 0) * Number(item.unitValue || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={() => window.print()}><Icon name="print" size={18} /> Print Challan</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
