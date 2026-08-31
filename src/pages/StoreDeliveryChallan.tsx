import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { createPortal } from "react-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import { products as allProducts } from "@/lib/data";

type Item = {
  productId: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  qty: string;
  unitValue: string;
};
type Challan = {
  id: string;
  dcNo: string;
  date: string;
  executive: string;
  customerName: string;
  address: string;
  contactNo: string;
  placeOfSupply: string;
  cgstPercent: number;   // ✅ ADD
  sgstPercent: number;   // ✅ ADD
  igstPercent: number;   // ✅ ADD
  items: Item[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

function emptyItems(): Item[] {
  return [
    {
      productId: "",
      product: "",
      packSize: "",
      batchNo: "",
      expiryDate: "",
      qty: "",
      unitValue: "",
    },
  ];
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
          {
            productId: "electra",
            product: "Electra",
            packSize: "250 ml",
            batchNo: "ELE010826",
            expiryDate: "2027-08-31",
            qty: "10",
            unitValue: "250",
          },
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
  const [cgstPercent, setCgstPercent] = useState(0);   // ✅ ADD
  const [sgstPercent, setSgstPercent] = useState(0);   // ✅ ADD
  const [igstPercent, setIgstPercent] = useState(0);   // ✅ ADD

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
        item.batchNo.trim() &&
        item.expiryDate &&
        Number(item.qty) > 0 &&
        Number(item.unitValue) >= 0,
    );

  const totals = useMemo(() => {
  const approxValue = items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.unitValue || 0),
    0,
  );
  const cgstAmount = (approxValue * cgstPercent) / 100;
  const sgstAmount = (approxValue * sgstPercent) / 100;
  const igstAmount = (approxValue * igstPercent) / 100;

  return {
    totalQty: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    approxValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    grandTotal: approxValue + cgstAmount + sgstAmount + igstAmount,
  };
}, [items, cgstPercent, sgstPercent, igstPercent]);

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
  setCgstPercent(0);   // ✅ ADD
  setSgstPercent(0);   // ✅ ADD
  setIgstPercent(0);   // ✅ ADD
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
    cgstPercent,
    sgstPercent,
    igstPercent,
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
  <table className="w-full table-fixed border-collapse text-sm">
    <thead>
      {/* First Header Row */}
      <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
        <th rowSpan={2}className="w-[5%] border-r border-slate-200 px-2 py-2.5 text-center">
          S.No
        </th>

        <th rowSpan={2} className="w-[8%] border-r border-slate-200 px-2 py-2.5 text-center">
          Date
        </th>

        <th rowSpan={2} className="w-[9%] border-r border-slate-200 px-2 py-2.5 text-center">
          DC No
        </th>

        <th rowSpan={2} className="w-[8%] border-r border-slate-200 px-2 py-2.5 text-center">
          Executive
        </th>

        <th rowSpan={2} className="w-[11%] border-r border-slate-200 px-2 py-2.5 text-center">
          Farmer Details
        </th>

        <th rowSpan={2} className="w-[7%] border-r border-slate-200 px-2 py-2.5 text-center">
          Products
        </th>

        <th rowSpan={2} className="w-[6%] border-r border-slate-200 px-2 py-2.5 text-center">
          Qty
        </th>

        {/* Without Tax */}
        <th
          rowSpan={2}
          className="w-[9%] border-r border-slate-200 px-2 py-2.5 text-center font-semibold"
        >
          Without Tax
        </th>

        {/* Tax */}
        <th
          colSpan={3}
          className="w-[18%] border-r border-slate-200 px-2 py-2.5 text-center font-semibold"
        >
          Tax
        </th>

        {/* Total */}
        <th
          rowSpan={2}
          className="w-[10%] px-2 py-2.5 text-right font-semibold"
        >
          Total Value
        </th>
      </tr>

      {/* Second Header Row — Tax */}
      <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
        
        <th className="border-r border-slate-100 px-2 py-2 text-center font-semibold">
          SGST
        </th>

        <th className="border-r border-slate-100 px-2 py-2 text-center font-semibold">
          CGST
        </th>

        <th className="border-r border-slate-200 px-2 py-2 text-center font-semibold">
          IGST
        </th>
      </tr>
    </thead>

    <tbody className="divide-y divide-slate-100">
      {challans.map((c, index) => {
        const totalQty = c.items.reduce((s, x) => s + Number(x.qty || 0), 0);
        const withoutTax = c.items.reduce(
          (s, x) => s + Number(x.qty || 0) * Number(x.unitValue || 0),
          0,
        );

        // ✅ REPLACE hardcoded 0 with real calc:
        const sgst = (withoutTax * (c.sgstPercent || 0)) / 100;
        const cgst = (withoutTax * (c.cgstPercent || 0)) / 100;
        const igst = (withoutTax * (c.igstPercent || 0)) / 100;

        const totalValue = withoutTax + sgst + cgst + igst;

        return (
          <tr
            key={c.id}
            onClick={() => setSelected(c)}
            className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
          >
            <td className="border-r border-slate-100 px-2 py-3 text-center">
              {index + 1}
            </td>

            <td className="border-r border-slate-100 px-2 py-3 text-center">
              {formatDate(c.date)}
            </td>

            <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">
              {c.dcNo}
            </td>

            <td className="border-r border-slate-100 px-2 py-3 text-center">
              {c.executive}
            </td>

            {/* Farmer Details */}
            <td className="border-r border-slate-100 px-2 py-3 text-center">
              <p className="font-semibold text-slate-800">
                {c.customerName}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {c.address || "-"}
              </p>
            </td>

            <td className="border-r border-slate-100 px-2 py-3 text-center">
              {c.items.length}
            </td>

            <td className="border-r border-slate-100 px-2 py-3 text-center font-bold">
              {totalQty}
            </td>

            {/* WITHOUT TAX */}
            <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold text-slate-700">
              {formatCurrency(withoutTax)}
            </td>

            {/* SGST */}
            <td className="border-r border-slate-100 px-2 py-3 text-right text-slate-600">
              {formatCurrency(sgst)}
            </td>

            {/* CGST */}
            <td className="border-r border-slate-100 px-2 py-3 text-right text-slate-600">
              {formatCurrency(cgst)}
            </td>

            {/* IGST */}
            <td className="border-r border-slate-100 px-2 py-3 text-right text-slate-600">
              {formatCurrency(igst)}
            </td>

            {/* TOTAL VALUE */}
            <td className="px-2 py-3 text-right font-bold text-slate-800">
              {formatCurrency(totalValue)}
            </td>
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

                  <Select
                    label="Place of Supply"
                    value={placeOfSupply}
                    onChange={(value) => {
                      setPlaceOfSupply(value);
                      if (value === "Tamil Nadu") {
                        setCgstPercent(9);
                        setSgstPercent(9);
                        setIgstPercent(0);
                      } else {
                        setCgstPercent(0);
                        setSgstPercent(0);
                        setIgstPercent(18);
                      }
                    }}
                    placeholder="Select Place of Supply"
                    options={[
                      { value: "Tamil Nadu", label: "Tamil Nadu" },
                      { value: "Others", label: "Others" },
                    ]}
                    required
                  />


                  <Input label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Customer name" required />
                  <Input label="Contact No" value={contactNo} onChange={setContactNo} placeholder="Contact number" />
                  <div className="md:col-span-2">
                    <Input label="Village" value={address} onChange={setAddress} placeholder="e.g. Rajapalayam" />
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
                          {
                            productId: "",
                            product: "",
                            packSize: "",
                            batchNo: "",
                            expiryDate: "",
                            qty: "",
                            unitValue: "",
                          },  
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
                          <th className="w-[20%] px-2 py-3 text-left">Product Name</th>
                          <th className="w-[10%] px-2 py-3 text-center">Pkg Size</th>
                          <th className="w-[12%] px-2 py-3 text-center">Batch ID</th>
                          <th className="w-[12%] px-2 py-3 text-center">Expiry Date</th>
                          <th className="w-[9%] px-2 py-3 text-center">Quantity</th>
                          <th className="w-[12%] px-2 py-3 text-right">Unit Value</th>
                          <th className="w-[14%] px-2 py-3 text-right">Approx Sale Value</th>
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
                              <Select
                                value={item.productId}
                                onChange={(value) => {
                                  const selectedProduct = allProducts.find((p) => p.id === value);
                                  updateItem(i, "productId", value);
                                  if (selectedProduct) {
                                    const source = selectedProduct as any;

                                    updateItem(i, "product", selectedProduct.name);
                                    updateItem(i, "packSize", selectedProduct.size || "");
                                    updateItem(
                                      i,
                                      "batchNo",
                                      String(
                                        source.batchNo ??
                                          source.batchId ??
                                          source.batchID ??
                                          "",
                                      ),
                                    );
                                    updateItem(
                                      i,
                                      "expiryDate",
                                      String(
                                        source.expiryDate ??
                                          source.expDate ??
                                          source.expiry ??
                                          "",
                                      ),
                                    );
                                    updateItem(
                                      i,
                                      "unitValue",
                                      String(selectedProduct.sellingPrice || 0),
                                    );
                                  }
                                }}
                                placeholder="Select Product"
                                options={allProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.size})` }))}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <Select
                                value={item.packSize}
                                onChange={(v) => updateItem(i, "packSize", v)}
                                placeholder="Select size"
                                options={[
                                  { value: "100ml", label: "100 ml" },
                                  { value: "250ml", label: "250 ml" },
                                  { value: "500ml", label: "500 ml" },
                                  { value: "1l", label: "1 L" },
                                  { value: "100g", label: "100 g" },
                                  { value: "250g", label: "250 g" },
                                  { value: "500g", label: "500 g" },
                                  { value: "1kg", label: "1 Kg" },
                                  { value: "5kg", label: "5 Kg" },
                                  { value: "10kg", label: "10 Kg" },
                                  { value: "25kg", label: "25 Kg" },
                                  ]}
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  value={item.batchNo}
                                  onChange={(v) => updateItem(i, "batchNo", v)}
                                  placeholder="Batch ID"
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  type="date"
                                  value={item.expiryDate}
                                  onChange={(v) => updateItem(i, "expiryDate", v)}
                                />
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

                  <div className="mt-4 ml-auto w-full max-w-md rounded-xl bg-slate-50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Quantity</span>
                      <span className="font-bold text-slate-800">{totals.totalQty}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Without Tax</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(totals.approxValue)}</span>
                    </div>
                    <div className="flex justify-between text-xs pl-3">
                      <span className="text-slate-400">SGST</span>
                      <span className="text-slate-600">{formatCurrency(totals.sgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs pl-3">
                      <span className="text-slate-400">CGST</span>
                      <span className="text-slate-600">{formatCurrency(totals.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs pl-3">
                      <span className="text-slate-400">IGST</span>
                      <span className="text-slate-600">{formatCurrency(totals.igstAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                      <span className="font-bold text-slate-800">Grand Total</span>
                      <span className="font-bold text-brand-700">{formatCurrency(totals.grandTotal)}</span>
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
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 6mm;
                }

                body * {
                  visibility: hidden !important;
                }

                .delivery-challan-print-area,
                .delivery-challan-print-area * {
                  visibility: visible !important;
                }

                .delivery-challan-print-area {
                  position: absolute !important;
                  inset: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: white !important;
                }

                .delivery-challan-screen-only {
                  display: none !important;
                }

                .delivery-challan-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }
              }
            `}</style>

            <div className="delivery-challan-print-area flex h-[96vh] w-[98.5vw] max-w-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="delivery-challan-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Delivery Challan
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selected.dcNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="delivery-challan-scroll min-h-0 flex-1 overflow-y-auto p-3">
                <div className="min-h-full w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 px-6 py-3">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>

                        <div>
                          <h3 className="text-lg font-extrabold tracking-wide text-slate-900">
                            SAIRAM AGRI INPUTS
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                            Rajapalayam, Tamil Nadu
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Nature Biotic Store
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center px-4 py-3">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Delivery Challan
                        </h3>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Store Stock Issue to Executive
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Farmer Details
                      </p>
                      <p className="font-bold text-slate-900">
                        {selected.customerName}
                      </p>
                      <p className="text-slate-600">
                        {selected.address || "-"}
                      </p>
                      <p className="text-slate-600">
                        Contact: {selected.contactNo || "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Dispatch Details
                      </p>
                      <p className="text-slate-600">
                        Executive:{" "}
                        <span className="font-semibold text-slate-800">
                          {selected.executive}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Place of Supply:{" "}
                        <span className="font-semibold text-slate-800">
                          {selected.placeOfSupply}
                        </span>
                      </p>
                    </div>

                    <div className="px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Challan Details
                      </p>
                      <div className="grid grid-cols-[95px_1fr] gap-y-0.5">
                        <span className="text-slate-500">D.C No</span>
                        <span className="font-semibold text-slate-800">
                          {selected.dcNo}
                        </span>

                        <span className="text-slate-500">D.C Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selected.date)}
                        </span>

                        <span className="text-slate-500">Executive</span>
                        <span className="font-semibold text-slate-800">
                          {selected.executive}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                          <th className="w-[5%] border-r border-slate-300 px-2 py-2 text-center">
                            S.No
                          </th>
                          <th className="w-[18%] border-r border-slate-300 px-2 py-2 text-left">
                            Product
                          </th>
                          <th className="w-[9%] border-r border-slate-300 px-2 py-2 text-center">
                            Pkg Size
                          </th>
                          <th className="w-[12%] border-r border-slate-300 px-2 py-2 text-center">
                            Batch ID
                          </th>
                          <th className="w-[12%] border-r border-slate-300 px-2 py-2 text-center">
                            Expiry Date
                          </th>
                          <th className="w-[8%] border-r border-slate-300 px-2 py-2 text-center">
                            Qty
                          </th>
                          <th className="w-[12%] border-r border-slate-300 px-2 py-2 text-right">
                            Unit Value
                          </th>
                          <th className="w-[16%] px-2 py-2 text-right">
                            Approx Sale Value
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selected.items.map((item, index) => (
                          <tr
                            key={`${item.productId}-${index}`}
                            className="border-b border-slate-300"
                          >
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {index + 1}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                              {item.product}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.packSize}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.batchNo || "-"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.expiryDate
                                ? formatDate(item.expiryDate)
                                : "-"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center font-semibold">
                              {item.qty}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(Number(item.unitValue || 0))}
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-slate-800">
                              {formatCurrency(
                                Number(item.qty || 0) *
                                  Number(item.unitValue || 0),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(() => {
                    const withoutTax = selected.items.reduce(
                      (sum, item) =>
                        sum +
                        Number(item.qty || 0) *
                          Number(item.unitValue || 0),
                      0,
                    );
                    const sgst =
                      (withoutTax * Number(selected.sgstPercent || 0)) / 100;
                    const cgst =
                      (withoutTax * Number(selected.cgstPercent || 0)) / 100;
                    const igst =
                      (withoutTax * Number(selected.igstPercent || 0)) / 100;
                    const grandTotal = withoutTax + sgst + cgst + igst;

                    return (
                      <div className="grid min-h-[150px] grid-cols-[1fr_320px] border-t border-slate-300">
                        <div className="border-r border-slate-300 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Notes
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            Products issued from store stock to{" "}
                            {selected.executive} for field delivery.
                          </p>
                        </div>

                        <div className="p-4 text-sm">
                          {/* <div className="flex justify-between py-1">
                            <span className="text-slate-500">Without Tax</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(withoutTax)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">SGST</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(sgst)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">CGST</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(cgst)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">IGST</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(igst)}
                            </span>
                          </div> */}


                          <div className="mt-3 flex justify-between border-t border-slate-300 pt-3">
                            Round Off
                          <span className="text-lg font-bold text-slate-900">
                            {formatCurrency(Math.round(grandTotal) - grandTotal)}
                          </span>
                        </div>

                          <div className="mt-3 flex justify-between border-t border-slate-300 pt-3">
                            <span className="font-bold text-slate-800">
                              Grand Total
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                              {formatCurrency(grandTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex min-h-[80px] justify-end border-t border-slate-300 px-6 py-3">
                    <div className="mt-auto w-56 text-center">
                      <div className="border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="delivery-challan-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelected(null)}
                >
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}


    </div>
  );
}
