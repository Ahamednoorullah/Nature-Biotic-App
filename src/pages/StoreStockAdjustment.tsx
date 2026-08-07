import { useState } from 'react';
import { getProductsByStore, type AdjustmentType, type AdjustmentReason } from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Button, Input, Select, Textarea, SectionTitle, Icon } from '@/components/ui';

const adjustmentTypes: AdjustmentType[] = ['Increase', 'Decrease'];
const adjustmentReasons: AdjustmentReason[] = ['Damaged', 'Expired', 'Returned', 'Physical Count', 'Other'];

const reasonIcons: Record<AdjustmentReason, string> = {
  Damaged: 'broken_image',
  Expired: 'event_busy',
  Returned: 'undo',
  'Physical Count': 'calculate',
  Other: 'more_horiz',
};

type FormState = {
  product: string;
  adjustmentType: string;
  reason: string;
  quantity: string;
  remarks: string;
};

const emptyForm: FormState = {
  product: '', adjustmentType: 'Decrease', reason: '', quantity: '', remarks: '',
};

export default function StoreStockAdjustment({ storeId }: { storeId: string }) {
  const { goStorePage } = useNav();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState(false);
  const [approved, setApproved] = useState(false);
  const products = getProductsByStore(storeId);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => { setSaved(false); goStorePage('stock-management'); }, 1200);
  }

  function handleApprove() {
    setApproved(true);
    setTimeout(() => { setApproved(false); goStorePage('stock-management'); }, 1200);
  }

  const isValid = form.product && form.reason && form.quantity;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => goStorePage('stock-management')} className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500">
          <Icon name="arrow_back" size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Stock Adjustment</h1>
          <p className="text-slate-500 mt-1">Adjust stock levels for damaged, expired, or returned inventory.</p>
        </div>
      </div>

      {(saved || approved) && (
        <div className="fixed top-20 right-6 z-50 animate-scale-in">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-elevated">
            <Icon name="check_circle" size={20} fill />
            <span className="text-sm font-semibold">{approved ? 'Adjustment approved!' : 'Adjustment saved!'}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ADJUSTMENT DETAILS */}
        <Card className="p-6">
          <SectionTitle icon="tune" title="Adjustment Details" description="Select product and adjustment configuration." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Product" value={form.product} onChange={(v) => update('product', v)} placeholder="Select product" required
              options={products.map((p) => ({ value: p.id, label: `${p.name} (Stock: ${p.stock})` }))} />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adjustment Type</label>
              <div className="flex gap-2">
                {adjustmentTypes.map((t) => (
                  <button key={t} onClick={() => update('adjustmentType', t)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-base border ${
                      form.adjustmentType === t
                        ? t === 'Increase'
                          ? 'bg-brand-50 text-brand-700 border-brand-300'
                          : 'bg-red-50 text-red-600 border-red-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}>
                    <Icon name={t === 'Increase' ? 'arrow_circle_up' : 'arrow_circle_down'} size={18} />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reason selection */}
          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Reason <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {adjustmentReasons.map((r) => (
                <button key={r} onClick={() => update('reason', r)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-base border ${
                    form.reason === r
                      ? 'bg-brand-50 text-brand-700 border-brand-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}>
                  <Icon name={reasonIcons[r]} size={18} />
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <Input label="Quantity" type="number" value={form.quantity} onChange={(v) => update('quantity', v)} placeholder="e.g. 10" icon="numbers" required />
          </div>
        </Card>

        {/* REMARKS */}
        <Card className="p-6">
          <SectionTitle icon="notes" title="Remarks" description="Additional notes about this adjustment." />
          <Textarea label="Remarks" value={form.remarks} onChange={(v) => update('remarks', v)} placeholder="Enter remarks for this adjustment..." rows={3} />
        </Card>

        {/* Summary preview */}
        {isValid && (
          <Card className="p-5 bg-slate-50 border-slate-200 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${form.adjustmentType === 'Increase' ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'}`}>
                <Icon name={form.adjustmentType === 'Increase' ? 'add' : 'remove'} size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Adjustment Summary</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {form.adjustmentType} <span className="font-bold">{form.quantity}</span> units · Reason: <span className="font-bold">{form.reason}</span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6">
          <Button variant="secondary" onClick={() => goStorePage('stock-management')} className="sm:mr-auto">
            <Icon name="close" size={18} /> Cancel
          </Button>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleSave} disabled={!isValid}>
              <Icon name="save" size={18} /> Save
            </Button>
            <Button onClick={handleApprove} disabled={!isValid}>
              <Icon name="verified" size={18} fill /> Approve Adjustment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
