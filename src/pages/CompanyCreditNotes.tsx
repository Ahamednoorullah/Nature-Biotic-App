import { useState, useMemo } from 'react';
import { Card, Badge, Button, Input, Select, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { stores } from '@/lib/data';

type CreditNoteStatus = 'Approved' | 'Pending' | 'Rejected';

type CreditNote = {
  id: string;
  creditNoteNo: string;
  party: string;
  returnDate: string;
  amount: number;     // Without Tax
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  storeLocation: string;
  placeofreturn: string;

};

const productNames = ['Electra', 'Aalga', 'Astra', 'Alpha', 'Neutra', 'Rootra', 'Ultra'];
const parties = ['Murugan Farms', 'Sairam Agri Inputs', 'Selvam Agri Mart', 'Karthikeyan Estates', 'Green Harvest Agro'];
const reasons = ['Damaged Product', 'Expired Stock', 'Wrong Item Supplied', 'Quality Issue', 'Customer Return'];
const statuses: CreditNoteStatus[] = ['Approved', 'Pending', 'Rejected'];

const creditNotes: CreditNote[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 3 + 1));

  const withoutTax =
    (1 + (i % 5)) * (300 + (i % 4) * 80);

  // Example: alternate between Tamil Nadu and Other State
  const isTamilNadu = i % 2 === 0;

  const cgst = isTamilNadu ? withoutTax * 0.09 : 0;
  const sgst = isTamilNadu ? withoutTax * 0.09 : 0;
  const igst = isTamilNadu ? 0 : withoutTax * 0.18;

  const total = withoutTax + cgst + sgst + igst;

  return {
    id: `cn${i}`,
    creditNoteNo: `CN-${String(2001 + i)}`,
    party: parties[i % parties.length],
    returnDate: d.toISOString().split('T')[0],
    amount: withoutTax,
    sgst,
    cgst,
    igst,
    total,
    storeLocation: stores[i % stores.length].location,
    placeofreturn: stores[i % stores.length].location?.split(',')[0] || '',
  };
});


const statusColor: Record<CreditNoteStatus, 'green' | 'amber' | 'red'> = {
  Approved: 'green',
  Pending: 'amber',
  Rejected: 'red',
};

export default function CompanyCreditNotes() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  
  // Form state
  const [returnDate, setreturnDate] = useState('');
  const [invoiceNo, setCreditno] = useState('');
  const [storeId, setStoreId] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [remarks, setRemarks] = useState('');
  const [entry, setEntry] = useState({
    productId: '',
    pkgsize: '',
    batchNo: '',
    expiryDate: '',
    quantity: 0,
    sellingPrice: 0,
    discount: 0,
  });
  const [added, setAdded] = useState<any[]>([]);

  const selectedStore = stores.find((s) => s.id === storeId);
  const entryProduct: any = null; // Placeholder - would need allProducts
  const allProducts: any[] = []; // Placeholder
  
  const canAdd = entry.productId && entry.batchNo && entry.expiryDate && entry.quantity > 0;
  const canCreate = storeId && invoiceNo && added.length > 0;
  
  const totals = {
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    sgst: 0,
    cgst: 0,
    igst: 0,
    grandTotal: 0,
  };

  function selectProduct(productId: string) {
    setEntry((p) => ({ ...p, productId }));
  }

  function addProduct() {
    // Implementation
  }

  function updateAdded(key: string, updates: any) {
    // Implementation
  }

  function removeAdded(key: string) {
    // Implementation
  }

  function handleSaveDraft() {
    // Implementation
  }

  function handleCreate() {
    // Implementation
  }

  const DetailField = ({ label, value }: any) => (
    <div>
      <p className="text-[11px] text-slate-400 font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );

  const SummaryRow = ({ label, value, muted }: any) => (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-slate-500' : 'text-slate-700'}>{label}</span>
      <span className={`font-semibold tabular-nums ${muted ? 'text-slate-500' : 'text-slate-800'}`}>{value}</span>
    </div>
  );

  const filtered = useMemo(
    () =>
      creditNotes.filter(
        (c) =>
          c.creditNoteNo.toLowerCase().includes(search.toLowerCase()) ||
          c.party.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  function closeForm() {
    setShowCreate(false);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Credit Notes (Returns)</h1>
          <p className="text-slate-500 mt-1">Manage product returns and credit note records.</p>
        </div>
        <Button>
          <Icon name="add" size={20} fill /> Create Credit Note
        </Button>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex-1 max-w-md">
          <Input value={search} onChange={setSearch} placeholder="Search by credit note, invoice, party..." icon="search" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="undo" title="No credit notes found" description="Adjust your search or create a new credit note." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">

                <th
                  rowSpan={2}
                  className="w-[6%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                >
                  S.No
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-semibold border-r border-slate-200"
                >
                  Return Date
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-semibold border-r border-slate-200"
                >
                  Credit Note No.
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-semibold border-r border-slate-200"
                >
                  Customer / Store
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-semibold border-r border-slate-200"
                >
                  Place of Return
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-semibold border-r border-slate-200"
                >
                  Without Tax
                </th>

                {/* Tax - Main Heading */}
                <th
                  colSpan={3}
                  className="px-4 py-2 text-center font-semibold border-r border-slate-200"
                >
                  Tax
                </th>

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-semibold border-r border-slate-200"
                >
                  Total
                </th>
              </tr>

              {/* Tax Sub Headings */}
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">

                <th className="px-4 py-2 text-center font-semibold border-r border-slate-200">
                  SGST
                </th>

                <th className="px-4 py-2 text-center font-semibold border-r border-slate-200">
                  CGST
                </th>

                <th className="px-4 py-2 text-center font-semibold border-r border-slate-200">
                  IGST
                </th>

              </tr>
            </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-base">

                    <td className="px-2 py-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                      {i + 1}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-500 border-r border-slate-100">
                      {formatDate(c.returnDate)}
                    </td>

                    <td className="px-3 py-3 text-center font-semibold text-slate-800 border-r border-slate-100">
                      {c.creditNoteNo}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-700 border-r border-slate-100">
                      {c.party}
                    </td>

                    <td className="px-2 py-3 text-center text-slate-600 border-r border-slate-100 truncate">
                      {c.placeofreturn}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.amount)}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.sgst)}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.cgst)}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.igst)}
                    </td>

                    <td className="px-3 py-3 text-center font-bold text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Invoice — full-screen form */}
      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-0">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={closeForm} />
          <div className="relative bg-white w-full sm:max-w-[1210px] shadow-elevated flex flex-col h-full sm:h-[90vh] animate-scale-in">
            {/* Fixed header */}
            <div className="flex items-start justify-between px-5 sm:px-8 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Create Product Return</h3>
                <p className="text-sm text-slate-500 mt-0.5">Create a new Nature Biotic sale for a registered store</p>
              </div>
              <button onClick={closeForm} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-base shrink-0">
                <Icon name="close" size={24} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-7">
              {/* Sale Information */}
              <section>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Sale Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Return Date" type="date" value={returnDate} onChange={setreturnDate} />
                  <Input label="Credit Note Number" value={invoiceNo} onChange={setCreditno} placeholder="e.g. NB-INV-2050" required />
                  <Select
                    label="Select Store"
                    value={storeId}
                    onChange={setStoreId}
                    placeholder="Choose a registered store"
                    options={stores.map((s) => ({ value: s.id, label: `${s.name} — ${s.location}` }))}
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
                  <Input label="Store Address" value={selectedStore?.address || ''} onChange={() => {}} placeholder="Auto-filled from store" readOnly />
                  <Input label="GST Number" value={selectedStore?.gst || ''} onChange={() => {}} placeholder="Auto-filled from store" readOnly />
                </div>
              </section>

              {/* Product Entry */}
              <section>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Add Product</h4>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  {/* Entry row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 items-end">
                    <div className="lg:col-span-1">
                      <Select
                        label="Select Product"
                        value={entry.productId}
                        onChange={selectProduct}
                        placeholder="Choose product"
                        options={allProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.size})` }))}
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

                    <Input label="Batch No" value={entry.batchNo} onChange={(v) => setEntry((p) => ({ ...p, batchNo: v }))} placeholder="e.g. BAT-001" required />
                    <Input label="Expiry Date" type="date" value={entry.expiryDate} onChange={(v) => setEntry((p) => ({ ...p, expiryDate: v }))} required />
                    <Input label="Quantity" type="number" value={String(entry.quantity)} onChange={(v) => setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))} />
                    <Input label="Return Price" type="number" value={String(entry.sellingPrice)} onChange={(v) => setEntry((p) => ({ ...p, sellingPrice: Number(v) || 0 }))} />
                    <Input label="Discount" type="number" value={String(entry.discount)} onChange={(v) => setEntry((p) => ({ ...p, discount: Number(v) || 0 }))} />
                    <Button onClick={addProduct} disabled={!canAdd} className="w-full h-[50px] px-3">
                      <Icon name="add" size={18} /> <span className="whitespace-nowrap">Add Product</span>
                    </Button>
                  </div>

                  {/* Auto-loaded product details */}
                  {entryProduct && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-200">
                    
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Icon name="image" size={20} className="text-slate-600" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400 font-medium">
                          Product
                        </p>
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {entryProduct.name}
                        </p>
                      </div>
                    </div>

                    <DetailField
                      label="Pack Size"
                      value={entryProduct.size || '-'}
                    />

                    <DetailField
                      label="HSN / SAC"
                      value={entryProduct.hsnCode || '-'}
                    />

                    <DetailField
                      label="MRP"
                      value={formatCurrency(entryProduct.mrp || 0)}
                    />

                    <DetailField
                      label="Tax Type"
                      value={entryProduct.taxType || '-'}
                    />

                    <DetailField
                      label="Tax %"
                      value={`${entryProduct.taxPercentage ?? 0}%`}
                    />

                    <DetailField
                      label="SGST"
                      value={`${entryProduct.sgst ?? 0}%`}
                    />

                    <DetailField
                      label="CGST"
                      value={`${entryProduct.cgst ?? 0}%`}
                    />

                  </div>
                )}
              </section>

              {/* Added Products Table */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Added Products</h4>
                  <span className="text-xs font-semibold text-slate-400">{added.length} item(s)</span>
                </div>
                {added.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                    <Icon name="inventory_2" size={32} className="text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-400 mt-2">No products added yet. Use the row above to add products.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-sm min-w-[1100px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="text-left font-semibold px-3 py-2.5">S.No</th>
                          <th className="text-left font-semibold px-3 py-2.5">Product</th>
                          <th className="text-left font-semibold px-3 py-2.5">Batch No</th>
                          <th className="text-left font-semibold px-3 py-2.5">Expiry Date</th>
                          <th className="text-left font-semibold px-3 py-2.5">Pack Size</th>
                          <th className="text-left font-semibold px-3 py-2.5">HSN / SAC</th>
                          <th className="text-right font-semibold px-3 py-2.5">Quantity</th>
                          <th className="text-right font-semibold px-3 py-2.5">Selling Price</th>
                          <th className="text-right font-semibold px-3 py-2.5">Discount</th>
                          <th className="text-right font-semibold px-3 py-2.5">Tax</th>
                          <th className="text-right font-semibold px-3 py-2.5">Row Total</th>
                          <th className="text-center font-semibold px-3 py-2.5">Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {added.map((r, i) => (
                          <tr key={r.key} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-brand-50/30 transition-base`}>
                            <td className="px-3 py-2.5 text-slate-500 font-medium">{i + 1}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{r.product?.name}</td>
                            <td className="px-3 py-2.5 text-slate-600">{r.batchNo}</td>
                            <td className="px-3 py-2.5 text-slate-600">{formatDate(r.expiryDate)}</td>
                            <td className="px-3 py-2.5 text-slate-600">{r.packSize}</td>
                            <td className="px-3 py-2.5 text-slate-600">{r.hsn}</td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={r.quantity}
                                onChange={(e) => updateAdded(r.key, { quantity: Number(e.target.value) || 0 })}
                                className="w-16 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={r.sellingPrice}
                                onChange={(e) => updateAdded(r.key, { sellingPrice: Number(e.target.value) || 0 })}
                                className="w-24 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={r.discount}
                                onChange={(e) => updateAdded(r.key, { discount: Number(e.target.value) || 0 })}
                                className="w-20 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(r.taxAmount)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">{formatCurrency(r.rowTotal)}</td>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus resize-none"
                  />
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 lg:self-start">
                  <h5 className="text-sm font-bold text-slate-800 mb-3">Return Summary </h5>
                  <div className="space-y-2 text-sm">
                    <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
                    <SummaryRow label="Total Discount" value={formatCurrency(totals.totalDiscount)} />
                    <SummaryRow label="Total Tax" value={formatCurrency(totals.totalTax)} />
                    <div className="pl-4 space-y-1.5 pt-1">
                      <SummaryRow label="SGST" value={formatCurrency(totals.sgst)} muted />
                      <SummaryRow label="CGST" value={formatCurrency(totals.cgst)} muted />
                      <SummaryRow label="IGST" value={formatCurrency(totals.igst)} muted />
                    </div>
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-800">Grand Total</span>
                      <span className="text-lg font-bold text-brand-700">{formatCurrency(totals.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </section>
              {/* ACTION BUTTONS — immediately after Grand Total */}
                    <div className="relative -top-4 flex flex-col sm:flex-row gap-3 justify-end">
                      <Button
                        variant="secondary"
                        onClick={closeForm}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={handleSaveDraft}
                        className="w-full sm:w-auto"
                      >
                        Save Draft
                      </Button>
                
                      <Button
                        onClick={handleCreate}
                        disabled={!canCreate}
                        className="w-full sm:w-auto"
                      >
                        <Icon name="check_circle" size={18} />
                        Create Return
                      </Button>
                    </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
