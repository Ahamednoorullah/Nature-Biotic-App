import { useState, useMemo } from 'react';
import { getFarmersByStore, cropTypes, type Farmer } from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, StatCard, Icon } from '@/components/ui';
import { formatCurrency, formatCompact, initials } from '@/lib/format';

const colorMap: Record<string, string> = {
  emerald: 'from-emerald-400 to-emerald-600',
  teal: 'from-teal-400 to-teal-600',
  red: 'from-red-400 to-red-600',
  amber: 'from-amber-400 to-amber-600',
  blue: 'from-blue-400 to-blue-600',
  purple: 'from-purple-400 to-purple-600',
};

export default function StoreFarmers({ storeId }: { storeId: string }) {
  const { goStorePage, goFarmerProfile } = useNav();
  const [farmers, setFarmers] = useState<Farmer[]>(() => getFarmersByStore(storeId));
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => farmers.filter((f) => {
    const ms = f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.phone.includes(search) ||
      f.village.toLowerCase().includes(search.toLowerCase()) ||
      f.district.toLowerCase().includes(search.toLowerCase());
    const mc = cropFilter === 'all' || f.cropType === cropFilter;
    const mst = statusFilter === 'all' || f.status === statusFilter;
    return ms && mc && mst;
  }), [farmers, search, cropFilter, statusFilter]);

  const totalFarmers = farmers.length;
  const activeFarmers = farmers.filter((f) => f.status === 'Active').length;
  const totalOutstanding = farmers.reduce((s, f) => s + f.outstanding, 0);
  const totalPurchaseValue = farmers.reduce((s, f) => s + f.totalPurchases, 0);

  function removeFarmer(id: string) {
    setFarmers(farmers.filter((f) => f.id !== id));
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Farmer Management</h1>
          <p className="text-slate-500 mt-1">Manage all registered farmers and customers.</p>
        </div>
        <Button onClick={() => goStorePage('add-farmer')}>
          <Icon name="person_add" size={20} fill /> Add Farmer
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Farmers" value={String(totalFarmers)} icon="groups" color="brand" />
        <StatCard label="Active Farmers" value={String(activeFarmers)} icon="verified" color="blue" trend={`${Math.round((activeFarmers / totalFarmers) * 100)}% active`} trendUp />
        <StatCard label="Outstanding Amount" value={formatCompact(totalOutstanding)} icon="payments" color="amber" />
        <StatCard label="Total Purchase Value" value={formatCompact(totalPurchaseValue)} icon="account_balance_wallet" color="brand" />
      </div>

      {/* Toolbar */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input value={search} onChange={setSearch} placeholder="Search farmers by name, phone, village..." icon="search" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-44">
              <Select value={cropFilter} onChange={setCropFilter} placeholder="All Crops"
                options={cropTypes.map((c) => ({ value: c, label: c }))} />
            </div>
            <div className="w-full sm:w-40">
              <Select value={statusFilter} onChange={setStatusFilter} placeholder="All Status"
                options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
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
            Showing <span className="font-bold text-slate-700">{filtered.length}</span> of {farmers.length} farmers
          </p>
          {(search || cropFilter !== 'all' || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setCropFilter('all'); setStatusFilter('all'); }}
              className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
              <Icon name="filter_alt_off" size={16} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Farmer table */}
      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="groups" title="No farmers found"
            description="Try adjusting your search or filters, or add a new farmer to get started."
            action={<Button onClick={() => goStorePage('add-farmer')}><Icon name="person_add" size={20} fill /> Add Farmer</Button>} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3.5">Profile</th>
                  <th className="text-left font-semibold px-5 py-3.5">Farmer Name</th>
                  <th className="text-left font-semibold px-5 py-3.5">Mobile Number</th>
                  <th className="text-left font-semibold px-5 py-3.5">Village</th>
                  <th className="text-left font-semibold px-5 py-3.5">District</th>
                  <th className="text-right font-semibold px-5 py-3.5">Land (Acres)</th>
                  <th className="text-left font-semibold px-5 py-3.5">Crop Type</th>
                  <th className="text-right font-semibold px-5 py-3.5">Outstanding</th>
                  <th className="text-center font-semibold px-5 py-3.5">Status</th>
                  <th className="text-center font-semibold px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/50 transition-base cursor-pointer" onClick={() => goFarmerProfile(f.id)}>
                    <td className="px-5 py-3.5">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorMap[f.profileColor] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                        {initials(f.name)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{f.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{f.customerCategory}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{f.phone}</td>
                    <td className="px-5 py-3.5 text-slate-600">{f.village}</td>
                    <td className="px-5 py-3.5 text-slate-600">{f.district}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700">{f.landSize}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-medium text-xs">
                        {f.cropType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {f.outstanding > 0
                        ? <span className="font-bold text-amber-600">{formatCurrency(f.outstanding)}</span>
                        : <span className="text-slate-400">Clear</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={f.status === 'Active' ? 'green' : 'slate'}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                        {f.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => goFarmerProfile(f.id)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base" title="View Profile">
                          <Icon name="visibility" size={18} />
                        </button>
                        <button onClick={() => removeFarmer(f.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-base" title="Delete">
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
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Farmers"
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
