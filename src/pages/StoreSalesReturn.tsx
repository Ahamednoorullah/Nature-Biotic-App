import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { products as allProducts, type Product } from "@/lib/data";
import { createPortal } from "react-dom";

type SaleType = "Direct" | "Executive";

type ReturnItem = {
  key: string;
  productId: string;
  product?: Product;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  price: number;
  taxPercent: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  reason: string;
};

type SalesReturnRow = {
  id: string;
  date: string;
  returnNo: string;
  invoiceNo: string;
  through: SaleType;
  partyName: string;
  executiveName: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  items: ReturnItem[];
};

const STORAGE_KEY = "nature-biotic-store-sales-returns-v2";

const seedRows: SalesReturnRow[] = [
  {
    id: "sr1",
    date: "2026-08-19",
    returnNo: "SR-001",
    invoiceNo: "INV-D-1201",
    through: "Direct",
    partyName: "Murugan",
    executiveName: "-",
    withoutTax: 1200,
    sgst: 72,
    cgst: 72,
    igst: 0,
    total: 1344,
    items: [
      {
        key: "sr1-item1",
        productId: "p0",
        product: allProducts.find((p) => p.id === "p0"),
        packSize: "500 ml",
        batchNo: "ELE-001",
        expiryDate: "2027-06-30",
        quantity: 2,
        price: 600,
        taxPercent: 12,
        withoutTax: 1200,
        sgst: 72,
        cgst: 72,
        igst: 0,
        total: 1344,
        reason: "Damaged Product",
      },
    ],
  },
];

function emptyItem() {
  return {
    productId: "",
    packSize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    price: 0,
    reason: "",
  };
}

function dateDisplay(value: string) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

export default function StoreSalesReturn({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_KEY}:${storeId}`;

  const [rows, setRows] = useState<SalesReturnRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : seedRows;
    } catch {
      return seedRows;
    }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturnRow | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnNo, setReturnNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [through, setThrough] = useState<SaleType>("Direct");
  const [partyName, setPartyName] = useState("");
  const [executiveName, setExecutiveName] = useState("");
  const [entry, setEntry] = useState(emptyItem());
  const [items, setItems] = useState<ReturnItem[]>([]);

  const selectedProduct = allProducts.find((p) => p.id === entry.productId);

  const totals = useMemo(() => ({
    withoutTax: items.reduce((sum, item) => sum + item.withoutTax, 0),
    sgst: items.reduce((sum, item) => sum + item.sgst, 0),
    cgst: items.reduce((sum, item) => sum + item.cgst, 0),
    igst: items.reduce((sum, item) => sum + item.igst, 0),
    total: items.reduce((sum, item) => sum + item.total, 0),
  }), [items]);

  function selectProduct(productId: string) {
    const product = allProducts.find((p) => p.id === productId);
    setEntry((prev) => ({
      ...prev,
      productId,
      packSize: product?.size || "",
      price: product?.sellingPrice || 0,
    }));
  }

  function addItem() {
    const product = allProducts.find((p) => p.id === entry.productId);

    if (
      !product ||
      !entry.packSize ||
      !entry.batchNo ||
      !entry.expiryDate ||
      !entry.reason ||
      entry.quantity < 1
    ) {
      return;
    }

    const withoutTax = entry.quantity * entry.price;
    const taxAmount = withoutTax * ((product.taxPercentage || 0) / 100);
    const intrastate = product.taxType === "Intrastate";
    const sgst = intrastate ? taxAmount / 2 : 0;
    const cgst = intrastate ? taxAmount / 2 : 0;
    const igst = intrastate ? 0 : taxAmount;

    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        productId: product.id,
        product,
        packSize: entry.packSize,
        batchNo: entry.batchNo,
        expiryDate: entry.expiryDate,
        quantity: entry.quantity,
        price: entry.price,
        taxPercent: product.taxPercentage || 0,
        withoutTax,
        sgst,
        cgst,
        igst,
        total: withoutTax + taxAmount,
        reason: entry.reason,
      },
    ]);

    setEntry(emptyItem());
  }

  function resetForm() {
    setDate(new Date().toISOString().split("T")[0]);
    setReturnNo("");
    setInvoiceNo("");
    setThrough("Direct");
    setPartyName("");
    setExecutiveName("");
    setEntry(emptyItem());
    setItems([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  const canSave =
    date &&
    returnNo.trim() &&
    invoiceNo.trim() &&
    partyName.trim() &&
    items.length > 0 &&
    (through === "Direct" || executiveName.trim());

  function saveReturn() {
    if (!canSave) return;

    const next: SalesReturnRow = {
      id: `sr-${Date.now()}`,
      date,
      returnNo: returnNo.trim(),
      invoiceNo: invoiceNo.trim(),
      through,
      partyName: partyName.trim(),
      executiveName: through === "Executive" ? executiveName.trim() : "-",
      withoutTax: totals.withoutTax,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      total: totals.total,
      items,
    };

    const updated = [next, ...rows];
    setRows(updated);

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}

    closeForm();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Sales Return
          </h1>
          <p className="mt-1 text-slate-500">
            Direct and executive sales return records.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Create Sales Return
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th rowSpan={2} className="w-[5%] border-r border-slate-200 px-2 py-3 text-center">
                S.No
              </th>
              <th rowSpan={2} className="w-[9%] border-r border-slate-200 px-2 py-3 text-center">
                Date
              </th>
              <th rowSpan={2} className="w-[11%] border-r border-slate-200 px-2 py-3 text-center">
                Return No
              </th>
              <th rowSpan={2} className="w-[12%] border-r border-slate-200 px-2 py-3 text-center">
                Invoice No
              </th>
              <th rowSpan={2} className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                Through
              </th>
              <th rowSpan={2} className="w-[14%] border-r border-slate-200 px-2 py-3 text-center">
                Party Name
              </th>
              <th rowSpan={2} className="w-[11%] border-r border-slate-200 px-2 py-3 text-right">
                Without Tax
              </th>
              <th colSpan={3} className="w-[18%] border-r border-slate-200 px-2 py-2 text-center">
                Tax
              </th>
              <th rowSpan={2} className="w-[10%] px-2 py-3 text-right">
                Total
              </th>
            </tr>

            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="border-r border-slate-100 px-2 py-2 text-right">SGST</th>
              <th className="border-r border-slate-100 px-2 py-2 text-right">CGST</th>
              <th className="border-r border-slate-200 px-2 py-2 text-right">IGST</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => setSelectedReturn(row)}
                className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                title="Click to view sales return details"
              >
                <td className="border-r border-slate-100 px-2 py-3 text-center">{index + 1}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-center">{dateDisplay(row.date)}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">{row.returnNo}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-center">{row.invoiceNo}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-center">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    row.through === "Direct"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-blue-700"
                  }`}>
                    {row.through}
                  </span>
                </td>
                <td className="truncate border-r border-slate-100 px-2 py-3 text-center">{row.partyName}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-right">{formatCurrency(row.withoutTax)}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-right">{formatCurrency(row.sgst)}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-right">{formatCurrency(row.cgst)}</td>
                <td className="border-r border-slate-100 px-2 py-3 text-right">{formatCurrency(row.igst)}</td>
                <td className="px-2 py-3 text-right font-bold">{formatCurrency(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Create Sales Return</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a direct or executive sales return.
                  </p>
                </div>
                <button type="button" onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-6">
                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Return Information
                  </h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    <Input label="Return Date" type="date" value={date} onChange={setDate} required />
                    <Input label="Return No" value={returnNo} onChange={setReturnNo} placeholder="e.g. SR-0002" required />
                    <Input label="Invoice No" value={invoiceNo} onChange={setInvoiceNo} placeholder="Original invoice no" required />
                    <Select
                      label="Sale Type"
                      value={through}
                      onChange={(value) => setThrough(value as SaleType)}
                      options={[
                        { value: "Direct", label: "Direct" },
                        { value: "Executive", label: "Executive" },
                      ]}
                    />
                    <Input label="Party Name" value={partyName} onChange={setPartyName} placeholder="Farmer / party name" required />

                    {through === "Executive" && (
                      <Select
                        label="Executive"
                        value={executiveName}
                        onChange={setExecutiveName}
                        placeholder="Select executive"
                        options={[
                          { value: "Ram Kumar", label: "Ram Kumar" },
                          { value: "Ajith Kumar", label: "Ajith Kumar" },
                          { value: "PeriyaSamy", label: "PeriyaSamy" },
                        ]}
                      />
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Add Return Product
                  </h4>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                      <Select
                        label="Product"
                        value={entry.productId}
                        onChange={selectProduct}
                        placeholder="Select product"
                        options={allProducts.map((p) => ({
                          value: p.id,
                          label: `${p.name} (${p.size})`,
                        }))}
                      />
                      <Input label="Pack Size" value={entry.packSize} onChange={(v) => setEntry((p) => ({ ...p, packSize: v }))} />
                      <Input label="Batch No" value={entry.batchNo} onChange={(v) => setEntry((p) => ({ ...p, batchNo: v }))} />
                      <Input label="Expiry Date" type="date" value={entry.expiryDate} onChange={(v) => setEntry((p) => ({ ...p, expiryDate: v }))} />
                      <Input label="Return Qty" type="number" value={String(entry.quantity)} onChange={(v) => setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))} />
                      <Input label="Price" type="number" value={String(entry.price)} onChange={(v) => setEntry((p) => ({ ...p, price: Number(v) || 0 }))} />
                      <Select
                        label="Reason"
                        value={entry.reason}
                        onChange={(v) => setEntry((p) => ({ ...p, reason: v }))}
                        placeholder="Select reason"
                        options={[
                          { value: "Damaged Product", label: "Damaged Product" },
                          { value: "Wrong Product", label: "Wrong Product" },
                          { value: "Quality Issue", label: "Quality Issue" },
                          { value: "Expired / Near Expiry", label: "Expired / Near Expiry" },
                          { value: "Other", label: "Other" },
                        ]}
                      />
                      <Button onClick={addItem} className="h-[50px] w-full">
                        <Icon name="add" size={18} />
                        Add Product
                      </Button>
                    </div>

                    {selectedProduct && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 md:grid-cols-5">
                        <Detail label="Product" value={selectedProduct.name} />
                        <Detail label="HSN / SAC" value={selectedProduct.hsnCode} />
                        <Detail label="Tax %" value={`${selectedProduct.taxPercentage}%`} />
                        <Detail label="Selling Price" value={formatCurrency(entry.price)} />
                        <Detail label="Pack Size" value={entry.packSize} />
                      </div>
                    )}
                  </div>
                </section>

                {items.length > 0 && (
                  <section>
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                            <th className="w-[6%] px-2 py-3 text-center">S.No</th>
                            <th className="w-[15%] px-2 py-3 text-left">Product</th>
                            <th className="w-[10%] px-2 py-3 text-center">Size</th>
                            <th className="w-[10%] px-2 py-3 text-center">Qty</th>
                            <th className="w-[11%] px-2 py-3 text-right">Price</th>
                            <th className="w-[12%] px-2 py-3 text-right">Without Tax</th>
                            <th className="w-[9%] px-2 py-3 text-right">SGST</th>
                            <th className="w-[9%] px-2 py-3 text-right">CGST</th>
                            <th className="w-[9%] px-2 py-3 text-right">IGST</th>
                            <th className="w-[9%] px-2 py-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={item.key} className="border-b border-slate-100">
                              <td className="px-2 py-3 text-center">{index + 1}</td>
                              <td className="px-2 py-3 font-semibold">{item.product?.name}</td>
                              <td className="px-2 py-3 text-center">{item.packSize}</td>
                              <td className="px-2 py-3 text-center">{item.quantity}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.price)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.withoutTax)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.sgst)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.cgst)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.igst)}</td>
                              <td className="px-2 py-3 text-right font-bold">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{formatCurrency(item.total)}</span>
                                  <button type="button" onClick={() => setItems((prev) => prev.filter((x) => x.key !== item.key))}
                                    className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                                    <Icon name="delete" size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <section className="flex justify-end">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
                    <Summary label="Without Tax" value={totals.withoutTax} />
                    <Summary label="SGST" value={totals.sgst} />
                    <Summary label="CGST" value={totals.cgst} />
                    <Summary label="IGST" value={totals.igst} />
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <Summary label="Grand Total" value={totals.total} bold />
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>Cancel</Button>
                <Button onClick={saveReturn} disabled={!canSave}>
                  <Icon name="save" size={17} />
                  Create Sales Return
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedReturn &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Sales Return</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">{selectedReturn.returnNo}</h2>
                  <p className="mt-1 text-sm text-slate-500">Against Invoice: {selectedReturn.invoiceNo}</p>
                </div>
                <button type="button" onClick={() => setSelectedReturn(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700">
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Info label="Return Date" value={dateDisplay(selectedReturn.date)} />
                  <Info label="Return No" value={selectedReturn.returnNo} />
                  <Info label="Invoice No" value={selectedReturn.invoiceNo} />
                  <Info label="Sale Type" value={selectedReturn.through} />
                  <Info label="Party Name" value={selectedReturn.partyName} />
                  <Info label="Executive" value={selectedReturn.executiveName} />
                  <Info label="No. of Products" value={String(selectedReturn.items.length)} />
                  <Info label="Return Value" value={formatCurrency(selectedReturn.total)} />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                        <th className="w-[6%] px-2 py-3 text-center">S.No</th>
                        <th className="w-[18%] px-3 py-3 text-left">Product</th>
                        <th className="w-[10%] px-2 py-3 text-center">Size</th>
                        <th className="w-[9%] px-2 py-3 text-center">Qty</th>
                        <th className="w-[11%] px-2 py-3 text-right">Price</th>
                        <th className="w-[12%] px-2 py-3 text-right">Without Tax</th>
                        <th className="w-[8%] px-2 py-3 text-right">SGST</th>
                        <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                        <th className="w-[8%] px-2 py-3 text-right">IGST</th>
                        <th className="w-[10%] px-2 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReturn.items.map((item, index) => (
                        <tr key={item.key}>
                          <td className="px-2 py-3 text-center">{index + 1}</td>
                          <td className="px-3 py-3">
                            <p className="font-semibold">{item.product?.name || "-"}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{item.reason}</p>
                          </td>
                          <td className="px-2 py-3 text-center">{item.packSize}</td>
                          <td className="px-2 py-3 text-center">{item.quantity}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.price)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.withoutTax)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.sgst)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.cgst)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.igst)}</td>
                          <td className="px-2 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 ml-auto w-full max-w-md rounded-xl bg-slate-50 p-4 text-sm">
                  <Summary label="Without Tax" value={selectedReturn.withoutTax} />
                  <Summary label="SGST" value={selectedReturn.sgst} />
                  <Summary label="CGST" value={selectedReturn.cgst} />
                  <Summary label="IGST" value={selectedReturn.igst} />
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <Summary label="Grand Total" value={selectedReturn.total} bold />
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setSelectedReturn(null)}>Close</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Summary({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-bold text-slate-800" : "font-semibold text-slate-700"}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
