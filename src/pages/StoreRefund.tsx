import { ReactNode, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Card,
  Button,
  Input,
  Select,
  EmptyState,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { getFarmersByStore, getStore } from "@/lib/data";


type StoredSaleInvoice = {
  id: string;
  date: string;
  invoiceNo: string;
  through: "Direct" | "Executive";
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
};

const STORE_SALES_INVOICE_STORAGE_KEY =
  "nature-biotic-store-sales-invoices-v2";

type RefundRow = {
  id: string;
  date: string;
  refundNo: string;
  farmerId: string;
  farmerName: string;
  phone: string;
  village: string;
  referenceNo: string;
  invoiceAmount: number;
  reason: string;
  paymentMethod: string;
  amount: number;
  remarks: string;
  through?: "Direct" | "Executive";
  executiveName?: string;
  placeOfSupply?: string;
};

const methods = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const reasons = [
  "Product Return",
  "Billing Correction",
  "Over Payment",
  "Cancelled Sale",
  "Wrong Product",
  "Other",
];

const STORAGE_PREFIX = "nature-biotic-store-refunds-v2";

function loadRows(storageKey: string): RefundRow[] {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function StoreRefund({ storeId }: { storeId: string }) {
  const farmers = getFarmersByStore(storeId);
  const currentStore = getStore(storeId);
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  // Declare these before memo hooks that depend on them.
  const [showCreate, setShowCreate] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");

  const saleInvoices = useMemo<StoredSaleInvoice[]>(() => {
    try {
      const raw = localStorage.getItem(
        `${STORE_SALES_INVOICE_STORAGE_KEY}:${storeId}`,
      );
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [storeId, showCreate]);

  const invoiceOptions = useMemo(
    () =>
      saleInvoices.map((invoice) => ({
        value: invoice.invoiceNo,
        label: `${invoice.invoiceNo} - ${invoice.partyName}`,
      })),
    [saleInvoices],
  );

  const selectedInvoice = useMemo(
    () =>
      saleInvoices.find(
        (invoice) => invoice.invoiceNo === referenceNo,
      ),
    [saleInvoices, referenceNo],
  );

  const [rows, setRows] = useState<RefundRow[]>(() => {
    return loadRows(storageKey);
  });

  const [search, setSearch] = useState("");
  const [selectedRefund, setSelectedRefund] = useState<RefundRow | null>(null);

  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [refundNo, setRefundNo] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState("");

  const selectedFarmer = farmers.find(
    (farmer) => farmer.id === selectedInvoice?.farmerId,
  );

  const canCreate =
    !!date &&
    !!refundNo.trim() &&
    !!selectedInvoice &&
    !!reason &&
    !!paymentMethod &&
    amount > 0 &&
    amount <= invoiceAmount;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return rows;

    return rows.filter(
      (row) =>
        row.refundNo.toLowerCase().includes(q) ||
        row.farmerName.toLowerCase().includes(q) ||
        row.referenceNo.toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function resetForm() {
    setDate(new Date().toISOString().split("T")[0]);
    setRefundNo("");
    setReferenceNo("");
    setInvoiceAmount(0);
    setReason("");
    setPaymentMethod("");
    setAmount(0);
    setRemarks("");
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function saveRows(next: RefundRow[]) {
    setRows(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function createRefund() {
    if (!canCreate || !selectedInvoice) return;

    const row: RefundRow = {
      id: `refund-${Date.now()}`,
      date,
      refundNo: refundNo.trim(),
      farmerId: selectedInvoice.farmerId || "",
      farmerName: selectedInvoice.partyName || "Farmer",
      phone:
        selectedInvoice.farmerPhone ||
        selectedFarmer?.phone ||
        "",
      village:
        selectedInvoice.farmerVillage ||
        selectedFarmer?.village ||
        "",
      referenceNo: selectedInvoice.invoiceNo,
      invoiceAmount: Number(selectedInvoice.amount || 0),
      reason,
      paymentMethod,
      amount,
      remarks,
      through: selectedInvoice.through,
      executiveName:
        selectedInvoice.through === "Executive"
          ? selectedInvoice.executiveName || ""
          : "",
      placeOfSupply:
        selectedInvoice.placeOfSupply || "Tamil Nadu",
    };

    saveRows([row, ...rows]);
    closeForm();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Refund
          </h1>
          <p className="mt-1 text-slate-500">
            Refunds issued against store sales and farmer transactions.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Create Refund
        </Button>
      </div>

      <Card className="mb-5 p-4">
        <div className="max-w-md">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search by refund no, farmer, reference..."
            icon="search"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="sync"
            title="No refunds found"
            description="Create a refund or adjust your search."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <th className="w-[6%] border-r border-slate-200 px-2 py-3 text-center">
                  S.No
                </th>
                <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                  Date
                </th>
                <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-center">
                  Ref No
                </th>
                <th className="w-[15%] border-r border-slate-200 px-2 py-3 text-center">
                  Farmer Details
                </th>
                <th className="w-[16%] border-r border-slate-200 px-2 py-3 text-center">
                  Invoice No
                </th>
                <th className="w-[16%] border-r border-slate-200 px-2 py-3 text-center">
                  Reason
                </th>
                <th className="w-[13%] border-r border-slate-200 px-2 py-3 text-center">
                  Pay Method
                </th>
                <th className="w-[12%] px-2 py-3 text-right">
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRefund(row)}
                  className={`cursor-pointer border-b border-slate-100 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  } transition hover:bg-brand-50/40`}
                  title="Click to view refund details"
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                    {index + 1}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                    {formatDate(row.date)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                    {row.refundNo}
                  </td>
                  {/* Farmer Details */}
                    <td className="w-[15%] border-r border-slate-200 px-3 py-3.5 text-center">
                    <p className="font-semibold text-slate-800">
                      {row.farmerName}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.village || "-"}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {row.phone || "-"}
                    </p>
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.referenceNo}
                  </td>
                  <td className="truncate border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.reason}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.paymentMethod}
                  </td>
                  <td className="px-2 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Refund
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select a completed sales invoice, then refund the required amount to the farmer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />

                  <Input
                    label="Refund No"
                    value={refundNo}
                    onChange={setRefundNo}
                    placeholder="e.g. REF-102"
                    required
                  />

                  <Select
                    label="Invoice Number"
                    value={referenceNo}
                    onChange={(value) => {
                      setReferenceNo(value);

                      const invoice = saleInvoices.find(
                        (item) => item.invoiceNo === value,
                      );

                      setInvoiceAmount(
                        invoice ? Number(invoice.amount || 0) : 0,
                      );
                      setAmount(0);
                    }}
                    placeholder="Select sales invoice"
                    options={invoiceOptions}
                    required
                  />

                  <Input
                    label="Farmer Name"
                    value={selectedInvoice?.partyName || ""}
                    onChange={() => {}}
                    placeholder="Auto-filled from invoice"
                    readOnly
                  />

                  <Input
                    label="Mobile Number"
                    value={
                      selectedInvoice?.farmerPhone ||
                      selectedFarmer?.phone ||
                      ""
                    }
                    onChange={() => {}}
                    placeholder="Auto-filled from invoice"
                    readOnly
                  />

                  <Input
                    label="Village"
                    value={
                      selectedInvoice?.farmerVillage ||
                      selectedFarmer?.village ||
                      ""
                    }
                    onChange={() => {}}
                    placeholder="Auto-filled from invoice"
                    readOnly
                  />

                  <Input
                    label="Invoice Amount"
                    type="number"
                    value={String(invoiceAmount)}
                    onChange={() => {}}
                    placeholder="Auto-filled from invoice"
                    readOnly
                  />

                  <Select
                    label="Reason"
                    value={reason}
                    onChange={setReason}
                    placeholder="Select reason"
                    options={reasons.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  <Select
                    label="Payment Method"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Select method"
                    options={methods.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    required
                  />

                  <Input
                    label="Refund Amount"
                    type="number"
                    value={String(amount)}
                    onChange={(value) => {
                      const next = Number(value) || 0;
                      setAmount(
                        Math.min(next, invoiceAmount || next),
                      );
                    }}
                    placeholder="Enter refund amount"
                    required
                  />

                  <Input
                    label="Balance Value"
                    value={formatCurrency(
                      Math.max(invoiceAmount - amount, 0),
                    )}
                    onChange={() => {}}
                    readOnly
                  />

                  <div className="md:col-span-2">
                    <Input
                      label="Remarks"
                      value={remarks}
                      onChange={setRemarks}
                      placeholder="Optional remarks"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>

                <Button
                  onClick={createRefund}
                  disabled={!canCreate}
                >
                  <Icon name="save" size={17} />
                  Create Refund
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedRefund &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 8mm;
                }

                body * {
                  visibility: hidden !important;
                }

                .refund-print-area,
                .refund-print-area * {
                  visibility: visible !important;
                }

                .refund-print-area {
                  position: absolute !important;
                  inset: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: #fff !important;
                }

                .refund-screen-only {
                  display: none !important;
                }

                .refund-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }
              }
            `}</style>

            <div className="refund-print-area flex max-h-[94vh] w-[94vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="refund-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Refund
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedRefund.refundNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRefund(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="refund-scroll min-h-0 flex-1 overflow-y-auto p-4">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>

                        <div>
                          <h3 className="text-base font-extrabold tracking-wide text-slate-900">
                            {currentStore?.name || "SAIRAM AGRI INPUT"}
                          </h3>
                          <p className="mt-1 text-[11px] leading-4 text-slate-600">
                            {currentStore?.address ||
                              currentStore?.location ||
                              "Rajapalayam, Tamil Nadu"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            GSTIN: {currentStore?.gst || "-"}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Cell: {currentStore?.phone || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center p-4">
                      <h3 className="text-2xl font-bold uppercase text-slate-900">
                        Refund Receipt
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300 text-sm">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Refund To
                      </p>

                      <p className="mt-2 font-bold text-slate-900">
                        {selectedRefund.farmerName}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {selectedRefund.village || "-"}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Mobile: {selectedRefund.phone || "-"}
                      </p>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-[120px_1fr] gap-y-2">
                        <span className="text-slate-500">Refund No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedRefund.refundNo}
                        </span>

                        <span className="text-slate-500">Refund Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selectedRefund.date)}
                        </span>

                        <span className="text-slate-500">Invoice No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedRefund.referenceNo}
                        </span>

                        <span className="text-slate-500">Payment Method</span>
                        <span className="font-semibold text-slate-800">
                          {selectedRefund.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 border-b border-slate-300 bg-slate-50">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Invoice Amount
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {formatCurrency(selectedRefund.invoiceAmount || 0)}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Refund Amount
                      </p>
                      <p className="mt-1 text-lg font-bold text-brand-700">
                        {formatCurrency(selectedRefund.amount)}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Balance Value
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {formatCurrency(
                          Math.max(
                            (selectedRefund.invoiceAmount || 0) -
                              selectedRefund.amount,
                            0,
                          ),
                        )}
                      </p>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Reason
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {selectedRefund.reason}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_280px]">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Remarks
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {selectedRefund.remarks ||
                          `Refund issued against invoice ${selectedRefund.referenceNo}.`}
                      </p>
                    </div>

                    <div className="p-4 text-sm">
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">
                          Invoice Amount
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(
                            selectedRefund.invoiceAmount || 0,
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">
                          Refunded
                        </span>
                        <span className="font-semibold text-brand-700">
                          {formatCurrency(selectedRefund.amount)}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between border-t border-slate-300 pt-2">
                        <span className="font-bold text-slate-900">
                          Balance Value
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(
                            Math.max(
                              (selectedRefund.invoiceAmount || 0) -
                                selectedRefund.amount,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-300 p-4">
                    <div className="w-52 text-center">
                      <div className="h-12 border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="refund-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedRefund(null)}
                >
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Refund
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

    </div>
  );
}
