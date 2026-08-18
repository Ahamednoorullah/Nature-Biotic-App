import { useState, useMemo, useEffect } from "react";
import { Card, Button, Icon, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getStoreDebitNotesFromCompanyCredits,
  type CompanyCreditNoteSyncRecord,
} from "@/lib/data";

type DebitNote = {
  id: string;
  debitNoteNo: string;
  date: string;
  vendor: string;
  purchaseRef: string;
  product: string;
  quantity: number;
  returnAmount: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
};

const vendors = ["Nature Biotic"];
const statuses = ["Pending", "Approved", "Rejected"];

export default function StoreDebitNotes({ storeId }: { storeId: string }) {
  const mapSyncRows = (rows: CompanyCreditNoteSyncRecord[]): DebitNote[] =>
    rows.map((row) => ({
      id: row.id,
      debitNoteNo: row.creditNoteNo,
      date: row.returnDate,
      vendor: "Nature Biotic",
      purchaseRef: row.purchaseRef,
      product: row.product,
      quantity: row.quantity,
      returnAmount: row.returnAmount,
      reason: row.reason,
      status: "Pending",
    }));

  const [allNotes, setAllNotes] = useState<DebitNote[]>(() =>
    mapSyncRows(getStoreDebitNotesFromCompanyCredits(storeId)),
  );

  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const refresh = () => {
      setAllNotes(mapSyncRows(getStoreDebitNotesFromCompanyCredits(storeId)));
    };

    refresh();
    window.addEventListener("company-credit-note-sync-updated", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("company-credit-note-sync-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [storeId]);

  function approveDebitNote(id: string) {
    setAllNotes((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, status: "Approved" } : note,
      ),
    );
  }

  const filtered = useMemo(
    () =>
      allNotes.filter((n) => {
        const ms =
          n.debitNoteNo.toLowerCase().includes(search.toLowerCase()) ||
          n.vendor.toLowerCase().includes(search.toLowerCase()) ||
          n.purchaseRef.toLowerCase().includes(search.toLowerCase()) ||
          n.product.toLowerCase().includes(search.toLowerCase());
        const mv = vendorFilter === "all" || n.vendor === vendorFilter;
        const ms2 = statusFilter === "all" || n.status === statusFilter;
        return ms && mv && ms2;
      }),
    [search, vendorFilter, statusFilter, allNotes],
  );

  const totalNotes = allNotes.length;
  const totalReturnValue = allNotes.reduce((s, n) => s + n.returnAmount, 0);
  const pending = allNotes.filter((n) => n.status === "Pending").length;
  const approved = allNotes.filter((n) => n.status === "Approved").length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Debit Notes
          </h1>
          <p className="text-slate-500 mt-1">
            Purchase return notes raised against vendors.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Total Debit Notes
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {totalNotes}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Icon name="request_quote" size={22} className="text-brand-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Total Return Value
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatCurrency(totalReturnValue)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Icon name="undo" size={22} className="text-amber-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Pending</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {pending}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Icon name="pending" size={22} className="text-amber-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Approved</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {approved}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Icon
                name="check_circle"
                size={22}
                className="text-emerald-600"
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <span
                className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                style={{ fontSize: 20 }}
              >
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search debit notes..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-48">
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
              >
                <option value="all">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setVendorFilter("all");
                setStatusFilter("all");
              }}
            >
              <Icon name="filter_alt_off" size={18} /> Clear
            </Button>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="request_quote"
            title="No debit notes found"
            description="Adjust your search or filters to find debit notes."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full">
            <table className="w-full table-fixed text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b-2 border-slate-200">
                  <th className="w-[11%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Debit Note No
                  </th>
                  <th className="w-[10%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Date
                  </th>
                  <th className="w-[12%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Vendor
                  </th>
                  <th className="w-[11%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Purchase Ref
                  </th>
                  <th className="w-[14%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Product
                  </th>
                  <th className="w-[7%] px-2 py-3 text-center font-semibold border-r border-slate-200">
                    Qty
                  </th>
                  <th className="w-[11%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                    Return Amount
                  </th>
                  <th className="w-[14%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Reason
                  </th>
                  <th className="w-[10%] px-2 py-3 text-center font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => (
                  <tr
                    key={n.id}
                    className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-brand-50/40 transition-base`}
                  >
                    <td className="px-2 py-3 border-r border-slate-100 font-semibold text-slate-800 truncate">
                      {n.debitNoteNo}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-500 whitespace-nowrap">
                      {formatDate(n.date)}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-700 truncate">
                      {n.vendor}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-600 truncate">
                      {n.purchaseRef}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-600 truncate">
                      {n.product}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-center tabular-nums text-slate-600">
                      {n.quantity}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700">
                      {formatCurrency(n.returnAmount)}
                    </td>
                    <td className="px-2 py-3 border-r border-slate-100 text-slate-600 truncate">
                      {n.reason}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {n.status === "Pending" ? (
                        <button
                          type="button"
                          onClick={() => approveDebitNote(n.id)}
                          className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                          title="Click to approve"
                        >
                          Pending
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          Approved
                        </span>
                      )}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
