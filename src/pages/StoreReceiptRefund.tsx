import { useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type Row = {
  id: string;
  date: string;
  referenceNo: string;
  type: "Receipt" | "Refund";
  party: string;
  amount: number;
  mode: string;
};

export default function StoreReceiptRefund({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<Row[]>([
    { id: "1", date: "17 Aug 2026", referenceNo: "RCPT-501", type: "Receipt", party: "Murugan", amount: 5200, mode: "Cash" },
    { id: "2", date: "16 Aug 2026", referenceNo: "REF-101", type: "Refund", party: "Selvam", amount: 800, mode: "UPI" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<"Receipt" | "Refund">("Receipt");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");

  function save() {
    if (!party || !amount || !mode) return;
    setRows((prev) => [{
      id: String(Date.now()),
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      referenceNo: `${type === "Receipt" ? "RCPT" : "REF"}-${500 + prev.length + 1}`,
      type, party, amount: Number(amount), mode,
    }, ...prev]);
    setParty(""); setAmount(""); setMode(""); setShowAdd(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Receipt & Refund</h1>
          <p className="mt-1 text-slate-500">Track collections received and refunds paid to farmers/customers.</p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          <Icon name="add" size={18} /> Add Entry
        </Button>
      </div>

      {showAdd && <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Select label="Type" value={type} onChange={(v) => setType(v as "Receipt" | "Refund")}
            options={[{ value: "Receipt", label: "Receipt" }, { value: "Refund", label: "Refund" }]} />
          <Input label="Party / Farmer" value={party} onChange={setParty} placeholder="Name" />
          <Input label="Amount" type="number" value={amount} onChange={setAmount} placeholder="Amount" />
          <Select label="Payment Mode" value={mode} onChange={setMode} placeholder="Select mode"
            options={["Cash", "UPI", "Bank Transfer", "Card"].map((x) => ({ value: x, label: x }))} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={save}>Save Entry</Button>
        </div>
      </Card>}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Reference No</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">Party / Farmer</th>
              <th className="px-5 py-3 text-left">Mode</th>
              <th className="px-5 py-3 text-right">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => <tr key={r.id}>
                <td className="px-5 py-4">{r.date}</td>
                <td className="px-5 py-4 font-semibold">{r.referenceNo}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.type === "Receipt" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {r.type}
                  </span>
                </td>
                <td className="px-5 py-4">{r.party}</td>
                <td className="px-5 py-4">{r.mode}</td>
                <td className="px-5 py-4 text-right font-bold">{formatCurrency(r.amount)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
