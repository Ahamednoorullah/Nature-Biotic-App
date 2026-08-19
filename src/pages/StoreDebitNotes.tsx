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
  reason: string;
  placeOfReturn: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  returnAmount: number;
  status: "Pending" | "Approved" | "Rejected";
};

const vendors = ["Nature Biotic"];
const statuses = ["Pending", "Approved", "Rejected"];

export default function StoreDebitNotes({ storeId }: { storeId: string }) {
  const mapSyncRows = (rows: CompanyCreditNoteSyncRecord[]): DebitNote[] =>
    rows.map((row) => {
      const source = row as any;
      const total = Number(source.total ?? source.returnAmount ?? 0);
      const sgst = Number(source.sgst ?? 0);
      const cgst = Number(source.cgst ?? 0);
      const igst = Number(source.igst ?? 0);
      const withoutTax = Number(
        source.amount ??
          source.withoutTax ??
          Math.max(0, total - sgst - cgst - igst),
      );

      return {
        id: source.id,
        debitNoteNo: source.creditNoteNo,
        date: source.returnDate,
        vendor: "Nature Biotic",
        purchaseRef: source.purchaseRef ?? source.creditNoteNo,
        product: source.product ?? "-",
        quantity: Number(source.quantity ?? 0),
        reason: source.reason ?? "Product Return",
        placeOfReturn:
          source.placeofreturn ??
          source.placeOfReturn ??
          source.storeLocation?.split?.(",")?.[0] ??
          "-",
        withoutTax,
        sgst,
        cgst,
        igst,
        returnAmount: total,
        status: "Pending",
      };
    });

  const [allNotes, setAllNotes] = useState<DebitNote[]>(() =>
    mapSyncRows(getStoreDebitNotesFromCompanyCredits(storeId)),
  );

  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDebitNoteNo, setSelectedDebitNoteNo] = useState<string | null>(
    null,
  );

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

  const groupedNotes = useMemo(() => {
    const map = new Map<string, any>();

    filtered.forEach((note) => {
      const existing = map.get(note.debitNoteNo);
      if (existing) {
        existing.withoutTax += note.withoutTax;
        existing.sgst += note.sgst;
        existing.cgst += note.cgst;
        existing.igst += note.igst;
        existing.total += note.returnAmount;
        existing.quantity += note.quantity;
        existing.items.push(note);
      } else {
        map.set(note.debitNoteNo, {
          debitNoteNo: note.debitNoteNo,
          date: note.date,
          vendor: note.vendor,
          placeOfReturn: note.placeOfReturn,
          purchaseRef: note.purchaseRef,
          withoutTax: note.withoutTax,
          sgst: note.sgst,
          cgst: note.cgst,
          igst: note.igst,
          total: note.returnAmount,
          quantity: note.quantity,
          status: note.status,
          items: [note],
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [filtered]);

  const allGroupedNotes = useMemo(() => {
    const map = new Map<string, DebitNote[]>();
    allNotes.forEach((note) => {
      const list = map.get(note.debitNoteNo) ?? [];
      list.push(note);
      map.set(note.debitNoteNo, list);
    });
    return map;
  }, [allNotes]);

  const totalNotes = allGroupedNotes.size;
  const totalReturnValue = allNotes.reduce((s, n) => s + n.returnAmount, 0);
  const pending = Array.from(allGroupedNotes.values()).filter((items) =>
    items.some((item) => item.status === "Pending"),
  ).length;
  const approved = Array.from(allGroupedNotes.values()).filter((items) =>
    items.every((item) => item.status === "Approved"),
  ).length;

  const selectedItems = selectedDebitNoteNo
    ? allNotes.filter((note) => note.debitNoteNo === selectedDebitNoteNo)
    : [];

  const selectedSummary = selectedItems.length
    ? {
        debitNoteNo: selectedItems[0].debitNoteNo,
        date: selectedItems[0].date,
        vendor: selectedItems[0].vendor,
        purchaseRef: selectedItems[0].purchaseRef,
        placeOfReturn: selectedItems[0].placeOfReturn,
        status: selectedItems.every((item) => item.status === "Approved")
          ? "Approved"
          : "Pending",
        withoutTax: selectedItems.reduce(
          (sum, item) => sum + item.withoutTax,
          0,
        ),
        sgst: selectedItems.reduce((sum, item) => sum + item.sgst, 0),
        cgst: selectedItems.reduce((sum, item) => sum + item.cgst, 0),
        igst: selectedItems.reduce((sum, item) => sum + item.igst, 0),
        total: selectedItems.reduce((sum, item) => sum + item.returnAmount, 0),
      }
    : null;

  function approveDebitNoteGroup(debitNoteNo: string) {
    setAllNotes((prev) =>
      prev.map((note) =>
        note.debitNoteNo === debitNoteNo
          ? { ...note, status: "Approved" as const }
          : note,
      ),
    );
  }

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

      {groupedNotes.length === 0 ? (
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
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th
                    rowSpan={2}
                    className="w-[5%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[10%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Return Date
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[13%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Debit Note No.
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Vendor
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Place of Return
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[11%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Without Tax
                  </th>
                  <th
                    colSpan={3}
                    className="w-[21%] px-2 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    Tax
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[9%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Total
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[7%] px-2 py-3 text-center font-semibold"
                  >
                    Status
                  </th>
                </tr>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    SGST
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    CGST
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    IGST
                  </th>
                </tr>
              </thead>

              <tbody>
                {groupedNotes.map((note: any, i: number) => (
                  <tr
                    key={note.debitNoteNo}
                    onClick={() => setSelectedDebitNoteNo(note.debitNoteNo)}
                    className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    } transition hover:bg-brand-50/40`}
                    title="Click to view debit note details"
                  >
                    <td className="px-2 py-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                      {i + 1}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-500 border-r border-slate-100 whitespace-nowrap">
                      {formatDate(note.date)}
                    </td>
                    <td className="px-2 py-3 text-center font-semibold text-slate-800 border-r border-slate-100 truncate">
                      {note.debitNoteNo}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-700 border-r border-slate-100 truncate">
                      {note.vendor}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 border-r border-slate-100 truncate">
                      {note.placeOfReturn}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.withoutTax)}
                    </td>
                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.sgst)}
                    </td>
                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.cgst)}
                    </td>
                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.igst)}
                    </td>
                    <td className="px-2 py-3 text-center font-bold text-slate-700 border-r border-slate-100">
                      {formatCurrency(note.total)}
                    </td>
                    <td className="px-1 py-3 text-center">
                      {note.status === "Pending" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            approveDebitNoteGroup(note.debitNoteNo);
                          }}
                          className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"
                          title="Click to approve"
                        >
                          Pending
                        </button>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
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

      {selectedSummary && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 px-7 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                  Debit Note Details
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-800">
                  {selectedSummary.debitNoteNo}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Company Credit Note → Store Debit Note
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDebitNoteNo(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
              >
                <Icon name="close" size={21} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-7">
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Detail
                  label="Debit Note No"
                  value={selectedSummary.debitNoteNo}
                />
                <Detail
                  label="Return Date"
                  value={formatDate(selectedSummary.date)}
                />
                <Detail label="Vendor" value={selectedSummary.vendor} />
                <Detail
                  label="Purchase Ref"
                  value={selectedSummary.purchaseRef}
                />
                <Detail
                  label="Place of Return"
                  value={selectedSummary.placeOfReturn}
                />
                <Detail
                  label="No. of Products"
                  value={String(selectedItems.length)}
                />
                <Detail
                  label="Total Quantity"
                  value={String(
                    selectedItems.reduce((sum, item) => sum + item.quantity, 0),
                  )}
                />
                <Detail label="Status" value={selectedSummary.status} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h3 className="font-bold text-slate-800">
                    Returned Product Details
                  </h3>
                </div>
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-[7%] px-2 py-3 text-center">S.No</th>
                      <th className="w-[25%] px-3 py-3 text-left">Product</th>
                      <th className="w-[10%] px-2 py-3 text-center">Qty</th>
                      <th className="w-[14%] px-2 py-3 text-right">
                        Without Tax
                      </th>
                      <th className="w-[10%] px-2 py-3 text-right">SGST</th>
                      <th className="w-[10%] px-2 py-3 text-right">CGST</th>
                      <th className="w-[10%] px-2 py-3 text-right">IGST</th>
                      <th className="w-[14%] px-2 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedItems.map((item, index) => (
                      <tr key={item.id}>
                        <td className="px-2 py-3 text-center text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-800">
                            {item.product}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {item.reason}
                          </p>
                        </td>
                        <td className="px-2 py-3 text-center font-semibold text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-600">
                          {formatCurrency(item.withoutTax)}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-600">
                          {formatCurrency(item.sgst)}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-600">
                          {formatCurrency(item.cgst)}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-600">
                          {formatCurrency(item.igst)}
                        </td>
                        <td className="px-2 py-3 text-right font-bold text-slate-800">
                          {formatCurrency(item.returnAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 ml-auto w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <TotalRow
                  label="Without Tax"
                  value={formatCurrency(selectedSummary.withoutTax)}
                />
                <TotalRow
                  label="SGST"
                  value={formatCurrency(selectedSummary.sgst)}
                />
                <TotalRow
                  label="CGST"
                  value={formatCurrency(selectedSummary.cgst)}
                />
                <TotalRow
                  label="IGST"
                  value={formatCurrency(selectedSummary.igst)}
                />
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <TotalRow
                    label="Grand Total"
                    value={formatCurrency(selectedSummary.total)}
                    bold
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-4">
              {selectedSummary.status === "Pending" && (
                <button
                  type="button"
                  onClick={() => {
                    approveDebitNoteGroup(selectedSummary.debitNoteNo);
                    setSelectedDebitNoteNo(null);
                  }}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Approve Debit Note
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDebitNoteNo(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate font-bold text-slate-800">{value}</p>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={bold ? "font-bold text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={
          bold
            ? "text-lg font-bold text-slate-900"
            : "font-semibold text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}
