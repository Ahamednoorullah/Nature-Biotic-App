import { formatCurrency } from "@/lib/format";

const rows=[
 {date:"17/08/26",invoiceNo:"nb-inv-2001",through:"Direct",placeOfSupply:"Tamil Nadu",withoutTax:2232,sgst:133.92,cgst:133.92,igst:0,amount:2499.84},
];

export default function StoreSalesInvoice({storeId}:{storeId:string}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Sales Invoice</h1>
        <p className="mt-1 text-slate-500">Direct and executive sales invoices.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th rowSpan={2} className="w-[60px] text-left font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">S.No</th>
              <th rowSpan={2} className="w-[110px] text-center font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">Date</th>
              <th rowSpan={2} className="w-[140px] text-center font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">Invoice No</th>
              <th rowSpan={2} className="w-[110px] text-center font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">Through</th>
              <th rowSpan={2} className="w-[150px] text-center font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">Place of Supply</th>
              <th rowSpan={2} className="w-[130px] text-right font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">Without Tax</th>
              <th colSpan={3} className="text-center font-semibold px-3 py-2 border-b border-slate-200">Tax</th>
              <th rowSpan={2} className="w-[130px] text-right font-semibold px-3 py-2.5 border-b border align-middle border-b border-slate-200">Total</th>
            </tr>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <th className="w-[100px] text-right font-semibold px-3 py-2 border-b border border-l border-slate-200">SGST</th>
              <th className="w-[100px] text-right font-semibold px-3 py-2 border-b border">CGST</th>
              <th className="w-[100px] text-right font-semibold px-3 py-2 border-b border">IGST</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.invoiceNo}
                className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-brand-50/30 transition-base`}
              >
                <td className="px-3 py-2.5 text-center text-slate-500 font-medium ">{i + 1}</td>
                <td className="px-3 py-2.5 text-center border-b border text-slate-500">{r.date}</td>
                <td className="px-3 py-2.5 text-center border-b border font-semibold text-slate-800">{r.invoiceNo}</td>
                <td className="px-3 py-2.5 text-center border-b border text-slate-600">{r.through}</td>
                <td className="px-3 py-2.5 text-center  border-b border text-slate-600">{r.placeOfSupply}</td>
                <td className="px-3 py-2.5 border-b border text-right tabular-nums font-semibold text-slate-800">{formatCurrency(r.withoutTax)}</td>
                <td className="px-3 py-2.5 border-b border text-right tabular-nums text-slate-600">{formatCurrency(r.sgst)}</td>
                <td className="px-3 py-2.5 border-b border text-right tabular-nums text-slate-600">{formatCurrency(r.cgst)}</td>
                <td className="px-3 py-2.5 border-b border text-right tabular-nums text-slate-600">{formatCurrency(r.igst)}</td>
                <td className="px-3 py-2.5 border-b border text-right tabular-nums font-bold text-slate-800">{formatCurrency(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}