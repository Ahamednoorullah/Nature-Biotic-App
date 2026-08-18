import { useState, useMemo, useEffect } from "react";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  EmptyState,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { stores, products as allProducts, type Product } from "@/lib/data";
import { createPortal } from "react-dom";

import {
  getCompanyStoreSales,
  saveCompanyStoreSales,
  type CompanyStoreSaleRecord,
} from "@/lib/data";

type TaxType = "Tamilnadu (SGST + CGST)" | "Others (IGST)";

type SaleRow = CompanyStoreSaleRecord;

type AddedRow = {
  key: string;
  productId: string;
  pkgsize: string;
  product?: Product;
  batchNo: string;
  expiryDate: string;
  packSize: string;
  hsn: string;
  mrp: number;
  taxType: TaxType;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  taxAmount: number;
  rowTotal: number;
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

const taxTypes: TaxType[] = ["Tamilnadu (SGST + CGST)", "Others (IGST)"];

function computeAdded(
  r: Omit<AddedRow, "key" | "taxAmount" | "rowTotal">,
): AddedRow {
  const gross = r.quantity * r.sellingPrice;
  const afterDiscount = Math.max(0, gross - r.discount);
  const taxAmount =
    Math.round(afterDiscount * (r.taxPercent / 100) * 100) / 100;
  const rowTotal = Math.round((afterDiscount + taxAmount) * 100) / 100;
  return {
    ...r,
    key: Math.random().toString(36).slice(2),
    taxAmount,
    rowTotal,
  };
}

function emptyEntry(): EntryForm {
  return {
    productId: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    sellingPrice: 0,
    discount: 0,
    pkgsize: "",
  };
}

export default function CompanySales() {
  const [sales, setSales] = useState<SaleRow[]>(() => getCompanyStoreSales());
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [storeId, setStoreId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [added, setAdded] = useState<AddedRow[]>([]);
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");

  const selectedStore = stores.find((s) => s.id === storeId);
  const entryProduct = allProducts.find((p) => p.id === entry.productId);

  // Lock background scroll while the form is open
  useEffect(() => {
    if (showCreate) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showCreate]);

  const filtered = useMemo(
    () =>
      sales.filter((s) => {
        const ms =
          s.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
          s.storeName.toLowerCase().includes(search.toLowerCase()) ||
          s.product.toLowerCase().includes(search.toLowerCase());
        const mt = storeFilter === "all" || s.storeId === storeFilter;
        return ms && mt;
      }),
    [sales, search, storeFilter],
  );

  const totals = useMemo(() => {
    const subtotal = added.reduce((s, r) => s + r.quantity * r.sellingPrice, 0);
    const totalDiscount = added.reduce((s, r) => s + r.discount, 0);
    const totalTax = added.reduce((s, r) => s + r.taxAmount, 0);
    const sgst = added.reduce(
      (s, r) =>
        s + (r.taxType === "Tamilnadu (SGST + CGST)" ? r.taxAmount / 2 : 0),
      0,
    );
    const cgst = added.reduce(
      (s, r) =>
        s + (r.taxType === "Tamilnadu (SGST + CGST)" ? r.taxAmount / 2 : 0),
      0,
    );
    const igst = added.reduce(
      (s, r) => s + (r.taxType === "Others (IGST)" ? r.taxAmount : 0),
      0,
    );
    const grandTotal = added.reduce((s, r) => s + r.rowTotal, 0);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [added]);

  function selectProduct(productId: string) {
    const product = allProducts.find((p) => p.id === productId);
    setEntry((prev) => ({
      ...prev,
      productId,
      pkgsize: product?.size || prev.pkgsize,
      sellingPrice: product ? product.sellingPrice : 0,
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

    // Place of Supply decides the tax type
    const taxType: TaxType =
      placeOfSupply === "Tamil Nadu"
        ? "Tamilnadu (SGST + CGST)"
        : "Others (IGST)";

    const newRow = computeAdded({
      productId: entry.productId,
      product,
      pkgsize: entry.pkgsize,
      batchNo: entry.batchNo,
      expiryDate: entry.expiryDate,
      packSize: product.size,
      hsn: product.hsnCode || "",
      mrp: product.mrp || 0,
      taxType,
      taxPercent: product.taxPercentage || 0,
      quantity: entry.quantity,
      sellingPrice: entry.sellingPrice,
      discount: entry.discount,
    });

    setAdded((prev) => [...prev, newRow]);
    setEntry(emptyEntry());
  }

  function updateAdded(key: string, patch: Partial<AddedRow>) {
    setAdded((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const merged = { ...r, ...patch };
        return computeAdded(merged);
      }),
    );
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((r) => r.key !== key));
  }

  function resetForm() {
    setInvoiceNo("");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setStoreId("");
    setRemarks("");
    setEntry(emptyEntry());
    setAdded([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function handleSaveDraft() {
    // Draft save: keep form open, no-op persistence in this demo
  }

  function handleCreate() {
    if (!storeId || !invoiceNo || added.length === 0) return;

    const store = stores.find((s) => s.id === storeId);

    if (!store) return;

    const newRows: SaleRow[] = added.map((r, i) => {
      const withoutTax = Math.max(0, r.quantity * r.sellingPrice - r.discount);

      const taxAmount =
        Math.round(withoutTax * (r.taxPercent / 100) * 100) / 100;

      const isTamilNadu = placeOfSupply === "Tamil Nadu";

      const sgst = isTamilNadu ? Math.round((taxAmount / 2) * 100) / 100 : 0;

      const cgst = isTamilNadu ? Math.round((taxAmount / 2) * 100) / 100 : 0;

      const igst = !isTamilNadu ? taxAmount : 0;

      return {
        id: `s${sales.length + i}`,
        invoiceNo,
        date: saleDate,
        storeId: store.id,
        storeName: store.name,
        storeLocation: store.location,

        placeOfSupply,

        product: r.product?.name || "",
        packSize: r.packSize,
        quantity: r.quantity,
        rate: r.sellingPrice,

        withoutTax,
        taxAmount,

        sgst,
        cgst,
        igst,

        total: Math.round((withoutTax + taxAmount) * 100) / 100,
      };
    });

    const nextSales = [...newRows, ...sales];
    setSales(nextSales);
    saveCompanyStoreSales(nextSales);

    resetForm();
    setShowCreate(false);
  }

  const canAdd =
    !!entry.productId &&
    !!entry.pkgsize &&
    !!entry.batchNo &&
    !!entry.expiryDate &&
    entry.quantity >= 1;
  const canCreate = !!storeId && !!invoiceNo && added.length > 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Sales
          </h1>
          <p className="text-slate-500 mt-1">
            Nature Biotic to Store sales records.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <Icon name="add" size={20} fill /> Create Invoice
        </Button>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by invoice, store, product..."
              icon="search"
            />
          </div>
          <div className="w-full sm:w-60">
            <Select
              value={storeFilter}
              onChange={setStoreFilter}
              placeholder="All Stores"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="point_of_sale"
            title="No sales found"
            description="Adjust filters or create a new sale."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-y-auto max-h-[600px]">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th
                    rowSpan={2}
                    className="w-[6%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    S.No
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[10%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Date
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[13%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Invoice No
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[17%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Party Name
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[13%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Place of Supply
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[10%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Without Tax
                  </th>
                  <th
                    colSpan={3}
                    className="w-[21%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Tax
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[10%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Total
                  </th>
                </tr>

                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="text-center font-semibold px-2 py-2 border-r border-slate-100">
                    SGST
                  </th>

                  <th className="text-center font-semibold px-2 py-2 border-r border-slate-100">
                    CGST
                  </th>

                  <th className="text-center font-semibold px-2 py-2 border-r border-slate-200">
                    IGST
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-100 ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    } hover:bg-brand-50/40 transition-base`}
                  >
                    <td className="px-2 py-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                      {i + 1}
                    </td>

                    <td className="px-2 py-3 text-center text-slate-500 border-r border-slate-100 whitespace-nowrap">
                      {formatDate(s.date)}
                    </td>

                    <td className="px-2 py-3 text-center font-semibold text-slate-800 border-r border-slate-100 truncate">
                      {s.invoiceNo}
                    </td>

                    <td className="px-2 py-3 text-center text-slate-700 border-r border-slate-100 truncate">
                      {s.storeName}
                    </td>

                    <td className="px-2 py-3 text-center text-slate-600 border-r border-slate-100 truncate">
                      {s.placeOfSupply || "-"}
                    </td>

                    <td className="px-2 py-3 text-right tabular-nums font-semibold text-slate-700 border-r border-slate-100">
                      {formatCurrency(s.withoutTax)}
                    </td>

                    <td className="px-2 py-3 text-right tabular-nums text-slate-600 border-r border-slate-100">
                      {formatCurrency(s.sgst)}
                    </td>

                    <td className="px-2 py-3 text-right tabular-nums text-slate-600 border-r border-slate-100">
                      {formatCurrency(s.cgst)}
                    </td>

                    <td className="px-2 py-3 text-right tabular-nums text-slate-600 border-r border-slate-100">
                      {formatCurrency(s.igst)}
                    </td>

                    <td className="px-2 py-3 text-right tabular-nums font-bold text-slate-800 border-r border-slate-100">
                      {formatCurrency(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Store Sale — same popup shell as Credit Note (portal + fixed header/footer + scroll body) */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Fixed header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Store Sale
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Create a new Nature Biotic sale for a registered store
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
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-7">
                {/* Sale Information */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Sale Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      placeholder="e.g. NB-INV-2050"
                      required
                    />
                    <Select
                      label="Select Store"
                      value={storeId}
                      onChange={setStoreId}
                      placeholder="Choose a registered store"
                      options={stores.map((s) => ({
                        value: s.id,
                        label: `${s.name} — ${s.location}`,
                      }))}
                      required
                    />
                    <Select
                      label="Place of Supply"
                      value={placeOfSupply}
                      onChange={setPlaceOfSupply}
                      options={[
                        { value: "Tamil Nadu", label: "Tamil Nadu" },
                        { value: "Others", label: "Others" },
                      ]}
                    />
                    <Input
                      label="Store Address"
                      value={selectedStore?.address || ""}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />
                    <Input
                      label="GST Number"
                      value={selectedStore?.gst || ""}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />
                  </div>
                </section>

                {/* Product Entry */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Add Product
                  </h4>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    {/* Entry row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 items-end">
                      <div className="lg:col-span-1">
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
                      </div>

                      {/* PKG Size */}
                      <div>
                        <Select
                          label="PKG Size"
                          value={entry.pkgsize}
                          onChange={(v) =>
                            setEntry((p) => ({
                              ...p,
                              pkgsize: v,
                            }))
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
                            { value: "10kg", label: "10 Kg" },
                            { value: "25kg", label: "25 Kg" },
                          ]}
                        />
                      </div>

                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={(v) => setEntry((p) => ({ ...p, batchNo: v }))}
                        placeholder="e.g. BAT-001"
                        required
                      />
                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, expiryDate: v }))
                        }
                        required
                      />
                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))
                        }
                      />
                      <Input
                        label="Selling Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={(v) =>
                          setEntry((p) => ({
                            ...p,
                            sellingPrice: Number(v) || 0,
                          }))
                        }
                      />
                      <Input
                        label="Discount"
                        type="number"
                        value={String(entry.discount)}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, discount: Number(v) || 0 }))
                        }
                      />
                      <Button
                        onClick={addProduct}
                        disabled={!canAdd}
                        className="w-full h-[50px] px-3"
                      >
                        <Icon name="add" size={18} />{" "}
                        <span className="whitespace-nowrap">Add Product</span>
                      </Button>
                    </div>

                    {/* Auto-loaded product details */}
                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-200">
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                          <div
                            className={`w-10 h-10 rounded-lg bg-${entryProduct.imageColor}-100 flex items-center justify-center shrink-0`}
                          >
                            <Icon
                              name="image"
                              size={20}
                              className={`text-${entryProduct.imageColor}-600`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-400 font-medium">
                              Product Image
                            </p>
                            <p className="text-xs font-semibold text-slate-700 truncate">
                              {entryProduct.name}
                            </p>
                          </div>
                        </div>
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
                          label="Tax Type"
                          value={entryProduct.taxType}
                        />
                        <DetailField
                          label="Tax %"
                          value={`${entryProduct.taxPercentage}%`}
                        />
                        <DetailField
                          label="SGST"
                          value={`${entryProduct.sgst}%`}
                        />
                        <DetailField
                          label="CGST"
                          value={`${entryProduct.cgst}%`}
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Added Products Table */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
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
                        className="text-slate-300 mx-auto"
                      />
                      <p className="text-sm text-slate-400 mt-2">
                        No products added yet. Use the row above to add products.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-sm min-w-[1100px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                            <th className="text-left font-semibold px-3 py-2.5">
                              S.No
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Product
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Batch No
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Expiry Date
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Pack Size
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              HSN / SAC
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Quantity
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Selling Price
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Discount
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Tax
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Row Total
                            </th>
                            <th className="text-center font-semibold px-3 py-2.5">
                              Remove
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {added.map((r, i) => (
                            <tr
                              key={r.key}
                              className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-brand-50/30 transition-base`}
                            >
                              <td className="px-3 py-2.5 text-slate-500 font-medium">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-800">
                                {r.product?.name}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {r.batchNo}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatDate(r.expiryDate)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {r.packSize}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {r.hsn}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={r.quantity}
                                  onChange={(e) =>
                                    updateAdded(r.key, {
                                      quantity: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={r.sellingPrice}
                                  onChange={(e) =>
                                    updateAdded(r.key, {
                                      sellingPrice: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-24 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={r.discount}
                                  onChange={(e) =>
                                    updateAdded(r.key, {
                                      discount: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                                {formatCurrency(r.taxAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">
                                {formatCurrency(r.rowTotal)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => removeAdded(r.key)}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-base"
                                  title="Remove"
                                >
                                  <Icon name="delete" size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Totals + Remarks */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional notes"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus resize-none"
                    />
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 lg:self-start">
                    <h5 className="text-sm font-bold text-slate-800 mb-3">
                      Invoice Summary
                    </h5>
                    <div className="space-y-2 text-sm">
                      <SummaryRow
                        label="Subtotal"
                        value={formatCurrency(totals.subtotal)}
                      />
                      <SummaryRow
                        label="Total Discount"
                        value={formatCurrency(totals.totalDiscount)}
                      />
                      <SummaryRow
                        label="Total Tax"
                        value={formatCurrency(totals.totalTax)}
                      />
                      <div className="pl-4 space-y-1.5 pt-1">
                        <SummaryRow
                          label="SGST"
                          value={formatCurrency(totals.sgst)}
                          muted
                        />
                        <SummaryRow
                          label="CGST"
                          value={formatCurrency(totals.cgst)}
                          muted
                        />
                        <SummaryRow
                          label="IGST"
                          value={formatCurrency(totals.igst)}
                          muted
                        />
                      </div>
                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200">
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

              {/* Fixed footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft}>
                  Save Draft
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="check_circle" size={18} />
                  Create Invoice
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
      <p className="text-[11px] text-slate-400 font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700 truncate">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-400 text-xs" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${muted ? "text-slate-500 text-xs" : "font-semibold text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}

