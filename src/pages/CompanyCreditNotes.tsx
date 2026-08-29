import { useState, useMemo } from "react";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  EmptyState,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  stores,
  addCompanyCreditNoteSyncRecords,
  getCompanyCreditNoteSyncRecords,
  type CompanyCreditNoteSyncRecord,
  getCompanyStoreSales,
  type CompanyStoreSaleRecord,
} from "@/lib/data";
import { createPortal } from "react-dom";

type CreditNoteStatus = "Approved" | "Pending" | "Rejected";

type CreditNote = {
  id: string;
  creditNoteNo: string;
  party: string;
  Date: string;
  amount: number; // Without Tax
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  storeLocation: string;
  placeofreturn: string;
  storeId?: string;
  product?: string;
  quantity?: number;
  reason?: string;
  status?: CreditNoteStatus;
  invoiceNo?: string;
  pkgsize?: string;
  batchNo?: string;
  expiryDate?: string;
  sellingPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxPercent?: number;
};

type AddedProduct = {
  key: string;
  productId: string;
  productName: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
  reason: string;
  soldQuantity: number;
  taxPercent: number;
  discountAmount: number;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
};

const parties = [
  "Murugan Farms",
  "Sairam Agri Inputs",
  "Selvam Agri Mart",
  "Karthikeyan Estates",
  "Green Harvest Agro",
];
const reasons = [
  "Damaged Product",
  "Expired Stock",
  "Wrong Item Supplied",
  "Quality Issue",
  "Customer Return",
];
const statuses: CreditNoteStatus[] = ["Approved", "Pending", "Rejected"];

const seedCreditNotes: CreditNote[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 3 + 1));

  const withoutTax = (1 + (i % 5)) * (300 + (i % 4) * 80);
  const isTamilNadu = i % 2 === 0;

  const cgst = isTamilNadu ? withoutTax * 0.09 : 0;
  const sgst = isTamilNadu ? withoutTax * 0.09 : 0;
  const igst = isTamilNadu ? 0 : withoutTax * 0.18;

  const total = withoutTax + cgst + sgst + igst;

  return {
    id: `cn${i}`,
    creditNoteNo: `CN-${String(2001 + i)}`,
    party: parties[i % parties.length],
    Date: d.toISOString().split("T")[0],
    amount: withoutTax,
    sgst,
    cgst,
    igst,
    total,
    storeLocation: stores[i % stores.length].location,
    placeofreturn: stores[i % stores.length].location?.split(",")[0] || "",
  };
});

const statusColor: Record<CreditNoteStatus, "green" | "amber" | "red"> = {
  Approved: "green",
  Pending: "amber",
  Rejected: "red",
};

function CreditInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function CompanyCreditNotes() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    const synced = getCompanyCreditNoteSyncRecords();

    const createdNotes: CreditNote[] = synced.map((row) => {
      const store = stores.find((item) => item.id === row.storeId);

      return {
        id: row.id,
        creditNoteNo: row.creditNoteNo,
        party: row.storeName,
        Date: row.returnDate,
        amount: row.withoutTax ?? row.returnAmount,
        sgst: row.sgst ?? 0,
        cgst: row.cgst ?? 0,
        igst: row.igst ?? 0,
        total: row.returnAmount,
        storeLocation: store?.location || "",
        placeofreturn: store?.location?.split(",")[0] || "",
        storeId: row.storeId,
        product: row.product,
        quantity: row.quantity,
        reason: row.reason,
        status: row.status,
        invoiceNo: row.invoiceNo || row.purchaseRef,
        pkgsize: (row as any).pkgsize || "",
        batchNo: (row as any).batchNo || "",
        expiryDate: (row as any).expiryDate || "",
        sellingPrice: row.unitPrice,
        discountPercent: row.discountPercent,
        discountAmount: row.discountAmount,
        taxableAmount: row.taxableAmount,
        taxPercent: row.taxPercent,
      };
    });

    return [...createdNotes, ...seedCreditNotes];
  });

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<{
    header: CreditNote;
    rows: CreditNote[];
  } | null>(null);

  // Form state
  const [returnDate, setReturnDate] = useState("");
  const [creditNoteNo, setCreditNoteNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [companySales] = useState<CompanyStoreSaleRecord[]>(() =>
    getCompanyStoreSales(),
  );
  const [storeId, setStoreId] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [remarks, setRemarks] = useState("");
  const [entry, setEntry] = useState({
    productId: "",
    pkgsize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 0,
    sellingPrice: 0,
    discount: 0,
    reason: "",
  });
  const [added, setAdded] = useState<AddedProduct[]>([]);

  const selectedStore = stores.find((s) => s.id === storeId);
  const invoiceOptions = useMemo(() => {
    const seen = new Set<string>();
    return companySales.filter((row) => {
      if (seen.has(row.invoiceNo)) return false;
      seen.add(row.invoiceNo);
      return true;
    });
  }, [companySales]);

  const selectedInvoiceRows = useMemo(
    () => companySales.filter((row) => row.invoiceNo === invoiceNo),
    [companySales, invoiceNo],
  );

  const entryProduct = selectedInvoiceRows.find(
    (_, index) => String(index) === entry.productId,
  );

  const canAdd =
    entry.productId &&
    entry.batchNo &&
    entry.expiryDate &&
    entry.quantity > 0 &&
    entry.sellingPrice > 0;
  const canCreate =
    creditNoteNo && invoiceNo && storeId && returnDate && added.length > 0;

  // ---- Totals: calculated live from the added products list ----
  const totals = useMemo(() => {
    return added.reduce(
      (acc, item) => ({
        subtotal: acc.subtotal + item.sellingPrice * item.quantity,
        totalDiscount:
          acc.totalDiscount +
          (item.sellingPrice * item.quantity * item.discount) / 100,
        sgst: acc.sgst + item.sgst,
        cgst: acc.cgst + item.cgst,
        igst: acc.igst + item.igst,
        grandTotal: acc.grandTotal + item.total,
      }),
      {
        subtotal: 0,
        totalDiscount: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        grandTotal: 0,
      },
    );
  }, [added]);

  function isTamilNaduSupply() {
    return placeOfSupply === "Tamil Nadu";
  }

  function computeLine(
    productId: string,
    quantity: number,
    sellingPrice: number,
    discount: number,
  ) {
    const saleRow = selectedInvoiceRows[Number(productId)];
    const gross = sellingPrice * quantity;
    const discountAmt = (gross * discount) / 100;
    const taxableAmount = gross - discountAmt;
    const taxPercent = Number(
      (saleRow as any)?.taxPercent ??
        (saleRow?.withoutTax > 0
          ? (saleRow.taxAmount / saleRow.withoutTax) * 100
          : 0),
    );

    const sgstAmt = isTamilNaduSupply()
      ? (taxableAmount * (taxPercent / 2)) / 100
      : 0;
    const cgstAmt = isTamilNaduSupply()
      ? (taxableAmount * (taxPercent / 2)) / 100
      : 0;
    const igstAmt = !isTamilNaduSupply()
      ? (taxableAmount * taxPercent) / 100
      : 0;

    return {
      taxableAmount,
      sgst: sgstAmt,
      cgst: cgstAmt,
      igst: igstAmt,
      total: taxableAmount + sgstAmt + cgstAmt + igstAmt,
    };
  }

  function selectProduct(productId: string) {
    const saleRow = selectedInvoiceRows[Number(productId)];
    if (!saleRow) return;
    const gross = saleRow.quantity * saleRow.rate;
    const discountPercent = Number(
      (saleRow as any).discountPercent ??
        (gross > 0
          ? (Number((saleRow as any).discount || 0) / gross) * 100
          : 0),
    );
    setEntry((p) => ({
      ...p,
      productId,
      pkgsize: (saleRow as any).pkgsize || saleRow.packSize || "",
      batchNo: (saleRow as any).batchNo || "",
      expiryDate: (saleRow as any).expiryDate || "",
      quantity: 1,
      sellingPrice: saleRow.rate,
      discount: discountPercent,
    }));
  }

  function addProduct() {
    if (!canAdd) return;
    const saleRow = selectedInvoiceRows[Number(entry.productId)];
    if (!saleRow) return;
    const alreadyReturned = getCompanyCreditNoteSyncRecords()
      .filter(
        (r: any) =>
          r.invoiceNo === invoiceNo &&
          r.product === saleRow.product &&
          r.status !== "Rejected",
      )
      .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const remainingQty = Math.max(0, saleRow.quantity - alreadyReturned);
    if (entry.quantity > remainingQty) return;

    const computed = computeLine(
      entry.productId,
      entry.quantity,
      entry.sellingPrice,
      entry.discount,
    );

    const newItem: AddedProduct = {
      key: `${entry.productId}-${entry.batchNo}-${String(globalThis.Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
      productId: entry.productId,
      productName: saleRow.product,
      pkgsize: entry.pkgsize,
      batchNo: entry.batchNo,
      expiryDate: entry.expiryDate,
      quantity: entry.quantity,
      sellingPrice: entry.sellingPrice,
      discount: entry.discount,
      reason: entry.reason,
      soldQuantity: saleRow.quantity,
      taxPercent: Number(
        (saleRow as any).taxPercent ??
          (saleRow.withoutTax > 0
            ? (saleRow.taxAmount / saleRow.withoutTax) * 100
            : 0),
      ),
      discountAmount:
        (entry.sellingPrice * entry.quantity * entry.discount) / 100,
      ...computed,
    };

    setAdded((prev) => [...prev, newItem]);

    // reset entry row for the next product
    setEntry({
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
  }

  function updateAdded(key: string, updates: Partial<AddedProduct>) {
    setAdded((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const merged = { ...item, ...updates };
        const computed = computeLine(
          merged.productId,
          merged.quantity,
          merged.sellingPrice,
          merged.discount,
        );
        return { ...merged, ...computed };
      }),
    );
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((item) => item.key !== key));
  }

  function openCreditNote(row: CreditNote) {
    const relatedRows = creditNotes.filter(
      (item) =>
        item.creditNoteNo === row.creditNoteNo &&
        (item.storeId || item.party) === (row.storeId || row.party) &&
        item.Date === row.Date,
    );

    setSelectedCreditNote({
      header: row,
      rows: relatedRows.length > 0 ? relatedRows : [row],
    });
  }

  function resetForm() {
    setReturnDate("");
    setCreditNoteNo("");
    setInvoiceNo("");
    setStoreId("");
    setPlaceOfSupply("");
    setRemarks("");
    setEntry({
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
    setAdded([]);
  }

  function handleSaveDraft() {
    if (!storeId || !invoiceNo || !creditNoteNo) return;
    // TODO: persist as a draft (status: 'Pending') via your API / store
    console.log("Saved as draft", {
      returnDate,
      invoiceNo,
      storeId,
      placeOfSupply,
      remarks,
      added,
      totals,
    });
    closeForm();
  }

  function handleCreate() {
    if (!canCreate || !selectedStore) return;

    const createdAt = new globalThis.Date().getTime();

    // Company Credit Note -> selected Store Debit Note sync
    const syncRows: CompanyCreditNoteSyncRecord[] = added.map(
      (item, index) => ({
        id: `${creditNoteNo}-${item.key}-${createdAt}-${index}`,
        creditNoteNo,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        returnDate,
        purchaseRef: invoiceNo,
        invoiceNo,
        product: item.productName,
        quantity: item.quantity,
        unitPrice: item.sellingPrice,
        pkgsize: item.pkgsize,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        discountPercent: item.discount,
        discountAmount: item.discountAmount,
        taxableAmount: item.taxableAmount,
        taxPercent: item.taxPercent,
        withoutTax: item.taxableAmount,
        sgst: item.sgst,
        cgst: item.cgst,
        igst: item.igst,
        returnAmount: item.total,
        reason: item.reason || remarks || "Product Return",
        placeOfReturn: selectedStore.location?.split(",")[0] || "",
        status: "Pending",
      }),
    );

    addCompanyCreditNoteSyncRecords(syncRows);

    // Show newly created rows immediately in Company Credit Notes.
    const companyRows: CreditNote[] = added.map((item, index) => ({
      id: syncRows[index].id,
      creditNoteNo,
      party: selectedStore.name,
      Date: returnDate,
      amount: item.taxableAmount,
      sgst: item.sgst,
      cgst: item.cgst,
      igst: item.igst,
      total: item.total,
      storeLocation: selectedStore.location,
      placeofreturn: selectedStore.location?.split(",")[0] || "",
      storeId: selectedStore.id,
      product: item.productName,
      quantity: item.quantity,
      reason: item.reason || remarks || "Product Return",
      status: "Pending",
      invoiceNo,
      pkgsize: item.pkgsize,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
      sellingPrice: item.sellingPrice,
      discountPercent: item.discount,
      discountAmount: item.discountAmount,
      taxableAmount: item.taxableAmount,
      taxPercent: item.taxPercent,
    }));

    setCreditNotes((prev) => [...companyRows, ...prev]);

    console.log("Creating credit note", {
      Date,
      invoiceNo,
      storeId,
      placeOfSupply,
      remarks,
      added,
      totals,
    });

    closeForm();
  }

  const DetailField = ({ label, value }: any) => (
    <div>
      <p className="text-[11px] text-slate-400 font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );

  const SummaryRow = ({ label, value, muted }: any) => (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-700"}>
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${muted ? "text-slate-500" : "text-slate-800"}`}
      >
        {value}
      </span>
    </div>
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new globalThis.Date();

    const normalize = (value: string) =>
      new globalThis.Date(`${value}T00:00:00`);

    const isWithinDateFilter = (value: string) => {
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

    return creditNotes.filter((c) => {
      const matchesSearch =
        !q ||
        c.creditNoteNo.toLowerCase().includes(q) ||
        c.party.toLowerCase().includes(q);

      return matchesSearch && isWithinDateFilter(c.Date);
    });
  }, [search, creditNotes, dateFilter, customFrom, customTo]);

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Credit Notes (Returns)
          </h1>
          <p className="text-slate-500 mt-1">
            Manage product returns and credit note records.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={20} fill />
          Create Credit Note
        </Button>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-end xl:gap-2">
          <div className="w-full xl:w-[245px] xl:shrink-0">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by CN no or store..."
              icon="search"
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

          {(search || dateFilter !== "all" || customFrom || customTo) && (
            <Button
              variant="secondary"
              className="xl:shrink-0"
              onClick={() => {
                setSearch("");
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

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="undo"
            title="No credit notes found"
            description="Adjust your search or create a new credit note."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                  <th
                    rowSpan={2}
                    className="w-[5%] text-center font-semibold px-1 py-3 border-r border-slate-200"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[8%] text-center font-semibold px-1 py-3 border-r border-slate-200 whitespace-nowrap"
                  >
                    Date
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[11%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    CN No.
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[14%] text-center font-semibold px-2 py-3 border-r border-slate-200 whitespace-nowrap"
                  >
                    Store Name
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[9%] text-center font-semibold px-2 py-3 border-r border-slate-200"
                  >
                    Place
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[11%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Without Tax
                  </th>

                  <th
                    colSpan={2}
                    className="w-[12%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    SGST
                  </th>
                  <th
                    colSpan={2}
                    className="w-[12%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    CGST
                  </th>
                  <th
                    colSpan={2}
                    className="w-[12%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    IGST
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[11%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Total
                  </th>
                </tr>

                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
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
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => openCreditNote(c)}
                    title="Click to view credit note details"
                    className="cursor-pointer hover:bg-brand-50/40 transition-base"
                  >
                    <td className="px-1 py-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                      {i + 1}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500 border-r border-slate-100">
                      {formatDate(c.Date)}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-800 border-r border-slate-100">
                      {c.creditNoteNo}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-700 border-r border-slate-100 whitespace-nowrap">
                      {c.party}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 border-r border-slate-100 truncate">
                      {c.placeofreturn}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.sgst > 0 && c.amount > 0
                        ? `${((c.sgst / c.amount) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.sgst)}
                    </td>

                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.cgst > 0 && c.amount > 0
                        ? `${((c.cgst / c.amount) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.cgst)}
                    </td>

                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.igst > 0 && c.amount > 0
                        ? `${((c.igst / c.amount) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.igst)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedCreditNote &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 5mm; }
                body * { visibility: hidden !important; }
                .credit-note-print-area,
                .credit-note-print-area * { visibility: visible !important; }
                .credit-note-print-area {
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
                .credit-note-screen-only { display: none !important; }
                .credit-note-scroll { overflow: visible !important; padding: 0 !important; }
                .credit-note-table { font-size: 7.5px !important; }
                .credit-note-table th,
                .credit-note-table td { padding: 3px 4px !important; }
              }
            `}</style>

            <div className="credit-note-print-area flex h-screen w-full flex-col overflow-hidden bg-white">
              <div className="credit-note-screen-only flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Credit Note
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectedCreditNote.header.creditNoteNo}
                  </h2>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      selectedCreditNote.header.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedCreditNote.header.status === "Rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectedCreditNote.header.status || "Pending"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCreditNote(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="credit-note-scroll min-h-0 flex-1 overflow-y-auto p-2">
                <div className="min-h-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 px-8 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-slate-900">
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

                    <div className="flex items-center justify-center p-4">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Credit Note
                        </h3>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Nature Biotic to Store
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase text-slate-500">
                        Billing Address
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedCreditNote.header.party}
                      </p>
                      <p className="text-slate-600">
                        {selectedCreditNote.header.storeLocation || "-"}
                      </p>
                      <p className="text-slate-600">
                        GSTIN:{" "}
                        {stores.find(
                          (s) => s.id === selectedCreditNote.header.storeId,
                        )?.gst || "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase text-slate-500">
                        Return Details
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedCreditNote.header.party}
                      </p>
                      <p className="text-slate-600">
                        {selectedCreditNote.header.storeLocation || "-"}
                      </p>
                      <p className="text-slate-600">
                        Place of Return:{" "}
                        {selectedCreditNote.header.placeofreturn || "-"}
                      </p>
                    </div>

                    <div className="p-3">
                      <p className="mb-1 font-bold uppercase text-slate-500">
                        Credit Note Details
                      </p>
                      <div className="grid grid-cols-[95px_1fr] gap-y-0.5">
                        <span className="text-slate-500">CN No</span>
                        <span className="font-semibold">
                          {selectedCreditNote.header.creditNoteNo}
                        </span>
                        <span className="text-slate-500">CN Date</span>
                        <span className="font-semibold">
                          {formatDate(selectedCreditNote.header.Date)}
                        </span>
                        <span className="text-slate-500">Invoice No</span>
                        <span className="font-semibold">
                          {selectedCreditNote.header.invoiceNo || "-"}
                        </span>
                        <span className="text-slate-500">Store Name</span>
                        <span className="font-semibold">
                          {selectedCreditNote.header.party}
                        </span>
                        <span className="text-slate-500">Place of Supply</span>
                        <span className="font-semibold">
                          {selectedCreditNote.header.storeLocation || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="credit-note-table w-full min-w-[1300px] border-collapse text-[8px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-600">
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-left"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            PKG Size
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            Batch No
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            Exp Date
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            Qty
                          </th>
                          {/* <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-left"
                          >
                            Reason
                          </th> */}
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-right"
                          >
                            Unit Price
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-right"
                          >
                            Before Discount
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            Discount
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-right"
                          >
                            Taxable (₹)
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            SGST
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            IGST
                          </th>
                          <th rowSpan={2} className="p-2 text-right">
                            Line Total
                          </th>
                        </tr>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-600">
                          <th className="border-r border-slate-300 p-1">%</th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 p-1">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amount
                          </th>
                          <th className="border-r border-slate-300 p-1">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amount
                          </th>
                          <th className="border-r border-slate-300 p-1">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedCreditNote.rows.map((row, index) => {
                          const qty = Number(row.quantity || 0);
                          const price = Number(row.sellingPrice || 0);
                          const discountAmt = Number(row.discountAmount || 0);
                          const taxable = Number(
                            row.taxableAmount ?? row.amount ?? 0,
                          );
                          const beforeDiscount =
                            price > 0 ? price * qty : taxable + discountAmt;
                          const discountPct = Number(row.discountPercent || 0);
                          const taxPct = Number(row.taxPercent || 0);

                          return (
                            <tr
                              key={row.id}
                              className="border-b border-slate-300"
                            >
                              <td className="border-r border-slate-300 p-2 text-center">
                                {index + 1}
                              </td>
                              <td className="border-r border-slate-300 p-2 font-semibold">
                                {row.product || "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.pkgsize || "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.batchNo || "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.expiryDate
                                  ? formatDate(row.expiryDate)
                                  : "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.quantity ?? "-"}
                              </td>
                              {/* <td className="border-r border-slate-300 p-2 text-slate-600">
                                {row.reason || "-"}
                              </td> */}
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(price)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right font-semibold">
                                {formatCurrency(beforeDiscount)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {discountPct.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(discountAmt)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right font-semibold">
                                {formatCurrency(taxable)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.cgst > 0
                                  ? (taxPct / 2).toFixed(2)
                                  : "0.00"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(row.cgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.sgst > 0
                                  ? (taxPct / 2).toFixed(2)
                                  : "0.00"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(row.sgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.igst > 0 ? taxPct.toFixed(2) : "0.00"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(row.igst)}
                              </td>
                              <td className="p-2 text-right font-bold">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid min-h-[200px] grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-400">
                        Notes
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        This credit note is generated against returned goods
                        from {selectedCreditNote.header.party}
                        {selectedCreditNote.header.invoiceNo
                          ? ` for original invoice ${selectedCreditNote.header.invoiceNo}.`
                          : "."}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Reason:{" "}
                        {selectedCreditNote.rows
                          .map((row) => row.reason)
                          .filter(Boolean)
                          .join(", ") || "Product Return"}
                      </p>
                    </div>

                    <div className="space-y-2 p-3 text-[11px]">
                      <SummaryRow
                        label="Total Before Discount"
                        value={formatCurrency(
                          selectedCreditNote.rows.reduce(
                            (sum, row) =>
                              sum +
                              (Number(row.sellingPrice || 0) *
                                Number(row.quantity || 0) ||
                                Number(row.amount || 0) +
                                  Number(row.discountAmount || 0)),
                            0,
                          ),
                        )}
                        muted
                      />
                      <SummaryRow
                        label="Discount"
                        value={formatCurrency(
                          selectedCreditNote.rows.reduce(
                            (sum, row) => sum + Number(row.discountAmount || 0),
                            0,
                          ),
                        )}
                        muted
                      />
                      <SummaryRow
                        label="Taxable Total"
                        value={formatCurrency(
                          selectedCreditNote.rows.reduce(
                            (sum, row) =>
                              sum +
                              Number(row.taxableAmount ?? row.amount ?? 0),
                            0,
                          ),
                        )}
                        muted
                      />
                      <SummaryRow
                        label="CGST"
                        value={formatCurrency(
                          selectedCreditNote.rows.reduce(
                            (sum, row) => sum + Number(row.cgst || 0),
                            0,
                          ),
                        )}
                        muted
                      />
                      <SummaryRow
                        label="SGST"
                        value={formatCurrency(
                          selectedCreditNote.rows.reduce(
                            (sum, row) => sum + Number(row.sgst || 0),
                            0,
                          ),
                        )}
                        muted
                      />
                      <SummaryRow
                        label="IGST"
                        value={formatCurrency(
                          selectedCreditNote.rows.reduce(
                            (sum, row) => sum + Number(row.igst || 0),
                            0,
                          ),
                        )}
                        muted
                      />

                      <div className="flex items-center justify-between border-t border-slate-300 pt-3">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="text-xl font-extrabold text-slate-900">
                          {formatCurrency(
                            selectedCreditNote.rows.reduce(
                              (sum, row) => sum + Number(row.total || 0),
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-[110px] justify-end border-t border-slate-300 px-6 py-4">
                    <div className="mt-auto w-56 text-center">
                      <div className="border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="credit-note-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedCreditNote(null)}
                >
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Credit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Create Creditnote — full-screen form, rendered via portal so it always sits above everything and scrolls properly */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Header (fixed, does not scroll) */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Credit Note
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Create a new credit note for product returns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable body (everything between header and footer) */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Basic details */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Date"
                      type="date"
                      value={returnDate}
                      onChange={setReturnDate}
                      required
                    />

                    <Input
                      label="Credit Note Number"
                      placeholder="e.g. CN-2050"
                      value={creditNoteNo}
                      onChange={setCreditNoteNo}
                      required
                    />

                    {/* <Select
                      label="Invoice No"
                      value={invoiceNo}
                      onChange={(value) => {
                        setInvoiceNo(value);
                        setAdded([]);
                        setEntry((p) => ({
                          ...p,
                          productId: "",
                          pkgsize: "",
                          batchNo: "",
                          expiryDate: "",
                          quantity: 0,
                          sellingPrice: 0,
                          discount: 0,
                        }));
                        const invoice = companySales.find(
                          (row) => row.invoiceNo === value,
                        );
                        if (invoice) {
                          setStoreId(invoice.storeId);
                          setPlaceOfSupply(
                            invoice.placeOfSupply ||
                              (invoice.storeLocation
                                ?.toLowerCase()
                                .includes("kerala")
                                ? "Others"
                                : "Tamil Nadu"),
                          );
                        }
                      }}
                      placeholder="Select original sales invoice"
                      options={invoiceOptions.map((row) => ({
                        value: row.invoiceNo,
                        label: `${row.invoiceNo} — ${row.storeName}`,
                      }))}
                      required
                    /> */}

                    <Input
                      label="Store"
                      value={selectedStore?.name || ""}
                      onChange={() => {}}
                      readOnly
                      placeholder="Auto-filled from invoice"
                    />

                    <Select
                      label="Place of Return"
                      value={placeOfSupply}
                      onChange={setPlaceOfSupply}
                      options={[
                        { value: "Tamil Nadu", label: "Tamil Nadu" },
                        { value: "Others", label: "Others" },
                      ]}
                    />

                    <Input
                      label="Store Address"
                      value={selectedStore?.address || ""}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />
                    <Input
                      label="GST Number"
                      value={selectedStore?.gst || ""}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />

                    <div className="md:col-span-2">
                      <Input
                        label="Remarks"
                        value={remarks}
                        onChange={setRemarks}
                        placeholder="Optional notes about this return"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Entry */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 px-6">
                    Add Product
                  </h4>

                  <div className="mx-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-3 items-end">
                      <Select
                        label="Select Product"
                        value={entry.productId}
                        onChange={selectProduct}
                        placeholder="Select"
                        options={selectedInvoiceRows.map((row, index) => ({
                          value: String(index),
                          label: `${row.product} — ${(row as any).pkgsize || row.packSize}`,
                        }))}
                      />

                      <Select
                        label="PKG Size"
                        value={entry.pkgsize}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, pkgsize: v }))
                        }
                        placeholder="Select size"
                        options={
                          entry.pkgsize
                            ? [{ value: entry.pkgsize, label: entry.pkgsize }]
                            : []
                        }
                      />

                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, batchNo: v }))
                        }
                        placeholder="Auto from invoice"
                        readOnly
                        required
                      />

                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, expiryDate: v }))
                        }
                        readOnly
                        required
                      />

                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))
                        }
                      />

                      <Input
                        label="Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={() => {}}
                        readOnly
                      />

                      <Input
                        label="Discount %"
                        type="number"
                        value={String(entry.discount)}
                        onChange={() => {}}
                        readOnly
                      />

                      <Input
                        label="Reason"
                        type="text"
                        value={entry.reason}
                        onChange={(v) => setEntry((p) => ({ ...p, reason: v }))}
                        placeholder="Enter reason"
                      />

                      <Button
                        onClick={addProduct}
                        disabled={!canAdd}
                        className="w-full h-[50px] px-3"
                      >
                        <Icon name="add" size={18} />
                        <span className="whitespace-nowrap">Add Product</span>
                      </Button>
                    </div>

                    {/* Original invoice line details */}
                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-200">
                        <DetailField
                          label="Product"
                          value={entryProduct.product}
                        />
                        <DetailField
                          label="Pack Size"
                          value={
                            (entryProduct as any).pkgsize ||
                            entryProduct.packSize ||
                            "-"
                          }
                        />
                        <DetailField
                          label="HSN"
                          value={(entryProduct as any).hsn || "-"}
                        />
                        <DetailField
                          label="Sold Qty"
                          value={String(entryProduct.quantity)}
                        />
                        <DetailField
                          label="Unit Price"
                          value={formatCurrency(entryProduct.rate)}
                        />
                        <DetailField
                          label="Discount %"
                          value={`${Number((entryProduct as any).discountPercent || 0).toFixed(2)}%`}
                        />
                        <DetailField
                          label="Tax %"
                          value={`${Number((entryProduct as any).taxPercent || 0).toFixed(2)}%`}
                        />
                        <DetailField
                          label="Invoice Total"
                          value={formatCurrency(entryProduct.total)}
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Added Products list */}
                <section className="mt-6">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 px-6">
                    Added Products ({added.length})
                  </h4>

                  {added.length === 0 ? (
                    <div className="mx-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      No products added yet. Fill the form above and click "Add
                      Product".
                    </div>
                  ) : (
                    <div className="mx-6 overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                            <th className="px-3 py-2 text-left font-semibold">
                              Product
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Batch
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Price
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Disc %
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Taxable
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              SGST
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              CGST
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              IGST
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Total
                            </th>
                            <th className="px-3 py-2 text-center font-semibold"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {added.map((item) => (
                            <tr
                              key={item.key}
                              className="border-t border-slate-100 hover:bg-slate-50/50"
                            >
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                {item.productName}
                              </td>
                              <td className="px-3 py-2 text-slate-500">
                                {item.batchNo}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateAdded(item.key, {
                                      quantity: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-20 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.sellingPrice}
                                  onChange={(e) =>
                                    updateAdded(item.key, {
                                      sellingPrice: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.discount}
                                  onChange={(e) =>
                                    updateAdded(item.key, {
                                      discount: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.taxableAmount)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.sgst)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.cgst)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.igst)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-700">
                                {formatCurrency(item.total)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAdded(item.key)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Summary */}
                {added.length > 0 && (
                  <section className="mt-6 px-6 pb-6">
                    <div className="ml-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
                      <SummaryRow
                        label="Subtotal"
                        value={formatCurrency(totals.subtotal)}
                        muted
                      />
                      <SummaryRow
                        label="Discount"
                        value={`- ${formatCurrency(totals.totalDiscount)}`}
                        muted
                      />
                      <SummaryRow
                        label="SGST"
                        value={formatCurrency(totals.sgst)}
                        muted
                      />
                      <SummaryRow
                        label="CGST"
                        value={formatCurrency(totals.cgst)}
                        muted
                      />
                      <SummaryRow
                        label="IGST"
                        value={formatCurrency(totals.igst)}
                        muted
                      />
                      <div className="border-t border-slate-200 pt-2">
                        <SummaryRow
                          label="Grand Total"
                          value={formatCurrency(totals.grandTotal)}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer (fixed, does not scroll) */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveDraft}
                  disabled={!storeId || !invoiceNo || !creditNoteNo}
                >
                  <Icon name="save" size={18} />
                  Save Draft
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Credit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
