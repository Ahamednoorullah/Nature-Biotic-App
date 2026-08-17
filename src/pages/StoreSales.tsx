import { Card, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

const directSales = [
  {
    date: "17 Aug 2026",
    invoiceNo: "INV-D-1201",
    farmer: "Murugan",
    village: "Rajapalayam",
    amount: 6200,
  },
  {
    date: "17 Aug 2026",
    invoiceNo: "INV-D-1202",
    farmer: "Selvam",
    village: "Seithur",
    amount: 4800,
  },
  {
    date: "16 Aug 2026",
    invoiceNo: "INV-D-1198",
    farmer: "Kannan",
    village: "Watrap",
    amount: 7500,
  },
];

const executiveSales = [
  {
    date: "17 Aug 2026",
    invoiceNo: "INV-RK-1042",
    executive: "Ram Kumar",
    farmer: "Murugan",
    amount: 6200,
  },
  {
    date: "17 Aug 2026",
    invoiceNo: "INV-AK-842",
    executive: "Ajith Kumar",
    farmer: "Arun",
    amount: 5400,
  },
  {
    date: "16 Aug 2026",
    invoiceNo: "INV-PS-742",
    executive: "PeriyaSamy",
    farmer: "Velu",
    amount: 4900,
  },
];

export default function StoreSales({ storeId }: { storeId: string }) {
  const directTotal = directSales.reduce((s, r) => s + r.amount, 0);
  const executiveTotal = executiveSales.reduce((s, r) => s + r.amount, 0);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Sales
        </h1>
        <p className="mt-1 text-slate-500">
          View store direct sales and executive sales in one place.
        </p>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Summary
          label="Direct Sales"
          value={formatCurrency(directTotal)}
          icon="storefront"
        />
        <Summary
          label="Executive Sales"
          value={formatCurrency(executiveTotal)}
          icon="badge"
        />
        <Summary
          label="Overall Sales"
          value={formatCurrency(directTotal + executiveTotal)}
          icon="payments"
        />
      </div>
      <SalesTable
        title="Direct Sales"
        subtitle="Farmers who purchased directly from the store."
        rows={directSales}
        executive={false}
      />
      <div className="h-6" />
      <SalesTable
        title="Executive Sales"
        subtitle="Sales completed by field executives."
        rows={executiveSales}
        executive
      />
    </div>
  );
}

function SalesTable({
  title,
  subtitle,
  rows,
  executive,
}: {
  title: string;
  subtitle: string;
  rows: any[];
  executive: boolean;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Invoice No</th>
              {executive && <th className="px-5 py-3 text-left">Executive</th>}
              <th className="px-5 py-3 text-left">Farmer</th>
              {!executive && <th className="px-5 py-3 text-left">Village</th>}
              <th className="px-5 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.invoiceNo}>
                <td className="px-5 py-4">{r.date}</td>
                <td className="px-5 py-4 font-semibold">{r.invoiceNo}</td>
                {executive && (
                  <td className="px-5 py-4 font-semibold">{r.executive}</td>
                )}
                <td className="px-5 py-4">{r.farmer}</td>
                {!executive && <td className="px-5 py-4">{r.village}</td>}
                <td className="px-5 py-4 text-right font-bold">
                  {formatCurrency(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function Summary({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon name={icon} size={19} />
        </div>
      </div>
    </Card>
  );
}
