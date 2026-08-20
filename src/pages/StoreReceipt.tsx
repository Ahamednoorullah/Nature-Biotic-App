import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
const rows=[{date:"17 Aug 2026",no:"RCPT-501",farmer:"Murugan",mode:"Cash",amount:5200},{date:"17 Aug 2026",no:"RCPT-502",farmer:"Selvam",mode:"UPI",amount:4300}];
export default function StoreReceipt({storeId}:{storeId:string}){return <div>
    <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Receipt</h1>
        <p className="mt-1 text-slate-500">Store collection receipt details.</p>
        </div><Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
            <thead>
                <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-5 py-3 border-b border text-left">Date</th>
                <th className="px-5 py-3 border-b border text-left">Receipt No</th>
                <th className="px-5 py-3 border-b border text-left">Farmer</th>
                <th className="px-5 py-3 border-b border text-left">Mode</th>
                <th className="px-5 py-3 border-b border text-right">Amount</th>
                </tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.no}>
                    <td className="px-5 py-4 border-b border">{r.date}</td>
                    <td className="px-5 py-4 border-b border font-semibold">{r.no}</td>
                    <td className="px-5 py-4 border-b border">{r.farmer}</td>
                    <td className="px-5 py-4 border-b border">{r.mode}</td>
                    <td className="px-5 py-4 border-b border text-right font-bold">{formatCurrency(r.amount)}</td></tr>)}</tbody></table></Card></div>}