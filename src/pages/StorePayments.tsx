import { useState, useMemo, useEffect } from 'react';
import { Card, Button, Icon, EmptyState, Select, Input } from '@/components/ui';
import { formatCurrency, formatDate, matchesSimpleDate, simpleDateFilterOptions, type SimpleDateFilter } from '@/lib/format';
import type { Payment } from '@/lib/purchaseData';
import { createPortal } from 'react-dom';
import {
  companyRefundsUpdatedEvent,
  getCompanyStorePositions,
  getCompanyRefunds,
} from '@/lib/data';

const vendors = ['Nature Biotic', 'Green Agro Suppliers', 'Sri Lakshmi Traders'];
const methods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
const statuses = ['Paid', 'Pending'];

const statusColor: Record<string, 'green' | 'amber'> = {
  Paid: 'green',
  Pending: 'amber',
  Refund: 'amber',
};

/** Receipts the company recorded from this store, and refunds it paid back. */
function companyPaymentRows(storeId: string): Payment[] {
  let receipts: any[] = [];
  try {
    const raw = localStorage.getItem('nature-biotic-company-receipts-v1');
    const parsed = raw ? JSON.parse(raw) : [];
    receipts = Array.isArray(parsed) ? parsed : [];
  } catch {
    receipts = [];
  }
  const invoiceDue = getCompanyStorePositions().get(storeId)?.invoiceDue;
  const paid: Payment[] = receipts
    .filter((row) => row?.storeId === storeId && Number(row.amount) > 0)
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.receiptNo).localeCompare(String(b.receiptNo), undefined, { numeric: true }),
    )
    .map((row) => {
      const key = String(row.invoiceNo || '').trim().toLowerCase();
      const amount = Number(row.amount || 0);
      const balance = invoiceDue?.has(key)
        ? invoiceDue.get(key) || 0
        : Math.max(0, Number(row.balanceAfter || 0));
      return {
        id: `company-receipt:${row.id || row.receiptNo}`,
        paymentNo: String(row.receiptNo || '-'),
        date: String(row.date || ''),
        vendor: 'Nature Biotic',
        invoiceRef: String(row.invoiceNo || '-'),
        method: row.method,
        amount,
        balance,
        status: 'Paid',
      };
    });
  const refunded: Payment[] = getCompanyRefunds()
    .filter((row) => row.storeId === storeId && Number(row.amount) > 0)
    .map((row) => ({
      id: `company-refund:${row.id}`,
      paymentNo: row.refundNo || row.referenceNo,
      date: row.date,
      vendor: 'Nature Biotic',
      invoiceRef: row.referenceNo,
      method: (row.paymentMethod || '-') as Payment['method'],
      amount: -Number(row.amount || 0),
      balance: 0,
      status: 'Refund' as Payment['status'],
    }));
  return [...paid, ...refunded];
}

export default function StorePayments({ storeId }: { storeId: string }) {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [viewing, setViewing] = useState<Payment | null>(null);
  const [records, setRecords] = useState<Payment[]>([]);
  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const refresh = () => {
      let saved: Payment[] = [];
      try {
        const raw = localStorage.getItem(`naturebiotic:purchase-payments:${storeId}`);
        const parsed = raw ? JSON.parse(raw) : [];
        saved = Array.isArray(parsed) ? parsed : [];
      } catch {
        saved = [];
      }
      setRecords(
        [...saved, ...companyPaymentRows(storeId)].sort((a, b) =>
          String(b.date).localeCompare(String(a.date)),
        ),
      );
    };
    refresh();
    window.addEventListener('nature-biotic-company-receipts-updated', refresh);
    window.addEventListener(companyRefundsUpdatedEvent, refresh);
    window.addEventListener('store-approval-requests-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('nature-biotic-company-receipts-updated', refresh);
      window.removeEventListener(companyRefundsUpdatedEvent, refresh);
      window.removeEventListener('store-approval-requests-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [storeId]);

  const dated = useMemo(
    () => records.filter((p) => matchesSimpleDate(p.date, dateFilter, customFrom, customTo)),
    [records, dateFilter, customFrom, customTo],
  );

  const filtered = useMemo(
    () =>
      dated.filter((p) => {
        const ms =
          p.paymentNo.toLowerCase().includes(search.toLowerCase()) ||
          p.vendor.toLowerCase().includes(search.toLowerCase()) ||
          p.invoiceRef.toLowerCase().includes(search.toLowerCase());
        const mv = vendorFilter === 'all' || p.vendor === vendorFilter;
        const mm = methodFilter === 'all' || p.method === methodFilter;
        return ms && mv && mm;
      }),
    [dated, search, vendorFilter, methodFilter],
  );

  const totalPayable = dated.reduce(
    (s, p) => (p.amount < 0 ? s : s + p.amount + p.balance),
    0,
  );
  const paid = dated.reduce((s, p) => s + p.amount, 0);
  const pending = useMemo(() => {
    const companyLatest = new Map<string, number>();
    let saved = 0;
    dated.forEach((p) => {
      if (!p.id.startsWith('company-receipt:')) {
        saved += p.balance;
        return;
      }
      const key = p.invoiceRef.toLowerCase();
      companyLatest.set(key, Math.min(companyLatest.get(key) ?? Infinity, p.balance));
    });
    return saved + [...companyLatest.values()].reduce((s, b) => s + b, 0);
  }, [dated]);
  const today = new Date().toISOString().split('T')[0];
  const paymentsToday = dated.filter((p) => p.date === today).length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Payments</h1>
          <p className="mt-1 text-slate-500">Purchase payments made to vendors and suppliers.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
          <div className="w-full sm:w-44">
            <Select
              label="Date Filter"
              value={dateFilter}
              onChange={(value) => setDateFilter(value as SimpleDateFilter)}
              options={simpleDateFilterOptions}
            />
          </div>
          {dateFilter === "custom" && (
            <>
              <div className="w-full sm:w-40">
                <Input label="From Date" type="date" value={customFrom} onChange={setCustomFrom} />
              </div>
              <div className="w-full sm:w-40">
                <Input label="To Date" type="date" value={customTo} onChange={setCustomTo} />
              </div>
            </>
          )}
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
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm border-collapse">
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

      {viewing &&
  createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Payment Details</h2>
            <p className="mt-1 text-sm text-slate-500">{viewing.paymentNo}</p>
          </div>
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Payment No" value={viewing.paymentNo} />
            <Detail label="Date" value={formatDate(viewing.date)} />
            <Detail label="Vendor" value={viewing.vendor} />
            <Detail label="Invoice Ref" value={viewing.invoiceRef} />
            <Detail label="Payment Method" value={viewing.method} />
            <Detail label="Amount" value={formatCurrency(viewing.amount)} />
            <Detail label="Balance" value={formatCurrency(viewing.balance)} />
            <Detail label="Status" value={viewing.status} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
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


