import { useState } from 'react';
import { productSizes, productTypes, type TaxType } from '@/lib/data';
import { Card, Button, Input, Select, Textarea, SectionTitle, Icon } from '@/components/ui';

type FormState = {
  name: string;
  productType: string;
  manufacturer: string;
  vendor: string;
  unit: string;
  size: string;
  hsnCode: string;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  taxType: string;
  taxPercentage: string;
  sgst: string;
  cgst: string;
  igst: string;
  description: string;
  usageInstructions: string;
  safetyInfo: string;
  storageInfo: string;
  status: string;
};

const emptyForm: FormState = {
  name: '',
  productType: '',
  manufacturer: 'Nature Biotic Pvt. Ltd.',
  vendor: 'Nature Biotic Distribution',
  unit: '',
  size: '',
  hsnCode: '',
  purchasePrice: '',
  sellingPrice: '',
  mrp: '',
  taxType: '',
  taxPercentage: '',
  sgst: '',
  cgst: '',
  igst: '',
  description: '',
  usageInstructions: '',
  safetyInfo: '',
  storageInfo: '',
  status: 'Active',
};

export default function ProductAddForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  function handleTaxTypeChange(value: string) {
    const taxType = value as TaxType;
    if (taxType === 'Intrastate') {
      const pct = Number(form.taxPercentage) || 0;
      setForm({ ...form, taxType, taxPercentage: form.taxPercentage, sgst: String(pct / 2), cgst: String(pct / 2), igst: '0' } as FormState);
    } else if (taxType === 'Interstate') {
      setForm({ ...form, taxType, taxPercentage: form.taxPercentage, sgst: '0', cgst: '0', igst: form.taxPercentage || '0' } as FormState);
    } else {
      setForm({ ...form, taxType });
    }
  }

  function handleTaxPercentageChange(value: string) {
    const pct = Number(value) || 0;
    if (form.taxType === 'Intrastate') {
      setForm({ ...form, taxPercentage: value, sgst: String(pct / 2), cgst: String(pct / 2), igst: '0' } as FormState);
    } else if (form.taxType === 'Interstate') {
      setForm({ ...form, taxPercentage: value, sgst: '0', cgst: '0', igst: value } as FormState);
    } else {
      setForm({ ...form, taxPercentage: value });
    }
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSaved();
    }, 1200);
  }

  function handleSaveAndAdd() {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm(emptyForm);
    }, 1200);
  }

  const isFormValid = form.name && form.productType && form.unit && form.size;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Saved toast */}
      {saved && (
        <div className="fixed top-20 right-6 z-50 animate-scale-in">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-elevated">
            <Icon name="check_circle" size={20} fill />
            <span className="text-sm font-semibold">Product saved successfully!</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* GENERAL INFORMATION */}
        <Card className="p-6">
          <SectionTitle icon="info" title="General Information" description="Basic product identification and ownership." />

          {/* Image upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Product Image</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center hover:border-brand-400 hover:bg-brand-50/30 transition-base cursor-pointer">
                <div className="text-center">
                  <Icon name="add_a_photo" size={28} className="text-slate-400" />
                  <p className="text-xs text-slate-400 mt-1">Upload</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Upload a product image</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 2MB. Recommended 500x500px.</p>
                <Button variant="secondary" size="sm" className="mt-3">
                  <Icon name="upload" size={16} /> Choose File
                </Button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Product Name" value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Electra" icon="inventory_2" required />
            <Select
              label="Product Type"
              value={form.productType}
              onChange={(v) => update('productType', v)}
              placeholder="Select product type"
              options={productTypes.map((t) => ({ value: t, label: t }))}
              required
            />
            <Input label="Manufacturer Name" value={form.manufacturer} onChange={(v) => update('manufacturer', v)} placeholder="e.g. Nature Biotic Pvt. Ltd." icon="factory" />
            <Input label="Vendor Name" value={form.vendor} onChange={(v) => update('vendor', v)} placeholder="e.g. Nature Biotic Distribution" icon="local_shipping" />
          </div>
        </Card>

        {/* PRODUCT DETAILS */}
        <Card className="p-6">
          <SectionTitle icon="inventory_2" title="Product Details" description="Unit, size, pricing, and tax code information." />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Unit (Weight / Volume)"
              value={form.unit}
              onChange={(v) => update('unit', v)}
              placeholder="Select unit type"
              options={[{ value: 'Weight', label: 'Weight (Kg / g)' }, { value: 'Volume', label: 'Volume (L / ml)' }]}
              required
            />
            <Select
              label="Size"
              value={form.size}
              onChange={(v) => update('size', v)}
              placeholder="Select size"
              options={productSizes.map((s) => ({ value: s, label: s }))}
              required
            />
            <Input label="HSN / SAC Code" value={form.hsnCode} onChange={(v) => update('hsnCode', v)} placeholder="e.g. 380893" icon="qr_code" />
            <Input label="Purchase Price" type="number" value={form.purchasePrice} onChange={(v) => update('purchasePrice', v)} placeholder="0" icon="currency_rupee" />
            <Input label="Selling Price" type="number" value={form.sellingPrice} onChange={(v) => update('sellingPrice', v)} placeholder="0" icon="currency_rupee" required />
            <Input label="MRP" type="number" value={form.mrp} onChange={(v) => update('mrp', v)} placeholder="0" icon="currency_rupee" />
          </div>

          {/* Size hint chips */}
          <div className="mt-4">
            <p className="text-xs text-slate-400 font-medium mb-2">Quick size options:</p>
            <div className="flex flex-wrap gap-2">
              {productSizes.slice(0, 10).map((s) => (
                <button
                  key={s}
                  onClick={() => update('size', s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-base border ${
                    form.size === s
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300 hover:text-brand-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* GST & TAX INFORMATION */}
        <Card className="p-6">
          <SectionTitle icon="receipt_long" title="GST & Tax Information" description="Tax configuration based on interstate or intrastate supply." />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Tax Type"
              value={form.taxType}
              onChange={handleTaxTypeChange}
              placeholder="Select tax type"
              options={[{ value: 'Intrastate', label: 'Intrastate (Within State)' }, { value: 'Interstate', label: 'Interstate (Outside State)' }]}
            />
            <Select
              label="Tax Percentage"
              value={form.taxPercentage}
              onChange={handleTaxPercentageChange}
              placeholder="Select GST rate"
              options={['0', '5', '12', '18', '28'].map((r) => ({ value: r, label: `${r}%` }))}
            />
          </div>

          {/* Conditional tax fields */}
          {form.taxType === 'Intrastate' && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">SGST (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.taxType === 'Intrastate' ? String(Number(form.taxPercentage) / 2 || 0) : '0'}
                    readOnly
                    className="w-full pl-4 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Auto-calculated as half of GST rate</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">CGST (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.taxType === 'Intrastate' ? String(Number(form.taxPercentage) / 2 || 0) : '0'}
                    readOnly
                    className="w-full pl-4 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Auto-calculated as half of GST rate</p>
              </div>
            </div>
          )}

          {form.taxType === 'Interstate' && (
            <div className="mt-4 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">IGST (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.taxType === 'Interstate' ? form.taxPercentage || '0' : '0'}
                    readOnly
                    className="w-full sm:max-w-xs pl-4 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Auto-calculated as full GST rate for interstate supply</p>
              </div>
            </div>
          )}

          {/* Tax info banner */}
          {!form.taxType && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-600">
              <Icon name="info" size={18} />
              Select a tax type to configure SGST/CGST or IGST automatically.
            </div>
          )}
        </Card>

        {/* ADDITIONAL DETAILS */}
        <Card className="p-6">
          <SectionTitle icon="description" title="Additional Details" description="Product description, usage, safety, and storage information." />

          <div className="space-y-4">
            <Textarea
              label="Product Description"
              value={form.description}
              onChange={(v) => update('description', v)}
              placeholder="Enter a detailed product description..."
              rows={3}
            />
            <Textarea
              label="Usage Instructions"
              value={form.usageInstructions}
              onChange={(v) => update('usageInstructions', v)}
              placeholder="How should this product be used? Dosage, method, timing..."
              rows={3}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Textarea
                label="Safety Information"
                value={form.safetyInfo}
                onChange={(v) => update('safetyInfo', v)}
                placeholder="Safety precautions and warnings..."
                rows={3}
              />
              <Textarea
                label="Storage Instructions"
                value={form.storageInfo}
                onChange={(v) => update('storageInfo', v)}
                placeholder="Storage conditions, temperature, shelf life..."
                rows={3}
              />
            </div>

            {/* Product Status */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Product Status</label>
              <div className="flex gap-3">
                {['Active', 'Inactive'].map((s) => (
                  <button
                    key={s}
                    onClick={() => update('status', s)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-base border ${
                      form.status === s
                        ? s === 'Active'
                          ? 'bg-brand-50 text-brand-700 border-brand-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center ${form.status === s ? s === 'Active' ? 'bg-brand-500' : 'bg-slate-400' : 'bg-slate-200'}`}>
                      {form.status === s && <Icon name="check" size={12} className="text-white" />}
                    </span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Bottom action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6">
          <Button variant="secondary" onClick={onCancel} className="sm:mr-auto">
            <Icon name="close" size={18} /> Cancel
          </Button>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" onClick={handleSaveAndAdd} disabled={!isFormValid}>
              <Icon name="add" size={18} /> Save & Add Another
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid}>
              <Icon name="save" size={18} /> Save Product
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
