import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { products as allProducts, getStore, type Product } from "@/lib/data";
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
  beforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
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
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName: string;
  beforeDiscount: number;
  discountAmount: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  items: ReturnItem[];
};

const STORAGE_KEY = "nature-biotic-store-sales-returns-v2";

type StoredSaleProduct = {
  key: string;
  productId: string;
  product?: Product;
  pkgsize?: string;
  packSize?: string;
  batchNo: string;
  expiryDate: string;
  hsn?: string;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  withoutTax: number;
  taxAmount: number;
  rowTotal: number;
};

type StoredSaleInvoice = {
  id: string;
  date: string;
  invoiceNo: string;
  through: SaleType;
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  products: StoredSaleProduct[];
};

const SALES_INVOICE_STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";


const seedRows: SalesReturnRow[] = [];

type ReturnEntry = {
  sourceKey: string;
  productId: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  price: number;
  reason: string;
};

function emptyItem(): ReturnEntry {
  return {
    sourceKey: "",
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
  const store = getStore(storeId);

  const saleInvoices = useMemo<StoredSaleInvoice[]>(() => {
    try {
      const raw = localStorage.getItem(
        `${SALES_INVOICE_STORAGE_KEY}:${storeId}`,
      );
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [storeId, showCreate]);

  const invoiceOptions = useMemo(
    () =>
      saleInvoices.map((invoice) => ({
        value: invoice.invoiceNo,
        label: `${invoice.invoiceNo} - ${invoice.partyName}`,
      })),
    [saleInvoices],
  );

  const [invoiceNo, setInvoiceNo] = useState("");
  const selectedInvoice = useMemo(
    () => saleInvoices.find((invoice) => invoice.invoiceNo === invoiceNo),
    [saleInvoices, invoiceNo],
  );

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnNo, setReturnNo] = useState("");
  const [through, setThrough] = useState<SaleType>("Direct");
  const [partyName, setPartyName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerVillage, setFarmerVillage] = useState("");
  const [farmerCrop, setFarmerCrop] = useState("");
  const [farmerAcre, setFarmerAcre] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");
  const [executiveName, setExecutiveName] = useState("");
  const [entry, setEntry] = useState(emptyItem());
  const [items, setItems] = useState<ReturnItem[]>([]);

  const selectedInvoiceItem = selectedInvoice?.products.find(
    (item) => item.key === entry.sourceKey,
  );
  const selectedProduct =
    selectedInvoiceItem?.product ||
    allProducts.find((p) => p.id === selectedInvoiceItem?.productId);

  const totals = useMemo(
    () => ({
      beforeDiscount: items.reduce(
        (sum, item) => sum + item.beforeDiscount,
        0,
      ),
      discountAmount: items.reduce(
        (sum, item) => sum + item.discountAmount,
        0,
      ),
      withoutTax: items.reduce(
        (sum, item) => sum + item.withoutTax,
        0,
      ),
      sgst: items.reduce((sum, item) => sum + item.sgst, 0),
      cgst: items.reduce((sum, item) => sum + item.cgst, 0),
      igst: items.reduce((sum, item) => sum + item.igst, 0),
      total: items.reduce((sum, item) => sum + item.total, 0),
    }),
    [items],
  );

  function selectInvoice(value: string) {
    setInvoiceNo(value);
    const invoice = saleInvoices.find((item) => item.invoiceNo === value);

    if (!invoice) {
      setThrough("Direct");
      setPartyName("");
      setFarmerPhone("");
      setFarmerVillage("");
      setFarmerCrop("");
      setFarmerAcre("");
      setPlaceOfSupply("Tamil Nadu");
      setExecutiveName("");
      setEntry(emptyItem());
      setItems([]);
      return;
    }

    setThrough(invoice.through);
    setPartyName(invoice.partyName || "");
    setFarmerPhone(invoice.farmerPhone || "");
    setFarmerVillage(invoice.farmerVillage || "");
    setFarmerCrop(invoice.farmerCrop || "");
    setFarmerAcre(invoice.farmerAcre || "");
    setPlaceOfSupply(invoice.placeOfSupply || "Tamil Nadu");
    setExecutiveName(
      invoice.through === "Executive"
        ? invoice.executiveName || ""
        : "",
    );
    setEntry(emptyItem());
    setItems([]);
  }

  function selectInvoiceProduct(sourceKey: string) {
    const item = selectedInvoice?.products.find(
      (product) => product.key === sourceKey,
    );

    if (!item) {
      setEntry(emptyItem());
      return;
    }

    setEntry((prev) => ({
      ...prev,
      sourceKey,
      productId: item.productId,
      packSize: item.pkgsize || item.packSize || item.product?.size || "",
      batchNo: item.batchNo || "",
      expiryDate: item.expiryDate || "",
      quantity: 1,
      price: Number(item.sellingPrice || 0),
      reason: "",
    }));
  }

  function addItem() {
    const original = selectedInvoiceItem;
    const product = selectedProduct;

    if (
      !selectedInvoice ||
      !original ||
      !product ||
      !entry.packSize ||
      !entry.batchNo ||
      !entry.expiryDate ||
      !entry.reason ||
      entry.quantity < 1
    ) {
      return;
    }

    const alreadyReturned = items
      .filter((item) => item.productId === original.productId && item.batchNo === original.batchNo)
      .reduce((sum, item) => sum + item.quantity, 0);

    const remainingQty = Number(original.quantity || 0) - alreadyReturned;
    if (entry.quantity > remainingQty) {
      window.alert(`Only ${remainingQty} quantity can be returned from this invoice line.`);
      return;
    }

    const beforeDiscount =
      Number(entry.quantity || 0) * Number(original.sellingPrice || 0);

    const originalBeforeDiscount =
      Number(original.quantity || 0) * Number(original.sellingPrice || 0);

    const originalDiscountPercent =
      originalBeforeDiscount > 0
        ? (Number(original.discount || 0) / originalBeforeDiscount) * 100
        : 0;

    const discountAmount =
      (beforeDiscount * originalDiscountPercent) / 100;

    const withoutTax = Math.max(
      0,
      beforeDiscount - discountAmount,
    );

    const taxPercent = Number(original.taxPercent || 0);
    const taxAmount = withoutTax * (taxPercent / 100);
    const intrastate =
      (selectedInvoice.placeOfSupply || "Tamil Nadu") === "Tamil Nadu";

    const sgst = intrastate ? taxAmount / 2 : 0;
    const cgst = intrastate ? taxAmount / 2 : 0;
    const igst = intrastate ? 0 : taxAmount;

    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        productId: original.productId,
        product,
        packSize:
          original.pkgsize ||
          original.packSize ||
          product.size ||
          "",
        batchNo: original.batchNo || "",
        expiryDate: original.expiryDate || "",
        quantity: entry.quantity,
        price: Number(original.sellingPrice || 0),
        beforeDiscount,
        discountPercent: originalDiscountPercent,
        discountAmount,
        taxPercent,
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
    setFarmerPhone("");
    setFarmerVillage("");
    setFarmerCrop("");
    setFarmerAcre("");
    setPlaceOfSupply("Tamil Nadu");
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
    !!selectedInvoice &&
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
      farmerPhone,
      farmerVillage,
      farmerCrop,
      farmerAcre,
      placeOfSupply,
      executiveName: through === "Executive" ? executiveName.trim() : "-",
      beforeDiscount: totals.beforeDiscount,
      discountAmount: totals.discountAmount,
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
                Farmer Name
              </th>
              <th rowSpan={2} className="w-[11%] border-r border-slate-200 px-2 py-3 text-right">
                Without Tax
              </th>
              <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center">
                SGST
              </th>
              <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center">
                CGST
              </th>
              <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center">
                IGST
              </th>
              <th rowSpan={2} className="w-[10%] px-2 py-3 text-right">
                Total
              </th>
            </tr>

            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="border-r border-slate-100 px-1 py-2 text-center">%</th>
              <th className="border-r border-slate-100 px-1 py-2 text-right">Amt</th>
              <th className="border-r border-slate-100 px-1 py-2 text-center">%</th>
              <th className="border-r border-slate-100 px-1 py-2 text-right">Amt</th>
              <th className="border-r border-slate-100 px-1 py-2 text-center">%</th>
              <th className="border-r border-slate-200 px-1 py-2 text-right">Amt</th>
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
                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  {row.sgst > 0 && row.withoutTax > 0
                    ? `${((row.sgst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right">{formatCurrency(row.sgst)}</td>
                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  {row.cgst > 0 && row.withoutTax > 0
                    ? `${((row.cgst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right">{formatCurrency(row.cgst)}</td>
                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  {row.igst > 0 && row.withoutTax > 0
                    ? `${((row.igst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right">{formatCurrency(row.igst)}</td>
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

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    <Input label="Return Date" type="date" value={date} onChange={setDate} required />
                    <Input label="Return No" value={returnNo} onChange={setReturnNo} placeholder="e.g. SR-0002" required />
                    <Select
                      label="Invoice No"
                      value={invoiceNo}
                      onChange={selectInvoice}
                      placeholder="Select original invoice"
                      options={invoiceOptions}
                    />
                    <Input label="Farmer Name" value={partyName} onChange={() => {}} readOnly />
                    <Input label="Mobile Number" value={farmerPhone} onChange={() => {}} readOnly />
                    <Input label="Village" value={farmerVillage} onChange={() => {}} readOnly />
                    <Input label="Through" value={through} onChange={() => {}} readOnly />
                    {through === "Executive" && (
                      <Input label="Executive" value={executiveName} onChange={() => {}} readOnly />
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
                        value={entry.sourceKey}
                        onChange={selectInvoiceProduct}
                        placeholder={selectedInvoice ? "Select invoice product" : "Select invoice first"}
                        options={(selectedInvoice?.products || []).map((item) => ({
                          value: item.key,
                          label: `${item.product?.name || "Product"} (${item.pkgsize || item.packSize || ""})`,
                        }))}
                      />
                      <Input label="Pack Size" value={entry.packSize} onChange={() => {}} readOnly />
                      <Input label="Batch No" value={entry.batchNo} onChange={() => {}} readOnly />
                      <Input label="Expiry Date" type="date" value={entry.expiryDate} onChange={() => {}} readOnly />
                      <Input
                        label="Return Qty"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) => setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))}
                      />
                      <Input label="Price" type="number" value={String(entry.price)} onChange={() => {}} readOnly />
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

                    {selectedProduct && selectedInvoiceItem && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 md:grid-cols-4 lg:grid-cols-7">
                        <Detail label="Product" value={selectedProduct.name} />
                        <Detail label="HSN / SAC" value={selectedProduct.hsnCode} />
                        <Detail label="Pack Size" value={entry.packSize} />
                        <Detail label="Sold Qty" value={String(selectedInvoiceItem.quantity)} />
                        <Detail
                          label="Discount %"
                          value={`${
                            selectedInvoiceItem.quantity * selectedInvoiceItem.sellingPrice > 0
                              ? (
                                  (Number(selectedInvoiceItem.discount || 0) /
                                    (selectedInvoiceItem.quantity * selectedInvoiceItem.sellingPrice)) *
                                  100
                                ).toFixed(2)
                              : "0.00"
                          }%`}
                        />
                        <Detail label="Tax %" value={`${selectedInvoiceItem.taxPercent || 0}%`} />
                        <Detail label="Selling Price" value={formatCurrency(entry.price)} />
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
                            <th className="px-2 py-3 text-center">Size</th>
                            <th className="px-2 py-3 text-center">Batch</th>
                            <th className="px-2 py-3 text-center">Expiry</th>
                            <th className="px-2 py-3 text-center">Qty</th>
                            <th className="px-2 py-3 text-right">Price</th>
                            <th className="px-2 py-3 text-right">Before Disc</th>
                            <th className="px-2 py-3 text-center">Disc %</th>
                            <th className="px-2 py-3 text-right">Disc Amt</th>
                            <th className="px-2 py-3 text-right">Taxable</th>
                            <th className="px-2 py-3 text-right">Tax</th>
                            <th className="px-2 py-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={item.key} className="border-b border-slate-100">
                              <td className="px-2 py-3 text-center">{index + 1}</td>
                              <td className="px-2 py-3 font-semibold">{item.product?.name}</td>
                              <td className="px-2 py-3 text-center">{item.packSize}</td>
                              <td className="px-2 py-3 text-center">{item.batchNo}</td>
                              <td className="px-2 py-3 text-center">{item.expiryDate}</td>
                              <td className="px-2 py-3 text-center">{item.quantity}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.price)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.beforeDiscount)}</td>
                              <td className="px-2 py-3 text-center">{item.discountPercent.toFixed(2)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.discountAmount)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.withoutTax)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.sgst + item.cgst + item.igst)}</td>
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
                    <Summary label="Total Before Discount" value={totals.beforeDiscount} />
                    <Summary label="Discount" value={totals.discountAmount} />
                    <Summary label="Taxable Total" value={totals.withoutTax} />
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
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 6mm; }
                body * { visibility: hidden !important; }
                .sales-return-print,
                .sales-return-print * { visibility: visible !important; }
                .sales-return-print {
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
                .sales-return-screen-only { display: none !important; }
              }
            `}</style>

            <div className="sales-return-print flex max-h-[94vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="sales-return-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Sales Return
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedReturn.returnNo}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Against Invoice: {selectedReturn.invoiceNo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>
                        <div className="leading-tight">
                          <h3 className="text-base font-extrabold tracking-wide text-slate-900">
                            {store?.name || "SAIRAM AGRI INPUT"}
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-700">
                            {store?.address || store?.location || "Rajapalayam, Tamil Nadu"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-600">
                            GSTIN: {store?.gst || "-"}
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Contact: {store?.phone || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center p-3">
                      <div className="text-center">
                        <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                          SALES RETURN
                        </h2>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Against Tax Invoice {selectedReturn.invoiceNo}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[9px] leading-4">
                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Farmer Details
                      </p>
                      <p className="font-bold text-slate-900">{selectedReturn.partyName}</p>
                      <p className="mt-1 text-slate-600">{selectedReturn.farmerVillage || "-"}</p>
                      <p className="text-slate-600">
                        Contact: {selectedReturn.farmerPhone || "-"}
                      </p>
                      <p className="text-slate-600">
                        Crop / Acre: {[selectedReturn.farmerCrop, selectedReturn.farmerAcre ? `${selectedReturn.farmerAcre} Acre` : ""].filter(Boolean).join(" / ") || "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Original Invoice
                      </p>
                      <p className="font-bold text-slate-900">{selectedReturn.invoiceNo}</p>
                      <p className="mt-1 text-slate-600">
                        Through: {selectedReturn.through}
                      </p>
                      {selectedReturn.through === "Executive" && (
                        <p className="text-slate-600">
                          Executive: {selectedReturn.executiveName || "-"}
                        </p>
                      )}
                      <p className="text-slate-600">
                        Place of Supply: {selectedReturn.placeOfSupply || "Tamil Nadu"}
                      </p>
                    </div>

                    <div className="p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Return Details
                      </p>
                      <div className="grid grid-cols-[92px_1fr] gap-y-1">
                        <span className="text-slate-500">Return No</span>
                        <span className="font-semibold text-slate-800">{selectedReturn.returnNo}</span>
                        <span className="text-slate-500">Return Date</span>
                        <span className="font-semibold text-slate-800">{dateDisplay(selectedReturn.date)}</span>
                        <span className="text-slate-500">Invoice No</span>
                        <span className="font-semibold text-slate-800">{selectedReturn.invoiceNo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-[8.5px] xl:text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-700">
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">S.No</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Product</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">HSN Code</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">PKG Size</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Batch No</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Exp Date</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Qty</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Unit Price</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Before Discount</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Discount</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Taxable (₹)</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">CGST</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">SGST</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">IGST</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Reason</th>
                          <th rowSpan={2} className="px-1 py-1.5 text-center">Line Total</th>
                        </tr>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-600">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amt</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Rate %</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amount</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Rate %</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amount</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Rate %</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedReturn.items.map((item, index) => {
                          const cgstRate =
                            item.cgst > 0 && item.withoutTax > 0
                              ? (item.cgst / item.withoutTax) * 100
                              : 0;
                          const sgstRate =
                            item.sgst > 0 && item.withoutTax > 0
                              ? (item.sgst / item.withoutTax) * 100
                              : 0;
                          const igstRate =
                            item.igst > 0 && item.withoutTax > 0
                              ? (item.igst / item.withoutTax) * 100
                              : 0;

                          return (
                            <tr key={item.key} className="border-b border-slate-300">
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">{index + 1}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 font-semibold">{item.product?.name || "-"}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.product?.hsnCode || "-"}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.packSize}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.batchNo}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.expiryDate}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.quantity}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.price)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.beforeDiscount)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{item.discountPercent.toFixed(2)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.discountAmount)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold">{formatCurrency(item.withoutTax)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{cgstRate.toFixed(2)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.cgst)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{sgstRate.toFixed(2)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.sgst)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{igstRate.toFixed(2)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.igst)}</td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-left">{item.reason}</td>
                              <td className="px-1 py-1.5 text-right font-bold">{formatCurrency(item.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Notes
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Sales return created against original tax invoice {selectedReturn.invoiceNo}. Original invoice price, discount and tax rates are retained for the returned quantity.
                      </p>
                    </div>

                    <div className="p-3 text-[10px]">
                      <div className="space-y-1.5">
                        <Summary label="Total Before Discount" value={selectedReturn.beforeDiscount || selectedReturn.items.reduce((sum, item) => sum + (item.beforeDiscount || 0), 0)} />
                        <Summary label="Discount" value={selectedReturn.discountAmount || selectedReturn.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)} />
                        <Summary label="Taxable Total" value={selectedReturn.withoutTax} />
                        <Summary label="CGST" value={selectedReturn.cgst} />
                        <Summary label="SGST" value={selectedReturn.sgst} />
                        <Summary label="IGST" value={selectedReturn.igst} />
                        <div className="mt-2 border-t border-slate-300 pt-2">
                          <Summary label="Total" value={selectedReturn.total} bold />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-300 p-5">
                    <div className="w-56 text-center">
                      <div className="h-12 border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sales-return-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
                <Button variant="secondary" onClick={() => setSelectedReturn(null)}>
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Sales Return
                </Button>
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
