import { useState, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState, Icon } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

type CreditNoteStatus = 'Approved' | 'Pending' | 'Rejected';

type CreditNote = {
  id: string;
  creditNoteNo: string;
  party: string;
  returnDate: string;
  product: string;
  amount: number;
  reason: string;
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
    party: parties[i % parties.length],
    returnDate: d.toISOString().split('T')[0],
    product: productNames[i % productNames.length],
    amount: (1 + (i % 5)) * (300 + (i % 4) * 80),
    reason: reasons[i % reasons.length],
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
            <table className="w-full table-fixed text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="w-[14%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                    Return Date
                  </th>

                  <th className="w-[15%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                    Credit Note No.
                  </th>

                  <th className="w-[20%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                    Customer / Store
                  </th>

                  <th className="w-[16%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                    Returned Product
                  </th>

                  <th className="w-[15%] text-center font-semibold px-3 py-3 border-r border-slate-200">
                    Return Amount
                  </th>

                  <th className="w-[20%] text-center font-semibold px-3 py-3">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-base">
                    <td className="px-3 py-3 text-center text-slate-500 border-r border-slate-100">
                      {formatDate(c.returnDate)}
                    </td>

                    <td className="px-3 py-3 text-center font-semibold text-slate-800 border-r border-slate-100">
                      {c.creditNoteNo}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-700 border-r border-slate-100">
                      {c.party}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.product}
                    </td>

                    <td className="px-3 py-3 text-center font-bold text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.amount)}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-500">
                      {c.reason}
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
