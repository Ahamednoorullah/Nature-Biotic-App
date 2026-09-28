import { useState, useMemo } from 'react';
import { getBillsByStore, type Bill } from '@/lib/data';
import { Card, Badge, Button, Input, Modal, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui';
import { formatCurrency, formatDate, initials } from '@/lib/format';

export default function StoreBilling({ storeId }: { storeId: string }) {
  const [bills, setBills] = useState<Bill[]>(() => getBillsByStore(storeId));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ farmerName: '', itemCount: '', total: '', paymentStatus: 'Paid' });

  function save() {
    if (!form.farmerName || !form.total) return;
    const b: Bill = {
      id: `b${Date.now()}`, storeId, billNo: `NB-${storeId.toUpperCase()}-${String(bills.length + 1).padStart(4, '0')}`,
      farmerName: form.farmerName,
      items: Array.from({ length: Number(form.itemCount) || 1 }, (_, i) => ({ name: 'Product', qty: 1, price: 0 })),
      total: Number(form.total) || 0,
      paymentStatus: form.paymentStatus as Bill['paymentStatus'],
      billDate: new Date().toISOString().split('T')[0],
    };
    setBills([b, ...bills]);
    setShowAdd(false);
    setForm({ farmerName: '', itemCount: '', total: '', paymentStatus: 'Paid' });
  }

  function toggleStatus(bill: Bill) {
    setBills(bills.map((b) => b.id === bill.id ? { ...b, paymentStatus: b.paymentStatus === 'Paid' ? 'Pending' : 'Paid' } : b));
  }

  const filtered = bills.filter((b) => {
    const ms = b.farmerName.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all' || (statusFilter === 'paid' && b.paymentStatus === 'Paid') || (statusFilter === 'pending' && b.paymentStatus === 'Pending');
    return ms && mf;
  });

  const totalRevenue = useMemo(() => bills.reduce((s, b) => s + b.total, 0), [bills]);
  const pendingAmount = useMemo(() => bills.filter((b) => b.paymentStatus === 'Pending').reduce((s, b) => s + b.total, 0), [bills]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Billing</h1>
          <p className="text-slate-500 mt-1">Manage invoices and track payments.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Icon name="add" size={20} fill /> Create Bill</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center"><Icon name="receipt_long" size={24} className="text-brand-600" /></div>
            <div><p className="text-sm text-slate-500 font-medium">Total Bills</p><p className="text-xl font-bold text-slate-800">{bills.length}</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><Icon name="payments" size={24} className="text-blue-600" /></div>
            <div><p className="text-sm text-slate-500 font-medium">Total Revenue</p><p className="text-xl font-bold text-slate-800">{formatCurrency(totalRevenue)}</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center"><Icon name="pending" size={24} className="text-amber-600" /></div>
            <div><p className="text-sm text-slate-500 font-medium">Pending Amount</p><p className="text-xl font-bold text-slate-800">{formatCurrency(pendingAmount)}</p></div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 max-w-md">
          <Input value={search} onChange={setSearch} placeholder="Search by customer name..." icon="search" />
        </div>
        <div className="flex gap-2">
          {(['all', 'paid', 'pending'] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold capitalize transition-base border ${statusFilter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="receipt_long" title="No bills found" description="Create a bill to start tracking sales."
          action={<Button onClick={() => setShowAdd(true)}><Icon name="add" size={20} fill /> Create Bill</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3">Bill No</th>
                  <th className="text-left font-semibold px-5 py-3">Date</th>
                  <th className="text-left font-semibold px-5 py-3">Customer</th>
                  <th className="text-right font-semibold px-5 py-3">Items</th>
                  <th className="text-right font-semibold px-5 py-3">Total</th>
                  <th className="text-center font-semibold px-5 py-3">Status</th>
                  <th className="text-center font-semibold px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-base">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{b.billNo}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(b.billDate)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                          {initials(b.farmerName || 'U')}
                        </div>
                        <span className="font-semibold text-slate-700">{b.farmerName || 'Walk-in'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{b.items.length}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700">{formatCurrency(b.total)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={b.paymentStatus === 'Paid' ? 'green' : 'amber'}>{b.paymentStatus}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button onClick={() => toggleStatus(b)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-base">
                        Mark {b.paymentStatus === 'Paid' ? 'Pending' : 'Paid'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Bill"
        footer={<>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.farmerName || !form.total}>Create</Button>
        </>}>
        <div className="space-y-4">
          <Input label="Customer Name" value={form.farmerName} onChange={(v) => setForm({ ...form, farmerName: v })} placeholder="e.g. Venkatesh Gowda" icon="person" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Items Count" type="number" value={form.itemCount} onChange={(v) => setForm({ ...form, itemCount: v })} placeholder="0" />
            <Input label="Total Amount" type="number" value={form.total} onChange={(v) => setForm({ ...form, total: v })} placeholder="0" icon="currency_rupee" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Status</label>
            <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm transition-base focus:outline-none focus:border-brand-500">
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
