import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { products as allProducts, getStore, type Product } from "@/lib/data";
import { createPortal } from "react-dom";

type SaleType = "Direct" | "Executive";

type SaleRow = {
  id: string;
  date: string;
  invoiceNo: string;
  through: SaleType;
  partyName: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  products: AddedRow[];
};

type EntryForm = {
  productId: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
};

type AddedRow = {
  key: string;
  productId: string;
  product?: Product;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  packSize: string;
  hsn: string;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  withoutTax: number;
  taxAmount: number;
  rowTotal: number;
};

const STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

const initialRows: SaleRow[] = [
  {
    id: "store-sale-1",
    date: "17/08/26",
    invoiceNo: "nb-inv-2001",
    through: "Direct",
    partyName: "Murugan",
    withoutTax: 2232,
    sgst: 133.92,
    cgst: 133.92,
    igst: 0,
    amount: 2499.84,
    products: [],
  },
];

function emptyEntry(): EntryForm {
  return {
    productId: "",
    pkgsize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    sellingPrice: 0,
    discount: 0,
  };
}

function formatDateInput(value: string) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(-2)}`;
}

export default function StoreSalesInvoice({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_KEY}:${storeId}`;

  const [rows, setRows] = useState<SaleRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : initialRows;
    } catch {
      return initialRows;
    }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const store = getStore(storeId);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [invoiceNo, setInvoiceNo] = useState("");
  const [through, setThrough] = useState<SaleType>("Direct");
  const [partyName, setPartyName] = useState("");
  const [executiveName, setExecutiveName] = useState("");
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [added, setAdded] = useState<AddedRow[]>([]);

  const entryProduct = allProducts.find((p) => p.id === entry.productId);

  const totals = useMemo(() => {
    const withoutTax = added.reduce((s, r) => s + r.withoutTax, 0);
    const totalTax = added.reduce((s, r) => s + r.taxAmount, 0);
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;
    const igst = 0;
    const grandTotal = withoutTax + totalTax;

    return {
      withoutTax: Math.round(withoutTax * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      igst,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [added]);

  function selectProduct(productId: string) {
    const product = allProducts.find((p) => p.id === productId);
    setEntry((prev) => ({
      ...prev,
      productId,
      pkgsize: product?.size || "",
      sellingPrice: product?.sellingPrice || 0,
    }));
  }

  function addProduct() {
    if (
      !entry.productId ||
      !entry.pkgsize ||
      !entry.batchNo ||
      !entry.expiryDate ||
      entry.quantity < 1
    ) {
      return;
    }

    const product = allProducts.find((p) => p.id === entry.productId);
    if (!product) return;

    const gross = entry.quantity * entry.sellingPrice;
    const withoutTax = Math.max(0, gross - entry.discount);
    const taxPercent = product.taxPercentage || 0;
    const taxAmount =
      Math.round(withoutTax * (taxPercent / 100) * 100) / 100;
    const rowTotal = Math.round((withoutTax + taxAmount) * 100) / 100;

    const row: AddedRow = {
      key: `${Date.now()}-${Math.random()}`,
      productId: entry.productId,
      product,
      pkgsize: entry.pkgsize,
      batchNo: entry.batchNo,
      expiryDate: entry.expiryDate,
      packSize: product.size,
      hsn: product.hsnCode || "",
      taxPercent,
      quantity: entry.quantity,
      sellingPrice: entry.sellingPrice,
      discount: entry.discount,
      withoutTax,
      taxAmount,
      rowTotal,
    };

    setAdded((prev) => [...prev, row]);
    setEntry(emptyEntry());
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((r) => r.key !== key));
  }

  function resetForm() {
    setSaleDate(new Date().toISOString().split("T")[0]);
    setInvoiceNo("");
    setThrough("Direct");
    setPartyName("");
    setExecutiveName("");
    setEntry(emptyEntry());
    setAdded([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function handleCreate() {
    if (!invoiceNo.trim() || !partyName.trim() || added.length === 0) return;
    if (through === "Executive" && !executiveName.trim()) return;

    const row: SaleRow = {
      id: `store-sale-${Date.now()}`,
      date: formatDateInput(saleDate),
      invoiceNo: invoiceNo.trim(),
      through,
      partyName: partyName.trim(),
      withoutTax: totals.withoutTax,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      amount: totals.grandTotal,
      products: added,
    };

    const next = [row, ...rows];
    setRows(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}

    setShowCreate(false);
    resetForm();
  }

  const canCreate =
    !!invoiceNo.trim() &&
    !!partyName.trim() &&
    added.length > 0 &&
    (through === "Direct" || !!executiveName.trim());

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Invoice</h1>
          <p className="mt-1 text-slate-500">
            Direct and executive sales invoices.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <Icon name="add" size={18} />
          Create Sale
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th
                rowSpan={2}
                className="w-[6%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                S.No
              </th>
              <th
                rowSpan={2}
                className="w-[10%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Date
              </th>
              <th
                rowSpan={2}
                className="w-[14%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Invoice No
              </th>
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Through
              </th>
              <th
                rowSpan={2}
                className="w-[15%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Party Name
              </th>
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-2 py-3 text-right font-semibold"
              >
                Without Tax
              </th>
              <th
                colSpan={3}
                className="w-[21%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
              >
                Tax
              </th>
              <th
                rowSpan={2}
                className="w-[12%] px-2 py-3 text-right font-semibold"
              >
                Total
              </th>
            </tr>

            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th className="border-r border-slate-100 px-2 py-2 text-right font-semibold">
                SGST
              </th>
              <th className="border-r border-slate-100 px-2 py-2 text-right font-semibold">
                CGST
              </th>
              <th className="border-r border-slate-200 px-2 py-2 text-right font-semibold">
                IGST
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                onClick={() => setSelectedSale(r)}
                title="Click to view invoice"
                className={`cursor-pointer border-b border-slate-100 ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                } transition hover:bg-brand-50/30`}
              >
                <td className="px-2 py-3 text-center font-medium text-slate-500">
                  {i + 1}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-center text-slate-500">
                  {r.date}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                  {r.invoiceNo}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.through === "Direct"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {r.through}
                  </span>
                </td>
                <td className="truncate border-l border-slate-100 px-2 py-3 text-center text-slate-700">
                  {r.partyName}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-800">
                  {formatCurrency(r.withoutTax)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.sgst)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.cgst)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.igst)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                  {formatCurrency(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selectedSale &&
        createPortal(
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
            <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Sales Invoice</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">{selectedSale.invoiceNo}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Nature Biotic</h3>
                    <p className="mt-1 text-sm text-slate-500">Store Sales Invoice</p>
                    {store && (
                      <div className="mt-3 text-sm text-slate-600">
                        <p className="font-semibold text-slate-700">{store.name}</p>
                        <p>{store.address || store.location}</p>
                        {store.gst && <p>GSTIN: {store.gst}</p>}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:text-right">
                    <span className="text-slate-400">Invoice No</span>
                    <span className="font-semibold text-slate-800">{selectedSale.invoiceNo}</span>
                    <span className="text-slate-400">Date</span>
                    <span className="font-semibold text-slate-800">{selectedSale.date}</span>
                    <span className="text-slate-400">Sale Type</span>
                    <span className="font-semibold text-slate-800">{selectedSale.through}</span>
                    <span className="text-slate-400">Party Name</span>
                    <span className="font-semibold text-slate-800">{selectedSale.partyName}</span>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">Product Details</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="w-[5%] px-2 py-3 text-center">S.No</th>
                          <th className="w-[18%] px-2 py-3 text-left">Product</th>
                          <th className="w-[10%] px-2 py-3 text-center">Size</th>
                          <th className="w-[12%] px-2 py-3 text-left">Batch</th>
                          <th className="w-[12%] px-2 py-3 text-center">Expiry</th>
                          <th className="w-[8%] px-2 py-3 text-right">Qty</th>
                          <th className="w-[11%] px-2 py-3 text-right">Price</th>
                          <th className="w-[10%] px-2 py-3 text-right">Discount</th>
                          <th className="w-[14%] px-2 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.products.length > 0 ? (
                          selectedSale.products.map((item, index) => (
                            <tr key={item.key} className="border-t border-slate-100">
                              <td className="px-2 py-3 text-center">{index + 1}</td>
                              <td className="px-2 py-3 font-semibold text-slate-800">{item.product?.name || "Product"}</td>
                              <td className="px-2 py-3 text-center">{item.packSize || item.pkgsize}</td>
                              <td className="px-2 py-3">{item.batchNo || "-"}</td>
                              <td className="px-2 py-3 text-center">{item.expiryDate || "-"}</td>
                              <td className="px-2 py-3 text-right">{item.quantity}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.sellingPrice)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.discount)}</td>
                              <td className="px-2 py-3 text-right font-bold">{formatCurrency(item.rowTotal)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                              Product-level details are not available for this old sample invoice.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ml-auto w-full max-w-md rounded-xl bg-slate-50 p-5">
                  <SummaryRow label="Without Tax" value={formatCurrency(selectedSale.withoutTax)} />
                  <div className="mt-2"><SummaryRow label="SGST" value={formatCurrency(selectedSale.sgst)} /></div>
                  <div className="mt-2"><SummaryRow label="CGST" value={formatCurrency(selectedSale.cgst)} /></div>
                  <div className="mt-2"><SummaryRow label="IGST" value={formatCurrency(selectedSale.igst)} /></div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="font-bold text-slate-800">Grand Total</span>
                    <span className="text-xl font-bold text-brand-700">{formatCurrency(selectedSale.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setSelectedSale(null)}>Close</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Store Sale
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a new direct or executive sale.
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

              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Sale Information
                  </h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      label="Sale Date"
                      type="date"
                      value={saleDate}
                      onChange={setSaleDate}
                    />

                    <Input
                      label="Invoice Number"
                      value={invoiceNo}
                      onChange={setInvoiceNo}
                      placeholder="e.g. SAI-INV-0001"
                      required
                    />

                    <Select
                      label="Sale Type"
                      value={through}
                      onChange={(value) => setThrough(value as SaleType)}
                      options={[
                        { value: "Direct", label: "Direct" },
                        { value: "Executive", label: "Executive" },
                      ]}
                    />

                    <Input
                      label="Party Name"
                      value={partyName}
                      onChange={setPartyName}
                      placeholder="Enter farmer / party name"
                      required
                    />

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
                        required
                      />
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Add Product
                  </h4>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                      <Select
                        label="Select Product"
                        value={entry.productId}
                        onChange={selectProduct}
                        placeholder="Choose product"
                        options={allProducts.map((p) => ({
                          value: p.id,
                          label: `${p.name} (${p.size})`,
                        }))}
                      />

                      <Select
                        label="PKG Size"
                        value={entry.pkgsize}
                        onChange={(v) =>
                          setEntry((prev) => ({ ...prev, pkgsize: v }))
                        }
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
                        ]}
                      />

                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={(v) =>
                          setEntry((prev) => ({ ...prev, batchNo: v }))
                        }
                        placeholder="e.g. BAT-001"
                      />

                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={(v) =>
                          setEntry((prev) => ({ ...prev, expiryDate: v }))
                        }
                      />

                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            quantity: Number(v) || 0,
                          }))
                        }
                      />

                      <Input
                        label="Selling Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            sellingPrice: Number(v) || 0,
                          }))
                        }
                      />

                      <Input
                        label="Discount"
                        type="number"
                        value={String(entry.discount)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            discount: Number(v) || 0,
                          }))
                        }
                      />

                      <Button
                        onClick={addProduct}
                        className="h-[50px] w-full px-3"
                      >
                        <Icon name="add" size={18} />
                        Add Product
                      </Button>
                    </div>

                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-6">
                        <DetailField
                          label="Product"
                          value={entryProduct.name}
                        />
                        <DetailField
                          label="Pack Size"
                          value={entryProduct.size}
                        />
                        <DetailField
                          label="HSN / SAC"
                          value={entryProduct.hsnCode}
                        />
                        <DetailField
                          label="MRP"
                          value={formatCurrency(entryProduct.mrp)}
                        />
                        <DetailField
                          label="Tax %"
                          value={`${entryProduct.taxPercentage}%`}
                        />
                        <DetailField
                          label="Selling Price"
                          value={formatCurrency(entry.sellingPrice)}
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Added Products
                    </h4>
                    <span className="text-xs font-semibold text-slate-400">
                      {added.length} item(s)
                    </span>
                  </div>

                  {added.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                      <Icon
                        name="inventory_2"
                        size={32}
                        className="mx-auto text-slate-300"
                      />
                      <p className="mt-2 text-sm text-slate-400">
                        No products added yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                            <th className="w-[6%] px-2 py-3 text-center">
                              S.No
                            </th>
                            <th className="w-[15%] px-2 py-3 text-left">
                              Product
                            </th>
                            <th className="w-[11%] px-2 py-3 text-left">
                              Batch
                            </th>
                            <th className="w-[11%] px-2 py-3 text-center">
                              Expiry
                            </th>
                            <th className="w-[10%] px-2 py-3 text-center">
                              Size
                            </th>
                            <th className="w-[8%] px-2 py-3 text-right">
                              Qty
                            </th>
                            <th className="w-[11%] px-2 py-3 text-right">
                              Price
                            </th>
                            <th className="w-[10%] px-2 py-3 text-right">
                              Discount
                            </th>
                            <th className="w-[9%] px-2 py-3 text-right">
                              Tax
                            </th>
                            <th className="w-[9%] px-2 py-3 text-right">
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {added.map((r, i) => (
                            <tr
                              key={r.key}
                              className="border-b border-slate-100"
                            >
                              <td className="px-2 py-3 text-center">
                                {i + 1}
                              </td>
                              <td className="truncate px-2 py-3 font-semibold">
                                {r.product?.name}
                              </td>
                              <td className="px-2 py-3">{r.batchNo}</td>
                              <td className="px-2 py-3 text-center">
                                {r.expiryDate}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {r.packSize}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {r.quantity}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(r.sellingPrice)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(r.discount)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(r.taxAmount)}
                              </td>
                              <td className="px-2 py-3 text-right font-bold">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{formatCurrency(r.rowTotal)}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeAdded(r.key)}
                                    className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Icon name="delete" size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex justify-end">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h5 className="mb-3 text-sm font-bold text-slate-800">
                      Invoice Summary
                    </h5>

                    <div className="space-y-2 text-sm">
                      <SummaryRow
                        label="Without Tax"
                        value={formatCurrency(totals.withoutTax)}
                      />
                      <SummaryRow
                        label="SGST"
                        value={formatCurrency(totals.sgst)}
                      />
                      <SummaryRow
                        label="CGST"
                        value={formatCurrency(totals.cgst)}
                      />
                      <SummaryRow
                        label="IGST"
                        value={formatCurrency(totals.igst)}
                      />

                      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="font-bold text-slate-800">
                          Grand Total
                        </span>
                        <span className="text-lg font-bold text-brand-700">
                          {formatCurrency(totals.grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="check_circle" size={18} />
                  Create Sale
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="truncate text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-700">
        {value}
      </span>
    </div>
  );
}
