import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, Input, Select } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  matchesSimpleDate,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";
import {
  getStoreApprovalRequests,
  rejectStoreApprovalRequest,
  storeApprovalRequestsUpdatedEvent,
  updateStoreApprovalRequestStatus,
  type StoreApprovalRequestStatus,
} from "@/lib/data";
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

function loadReturnLines(): ReturnLine[] {
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

export default function CompanySalesReturn() {
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const refresh = () => setLines(loadReturnLines());
    refresh();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, refresh);
    window.addEventListener(purchaseReturnsUpdatedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(storeApprovalRequestsUpdatedEvent, refresh);
      window.removeEventListener(purchaseReturnsUpdatedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function accept(approvalId: string) {
    updateStoreApprovalRequestStatus(approvalId, "Approved");
  }

  function reject(approvalId: string) {
    if (!window.confirm("Reject this purchase return? Stock stays with the store.")) {
      return;
    }
    rejectStoreApprovalRequest(approvalId);
  }

  const visibleLines = useMemo(
    () =>
      lines.filter((line) =>
        matchesSimpleDate(line.date, dateFilter, customFrom, customTo),
      ),
    [lines, dateFilter, customFrom, customTo],
  );

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

      {visibleLines.length === 0 ? (
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
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  {[
                    "S.No",
                    "Return Date",
                    "Return No",
                    "Store",
                    "Product",
                    "Size",
                    "Batch ID",
                    "Qty",
                    "Rate",
                    "Discount",
                    "Tax",
                    "Total",
                    "Status",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-r border-slate-200 px-2 py-3 text-left font-semibold last:border-r-0 last:text-center"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line, index) => (
                  <tr
                    key={line.id}
                    className={`border-b border-slate-100 last:border-b-0 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 whitespace-nowrap text-slate-500">
                      {formatDate(line.date)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 font-semibold whitespace-nowrap text-slate-800">
                      {line.returnNo}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-slate-700">
                      {line.storeName}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-slate-700">
                      {line.product}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-slate-600">
                      {line.packSize}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-slate-600">
                      {line.batchNo}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {line.quantity}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {formatCurrency(line.price)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {formatCurrency(line.discountAmount)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums">
                      {formatCurrency(line.tax)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {formatCurrency(line.total)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {line.status === "Pending" &&
                      visibleLines.findIndex(
                        (item) =>
                          item.returnNo === line.returnNo &&
                          item.storeId === line.storeId,
                      ) === index ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => accept(line.approvalId)}
                            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(line.approvalId)}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            line.status === "Approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : line.status === "Pending"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {line.status}
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
