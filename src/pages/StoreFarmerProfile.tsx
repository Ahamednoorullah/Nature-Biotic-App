import { useState } from 'react';
import { getFarmerById, getPurchasesByFarmer, getPaymentsByFarmer } from '@/lib/data';
import { useNav } from '@/context/NavContext';
import { Card, Badge, Button, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, formatDate, initials } from '@/lib/format';

type Tab = 'overview' | 'purchases' | 'invoices' | 'payments' | 'crop' | 'documents';

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'purchases', label: 'Purchase History', icon: 'shopping_cart' },
  { key: 'invoices', label: 'Invoices', icon: 'receipt_long' },
  { key: 'payments', label: 'Payment History', icon: 'payments' },
  { key: 'crop', label: 'Crop Details', icon: 'agriculture' },
  { key: 'documents', label: 'Documents', icon: 'folder' },
];

const colorMap: Record<string, string> = {
  emerald: 'from-emerald-400 to-emerald-600',
  teal: 'from-teal-400 to-teal-600',
  red: 'from-red-400 to-red-600',
  amber: 'from-amber-400 to-amber-600',
  blue: 'from-blue-400 to-blue-600',
  purple: 'from-purple-400 to-purple-600',
};

export default function StoreFarmerProfile({ storeId: _storeId, farmerId }: { storeId: string; farmerId: string }) {
  const { goStorePage } = useNav();
  const [tab, setTab] = useState<Tab>('overview');
  const farmer = getFarmerById(farmerId);

  if (!farmer) {
    return (
      <Card className="p-0">
        <EmptyState icon="person_off" title="Farmer not found"
          description="This farmer profile may have been removed."
          action={<Button onClick={() => goStorePage('farmers')}><Icon name="arrow_back" size={18} /> Back to Farmers</Button>} />
      </Card>
    );
  }

  const purchases = getPurchasesByFarmer(farmerId);
  const payments = getPaymentsByFarmer(farmerId);
  const invoices = purchases;

  return (
    <div>
      {/* Back button */}
      <button onClick={() => goStorePage('farmers')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium text-sm mb-4 transition-base">
        <Icon name="arrow_back" size={18} /> Back to Farmers
      </button>

      {/* Profile header */}
      <Card className="p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${colorMap[farmer.profileColor] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-2xl shrink-0 mx-auto sm:mx-0`}>
            {initials(farmer.name)}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{farmer.name}</h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Icon name="location_on" size={16} />{farmer.village}</span>
              <span className="flex items-center gap-1"><Icon name="call" size={16} />{farmer.phone}</span>
              <span className="flex items-center gap-1"><Icon name="calendar_month" size={16} />Since {formatDate(farmer.joinedDate)}</span>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <div className="text-center sm:text-right">
              <p className="text-xs text-slate-400 font-medium">Outstanding Amount</p>
              <p className={`text-xl font-bold ${farmer.outstanding > 0 ? 'text-amber-600' : 'text-brand-600'}`}>
                {farmer.outstanding > 0 ? formatCurrency(farmer.outstanding) : 'Clear'}
              </p>
            </div>
            <Badge color={farmer.status === 'Active' ? 'green' : 'slate'}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />{farmer.status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-base ${
              tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            <Icon name={t.icon} size={18} fill={tab === t.key} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={tab} className="animate-fade-in">
        {tab === 'overview' && <OverviewTab farmer={farmer} purchases={purchases} payments={payments} />}
        {tab === 'purchases' && <PurchasesTab purchases={purchases} />}
        {tab === 'invoices' && <InvoicesTab invoices={invoices} />}
        {tab === 'payments' && <PaymentsTab payments={payments} />}
        {tab === 'crop' && <CropTab farmer={farmer} />}
        {tab === 'documents' && <DocumentsTab />}
      </div>
    </div>
  );
}

function OverviewTab({ farmer, purchases, payments }: { farmer: ReturnType<typeof getFarmerById>; purchases: ReturnType<typeof getPurchasesByFarmer>; payments: ReturnType<typeof getPaymentsByFarmer> }) {
  if (!farmer) return null;
  const totalSpent = purchases.reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const infoItems = [
    { icon: 'badge', label: 'Customer Category', value: farmer.customerCategory },
    { icon: 'call', label: 'Alternative Mobile', value: farmer.altMobile || '—' },
    { icon: 'mail', label: 'Email', value: farmer.email || '—' },
    { icon: 'receipt_long', label: 'GST Number', value: farmer.gst || '—' },
    { icon: 'location_city', label: 'District', value: farmer.district },
    { icon: 'public', label: 'State', value: farmer.state },
    { icon: 'crop_square', label: 'Land Size', value: `${farmer.landSize} acres` },
    { icon: 'grass', label: 'Crop Type', value: farmer.cropType },
    { icon: 'water_drop', label: 'Water Source', value: farmer.waterSource },
    { icon: 'payments', label: 'Payment Method', value: farmer.paymentMethod },
    { icon: 'credit_card', label: 'Credit Limit', value: formatCurrency(farmer.creditLimit) },
    { icon: 'calendar_month', label: 'Customer Since', value: formatDate(farmer.joinedDate) },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Stats */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Total Purchase Value</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalSpent)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Total Payments Made</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Outstanding Balance</p>
          <p className={`text-2xl font-bold mt-1 ${farmer.outstanding > 0 ? 'text-amber-600' : 'text-brand-600'}`}>
            {farmer.outstanding > 0 ? formatCurrency(farmer.outstanding) : 'Clear'}
          </p>
        </Card>
      </div>

      {/* Info grid */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-4">Farmer Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon name={item.icon} size={18} className="text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          {farmer.remarks && (
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-400 font-semibold mb-1">Remarks</p>
              <p className="text-sm text-slate-600">{farmer.remarks}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PurchasesTab({ purchases }: { purchases: ReturnType<typeof getPurchasesByFarmer> }) {
  if (purchases.length === 0) {
    return <Card className="p-0"><EmptyState icon="shopping_cart" title="No purchases yet" description="This farmer hasn't made any purchases yet." /></Card>;
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">Invoice Number</th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Product</th>
              <th className="text-right font-semibold px-5 py-3.5">Quantity</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
              <th className="text-center font-semibold px-5 py-3.5">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-base">
                <td className="px-5 py-3.5 font-semibold text-brand-600">{p.invoiceNo}</td>
                <td className="px-5 py-3.5 text-slate-600">{formatDate(p.date)}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-700">{p.product}</td>
                <td className="px-5 py-3.5 text-right text-slate-600">{p.quantity}</td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">{formatCurrency(p.amount)}</td>
                <td className="px-5 py-3.5 text-center">
                  <Badge color={p.paymentStatus === 'Paid' ? 'green' : 'amber'}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                    {p.paymentStatus}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InvoicesTab({ invoices }: { invoices: ReturnType<typeof getPurchasesByFarmer> }) {
  if (invoices.length === 0) {
    return <Card className="p-0"><EmptyState icon="receipt_long" title="No invoices" description="No invoices have been generated for this farmer." /></Card>;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {invoices.map((inv) => (
        <Card key={inv.id} className="p-5" hover>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">Invoice</p>
              <p className="font-bold text-brand-600">{inv.invoiceNo}</p>
            </div>
            <Badge color={inv.paymentStatus === 'Paid' ? 'green' : 'amber'}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
              {inv.paymentStatus}
            </Badge>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="text-slate-600 font-medium">{formatDate(inv.date)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Product</span><span className="text-slate-700 font-semibold">{inv.product}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Quantity</span><span className="text-slate-600 font-medium">{inv.quantity}</span></div>
            <div className="flex justify-between pt-1.5 border-t border-slate-100"><span className="text-slate-400">Amount</span><span className="font-bold text-slate-800">{formatCurrency(inv.amount)}</span></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PaymentsTab({ payments }: { payments: ReturnType<typeof getPaymentsByFarmer> }) {
  if (payments.length === 0) {
    return <Card className="p-0"><EmptyState icon="payments" title="No payments recorded" description="No payment history available for this farmer." /></Card>;
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">Receipt No.</th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Method</th>
              <th className="text-left font-semibold px-5 py-3.5">Note</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-base">
                <td className="px-5 py-3.5 font-semibold text-brand-600">{p.receiptNo}</td>
                <td className="px-5 py-3.5 text-slate-600">{formatDate(p.date)}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">{p.method}</span>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{p.note}</td>
                <td className="px-5 py-3.5 text-right font-bold text-brand-600">{formatCurrency(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CropTab({ farmer }: { farmer: ReturnType<typeof getFarmerById> }) {
  if (!farmer) return null;
  const items = [
    { icon: 'grass', label: 'Crop Type', value: farmer.cropType },
    { icon: 'layers', label: 'Soil Type', value: farmer.soilType },
    { icon: 'water_drop', label: 'Water Source', value: farmer.waterSource },
    { icon: 'crop_square', label: 'Land Size', value: `${farmer.landSize} acres` },
    { icon: 'location_on', label: 'Village', value: farmer.village },
    { icon: 'map', label: 'Taluk', value: farmer.taluk },
    { icon: 'location_city', label: 'District', value: farmer.district },
    { icon: 'public', label: 'State', value: farmer.state },
    { icon: 'mark_email_read', label: 'Pincode', value: farmer.pincode },
    { icon: 'home', label: 'Farm Address', value: farmer.farmAddress },
  ];
  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-800 mb-4">Crop & Farm Details</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Icon name={item.icon} size={18} className="text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">{item.label}</p>
              <p className="text-sm font-semibold text-slate-700">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DocumentsTab() {
  const docs = [
    { name: 'Land Document.pdf', type: 'Land Records', date: '2023-01-15', icon: 'description' },
    { name: 'Aadhar Card.jpg', type: 'Identity Proof', date: '2023-01-15', icon: 'badge' },
    { name: 'Bank Details.pdf', type: 'Bank Account', date: '2023-02-20', icon: 'account_balance' },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {docs.map((doc) => (
        <Card key={doc.name} className="p-5" hover>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Icon name={doc.icon} size={22} className="text-brand-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-700 truncate">{doc.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{doc.type} · {formatDate(doc.date)}</p>
            </div>
            <button className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base">
              <Icon name="download" size={18} />
            </button>
          </div>
        </Card>
      ))}
      <Card className="p-5 border-2 border-dashed border-slate-200 hover:border-brand-400 transition-base cursor-pointer flex items-center justify-center min-h-[88px]">
        <div className="text-center">
          <Icon name="add_circle" size={28} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-500 mt-1">Upload Document</p>
        </div>
      </Card>
    </div>
  );
}
