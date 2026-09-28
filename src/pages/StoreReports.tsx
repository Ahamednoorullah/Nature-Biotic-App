import { useMemo } from 'react';
import { getBillsByStore, getProductsByStore, getFarmersByStore } from '@/lib/data';
import { Card, Badge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

export default function StoreReports({ storeId }: { storeId: string }) {
  const bills = useMemo(() => getBillsByStore(storeId), [storeId]);
  const products = useMemo(() => getProductsByStore(storeId), [storeId]);
  const farmers = useMemo(() => getFarmersByStore(storeId), [storeId]);

  const totalRevenue = useMemo(() => bills.reduce((s, b) => s + b.total, 0), [bills]);
  const pendingAmount = useMemo(() => bills.filter((b) => b.paymentStatus === 'Pending').reduce((s, b) => s + b.total, 0), [bills]);
  const inventoryValue = useMemo(() => products.reduce((s, p) => s + p.sellingPrice * p.stock, 0), [products]);
  const farmerOutstanding = useMemo(() => farmers.reduce((s, f) => s + f.outstanding, 0), [farmers]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports</h1>
        <p className="text-slate-500 mt-1">Store performance and analytics.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        <Card className="p-5"><p className="text-sm text-slate-500 font-medium">Total Revenue</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalRevenue)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500 font-medium">Pending Payments</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(pendingAmount)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500 font-medium">Inventory Value</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(inventoryValue)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500 font-medium">Farmer Outstanding</p><p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(farmerOutstanding)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="donut_large" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Product Categories</h2>
          </div>
          {products.length === 0 ? <EmptyState icon="inventory_2" title="No products" /> : (
            <div className="space-y-3">
              {Object.entries(
                products.reduce<Record<string, number>>((acc, p) => {
                  acc[p.productType] = (acc[p.productType] ?? 0) + p.sellingPrice * p.stock;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                const pct = inventoryValue > 0 ? (val / inventoryValue) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-slate-700">{cat}</span>
                      <span className="text-slate-500">{formatCurrency(val)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="pie_chart" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Payment Status</h2>
          </div>
          {bills.length === 0 ? <EmptyState icon="receipt_long" title="No bills" /> : (
            <div className="space-y-4">
              {(['Paid', 'Pending'] as const).map((status) => {
                const count = bills.filter((b) => b.paymentStatus === status).length;
                const amount = bills.filter((b) => b.paymentStatus === status).reduce((s, b) => s + b.total, 0);
                const pct = (count / bills.length) * 100;
                return (
                  <div key={status} className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status === 'Paid' ? 'bg-brand-50' : 'bg-amber-50'}`}>
                      <Icon name={status === 'Paid' ? 'check_circle' : 'pending'} size={24} className={status === 'Paid' ? 'text-brand-600' : 'text-amber-600'} fill={status === 'Paid'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">{status}</span>
                        <span className="text-sm text-slate-500">{count} bills · {formatCurrency(amount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                        <div className={`h-full rounded-full ${status === 'Paid' ? 'bg-brand-500' : 'bg-amber-500'} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Icon name="receipt_long" size={22} className="text-brand-600" />
          <h2 className="font-bold text-slate-800">All Bills</h2>
        </div>
        {bills.length === 0 ? <EmptyState icon="receipt_long" title="No bills" /> : (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-base">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{b.billNo}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(b.billDate)}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700">{b.farmerName || 'Walk-in'}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{b.items.length}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700">{formatCurrency(b.total)}</td>
                    <td className="px-5 py-3.5 text-center"><Badge color={b.paymentStatus === 'Paid' ? 'green' : 'amber'}>{b.paymentStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
