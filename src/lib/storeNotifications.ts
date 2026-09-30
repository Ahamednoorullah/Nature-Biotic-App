import type { StorePage } from "@/context/NavContext";
import {
  getCompanyCreditNoteSyncRecords,
  getCompanyStoreSales,
  getStaffByStore,
  getStoreApprovalRequests,
  getStorePurchaseStatuses,
} from "@/lib/data";
import { roleForStaffDesignation } from "@/lib/auth/roles";
import { formatCurrency, formatDate, parseBusinessDate } from "@/lib/format";

export type StoreNotification = {
  id: string;
  title: string;
  description: string;
  status: string;
  tone: "pending" | "accepted" | "neutral";
  icon: string;
  at: number;
  timeLabel: string;
  page: StorePage;
};

function readArray(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function readScoped(prefix: string, storeId: string) {
  if (typeof window === "undefined") return [];
  const rows: any[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${prefix}:`)) continue;
    readArray(key).forEach((row) => {
      if (row?.storeId === storeId) rows.push(row);
    });
  }
  return rows;
}

function timeValue(value: unknown, createdAt?: unknown) {
  if (typeof createdAt === "number" && createdAt > 0) return createdAt;
  const parsed = parseBusinessDate(String(value || ""));
  return parsed ? parsed.getTime() : 0;
}

function timeLabel(value: unknown, at: number) {
  const raw = String(value || "");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(raw);
  if (dateOnly) {
    const parsed = parseBusinessDate(raw);
    if (!parsed) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    if (parsed.getTime() === today.getTime()) return "Today";
    return raw.includes("-") ? formatDate(raw) : raw;
  }
  if (!at) return "";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(at).toLocaleDateString("en-IN");
}

function note(
  item: Omit<StoreNotification, "timeLabel"> & { sourceDate?: unknown },
): StoreNotification {
  return {
    ...item,
    timeLabel: timeLabel(item.sourceDate, item.at),
  };
}

function assignedFros(storeId: string) {
  const names = new Set<string>();
  const ids = new Set<string>();
  getStaffByStore(storeId).forEach((member) => {
    if (String(member.status || "").toLowerCase() === "inactive") return;
    if (roleForStaffDesignation(member.designation) !== "fro") return;
    names.add(String(member.name || "").trim().toLowerCase());
    ids.add(member.id);
  });
  return { names, ids };
}

function isDummySale(row: any) {
  return row?.id === "store-sale-1" || row?.invoiceNo === "nb-inv-2001";
}

export function getStoreNotifications(storeId: string): StoreNotification[] {
  if (!storeId) return [];
  const items: StoreNotification[] = [];
  const purchaseStatus = getStorePurchaseStatuses();
  const fros = assignedFros(storeId);

  getStoreApprovalRequests()
    .filter(
      (request) =>
        request.type === "Purchase Order" &&
        request.storeId === storeId &&
        request.status === "Approved",
    )
    .forEach((request) => {
      items.push(
        note({
          id: `po-accepted:${storeId}:${request.referenceNo}`,
          title: "Purchase Order Accepted",
          description: `${request.referenceNo} has been accepted by Nature Biotic.`,
          status: "Accepted",
          tone: "accepted",
          icon: "shopping_cart_checkout",
          at: timeValue(request.date, request.createdAt),
          sourceDate: request.date,
          page: "purchase-order",
        }),
      );
    });

  const invoices = new Map<string, any[]>();
  getCompanyStoreSales()
    .filter((sale) => sale.storeId === storeId)
    .forEach((sale) => {
      const list = invoices.get(sale.invoiceNo) ?? [];
      list.push(sale);
      invoices.set(sale.invoiceNo, list);
    });
  invoices.forEach((lines, invoiceNo) => {
    const amount = lines.reduce((sum, line) => sum + Number(line.total || 0), 0);
    const received = purchaseStatus[invoiceNo] === "Received";
    const product = String(lines[0]?.product || "Invoice");
    const extra = lines.length > 1 ? ` +${lines.length - 1}` : "";
    items.push(
      note({
        id: `company-invoice:${storeId}:${invoiceNo}`,
        title: received ? "New Sales Invoice" : "Stock Delivery Pending Acceptance",
        description: `${invoiceNo} · ${formatCurrency(amount)} · ${product}${extra}`,
        status: received ? "Received" : "Pending",
        tone: received ? "accepted" : "pending",
        icon: received ? "receipt_long" : "local_shipping",
        at: timeValue(lines[0]?.date),
        sourceDate: lines[0]?.date,
        page: "purchases",
      }),
    );
  });

  const credits = new Map<string, any[]>();
  getCompanyCreditNoteSyncRecords()
    .filter((row) => row.storeId === storeId)
    .forEach((row) => {
      const list = credits.get(row.creditNoteNo) ?? [];
      list.push(row);
      credits.set(row.creditNoteNo, list);
    });
  credits.forEach((lines, creditNoteNo) => {
    const amount = lines.reduce(
      (sum, line) => sum + Number(line.returnAmount || 0),
      0,
    );
    const approved = lines.every((line) => line.status === "Approved");
    const rejected = lines.every((line) => line.status === "Rejected");
    const status = approved ? "Approved" : rejected ? "Rejected" : "Pending";
    items.push(
      note({
        id: `credit-note:${storeId}:${creditNoteNo}`,
        title: "Credit Note Updated",
        description: `${creditNoteNo} · ${formatCurrency(amount)}`,
        status,
        tone: approved ? "accepted" : "pending",
        icon: "undo",
        at: timeValue(lines[0]?.returnDate),
        sourceDate: lines[0]?.returnDate,
        page: "debit-notes",
      }),
    );
  });

  readArray("nature-biotic-company-receipts-v1")
    .filter((row) => row?.storeId === storeId && row?.receiptNo)
    .forEach((row) => {
      items.push(
        note({
          id: `company-receipt:${storeId}:${row.receiptNo}`,
          title: "Payment Received",
          description: `${row.receiptNo} · ${formatCurrency(Number(row.amount || 0))}${
            row.invoiceNo ? ` · ${row.invoiceNo}` : ""
          }`,
          status: "Received",
          tone: "accepted",
          icon: "payments",
          at: timeValue(row.date),
          sourceDate: row.date,
          page: "purchases",
        }),
      );
    });

  readScoped("nature-biotic-fro-stock-return-requests-v1", storeId)
    .filter((row) => row?.storeId === storeId && row?.id)
    .forEach((row) => {
      const pending = row.status !== "accepted";
      const qty = (Array.isArray(row.items) ? row.items : []).reduce(
        (sum: number, item: any) => sum + Number(item?.qty || 0),
        0,
      );
      const product = row.items?.[0]?.product || "Stock";
      items.push(
        note({
          id: `fro-return:${storeId}:${row.id}`,
          title: pending
            ? "FRO Stock Return Pending Acceptance"
            : "FRO Stock Return",
          description: `${row.froName || "FRO"} · ${row.rcNo || row.id} · ${product} · Qty ${qty}`,
          status: pending ? "Pending" : "Accepted",
          tone: pending ? "pending" : "accepted",
          icon: "assignment_return",
          at: timeValue(row.date, Date.parse(row.createdAt || "") || undefined),
          sourceDate: row.date,
          page: "return-challan",
        }),
      );
    });

  readArray(`nature-biotic-store-sales-invoices-v2:${storeId}`)
    .filter(
      (row) =>
        row?.through === "Executive" &&
        row?.invoiceNo &&
        !isDummySale(row) &&
        (!row.executiveName ||
          fros.names.has(String(row.executiveName).trim().toLowerCase())),
    )
    .forEach((row) => {
      items.push(
        note({
          id: `fro-sale:${storeId}:${row.invoiceNo}`,
          title: "FRO Sale",
          description: `${row.executiveName || "FRO"} · ${row.invoiceNo} · ${formatCurrency(
            Number(row.amount || 0),
          )}`,
          status: "Recorded",
          tone: "neutral",
          icon: "point_of_sale",
          at: timeValue(row.date),
          sourceDate: row.date,
          page: "sales-invoice",
        }),
      );
    });

  readArray(`nature-biotic-quotations-${storeId}`)
    .filter((row) => {
      if (!row?.quotationNo) return false;
      const executive = String(row.executiveName || "").trim().toLowerCase();
      return (
        row.through === "Executive" ||
        (executive && fros.names.has(executive)) ||
        (row.createdByStaffId && fros.ids.has(String(row.createdByStaffId)))
      );
    })
    .forEach((row) => {
      items.push(
        note({
          id: `fro-quote:${storeId}:${row.quotationNo}`,
          title: "New FRO Quotation",
          description: `${row.executiveName || "FRO"} · ${row.quotationNo} · ${formatCurrency(
            Number(row.amount || 0),
          )}`,
          status: String(row.status || "Open"),
          tone: "neutral",
          icon: "description",
          at: timeValue(row.date),
          sourceDate: row.date,
          page: "quotation",
        }),
      );
    });

  readArray(`nature-biotic-fro-handovers-v1:${storeId}`).forEach((row) => {
    if (!row?.id) return;
    const pending = row.status !== "accepted";
    items.push(
      note({
        id: `cash-handover:${storeId}:${row.id}`,
        title: pending ? "Cash Handover Pending" : "Cash Handover",
        description: `${row.handedOverBy || "FRO"} · ${formatCurrency(
          Number(row.amount || 0),
        )}`,
        status: pending ? "Pending" : "Accepted",
        tone: pending ? "pending" : "accepted",
        icon: "payments",
        at: timeValue(row.date, Date.parse(row.acceptedAt || "") || undefined),
        sourceDate: row.date,
        page: "dashboard",
      }),
    );
  });

  readArray(`nature-biotic-store-delivery-challans-v2:${storeId}`)
    .filter((row) => row?.status === "accepted" && row?.sdNo)
    .forEach((row) => {
      const qty = (Array.isArray(row.items) ? row.items : []).reduce(
        (sum: number, item: any) => sum + Number(item?.qty || 0),
        0,
      );
      items.push(
        note({
          id: `fro-delivery:${storeId}:${row.id || row.sdNo}`,
          title: "FRO Stock Delivery",
          description: `${row.executive || "FRO"} · ${row.sdNo} · Qty ${qty}`,
          status: "Accepted",
          tone: "accepted",
          icon: "local_shipping",
          at: timeValue(row.date, Date.parse(row.acceptedAt || "") || undefined),
          sourceDate: row.date,
          page: "delivery-challan",
        }),
      );
    });

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.at - a.at);
}
