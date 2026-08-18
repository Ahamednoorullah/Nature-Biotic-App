import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { stores } from '@/lib/data';


type ReceiptStatus = 'Completed' | 'Pending';

type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  storeId: string;
  storeName: string;
  method: string;
  invoiceAmount: number;
  amount: number;
};

const methods = ['Cash', 'Bank Transfer', 'UPI', 'Cheque'];
const receivers = ['Ramesh Kumar', 'Priya S', 'Karthik N'];
const statuses: ReceiptStatus[] = ['Completed', 'Pending'];

const receipts: Receipt[] = Array.from({ length: 16 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 2 + 1));
  const store = stores[i % stores.length];
  return {
    id: `r${i}`,
    receiptNo: `RCP-${String(3001 + i)}`,
    date: d.toISOString().split('T')[0],
    storeId: store.id,
    storeName: store.name,
    method: methods[i % methods.length],
    invoiceAmount: 5000 + (i % 8) * 3000,
    amount: 1500 + (i % 8) * 2300,
  };
});

const statusColor: Record<ReceiptStatus, 'green' | 'amber'> = {
  Completed: 'green',
  Pending: 'amber',
};

export default function CompanyReceipts() {
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [createdReceipts, setCreatedReceipts] = useState<Receipt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNo, setReceiptNo] = useState('');
  const [createStoreId, setCreateStoreId] = useState('');
  const [method, setMethod] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amountReceived, setAmountReceived] = useState(0);
  const [receivedBy, setReceivedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  const createStore = stores.find((s) => s.id === createStoreId);
  const canCreate = !!createStoreId && !!receiptNo && !!method && amountReceived > 0;

function resetCreateForm() {
  setReceiptDate(new Date().toISOString().split('T')[0]);
  setReceiptNo('');
  setCreateStoreId('');
  setMethod('');
  setInvoiceAmount(0);
  setAmountReceived(0);
  setReceivedBy('');
  setRemarks('');
}

function closeCreateForm() {
  setShowCreate(false);
  resetCreateForm();
}

function handleCreateReceipt() {
  if (!canCreate || !createStore) return;
  const newReceipt: Receipt = {
    id: `r-new-${Date.now()}`,
    receiptNo,
    date: receiptDate,
    storeId: createStore.id,
    storeName: createStore.name,
    method,
    invoiceAmount,
    amount: amountReceived,
  };
  setCreatedReceipts((prev) => [newReceipt, ...prev]);
  closeCreateForm();
}

  const filtered = useMemo(
  () =>
    [...createdReceipts, ...receipts].filter((r) => {
      const ms =
        r.receiptNo.toLowerCase().includes(search.toLowerCase()) ||
        r.storeName.toLowerCase().includes(search.toLowerCase());
      const mt = storeFilter === 'all' || r.storeId === storeFilter;
      let md = true;
      if (dateFilter !== 'all') {
        const d = new Date(r.date);
        const now = new Date();
        if (dateFilter === 'week') md = (now.getTime() - d.getTime()) / 86400000 <= 7;
        else if (dateFilter === 'month') md = (now.getTime() - d.getTime()) / 86400000 <= 30;
        else if (dateFilter === 'quarter') md = (now.getTime() - d.getTime()) / 86400000 <= 90;
      }
      return ms && mt && md;
    }),
  [search, storeFilter, dateFilter, createdReceipts],
);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Receipts</h1>
          <p className="text-slate-500 mt-1">Payment receipts collected from stores. Read-only overview.</p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={20} fill /> Create Receipt
        </Button>
        <Button variant="secondary">
          <Icon name="download" size={20} /> Export
        </Button>
      </div>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input value={search} onChange={setSearch} placeholder="Search by receipt no, store, invoice..." icon="search" />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={storeFilter}
              onChange={setStoreFilter}
              placeholder="All Stores"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="All Dates"
              options={[
                { value: 'week', label: 'Last 7 days' },
                { value: 'month', label: 'Last 30 days' },
                { value: 'quarter', label: 'Last 90 days' },
              ]}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="receipt" title="No receipts found" description="Adjust your filters." />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b-2 border-slate-200">

                <th className="w-[16%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                  Receipt Date
                </th>

                <th className="w-[20%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                  Receipt Number
                </th>

                <th className="w-[22%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                  Store Name
                </th>

                <th className="w-[22%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                  Payment Method
                </th>

                <th className="w-[20%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                  Amount Received
                </th>

                <th className="w-[20%] text-center font-semibold px-3 py-3">
                  Balance
                </th>

              </tr>
            </thead>

            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                  } hover:bg-brand-50/40 transition-base`}
                >

                  <td className="px-3 py-3 text-center text-slate-500 border-r border-slate-100">
                    {formatDate(r.date)}
                  </td>

                  <td className="px-3 py-3 text-center font-semibold text-slate-800 border-r border-slate-100">
                    {r.receiptNo}
                  </td>

                  <td className="px-3 py-3 text-center text-slate-700 border-r border-slate-100">
                    {r.storeName}
                  </td>

                  <td className="px-3 py-3 text-center text-slate-600 border-r border-slate-100">
                    {r.method}
                  </td>

                  <td className="px-3 py-3 text-center tabular-nums font-bold text-slate-800 border-r border-slate-100">
                    {formatCurrency(r.amount)}
                  </td>

                  <td className="px-3 py-3 text-center tabular-nums font-bold text-slate-800">
                    {formatCurrency(
                      Math.max(r.invoiceAmount - r.amount, 0)
                    )}
                  </td>

                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* View Receipt modal */}
      <Modal
        open={!!viewReceipt}
        onClose={() => setViewReceipt(null)}
        title="Receipt Details"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewReceipt(null)}>Close</Button>
            <Button onClick={() => window.print()}>
              <Icon name="print" size={18} /> Print Receipt
            </Button>
          </>
        }
      >
        {viewReceipt && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
                <Icon name="receipt" size={24} className="text-brand-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">{viewReceipt.receiptNo}</p>
                <p className="text-sm text-slate-500">{formatDate(viewReceipt.date)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField label="Store Name" value={viewReceipt.storeName} />
              <DetailField label="Payment Method" value={viewReceipt.method} />
              <DetailField label="Amount Received" value={formatCurrency(viewReceipt.amount)} highlight />
            </div>
          </div>
        )}
      </Modal>


        {/* Create Receipt — same popup shell as Credit Note / Sales */}
{showCreate &&
  createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Fixed header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Create Receipt</h2>
            <p className="text-sm text-slate-500 mt-1">Record a payment receipt collected from a store.</p>
          </div>
          <button
            type="button"
            onClick={closeCreateForm}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Receipt Date" type="date" value={receiptDate} onChange={setReceiptDate} required />

            <Input
              label="Receipt Number"
              placeholder="e.g. RCP-3050"
              value={receiptNo}
              onChange={setReceiptNo}
              required
            />

            <Select
              label="Select Store"
              value={createStoreId}
              onChange={setCreateStoreId}
              placeholder="Choose a registered store"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
              required
            />

            <Select
              label="Payment Method"
              value={method}
              onChange={setMethod}
              placeholder="Select method"
              options={methods.map((m) => ({ value: m, label: m }))}
              required
            />

            <Input
              label="Invoice Amount"
              type="number"
              value={String(invoiceAmount)}
              onChange={(v) => setInvoiceAmount(Number(v) || 0)}
              placeholder="Total invoice value"
            />

            <Input
              label="Amount Received"
              type="number"
              value={String(amountReceived)}
              onChange={(v) => setAmountReceived(Number(v) || 0)}
              placeholder="Amount collected now"
              required
            />

            <Select
              label="Received By"
              value={receivedBy}
              onChange={setReceivedBy}
              placeholder="Select staff"
              options={receivers.map((p) => ({ value: p, label: p }))}
            />

            <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Balance</label>
            <div className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-base font-bold text-slate-800">
              {formatCurrency(Math.max(invoiceAmount - amountReceived, 0))}
            </div>
          </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="secondary" onClick={closeCreateForm}>
            Cancel
          </Button>
          <Button onClick={handleCreateReceipt} disabled={!canCreate}>
            <Icon name="save" size={18} />
            Create Receipt
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )}


    </div>
  );
}

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-brand-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
