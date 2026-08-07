import { stores } from '@/lib/data';
import { Card, Badge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui';
import { formatCompact, formatCurrency } from '@/lib/format';

export default function CompanyReports() {
  const sorted = [...stores].sort((a, b) => b.monthlySales - a.monthlySales);

  const totalRevenue = stores.reduce((s, x) => s + x.monthlySales, 0);
  const totalProfit = stores.reduce((s, x) => s + x.totalProfit, 0);
  const totalOutstanding = stores.reduce((s, x) => s + x.outstanding, 0);
  const totalInventory = stores.reduce((s, x) => s + x.inventoryValue, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports</h1>
        <p className="text-slate-500 mt-1">Company-wide performance across all stores.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCompact(totalRevenue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Total Profit</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCompact(totalProfit)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCompact(totalOutstanding)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Inventory Value</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCompact(totalInventory)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Icon name="leaderboard" size={22} className="text-brand-600" />
          <h2 className="font-bold text-slate-800">Store Performance</h2>
        </div>
        {sorted.length === 0 ? (
          <EmptyState icon="bar_chart" title="No data available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3">Store</th>
                  <th className="text-left font-semibold px-5 py-3">Manager</th>
                  <th className="text-right font-semibold px-5 py-3">Monthly Sales</th>
                  <th className="text-right font-semibold px-5 py-3">Profit</th>
                  <th className="text-right font-semibold px-5 py-3">Outstanding</th>
                  <th className="text-center font-semibold px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-base">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{s.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{s.manager}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700">{formatCurrency(s.monthlySales)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{formatCurrency(s.totalProfit)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{formatCurrency(s.outstanding)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={s.status === 'Active' ? 'green' : 'slate'}>{s.status}</Badge>
                    </td>
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
