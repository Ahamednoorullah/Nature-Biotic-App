import { useState } from 'react';
import { getStaffByStore, type Staff } from '@/lib/data';
import { Card, Badge, Button, Input, Modal, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui';
import { formatDate, initials } from '@/lib/format';

const roles = ['Store Manager', 'Sales Executive', 'Inventory Clerk', 'Accountant', 'Cashier'];

export default function StoreStaff({ storeId }: { storeId: string }) {
  const [staff, setStaff] = useState<Staff[]>(() => getStaffByStore(storeId));
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'Sales Executive', phone: '', status: 'Active' });

  function save() {
    if (!form.name) return;
    const s: Staff = {
      id: `st${Date.now()}`, storeId, name: form.name, role: form.role, phone: form.phone,
      email: `${form.name.toLowerCase().replace(/\s/g, '.')}@naturebiotic.in`,
      status: form.status as Staff['status'], joinedDate: new Date().toISOString().split('T')[0],
      alternativePhone: '',
      dob: '',
      age: 0,
      bloodGroup: '',
      address: '',
      proofIdName: '',
      profileImageName: '',
      designation: '',
      level: 2,
      targetSales: 0,
      targetFarmers: 0,
      targetFarms: 0,
      targetVisits: 0
    };
    setStaff([s, ...staff]);
    setShowAdd(false);
    setForm({ name: '', role: 'Sales Executive', phone: '', status: 'Active' });
  }

  function remove(id: string) {
    setStaff(staff.filter((s) => s.id !== id));
  }

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Staff Management</h1>
          <p className="text-slate-500 mt-1">Manage your store team and roles.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Icon name="person_add" size={20} fill /> Add Staff</Button>
      </div>

      <div className="mb-6 max-w-md">
        <Input value={search} onChange={setSearch} placeholder="Search staff by name or role..." icon="search" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="badge" title="No staff found" description="Add staff members to manage your team."
          action={<Button onClick={() => setShowAdd(true)}><Icon name="person_add" size={20} fill /> Add Staff</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {filtered.map((s) => (
            <Card key={s.id} className="p-5" hover>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                  <span className="font-bold text-brand-700">{initials(s.name)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-800 truncate">{s.name}</h3>
                  <p className="text-sm text-slate-500">{s.role}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                    <Icon name="call" size={14} /> {s.phone || 'No phone'}
                  </div>
                </div>
                <Badge color={s.status === 'Active' ? 'green' : 'amber'}>{s.status}</Badge>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Icon name="event" size={14} /> Joined {formatDate(s.joinedDate)}
                </span>
                <button onClick={() => remove(s.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-base">
                  <Icon name="delete" size={18} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member"
        footer={<>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.name}>Add</Button>
        </>}>
        <div className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Priya S" icon="person" required />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm transition-base focus:outline-none focus:border-brand-500">
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm transition-base focus:outline-none focus:border-brand-500">
                <option>Active</option>
                <option>On Leave</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
          <Input label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="e.g. 9876543220" icon="call" />
        </div>
      </Modal>
    </div>
  );
}
