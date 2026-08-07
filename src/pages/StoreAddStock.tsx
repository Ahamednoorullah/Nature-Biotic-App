import { useState } from 'react';
import { getProductsByStore, warehouseList, productSizes } from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Button, Input, Select, Textarea, SectionTitle, Icon } from '@/components/ui';

type FormState = {
  product: string;
  warehouse: string;
  batchNumber: string;
  quantity: string;
  unit: string;
  supplier: string;
  purchaseDate: string;
  expiryDate: string;
  manufacturingDate: string;
  costPrice: string;
  remarks: string;
};

const emptyForm: FormState = {
  product: '', warehouse: '', batchNumber: '', quantity: '', unit: '', supplier: '',
  purchaseDate: '', expiryDate: '', manufacturingDate: '', costPrice: '', remarks: '',
};

export default function StoreAddStock({ storeId }: { storeId: string }) {
  const { goStorePage } = useNav();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState(false);
  const products = getProductsByStore(storeId);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => { setSaved(false); goStorePage('stock-management'); }, 1200);
  }

  function handleSaveAndAdd() {
    setSaved(true);
    setTimeout(() => { setSaved(false); setForm(emptyForm); }, 1200);
  }

  const isValid = form.product && form.warehouse && form.quantity && form.batchNumber;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => goStorePage('stock-management')} className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500">
          <Icon name="arrow_back" size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Add Stock</h1>
          <p className="text-slate-500 mt-1">Receive new stock into inventory with batch and supplier details.</p>
        </div>
      </div>

      {saved && (
        <div className="fixed top-20 right-6 z-50 animate-scale-in">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-elevated">
            <Icon name="check_circle" size={20} fill />
            <span className="text-sm font-semibold">Stock added successfully!</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* STOCK DETAILS */}
        <Card className="p-6">
          <SectionTitle icon="inventory_2" title="Stock Details" description="Select product and warehouse for this stock entry." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Product" value={form.product} onChange={(v) => update('product', v)} placeholder="Select product" required
              options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.size})` }))} />
            <Select label="Warehouse" value={form.warehouse} onChange={(v) => update('warehouse', v)} placeholder="Select warehouse" required
              options={warehouseList.map((w) => ({ value: w, label: w }))} />
            <Input label="Batch Number" value={form.batchNumber} onChange={(v) => update('batchNumber', v)} placeholder="e.g. BT-2026-001" icon="tag" required />
            <Input label="Quantity" type="number" value={form.quantity} onChange={(v) => update('quantity', v)} placeholder="e.g. 50" icon="numbers" required />
            <Select label="Unit" value={form.unit} onChange={(v) => update('unit', v)} placeholder="Select unit"
              options={productSizes.map((s) => ({ value: s, label: s }))} />
          </div>
        </Card>

        {/* SUPPLIER & DATES */}
        <Card className="p-6">
          <SectionTitle icon="local_shipping" title="Supplier & Dates" description="Supplier and manufacturing details for traceability." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Supplier" value={form.supplier} onChange={(v) => update('supplier', v)} placeholder="e.g. Nature Biotic Distribution" icon="local_shipping" />
            <Input label="Cost Price" type="number" value={form.costPrice} onChange={(v) => update('costPrice', v)} placeholder="e.g. 320" icon="currency_rupee" />
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={(v) => update('purchaseDate', v)} icon="event" />
            <Input label="Manufacturing Date" type="date" value={form.manufacturingDate} onChange={(v) => update('manufacturingDate', v)} icon="event_available" />
            <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={(v) => update('expiryDate', v)} icon="event_busy" />
          </div>
        </Card>

        {/* REMARKS */}
        <Card className="p-6">
          <SectionTitle icon="notes" title="Remarks" description="Additional notes for this stock entry." />
          <Textarea label="Remarks" value={form.remarks} onChange={(v) => update('remarks', v)} placeholder="Enter any additional remarks..." rows={3} />
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6">
          <Button variant="secondary" onClick={() => goStorePage('stock-management')} className="sm:mr-auto">
            <Icon name="close" size={18} /> Cancel
          </Button>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" onClick={handleSaveAndAdd} disabled={!isValid}>
              <Icon name="add" size={18} /> Save & Add More
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              <Icon name="save" size={18} /> Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
