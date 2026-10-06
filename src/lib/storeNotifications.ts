import type { StorePage } from "@/context/NavContext";
import {
  getCompanyCreditNoteSyncRecords,
  getCompanyRefunds,
  getFinalCompanyStoreSales,
  getStaffByStore,
  getStore,
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

  const invoices = new Map<string, any[]>();
  getFinalCompanyStoreSales()
    .filter((sale) => sale.storeId === storeId)
    .forEach((sale) => {
      const list = invoices.get(sale.invoiceNo) ?? [];
      list.push(sale);
      invoices.set(sale.invoiceNo, list);
    });
  invoices.forEach((lines, invoiceNo) => {
    const amount = lines.reduce((sum, line) => sum + Number(line.total || 0), 0);
    const received = purchaseStatus[invoiceNo] === "Received";
    if (received) return;
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
    if (approved || rejected) return;
    const status = "Pending";
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

  readScoped("nature-biotic-fro-stock-return-requests-v1", storeId)
    .filter((row) => row?.storeId === storeId && row?.id)
    .forEach((row) => {
      const statusName = String(row.status || "pending").toLowerCase();
      if (statusName !== "pending") return;
      const qty = (Array.isArray(row.items) ? row.items : []).reduce(
        (sum: number, item: any) => sum + Number(item?.qty || 0),
        0,
      );
      const product = row.items?.[0]?.product || "Stock";
      items.push(
        note({
          id: `fro-return:${storeId}:${row.id}`,
          title: "Stock Return Pending",
          description: `${row.froName || "FRO"} · ${row.rcNo || row.id} · ${product} · Qty ${qty}`,
          status: "Pending",
          tone: "pending",
          icon: "assignment_return",
          at: timeValue(row.date, Date.parse(row.createdAt || "") || undefined),
          sourceDate: row.date,
          page: "return-challan",
        }),
      );
    });

  readArray(`nature-biotic-fro-handovers-v1:${storeId}`).forEach((row) => {
    if (!row?.id || String(row.status || "").toLowerCase() !== "pending") return;
    items.push(
      note({
        id: `cash-handover:${storeId}:${row.id}`,
        title: "Cash Handover Pending",
        description: `${row.handedOverBy || "FRO"} · ${formatCurrency(
          Number(row.amount || 0),
        )}`,
        status: "Pending",
        tone: "pending",
        icon: "payments",
        at: timeValue(row.date),
        sourceDate: row.date,
        page: "dashboard",
      }),
    );
  });

  getStoreApprovalRequests()
    .filter(
      (request) =>
        request.storeId === storeId &&
        (request.type === "Purchase Order" || request.type === "Purchase Return") &&
        (request.status === "Approved" || request.status === "Rejected"),
    )
    .forEach((request) => {
      const isOrder = request.type === "Purchase Order";
      const approved = request.status === "Approved";
      const statusLabel = approved ? (isOrder ? "Accepted" : "Approved") : "Rejected";
      items.push(
        note({
          id: `${isOrder ? "po" : "purchase-return"}-${statusLabel.toLowerCase()}:${storeId}:${request.referenceNo}`,
          title: `${isOrder ? "Purchase Order" : "Purchase Return"} ${statusLabel}`,
          description: `${request.referenceNo} · ${formatCurrency(Number(request.amount || 0))} · ${
            approved
              ? isOrder
                ? "Accepted by Nature Biotic."
                : "Approved by Nature Biotic. Stock deducted."
              : "Rejected by Nature Biotic."
          }`,
          status: statusLabel,
          tone: approved ? "accepted" : "neutral",
          icon: isOrder ? "shopping_cart" : "assignment_return",
          at: timeValue(request.date, request.decidedAt || request.createdAt),
          sourceDate: request.decidedAt ? undefined : request.date,
          page: isOrder ? "purchase-order" : "return-stock",
        }),
      );
    });

  readArray("nature-biotic-company-receipts-v1")
    .filter((row) => row?.storeId === storeId && Number(row?.amount) > 0)
    .forEach((row) => {
      items.push(
        note({
          id: `company-receipt:${storeId}:${row.id || row.receiptNo}`,
          title: "Payment Received by Nature Biotic",
          description: `${row.receiptNo || "Receipt"} · ${formatCurrency(Number(row.amount || 0))} · ${row.invoiceNo || ""}`,
          status: "Paid",
          tone: "accepted",
          icon: "payments",
          at: timeValue(row.date),
          sourceDate: row.date,
          page: "payments",
        }),
      );
    });

  getCompanyRefunds()
    .filter((row) => row.storeId === storeId && Number(row.amount) > 0)
    .forEach((row) => {
      items.push(
        note({
          id: `company-refund:${storeId}:${row.id}`,
          title: "Refund Completed",
          description: `${row.refundNo || "Refund"} · ${formatCurrency(Number(row.amount || 0))} · ${row.referenceNo}`,
          status: "Refunded",
          tone: "accepted",
          icon: "currency_exchange",
          at: timeValue(row.date),
          sourceDate: row.date,
          page: "payments",
        }),
      );
    });

  readArray(`nature-biotic-store-delivery-challans-v2:${storeId}`).forEach((row) => {
    if (!row?.id || String(row.status || "").toLowerCase() !== "accepted") return;
    items.push(
      note({
        id: `delivery-accepted:${storeId}:${row.id}`,
        title: "Stock Delivery Accepted",
        description: `${row.sdNo || "Delivery"} · ${row.executive || "FRO"} accepted.`,
        status: "Accepted",
        tone: "accepted",
        icon: "local_shipping",
        at: timeValue(row.acceptedAt || row.date, row.acceptedAt),
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

function samePerson(value: unknown, name: string) {
  return String(value || "").trim().toLowerCase() === name;
}

/** Action and status items for one FRO. Ordinary store activity stays off this list. */
export function getFroNotifications(
  storeId: string,
  froName: string,
  _staffId = "",
): StoreNotification[] {
  const name = String(froName || "").trim().toLowerCase();
  if (!storeId || !name) return [];
  const items: StoreNotification[] = [];
  const storeName = getStore(storeId)?.name || "Store";
  const deliveries = new Map<string, any>();
  [
    ...readArray(`nature-biotic-store-delivery-challans-v2:${storeId}`),
    ...readArray(`nature-biotic-fro-pending-deliveries-v1:${name}`),
  ].forEach((row) => {
    if (!samePerson(row?.executive, name)) return;
    const key = String(row.id || row.sdNo || "");
    if (!key) return;
    const existing = deliveries.get(key);
    const incomingAccepted = String(row.status || "").toLowerCase() === "accepted";
    const existingAccepted =
      String(existing?.status || "").toLowerCase() === "accepted";
    if (existingAccepted && !incomingAccepted) return;
    deliveries.set(key, row);
  });
  deliveries.forEach((row) => {
    if (String(row.status || "pending").toLowerCase() === "accepted") return;
    items.push(
      note({
        id: `fro-delivery:${storeId}:${row.id || row.sdNo}`,
        title: "Stock Delivery Pending",
        description: `${row.sdNo || "Delivery"} · Pending acceptance from FRO.`,
        status: "Pending",
        tone: "pending",
        icon: "local_shipping",
        at: timeValue(row.date, row.createdAt),
        sourceDate: row.date,
        page: "stock-management",
      }),
    );
  });

  readArray(`nature-biotic-fro-cash-received-v1:${storeId}`)
    .filter((row) => samePerson(row?.requestedFor, name))
    .forEach((row) => {
      if (String(row.status || "pending").toLowerCase() === "accepted") return;
      items.push(
        note({
          id: `fro-cash:${storeId}:${row.id}`,
          title: "Cash receipt pending",
          description: `${storeName} · ${formatCurrency(Number(row.amount || 0))} · Pending acceptance from FRO.`,
          status: "Pending",
          tone: "pending",
          icon: "savings",
          at: timeValue(row.date, row.acceptedAt),
          sourceDate: row.date,
          page: "expenses",
        }),
      );
    });

  readArray(`nature-biotic-fro-handovers-v1:${storeId}`)
    .filter((row) => samePerson(row?.handedOverBy, name) && row?.id)
    .forEach((row) => {
      const statusName = String(row.status || "pending").toLowerCase();
      if (statusName !== "pending" && statusName !== "accepted") return;
      const accepted = statusName === "accepted";
      items.push(
        note({
          id: `fro-handover-${accepted ? "accepted" : "pending"}:${storeId}:${row.id}`,
          title: accepted ? "Cash Handover Accepted" : "Cash Handover Pending",
          description: accepted
            ? `${storeName} accepted ${formatCurrency(Number(row.amount || 0))}.`
            : `${formatCurrency(Number(row.amount || 0))} waiting for store acceptance.`,
          status: accepted ? "Accepted" : "Pending",
          tone: accepted ? "accepted" : "pending",
          icon: "payments",
          at: timeValue(row.date, Date.parse(row.acceptedAt || "") || undefined),
          sourceDate: row.date,
          page: "payments",
        }),
      );
    });

  readScoped("nature-biotic-fro-stock-return-requests-v1", storeId)
    .filter((row) => samePerson(row?.froName, name) && row?.id)
    .forEach((row) => {
      const statusName = String(row.status || "pending").toLowerCase();
      if (statusName !== "pending" && statusName !== "accepted") return;
      const accepted = statusName === "accepted";
      items.push(
        note({
          id: `fro-return-${accepted ? "accepted" : "pending"}:${storeId}:${row.id}`,
          title: accepted ? "Stock Return Accepted" : "Stock Return Pending",
          description: accepted
            ? `${row.rcNo || row.id} accepted by ${storeName}.`
            : `${row.rcNo || row.id} waiting for store acceptance.`,
          status: accepted ? "Accepted" : "Pending",
          tone: accepted ? "accepted" : "pending",
          icon: "assignment_return",
          at: timeValue(row.date, Date.parse(row.acceptedAt || "") || undefined),
          sourceDate: row.date,
          page: "stock-management",
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
