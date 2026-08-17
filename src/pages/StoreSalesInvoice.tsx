import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
const rows=[
 {date:"17 Aug 2026",invoiceNo:"INV-D-1201",type:"Direct",farmer:"Murugan",executive:"-",amount:6200},
 {date:"17 Aug 2026",invoiceNo:"INV-RK-1042",type:"Executive",farmer:"Selvam",executive:"Ram Kumar",amount:4800},
 {date:"16 Aug 2026",invoiceNo:"INV-AK-842",type:"Executive",farmer:"Arun",executive:"Ajith Kumar",amount:5400},
];
export default function StoreSalesInvoice({storeId}:{storeId:string}) {
 return <div><div className="mb-6"><h1 className="text-2xl font-bold text-slate-800">Sales Invoice</h1><p className="mt-1 text-slate-500">Direct and executive sales invoices.</p></div>
 <Card className="overflow-hidden p-0"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="px-5 py-3 text-left">Date</th><th className="px-5 py-3 text-left">Invoice No</th><th className="px-5 py-3 text-left">Type</th><th className="px-5 py-3 text-left">Farmer</th><th className="px-5 py-3 text-left">Executive</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.invoiceNo}><td className="px-5 py-4">{r.date}</td><td className="px-5 py-4 font-semibold">{r.invoiceNo}</td><td className="px-5 py-4">{r.type}</td><td className="px-5 py-4">{r.farmer}</td><td className="px-5 py-4">{r.executive}</td><td className="px-5 py-4 text-right font-bold">{formatCurrency(r.amount)}</td></tr>)}</tbody></table></Card></div>
}