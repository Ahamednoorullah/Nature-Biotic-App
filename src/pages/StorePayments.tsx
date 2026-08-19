import { useState, useMemo } from 'react';
import { Card, Button, Icon, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { payments as allPayments, type Payment } from '@/lib/purchaseData';

const vendors = ['Nature Biotic', 'Green Agro Suppliers', 'Sri Lakshmi Traders'];
const methods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
const statuses = ['Paid', 'Pending'];

const statusColor: Record<string, 'green' | 'amber'> = {
  Paid: 'green',
  Pending: 'amber',
};

export default function StorePayments({ storeId: _storeId }: { storeId: string }) {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [viewing, setViewing] = useState<Payment | null>(null);

  const filtered = useMemo(
    () =>
      allPayments.filter((p) => {
        const ms =
          p.paymentNo.toLowerCase().includes(search.toLowerCase()) ||
          p.vendor.toLowerCase().includes(search.toLowerCase()) ||
          p.invoiceRef.toLowerCase().includes(search.toLowerCase());
        const mv = vendorFilter === 'all' || p.vendor === vendorFilter;
        const mm = methodFilter === 'all' || p.method === methodFilter;
        return ms && mv && mm;
      }),
    [search, vendorFilter, methodFilter],
  );

  const totalPayable = allPayments.reduce((s, p) => s + p.amount + p.balance, 0);
  const paid = allPayments.reduce((s, p) => s + p.amount, 0);
  const pending = allPayments.reduce((s, p) => s + p.balance, 0);
  const today = new Date().toISOString().split('T')[0];
  const paymentsToday = allPayments.filter((p) => p.date === today).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Payments</h1>
          <p className="text-slate-500 mt-1">Purchase payments made to vendors and suppliers.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500 font-medium">Total Payable</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalPayable)}</p></div><div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Icon name="payments" size={22} className="text-brand-600" /></div></div></Card>
        <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500 font-medium">Paid</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(paid)}</p></div><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Icon name="check_circle" size={22} className="text-emerald-600" /></div></div></Card>
        <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500 font-medium">Pending</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(pending)}</p></div><div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Icon name="pending" size={22} className="text-amber-600" /></div></div></Card>
        <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500 font-medium">Payments Today</p><p className="text-2xl font-bold text-slate-800 mt-1">{paymentsToday}</p></div><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Icon name="today" size={22} className="text-blue-600" /></div></div></Card>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <span className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 20 }}>search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by payment no, vendor, invoice ref..." className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-48">
              <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer">
                <option value="all">All Vendors</option>
                {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer">
                <option value="all">All Methods</option>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <Button variant="secondary" onClick={() => { setSearch(''); setVendorFilter('all'); setMethodFilter('all'); }}>
              <Icon name="filter_alt_off" size={18} /> Clear
            </Button>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0"><EmptyState icon="payments" title="No payments found" description="Adjust your search or filters to find payment records." /></Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b-2 border-slate-200">
                  <th className="w-[6%] font-semibold px-2 py-3 border-r border-slate-200 text-center">S.No</th>
                  <th className="w-[10%] font-semibold px-2 py-3 border-r border-slate-200 text-left">Date</th>
                  <th className="w-[12%] font-semibold px-2 py-3 border-r border-slate-200 text-left">Pay No</th>
                  <th className="w-[16%] font-semibold px-2 py-3 border-r border-slate-200 text-left">Vendor</th>
                  <th className="w-[15%] font-semibold px-2 py-3 border-r border-slate-200 text-left">Inv / Pur No</th>
                  <th className="w-[13%] font-semibold px-2 py-3 border-r border-slate-200 text-left">Pay Method</th>
                  <th className="w-[11%] font-semibold px-2 py-3 border-r border-slate-200 text-right">Amount</th>
                  <th className="w-[9%] font-semibold px-2 py-3 border-r border-slate-200 text-right">Balance</th>
                  <th className="w-[8%] font-semibold px-2 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    onClick={() => setViewing(p)}
                    title="Click to view payment details"
                    className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-brand-50/50 transition-base`}
                  >
                    <td className="px-2 py-3 border-r border-slate-100 text-center text-slate-500">{i + 1}</td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-500 whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="px-2 py-3 border-r border-slate-100 font-semibold text-slate-800 whitespace-nowrap">{p.paymentNo}</td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-700 truncate">{p.vendor}</td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-600 truncate">{p.invoiceRef}</td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-600 truncate">{p.method}</td>
                    <td className="px-2 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700 whitespace-nowrap">{formatCurrency(p.amount)}</td>
                    <td className="px-2 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600 whitespace-nowrap">{formatCurrency(p.balance)}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        statusColor[p.status] === 'green' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-600'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setViewing(null)} />
          <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h3 className="text-lg font-bold text-slate-800">Payment Details</h3><p className="text-sm text-slate-500 mt-0.5">{viewing.paymentNo}</p></div>
              <button onClick={() => setViewing(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-base"><Icon name="close" size={22} /></button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              <Detail label="Payment No" value={viewing.paymentNo} />
              <Detail label="Date" value={formatDate(viewing.date)} />
              <Detail label="Vendor" value={viewing.vendor} />
              <Detail label="Invoice Ref" value={viewing.invoiceRef} />
              <Detail label="Payment Method" value={viewing.method} />
              <Detail label="Amount" value={formatCurrency(viewing.amount)} />
              <Detail label="Balance" value={formatCurrency(viewing.balance)} />
              <Detail label="Status" value={viewing.status} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
