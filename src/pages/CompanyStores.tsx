import { useState } from 'react';
import { stores as initialStores, type Store } from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Button, Input, Modal, Icon } from '@/components/ui';
import { formatCompact, formatCurrency } from '@/lib/format';

export default function CompanyStores() {
  const { goStore } = useNav();
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    owner: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    district: '',
    state: '',
    gst: '',
    openedDate: '',
  });

  function update(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  function handleSave() {
    const newStore: Store = {
      id: `s${stores.length + 1}`,
      code: form.code || form.name.slice(0, 3).toUpperCase(),
      name: form.name,
      owner: form.owner,
      manager: form.owner,
      location: `${form.city}, ${form.state}`,
      address: form.address,
      gst: form.gst,
      phone: form.phone,
      status: 'Active',
      todaySales: 0,
      monthlySales: 0,
      totalProfit: 0,
      outstanding: 0,
      activeCustomers: 0,
      inventoryValue: 0,
      openedDate: form.openedDate || new Date().toISOString().split('T')[0],
    };
    setStores([...stores, newStore]);
    setForm({ name: '', code: '', owner: '', phone: '', email: '', address: '', city: '', district: '', state: '', gst: '', openedDate: '' });
    setShowAdd(false);
  }

  const isValid = form.name && form.phone;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Stores</h1>
          <p className="text-slate-500 mt-1">Manage Nature Biotic retail stores.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={20} fill /> Add Store
        </Button>
      </div>

      <div className="space-y-6">
        {stores.map((store, i) => (
          <Card
            key={store.id}
            className="p-6 sm:p-8 animate-fade-in hover:shadow-elevated transition-base cursor-pointer"
            onClick={() => goStore(store.id)}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                <span className="font-bold text-brand-700">{store.code}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">Store {i + 1}</span>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight truncate">{store.name}</h3>
                </div>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  <Icon name="location_on" size={16} /> {store.location}
                </p>
                {store.owner && (
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Icon name="person" size={16} /> {store.owner}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StoreKpi icon="payments" label="Sales" value={formatCompact(store.monthlySales)} color="brand" />
              <StoreKpi icon="account_balance_wallet" label="Collection" value={formatCompact(store.monthlySales * 0.82)} color="blue" />
              <StoreKpi icon="receipt_long" label="Outstanding" value={formatCurrency(store.outstanding)} color="amber" />
              <StoreKpi icon="groups" label="No of Farmers" value={String(store.activeCustomers)} color="purple" />
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); goStore(store.id); }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm transition-base hover:bg-brand-700 shadow-sm"
              >
                <Icon name="dashboard" size={18} /> Open Store Dashboard
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New Store"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!isValid}>Save Store</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Store Name" value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Sairam Agri Input" icon="storefront" required />
            <Input label="Store Code / Initial" value={form.code} onChange={(v) => update('code', v)} placeholder="e.g. SAI" />
          </div>
          <Input label="Owner Name" value={form.owner} onChange={(v) => update('owner', v)} placeholder="e.g. Sairam" icon="person" />
          <Input label="Mobile Number" value={form.phone} onChange={(v) => update('phone', v)} placeholder="e.g. 9876543210" icon="call" required />
          <Input label="Email Address" value={form.email} onChange={(v) => update('email', v)} placeholder="e.g. store@naturebiotic.in" icon="mail" />
          <Input label="Address" value={form.address} onChange={(v) => update('address', v)} placeholder="Street address" icon="location_on" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="City" value={form.city} onChange={(v) => update('city', v)} placeholder="e.g. Rajapalayam" />
            <Input label="District" value={form.district} onChange={(v) => update('district', v)} placeholder="e.g. Virudhunagar" />
            <Input label="State" value={form.state} onChange={(v) => update('state', v)} placeholder="e.g. Tamil Nadu" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="GST Number" value={form.gst} onChange={(v) => update('gst', v)} placeholder="e.g. 33ABCDE1234F1Z5" icon="receipt_long" />
            <Input label="Opening Date" type="date" value={form.openedDate} onChange={(v) => update('openedDate', v)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StoreKpi({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: 'brand' | 'blue' | 'amber' | 'purple';
}) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="rounded-2xl bg-slate-50 p-5 transition-base hover:bg-slate-100/70">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon name={icon} size={20} />
      </div>
      <p className="text-xl font-bold text-slate-800 tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 font-medium mt-1">{label}</p>
    </div>
  );
}
