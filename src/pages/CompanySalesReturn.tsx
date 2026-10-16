import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, EmptyState, Icon, Input, Select } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatRoundOff,
  matchesSimpleDate,
  numberToWords,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";
import {
  getDatabasePurchaseReturns,
  getStore,
  getStoreApprovalRequests,
  rejectStoreApprovalRequest,
  storeApprovalRequestsUpdatedEvent,
  updateStoreApprovalRequestStatus,
  type StoreApprovalRequestStatus,
} from "@/lib/data";
import { dbErrorMessage } from "@/lib/db/errors";
import { usesSupabaseData } from "@/lib/db/mode";
import { refreshPurchasingData } from "@/lib/db/purchasing";
import { decidePurchaseReturn } from "@/lib/db/rpc";
import { purchaseReturnsUpdatedEvent } from "@/pages/StorePurchaseReturn";

type ReturnLine = {
  id: string;
  approvalId: string;
  date: string;
  returnNo: string;
  storeId: string;
  storeName: string;
  product: string;
  packSize: string;
  batchNo: string;
  quantity: number;
  price: number;
  discountAmount: number;
  tax: number;
  total: number;
  status: StoreApprovalRequestStatus;
};

type ReturnDetail = {
  id: string;
  returnNo: string;
  date: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  invoiceNo: string;
  reason: string;
  remarks: string;
  status: StoreApprovalRequestStatus;
  total: number;
  storeAddress: string;
  storeGst: string;
  items: Array<{
    id: string;
    product: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    quantity: number;
    price: number;
    beforeDiscount: number;
    discountPercent: number;
    discountAmount: number;
    taxable: number;
    sgst: number;
    cgst: number;
    igst: number;
    total: number;
    reason: string;
  }>;
};

function lineMoney(item: {
  price?: number;
  quantity?: number;
  discountAmount?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total?: number;
}) {
  const price = Number(item.price || 0);
  const quantity = Number(item.quantity || 0);
  const beforeDiscount = price * quantity;
  const discountAmount = Number(item.discountAmount || 0);
  const sgst = Number(item.sgst || 0);
  const cgst = Number(item.cgst || 0);
  const igst = Number(item.igst || 0);
  const total = Number(item.total || 0);
  const taxable = Math.max(0, total - sgst - cgst - igst);
  const discountPercent = beforeDiscount > 0 ? (discountAmount / beforeDiscount) * 100 : 0;
  return { beforeDiscount, discountAmount, discountPercent, taxable, sgst, cgst, igst, total };
}

function loadReturnLines(): ReturnLine[] {
  if (usesSupabaseData()) {
    const lines: ReturnLine[] = [];
    getDatabasePurchaseReturns().forEach((row) => {
      if (row.items.length === 0) {
        lines.push({
          id: row.id,
          approvalId: row.id,
          date: row.date,
          returnNo: row.returnNo,
          storeId: row.storeId,
          storeName: row.storeName,
          product: "-",
          packSize: "-",
          batchNo: "-",
          quantity: 0,
          price: 0,
          discountAmount: 0,
          tax: 0,
          total: row.total,
          status: row.status,
        });
        return;
      }
      row.items.forEach((item) => {
        lines.push({
          id: item.id,
          approvalId: row.id,
          date: row.date,
          returnNo: row.returnNo,
          storeId: row.storeId,
          storeName: row.storeName,
          product: item.product || "-",
          packSize: item.packSize || "-",
          batchNo: item.batchNo || "-",
          quantity: item.quantity,
          price: item.price,
          discountAmount: item.discountAmount,
          tax: item.sgst + item.cgst + item.igst,
          total: item.total,
          status: row.status,
        });
      });
    });
    return lines.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  const requests = getStoreApprovalRequests().filter(
    (request) => request.type === "Purchase Return",
  );
  const lines: ReturnLine[] = [];

  requests.forEach((request) => {
    let items: any[] = [];
    let returnDate = String(request.date || "");
    try {
      const raw = localStorage.getItem(
        `naturebiotic:purchase-returns:${request.storeId}`,
      );
      const saved = raw ? JSON.parse(raw) : [];
      const match = Array.isArray(saved)
        ? saved.find((row) => row?.returnNo === request.referenceNo)
        : null;
      items = Array.isArray(match?.items) ? match.items : [];
      if (match?.date) returnDate = String(match.date);
    } catch {
      items = [];
    }

    if (items.length === 0) {
      lines.push({
        id: request.id,
        approvalId: request.id,
        date: returnDate,
        returnNo: request.referenceNo,
        storeId: request.storeId,
        storeName: request.storeName,
        product: "-",
        packSize: "-",
        batchNo: "-",
        quantity: 0,
        price: 0,
        discountAmount: 0,
        tax: 0,
        total: request.amount,
        status: request.status,
      });
      return;
    }

    items.forEach((item, index) => {
      lines.push({
        id: `${request.id}-${item.id || index}`,
        approvalId: request.id,
        date: returnDate,
        returnNo: request.referenceNo,
        storeId: request.storeId,
        storeName: request.storeName,
        product: item.product || "-",
        packSize: item.packSize || "-",
        batchNo: item.batchNo || "-",
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        discountAmount: Number(item.discountAmount || 0),
        tax:
          Number(item.sgst || 0) +
          Number(item.cgst || 0) +
          Number(item.igst || 0),
        total: Number(item.total || 0),
        status: request.status,
      });
    });
  });

  return lines.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function detailFromDatabase(approvalId: string): ReturnDetail | null {
  const row = getDatabasePurchaseReturns().find((item) => item.id === approvalId);
  if (!row) return null;
  const store = getStore(row.storeId);
  return {
    id: row.id,
    returnNo: row.returnNo,
    date: row.date,
    storeId: row.storeId,
    storeName: row.storeName,
    storeCode: row.storeCode,
    invoiceNo: row.invoiceNo,
    reason: row.reason,
    remarks: row.decisionNote,
    status: row.status,
    total: row.total,
    storeAddress: store?.address || store?.location || "",
    storeGst: store?.gst || "",
    items: row.items.map((item) => ({
      id: item.id,
      product: item.product || "-",
      packSize: item.packSize || "-",
      batchNo: item.batchNo || "-",
      expiryDate: item.expiryDate || "",
      quantity: item.quantity,
      price: item.price,
      reason: item.reason || "",
      ...lineMoney(item),
    })),
  };
}

function detailFromLocal(line: ReturnLine): ReturnDetail {
  const store = getStore(line.storeId);
  let match: any = null;
  try {
    const raw = localStorage.getItem(`naturebiotic:purchase-returns:${line.storeId}`);
    const saved = raw ? JSON.parse(raw) : [];
    match = Array.isArray(saved)
      ? saved.find((row) => row?.returnNo === line.returnNo)
      : null;
  } catch {
    match = null;
  }
  const items = Array.isArray(match?.items) ? match.items : [];
  return {
    id: line.approvalId,
    returnNo: line.returnNo,
    date: String(match?.date || line.date || ""),
    storeId: line.storeId,
    storeName: line.storeName,
    storeCode: store?.code || "",
    invoiceNo: String(match?.purchaseRef || ""),
    reason: String(match?.reason || ""),
    remarks: String(match?.remarks || match?.decisionNote || ""),
    status: line.status,
    total: Number(match?.total || line.total || 0),
    storeAddress: store?.address || store?.location || "",
    storeGst: store?.gst || "",
    items: items.map((item: any, index: number) => ({
      id: String(item.id || index),
      product: item.product || "-",
      packSize: item.packSize || "-",
      batchNo: item.batchNo || "-",
      expiryDate: String(item.expiryDate || ""),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      reason: String(item.reason || ""),
      ...lineMoney({
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0),
        discountAmount: Number(item.discountAmount || 0),
        sgst: Number(item.sgst || 0),
        cgst: Number(item.cgst || 0),
        igst: Number(item.igst || 0),
        total: Number(item.total || 0),
      }),
    })),
  };
}

export default function CompanySalesReturn() {
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [selected, setSelected] = useState<ReturnDetail | null>(null);
  const [actionError, setActionError] = useState("");
  const decidingRef = useRef(false);
  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    let active = true;
    const read = () => {
      if (active) setLines(loadReturnLines());
    };
    const pull = () => {
      if (!usesSupabaseData()) {
        read();
        return;
      }
      refreshPurchasingData()
        .then(() => {
          if (!active) return;
          read();
          setActionError("");
        })
        .catch((error) => {
          if (!active) return;
          setLines([]);
          setActionError(dbErrorMessage(error, "Could not load sales returns."));
        });
    };
    pull();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, read);
    window.addEventListener(purchaseReturnsUpdatedEvent, read);
    window.addEventListener("focus", pull);
    return () => {
      active = false;
      window.removeEventListener(storeApprovalRequestsUpdatedEvent, read);
      window.removeEventListener(purchaseReturnsUpdatedEvent, read);
      window.removeEventListener("focus", pull);
    };
  }, []);

  function openDetail(line: ReturnLine) {
    const detail = usesSupabaseData()
      ? detailFromDatabase(line.approvalId)
      : detailFromLocal(line);
    if (detail) setSelected(detail);
  }

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    if (decidingRef.current) return;
    if (decision === "rejected" && !window.confirm("Reject this purchase return? Stock stays with the store.")) {
      return;
    }
    if (!usesSupabaseData()) {
      if (decision === "approved") updateStoreApprovalRequestStatus(approvalId, "Approved");
      else rejectStoreApprovalRequest(approvalId);
      setLines(loadReturnLines());
      setSelected((current) =>
        current?.id === approvalId
          ? { ...current, status: decision === "approved" ? "Approved" : "Rejected" }
          : current,
      );
      return;
    }
    decidingRef.current = true;
    setActionError("");
    try {
      await decidePurchaseReturn(approvalId, decision);
      await refreshPurchasingData();
      setLines(loadReturnLines());
      setSelected((current) =>
        current?.id === approvalId ? detailFromDatabase(approvalId) : current,
      );
    } catch (error) {
      setActionError(
        dbErrorMessage(
          error,
          decision === "approved"
            ? "This purchase return could not be accepted."
            : "This purchase return could not be rejected.",
        ),
      );
    } finally {
      decidingRef.current = false;
    }
  }

  const visibleLines = useMemo(
    () =>
      lines.filter((line) =>
        matchesSimpleDate(line.date, dateFilter, customFrom, customTo),
      ),
    [lines, dateFilter, customFrom, customTo],
  );

  const tableRows = useMemo(() => {
    const groups = new Map<string, ReturnLine[]>();
    visibleLines.forEach((line) => {
      const list = groups.get(line.approvalId) ?? [];
      list.push(line);
      groups.set(line.approvalId, list);
    });
    return Array.from(groups.values()).map((items) => {
      const first = items[0];
      const priced = items.filter((item) => item.quantity > 0);
      return {
        line: first,
        rate: priced.length === 1 ? priced[0].price : null,
        discount: items.reduce((sum, item) => sum + item.discountAmount, 0),
        tax: items.reduce((sum, item) => sum + item.tax, 0),
        total: items.reduce((sum, item) => sum + item.total, 0),
      };
    });
  }, [visibleLines]);

  const summary = useMemo(() => {
    const groups = new Map<string, ReturnLine[]>();
    visibleLines.forEach((line) => {
      const list = groups.get(line.returnNo) ?? [];
      list.push(line);
      groups.set(line.returnNo, list);
    });
    const grouped = Array.from(groups.values());
    return {
      total: grouped.length,
      pending: grouped.filter((items) =>
        items.some((item) => item.status === "Pending"),
      ).length,
      approved: grouped.filter((items) =>
        items.every((item) => item.status === "Approved"),
      ).length,
      value: visibleLines.reduce((sum, line) => sum + Number(line.total || 0), 0),
    };
  }, [visibleLines]);

  return (
    <div>
      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Sales Return
          </h1>
          <p className="mt-1 text-slate-500">
            Store purchase returns waiting for company acceptance.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
          <div className="w-full sm:w-44">
            <Select
              label="Date Filter"
              value={dateFilter}
              onChange={(value) => setDateFilter(value as SimpleDateFilter)}
              options={simpleDateFilterOptions}
            />
          </div>
          {dateFilter === "custom" && (
            <>
              <div className="w-full sm:w-40">
                <Input
                  label="From Date"
                  type="date"
                  value={customFrom}
                  onChange={setCustomFrom}
                />
              </div>
              <div className="w-full sm:w-40">
                <Input
                  label="To Date"
                  type="date"
                  value={customTo}
                  onChange={setCustomTo}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Total Returns</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{summary.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Total Return Value</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {formatCurrency(summary.value)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{summary.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Approved</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{summary.approved}</p>
        </Card>
      </div>

      {tableRows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="assignment_return"
            title="No sales returns"
            description="A store purchase return appears here for acceptance."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  {[
                    ["S.No", "w-[6%] text-center"],
                    ["Return Date", "w-[12%]"],
                    ["Return No", "w-[13%]"],
                    ["Store", "w-[11%]"],
                    ["Rate", "w-[10%] text-right"],
                    ["Discount", "w-[10%] text-right"],
                    ["Tax", "w-[10%] text-right"],
                    ["Total", "w-[10%] text-right"],
                    ["Status", "w-[18%] text-center"],
                  ].map(([heading, align]) => (
                    <th
                      key={heading}
                      className={`border-r border-slate-200 px-2 py-3 font-semibold last:border-r-0 ${align}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, index) => (
                  <tr
                    key={row.line.approvalId}
                    onClick={() => openDetail(row.line)}
                    className={`cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-brand-50/40 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 whitespace-nowrap text-slate-500">
                      {formatDate(row.line.date)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 font-semibold whitespace-nowrap text-slate-800">
                      {row.line.returnNo}
                    </td>
                    <td className="truncate border-r border-slate-100 px-2 py-3 text-slate-700">
                      {row.line.storeName}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {row.rate == null ? "â€”" : formatCurrency(row.rate)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {formatCurrency(row.discount)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {formatCurrency(row.tax)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {row.line.status === "Pending" ? (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void decide(row.line.approvalId, "approved");
                            }}
                            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void decide(row.line.approvalId, "rejected");
                            }}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            row.line.status === "Approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {row.line.status}
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

      {selected && (
        <SalesReturnSheet
          row={selected}
          onClose={() => setSelected(null)}
          onDecide={(decision) => void decide(selected.id, decision)}
        />
      )}
    </div>
  );
}

function SalesReturnSheet({
  row,
  onClose,
  onDecide,
}: {
  row: ReturnDetail;
  onClose: () => void;
  onDecide: (decision: "approved" | "rejected") => void;
}) {
  const items = row.items;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const beforeDiscount = items.reduce((sum, item) => sum + item.beforeDiscount, 0);
  const discount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const taxable = items.reduce((sum, item) => sum + item.taxable, 0);
  const sgst = items.reduce((sum, item) => sum + item.sgst, 0);
  const cgst = items.reduce((sum, item) => sum + item.cgst, 0);
  const igst = items.reduce((sum, item) => sum + item.igst, 0);
  const grand = items.reduce((sum, item) => sum + item.total, 0) || row.total;
  const filler = Math.max(0, 8 - items.length);
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-2 backdrop-blur-[2px] sm:p-4">
      <div className="nb-print-panel flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Sales Return</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-800">{row.returnNo}</h2>
            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                row.status === "Approved"
                  ? "bg-emerald-50 text-emerald-700"
                  : row.status === "Rejected"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {row.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          <div className="min-w-[920px] overflow-hidden rounded-xl border border-slate-300 bg-white">
            <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
              <div className="border-r border-slate-300 px-6 py-3">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                    <img src="/logo_NB.webp" alt="Nature Biotic" className="max-h-14 max-w-full object-contain" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold tracking-wide text-slate-900">NATURE BIOTIC</h3>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                      4/130/A1, Velavan Nagar, Velayudhampuram, Rajapalayam, Tamil Nadu - 626102
                    </p>
                    <p className="text-[10px] text-slate-600">GSTIN: 33AEZPV5328P1ZC</p>
                    <p className="text-[10px] text-slate-600">Cell: 96008 44446</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center px-4 py-3">
                <h3 className="text-center text-2xl font-extrabold uppercase text-slate-900">Sales Return</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
              <div className="border-r border-slate-300 px-3 py-2.5">
                <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">Returned By</p>
                <p className="font-bold text-slate-900">{row.storeName || "-"}</p>
                <p className="text-slate-600">{row.storeCode ? `Code: ${row.storeCode}` : row.storeId || "-"}</p>
                <p className="text-slate-600">{row.storeAddress || "-"}</p>
                <p className="text-slate-600">GSTIN: {row.storeGst || "-"}</p>
              </div>
              <div className="border-r border-slate-300 px-3 py-2.5">
                <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">Supplier</p>
                <p className="font-bold text-slate-900">Nature Biotic</p>
                <p className="text-slate-600">Rajapalayam, Tamil Nadu - 626108</p>
                <p className="text-slate-600">GSTIN: 33AEZPV5328P1ZC</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">Return Details</p>
                <div className="grid grid-cols-[105px_1fr] gap-y-0.5">
                  <span className="text-slate-500">Return No</span>
                  <span className="font-semibold text-slate-800">{row.returnNo}</span>
                  <span className="text-slate-500">Date</span>
                  <span className="font-semibold text-slate-800">{formatSheetDate(row.date)}</span>
                  <span className="text-slate-500">Invoice</span>
                  <span className="font-semibold text-slate-800">{row.invoiceNo || "-"}</span>
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-slate-800">{row.status}</span>
                </div>
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-[9px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                    <th rowSpan={2} className="w-[4%] border-r border-slate-300 px-1 py-2 text-center">S.No</th>
                    <th rowSpan={2} className="w-[14%] border-r border-slate-300 px-1 py-2 text-left">Product</th>
                    <th rowSpan={2} className="w-[7%] border-r border-slate-300 px-1 py-2 text-center">Size</th>
                    <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-1 py-2 text-center">Batch ID</th>
                    <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-1 py-2 text-center">Expiry</th>
                    <th rowSpan={2} className="w-[5%] border-r border-slate-300 px-1 py-2 text-center">Qty</th>
                    <th rowSpan={2} className="w-[7%] border-r border-slate-300 px-1 py-2 text-right">Price</th>
                    <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-1 py-2 text-right">Before Discount</th>
                    <th colSpan={2} className="border-r border-slate-300 px-1 py-1 text-center">Discount</th>
                    <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-1 py-2 text-right">Taxable</th>
                    <th colSpan={2} className="border-r border-slate-300 px-1 py-1 text-center">SGST</th>
                    <th colSpan={2} className="border-r border-slate-300 px-1 py-1 text-center">CGST</th>
                    <th colSpan={2} className="border-r border-slate-300 px-1 py-1 text-center">IGST</th>
                    <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-1 py-2 text-right">Line Total</th>
                    <th rowSpan={2} className="px-1 py-2 text-left">Reason</th>
                  </tr>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-500">
                    <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                    <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{index + 1}</td>
                      <td className="border-r border-slate-300 px-1 py-2 font-semibold text-slate-800">{item.product}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{item.packSize}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{item.batchNo || "-"}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{item.expiryDate ? formatSheetDate(item.expiryDate) : "-"}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{item.quantity}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.price)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.beforeDiscount)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{item.discountPercent.toFixed(2)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.discountAmount)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.taxable)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{rateOf(item.sgst, item.taxable)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.sgst)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{rateOf(item.cgst, item.taxable)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.cgst)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-center">{rateOf(item.igst, item.taxable)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right">{formatCurrency(item.igst)}</td>
                      <td className="border-r border-slate-300 px-1 py-2 text-right font-bold">{formatCurrency(item.total)}</td>
                      <td className="px-1 py-2 text-slate-600">{item.reason || "-"}</td>
                    </tr>
                  ))}
                  {Array.from({ length: filler }).map((_, index) => (
                    <tr key={`blank-${index}`}>
                      {Array.from({ length: 19 }).map((__, column) => (
                        <td key={column} className={`px-1 py-2 ${column < 18 ? "border-r border-slate-300" : ""}`}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                    <td colSpan={5} className="border-r border-slate-300 p-2 text-center">Total</td>
                    <td className="border-r border-slate-300 p-2 text-center">{totalQty}</td>
                    <td className="border-r border-slate-300 p-2" />
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(beforeDiscount)}</td>
                    <td className="border-r border-slate-300 p-2" />
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(discount)}</td>
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(taxable)}</td>
                    <td className="border-r border-slate-300 p-2" />
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(sgst)}</td>
                    <td className="border-r border-slate-300 p-2" />
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(cgst)}</td>
                    <td className="border-r border-slate-300 p-2" />
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(igst)}</td>
                    <td className="border-r border-slate-300 p-2 text-right">{formatCurrency(grand)}</td>
                    <td className="p-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="grid grid-cols-[1fr_280px] border-t border-slate-300">
              <div className="flex items-center border-r border-slate-300 p-2.5">
                <p className="text-[10px] font-semibold text-slate-700">
                  Amount in Words : <span className="font-bold text-slate-900">{numberToWords(grand)}</span>
                </p>
              </div>
              <div className="space-y-1 p-2.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Round Off</span>
                  <span>{formatRoundOff(0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-300 pt-1.5 font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>{formatCurrency(grand)}</span>
                </div>
              </div>
            </div>
            <div className="grid min-h-[110px] grid-cols-[1fr_280px] border-t border-slate-300">
              <div className="border-r border-slate-300 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-slate-600">
                  {[row.reason, row.remarks].filter(Boolean).join("\n") || "-"}
                </p>
              </div>
              <div className="flex items-end justify-center p-3">
                <div className="w-full text-center">
                  <div className="border-b border-slate-300" />
                  <p className="mt-1.5 text-xs font-semibold text-slate-500">Authorised Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          {row.status === "Pending" && (
            <>
              <Button variant="secondary" onClick={() => onDecide("rejected")}>Reject</Button>
              <Button onClick={() => onDecide("approved")}>Accept</Button>
            </>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function rateOf(amount: number, taxable: number) {
  if (taxable <= 0 || amount <= 0) return "0.00";
  return ((amount / taxable) * 100).toFixed(2);
}

function formatSheetDate(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year.slice(-2)}`;
}
