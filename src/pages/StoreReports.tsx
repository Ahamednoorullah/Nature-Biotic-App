import { useMemo } from 'react';
import { getBillsByStore, getFROStockByExecutive, getProductsByStore, getFarmersByStore } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

function readRows(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function sameName(value: unknown, name: string) {
  return String(value || "").trim().toLowerCase() === name;
}

export default function StoreReports({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  if (user?.role === "fro") {
    return <FroReportView storeId={storeId} name={user.name} />;
  }
  return <StoreReportView storeId={storeId} />;
}

function StoreReportView({ storeId }: { storeId: string }) {
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

function FroReportView({ storeId, name }: { storeId: string; name: string }) {
  const froName = name.trim().toLowerCase();
  const report = useMemo(() => {
    const sales = readRows(`nature-biotic-store-sales-invoices-v2:${storeId}`).filter(
      (row) => sameName(row.executiveName, froName),
    );
    const collections = readRows(`nature-biotic-store-receipts-v3:${storeId}`).filter(
      (row) => sameName(row.receivedBy, froName),
    );
    const returns = readRows(`nature-biotic-store-sales-returns-v2:${storeId}`).filter(
      (row) => sameName(row.executiveName, froName),
    );
    const expenses = readRows("naturebiotic_shared_expenses").filter((row) =>
      sameName(row.enteredBy, froName),
    );
    const stock = getFROStockByExecutive(storeId, name);
    let visits = 0;
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";
        if (!/visit/i.test(key)) continue;
        readRows(key).forEach((row) => {
          const owner = String(
            row.executiveName ?? row.froName ?? row.createdBy ?? row.userName ?? "",
          )
            .trim()
            .toLowerCase();
          if (owner === froName) visits += 1;
        });
      }
    } catch {
      visits = 0;
    }
    const paid = new Map<string, number>();
    collections.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || row.billNo || "").trim().toLowerCase();
      if (!invoiceNo || invoiceNo === "-") return;
      paid.set(invoiceNo, (paid.get(invoiceNo) || 0) + Number(row.amount || 0));
    });
    const outstanding = sales.reduce((sum, row) => {
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      const due = Math.max(Number(row.amount || 0) - (paid.get(invoiceNo) || 0), 0);
      return sum + due;
    }, 0);
    return {
      sales,
      salesTotal: sales.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      collection: collections.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      outstanding,
      returns: returns.reduce((sum, row) => sum + Number(row.total || 0), 0),
      expenses: expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      stockValue: stock.reduce(
        (sum, row) => sum + Number(row.currentQty || 0) * Number(row.unitValue || 0),
        0,
      ),
      visits,
    };
  }, [storeId, froName, name]);

  const cards = [
    ["Sales", report.salesTotal],
    ["Collection", report.collection],
    ["Outstanding", report.outstanding],
    ["Sales Return", report.returns],
    ["Expenses", report.expenses],
    ["Hand Stock", report.stockValue],
  ] as const;

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Your sales, collection, stock and expenses.</p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-4 sm:p-5">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{formatCurrency(value)}</p>
          </Card>
        ))}
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-medium text-slate-500">Visits</p>
          <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{report.visits}</p>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <Icon name="receipt_long" size={22} className="text-brand-600" />
          <h2 className="font-bold text-slate-800">My Sales</h2>
        </div>
        {report.sales.length === 0 ? (
          <EmptyState icon="receipt_long" title="No sales" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Farmer</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.sales.map((row) => (
                  <tr key={String(row.id || row.invoiceNo)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.invoiceNo || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.date ? formatDate(String(row.date)) : "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.partyName || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {formatCurrency(Number(row.amount || 0))}
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
