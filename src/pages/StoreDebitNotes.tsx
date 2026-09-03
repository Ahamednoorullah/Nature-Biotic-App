import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, EmptyState, Input, Select } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getStoreDebitNotesFromCompanyCredits,
  type CompanyCreditNoteSyncRecord,
} from "@/lib/data";

type DebitNote = {
  total: number;
  amount: number;
  sellingPrice: number;
  id: string;
  debitNoteNo: string;
  date: string;
  vendor: string;
  purchaseRef: string;
  product: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  reason: string;
  placeOfReturn: string;
  unitPrice: number;
  beforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
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
      const unitPrice = Number(
        source.unitPrice ?? source.sellingPrice ?? source.price ?? 0,
      );

      const beforeDiscount = Number(
        source.beforeDiscount ??
          (unitPrice > 0 ? unitPrice * Number(source.quantity ?? 0) : 0),
      );

      const discountPercent = Number(
        source.discountPercent ?? source.discount ?? 0,
      );

      const discountAmount = Number(
        source.discountAmount ?? (beforeDiscount * discountPercent) / 100,
      );

      const taxableAmount = Number(
        source.taxableAmount ??
          source.amount ??
          source.withoutTax ??
          Math.max(
            0,
            beforeDiscount > 0
              ? beforeDiscount - discountAmount
              : total - sgst - cgst - igst,
          ),
      );

      const withoutTax = taxableAmount;

      return {
        total,
        amount: taxableAmount,
        sellingPrice: unitPrice,
        id: source.id,
        debitNoteNo: source.creditNoteNo,
        date: source.returnDate,
        vendor: "Nature Biotic",
        purchaseRef: source.purchaseRef ?? source.creditNoteNo,
        product: source.product ?? "-",
        batchNo:
          source.batchNo ??
          source.batchId ??
          source.batchID ??
          "-",
        expiryDate:
          source.expiryDate ??
          source.expDate ??
          source.expiry ??
          "",
        quantity: Number(source.quantity ?? 0),
        reason: source.reason ?? "Product Return",
        placeOfReturn:
          source.placeofreturn ??
          source.placeOfReturn ??
          source.storeLocation?.split?.(",")?.[0] ??
          "-",
        unitPrice,
        beforeDiscount,
        discountPercent,
        discountAmount,
        taxableAmount,
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
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date();
    const normalize = (value: string) => new Date(`${value}T00:00:00`);

    const matchesDate = (value: string) => {
      const rowDate = normalize(value);

      if (dateFilter === "all") return true;

      if (dateFilter === "today") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowDate.getMonth() === today.getMonth() &&
          rowDate.getDate() === today.getDate()
        );
      }

      if (dateFilter === "monthly") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowDate.getMonth() === today.getMonth()
        );
      }

      if (dateFilter === "quarterly") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          Math.floor(rowDate.getMonth() / 3) ===
            Math.floor(today.getMonth() / 3)
        );
      }

      if (dateFilter === "yearly") {
        return rowDate.getFullYear() === today.getFullYear();
      }

      if (dateFilter === "custom") {
        if (!customFrom && !customTo) return true;

        const from = customFrom ? normalize(customFrom) : null;
        const to = customTo ? normalize(customTo) : null;

        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
      }

      return true;
    };

    return allNotes.filter((n) => {
      const matchesSearch =
        !q ||
        n.debitNoteNo.toLowerCase().includes(q) ||
        n.vendor.toLowerCase().includes(q) ||
        n.purchaseRef.toLowerCase().includes(q) ||
        n.product.toLowerCase().includes(q);

      const matchesVendor = vendorFilter === "all" || n.vendor === vendorFilter;
      const matchesStatus = statusFilter === "all" || n.status === statusFilter;

      return (
        matchesSearch && matchesVendor && matchesStatus && matchesDate(n.date)
      );
    });
  }, [
    search,
    vendorFilter,
    statusFilter,
    dateFilter,
    customFrom,
    customTo,
    allNotes,
  ]);

  const groupedNotes = useMemo(() => {
    const map = new Map<string, any>();

    filtered.forEach((note) => {
      const existing = map.get(note.debitNoteNo);
      if (existing) {
        existing.beforeDiscount += note.beforeDiscount;
        existing.discountAmount += note.discountAmount;
        existing.taxableAmount += note.taxableAmount;
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
          beforeDiscount: note.beforeDiscount,
          discountAmount: note.discountAmount,
          taxableAmount: note.taxableAmount,
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
        beforeDiscount: selectedItems.reduce(
          (sum, item) => sum + item.beforeDiscount,
          0,
        ),
        discountAmount: selectedItems.reduce(
          (sum, item) => sum + item.discountAmount,
          0,
        ),
        taxableAmount: selectedItems.reduce(
          (sum, item) => sum + item.taxableAmount,
          0,
        ),
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

    function numberToWords(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    }
    if (n < 1000) {
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + convert(n % 100) : "")
      );
    }
    if (n < 100000) {
      return (
        convert(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 ? " " + convert(n % 1000) : "")
      );
    }
    if (n < 10000000) {
      return (
        convert(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 ? " " + convert(n % 100000) : "")
      );
    }

    return (
      convert(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 ? " " + convert(n % 10000000) : "")
    );
  }

  const rounded = Math.round(Number(num) || 0);

  if (rounded === 0) return "Zero Rupees Only";

  return `${convert(rounded)} Rupees Only`;
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
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-end xl:gap-2">
          <div className="w-full xl:w-[230px] xl:shrink-0">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search debit note..."
              icon="search"
            />
          </div>

          <div className="w-full xl:w-[165px] xl:shrink-0">
            <Select
              label="Vendor"
              value={vendorFilter}
              onChange={setVendorFilter}
              options={[
                { value: "all", label: "All Vendors" },
                ...vendors.map((vendor) => ({
                  value: vendor,
                  label: vendor,
                })),
              ]}
            />
          </div>

          <div className="w-full xl:w-[145px] xl:shrink-0">
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Status" },
                ...statuses.map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
            />
          </div>

          <div className="w-full xl:w-[155px] xl:shrink-0">
            <Select
              label="Date Filter"
              value={dateFilter}
              onChange={(value) =>
                setDateFilter(
                  value as
                    | "all"
                    | "today"
                    | "monthly"
                    | "quarterly"
                    | "yearly"
                    | "custom",
                )
              }
              options={[
                { value: "all", label: "All Dates" },
                { value: "today", label: "Today" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
                { value: "custom", label: "Custom Date" },
              ]}
            />
          </div>

          {dateFilter === "custom" && (
            <>
              <div className="w-full xl:w-[140px] xl:shrink-0">
                <Input
                  label="From"
                  type="date"
                  value={customFrom}
                  onChange={setCustomFrom}
                />
              </div>

              <div className="w-full xl:w-[140px] xl:shrink-0">
                <Input
                  label="To"
                  type="date"
                  value={customTo}
                  onChange={setCustomTo}
                />
              </div>
            </>
          )}

          {(search ||
            vendorFilter !== "all" ||
            statusFilter !== "all" ||
            dateFilter !== "all" ||
            customFrom ||
            customTo) && (
            <Button
              variant="secondary"
              className="xl:shrink-0"
              onClick={() => {
                setSearch("");
                setVendorFilter("all");
                setStatusFilter("all");
                setDateFilter("all");
                setCustomFrom("");
                setCustomTo("");
              }}
            >
              <Icon name="filter_alt_off" size={17} />
              Clear
            </Button>
          )}
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
                    className="w-[9%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Return Date
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Debit Note No.
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[11%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Vendor
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[10%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Place
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[9%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Discount
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[10%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Taxable
                  </th>

                  <th
                    colSpan={2}
                    className="w-[11%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    SGST
                  </th>
                  <th
                    colSpan={2}
                    className="w-[11%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    CGST
                  </th>
                  <th
                    colSpan={2}
                    className="w-[11%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    IGST
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[10%] px-2 py-3 text-center font-semibold border-r border-slate-200"
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

                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    %
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    Amt
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    %
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    Amt
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    %
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    Amt
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
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.discountAmount || 0)}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.taxableAmount ?? note.withoutTax)}
                    </td>
                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {note.sgst > 0 && note.withoutTax > 0
                        ? ((note.sgst / note.withoutTax) * 100).toFixed(2)
                        : "0.00"}
                    </td>
                    <td className="px-1 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.sgst)}
                    </td>

                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {note.cgst > 0 && note.withoutTax > 0
                        ? ((note.cgst / note.withoutTax) * 100).toFixed(2)
                        : "0.00"}
                    </td>
                    <td className="px-1 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(note.cgst)}
                    </td>

                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {note.igst > 0 && note.withoutTax > 0
                        ? ((note.igst / note.withoutTax) * 100).toFixed(2)
                        : "0.00"}
                    </td>
                    <td className="px-1 py-3 text-right text-slate-600 border-r border-slate-100">
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

      {selectedSummary &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 6mm; }
                /* Hide the entire app (removes it from layout completely) */
                #root {
                  display: none !important;
                }
                .debit-note-print-area,
                .debit-note-print-area * { visibility: visible !important; }
                .debit-note-print-area {
                  position: absolute !important;
                  inset: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: white !important;
                }
                .debit-note-screen-only { display: none !important; }
                .debit-note-scroll { overflow: visible !important; padding: 0 !important; }
              }
            `}</style>

            <div className="debit-note-print-area flex h-[96vh] w-[98.5vw] max-w-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="debit-note-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Debit Note
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectedSummary.debitNoteNo}
                  </h2>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      selectedSummary.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectedSummary.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDebitNoteNo(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="debit-note-scroll min-h-0 flex-1 overflow-y-auto p-3">
                <div className="min-h-full w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 px-6 py-3">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold tracking-wide text-slate-900">
                            NATURE BIOTIC
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                            4/130/A1, Velavan Nagar, Velayudhampuram,
                            Rajapalayam, Tamil Nadu - 626102
                          </p>
                          <p className="text-[10px] text-slate-600">
                            GSTIN: 33AEZPV5328P1ZC
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Cell: 96008 44446
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center px-4 py-3">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Debit Note
                        </h3>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Store Purchase Return
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Vendor
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedSummary.vendor}
                      </p>
                      <p className="text-slate-600">
                        Nature Biotic, Rajapalayam
                      </p>
                    </div>

                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Return Details
                      </p>
                      <p className="text-slate-600">
                        Purchase Ref:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedSummary.purchaseRef}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Place of Return:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedSummary.placeOfReturn}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Total Qty:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedItems.reduce(
                            (sum, item) => sum + item.quantity,
                            0,
                          )}
                        </span>
                      </p>
                    </div>

                    <div className="px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Debit Note Details
                      </p>
                      <div className="grid grid-cols-[105px_1fr] gap-y-0.5">
                        <span className="text-slate-500">Debit Note No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedSummary.debitNoteNo}
                        </span>

                        <span className="text-slate-500">Return Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selectedSummary.date)}
                        </span>

                        <span className="text-slate-500">Purchase Ref</span>
                        <span className="font-semibold text-slate-800">
                          {selectedSummary.purchaseRef}
                        </span>

                        <span className="text-slate-500">Status</span>
                        <span className="font-semibold text-slate-800">
                          {selectedSummary.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                          <th
                            rowSpan={2}
                            className="w-[4%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[15%] border-r border-slate-300 px-2 py-2 text-left"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[7%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Batch ID
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[8%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Expiry Date
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[5%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Qty
                          </th>
                          {/* <th
                            rowSpan={2}
                            className="w-[12%] border-r border-slate-300 px-2 py-2 text-left"
                          >
                            Reason
                          </th> */}
                          <th
                            rowSpan={2}
                            className="w-[8%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Unit Price
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[9%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Before Discount
                          </th>
                          <th
                            colSpan={2}
                            className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Discount
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[9%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Taxable
                          </th>

                          <th
                            colSpan={2}
                            className="w-[11%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            SGST
                          </th>
                          <th
                            colSpan={2}
                            className="w-[11%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            className="w-[11%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            IGST
                          </th>

                          <th
                            rowSpan={2}
                            className="w-[12%] px-2 py-2 text-right"
                          >
                            Line Total
                          </th>
                        </tr>

                        <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedItems.map((item, index) => {
                          const sgstRate =
                            item.sgst > 0 && item.withoutTax > 0
                              ? (item.sgst / item.withoutTax) * 100
                              : 0;
                          const cgstRate =
                            item.cgst > 0 && item.withoutTax > 0
                              ? (item.cgst / item.withoutTax) * 100
                              : 0;
                          const igstRate =
                            item.igst > 0 && item.withoutTax > 0
                              ? (item.igst / item.withoutTax) * 100
                              : 0;

                          return (
                            <tr
                              key={item.id}
                              
                            >
                              <td className="border-r border-slate-300 px-2 py-2 text-center">
                                {index + 1}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                                {item.product}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center text-slate-600">
                                {item.batchNo || "-"}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center text-slate-600">
                                {item.expiryDate
                                  ? formatDate(item.expiryDate)
                                  : "-"}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center">
                                {item.quantity}
                              </td>
                              {/* <td className="border-r border-slate-300 px-2 py-2 text-slate-600">
                                {item.reason || "-"}
                              </td> */}
                              <td className="border-r border-slate-300 px-2 py-2 text-right text-slate-700">
                                {item.unitPrice.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right text-slate-700">
                                {item.beforeDiscount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {item.discountPercent.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {item.discountAmount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                                {item.taxableAmount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {sgstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {item.sgst.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {cgstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {item.cgst.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {igstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {item.igst.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                              <td className="px-2 py-2 text-right font-bold text-slate-800">
                                {item.returnAmount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                        {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(0, MIN_ROWS - selectedItems.length);
                        const columnCount = 18;

                        return Array.from({ length: fillerCount }).map((_, i) => (
                          <tr key={`filler-${i}`}>
                            {Array.from({ length: columnCount }).map((_, colIdx) => (
                              <td
                                key={colIdx}
                                className={`px-1 py-1.5 ${
                                  colIdx < columnCount - 1 ? "border-r border-slate-300" : ""
                                }`}
                              >
                                &nbsp;
                              </td>
                            ))}
                          </tr>
                        ));
                      })()}


                      {/* ---- Bottom totals row ---- */}
                      <tfoot>
                      {(() => {
                        const rows = selectedItems;

                        const totalQty = rows.reduce(
                          (s, r) => s + Number(r.quantity || 0),
                          0
                        );

                        const totalBeforeDiscount = rows.reduce((s, r) => {
                          const qty = Number(r.quantity || 0);
                          const price = Number(r.sellingPrice || 0);
                          const discountAmt = Number(r.discountAmount || 0);
                          const taxable = Number(
                            r.taxableAmount ?? r.amount ?? 0
                          );

                          const beforeDiscount =
                            price > 0 ? price * qty : taxable + discountAmt;

                          return s + beforeDiscount;
                        }, 0);

                        const totalDiscountAmt = rows.reduce(
                          (s, r) => s + Number(r.discountAmount || 0),
                          0
                        );

                        const totalTaxable = rows.reduce(
                          (s, r) =>
                            s + Number(r.taxableAmount ?? r.amount ?? 0),
                          0
                        );

                        const totalSgst = rows.reduce(
                          (s, r) => s + Number(r.sgst || 0),
                          0
                        );

                        const totalCgst = rows.reduce(
                          (s, r) => s + Number(r.cgst || 0),
                          0
                        );

                        const totalIgst = rows.reduce(
                          (s, r) => s + Number(r.igst || 0),
                          0
                        );

                        const totalLine = rows.reduce(
                          (s, r) => s + Number(r.returnAmount || 0),
                          0
                        );

                        return (
                          <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                            {/* S.No */}
                            <td className="border-r border-slate-300 p-2 text-center">
                              Total
                            </td>

                            {/* Product */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* Batch */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* Expiry */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* Qty */}
                            <td className="border-r border-slate-300 p-2 text-center">
                              {totalQty}
                            </td>

                            {/* Unit Price */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* Before Discount */}
                            <td className="border-r border-slate-300 p-2 text-right">
                              {formatCurrency(totalBeforeDiscount)}
                            </td>

                            {/* Discount % */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* Discount Amount */}
                            <td className="border-r border-slate-300 p-2 text-right">
                              {formatCurrency(totalDiscountAmt)}
                            </td>

                            {/* Taxable */}
                            <td className="border-r border-slate-300 p-2 text-right">
                              {formatCurrency(totalTaxable)}
                            </td>

                            {/* SGST % */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* SGST Amount */}
                            <td className="border-r border-slate-300 p-2 text-right">
                              {formatCurrency(totalSgst)}
                            </td>

                            {/* CGST % */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* CGST Amount */}
                            <td className="border-r border-slate-300 p-2 text-right">
                              {formatCurrency(totalCgst)}
                            </td>

                            {/* IGST % */}
                            <td className="border-r border-slate-300 p-2" />

                            {/* IGST Amount */}
                            <td className="border-r border-slate-300 p-2 text-right">
                              {formatCurrency(totalIgst)}
                            </td>

                            {/* Line Total */}
                            <td className="p-2 text-right">
                              {formatCurrency(totalLine)}
                            </td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                    </table>
                  </div>

                  {/* ROW 1: Amount in Words (left) + Round Off / Grand Total (right) */}
                  <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-2.5 flex items-center">
                      {(() => {
                        const grandTotal = selectedItems.reduce(
                          (sum, row) => sum + Number(row.total || 0),
                          0,
                        );

                        const roundedTotal = Math.round(grandTotal);

                        return (
                          <p className="text-[10px] font-semibold text-slate-700">
                            Amount in Words :{" "}
                            <span className="font-bold text-slate-900">
                              {numberToWords(roundedTotal)}
                            </span>
                          </p>
                        );
                      })()}
                    </div>

                    <div className="space-y-1 p-2.5 text-[11px]">
                      <Summary
                        label="Round Off"
                        value={formatCurrency(
                          selectedItems.reduce(
                            (sum, row) => sum + Number(row.total || 0),
                            0,
                          ) -
                            selectedItems.reduce(
                              (sum, row) =>
                                sum +
                                Number(row.withoutTax || 0) +
                                Number(row.sgst || 0) +
                                Number(row.cgst || 0) +
                                Number(row.igst || 0),
                              0,
                            ),
                        )}
                        muted
                      />

                      <div className="border-t border-slate-300 pt-1.5">
                      <Summary
                        label="Grand Total"
                        value={formatCurrency(
                          selectedItems.reduce(
                            (sum, row) => sum + Number(row.total || 0),
                            0,
                          ),
                        )}
                        bold
                      />
                    </div>
                    </div>
                  </div>

                  {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                  <div className="grid min-h-[110px] grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="flex flex-col justify-end border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Purchase order raised by{" "}
                        {storeId || "this store"} to Nature Biotic.
                      </p>
                    </div>

                    <div className="flex items-end justify-center p-3">
                      <div className="w-full text-center">
                        <div className="border-b border-slate-300" />
                        <p className="mt-1.5 text-xs font-semibold text-slate-500">
                          Authorised Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                </div>                  


              </div>

              <div className="debit-note-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                {selectedSummary.status === "Pending" && (
                  <Button
                    onClick={() => {
                      approveDebitNoteGroup(selectedSummary.debitNoteNo);
                      setSelectedDebitNoteNo(null);
                    }}
                  >
                    <Icon name="check_circle" size={18} />
                    Approve Debit Note
                  </Button>
                )}

                <Button
                  variant="secondary"
                  onClick={() => setSelectedDebitNoteNo(null)}
                >
                  Close
                </Button>

                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Debit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
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

function Summary({
  label,
  value,
  bold = false,
  muted = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          bold
            ? "font-bold text-slate-800"
            : muted
              ? "text-slate-500"
              : "text-slate-700"
        }
      >
        {label}
      </span>
      <span
        className={
          bold
            ? "font-bold text-slate-900"
            : muted
              ? "text-slate-500"
              : "font-semibold text-slate-700"
        }
      >
        {value}
      </span>
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
