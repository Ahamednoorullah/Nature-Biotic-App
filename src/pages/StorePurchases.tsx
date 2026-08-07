import { useState, useMemo } from 'react';
import { Card, Button, Icon, Modal, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { purchases as allPurchases, type Purchase } from '@/lib/purchaseData';

const vendors = ['Nature Biotic', 'Green Agro Suppliers', 'Sri Lakshmi Traders'];
const statuses = ['Paid', 'Pending', 'Partial'];

const statusColor: Record<string, 'green' | 'amber' | 'blue'> = {
  Paid: 'green',
  Pending: 'amber',
  Partial: 'blue',
};

export default function StorePurchases({ storeId: _storeId }: { storeId: string }) {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState<Purchase | null>(null);

  const filtered = useMemo(
    () =>
      allPurchases.filter((p) => {
        const ms =
          p.purchaseNo.toLowerCase().includes(search.toLowerCase()) ||
          p.vendor.toLowerCase().includes(search.toLowerCase()) ||
          p.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
          p.product.toLowerCase().includes(search.toLowerCase());
        const mv = vendorFilter === 'all' || p.vendor === vendorFilter;
        const ms2 = statusFilter === 'all' || p.status === statusFilter;
        return ms && mv && ms2;
      }),
    [search, vendorFilter, statusFilter],
  );

  const totalPurchases = allPurchases.reduce((s, p) => s + p.purchaseAmount, 0);
  const paidAmount = allPurchases.reduce((s, p) => s + p.paidAmount, 0);
  const pendingAmount = allPurchases.reduce((s, p) => s + p.balance, 0);
  const noOfPurchases = allPurchases.length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Purchase Management</h1>
          <p className="text-slate-500 mt-1">Track all store purchases from vendors and suppliers.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-sm text-slate-500 font-medium">Total Purchases</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalPurchases)}</p></div>
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Icon name="shopping_cart" size={22} className="text-brand-600" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-sm text-slate-500 font-medium">Paid Amount</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(paidAmount)}</p></div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Icon name="check_circle" size={22} className="text-emerald-600" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-sm text-slate-500 font-medium">Pending Amount</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(pendingAmount)}</p></div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Icon name="pending" size={22} className="text-amber-600" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-sm text-slate-500 font-medium">No of Purchases</p><p className="text-2xl font-bold text-slate-800 mt-1">{noOfPurchases}</p></div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Icon name="receipt_long" size={22} className="text-blue-600" /></div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <span className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 20 }}>search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by purchase no, vendor, invoice, product..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-48">
              <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer">
                <option value="all">All Vendors</option>
                {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer">
                <option value="all">All Status</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Button variant="secondary" onClick={() => { setSearch(''); setVendorFilter('all'); setStatusFilter('all'); }}>
              <Icon name="filter_alt_off" size={18} /> Clear
            </Button>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="shopping_cart" title="No purchases found" description="Adjust your search or filters to find purchase records." />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b-2 border-slate-200">
                  {['Purchase No', 'Date', 'Vendor', 'Invoice No', 'Product', 'Quantity', 'Purchase Amount', 'Paid Amount', 'Balance', 'Status', 'View'].map((h, i) => (
                    <th key={h} className={`font-semibold px-3 py-3 border-r border-slate-200 last:border-r-0 ${i >= 5 && i <= 9 ? 'text-right' : i === 10 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-brand-50/40 transition-base`}>
                    <td className="px-3 py-3 border-r border-slate-100 font-semibold text-slate-800">{p.purchaseNo}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-500">{formatDate(p.date)}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-700">{p.vendor}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">{p.invoiceNo}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">{p.product}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">{p.quantity}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700">{formatCurrency(p.purchaseAmount)}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">{formatCurrency(p.paidAmount)}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700">{formatCurrency(p.balance)}</td>
                    <td className="px-3 py-3 border-r border-slate-100 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        statusColor[p.status] === 'green' ? 'bg-brand-50 text-brand-700' :
                        statusColor[p.status] === 'amber' ? 'bg-amber-50 text-amber-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => setViewing(p)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base" title="View Purchase">
                        <Icon name="visibility" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Purchase Detail" size="xl">
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Detail label="Purchase No" value={viewing.purchaseNo} />
              <Detail label="Vendor" value={viewing.vendor} />
              <Detail label="Invoice Date" value={formatDate(viewing.date)} />
              <Detail label="Invoice No" value={viewing.invoiceNo} />
              <Detail label="Status" value={viewing.status} />
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                    {['Product', 'Quantity', 'Rate', 'Tax', 'Total'].map((h, i) => (
                      <th key={h} className={`font-semibold px-3 py-2.5 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewing.items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{it.product}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{it.quantity}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(it.rate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(it.tax)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <Detail label="Total" value={formatCurrency(viewing.purchaseAmount)} bold />
              <Detail label="Paid" value={formatCurrency(viewing.paidAmount)} bold />
              <Detail label="Balance" value={formatCurrency(viewing.balance)} bold />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-sm ${bold ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>{value}</p>
    </div>
  );
}
