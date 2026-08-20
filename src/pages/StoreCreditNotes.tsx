import { useMemo, useState } from "react";
import { Card, Button, Input, Select, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { createPortal } from "react-dom";

type AddedProduct = {
  key: string;
  productId: string;
  productName: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
  reason: string;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
};

type CreditNote = {
  id: string;
  date: string;
  creditNoteNo: string;
  farmerName: string;
  amount: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  remarks: string;
  products: AddedProduct[];
};

const productNames = ["Electra", "Aalga", "Astra", "Alpha", "Neutra", "Rootra", "Ultra"];

const allProducts = productNames.map((name, i) => ({
  id: `p${i}`,
  name,
  size: "500ml",
  hsnCode: "3101",
  mrp: 250 + i * 50,
  taxPercentage: 18,
  sgst: 9,
  cgst: 9,
}));

const STORAGE_PREFIX = "nature-biotic-store-credit-notes";

function loadRows(key: string): CreditNote[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function StoreCreditNotes({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() =>
    loadRows(storageKey),
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<CreditNote | null>(null);

  const [returnDate, setReturnDate] = useState("");
  const [creditNoteNo, setCreditNoteNo] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [entry, setEntry] = useState({
    productId: "",
    pkgsize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 0,
    sellingPrice: 0,
    discount: 0,
    reason: "",
  });
  const [added, setAdded] = useState<AddedProduct[]>([]);

  const entryProduct = allProducts.find((p) => p.id === entry.productId);

  const totals = useMemo(
    () =>
      added.reduce(
        (acc, item) => ({
          subtotal: acc.subtotal + item.sellingPrice * item.quantity,
          discount:
            acc.discount +
            (item.sellingPrice * item.quantity * item.discount) / 100,
          taxable: acc.taxable + item.taxableAmount,
          sgst: acc.sgst + item.sgst,
          cgst: acc.cgst + item.cgst,
          igst: acc.igst + item.igst,
          grandTotal: acc.grandTotal + item.total,
        }),
        {
          subtotal: 0,
          discount: 0,
          taxable: 0,
          sgst: 0,
          cgst: 0,
          igst: 0,
          grandTotal: 0,
        },
      ),
    [added],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return creditNotes;
    return creditNotes.filter(
      (row) =>
        row.creditNoteNo.toLowerCase().includes(q) ||
        row.farmerName.toLowerCase().includes(q),
    );
  }, [creditNotes, search]);

  const canAdd =
    entry.productId &&
    entry.pkgsize &&
    entry.batchNo &&
    entry.expiryDate &&
    entry.quantity > 0 &&
    entry.sellingPrice > 0;

  const canCreate =
    returnDate && creditNoteNo.trim() && farmerName.trim() && added.length > 0;

  function selectProduct(productId: string) {
    const product = allProducts.find((p) => p.id === productId);
    setEntry((prev) => ({
      ...prev,
      productId,
      pkgsize: product?.size || prev.pkgsize,
      sellingPrice: product?.mrp || 0,
    }));
  }

  function computeLine(
    productId: string,
    quantity: number,
    sellingPrice: number,
    discount: number,
  ) {
    const product = allProducts.find((p) => p.id === productId);
    const gross = sellingPrice * quantity;
    const discountAmount = (gross * discount) / 100;
    const taxableAmount = gross - discountAmount;
    const sgst = (taxableAmount * (product?.sgst || 0)) / 100;
    const cgst = (taxableAmount * (product?.cgst || 0)) / 100;
    const igst = 0;

    return {
      taxableAmount,
      sgst,
      cgst,
      igst,
      total: taxableAmount + sgst + cgst + igst,
    };
  }

  function addProduct() {
    if (!canAdd) return;
    const product = allProducts.find((p) => p.id === entry.productId);
    if (!product) return;

    const computed = computeLine(
      entry.productId,
      entry.quantity,
      entry.sellingPrice,
      entry.discount,
    );

    setAdded((prev) => [
      ...prev,
      {
        key: `${entry.productId}-${Date.now()}-${Math.random()}`,
        productId: entry.productId,
        productName: product.name,
        pkgsize: entry.pkgsize,
        batchNo: entry.batchNo,
        expiryDate: entry.expiryDate,
        quantity: entry.quantity,
        sellingPrice: entry.sellingPrice,
        discount: entry.discount,
        reason: entry.reason,
        ...computed,
      },
    ]);

    setEntry({
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
  }

  function removeProduct(key: string) {
    setAdded((prev) => prev.filter((item) => item.key !== key));
  }

  function resetForm() {
    setReturnDate("");
    setCreditNoteNo("");
    setFarmerName("");
    setRemarks("");
    setAdded([]);
    setEntry({
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function createCreditNote() {
    if (!canCreate) return;

    const row: CreditNote = {
      id: `SCN-${Date.now()}`,
      date: returnDate,
      creditNoteNo: creditNoteNo.trim(),
      farmerName: farmerName.trim(),
      amount: totals.taxable,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      total: totals.grandTotal,
      remarks,
      products: added,
    };

    const next = [row, ...creditNotes];
    setCreditNotes(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}

    closeForm();
  }

  const DetailField = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Credit Notes
          </h1>
          <p className="mt-1 text-slate-500">
            Manage farmer returns and store credit note records.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={20} />
          Create Credit Note
        </Button>
      </div>

      <Card className="mb-5 p-4">
        <div className="max-w-md">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search by credit note or farmer..."
            icon="search"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="undo"
            title="No credit notes found"
            description="Create a new credit note for a farmer return."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <th rowSpan={2} className="w-[5%] border-r border-slate-200 px-1 py-3 text-center">
                  S.No
                </th>
                <th rowSpan={2} className="w-[8%] border-r border-slate-200 px-2 py-3 text-center">
                  Date
                </th>
                <th rowSpan={2} className="w-[13%] border-r border-slate-200 px-2 py-3 text-center">
                  CN No.
                </th>
                <th rowSpan={2} className="w-[19%] border-r border-slate-200 px-2 py-3 text-center">
                  Farmer Name
                </th>
                <th rowSpan={2} className="w-[13%] border-r border-slate-200 px-2 py-3 text-right">
                  Without Tax
                </th>
                <th colSpan={3} className="w-[27%] border-r border-slate-200 px-2 py-2 text-center">
                  Tax
                </th>
                <th rowSpan={2} className="w-[15%] px-2 py-3 text-right">
                  Total
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="border-r border-slate-200 px-2 py-2 text-right">SGST</th>
                <th className="border-r border-slate-200 px-2 py-2 text-right">CGST</th>
                <th className="border-r border-slate-200 px-2 py-2 text-right">IGST</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                  title="Click to view credit note"
                >
                  <td className="border-r border-slate-100 px-1 py-3 text-center">
                    {index + 1}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                    {formatDate(row.date)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">
                    {row.creditNoteNo}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.farmerName}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.sgst)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.cgst)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.igst)}
                  </td>
                  <td className="px-2 py-3 text-right font-bold">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Credit Note
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a credit note for products returned by a farmer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Input
                      label="Date"
                      type="date"
                      value={returnDate}
                      onChange={setReturnDate}
                      required
                    />

                    <Input
                      label="Credit Note Number"
                      placeholder="e.g. CN-2050"
                      value={creditNoteNo}
                      onChange={setCreditNoteNo}
                      required
                    />

                    <Input
                      label="Farmer Name"
                      placeholder="Enter farmer name"
                      value={farmerName}
                      onChange={setFarmerName}
                      required
                    />

                    <div className="md:col-span-3">
                      <Input
                        label="Remarks"
                        value={remarks}
                        onChange={setRemarks}
                        placeholder="Optional notes about this return"
                      />
                    </div>
                  </div>
                </div>

                <section>
                  <h4 className="mb-4 px-6 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Add Product
                  </h4>

                  <div className="mx-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                      <Select
                        label="Select Product"
                        value={entry.productId}
                        onChange={selectProduct}
                        placeholder="Select"
                        options={allProducts.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))}
                      />

                      <Select
                        label="PKG Size"
                        value={entry.pkgsize}
                        onChange={(v) => setEntry((p) => ({ ...p, pkgsize: v }))}
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

                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={(v) => setEntry((p) => ({ ...p, batchNo: v }))}
                        placeholder="BAT-001"
                      />

                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={(v) => setEntry((p) => ({ ...p, expiryDate: v }))}
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
                        label="Price"
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
                        label="Reason"
                        value={entry.reason}
                        onChange={(v) => setEntry((p) => ({ ...p, reason: v }))}
                        placeholder="Return reason"
                      />

                      <Button
                        onClick={addProduct}
                        disabled={!canAdd}
                        className="h-[50px] w-full"
                      >
                        <Icon name="add" size={18} />
                        Add Product
                      </Button>
                    </div>

                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-6">
                        <DetailField label="Product" value={entryProduct.name} />
                        <DetailField label="Pack Size" value={entryProduct.size} />
                        <DetailField label="HSN / SAC" value={entryProduct.hsnCode} />
                        <DetailField label="MRP" value={formatCurrency(entryProduct.mrp)} />
                        <DetailField label="Tax %" value={`${entryProduct.taxPercentage}%`} />
                        <DetailField label="SGST / CGST" value={`${entryProduct.sgst}% / ${entryProduct.cgst}%`} />
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-6">
                  <h4 className="mb-4 px-6 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Added Products ({added.length})
                  </h4>

                  {added.length === 0 ? (
                    <div className="mx-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      No products added yet.
                    </div>
                  ) : (
                    <div className="mx-6 overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                            <th className="w-[16%] px-2 py-3 text-left">Product</th>
                            <th className="w-[10%] px-2 py-3 text-center">Size</th>
                            <th className="w-[12%] px-2 py-3 text-center">Batch</th>
                            <th className="w-[8%] px-2 py-3 text-center">Qty</th>
                            <th className="w-[11%] px-2 py-3 text-right">Price</th>
                            <th className="w-[12%] px-2 py-3 text-right">Taxable</th>
                            <th className="w-[8%] px-2 py-3 text-right">SGST</th>
                            <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                            <th className="w-[10%] px-2 py-3 text-right">Total</th>
                            <th className="w-[5%] px-2 py-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {added.map((item) => (
                            <tr key={item.key} className="border-t border-slate-100">
                              <td className="px-2 py-3 font-semibold">{item.productName}</td>
                              <td className="px-2 py-3 text-center">{item.pkgsize}</td>
                              <td className="px-2 py-3 text-center">{item.batchNo}</td>
                              <td className="px-2 py-3 text-center">{item.quantity}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.sellingPrice)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.taxableAmount)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.sgst)}</td>
                              <td className="px-2 py-3 text-right">{formatCurrency(item.cgst)}</td>
                              <td className="px-2 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeProduct(item.key)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {added.length > 0 && (
                  <section className="mt-6 px-6 pb-6">
                    <div className="ml-auto max-w-sm space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <Summary label="Without Tax" value={totals.taxable} />
                      <Summary label="SGST" value={totals.sgst} />
                      <Summary label="CGST" value={totals.cgst} />
                      <Summary label="IGST" value={totals.igst} />
                      <div className="border-t border-slate-200 pt-2">
                        <Summary label="Grand Total" value={totals.grandTotal} bold />
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={createCreditNote} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Credit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    Credit Note
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selected.creditNoteNo}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Farmer: {selected.farmerName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Info label="Date" value={formatDate(selected.date)} />
                  <Info label="CN No." value={selected.creditNoteNo} />
                  <Info label="Farmer Name" value={selected.farmerName} />
                  <Info label="Total" value={formatCurrency(selected.total)} />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                        <th className="w-[5%] px-2 py-3 text-center">S.No</th>
                        <th className="w-[16%] px-2 py-3 text-left">Product</th>
                        <th className="w-[10%] px-2 py-3 text-center">Size</th>
                        <th className="w-[12%] px-2 py-3 text-center">Batch</th>
                        <th className="w-[8%] px-2 py-3 text-center">Qty</th>
                        <th className="w-[11%] px-2 py-3 text-right">Price</th>
                        <th className="w-[12%] px-2 py-3 text-right">Without Tax</th>
                        <th className="w-[8%] px-2 py-3 text-right">SGST</th>
                        <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                        <th className="w-[10%] px-2 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.products.map((item, index) => (
                        <tr key={item.key} className="border-t border-slate-100">
                          <td className="px-2 py-3 text-center">{index + 1}</td>
                          <td className="px-2 py-3">
                            <p className="font-semibold">{item.productName}</p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {item.reason || "-"}
                            </p>
                          </td>
                          <td className="px-2 py-3 text-center">{item.pkgsize}</td>
                          <td className="px-2 py-3 text-center">{item.batchNo}</td>
                          <td className="px-2 py-3 text-center">{item.quantity}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.sellingPrice)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.taxableAmount)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.sgst)}</td>
                          <td className="px-2 py-3 text-right">{formatCurrency(item.cgst)}</td>
                          <td className="px-2 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selected.remarks && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">Remarks</p>
                    <p className="mt-1 text-sm text-slate-700">{selected.remarks}</p>
                  </div>
                )}

                <div className="mt-5 ml-auto max-w-sm space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <Summary label="Without Tax" value={selected.amount} />
                  <Summary label="SGST" value={selected.sgst} />
                  <Summary label="CGST" value={selected.cgst} />
                  <Summary label="IGST" value={selected.igst} />
                  <div className="border-t border-slate-200 pt-2">
                    <Summary label="Grand Total" value={selected.total} bold />
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
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
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-bold text-slate-800" : "font-semibold text-slate-700"}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
