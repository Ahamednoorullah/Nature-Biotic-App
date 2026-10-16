import type { StoreNotification } from "@/lib/storeNotifications";
import { db, requireUserId, throwIfError } from "@/lib/db/client";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

function timeLabel(createdAt: string) {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(at).toLocaleDateString("en-IN");
}

export function staffAssignmentNotificationId(id: string) {
  return `staff-assignment:${id}`;
}

export async function loadStaffAssignmentNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, title, message, created_at")
    .eq("store_id", storeId)
    .eq("kind", "staff_assignment")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load staff assignment notifications.");
  return ((result.data || []) as NotificationRow[]).map((row) => {
    const at = Date.parse(row.created_at) || 0;
    const item: StoreNotification = {
      id: staffAssignmentNotificationId(row.id),
      title: row.title,
      description: row.message,
      status: "Staff Assignment",
      tone: "neutral",
      icon: "badge",
      at,
      timeLabel: timeLabel(row.created_at),
      page: "dashboard",
    };
    return item;
  });
}

export async function loadNotificationReadKeys() {
  const userId = await requireUserId();
  const result = await db()
    .from("notification_reads")
    .select("notification_key")
    .eq("profile_id", userId);
  throwIfError(result.error, "Could not load notification history.");
  return ((result.data || []) as { notification_key: string }[])
    .map((row) => row.notification_key)
    .filter(Boolean);
}

export async function loadDebitNoteNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, title, message, created_at")
    .eq("store_id", storeId)
    .eq("kind", "company_debit_note")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load debit note notifications.");
  return ((result.data || []) as NotificationRow[]).map((row) => {
    const at = Date.parse(row.created_at) || 0;
    const item: StoreNotification = {
      id: `debit-note:${row.id}`,
      title: row.title,
      description: row.message,
      status: "Debit Note",
      tone: "pending",
      icon: "request_quote",
      at,
      timeLabel: timeLabel(row.created_at),
      page: "debit-notes",
    };
    return item;
  });
}

export async function loadCashHandoverNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at")
    .eq("store_id", storeId)
    .in("kind", ["cash_handover_pending", "cash_handover_accepted"])
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load cash handover notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string }>).map((row) => {
    const at = Date.parse(row.created_at) || 0;
    const accepted = row.kind === "cash_handover_accepted";
    const item: StoreNotification = {
      id: `handover-notice:${row.id}`,
      title: row.title,
      description: row.message,
      status: accepted ? "Accepted" : "Pending",
      tone: accepted ? "accepted" : "pending",
      icon: "payments",
      at,
      timeLabel: timeLabel(row.created_at),
      page: "dashboard",
    };
    return item;
  });
}

export async function loadStoreStockReturnNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, stock_return_id")
    .eq("store_id", storeId)
    .eq("kind", "fro_stock_return_pending")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load stock return notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; stock_return_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const item: StoreNotification = {
        id: `stock-return-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: "Pending",
        tone: "pending",
        icon: "assignment_return",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "return-challan",
      };
      return item;
    },
  );
}

export async function loadFroCashAdvanceNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, cash_advance_id")
    .eq("store_id", storeId)
    .eq("kind", "fro_cash_advance_pending")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load cash request notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; cash_advance_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const item: StoreNotification = {
        id: `cash-advance-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: "Pending",
        tone: "pending",
        icon: "savings",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "expenses",
        targetId: row.cash_advance_id ? String(row.cash_advance_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadStoreCashAdvanceAcceptedNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, cash_advance_id")
    .eq("store_id", storeId)
    .eq("kind", "fro_cash_advance_accepted")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load cash acceptance notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; cash_advance_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const item: StoreNotification = {
        id: `cash-advance-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: "Accepted",
        tone: "accepted",
        icon: "savings",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "expenses",
        targetId: row.cash_advance_id ? String(row.cash_advance_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadFroStockReturnNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, stock_return_id")
    .eq("store_id", storeId)
    .in("kind", ["fro_stock_return_accepted", "fro_stock_return_rejected"])
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load stock return notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; stock_return_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const accepted = row.kind === "fro_stock_return_accepted";
      const item: StoreNotification = {
        id: `stock-return-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: accepted ? "Accepted" : "Rejected",
        tone: accepted ? "accepted" : "pending",
        icon: "assignment_return",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "stock-management",
      };
      return item;
    },
  );
}

export async function loadStoreFroExpensePendingNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, expense_id")
    .eq("store_id", storeId)
    .eq("kind", "fro_expense_pending")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load FRO expense notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; expense_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const item: StoreNotification = {
        id: `fro-expense-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: "Pending",
        tone: "pending",
        icon: "receipt_long",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "expenses",
        targetId: row.expense_id ? String(row.expense_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadStoreFroCashRefundPendingNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, cash_refund_id")
    .eq("store_id", storeId)
    .eq("kind", "fro_cash_refund_pending")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load FRO cash refund notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; cash_refund_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const item: StoreNotification = {
        id: `fro-refund-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: "Pending",
        tone: "pending",
        icon: "undo",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "expenses",
        targetId: row.cash_refund_id ? String(row.cash_refund_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadFroExpenseDecisionNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, expense_id")
    .eq("store_id", storeId)
    .in("kind", ["fro_expense_accepted", "fro_expense_rejected"])
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load expense decision notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; expense_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const accepted = row.kind === "fro_expense_accepted";
      const item: StoreNotification = {
        id: `fro-expense-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: accepted ? "Accepted" : "Rejected",
        tone: accepted ? "accepted" : "pending",
        icon: "receipt_long",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "expenses",
        targetId: row.expense_id ? String(row.expense_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadFroCashRefundDecisionNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, cash_refund_id")
    .eq("store_id", storeId)
    .in("kind", ["fro_cash_refund_accepted", "fro_cash_refund_rejected"])
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load cash refund decision notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; cash_refund_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const accepted = row.kind === "fro_cash_refund_accepted";
      const item: StoreNotification = {
        id: `fro-refund-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: accepted ? "Accepted" : "Rejected",
        tone: accepted ? "accepted" : "pending",
        icon: "undo",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "expenses",
        targetId: row.cash_refund_id ? String(row.cash_refund_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadStoreFroSalesRefundPendingNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, store_refund_id")
    .eq("store_id", storeId)
    .eq("kind", "fro_sales_refund_pending")
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load FRO farmer refund notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; store_refund_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const item: StoreNotification = {
        id: `fro-sales-refund-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: "Pending",
        tone: "pending",
        icon: "sync",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "refund",
        targetId: row.store_refund_id ? String(row.store_refund_id) : undefined,
      };
      return item;
    },
  );
}

export async function loadFroSalesRefundDecisionNotifications(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("notifications")
    .select("id, kind, title, message, created_at, store_refund_id")
    .eq("store_id", storeId)
    .in("kind", ["fro_sales_refund_accepted", "fro_sales_refund_rejected"])
    .order("created_at", { ascending: false });
  throwIfError(result.error, "Could not load farmer refund decision notifications.");
  return ((result.data || []) as Array<NotificationRow & { kind: string; store_refund_id?: string }>).map(
    (row) => {
      const at = Date.parse(row.created_at) || 0;
      const accepted = row.kind === "fro_sales_refund_accepted";
      const item: StoreNotification = {
        id: `fro-sales-refund-notice:${row.id}`,
        title: row.title,
        description: row.message,
        status: accepted ? "Accepted" : "Rejected",
        tone: accepted ? "accepted" : "pending",
        icon: "sync",
        at,
        timeLabel: timeLabel(row.created_at),
        page: "refund",
        targetId: row.store_refund_id ? String(row.store_refund_id) : undefined,
      };
      return item;
    },
  );
}

export async function markNotificationsRead(keys: string[]) {
  await requireUserId();
  const result = await db().rpc("mark_notifications_read", { p_keys: keys });
  throwIfError(result.error, "Could not mark the notification as read.");
}
