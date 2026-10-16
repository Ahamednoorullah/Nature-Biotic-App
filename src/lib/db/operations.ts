import { db, requireUserId, throwIfError } from "@/lib/db/client";
import { type RpcLine } from "@/lib/db/rpc";

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function day(v: unknown): string {
  return String(v || "").slice(0, 10);
}

async function staffNames(ids: unknown[]) {
  const unique = [...new Set(ids.map((id) => String(id || "")).filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data, error } = await db().from("staff").select("id, name").in("id", unique);
  throwIfError(error, "Could not load staff names.");
  for (const row of data || []) names.set(String(row.id), String(row.name || ""));
  return names;
}

// ---------------------------------------------------------------------------
// Stock Deliveries (Store to FRO)
// ---------------------------------------------------------------------------
export type DbDeliveryChallan = {
  id: string;
  sdNo: string;
  storeId: string;
  date: string;
  executive: string;
  executiveId?: string;
  status: "pending" | "accepted";
  acceptedAt?: string;
  acceptedBy?: string;
  notes?: string;
  items: {
    productId: string;
    product: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    qty: string;
    unitValue: string;
  }[];
};

export async function loadStockDeliveries(storeId: string): Promise<DbDeliveryChallan[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("stock_deliveries")
    .select(`
      id, store_id, fro_staff_id, sd_no, delivery_date, remarks,
      status, accepted_at,
      stock_delivery_items (
        id, variant_id, batch_id, product_name, pack_size, batch_no,
        expiry_date, qty, unit_value
      )
    `)
    .eq("store_id", storeId)
    .order("delivery_date", { ascending: false });

  throwIfError(error, "Could not load stock deliveries.");
  const rows = (data || []) as any[];
  const names = await staffNames(rows.map((row) => row.fro_staff_id));

  return rows.map((row) => ({
    id: String(row.id),
    sdNo: String(row.sd_no || ""),
    storeId: String(row.store_id || ""),
    date: day(row.delivery_date),
    executive: names.get(String(row.fro_staff_id || "")) || "Executive",
    executiveId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
    status: row.status === "accepted" ? "accepted" : "pending",
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    notes: String(row.remarks || ""),
    items: (row.stock_delivery_items || []).map((item: any) => ({
      productId: String(item.variant_id || ""),
      product: String(item.product_name || ""),
      packSize: String(item.pack_size || ""),
      batchNo: String(item.batch_no || ""),
      expiryDate: day(item.expiry_date),
      qty: String(item.qty || 0),
      unitValue: String(item.unit_value || 0),
    })),
  }));
}

export async function createStockDeliveryDb(
  header: {
    store_id: string;
    fro_staff_id: string;
    delivery_date?: string;
    notes?: string | null;
    remarks?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_stock_delivery", {
    p_header: {
      ...header,
      remarks: header.remarks ?? header.notes ?? null,
    },
    p_lines: lines,
  });
  throwIfError(error, "Could not save delivery challan.");
  return data as { id: string; sd_no: string };
}

export async function acceptStockDeliveryDb(deliveryId: string) {
  await requireUserId();
  const { error } = await db().rpc("accept_stock_delivery", {
    p_delivery_id: deliveryId,
  });
  throwIfError(error, "Could not accept stock delivery.");
}

// ---------------------------------------------------------------------------
// Stock Returns (FRO to Store)
// ---------------------------------------------------------------------------
export type DbReturnChallan = {
  id: string;
  srNo: string;
  storeId: string;
  date: string;
  executive: string;
  executiveId?: string;
  status: "pending" | "accepted" | "rejected";
  acceptedAt?: string;
  rejectedAt?: string;
  reason?: string;
  items: {
    productId: string;
    product: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    qty: string;
    unitValue: string;
    reason: string;
  }[];
};

export async function loadStockReturns(storeId: string): Promise<DbReturnChallan[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("stock_returns")
    .select(`
      id, store_id, fro_staff_id, return_no, return_date, reason, rejected_at,
      status, accepted_at,
      stock_return_items (
        id, variant_id, batch_id, product_name, pack_size, batch_no,
        expiry_date, qty, unit_value, reason
      )
    `)
    .eq("store_id", storeId)
    .order("return_date", { ascending: false });

  throwIfError(error, "Could not load stock returns.");
  const rows = (data || []) as any[];
  const names = await staffNames(rows.map((row) => row.fro_staff_id));

  return rows.map((row) => ({
    id: String(row.id),
    srNo: String(row.return_no || ""),
    storeId: String(row.store_id || ""),
    date: day(row.return_date),
    executive: names.get(String(row.fro_staff_id || "")) || "Executive",
    executiveId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
    status:
      row.status === "accepted"
        ? "accepted"
        : row.status === "rejected"
          ? "rejected"
          : "pending",
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    rejectedAt: row.rejected_at ? String(row.rejected_at) : undefined,
    reason: String(row.reason || ""),
    items: (row.stock_return_items || []).map((item: any) => ({
      productId: String(item.variant_id || ""),
      product: String(item.product_name || ""),
      packSize: String(item.pack_size || ""),
      batchNo: String(item.batch_no || ""),
      expiryDate: day(item.expiry_date),
      qty: String(item.qty || 0),
      unitValue: String(item.unit_value || 0),
      reason: String(item.reason || ""),
    })),
  }));
}

export async function submitStockReturnDb(
  header: {
    store_id?: string;
    return_date?: string;
    reason?: string | null;
    stock_delivery_id?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("submit_stock_return", {
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not submit return challan.");
  return data as { id: string; return_no: string; status?: string };
}

export async function acceptStockReturnDb(returnId: string) {
  await requireUserId();
  const { error } = await db().rpc("accept_stock_return", {
    p_return_id: returnId,
  });
  throwIfError(error, "Could not accept stock return.");
}

export async function rejectStockReturnDb(returnId: string) {
  await requireUserId();
  const { error } = await db().rpc("reject_stock_return", {
    p_return_id: returnId,
  });
  throwIfError(error, "Could not reject stock return.");
}

export async function createManualStockReturnDb(
  header: {
    store_id: string;
    fro_staff_id: string;
    return_date?: string;
    reason?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_manual_stock_return", {
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not create stock return.");
  return data as { id: string; return_no: string };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export type DbExpense = {
  id: string;
  expenseNo: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  method: string;
  enteredBy: string;
  scope: string;
  storeId?: string;
  froStaffId?: string;
  status: string;
};

export async function loadExpenseCategories(scope?: string) {
  await requireUserId();
  let query = db()
    .from("expense_categories")
    .select("id, scope, name")
    .order("name");
  if (scope) query = query.eq("scope", scope);
  const { data, error } = await query;
  throwIfError(error, "Could not load expense categories.");
  return (data || []) as { id: string; scope: string; name: string }[];
}

export async function loadExpenses(scope?: string, storeId?: string): Promise<DbExpense[]> {
  await requireUserId();
  let query = db()
    .from("expenses")
    .select(`
      id, scope, store_id, fro_staff_id, category_id, expense_no, expense_date,
      description, amount, method, entered_by_name, status
    `)
    .order("expense_date", { ascending: false });

  if (scope) query = query.eq("scope", scope);
  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  throwIfError(error, "Could not load expenses.");
  const rows = (data || []) as any[];
  // Load all category scopes so mixed store+FRO lists resolve names correctly.
  const categories = await loadExpenseCategories(undefined);
  const categoryNames = new Map(
    categories.map((category) => [`${category.id}:${category.scope}`, category.name]),
  );

  return rows
    .filter((row) => String(row.status || "accepted").toLowerCase() !== "cancelled")
    .map((row) => ({
      id: String(row.id),
      expenseNo: String(row.expense_no || ""),
      date: day(row.expense_date),
      category: categoryNames.get(`${row.category_id}:${row.scope}`) || "Miscellaneous",
      description: String(row.description || ""),
      amount: num(row.amount),
      method: String(row.method || "cash").toUpperCase(),
      enteredBy: String(row.entered_by_name || "Staff"),
      scope: String(row.scope || "store"),
      storeId: row.store_id ? String(row.store_id) : undefined,
      froStaffId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
      status: String(row.status || "accepted"),
    }));
}

export async function createExpenseDb(args: {
  p_scope: "company" | "store" | "fro";
  p_category_id: string;
  p_amount: number;
  p_method: "cash" | "upi" | "bank_transfer" | "cheque";
  p_expense_date?: string | null;
  p_description?: string | null;
  p_entered_by_name?: string | null;
  p_store_id?: string | null;
  p_receipt_path?: string | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_expense", args);
  throwIfError(error, "Could not create expense.");
  return data as { id: string; expense_no: string };
}

// ---------------------------------------------------------------------------
// Staff Attendance
// ---------------------------------------------------------------------------
export type DbAttendanceRecord = {
  id: string;
  staffId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: string;
  note: string;
};

export async function loadAttendance(storeId: string, date?: string): Promise<DbAttendanceRecord[]> {
  await requireUserId();
  let query = db()
    .from("staff_attendance")
    .select("id, store_id, staff_id, attendance_date, check_in_at, check_out_at, status, note")
    .eq("store_id", storeId);

  if (date) query = query.eq("attendance_date", date);

  const { data, error } = await query;
  throwIfError(error, "Could not load attendance.");

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    const parsed = new Date(ts);
    if (Number.isNaN(parsed.getTime())) return "";
    return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  };

  const statusLabel = (value: string) => {
    switch (value) {
      case "present":
        return "Present";
      case "leave":
        return "Leave";
      case "half_day":
        return "Half Day";
      case "checked_in":
        return "Checked In";
      case "checked_out":
        return "Checked Out";
      default:
        return "Absent";
    }
  };

  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    staffId: String(row.staff_id),
    date: day(row.attendance_date),
    checkIn: formatTime(row.check_in_at),
    checkOut: formatTime(row.check_out_at),
    checkInAt: row.check_in_at || undefined,
    checkOutAt: row.check_out_at || undefined,
    status: statusLabel(String(row.status || "")),
    note: String(row.note || ""),
  }));
}

export async function checkInDb(
  staffId?: string,
  status: string = "checked_in",
  note?: string,
  attendanceDate?: string,
) {
  await requireUserId();
  const { data, error } = await db().rpc("check_in", {
    p_staff_id: staffId ?? null,
    p_status: status.toLowerCase().replace(/\s+/g, "_"),
    p_note: note ?? null,
    p_attendance_date: attendanceDate ?? null,
  });
  throwIfError(error, "Could not check in.");
  return data as string;
}

export async function checkOutDb(staffId?: string, note?: string) {
  await requireUserId();
  const { data, error } = await db().rpc("check_out", {
    p_staff_id: staffId ?? null,
    p_note: note ?? null,
  });
  throwIfError(error, "Could not check out.");
  return data as string;
}

// ---------------------------------------------------------------------------
// FRO Visits
// ---------------------------------------------------------------------------
export type DbVisit = {
  id: string;
  storeId: string;
  froStaffId: string;
  visitDate: string;
  farmerId?: string;
  farmerName: string;
  village: string;
  phone: string;
  purpose?: string;
  notes?: string;
};

export async function loadVisits(storeId: string): Promise<DbVisit[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("fro_visits")
    .select("id, store_id, fro_staff_id, visit_date, farmer_id, farmer_name, village, phone")
    .eq("store_id", storeId)
    .order("visit_date", { ascending: false });

  throwIfError(error, "Could not load visits.");

  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    froStaffId: String(row.fro_staff_id),
    visitDate: day(row.visit_date),
    farmerId: row.farmer_id ? String(row.farmer_id) : undefined,
    farmerName: String(row.farmer_name || ""),
    village: String(row.village || ""),
    phone: String(row.phone || ""),
  }));
}

export async function recordVisitDb(args: {
  p_farmer_name: string;
  p_farmer_id?: string | null;
  p_village?: string | null;
  p_phone?: string | null;
  p_visit_date?: string | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("record_visit", args);
  throwIfError(error, "Could not record visit.");
  return data as string;
}

// ---------------------------------------------------------------------------
// Cash Handovers (FRO to Store)
// ---------------------------------------------------------------------------
export type DbHandover = {
  id: string;
  storeId: string;
  froStaffId: string;
  date: string;
  amount: number;
  method: string;
  handedOverBy: string;
  remarks?: string;
  status: "pending" | "accepted" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
};

export async function loadCashHandovers(storeId: string): Promise<DbHandover[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("cash_handovers")
    .select(`
      id, store_id, fro_staff_id, handover_date, amount, method, remarks,
      status, decided_at, decided_by
    `)
    .eq("store_id", storeId)
    .order("handover_date", { ascending: false });

  throwIfError(error, "Could not load cash handovers.");
  const rows = (data || []) as any[];
  const names = await staffNames(rows.map((row) => row.fro_staff_id));

  return rows.map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    froStaffId: String(row.fro_staff_id),
    date: day(row.handover_date),
    amount: num(row.amount),
    method: String(row.method || "cash").toUpperCase(),
    handedOverBy: names.get(String(row.fro_staff_id || "")) || "Executive",
    remarks: String(row.remarks || ""),
    status: row.status as "pending" | "accepted" | "rejected",
    decidedAt: row.decided_at || undefined,
  }));
}

export async function createCashHandoverDb(
  amount: number,
  method: "cash" | "upi" | "bank_transfer" | "cheque" = "cash",
  handoverDate?: string,
  remarks?: string,
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_cash_handover", {
    p_amount: amount,
    p_method: method,
    p_handover_date: handoverDate ?? null,
    p_remarks: remarks ?? null,
  });
  throwIfError(error, "Could not submit cash handover.");
  return data as string;
}

export async function decideCashHandoverDb(handoverId: string, decision: "accepted" | "rejected") {
  await requireUserId();
  const { error } = await db().rpc("decide_cash_handover", {
    p_handover_id: handoverId,
    p_decision: decision,
  });
  throwIfError(error, "Could not decide cash handover.");
}

// ---------------------------------------------------------------------------
// Store → FRO cash advances (Cash Received)
// ---------------------------------------------------------------------------
export type DbCashAdvance = {
  id: string;
  storeId: string;
  froStaffId: string;
  froName: string;
  date: string;
  amount: number;
  method: string;
  receivedFrom: string;
  remarks: string;
  status: "pending" | "accepted";
  acceptedAt?: string;
  settlementId?: string;
  referenceNo: string;
};

function advanceReference(id: string) {
  return `ADV-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function loadCashAdvances(storeId: string): Promise<DbCashAdvance[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("fro_cash_advances")
    .select(`
      id, store_id, fro_staff_id, advance_date, amount, method, received_from,
      remarks, status, accepted_at, settlement_id
    `)
    .eq("store_id", storeId)
    .order("advance_date", { ascending: false });
  throwIfError(error, "Could not load cash advances.");
  const rows = (data || []) as any[];
  const names = await staffNames(rows.map((row) => row.fro_staff_id));
  return rows.map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    froStaffId: String(row.fro_staff_id || ""),
    froName: names.get(String(row.fro_staff_id || "")) || "Executive",
    date: day(row.advance_date),
    amount: num(row.amount),
    method: String(row.method || "cash"),
    receivedFrom: String(row.received_from || "Store"),
    remarks: String(row.remarks || ""),
    status: row.status === "accepted" ? "accepted" : "pending",
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    settlementId: row.settlement_id ? String(row.settlement_id) : undefined,
    referenceNo: advanceReference(String(row.id)),
  }));
}

export async function createCashAdvanceDb(args: {
  froStaffId: string;
  amount: number;
  method?: "cash" | "upi" | "bank_transfer" | "cheque";
  advanceDate?: string;
  remarks?: string | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_cash_advance", {
    p_fro_staff_id: args.froStaffId,
    p_amount: args.amount,
    p_method: args.method ?? "cash",
    p_advance_date: args.advanceDate ?? null,
    p_remarks: args.remarks ?? null,
  });
  throwIfError(error, "Could not create cash request for FRO.");
  return String(data);
}

export async function acceptCashAdvanceDb(advanceId: string) {
  await requireUserId();
  const { error } = await db().rpc("accept_cash_advance", {
    p_advance_id: advanceId,
  });
  throwIfError(error, "Could not accept cash request.");
}

export type FroMoneyPosition = {
  /** Farmer collection cash only (collections − handovers − approved farmer My-Account refunds). */
  cashInHand: number;
  digitalInAccount: number;
  /** Cash farmer receipts credited to the FRO collection account. */
  cashReceipts: number;
  /** Accepted Store→FRO cash advances (method = cash). */
  advancesAccepted: number;
  /** Accepted cash handovers back to Store. */
  handoversAccepted: number;
  /** Accepted FRO cash expenses. */
  cashExpenses: number;
  /** Accepted expense-advance refunds to Store. */
  cashRefunds: number;
  /** Advances − accepted expenses − accepted expense-advance refunds. */
  expenseAdvanceBalance: number;
};

export async function loadFroMoneyPosition(staffId: string): Promise<FroMoneyPosition | null> {
  if (!staffId) return null;
  await requireUserId();
  const { data, error } = await db()
    .from("fro_cash_position")
    .select(`
      cash_in_hand, digital_in_account, expense_advance_balance,
      cash_receipts, advances_accepted, handovers_accepted, cash_expenses, cash_refunds
    `)
    .eq("fro_staff_id", staffId)
    .maybeSingle();
  throwIfError(error, "Could not load the FRO cash position.");
  if (!data) {
    return {
      cashInHand: 0,
      digitalInAccount: 0,
      cashReceipts: 0,
      advancesAccepted: 0,
      handoversAccepted: 0,
      cashExpenses: 0,
      cashRefunds: 0,
      expenseAdvanceBalance: 0,
    };
  }
  const advancesAccepted = num((data as { advances_accepted?: number }).advances_accepted);
  const cashExpenses = num((data as { cash_expenses?: number }).cash_expenses);
  const cashRefunds = num((data as { cash_refunds?: number }).cash_refunds);
  const expenseAdvanceBalance = Object.prototype.hasOwnProperty.call(
    data,
    "expense_advance_balance",
  )
    ? num((data as { expense_advance_balance?: number }).expense_advance_balance)
    : num(advancesAccepted - cashExpenses - cashRefunds);
  return {
    cashInHand: num(data.cash_in_hand),
    digitalInAccount: num(data.digital_in_account),
    cashReceipts: num((data as { cash_receipts?: number }).cash_receipts),
    advancesAccepted,
    handoversAccepted: num((data as { handovers_accepted?: number }).handovers_accepted),
    cashExpenses,
    cashRefunds,
    expenseAdvanceBalance,
  };
}

export type FroRefundFrom = "fro_cash" | "store_account";

export type DbFroCashRefund = {
  id: string;
  date: string;
  amount: number;
  method: string;
  refundedTo: string;
  remarks: string;
  settlementId?: string;
  status: "pending" | "accepted" | "rejected";
  refundNo?: string;
  froStaffId?: string;
  froName?: string;
  decidedAt?: string;
  refundFrom: FroRefundFrom;
};

export function froRefundFromLabel(value?: string) {
  return value === "store_account"
    ? "Store Account"
    : "My Account (FRO Cash in Hand)";
}

export function froExpenseRefundFromLabel(value?: string) {
  return value === "store_account"
    ? "Store Account"
    : "My Account (Expense Advance)";
}

export type FroActiveExpenseAdvanceSummary = {
  /** Accepted advances after the last fully settled (zero) point. */
  amountReceived: number;
  /** Accepted cash expenses in the active cycle. */
  totalExpenses: number;
  /** Accepted expense-advance refunds in the active cycle. */
  amountRefund: number;
  /** amountReceived − totalExpenses − amountRefund. */
  balance: number;
};

/**
 * Active expense-advance cycle for FRO Expenses summary cards.
 * Walks accepted advances (+), accepted cash expenses (−), and accepted
 * expense-advance refunds (−) in time order. After the balance last hits ₹0,
 * earlier settled activity is excluded from the current summary (history stays
 * in lists). Pending/rejected rows are ignored for balances.
 */
export function buildActiveExpenseAdvanceSummary(input: {
  advances: Array<{
    id: string;
    amount: number;
    status?: string;
    method?: string;
    acceptedAt?: string;
    date?: string;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    status?: string;
    method?: string;
    date?: string;
  }>;
  refunds: Array<{
    id: string;
    amount: number;
    status?: string;
    method?: string;
    date?: string;
    refundFrom?: string;
  }>;
}): FroActiveExpenseAdvanceSummary {
  type LedgerEvent = {
    id: string;
    kind: "advance" | "expense" | "refund";
    amount: number;
    at: string;
  };

  const events: LedgerEvent[] = [];
  // Asia/Kolkata calendar day (YYYY-MM-DD) so same-day advances sort before
  // expenses/refunds via kindRank — ISO timestamps must not beat date-only rows.
  const dayKey = (value?: string) => {
    const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  };

  for (const row of input.advances) {
    if (String(row.status || "").toLowerCase() !== "accepted") continue;
    const method = String(row.method || "cash").toLowerCase().replace(/\s+/g, "_");
    if (method !== "cash") continue;
    const at = dayKey(row.acceptedAt || row.date);
    if (!at) continue;
    events.push({ id: row.id, kind: "advance", amount: num(row.amount), at });
  }

  for (const row of input.expenses) {
    if (String(row.status || "accepted").toLowerCase() !== "accepted") continue;
    const method = String(row.method || "cash").toLowerCase().replace(/\s+/g, "_");
    if (method !== "cash") continue;
    const at = dayKey(row.date);
    if (!at) continue;
    events.push({ id: row.id, kind: "expense", amount: num(row.amount), at });
  }

  for (const row of input.refunds) {
    if (String(row.status || "accepted").toLowerCase() !== "accepted") continue;
    const method = String(row.method || "cash").toLowerCase().replace(/\s+/g, "_");
    if (method !== "cash") continue;
    if (String(row.refundFrom || "fro_cash").toLowerCase() === "store_account") {
      // Store-account refunds do not settle the expense-advance cash pool.
      continue;
    }
    const at = dayKey(row.date);
    if (!at) continue;
    events.push({ id: row.id, kind: "refund", amount: num(row.amount), at });
  }

  const kindRank = { advance: 0, expense: 1, refund: 2 } as const;
  events.sort((a, b) => {
    const atCmp = a.at.localeCompare(b.at);
    if (atCmp !== 0) return atCmp;
    const kindCmp = kindRank[a.kind] - kindRank[b.kind];
    if (kindCmp !== 0) return kindCmp;
    return a.id.localeCompare(b.id);
  });

  let running = 0;
  let lastZero = -1;
  events.forEach((event, index) => {
    running =
      event.kind === "advance"
        ? num(running + event.amount)
        : num(running - event.amount);
    if (Math.abs(running) <= 0.009) {
      running = 0;
      lastZero = index;
    }
  });

  const active = events.slice(lastZero + 1);
  let amountReceived = 0;
  let totalExpenses = 0;
  let amountRefund = 0;
  for (const event of active) {
    if (event.kind === "advance") amountReceived = num(amountReceived + event.amount);
    else if (event.kind === "expense") totalExpenses = num(totalExpenses + event.amount);
    else amountRefund = num(amountRefund + event.amount);
  }

  return {
    amountReceived,
    totalExpenses,
    amountRefund,
    balance: Math.max(num(amountReceived - totalExpenses - amountRefund), 0),
  };
}

function mapFroCashRefund(row: any, froName?: string): DbFroCashRefund {
  const statusRaw = String(row.status || "accepted").toLowerCase();
  const status =
    statusRaw === "pending" || statusRaw === "rejected" ? statusRaw : "accepted";
  const fromRaw = String(row.refund_from || "fro_cash").toLowerCase();
  const refundFrom: FroRefundFrom =
    fromRaw === "store_account" ? "store_account" : "fro_cash";
  return {
    id: String(row.id),
    date: row.refunded_at ? String(row.refunded_at).slice(0, 10) : day(row.refunded_at),
    amount: num(row.amount),
    method: String(row.method || "cash")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    refundedTo: "Store",
    remarks: String(row.remarks || ""),
    settlementId: row.settlement_id ? String(row.settlement_id) : undefined,
    status,
    refundNo: row.refund_no ? String(row.refund_no) : undefined,
    froStaffId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
    froName,
    decidedAt: row.decided_at ? String(row.decided_at) : undefined,
    refundFrom,
  };
}

const FRO_REFUND_SELECT =
  "id, fro_staff_id, refunded_at, amount, method, remarks, settlement_id, status, refund_no, decided_at, refund_from, refund_purpose";

export async function loadFroCashRefunds(staffId?: string): Promise<DbFroCashRefund[]> {
  await requireUserId();
  let query = db()
    .from("fro_cash_refunds")
    .select(FRO_REFUND_SELECT)
    .eq("refund_purpose", "expense_advance")
    .order("refunded_at", { ascending: false });
  // Filter by staff UUID from profiles.staff_id (same as auth_staff_id()), not auth.users id.
  if (staffId) query = query.eq("fro_staff_id", staffId);
  const { data, error } = await query;
  if (error) {
    console.error("[loadFroCashRefunds]", error);
  }
  throwIfError(error, "Could not load FRO expense-advance refunds.");
  return ((data || []) as any[]).map((row) => mapFroCashRefund(row));
}

export async function loadStoreFroCashRefunds(storeId: string): Promise<DbFroCashRefund[]> {
  if (!storeId) return [];
  await requireUserId();
  const { data, error } = await db()
    .from("fro_cash_refunds")
    .select(FRO_REFUND_SELECT)
    .eq("store_id", storeId)
    .eq("refund_purpose", "expense_advance")
    .order("refunded_at", { ascending: false });
  throwIfError(error, "Could not load store expense-advance refunds.");
  const rows = (data || []) as any[];
  const names = await staffNames(rows.map((row) => row.fro_staff_id));
  return rows.map((row) =>
    mapFroCashRefund(row, names.get(String(row.fro_staff_id || "")) || "Executive"),
  );
}

export async function createFroCashRefundDb(args: {
  amount: number;
  method?: "cash" | "upi" | "bank_transfer" | "cheque";
  remarks?: string | null;
  refundFrom: FroRefundFrom;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_fro_cash_refund", {
    p_amount: args.amount,
    p_method: args.method ?? "cash",
    p_remarks: args.remarks ?? null,
    p_refund_from: args.refundFrom,
  });
  throwIfError(error, "Could not record cash refund to Store.");
  return String(data);
}

export async function decideFroExpenseDb(
  expenseId: string,
  decision: "accepted" | "rejected",
) {
  await requireUserId();
  const { error } = await db().rpc("decide_fro_expense", {
    p_expense_id: expenseId,
    p_decision: decision,
  });
  throwIfError(error, `Could not ${decision === "accepted" ? "accept" : "reject"} FRO expense.`);
}

export async function decideFroCashRefundDb(
  refundId: string,
  decision: "accepted" | "rejected",
) {
  await requireUserId();
  const { error } = await db().rpc("decide_fro_cash_refund", {
    p_refund_id: refundId,
    p_decision: decision,
  });
  throwIfError(error, `Could not ${decision === "accepted" ? "accept" : "reject"} cash refund.`);
}

export type FroCashLineType =
  | "Expense Advance Balance"
  | "Farmer Collection"
  | "Store Advance Balance"
  | "Farmer Collection Balance";

export type FroCashLine = {
  id: string;
  date: string;
  ref: string;
  transactionType: FroCashLineType | string;
  /** Optional source detail — not a table column. */
  sourceDetail?: string;
  amount: number;
};

/**
 * Aggregate fallback for Dashboard Cash in Hand (farmer collections only).
 * Cash in Hand = cash collections − accepted cash handovers (− farmer My-Account refunds when present).
 */
export function buildFroCashBalanceLines(position: {
  cashInHand: number;
  cashReceipts: number;
  advancesAccepted: number;
  handoversAccepted: number;
  cashExpenses: number;
  cashRefunds: number;
}): FroCashLine[] {
  const farmerCollectionBalance = num(position.cashInHand);
  const lines: FroCashLine[] = [];

  if (Math.abs(farmerCollectionBalance) > 0.009) {
    lines.push({
      id: "balance:farmer-collection",
      date: "",
      ref: "—",
      transactionType: "Farmer Collection",
      amount: farmerCollectionBalance,
    });
  }

  return lines;
}

function applyFifoDeductions<T extends { amount: number }>(
  buckets: T[],
  deductions: number,
): Array<T & { remaining: number }> {
  let left = Math.max(0, num(deductions));
  return buckets.map((bucket) => {
    const take = Math.min(Math.max(0, num(bucket.amount)), left);
    left = num(left - take);
    return { ...bucket, remaining: num(bucket.amount - take) };
  });
}

/**
 * Detailed Cash in Hand lines: farmer collections only.
 * Remaining per receipt after FIFO allocation of accepted cash handovers and
 * accepted My-Account farmer sales refunds. Expense advances never appear here.
 */
export async function loadFroCashLines(staffId: string): Promise<FroCashLine[]> {
  if (!staffId) throw new Error("Could not load cash transactions for this FRO.");
  await requireUserId();

  const position = await loadFroMoneyPosition(staffId);
  if (!position) return [];

  const [receiptsResult, handoversResult, farmerRefundsResult] = await Promise.all([
    db()
      .from("store_receipts")
      .select(
        "id, receipt_no, receipt_date, amount, farmer_name, sales_invoice_id, created_at",
      )
      .eq("fro_staff_id", staffId)
      .eq("status", "final")
      .eq("method", "cash")
      .eq("collection_account", "fro")
      .order("receipt_date", { ascending: true }),
    db()
      .from("cash_handovers")
      .select("id, amount")
      .eq("fro_staff_id", staffId)
      .eq("status", "accepted")
      .eq("method", "cash"),
    db()
      .from("store_refunds")
      .select("id, cash_paid")
      .eq("fro_staff_id", staffId)
      .eq("status", "final")
      .eq("method", "cash")
      .eq("refund_from", "fro_cash"),
  ]);

  throwIfError(receiptsResult.error, "Could not load farmer collections.");
  throwIfError(handoversResult.error, "Could not load cash handovers.");
  throwIfError(farmerRefundsResult.error, "Could not load farmer sales refunds.");

  const invoiceIds = [
    ...new Set(
      ((receiptsResult.data || []) as any[])
        .map((row) => String(row.sales_invoice_id || ""))
        .filter(Boolean),
    ),
  ];
  const invoiceNos = new Map<string, string>();
  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoiceError } = await db()
      .from("sales_invoices")
      .select("id, invoice_no")
      .in("id", invoiceIds);
    throwIfError(invoiceError, "Could not load invoice numbers for collections.");
    for (const inv of invoices || []) {
      invoiceNos.set(String(inv.id), String(inv.invoice_no || ""));
    }
  }

  const receipts = ((receiptsResult.data || []) as any[])
    .slice()
    .sort((a, b) => {
      const ad = String(a.receipt_date || "");
      const bd = String(b.receipt_date || "");
      if (ad !== bd) return ad.localeCompare(bd);
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    })
    .map((row) => {
      const receiptNo = String(row.receipt_no || "").trim();
      const invoiceNo = invoiceNos.get(String(row.sales_invoice_id || "")) || "";
      const ref = [receiptNo, invoiceNo].filter(Boolean).join(" / ") || "—";
      return {
        id: String(row.id),
        date: day(row.receipt_date),
        amount: num(row.amount),
        farmerName: String(row.farmer_name || "").trim() || "Farmer",
        ref,
      };
    });

  const collectionDeduction = num(
    ((handoversResult.data || []) as any[]).reduce((s, row) => s + num(row.amount), 0) +
      ((farmerRefundsResult.data || []) as any[]).reduce(
        (s, row) => s + num(row.cash_paid),
        0,
      ),
  );

  const receiptRemainders = applyFifoDeductions(receipts, collectionDeduction);
  const lines: FroCashLine[] = [];

  for (const receipt of receiptRemainders) {
    if (Math.abs(receipt.remaining) <= 0.009) continue;
    lines.push({
      id: `receipt:${receipt.id}`,
      date: receipt.date,
      ref: receipt.ref,
      transactionType: `Farmer Collection — ${receipt.farmerName}`,
      sourceDetail: receipt.farmerName,
      amount: receipt.remaining,
    });
  }

  // Align detail rows with fro_cash_position.cash_in_hand (farmer collections only).
  const lineTotal = num(lines.reduce((s, row) => s + row.amount, 0));
  const target = num(position.cashInHand);
  const drift = num(target - lineTotal);
  if (Math.abs(drift) > 0.009) {
    if (lines.length > 0) {
      const last = lines[lines.length - 1];
      last.amount = num(last.amount + drift);
      if (Math.abs(last.amount) <= 0.009) lines.pop();
    } else if (Math.abs(target) > 0.009) {
      return buildFroCashBalanceLines(position);
    }
  }

  return lines;
}

export type DbDigitalSettlement = {
  id: string;
  storeId: string;
  froStaffId: string;
  date: string;
  amount: number;
  method: string;
  handedOverBy: string;
  remarks?: string;
  status: "pending" | "accepted" | "rejected";
  decidedAt?: string;
};

export async function loadDigitalSettlements(storeId: string): Promise<DbDigitalSettlement[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("fro_digital_settlements")
    .select("id, store_id, fro_staff_id, settlement_date, amount, method, remarks, status, decided_at")
    .eq("store_id", storeId)
    .order("settlement_date", { ascending: false });
  throwIfError(error, "Could not load digital settlements.");
  const rows = (data || []) as any[];
  const names = await staffNames(rows.map((row) => row.fro_staff_id));
  return rows.map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    froStaffId: String(row.fro_staff_id),
    date: day(row.settlement_date),
    amount: num(row.amount),
    method: paymentLabel(row.method),
    handedOverBy: names.get(String(row.fro_staff_id || "")) || "Executive",
    remarks: String(row.remarks || ""),
    status: row.status as "pending" | "accepted" | "rejected",
    decidedAt: row.decided_at || undefined,
  }));
}

export async function createDigitalSettlementDb(
  amount: number,
  method: "upi" | "bank_transfer",
  settlementDate?: string,
  remarks?: string,
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_digital_settlement", {
    p_amount: amount,
    p_method: method,
    p_settlement_date: settlementDate ?? null,
    p_remarks: remarks ?? null,
  });
  throwIfError(error, "Could not submit the digital settlement.");
  return data as string;
}

export async function decideDigitalSettlementDb(
  settlementId: string,
  decision: "accepted" | "rejected",
) {
  await requireUserId();
  const { error } = await db().rpc("decide_digital_settlement", {
    p_settlement_id: settlementId,
    p_decision: decision,
  });
  throwIfError(error, "Could not decide the digital settlement.");
}

// ---------------------------------------------------------------------------
// Physical Stock Counts
// ---------------------------------------------------------------------------
export type DbPhysicalCountLine = {
  variantId: string;
  batchId?: string;
  productName: string;
  packSize: string;
  batchNo?: string;
  expiryDate?: string;
  qty: number;
  unitPrice: number;
  systemQty: number;
  systemValue: number;
  /** True when system_qty was stored on the count line at save time. */
  hasCapturedSystem: boolean;
};

export type DbPhysicalCount = {
  id: string;
  storeId: string;
  date: string;
  totalQty: number;
  totalValue: number;
  systemQty: number;
  systemValue: number;
  isMatch: boolean;
  remarks?: string;
  lines: DbPhysicalCountLine[];
};

export type DbStoreBatchOption = {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
};

export async function loadStoreBatchesForVariant(
  storeId: string,
  variantId: string,
): Promise<DbStoreBatchOption[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_stock_balances")
    .select("batch_id, batch_no, expiry_date, quantity")
    .eq("store_id", storeId)
    .eq("variant_id", variantId)
    .gt("quantity", 0)
    .order("batch_no", { ascending: true });
  throwIfError(error, "Could not load store batches for this product.");
  return ((data || []) as any[]).map((row) => ({
    batchId: String(row.batch_id || ""),
    batchNo: String(row.batch_no || ""),
    expiryDate: day(row.expiry_date),
    quantity: Number(row.quantity || 0),
  })).filter((row) => row.batchId);
}

export async function loadPhysicalCounts(storeId: string): Promise<DbPhysicalCount[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("physical_stock_counts")
    .select(`
      id, store_id, count_date, total_qty, total_value, system_qty, system_value, is_match, remarks,
      physical_stock_count_lines (
        variant_id, batch_id, product_name, pack_size, batch_no, expiry_date,
        qty, unit_price, system_qty, system_value
      )
    `)
    .eq("store_id", storeId)
    .order("count_date", { ascending: false });
  throwIfError(error, "Could not load physical stock counts.");
  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    date: day(row.count_date),
    totalQty: Number(row.total_qty || 0),
    totalValue: Number(row.total_value || 0),
    systemQty: Number(row.system_qty || 0),
    systemValue: Number(row.system_value || 0),
    isMatch: Boolean(row.is_match),
    remarks: String(row.remarks || ""),
    lines: (row.physical_stock_count_lines || []).map((line: any) => {
      const qty = Number(line.qty || 0);
      const unitPrice = Number(line.unit_price || 0);
      const systemQty = Number(line.system_qty || 0);
      const capturedValue =
        line.system_value == null || line.system_value === ""
          ? null
          : Number(line.system_value);
      return {
        variantId: String(line.variant_id || ""),
        batchId: line.batch_id ? String(line.batch_id) : undefined,
        productName: String(line.product_name || ""),
        packSize: String(line.pack_size || ""),
        batchNo: line.batch_no ? String(line.batch_no) : undefined,
        expiryDate: line.expiry_date ? day(line.expiry_date) : undefined,
        qty,
        unitPrice,
        systemQty,
        systemValue:
          capturedValue != null && Number.isFinite(capturedValue)
            ? capturedValue
            : systemQty * unitPrice,
        hasCapturedSystem: line.system_qty != null && line.system_qty !== "",
      };
    }),
  }));
}

export async function recordPhysicalCountDb(
  storeId: string,
  countDate: string,
  lines: Array<{
    variant_id: string;
    batch_id?: string | null;
    qty: number;
    unit_price: number;
  }>,
  remarks?: string,
) {
  await requireUserId();
  const { data, error } = await db().rpc("record_physical_count", {
    p_store_id: storeId,
    p_lines: lines,
    p_count_date: countDate,
    p_remarks: remarks ?? null,
  });
  throwIfError(error, "Could not save physical stock count.");
  return data as {
    id: string;
    is_match: boolean;
    total_qty: number;
    total_value: number;
    system_qty: number;
    system_value: number;
  };
}

// ---------------------------------------------------------------------------
// Store month-end closing stock snapshots
// ---------------------------------------------------------------------------
export type DbClosingStockLine = {
  variantId: string;
  batchId?: string;
  productName: string;
  packSize: string;
  batchNo?: string;
  expiryDate?: string;
  qty: number;
  unitValue: number;
  lineValue: number;
};

export type DbClosingStock = {
  id: string;
  storeId: string;
  closingDate: string;
  yearMonth: string;
  totalQty: number;
  totalValue: number;
  source: string;
  status: string;
  finalizedAt?: string;
  lines: DbClosingStockLine[];
  kind: "snapshot" | "live";
};

export async function loadStoreClosingStocks(storeId: string): Promise<DbClosingStock[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_closing_stocks")
    .select(`
      id, store_id, closing_date, year_month, total_qty, total_value, source, status, finalized_at,
      store_closing_stock_lines (
        variant_id, batch_id, product_name, pack_size, batch_no, expiry_date,
        qty, unit_value, line_value, line_no
      )
    `)
    .eq("store_id", storeId)
    .order("closing_date", { ascending: false });
  throwIfError(error, "Could not load closing stock snapshots.");
  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    closingDate: day(row.closing_date),
    yearMonth: String(row.year_month || ""),
    totalQty: Number(row.total_qty || 0),
    totalValue: Number(row.total_value || 0),
    source: String(row.source || "stock_ledger"),
    status: String(row.status || "finalized"),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : undefined,
    kind: "snapshot" as const,
    lines: ((row.store_closing_stock_lines || []) as any[])
      .sort((a, b) => Number(a.line_no || 0) - Number(b.line_no || 0))
      .map((line) => ({
        variantId: String(line.variant_id || ""),
        batchId: line.batch_id ? String(line.batch_id) : undefined,
        productName: String(line.product_name || ""),
        packSize: String(line.pack_size || ""),
        batchNo: line.batch_no ? String(line.batch_no) : undefined,
        expiryDate: line.expiry_date ? day(line.expiry_date) : undefined,
        qty: Number(line.qty || 0),
        unitValue: Number(line.unit_value || 0),
        lineValue: Number(line.line_value || 0),
      })),
  }));
}

export async function loadLiveStoreStockBalances(storeId: string): Promise<DbClosingStockLine[]> {
  return loadStoreStockAsOf(storeId);
}

/** Store stock only (excludes FRO), reconstructed from the stock ledger as of p_as_of. */
export async function loadStoreStockAsOf(
  storeId: string,
  asOfDate?: string,
): Promise<DbClosingStockLine[]> {
  await requireUserId();
  const { data, error } = await db().rpc("list_store_stock_as_of", {
    p_store_id: storeId,
    p_as_of: asOfDate || null,
  });
  throwIfError(error, "Could not load store stock for the selected date.");
  return ((data || []) as any[])
    .map((row) => {
      const qty = Number(row.qty || 0);
      const unitValue = Number(row.unit_value || 0);
      return {
        variantId: String(row.variant_id || ""),
        batchId: row.batch_id ? String(row.batch_id) : undefined,
        productName: String(row.product_name || ""),
        packSize: String(row.pack_size || ""),
        batchNo: row.batch_no ? String(row.batch_no) : undefined,
        expiryDate: row.expiry_date ? day(row.expiry_date) : undefined,
        qty,
        unitValue,
        lineValue: Number(row.line_value ?? qty * unitValue),
      };
    })
    .filter((row) => row.qty > 0);
}

export async function finalizeStoreMonthClosingDb(
  storeId: string,
  year?: number,
  month?: number,
) {
  await requireUserId();
  const args: Record<string, unknown> = { p_store_id: storeId };
  if (year != null && month != null) {
    args.p_year = year;
    args.p_month = month;
  }
  const { data, error } = await db().rpc("finalize_store_month_closing", args);
  throwIfError(error, "Could not finalize month-end closing stock.");
  return data as {
    id: string;
    closing_date: string;
    year_month: string;
    total_qty: number;
    total_value: number;
    status: string;
    already_finalized: boolean;
  };
}

// ---------------------------------------------------------------------------
// Company Profile
// ---------------------------------------------------------------------------
export async function loadCompanyProfile() {
  await requireUserId();
  const { data, error } = await db()
    .from("company_profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  throwIfError(error, "Could not load company profile.");
  return data;
}

export async function updateCompanyProfileDb(payload: Record<string, unknown>) {
  await requireUserId();
  const { error } = await db()
    .from("company_profile")
    .update(payload)
    .eq("id", 1);
  throwIfError(error, "Could not update company profile.");
}

// ---------------------------------------------------------------------------
// Dashboard Views
// ---------------------------------------------------------------------------
export type DbCompanyDashboardMetrics = {
  activeStores: number;
  monthInvoiced: number;
  monthReceived: number;
  totalStoreOutstanding: number;
  storesOverLimit: number;
  pendingPurchaseOrders: number;
  pendingSalesReturns: number;
  creditNotesAwaitingAcceptance: number;
  refundableCreditOpen: number;
};

export type CompanyDashboardSnapshot = {
  stores: {
    id: string;
    name: string;
    outstandingLimit: number | null;
    outstandingLimitAction: "warn" | "block";
  }[];
  companyInvoices: {
    id: string;
    invoiceNo: string;
    date: string;
    storeId: string;
    total: number;
  }[];
  companyReceipts: {
    id: string;
    receiptNo: string;
    date: string;
    storeId: string;
    amount: number;
    invoiceNo: string;
  }[];
  companyRefunds: {
    id: string;
    refundNo: string;
    date: string;
    storeId: string;
    amount: number;
    appliedToOutstanding: number;
    cashPaid: number;
  }[];
  purchaseReturns: {
    id: string;
    returnNo: string;
    date: string;
    storeId: string;
    amount: number;
  }[];
  salesInvoices: {
    id: string;
    invoiceNo: string;
    date: string;
    storeId: string;
    farmerId: string;
    partyName: string;
    amount: number;
    status: string;
  }[];
  storeReceipts: {
    id: string;
    receiptNo: string;
    date: string;
    storeId: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    invoiceNo: string;
    status: string;
  }[];
  salesReturns: {
    id: string;
    returnNo: string;
    date: string;
    storeId: string;
    farmerId: string;
    partyName: string;
    amount: number;
    invoiceNo: string;
    status: string;
  }[];
  storeRefunds: {
    id: string;
    refundNo: string;
    date: string;
    storeId: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    appliedToOutstanding: number;
    cashPaid: number;
    referenceNo: string;
    invoiceNo: string;
    status: string;
  }[];
  activeFarmersByStore: { storeId: string; count: number }[];
};

export async function loadCompanyDashboardSnapshot(): Promise<CompanyDashboardSnapshot> {
  await requireUserId();
  const client = db();
  const [
    storeResult,
    companyInvoiceResult,
    companyReceiptResult,
    companyRefundResult,
    purchaseReturnResult,
    salesInvoiceResult,
    storeReceiptResult,
    salesReturnResult,
    storeRefundResult,
    farmerResult,
  ] = await Promise.all([
    client.from("stores").select("id, name, outstanding_limit, outstanding_limit_action, status"),
    client
      .from("company_invoices")
      .select("id, invoice_no, invoice_date, store_id, total_amount, status")
      .eq("status", "final"),
    client
      .from("company_receipts")
      .select("id, receipt_no, receipt_date, store_id, company_invoice_id, amount, status")
      .eq("status", "final"),
    client
      .from("company_refunds")
      .select("id, refund_no, refund_date, store_id, refund_amount, applied_to_outstanding, cash_paid, status")
      .eq("status", "final"),
    client
      .from("purchase_returns")
      .select("id, return_no, return_date, store_id, total_amount, status")
      .eq("status", "approved"),
    client
      .from("sales_invoices")
      .select("id, invoice_no, invoice_date, store_id, farmer_id, party_name, total_amount, status")
      .eq("status", "final"),
    client
      .from("store_receipts")
      .select("id, receipt_no, receipt_date, store_id, farmer_id, farmer_name, sales_invoice_id, amount, status")
      .eq("status", "final"),
    client
      .from("sales_returns")
      .select("id, return_no, return_date, store_id, farmer_id, party_name, sales_invoice_id, total_amount, status"),
    client
      .from("store_refunds")
      .select("id, refund_no, refund_date, store_id, farmer_id, farmer_name, sales_invoice_id, sales_return_id, reference_no, refund_amount, applied_to_outstanding, cash_paid, status")
      .eq("status", "final"),
    client.from("farmers").select("id, store_id, status").eq("status", "active"),
  ]);
  throwIfError(storeResult.error, "Could not load stores for the dashboard.");
  throwIfError(companyInvoiceResult.error, "Could not load company invoices.");
  throwIfError(companyReceiptResult.error, "Could not load company receipts.");
  throwIfError(companyRefundResult.error, "Could not load company refunds.");
  throwIfError(purchaseReturnResult.error, "Could not load purchase returns.");
  throwIfError(salesInvoiceResult.error, "Could not load store sales.");
  throwIfError(storeReceiptResult.error, "Could not load store receipts.");
  throwIfError(salesReturnResult.error, "Could not load sales returns.");
  throwIfError(storeRefundResult.error, "Could not load store refunds.");
  throwIfError(farmerResult.error, "Could not load farmers.");

  const invoiceNoById = new Map(
    ((salesInvoiceResult.data || []) as any[]).map((row) => [String(row.id), String(row.invoice_no || "")]),
  );
  const companyInvoiceNoById = new Map(
    ((companyInvoiceResult.data || []) as any[]).map((row) => [String(row.id), String(row.invoice_no || "")]),
  );
  const farmerCounts = new Map<string, number>();
  for (const row of (farmerResult.data || []) as any[]) {
    const storeId = String(row.store_id || "");
    if (!storeId) continue;
    farmerCounts.set(storeId, (farmerCounts.get(storeId) || 0) + 1);
  }

  return {
    stores: ((storeResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      name: String(row.name || "Store"),
      outstandingLimit: row.outstanding_limit === null || row.outstanding_limit === undefined
        ? null
        : num(row.outstanding_limit),
      outstandingLimitAction: row.outstanding_limit_action === "block" ? "block" : "warn",
    })),
    companyInvoices: ((companyInvoiceResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      invoiceNo: String(row.invoice_no || ""),
      date: day(row.invoice_date),
      storeId: String(row.store_id || ""),
      total: num(row.total_amount),
    })),
    companyReceipts: ((companyReceiptResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      receiptNo: String(row.receipt_no || ""),
      date: day(row.receipt_date),
      storeId: String(row.store_id || ""),
      amount: num(row.amount),
      invoiceNo: companyInvoiceNoById.get(String(row.company_invoice_id || "")) || "",
    })),
    companyRefunds: ((companyRefundResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      refundNo: String(row.refund_no || ""),
      date: day(row.refund_date),
      storeId: String(row.store_id || ""),
      amount: num(row.refund_amount),
      appliedToOutstanding: num(row.applied_to_outstanding),
      cashPaid: num(row.cash_paid),
    })),
    purchaseReturns: ((purchaseReturnResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      returnNo: String(row.return_no || ""),
      date: day(row.return_date),
      storeId: String(row.store_id || ""),
      amount: num(row.total_amount),
    })),
    salesInvoices: ((salesInvoiceResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      invoiceNo: String(row.invoice_no || ""),
      date: day(row.invoice_date),
      storeId: String(row.store_id || ""),
      farmerId: String(row.farmer_id || ""),
      partyName: String(row.party_name || ""),
      amount: num(row.total_amount),
      status: String(row.status || "final"),
    })),
    storeReceipts: ((storeReceiptResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      receiptNo: String(row.receipt_no || ""),
      date: day(row.receipt_date),
      storeId: String(row.store_id || ""),
      farmerId: String(row.farmer_id || ""),
      farmerName: String(row.farmer_name || ""),
      amount: num(row.amount),
      invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      status: String(row.status || "final"),
    })),
    salesReturns: ((salesReturnResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      returnNo: String(row.return_no || ""),
      date: day(row.return_date),
      storeId: String(row.store_id || ""),
      farmerId: String(row.farmer_id || ""),
      partyName: String(row.party_name || ""),
      amount: num(row.total_amount),
      invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      status: String(row.status || ""),
    })),
    storeRefunds: ((storeRefundResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      refundNo: String(row.refund_no || ""),
      date: day(row.refund_date),
      storeId: String(row.store_id || ""),
      farmerId: String(row.farmer_id || ""),
      farmerName: String(row.farmer_name || ""),
      amount: num(row.refund_amount),
      appliedToOutstanding: num(row.applied_to_outstanding),
      cashPaid: num(row.cash_paid),
      referenceNo: String(row.reference_no || ""),
      invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      status: String(row.status || "final"),
    })),
    activeFarmersByStore: Array.from(farmerCounts.entries()).map(([storeId, count]) => ({
      storeId,
      count,
    })),
  };
}

export async function loadCompanyDashboardMetrics(): Promise<DbCompanyDashboardMetrics | null> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_dashboard_metrics")
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return {
    activeStores: num(data.active_stores),
    monthInvoiced: num(data.month_invoiced),
    monthReceived: num(data.month_received),
    totalStoreOutstanding: num(data.total_store_outstanding),
    storesOverLimit: num(data.stores_over_limit),
    pendingPurchaseOrders: num(data.pending_purchase_orders),
    pendingSalesReturns: num(data.pending_sales_returns),
    creditNotesAwaitingAcceptance: num(data.credit_notes_awaiting_acceptance),
    refundableCreditOpen: num(data.refundable_credit_open),
  };
}

export type DbStoreDashboardMetrics = {
  storeId: string;
  todaySales: number;
  monthSales: number;
  monthReturns: number;
  monthCollections: number;
  activeFarmers: number;
  farmerOutstanding: number;
  payableToCompany: number;
  stockCostValue: number;
  pendingSalesReturns: number;
  pendingFroReturns: number;
  pendingHandovers: number;
  debitNotesToAccept: number;
  invoicesToReceive: number;
};

export type StoreDashboardLedger = {
  invoices: Array<{
    id: string;
    invoiceNo: string;
    date: string;
    channel: string;
    farmerId: string;
    partyName: string;
    phone: string;
    village: string;
    amount: number;
    staffId: string;
    status: string;
  }>;
  receipts: Array<{
    id: string;
    receiptNo: string;
    date: string;
    salesInvoiceId: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    method: string;
    staffId: string;
    status: string;
  }>;
  refunds: Array<{
    id: string;
    refundNo: string;
    date: string;
    salesInvoiceId: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    appliedToOutstanding: number;
    cashPaid: number;
    channel: string;
    staffId: string;
    status: string;
  }>;
  salesReturns: Array<{
    id: string;
    returnNo: string;
    date: string;
    salesInvoiceId: string;
    amount: number;
    channel: string;
    staffId: string;
    status: string;
  }>;
  outstanding: Array<{
    salesInvoiceId: string;
    invoiceNo: string;
    date: string;
    farmerId: string;
    partyName: string;
    phone: string;
    village: string;
    channel: string;
    staffId: string;
    outstanding: number;
  }>;
  officers: Array<{
    id: string;
    name: string;
    joinedDate: string;
    targetSales: number;
    targetFarmers: number;
    targetFarms: number;
    targetVisits: number;
  }>;
  visits: Array<{ staffId: string; date: string }>;
  farmers: Array<{
    id: string;
    createdAt: string;
    channel: string;
    joinedDate: string;
    staffId: string;
    farms: Array<{ id: string; createdAt: string }>;
    crops: Array<{ id: string; createdAt: string }>;
  }>;
  purchases: Array<{
    id: string;
    date: string;
    invoiceNo: string;
    product: string;
    packSize: string;
    quantity: number;
    rate: number;
    total: number;
  }>;
  activeFarmers: number;
  stockCostValue: number;
  cashByStaff?: Record<string, number>;
  cashLines?: Array<{
    id: string;
    staffId: string;
    date: string;
    ref: string;
    farmerName: string;
    village: string;
    phone: string;
    amount: number;
  }>;
};

function paymentLabel(method: unknown) {
  const value = String(method || "").toLowerCase();
  if (value === "cash") return "Cash";
  if (value === "upi") return "UPI";
  if (value === "cheque") return "Cheque";
  if (value === "bank_transfer") return "Bank Transfer";
  return value ? value.replace(/_/g, " ") : "-";
}

async function loadStoreCashLines(storeId: string) {
  const client = db();
  const [receiptResult, advanceResult, handoverResult, expenseResult, refundResult] = await Promise.all([
    client
      .from("store_receipts")
      .select("id, fro_staff_id, receipt_no, receipt_date, farmer_id, farmer_name, amount")
      .eq("store_id", storeId)
      .eq("method", "cash")
      .eq("status", "final")
      .eq("collection_account", "fro"),
    client
      .from("fro_cash_advances")
      .select("id, fro_staff_id, advance_date, amount, received_from")
      .eq("store_id", storeId)
      .eq("status", "accepted")
      .eq("method", "cash"),
    client
      .from("cash_handovers")
      .select("id, fro_staff_id, handover_date, amount")
      .eq("store_id", storeId)
      .eq("status", "accepted")
      .eq("method", "cash"),
    client
      .from("expenses")
      .select("id, fro_staff_id, expense_no, expense_date, amount, description")
      .eq("store_id", storeId)
      .eq("scope", "fro")
      .eq("method", "cash")
      .eq("status", "accepted"),
    client
      .from("fro_cash_refunds")
      .select("id, fro_staff_id, refunded_at, amount, refunded_to")
      .eq("store_id", storeId)
      .eq("method", "cash")
      .eq("status", "accepted")
      .eq("refund_from", "fro_cash"),
  ]);
  throwIfError(receiptResult.error, "Could not load cash receipts.");
  throwIfError(advanceResult.error, "Could not load cash advances.");
  throwIfError(handoverResult.error, "Could not load accepted cash handovers.");
  throwIfError(expenseResult.error, "Could not load cash expenses.");
  throwIfError(refundResult.error, "Could not load cash refunds.");

  const receiptRows = (receiptResult.data || []) as any[];
  const farmerIds = [...new Set(receiptRows.map((row) => String(row.farmer_id || "")).filter(Boolean))];
  const farmers = new Map<string, { village: string; phone: string }>();
  if (farmerIds.length > 0) {
    const { data, error } = await client.from("farmers").select("id, village, phone").in("id", farmerIds);
    throwIfError(error, "Could not load farmer details for cash receipts.");
    for (const row of (data || []) as any[]) {
      farmers.set(String(row.id), {
        village: String(row.village || ""),
        phone: String(row.phone || ""),
      });
    }
  }

  const lines: NonNullable<StoreDashboardLedger["cashLines"]> = [];
  const seen = new Set<string>();
  const add = (line: (typeof lines)[number]) => {
    if (!line.id || seen.has(line.id)) return;
    seen.add(line.id);
    lines.push(line);
  };
  receiptRows.forEach((row) => {
    const farmer = farmers.get(String(row.farmer_id || ""));
    add({
      id: `receipt:${row.id}`,
      staffId: String(row.fro_staff_id || ""),
      date: day(row.receipt_date),
      ref: String(row.receipt_no || ""),
      farmerName: String(row.farmer_name || "Farmer"),
      village: farmer?.village || "",
      phone: farmer?.phone || "",
      amount: num(row.amount),
    });
  });
  ((advanceResult.data || []) as any[]).forEach((row) => {
    add({
      id: `advance:${row.id}`,
      staffId: String(row.fro_staff_id || ""),
      date: day(row.advance_date),
      ref: String(row.id),
      farmerName: String(row.received_from || "Store"),
      village: "",
      phone: "",
      amount: num(row.amount),
    });
  });
  ((handoverResult.data || []) as any[]).forEach((row) => {
    add({
      id: `handover:${row.id}`,
      staffId: String(row.fro_staff_id || ""),
      date: day(row.handover_date),
      ref: String(row.id),
      farmerName: "Cash handover",
      village: "",
      phone: "",
      amount: -num(row.amount),
    });
  });
  ((expenseResult.data || []) as any[]).forEach((row) => {
    add({
      id: `expense:${row.id}`,
      staffId: String(row.fro_staff_id || ""),
      date: day(row.expense_date),
      ref: String(row.expense_no || ""),
      farmerName: String(row.description || "Cash expense"),
      village: "",
      phone: "",
      amount: -num(row.amount),
    });
  });
  ((refundResult.data || []) as any[]).forEach((row) => {
    add({
      id: `refund:${row.id}`,
      staffId: String(row.fro_staff_id || ""),
      date: day(row.refunded_at),
      ref: String(row.id),
      farmerName: String(row.refunded_to || "Cash refund"),
      village: "",
      phone: "",
      amount: -num(row.amount),
    });
  });
  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

export async function loadStoreDashboardLedger(storeId: string): Promise<StoreDashboardLedger> {
  await requireUserId();
  const client = db();
  const [
    invoiceResult,
    receiptResult,
    refundResult,
    salesReturnResult,
    outstandingResult,
    staffResult,
    visitResult,
    farmerResult,
    purchaseResult,
    stockResult,
    cashResult,
  ] = await Promise.all([
    client
      .from("sales_invoices")
      .select("id, invoice_no, invoice_date, channel, farmer_id, party_name, farmer_phone, farmer_village, total_amount, status, fro_staff_id")
      .eq("store_id", storeId)
      .eq("status", "final"),
    client
      .from("store_receipts")
      .select("id, receipt_no, receipt_date, sales_invoice_id, farmer_id, farmer_name, amount, method, fro_staff_id, status")
      .eq("store_id", storeId)
      .eq("status", "final"),
    client
      .from("store_refunds")
      .select("id, refund_no, refund_date, sales_invoice_id, farmer_id, farmer_name, refund_amount, applied_to_outstanding, cash_paid, channel, fro_staff_id, status")
      .eq("store_id", storeId)
      .eq("status", "final"),
    client
      .from("sales_returns")
      .select("id, return_no, return_date, sales_invoice_id, total_amount, channel, fro_staff_id, status")
      .eq("store_id", storeId)
      .eq("status", "approved"),
    client
      .from("sales_invoice_outstanding")
      .select("sales_invoice_id, invoice_no, invoice_date, farmer_id, party_name, channel, fro_staff_id, outstanding")
      .eq("store_id", storeId),
    client
      .from("staff")
      .select("id, name, designation, joined_date, target_sales, target_farmers, target_farms, target_visits, status")
      .eq("store_id", storeId)
      .eq("status", "active"),
    client
      .from("fro_visits")
      .select("fro_staff_id, visit_date")
      .eq("store_id", storeId),
    client
      .from("farmers")
      .select("id, status, channel, fro_staff_id, joined_date, created_at, farmer_farms(id, created_at), farmer_crops(id, created_at)")
      .eq("store_id", storeId)
      .eq("status", "active"),
    client
      .from("company_invoices")
      .select("id, invoice_no, invoice_date, status, receipt_status, company_invoice_items(id, product_name, pack_size, quantity, unit_price, line_total)")
      .eq("store_id", storeId)
      .eq("status", "final")
      .eq("receipt_status", "received"),
    client
      .from("store_stock_value")
      .select("cost_value")
      .eq("store_id", storeId)
      .maybeSingle(),
    client
      .from("fro_cash_position")
      .select("fro_staff_id, cash_in_hand")
      .eq("store_id", storeId),
  ]);

  throwIfError(invoiceResult.error, "Could not load sales invoices for the dashboard.");
  throwIfError(receiptResult.error, "Could not load receipts for the dashboard.");
  throwIfError(refundResult.error, "Could not load refunds for the dashboard.");
  throwIfError(salesReturnResult.error, "Could not load sales returns for the dashboard.");
  throwIfError(outstandingResult.error, "Could not load outstanding balances for the dashboard.");
  throwIfError(staffResult.error, "Could not load executives for the dashboard.");
  throwIfError(visitResult.error, "Could not load visits for the dashboard.");
  throwIfError(farmerResult.error, "Could not load farmers for the dashboard.");
  throwIfError(purchaseResult.error, "Could not load company purchases for the dashboard.");
  throwIfError(stockResult.error, "Could not load stock value for the dashboard.");
  throwIfError(cashResult.error, "Could not load FRO cash positions.");

  const invoices = ((invoiceResult.data || []) as any[]).map((row) => ({
    id: String(row.id),
    invoiceNo: String(row.invoice_no || ""),
    date: day(row.invoice_date),
    channel: String(row.channel || "direct"),
    farmerId: String(row.farmer_id || ""),
    partyName: String(row.party_name || ""),
    phone: String(row.farmer_phone || ""),
    village: String(row.farmer_village || ""),
    amount: num(row.total_amount),
    staffId: String(row.fro_staff_id || ""),
    status: String(row.status || "final"),
  }));
  const invoiceContact = new Map(invoices.map((row) => [row.id, row]));

  return {
    invoices,
    receipts: ((receiptResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      receiptNo: String(row.receipt_no || ""),
      date: day(row.receipt_date),
      salesInvoiceId: String(row.sales_invoice_id || ""),
      farmerId: String(row.farmer_id || ""),
      farmerName: String(row.farmer_name || ""),
      amount: num(row.amount),
      method: paymentLabel(row.method),
      staffId: String(row.fro_staff_id || ""),
      status: String(row.status || "final"),
    })),
    refunds: ((refundResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      refundNo: String(row.refund_no || ""),
      date: day(row.refund_date),
      salesInvoiceId: String(row.sales_invoice_id || ""),
      farmerId: String(row.farmer_id || ""),
      farmerName: String(row.farmer_name || ""),
      amount: num(row.refund_amount),
      appliedToOutstanding: num(row.applied_to_outstanding),
      cashPaid: num(row.cash_paid),
      channel: String(row.channel || "direct"),
      staffId: String(row.fro_staff_id || ""),
      status: String(row.status || "final"),
    })),
    salesReturns: ((salesReturnResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      returnNo: String(row.return_no || ""),
      date: day(row.return_date),
      salesInvoiceId: String(row.sales_invoice_id || ""),
      amount: num(row.total_amount),
      channel: String(row.channel || "direct"),
      staffId: String(row.fro_staff_id || ""),
      status: String(row.status || ""),
    })),
    outstanding: ((outstandingResult.data || []) as any[]).map((row) => {
      const invoice = invoiceContact.get(String(row.sales_invoice_id || ""));
      return {
        salesInvoiceId: String(row.sales_invoice_id || ""),
        invoiceNo: String(row.invoice_no || ""),
        date: day(row.invoice_date),
        farmerId: String(row.farmer_id || ""),
        partyName: String(row.party_name || ""),
        phone: invoice?.phone || "",
        village: invoice?.village || "",
        channel: String(row.channel || "direct"),
        staffId: String(row.fro_staff_id || ""),
        outstanding: num(row.outstanding),
      };
    }),
    officers: ((staffResult.data || []) as any[])
      .filter((row) => {
        const designation = String(row.designation || "").toLowerCase();
        return designation.includes("field") || designation.includes("fro") || designation.includes("sales executive");
      })
      .map((row) => ({
        id: String(row.id),
        name: String(row.name || ""),
        joinedDate: day(row.joined_date),
        targetSales: num(row.target_sales),
        targetFarmers: num(row.target_farmers),
        targetFarms: num(row.target_farms),
        targetVisits: num(row.target_visits),
      })),
    visits: ((visitResult.data || []) as any[]).map((row) => ({
      staffId: String(row.fro_staff_id || ""),
      date: day(row.visit_date),
    })),
    farmers: ((farmerResult.data || []) as any[]).map((row) => ({
      id: String(row.id || ""),
      createdAt: String(row.created_at || ""),
      channel: String(row.channel || ""),
      joinedDate: day(row.joined_date),
      staffId: String(row.fro_staff_id || ""),
      farms: ((row.farmer_farms || []) as any[]).map((farm) => ({
        id: String(farm.id || ""),
        createdAt: String(farm.created_at || ""),
      })),
      crops: ((row.farmer_crops || []) as any[]).map((crop) => ({
        id: String(crop.id || ""),
        createdAt: String(crop.created_at || ""),
      })),
    })),
    purchases: ((purchaseResult.data || []) as any[]).flatMap((row) =>
      ((row.company_invoice_items || []) as any[]).map((item) => ({
        id: String(item.id),
        date: day(row.invoice_date),
        invoiceNo: String(row.invoice_no || ""),
        product: String(item.product_name || ""),
        packSize: String(item.pack_size || ""),
        quantity: num(item.quantity),
        rate: num(item.unit_price),
        total: num(item.line_total),
      })),
    ),
    activeFarmers: ((farmerResult.data || []) as any[]).length,
    stockCostValue: num(stockResult.data?.cost_value),
    cashByStaff: Object.fromEntries(
      ((cashResult.data || []) as any[]).map((row) => [
        String(row.fro_staff_id || ""),
        num(row.cash_in_hand),
      ]),
    ),
    cashLines: await loadStoreCashLines(storeId),
  };
}

export async function loadFroSalesLedger(storeId: string): Promise<
  Pick<StoreDashboardLedger, "invoices" | "receipts" | "refunds" | "salesReturns" | "outstanding">
> {
  await requireUserId();
  const client = db();
  const [invoiceResult, receiptResult, refundResult, salesReturnResult, outstandingResult] =
    await Promise.all([
      client
        .from("sales_invoices")
        .select("id, invoice_no, invoice_date, channel, farmer_id, party_name, farmer_phone, farmer_village, total_amount, status, fro_staff_id")
        .eq("store_id", storeId)
        .eq("status", "final"),
      client
        .from("store_receipts")
        .select("id, receipt_no, receipt_date, sales_invoice_id, farmer_id, farmer_name, amount, method, fro_staff_id, status")
        .eq("store_id", storeId)
        .eq("status", "final"),
      client
        .from("store_refunds")
        .select("id, refund_no, refund_date, sales_invoice_id, farmer_id, farmer_name, refund_amount, applied_to_outstanding, cash_paid, channel, fro_staff_id, status")
        .eq("store_id", storeId)
        .eq("status", "final"),
      client
        .from("sales_returns")
        .select("id, return_no, return_date, sales_invoice_id, total_amount, channel, fro_staff_id, status")
        .eq("store_id", storeId)
        .eq("status", "approved"),
      client
        .from("sales_invoice_outstanding")
        .select("sales_invoice_id, invoice_no, invoice_date, farmer_id, party_name, channel, fro_staff_id, outstanding")
        .eq("store_id", storeId),
    ]);

  throwIfError(invoiceResult.error, "Could not load sales invoices.");
  throwIfError(receiptResult.error, "Could not load receipts.");
  throwIfError(refundResult.error, "Could not load refunds.");
  throwIfError(salesReturnResult.error, "Could not load sales returns.");
  throwIfError(outstandingResult.error, "Could not load outstanding balances.");

  const invoices = ((invoiceResult.data || []) as any[]).map((row) => ({
    id: String(row.id),
    invoiceNo: String(row.invoice_no || ""),
    date: day(row.invoice_date),
    channel: String(row.channel || "direct"),
    farmerId: String(row.farmer_id || ""),
    partyName: String(row.party_name || ""),
    phone: String(row.farmer_phone || ""),
    village: String(row.farmer_village || ""),
    amount: num(row.total_amount),
    staffId: String(row.fro_staff_id || ""),
    status: String(row.status || "final"),
  }));
  const invoiceContact = new Map(invoices.map((row) => [row.id, row]));

  return {
    invoices,
    receipts: ((receiptResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      receiptNo: String(row.receipt_no || ""),
      date: day(row.receipt_date),
      salesInvoiceId: String(row.sales_invoice_id || ""),
      farmerId: String(row.farmer_id || ""),
      farmerName: String(row.farmer_name || ""),
      amount: num(row.amount),
      method: paymentLabel(row.method),
      staffId: String(row.fro_staff_id || ""),
      status: String(row.status || "final"),
    })),
    refunds: ((refundResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      refundNo: String(row.refund_no || ""),
      date: day(row.refund_date),
      salesInvoiceId: String(row.sales_invoice_id || ""),
      farmerId: String(row.farmer_id || ""),
      farmerName: String(row.farmer_name || ""),
      amount: num(row.refund_amount),
      appliedToOutstanding: num(row.applied_to_outstanding),
      cashPaid: num(row.cash_paid),
      channel: String(row.channel || "direct"),
      staffId: String(row.fro_staff_id || ""),
      status: String(row.status || "final"),
    })),
    salesReturns: ((salesReturnResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      returnNo: String(row.return_no || ""),
      date: day(row.return_date),
      salesInvoiceId: String(row.sales_invoice_id || ""),
      amount: num(row.total_amount),
      channel: String(row.channel || "direct"),
      staffId: String(row.fro_staff_id || ""),
      status: String(row.status || ""),
    })),
    outstanding: ((outstandingResult.data || []) as any[]).map((row) => {
      const invoice = invoiceContact.get(String(row.sales_invoice_id || ""));
      return {
        salesInvoiceId: String(row.sales_invoice_id || ""),
        invoiceNo: String(row.invoice_no || ""),
        date: day(row.invoice_date),
        farmerId: String(row.farmer_id || ""),
        partyName: String(row.party_name || ""),
        phone: invoice?.phone || "",
        village: invoice?.village || "",
        channel: String(row.channel || "direct"),
        staffId: String(row.fro_staff_id || ""),
        outstanding: num(row.outstanding),
      };
    }),
  };
}

export async function loadStoreDashboardMetrics(storeId: string): Promise<DbStoreDashboardMetrics | null> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_dashboard_metrics")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    storeId: String(data.store_id),
    todaySales: num(data.today_sales),
    monthSales: num(data.month_sales),
    monthReturns: num(data.month_returns),
    monthCollections: num(data.month_collections),
    activeFarmers: num(data.active_farmers),
    farmerOutstanding: num(data.farmer_outstanding),
    payableToCompany: num(data.payable_to_company),
    stockCostValue: num(data.stock_cost_value),
    pendingSalesReturns: num(data.pending_sales_returns),
    pendingFroReturns: num(data.pending_fro_returns),
    pendingHandovers: num(data.pending_handovers),
    debitNotesToAccept: num(data.debit_notes_to_accept),
    invoicesToReceive: num(data.invoices_to_receive),
  };
}
