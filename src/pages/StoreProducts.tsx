import { useState, useMemo } from 'react';
import { getProductsByStore, productTypes, type Product, type ProductType } from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, initials } from '@/lib/format';

const colorMap: Record<string, string> = {
  emerald: 'from-emerald-400 to-emerald-600',
  teal: 'from-teal-400 to-teal-600',
  red: 'from-red-400 to-red-600',
  amber: 'from-amber-400 to-amber-600',
  blue: 'from-blue-400 to-blue-600',
  purple: 'from-purple-400 to-purple-600',
};

export default function StoreProducts({ storeId }: { storeId: string }) {
  const { goStorePage } = useNav();
  const [products, setProducts] = useState<Product[]>(() => getProductsByStore(storeId));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => products.filter((p) => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
      p.hsnCode.toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === 'all' || p.productType === typeFilter;
    const mst = statusFilter === 'all' || p.status === statusFilter;
    return ms && mt && mst;
  }), [products, search, typeFilter, statusFilter]);

  function removeProduct(id: string) {
    setProducts(products.filter((p) => p.id !== id));
  }

  function toggleStatus(id: string) {
    setProducts(products.map((p) => p.id === id ? { ...p, status: p.status === 'Active' ? 'Inactive' : 'Active' } : p));
  }

  function handleExport() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }

  function handleImport() {
    setShowImport(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Product Management</h1>
          <p className="text-slate-500 mt-1">Manage your product catalog, pricing, and inventory.</p>
        </div>
        <Button onClick={() => goStorePage('add-product')}>
          <Icon name="add" size={20} fill /> Add Product
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <Input value={search} onChange={setSearch} placeholder="Search products by name, manufacturer, HSN..." icon="search" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-48">
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="All Types"
                options={productTypes.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Status"
                options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={loading}>
              <Icon name="download" size={18} /> {loading ? 'Exporting...' : 'Export'}
            </Button>
            <Button variant="secondary" onClick={handleImport}>
              <Icon name="upload" size={18} /> Import
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-700">{filtered.length}</span> of {products.length} products
          </p>
          {(search || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); }}
              className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
            >
              <Icon name="filter_alt_off" size={16} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Product table */}
      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="inventory_2"
            title="No products found"
            description="Try adjusting your search or filters, or add a new product to get started."
            action={<Button onClick={() => goStorePage('add-product')}><Icon name="add" size={20} fill /> Add Product</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3.5">Image</th>
                  <th className="text-left font-semibold px-5 py-3.5">Product Name</th>
                  <th className="text-left font-semibold px-5 py-3.5">Unit</th>
                  <th className="text-left font-semibold px-5 py-3.5">Size</th>
                  <th className="text-right font-semibold px-5 py-3.5">Selling Price</th>
                  <th className="text-right font-semibold px-5 py-3.5">MRP</th>
                  <th className="text-right font-semibold px-5 py-3.5">Available Stock</th>
                  <th className="text-center font-semibold px-5 py-3.5">Status</th>
                  <th className="text-center font-semibold px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-base">
                    {/* Image */}
                    <td className="px-5 py-3.5">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[p.imageColor] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {initials(p.name)}
                      </div>
                    </td>
                    {/* Name + type */}
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.productType} · {p.manufacturer}</p>
                    </td>
                    {/* Unit */}
                    <td className="px-5 py-3.5 text-slate-600">{p.unit}</td>
                    {/* Size */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">
                        {p.size}
                      </span>
                    </td>
                    {/* Selling price */}
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800">{formatCurrency(p.sellingPrice)}</td>
                    {/* MRP */}
                    <td className="px-5 py-3.5 text-right text-slate-500 line-through">{formatCurrency(p.mrp)}</td>
                    {/* Stock */}
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-semibold ${p.stock === 0 ? 'text-red-500' : p.stock < 20 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {p.stock}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">units</span>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={p.status === 'Active' ? 'green' : 'slate'}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                        {p.status}
                      </Badge>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => toggleStatus(p.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base"
                          title={p.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                          <Icon name={p.status === 'Active' ? 'toggle_on' : 'toggle_off'} size={20} />
                        </button>
                        <button
                          onClick={() => removeProduct(p.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-base"
                          title="Delete"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Import modal */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Products"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button onClick={() => setShowImport(false)} disabled>Import</Button>
          </>
        }
      >
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
