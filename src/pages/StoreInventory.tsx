import { useState, useMemo } from 'react';
import {
  getProductsByStore,
  getStockStatus,
  getRecentMovements,
  getLowStockProducts,
  getProductById,
  warehouseList,
  type Product,
  type StockStatus,
} from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, StatCard, Icon } from '@/components/ui';
import { formatCurrency, formatCompact, formatDate, initials } from '@/lib/format';

const colorMap: Record<string, string> = {
  emerald: 'from-emerald-400 to-emerald-600',
  teal: 'from-teal-400 to-teal-600',
  red: 'from-red-400 to-red-600',
  amber: 'from-amber-400 to-amber-600',
  blue: 'from-blue-400 to-blue-600',
  purple: 'from-purple-400 to-purple-600',
};

const statusColor: Record<StockStatus, 'green' | 'amber' | 'red'> = {
  Healthy: 'green',
  'Low Stock': 'amber',
  'Out of Stock': 'red',
};

const movementIcon: Record<string, { icon: string; color: string }> = {
  IN: { icon: 'south_west', color: 'bg-brand-50 text-brand-600' },
  OUT: { icon: 'north_east', color: 'bg-blue-50 text-blue-600' },
  TRANSFER: { icon: 'sync_alt', color: 'bg-purple-50 text-purple-600' },
  ADJUSTMENT: { icon: 'tune', color: 'bg-amber-50 text-amber-600' },
};

export default function StoreInventory({ storeId }: { storeId: string }) {
  const { goStorePage, goProductDetail } = useNav();
  const [products, setProducts] = useState<Product[]>(() => getProductsByStore(storeId));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => products.filter((p) => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.productType.toLowerCase().includes(search.toLowerCase());
    const status = getStockStatus(p);
    const mst = statusFilter === 'all' || status === statusFilter;
    const mw = warehouseFilter === 'all' || p.warehouse === warehouseFilter;
    return ms && mst && mw;
  }), [products, search, statusFilter, warehouseFilter]);

  const totalProducts = products.length;
  const stockValue = products.reduce((s, p) => s + p.sellingPrice * p.stock, 0);
  const lowStock = products.filter((p) => p.stock < p.minStock && p.stock > 0);
  const outOfStock = products.filter((p) => p.stock === 0);
  const recentMovements = getRecentMovements(storeId, 6);

  const statusCounts: Record<StockStatus, number> = {
    Healthy: products.filter((p) => getStockStatus(p) === 'Healthy').length,
    'Low Stock': lowStock.length,
    'Out of Stock': outOfStock.length,
  };
  const statusTotal = totalProducts || 1;

  function removeProduct(id: string) {
    setProducts(products.filter((p) => p.id !== id));
  }

  function handleExport() {
    setExporting(true);
    setTimeout(() => setExporting(false), 800);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Track stock levels, movements, and warehouse value.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => goStorePage('stock-adjustment')}>
            <Icon name="tune" size={18} /> Stock Adjustment
          </Button>
          <Button onClick={() => goStorePage('add-stock')}>
            <Icon name="add" size={20} fill /> Add Stock
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Products" value={String(totalProducts)} icon="inventory_2" color="brand" />
        <StatCard label="Available Stock Value" value={formatCompact(stockValue)} icon="account_balance_wallet" color="blue" />
        <StatCard label="Low Stock Products" value={String(lowStock.length)} icon="warning" color="amber" trend={lowStock.length > 0 ? 'Needs attention' : 'All good'} trendUp={lowStock.length === 0} />
        <StatCard label="Out of Stock" value={String(outOfStock.length)} icon="error" color="red" trend={outOfStock.length > 0 ? 'Restock needed' : 'None'} trendUp={outOfStock.length === 0} />
      </div>

      {/* Chart + Low stock alert */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Stock status chart */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-5">Stock Status Distribution</h3>
          <div className="space-y-4">
            {(['Healthy', 'Low Stock', 'Out of Stock'] as StockStatus[]).map((status) => {
              const count = statusCounts[status];
              const pct = Math.round((count / statusTotal) * 100);
              const barColor = status === 'Healthy' ? 'bg-brand-500' : status === 'Low Stock' ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-600">{status}</span>
                    <span className="text-sm text-slate-500 font-medium">{count} products · {pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Low stock alert panel */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Low Stock Alerts</h3>
            <Badge color="amber"><Icon name="warning" size={14} />{lowStock.length + outOfStock.length}</Badge>
          </div>
          {lowStock.length + outOfStock.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-3">
                <Icon name="check_circle" size={26} className="text-brand-600" fill />
              </div>
              <p className="text-sm font-semibold text-slate-600">All stocks healthy</p>
              <p className="text-xs text-slate-400 mt-1">No products below minimum level.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {[...outOfStock, ...lowStock].map((p) => {
                const status = getStockStatus(p);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-base cursor-pointer" onClick={() => goProductDetail(p.id)}>
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorMap[p.imageColor] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-700 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.stock} / {p.minStock} min</p>
                    </div>
                    <Badge color={statusColor[status]}>{status === 'Out of Stock' ? 'Out' : 'Low'}</Badge>
                  </div>
                );
              })}
            </div>
          )}
          {(lowStock.length + outOfStock.length) > 0 && (
            <Button variant="secondary" size="sm" className="w-full mt-4" onClick={() => goStorePage('low-stock')}>
              View All <Icon name="arrow_forward" size={16} />
            </Button>
          )}
        </Card>
      </div>

      {/* Recent stock movements */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Recent Stock Movements</h3>
          <Icon name="sync_alt" size={20} className="text-slate-400" />
        </div>
        {recentMovements.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No recent movements.</p>
        ) : (
          <div className="space-y-1">
            {recentMovements.map((m) => {
              const product = getProductById(m.productId);
              const mi = movementIcon[m.type];
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mi.color}`}>
                    <Icon name={mi.icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{product?.name ?? 'Product'}</p>
                    <p className="text-xs text-slate-400">{m.remarks} · {formatDate(m.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${m.type === 'IN' ? 'text-brand-600' : m.type === 'OUT' ? 'text-blue-600' : 'text-slate-600'}`}>
                      {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : ''}{m.quantity}
                    </p>
                    <p className="text-xs text-slate-400">{m.referenceNo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Toolbar */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input value={search} onChange={setSearch} placeholder="Search products by name or category..." icon="search" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-44">
              <Select value={statusFilter} onChange={setStatusFilter} placeholder="All Status"
                options={[{ value: 'Healthy', label: 'Healthy' }, { value: 'Low Stock', label: 'Low Stock' }, { value: 'Out of Stock', label: 'Out of Stock' }]} />
            </div>
            <div className="w-full sm:w-52">
              <Select value={warehouseFilter} onChange={setWarehouseFilter} placeholder="All Warehouses"
                options={warehouseList.map((w) => ({ value: w, label: w }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              <Icon name="download" size={18} /> {exporting ? 'Exporting...' : 'Export'}
            </Button>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <Icon name="upload" size={18} /> Import
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-700">{filtered.length}</span> of {products.length} products
          </p>
          {(search || statusFilter !== 'all' || warehouseFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setWarehouseFilter('all'); }}
              className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
              <Icon name="filter_alt_off" size={16} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Inventory table */}
      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="warehouse" title="No inventory found"
            description="Try adjusting your search or filters."
            action={<Button onClick={() => goStorePage('add-stock')}><Icon name="add" size={20} fill /> Add Stock</Button>} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3.5">Image</th>
                  <th className="text-left font-semibold px-5 py-3.5">Product Name</th>
                  <th className="text-left font-semibold px-5 py-3.5">Category</th>
                  <th className="text-left font-semibold px-5 py-3.5">Unit</th>
                  <th className="text-left font-semibold px-5 py-3.5">Pack Size</th>
                  <th className="text-right font-semibold px-5 py-3.5">Current Stock</th>
                  <th className="text-right font-semibold px-5 py-3.5">Min Stock</th>
                  <th className="text-left font-semibold px-5 py-3.5">Warehouse</th>
                  <th className="text-left font-semibold px-5 py-3.5">Last Updated</th>
                  <th className="text-center font-semibold px-5 py-3.5">Status</th>
                  <th className="text-center font-semibold px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const status = getStockStatus(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-base cursor-pointer" onClick={() => goProductDetail(p.id)}>
                      <td className="px-5 py-3.5">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[p.imageColor] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                          {initials(p.name)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{p.name}</td>
                      <td className="px-5 py-3.5 text-slate-500">{p.productType}</td>
                      <td className="px-5 py-3.5 text-slate-600">{p.unit}</td>
                      <td className="px-5 py-3.5"><span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">{p.size}</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : p.stock < p.minStock ? 'text-amber-600' : 'text-slate-700'}`}>{p.stock}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500">{p.minStock}</td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">{p.warehouse}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(p.lastUpdated)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge color={statusColor[status]}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                          {status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => goProductDetail(p.id)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base" title="View Details">
                            <Icon name="visibility" size={18} />
                          </button>
                          <button onClick={() => goStorePage('add-stock')} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base" title="Add Stock">
                            <Icon name="add_box" size={18} />
                          </button>
                          <button onClick={() => removeProduct(p.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-base" title="Delete">
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Import modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Inventory"
        footer={<>
          <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
          <Button onClick={() => setShowImport(false)} disabled>Import</Button>
        </>}>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-brand-400 transition-base cursor-pointer">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <Icon name="cloud_upload" size={32} className="text-brand-600" />
            </div>
            <p className="font-semibold text-slate-700">Drop your CSV file here</p>
            <p className="text-sm text-slate-400 mt-1">or click to browse — supports .csv, .xlsx</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Icon name="info" size={18} className="text-slate-400" />
            Download the template format to ensure correct column mapping.
          </div>
          <Button variant="secondary" className="w-full">
            <Icon name="download" size={18} /> Download Template
          </Button>
        </div>
      </Modal>
    </div>
  );
}
