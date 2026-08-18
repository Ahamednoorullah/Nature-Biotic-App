import { useState, useMemo } from 'react';
import { Card, Badge, Button, Input, Select, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  stores,
  addCompanyCreditNoteSyncRecords,
  getCompanyCreditNoteSyncRecords,
  type CompanyCreditNoteSyncRecord,
} from '@/lib/data';
import { createPortal } from 'react-dom';

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
  storeId?: string;
  product?: string;
  quantity?: number;
  reason?: string;
  status?: CreditNoteStatus;
};

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

const productNames = ['Electra', 'Aalga', 'Astra', 'Alpha', 'Neutra', 'Rootra', 'Ultra'];
const allProducts = productNames.map((name, i) => ({
  id: `p${i}`,
  name,
  size: '500ml',
  hsnCode: '3101',
  mrp: 250 + (i * 50),
  taxType: 'GST',
  taxPercentage: 18,
  sgst: 9,
  cgst: 9,
  imageColor: ['blue', 'green', 'red', 'amber', 'purple', 'pink', 'indigo'][i % 7]
}));
const parties = ['Murugan Farms', 'Sairam Agri Inputs', 'Selvam Agri Mart', 'Karthikeyan Estates', 'Green Harvest Agro'];
const reasons = ['Damaged Product', 'Expired Stock', 'Wrong Item Supplied', 'Quality Issue', 'Customer Return'];
const statuses: CreditNoteStatus[] = ['Approved', 'Pending', 'Rejected'];

const seedCreditNotes: CreditNote[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 3 + 1));

  const withoutTax = (1 + (i % 5)) * (300 + (i % 4) * 80);
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
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    const synced = getCompanyCreditNoteSyncRecords();

    const createdNotes: CreditNote[] = synced.map((row) => {
      const store = stores.find((item) => item.id === row.storeId);

      return {
        id: row.id,
        creditNoteNo: row.creditNoteNo,
        party: row.storeName,
        returnDate: row.returnDate,
        amount: row.returnAmount,
        sgst: 0,
        cgst: 0,
        igst: 0,
        total: row.returnAmount,
        storeLocation: store?.location || '',
        placeofreturn: store?.location?.split(',')[0] || '',
        storeId: row.storeId,
        product: row.product,
        quantity: row.quantity,
        reason: row.reason,
        status: row.status,
      };
    });

    return [...createdNotes, ...seedCreditNotes];
  });

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
    reason: '',
  });
  const [added, setAdded] = useState<AddedProduct[]>([]);

  const selectedStore = stores.find((s) => s.id === storeId);
  const entryProduct = allProducts.find((p) => p.id === entry.productId);

  const canAdd =
    entry.productId && entry.batchNo && entry.expiryDate && entry.quantity > 0 && entry.sellingPrice > 0;
  const canCreate = storeId && invoiceNo && returnDate && added.length > 0;

  // ---- Totals: calculated live from the added products list ----
  const totals = useMemo(() => {
    return added.reduce(
      (acc, item) => ({
        subtotal: acc.subtotal + item.sellingPrice * item.quantity,
        totalDiscount: acc.totalDiscount + (item.sellingPrice * item.quantity * item.discount) / 100,
        sgst: acc.sgst + item.sgst,
        cgst: acc.cgst + item.cgst,
        igst: acc.igst + item.igst,
        grandTotal: acc.grandTotal + item.total,
      }),
      { subtotal: 0, totalDiscount: 0, sgst: 0, cgst: 0, igst: 0, grandTotal: 0 },
    );
  }, [added]);

  function isTamilNaduSupply() {
    return placeOfSupply === 'Tamil Nadu';
  }

  function computeLine(productId: string, quantity: number, sellingPrice: number, discount: number) {
    const product = allProducts.find((p) => p.id === productId);
    const gross = sellingPrice * quantity;
    const discountAmt = (gross * discount) / 100;
    const taxableAmount = gross - discountAmt;

    const sgstAmt = isTamilNaduSupply() ? (taxableAmount * (product?.sgst ?? 0)) / 100 : 0;
    const cgstAmt = isTamilNaduSupply() ? (taxableAmount * (product?.cgst ?? 0)) / 100 : 0;
    const igstAmt = !isTamilNaduSupply() ? (taxableAmount * (product?.taxPercentage ?? 0)) / 100 : 0;

    return {
      taxableAmount,
      sgst: sgstAmt,
      cgst: cgstAmt,
      igst: igstAmt,
      total: taxableAmount + sgstAmt + cgstAmt + igstAmt,
    };
  }

  function selectProduct(productId: string) {
    const product = allProducts.find((p) => p.id === productId);
    setEntry((p) => ({
      ...p,
      productId,
      sellingPrice: product?.mrp ?? p.sellingPrice,
    }));
  }

  function addProduct() {
    if (!canAdd) return;
    const product = allProducts.find((p) => p.id === entry.productId);
    if (!product) return;

    const computed = computeLine(entry.productId, entry.quantity, entry.sellingPrice, entry.discount);

    const newItem: AddedProduct = {
      key: `${entry.productId}-${entry.batchNo}-${Date.now()}`,
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
    };

    setAdded((prev) => [...prev, newItem]);

    // reset entry row for the next product
    setEntry({
      productId: '',
      pkgsize: '',
      batchNo: '',
      expiryDate: '',
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: '',
    });
  }

  function updateAdded(key: string, updates: Partial<AddedProduct>) {
    setAdded((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const merged = { ...item, ...updates };
        const computed = computeLine(merged.productId, merged.quantity, merged.sellingPrice, merged.discount);
        return { ...merged, ...computed };
      }),
    );
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((item) => item.key !== key));
  }

  function resetForm() {
    setreturnDate('');
    setCreditno('');
    setStoreId('');
    setPlaceOfSupply('');
    setRemarks('');
    setEntry({
      productId: '',
      pkgsize: '',
      batchNo: '',
      expiryDate: '',
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: '',
    });
    setAdded([]);
  }

  function handleSaveDraft() {
    if (!storeId || !invoiceNo) return;
    // TODO: persist as a draft (status: 'Pending') via your API / store
    console.log('Saved as draft', { returnDate, invoiceNo, storeId, placeOfSupply, remarks, added, totals });
    closeForm();
  }

  function handleCreate() {
    if (!canCreate || !selectedStore) return;

    const createdAt = Date.now();

    // One synced debit-note row per product in this credit note.
    const syncRows: CompanyCreditNoteSyncRecord[] = added.map(
      (item, index) => ({
        id: `${invoiceNo}-${item.key}-${createdAt}-${index}`,
        creditNoteNo: invoiceNo,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        returnDate,
        purchaseRef: invoiceNo,
        product: item.productName,
        quantity: item.quantity,
        returnAmount: item.total,
        reason: item.reason || remarks || 'Product Return',
        status: 'Approved',
      }),
    );

    addCompanyCreditNoteSyncRecords(syncRows);

    // Also show the newly created credit note immediately in Company Credit Notes.
    const companyRows: CreditNote[] = added.map((item, index) => ({
      id: syncRows[index].id,
      creditNoteNo: invoiceNo,
      party: selectedStore.name,
      returnDate,
      amount: item.taxableAmount,
      sgst: item.sgst,
      cgst: item.cgst,
      igst: item.igst,
      total: item.total,
      storeLocation: selectedStore.location,
      placeofreturn: selectedStore.location?.split(',')[0] || '',
      storeId: selectedStore.id,
      product: item.productName,
      quantity: item.quantity,
      reason: item.reason || remarks || 'Product Return',
      status: 'Approved',
    }));

    setCreditNotes((prev) => [...companyRows, ...prev]);

    console.log('Created credit note', {
      returnDate,
      invoiceNo,
      storeId,
      placeOfSupply,
      remarks,
      added,
      totals,
    });

    closeForm();
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
    [search, creditNotes],
  );

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Credit Notes (Returns)</h1>
          <p className="text-slate-500 mt-1">Manage product returns and credit note records.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={20} fill />
          Create Credit Note
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
                  <th rowSpan={2} className="w-[6%] text-center font-semibold px-2 py-3 border-r border-slate-200">
                    S.No
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center font-semibold border-r border-slate-200">
                    Return Date
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center font-semibold border-r border-slate-200">
                    Credit Note No.
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center font-semibold border-r border-slate-200">
                    Store
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center font-semibold border-r border-slate-200">
                    Place of Return
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center font-semibold border-r border-slate-200">
                    Without Tax
                  </th>
                  <th colSpan={3} className="px-4 py-2 text-center font-semibold border-r border-slate-200">
                    Tax
                  </th>
                  <th rowSpan={2} className="px-4 py-3 text-center font-semibold border-r border-slate-200">
                    Total
                  </th>
                </tr>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2 text-center font-semibold border-r border-slate-200">SGST</th>
                  <th className="px-4 py-2 text-center font-semibold border-r border-slate-200">CGST</th>
                  <th className="px-4 py-2 text-center font-semibold border-r border-slate-200">IGST</th>
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
                    <td className="px-3 py-3 text-center text-slate-700 border-r border-slate-100">{c.party}</td>
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
                      {formatCurrency(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Creditnote — full-screen form, rendered via portal so it always sits above everything and scrolls properly */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Header (fixed, does not scroll) */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Create Credit Note</h2>
                  <p className="text-sm text-slate-500 mt-1">Create a new credit note for product returns.</p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable body (everything between header and footer) */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Basic details */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Return Date" type="date" value={returnDate} onChange={setreturnDate} required />

                    <Input
                      label="Credit Note Number"
                      placeholder="e.g. CN-2050"
                      value={invoiceNo}
                      onChange={setCreditno}
                      required
                    />

                    <Select
                      label="Select Store"
                      value={storeId}
                      onChange={(value) => {
                        setStoreId(value);
                        const store = stores.find((s) => s.id === value);
                        if (store?.location?.toLowerCase().includes('kerala')) {
                          setPlaceOfSupply('Others');
                        } else {
                          setPlaceOfSupply('Tamil Nadu');
                        }
                      }}
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
                        { value: 'Tamil Nadu', label: 'Tamil Nadu' },
                        { value: 'Others', label: 'Others' },
                      ]}
                    />

                    <Input
                      label="Store Address"
                      value={selectedStore?.address || ''}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />
                    <Input
                      label="GST Number"
                      value={selectedStore?.gst || ''}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />

                    <div className="md:col-span-2">
                      <Input
                        label="Remarks"
                        value={remarks}
                        onChange={setRemarks}
                        placeholder="Optional notes about this return"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Entry */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 px-6">Add Product</h4>

                  <div className="mx-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 items-end">
                      <Select
                        label="Select Product"
                        value={entry.productId}
                        onChange={selectProduct}
                        placeholder="Select"
                        options={allProducts.map((p) => ({ value: p.id, label: p.name }))}
                      />

                      <Select
                        label="PKG Size"
                        value={entry.pkgsize}
                        onChange={(v) => setEntry((p) => ({ ...p, pkgsize: v }))}
                        placeholder="Select size"
                        options={[
                          { value: '100ml', label: '100 ml' },
                          { value: '250ml', label: '250 ml' },
                          { value: '500ml', label: '500 ml' },
                          { value: '1l', label: '1 L' },
                          { value: '100g', label: '100 g' },
                          { value: '250g', label: '250 g' },
                          { value: '500g', label: '500 g' },
                          { value: '1kg', label: '1 Kg' },
                          { value: '5kg', label: '5 Kg' },
                          { value: '10kg', label: '10 Kg' },
                          { value: '25kg', label: '25 Kg' },
                        ]}
                      />

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
                        onChange={(v) => setEntry((p) => ({ ...p, expiryDate: v }))}
                        required
                      />

                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) => setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))}
                      />

                      <Input
                        label="Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={(v) => setEntry((p) => ({ ...p, sellingPrice: Number(v) || 0 }))}
                      />

                      <Input
                        label="Reason"
                        type="text"
                        value={entry.reason}
                        onChange={(v) => setEntry((p) => ({ ...p, reason: v }))}
                        placeholder="Enter reason"
                      />

                      <Button onClick={addProduct} disabled={!canAdd} className="w-full h-[50px] px-3">
                        <Icon name="add" size={18} />
                        <span className="whitespace-nowrap">Add Product</span>
                      </Button>
                    </div>

                    {/* Auto-loaded product details */}
                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-200">
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-2 -translate-y-1">
                          <div className="mt-1 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Icon name="image" size={20} className="text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-400 font-medium">Product Image</p>
                            <p className="text-xs font-semibold text-slate-700 truncate">{entryProduct.name}</p>
                          </div>
                        </div>

                        <DetailField label="Pack Size" value={entryProduct?.size || '-'} />
                        <DetailField label="HSN / SAC" value={entryProduct?.hsnCode || '-'} />
                        <DetailField label="MRP" value={formatCurrency(entryProduct?.mrp || 0)} />
                        <DetailField label="Tax Type" value={entryProduct?.taxType || '-'} />
                        <DetailField label="Tax %" value={`${entryProduct?.taxPercentage ?? 0}%`} />
                        <DetailField label="SGST" value={`${entryProduct?.sgst ?? 0}%`} />
                        <DetailField label="CGST" value={`${entryProduct?.cgst ?? 0}%`} />
                      </div>
                    )}
                  </div>
                </section>

                {/* Added Products list */}
                <section className="mt-6">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 px-6">
                    Added Products ({added.length})
                  </h4>

                  {added.length === 0 ? (
                    <div className="mx-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      No products added yet. Fill the form above and click "Add Product".
                    </div>
                  ) : (
                    <div className="mx-6 overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                            <th className="px-3 py-2 text-left font-semibold">Product</th>
                            <th className="px-3 py-2 text-left font-semibold">Batch</th>
                            <th className="px-3 py-2 text-center font-semibold">Qty</th>
                            <th className="px-3 py-2 text-center font-semibold">Price</th>
                            <th className="px-3 py-2 text-center font-semibold">Disc %</th>
                            <th className="px-3 py-2 text-center font-semibold">Taxable</th>
                            <th className="px-3 py-2 text-center font-semibold">SGST</th>
                            <th className="px-3 py-2 text-center font-semibold">CGST</th>
                            <th className="px-3 py-2 text-center font-semibold">IGST</th>
                            <th className="px-3 py-2 text-center font-semibold">Total</th>
                            <th className="px-3 py-2 text-center font-semibold"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {added.map((item) => (
                            <tr key={item.key} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-semibold text-slate-700">{item.productName}</td>
                              <td className="px-3 py-2 text-slate-500">{item.batchNo}</td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.quantity}
                                  onChange={(e) => updateAdded(item.key, { quantity: Number(e.target.value) || 0 })}
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-20 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.sellingPrice}
                                  onChange={(e) =>
                                    updateAdded(item.key, { sellingPrice: Number(e.target.value) || 0 })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.discount}
                                  onChange={(e) => updateAdded(item.key, { discount: Number(e.target.value) || 0 })}
                                />
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">
                                {formatCurrency(item.taxableAmount)}
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(item.sgst)}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(item.cgst)}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(item.igst)}</td>
                              <td className="px-3 py-2 text-center font-bold text-slate-700">
                                {formatCurrency(item.total)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeAdded(item.key)}
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

                {/* Summary */}
                {added.length > 0 && (
                  <section className="mt-6 px-6 pb-6">
                    <div className="ml-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
                      <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} muted />
                      <SummaryRow label="Discount" value={`- ${formatCurrency(totals.totalDiscount)}`} muted />
                      <SummaryRow label="SGST" value={formatCurrency(totals.sgst)} muted />
                      <SummaryRow label="CGST" value={formatCurrency(totals.cgst)} muted />
                      <SummaryRow label="IGST" value={formatCurrency(totals.igst)} muted />
                      <div className="border-t border-slate-200 pt-2">
                        <SummaryRow label="Grand Total" value={formatCurrency(totals.grandTotal)} />
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer (fixed, does not scroll) */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={!storeId || !invoiceNo}>
                  <Icon name="save" size={18} />
                  Save Draft
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Credit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
