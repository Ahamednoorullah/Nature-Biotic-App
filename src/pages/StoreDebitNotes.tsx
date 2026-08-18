import { useState, useMemo, useEffect } from "react";
import { Card, Button, Icon, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getStoreDebitNotesFromCompanyCredits,
  type CompanyCreditNoteRecord,
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
const reasons = [
  "Damaged Product",
  "Wrong Quantity",
  "Expired Product",
  "Rate Difference",
];
const statuses = ["Pending", "Approved", "Rejected"];

const statusColor: Record<string, "green" | "amber" | "red"> = {
  Approved: "green",
  Pending: "amber",
  Rejected: "red",
};

export default function StoreDebitNotes({ storeId }: { storeId: string }) {
  const [allNotes, setAllNotes] = useState<DebitNote[]>(() =>
    getStoreDebitNotesFromCompanyCredits(storeId).map(
      (n: CompanyCreditNoteRecord) => ({
        id: n.id,
        debitNoteNo: n.creditNoteNo,
        date: n.returnDate,
        vendor: "Nature Biotic",
        purchaseRef: n.purchaseRef,
        product: n.product,
        quantity: n.quantity,
        returnAmount: n.total,
        reason: n.reason,
        status: n.status,
      }),
    ),
  );
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState<DebitNote | null>(null);

  useEffect(() => {
    const refresh = () => {
      setAllNotes(
        getStoreDebitNotesFromCompanyCredits(storeId).map(
          (n: CompanyCreditNoteRecord) => ({
            id: n.id,
            debitNoteNo: n.creditNoteNo,
            date: n.returnDate,
            vendor: "Nature Biotic",
            purchaseRef: n.purchaseRef,
            product: n.product,
            quantity: n.quantity,
            returnAmount: n.total,
            reason: n.reason,
            status: n.status,
          }),
        ),
      );
    };

    refresh();
    window.addEventListener("company-credit-notes-updated", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("company-credit-notes-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [storeId]);

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
    [search, vendorFilter, statusFilter],
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b-2 border-slate-200">
                  {[
                    "Debit Note No",
                    "Date",
                    "Vendor",
                    "Purchase Ref",
                    "Product",
                    "Quantity",
                    "Return Amount",
                    "Reason",
                    "Status",
                    "View",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`font-semibold px-3 py-3 border-r border-slate-200 last:border-r-0 ${i === 5 || i === 6 ? "text-right" : i === 9 ? "text-center" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => (
                  <tr
                    key={n.id}
                    className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-brand-50/40 transition-base`}
                  >
                    <td className="px-3 py-3 border-r border-slate-100 font-semibold text-slate-800">
                      {n.debitNoteNo}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-500">
                      {formatDate(n.date)}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-700">
                      {n.vendor}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">
                      {n.purchaseRef}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">
                      {n.product}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">
                      {n.quantity}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700">
                      {formatCurrency(n.returnAmount)}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-slate-600">
                      {n.reason}
                    </td>
                    <td className="px-3 py-3 border-r border-slate-100 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          statusColor[n.status] === "green"
                            ? "bg-brand-50 text-brand-700"
                            : statusColor[n.status] === "amber"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-red-50 text-red-600"
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => setViewing(n)}
                        className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base"
                        title="View"
                      >
                        <Icon name="visibility" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setViewing(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Debit Note Detail
              </h3>
              <button
                onClick={() => setViewing(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-base"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              <Detail label="Debit Note No" value={viewing.debitNoteNo} />
              <Detail label="Date" value={formatDate(viewing.date)} />
              <Detail label="Vendor" value={viewing.vendor} />
              <Detail label="Purchase Ref" value={viewing.purchaseRef} />
              <Detail label="Product" value={viewing.product} />
              <Detail label="Quantity" value={String(viewing.quantity)} />
              <Detail
                label="Return Amount"
                value={formatCurrency(viewing.returnAmount)}
              />
              <Detail label="Reason" value={viewing.reason} />
              <Detail label="Status" value={viewing.status} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
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
