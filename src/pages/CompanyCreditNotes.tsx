import { useState, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

type CreditNoteStatus = 'Approved' | 'Pending' | 'Rejected';

type CreditNote = {
  id: string;
  creditNoteNo: string;
  originalInvoiceNo: string;
  party: string;
  returnDate: string;
  product: string;
  quantity: number;
  amount: number;
  reason: string;
  status: CreditNoteStatus;
};

const productNames = ['Electra', 'Aalga', 'Astra', 'Alpha', 'Neutra', 'Rootra', 'Ultra'];
const parties = ['Murugan Farms', 'Sairam Agri Inputs', 'Selvam Agri Mart', 'Karthikeyan Estates', 'Green Harvest Agro'];
const reasons = ['Damaged Product', 'Expired Stock', 'Wrong Item Supplied', 'Quality Issue', 'Customer Return'];
const statuses: CreditNoteStatus[] = ['Approved', 'Pending', 'Rejected'];

const creditNotes: CreditNote[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 3 + 1));
  return {
    id: `cn${i}`,
    creditNoteNo: `CN-${String(2001 + i)}`,
    originalInvoiceNo: `NB-DIR-${String(1001 + (i * 2))}`,
    party: parties[i % parties.length],
    returnDate: d.toISOString().split('T')[0],
    product: productNames[i % productNames.length],
    quantity: 1 + (i % 5),
    amount: (1 + (i % 5)) * (300 + (i % 4) * 80),
    reason: reasons[i % reasons.length],
    status: statuses[i % 3],
  };
});

const statusColor: Record<CreditNoteStatus, 'green' | 'amber' | 'red'> = {
  Approved: 'green',
  Pending: 'amber',
  Rejected: 'red',
};

export default function CompanyCreditNotes() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      creditNotes.filter(
        (c) =>
          c.creditNoteNo.toLowerCase().includes(search.toLowerCase()) ||
          c.originalInvoiceNo.toLowerCase().includes(search.toLowerCase()) ||
          c.party.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Credit Notes (Returns)</h1>
          <p className="text-slate-500 mt-1">Manage product returns and credit note records.</p>
        </div>
        <Button>
          <Icon name="add" size={20} fill /> Create Credit Note
        </Button>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex-1 max-w-md">
          <Input value={search} onChange={setSearch} placeholder="Search by credit note, invoice, party..." icon="search" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="undo" title="No credit notes found" description="Adjust your search or create a new credit note." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3.5">Credit Note No.</th>
                  <th className="text-left font-semibold px-5 py-3.5">Original Invoice</th>
                  <th className="text-left font-semibold px-5 py-3.5">Customer / Store</th>
                  <th className="text-left font-semibold px-5 py-3.5">Return Date</th>
                  <th className="text-left font-semibold px-5 py-3.5">Returned Product</th>
                  <th className="text-right font-semibold px-5 py-3.5">Qty</th>
                  <th className="text-right font-semibold px-5 py-3.5">Return Amount</th>
                  <th className="text-left font-semibold px-5 py-3.5">Reason</th>
                  <th className="text-center font-semibold px-5 py-3.5">Status</th>
                  <th className="text-center font-semibold px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-base">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{c.creditNoteNo}</td>
                    <td className="px-5 py-3.5 text-slate-500">{c.originalInvoiceNo}</td>
                    <td className="px-5 py-3.5 text-slate-700">{c.party}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(c.returnDate)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.product}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{c.quantity}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800">{formatCurrency(c.amount)}</td>
                    <td className="px-5 py-3.5 text-slate-500">{c.reason}</td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={statusColor[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base" title="View">
                          <Icon name="visibility" size={18} />
                        </button>
                        <button className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-base" title="Delete">
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
    </div>
  );
}
