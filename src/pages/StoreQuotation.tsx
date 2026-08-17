import { useState } from "react";
import { Card, Button, Icon, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type Row = { id:string; date:string; quotationNo:string; farmer:string; village:string; amount:number; status:string };

export default function StoreQuotation({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<Row[]>([
    { id:"1", date:"17 Aug 2026", quotationNo:"QT-1001", farmer:"Murugan", village:"Rajapalayam", amount:8200, status:"Open" },
    { id:"2", date:"16 Aug 2026", quotationNo:"QT-1000", farmer:"Selvam", village:"Seithur", amount:5600, status:"Converted" },
  ]);
  const [show,setShow]=useState(false); const [farmer,setFarmer]=useState(""); const [village,setVillage]=useState(""); const [amount,setAmount]=useState("");
  function save(){ if(!farmer||!amount)return; setRows(p=>[{id:String(Date.now()),date:new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),quotationNo:`QT-${1001+p.length}`,farmer,village,amount:Number(amount),status:"Open"},...p]); setFarmer("");setVillage("");setAmount("");setShow(false);}
  return <div>
    <div className="mb-6 flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-800">Quotation</h1><p className="mt-1 text-slate-500">Create and manage farmer quotations.</p></div><Button onClick={()=>setShow(!show)}><Icon name="add" size={18}/> New Quotation</Button></div>
    {show&&<Card className="mb-6 p-5"><div className="grid gap-4 md:grid-cols-3"><Input label="Farmer" value={farmer} onChange={setFarmer}/><Input label="Village" value={village} onChange={setVillage}/><Input label="Amount" type="number" value={amount} onChange={setAmount}/></div><div className="mt-4 flex justify-end"><Button onClick={save}>Save Quotation</Button></div></Card>}
    <Card className="overflow-hidden p-0"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="px-5 py-3 text-left">Date</th><th className="px-5 py-3 text-left">Quotation No</th><th className="px-5 py-3 text-left">Farmer</th><th className="px-5 py-3 text-left">Village</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-left">Status</th></tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.id}><td className="px-5 py-4">{r.date}</td><td className="px-5 py-4 font-semibold">{r.quotationNo}</td><td className="px-5 py-4">{r.farmer}</td><td className="px-5 py-4">{r.village}</td><td className="px-5 py-4 text-right font-bold">{formatCurrency(r.amount)}</td><td className="px-5 py-4">{r.status}</td></tr>)}</tbody></table></Card>
  </div>
}