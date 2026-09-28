import { useState } from 'react';
import { getStore } from '@/lib/data';
import { Card, Button, Input, Badge } from '@/components/ui';
import { Icon } from '@/components/ui';

export default function StoreSettings({ storeId }: { storeId: string }) {
  const store = getStore(storeId);
  const [form, setForm] = useState({
    name: store?.name ?? '',
    manager: store?.manager ?? '',
    location: store?.location ?? '',
    phone: store?.phone ?? '',
    status: (store?.status ?? 'Active') as string,
  });
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Store Settings</h1>
        <p className="text-slate-500 mt-1">Configure your store details and preferences.</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="storefront" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Store Information</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Store Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} icon="storefront" />
            <Input label="Store Manager" value={form.manager} onChange={(v) => setForm({ ...form, manager: v })} icon="person" />
            <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} icon="location_on" />
            <Input label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} icon="call" />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Store Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm transition-base focus:outline-none focus:border-brand-500">
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <Button onClick={save}><Icon name="save" size={18} /> Save Changes</Button>
            {saved && <Badge color="green"><Icon name="check_circle" size={14} fill /> Saved successfully</Badge>}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="tune" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Operational Preferences</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Auto-generate bills', desc: 'Automatically create bill numbers for new invoices', on: true },
              { label: 'Low stock threshold alerts', desc: 'Alert when stock falls below 20 units', on: true },
              { label: 'Daily sales report email', desc: 'Send a summary email at end of day', on: false },
            ].map((item) => (
              <Toggle key={item.label} label={item.label} desc={item.desc} defaultOn={item.on} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Toggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <button onClick={() => setOn(!on)} className={`relative w-11 h-6 rounded-full transition-base ${on ? 'bg-brand-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
