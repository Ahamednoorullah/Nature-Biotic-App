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

async function documentNumbers(
  table: "sales_invoices" | "company_invoices" | "company_credit_notes",
  column: "invoice_no" | "credit_note_no",
  ids: unknown[],
  label: string,
) {
  const unique = [...new Set(ids.map((id) => String(id || "")).filter(Boolean))];
  const numbers = new Map<string, string>();
  if (unique.length === 0) return numbers;
  const { data, error } = await db().from(table).select(`id, ${column}`).in("id", unique);
  throwIfError(error, label);
  for (const row of (data || []) as Array<Record<string, unknown>>) {
    numbers.set(String(row.id || ""), String(row[column] || ""));
  }
  return numbers;
}

// ---------------------------------------------------------------------------
// Store Receipts
// ---------------------------------------------------------------------------
export type DbStoreReceipt = {
  id: string;
  receiptNo: string;
  date: string;
  farmerId: string;
  farmerName: string;
  method: string;
  invoiceNo: string;
  invoiceAmount: number;
  amount: number;
  balanceAfter?: number;
  receivedBy?: string;
  remarks?: string;
  status: string;
  collectionAccount: "store" | "fro";
};

export async function loadStoreReceipts(storeId: string): Promise<DbStoreReceipt[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_receipts")
    .select(`
      id, store_id, fro_staff_id, sales_invoice_id, farmer_id, receipt_no,
      receipt_date, farmer_name, method, amount, invoice_amount, balance_after,
      received_by_name, remarks, status, collection_account
    `)
    .eq("store_id", storeId)
    .order("receipt_date", { ascending: false });

  throwIfError(error, "Could not load store receipts.");
  const rows = (data || []) as any[];
  const [names, invoices] = await Promise.all([
    staffNames(rows.map((row) => row.fro_staff_id)),
    documentNumbers(
      "sales_invoices",
      "invoice_no",
      rows.map((row) => row.sales_invoice_id),
      "Could not load invoices linked to store receipts.",
    ),
  ]);

  return rows.map((row) => ({
    id: String(row.id),
    receiptNo: String(row.receipt_no || ""),
    date: day(row.receipt_date),
    farmerId: String(row.farmer_id || ""),
    farmerName: String(row.farmer_name || ""),
    method: String(row.method || "cash").toUpperCase(),
    invoiceNo: invoices.get(String(row.sales_invoice_id || "")) || "",
    invoiceAmount: num(row.invoice_amount),
    amount: num(row.amount),
    balanceAfter: num(row.balance_after),
    receivedBy: String(row.received_by_name || names.get(String(row.fro_staff_id || "")) || ""),
    remarks: String(row.remarks || ""),
    status: String(row.status || "final"),
    collectionAccount: row.collection_account === "fro" ? "fro" : "store",
  }));
}

export async function loadSalesInvoiceBalances(storeId: string) {
  await requireUserId();
  const { data, error } = await db()
    .from("sales_invoice_outstanding")
    .select("sales_invoice_id, invoice_no, total_amount, outstanding")
    .eq("store_id", storeId);
  throwIfError(error, "Could not load sales invoice balances.");
  return ((data || []) as any[]).map((row) => ({
    salesInvoiceId: String(row.sales_invoice_id || ""),
    invoiceNo: String(row.invoice_no || ""),
    total: num(row.total_amount),
    outstanding: num(row.outstanding),
  }));
}

export async function createStoreReceiptDb(header: {
  sales_invoice_id: string;
  amount: number;
  method: "cash" | "upi" | "bank_transfer" | "cheque";
  receipt_date?: string;
  received_by_name?: string | null;
  remarks?: string | null;
  collection_account?: "store" | "fro";
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_store_receipt", {
    p_header: header,
  });
  throwIfError(error, "Could not save receipt.");
  return data as { id: string; receipt_no: string; balance_after?: number };
}

export async function cancelStoreReceiptDb(receiptId: string, reason: string) {
  await requireUserId();
  const { error } = await db().rpc("cancel_store_receipt", {
    p_receipt_id: receiptId,
    p_reason: reason,
  });
  throwIfError(error, "Could not cancel receipt.");
}

// ---------------------------------------------------------------------------
// Store Refunds
// ---------------------------------------------------------------------------
export type DbStoreRefund = {
  id: string;
  date: string;
  refundNo: string;
  referenceNo: string;
  sourceType: string;
  farmer: string;
  farmerPhone: string;
  amount: number;
  appliedToOutstanding: number;
  paidOutAmount: number;
  paymentMode: string;
  reason: string;
  remarks: string;
  status: string;
  channel?: "direct" | "executive";
  froStaffId?: string;
  refundFrom?: "fro_cash" | "store_account" | null;
  decidedAt?: string;
};

export async function loadStoreRefunds(storeId: string): Promise<DbStoreRefund[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_refunds")
    .select(`
      id, store_id, refund_no, refund_date, farmer_name, farmer_phone,
      sales_return_id, store_credit_note_id, reference_no, refund_amount,
      applied_to_outstanding, cash_paid, method, reason, remarks, status,
      channel, fro_staff_id, refund_from, decided_at
    `)
    .eq("store_id", storeId)
    .order("refund_date", { ascending: false });

  throwIfError(error, "Could not load store refunds.");

  return ((data || []) as any[]).map((row) => {
    const fromRaw = String(row.refund_from || "").toLowerCase();
    const refundFrom =
      fromRaw === "store_account"
        ? ("store_account" as const)
        : fromRaw === "fro_cash"
          ? ("fro_cash" as const)
          : null;
    return {
      id: String(row.id),
      date: day(row.refund_date),
      refundNo: String(row.refund_no || ""),
      referenceNo: String(row.reference_no || row.refund_no || ""),
      sourceType: row.sales_return_id
        ? "sales_return"
        : row.store_credit_note_id
          ? "credit_note"
          : "",
      farmer: String(row.farmer_name || ""),
      farmerPhone: String(row.farmer_phone || ""),
      amount: num(row.refund_amount),
      appliedToOutstanding: num(row.applied_to_outstanding),
      paidOutAmount: num(row.cash_paid),
      paymentMode: String(row.method || "cash").toUpperCase(),
      reason: String(row.reason || ""),
      remarks: String(row.remarks || ""),
      status: String(row.status || "final"),
      channel: row.channel === "executive" ? ("executive" as const) : ("direct" as const),
      froStaffId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
      refundFrom,
      decidedAt: row.decided_at ? String(row.decided_at) : undefined,
    };
  });
}

export async function loadSalesReturnRefundUsage(returnIds: string[]) {
  const usage = new Map<string, number>();
  const ids = [...new Set(returnIds.map((id) => String(id || "")).filter(Boolean))];
  if (ids.length === 0) return usage;
  await requireUserId();

  const { data: refunds, error: refundError } = await db()
    .from("store_refunds")
    .select("sales_return_id, refund_amount, status")
    .in("status", ["final", "pending"])
    .in("sales_return_id", ids);
  throwIfError(refundError, "Could not load refunds against sales returns.");
  for (const row of refunds || []) {
    const id = String(row.sales_return_id || "");
    usage.set(id, (usage.get(id) || 0) + num(row.refund_amount));
  }

  const { data: items, error: itemError } = await db()
    .from("sales_return_items")
    .select("id, return_id")
    .in("return_id", ids);
  throwIfError(itemError, "Could not load sales return lines.");
  const itemToReturn = new Map<string, string>();
  for (const item of items || []) {
    itemToReturn.set(String(item.id), String(item.return_id));
  }
  const itemIds = [...itemToReturn.keys()];
  if (itemIds.length === 0) return usage;

  const { data: lines, error: lineError } = await db()
    .from("store_credit_note_items")
    .select("sales_return_item_id, line_total, credit_note_id")
    .in("sales_return_item_id", itemIds);
  throwIfError(lineError, "Could not load credit notes against sales returns.");
  const noteIds = [
    ...new Set((lines || []).map((line) => String(line.credit_note_id || "")).filter(Boolean)),
  ];
  if (noteIds.length === 0) return usage;

  const { data: notes, error: noteError } = await db()
    .from("store_credit_notes")
    .select("id, status")
    .in("id", noteIds);
  throwIfError(noteError, "Could not load credit notes against sales returns.");
  const openNotes = new Set(
    (notes || [])
      .filter((note) => String(note.status || "") !== "cancelled")
      .map((note) => String(note.id)),
  );
  for (const line of lines || []) {
    if (!openNotes.has(String(line.credit_note_id || ""))) continue;
    const returnId = itemToReturn.get(String(line.sales_return_item_id || ""));
    if (!returnId) continue;
    usage.set(returnId, (usage.get(returnId) || 0) + num(line.line_total));
  }
  return usage;
}

export async function previewStoreRefundDb(sourceType: string, sourceId: string, amount?: number) {
  await requireUserId();
  const { data, error } = await db().rpc("preview_store_refund", {
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_amount: amount ?? null,
  });
  throwIfError(error, "Could not preview store refund.");
  const row = (data || {}) as Record<string, unknown>;
  return {
    eligible: row.eligible === true,
    partyName: String(row.party_name || ""),
    referenceNo: String(row.reference_no || ""),
    salesInvoiceId: String(row.sales_invoice_id || ""),
    sourceTotal: num(row.source_total),
    remainingRefundable: num(row.remaining_refundable),
    outstandingBefore: num(row.outstanding_before),
    refundAmount: num(row.refund_amount),
    appliedToOutstanding: num(row.applied_to_outstanding),
    cashPaid: num(row.cash_paid),
    outstandingAfter: num(row.outstanding_after),
    methodRequired: row.method_required === true,
    valid: row.valid === true,
  };
}

export async function createStoreRefundDb(args: {
  p_source_type: string;
  p_source_id: string;
  p_amount: number;
  p_method?: string | null;
  p_reason?: string | null;
  p_remarks?: string | null;
  p_refund_date?: string | null;
  p_refund_from?: "fro_cash" | "store_account" | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_store_refund", args);
  throwIfError(error, "Could not process store refund.");
  return data as { id: string; refund_no: string; status?: string };
}

export async function decideStoreFarmerRefundDb(
  refundId: string,
  decision: "accepted" | "rejected",
) {
  await requireUserId();
  const { error } = await db().rpc("decide_store_farmer_refund", {
    p_refund_id: refundId,
    p_decision: decision,
  });
  throwIfError(
    error,
    `Could not ${decision === "accepted" ? "accept" : "reject"} farmer refund.`,
  );
}

// ---------------------------------------------------------------------------
// Store Credit Notes
// ---------------------------------------------------------------------------
export type DbStoreCreditNote = {
  id: string;
  creditNoteNo: string;
  date: string;
  farmer: string;
  phone: string;
  village: string;
  through: "Direct" | "Executive";
  placeOfSupply: string;
  amount: number;
  sgst: number;
  cgst: number;
  igst: number;
  roundOff: number;
  total: number;
  status: string;
  items: {
    productId: string;
    productName: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    taxableAmount: number;
    taxPercent: number;
    sgst: number;
    cgst: number;
    igst: number;
    total: number;
    reason: string;
  }[];
};

export async function loadStoreCreditNotes(storeId: string): Promise<DbStoreCreditNote[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_credit_notes")
    .select(`
      id, store_id, credit_note_no, credit_note_date, party_name,
      farmer_phone, farmer_village, channel, store_location, place_of_return,
      taxable_amount, sgst_amount, cgst_amount, igst_amount, round_off, total_amount, status,
      store_credit_note_items (
        id, variant_id, batch_id, product_name, pack_size, hsn_code, batch_no,
        expiry_date, quantity, unit_price, discount_percent, discount_amount,
        taxable_amount, tax_percent, sgst_amount, cgst_amount, igst_amount,
        line_total, reason
      )
    `)
    .eq("store_id", storeId)
    .order("credit_note_date", { ascending: false });

  throwIfError(error, "Could not load store credit notes.");

  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    creditNoteNo: String(row.credit_note_no || ""),
    date: day(row.credit_note_date),
    farmer: String(row.party_name || ""),
    phone: String(row.farmer_phone || ""),
    village: String(row.farmer_village || ""),
    through: row.channel === "executive" ? "Executive" : "Direct",
    placeOfSupply: String(row.store_location || row.place_of_return || "Tamil Nadu"),
    amount: num(row.taxable_amount),
    sgst: num(row.sgst_amount),
    cgst: num(row.cgst_amount),
    igst: num(row.igst_amount),
    roundOff: num(row.round_off),
    total: num(row.total_amount),
    status: row.status === "issued" ? "Approved" : row.status === "cancelled" ? "Rejected" : "Draft",
    items: (row.store_credit_note_items || []).map((item: any) => ({
      productId: String(item.variant_id || ""),
      productName: String(item.product_name || ""),
      packSize: String(item.pack_size || ""),
      batchNo: String(item.batch_no || ""),
      expiryDate: day(item.expiry_date),
      quantity: num(item.quantity),
      unitPrice: num(item.unit_price),
      discountPercent: num(item.discount_percent),
      discountAmount: num(item.discount_amount),
      taxableAmount: num(item.taxable_amount),
      taxPercent: num(item.tax_percent),
      sgst: num(item.sgst_amount),
      cgst: num(item.cgst_amount),
      igst: num(item.igst_amount),
      total: num(item.line_total),
      reason: String(item.reason || ""),
    })),
  }));
}

export async function saveStoreCreditNoteDb(
  creditNoteId: string | null,
  header: {
    store_id: string;
    credit_note_date?: string;
    customer_name?: string | null;
    party_name?: string | null;
    farmer_id?: string | null;
    customer_phone?: string | null;
    customer_village?: string | null;
    sales_invoice_id?: string | null;
    reason?: string | null;
    notes?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("save_store_credit_note", {
    p_credit_note_id: creditNoteId,
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not save store credit note.");
  return data as { id: string; credit_note_no: string };
}

export async function issueStoreCreditNoteDb(creditNoteId: string) {
  await requireUserId();
  const { error } = await db().rpc("issue_store_credit_note", {
    p_credit_note_id: creditNoteId,
  });
  throwIfError(error, "Could not issue store credit note.");
}

// ---------------------------------------------------------------------------
// Store Debit Notes (Company Credit Notes viewed by Store)
// ---------------------------------------------------------------------------
export type DbStoreDebitNote = {
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
  total: number;
  amount: number;
  sellingPrice: number;
  status: "Pending" | "Approved" | "Rejected";
};


// ---------------------------------------------------------------------------
// Company Receipts
// ---------------------------------------------------------------------------
export type DbCompanyReceipt = {
  id: string;
  receiptNo: string;
  date: string;
  storeId: string;
  storeName: string;
  method: string;
  invoiceNo: string;
  invoiceAmount: number;
  amount: number;
  balanceAfter?: number;
  receivedBy?: string;
  remarks?: string;
};

export async function loadCompanyReceipts(): Promise<DbCompanyReceipt[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_receipts")
    .select(`
      id, store_id, company_invoice_id, receipt_no, receipt_date, method,
      amount, invoice_amount, balance_after, received_by_name, remarks, status,
      stores ( id, name )
    `)
    .order("receipt_date", { ascending: false });

  throwIfError(error, "Could not load company receipts.");
  const rows = (data || []) as any[];
  const invoices = await documentNumbers(
    "company_invoices",
    "invoice_no",
    rows.map((row) => row.company_invoice_id),
    "Could not load invoices linked to company receipts.",
  );

  return rows.map((row) => ({
    id: String(row.id),
    receiptNo: String(row.receipt_no || ""),
    date: day(row.receipt_date),
    storeId: String(row.store_id || ""),
    storeName: String(row.stores?.name || "Store"),
    method: String(row.method || "cash").toUpperCase(),
    invoiceNo: invoices.get(String(row.company_invoice_id || "")) || "-",
    invoiceAmount: num(row.invoice_amount),
    amount: num(row.amount),
    balanceAfter: num(row.balance_after),
    receivedBy: String(row.received_by_name || ""),
    remarks: String(row.remarks || ""),
  }));
}

export function paymentMethodLabel(method: unknown) {
  const value = String(method || "").trim().toLowerCase();
  if (value === "upi") return "UPI";
  if (value === "cheque") return "Cheque";
  if (value === "bank_transfer" || value === "bank transfer") return "Bank Transfer";
  return "Cash";
}

/** Final company receipts for one store. RLS also hides every other store. */
export async function loadStoreCompanyReceipts(storeId: string): Promise<DbCompanyReceipt[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_receipts")
    .select(`
      id, store_id, company_invoice_id, receipt_no, receipt_date, method,
      amount, invoice_amount, balance_after, received_by_name, remarks, status,
      stores ( id, name )
    `)
    .eq("store_id", storeId)
    .eq("status", "final")
    .order("receipt_date", { ascending: false });

  throwIfError(error, "Could not load this store's company receipts.");
  const rows = (data || []) as any[];
  const invoices = await documentNumbers(
    "company_invoices",
    "invoice_no",
    rows.map((row) => row.company_invoice_id),
    "Could not load invoices linked to company receipts.",
  );

  return rows.map((row) => ({
    id: String(row.id),
    receiptNo: String(row.receipt_no || ""),
    date: day(row.receipt_date),
    storeId: String(row.store_id || ""),
    storeName: String(row.stores?.name || "Store"),
    method: paymentMethodLabel(row.method),
    invoiceNo: invoices.get(String(row.company_invoice_id || "")) || "-",
    invoiceAmount: num(row.invoice_amount),
    amount: num(row.amount),
    balanceAfter: num(row.balance_after),
    receivedBy: String(row.received_by_name || ""),
    remarks: String(row.remarks || ""),
  }));
}

export type OpenCompanyInvoice = {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  storeId: string;
  total: number;
  outstanding: number;
};

/** Final company invoices that still have a balance. The view already excludes drafts. */
export async function loadOpenCompanyInvoices(): Promise<OpenCompanyInvoice[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_invoice_outstanding")
    .select("company_invoice_id, store_id, invoice_no, invoice_date, total_amount, outstanding")
    .order("invoice_date", { ascending: false });
  throwIfError(error, "Could not load company invoices for receipts.");
  return ((data || []) as any[])
    .map((row) => ({
      invoiceId: String(row.company_invoice_id || ""),
      invoiceNo: String(row.invoice_no || ""),
      date: day(row.invoice_date),
      storeId: String(row.store_id || ""),
      total: num(row.total_amount),
      outstanding: num(row.outstanding),
    }))
    .filter((row) => row.invoiceId && row.invoiceNo && row.outstanding > 0);
}

export async function createCompanyReceiptDb(header: {
  company_invoice_id: string;
  amount: number;
  method: "cash" | "upi" | "bank_transfer" | "cheque";
  receipt_date?: string;
  received_by_name?: string | null;
  remarks?: string | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_company_receipt", {
    p_header: header,
  });
  throwIfError(error, "Could not record company receipt.");
  return data as { id: string; receipt_no: string; balance_after: number };
}

// ---------------------------------------------------------------------------
// Company Refunds
// ---------------------------------------------------------------------------
export type DbCompanyRefund = {
  id: string;
  refundNo: string;
  date: string;
  storeId: string;
  storeName: string;
  purchaseReturnId: string;
  creditNoteId: string;
  creditNoteNo: string;
  amount: number;
  appliedToOutstanding: number;
  paidOutAmount: number;
  method: string;
  reason: string;
  remarks: string;
};

export async function loadCompanyRefunds(): Promise<DbCompanyRefund[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_refunds")
    .select(`
      id, store_id, purchase_return_id, company_credit_note_id, refund_no, refund_date,
      refund_amount, applied_to_outstanding, cash_paid,
      method, reason, remarks, status,
      stores ( id, name )
    `)
    .order("refund_date", { ascending: false });

  throwIfError(error, "Could not load company refunds.");
  const rows = (data || []) as any[];
  const notes = await documentNumbers(
    "company_credit_notes",
    "credit_note_no",
    rows.map((row) => row.company_credit_note_id),
    "Could not load credit notes linked to company refunds.",
  );

  return rows.map((row) => ({
    id: String(row.id),
    refundNo: String(row.refund_no || ""),
    date: day(row.refund_date),
    storeId: String(row.store_id || ""),
    storeName: String(row.stores?.name || "Store"),
    purchaseReturnId: String(row.purchase_return_id || ""),
    creditNoteId: String(row.company_credit_note_id || ""),
    creditNoteNo: notes.get(String(row.company_credit_note_id || "")) || "-",
    amount: num(row.refund_amount),
    appliedToOutstanding: num(row.applied_to_outstanding),
    paidOutAmount: num(row.cash_paid),
    method: String(row.method || "cash").toUpperCase(),
    reason: String(row.reason || ""),
    remarks: String(row.remarks || ""),
  }));
}

export async function previewCompanyRefundDb(creditNoteId: string, amount?: number) {
  await requireUserId();
  const { data, error } = await db().rpc("preview_company_refund", {
    p_credit_note_id: creditNoteId,
    p_amount: amount ?? null,
  });
  throwIfError(error, "Could not preview company refund.");
  return data as {
    credit_note_id: string;
    credit_note_no: string;
    credit_note_status: string;
    credit_total: number;
    refunded_total: number;
    remaining_refundable: number;
    outstanding_before: number;
    refund_amount: number;
    applied_to_outstanding: number;
    cash_paid: number;
    outstanding_after: number;
    method_required: boolean;
    valid: boolean;
  };
}

export async function createCompanyRefundDb(args: {
  p_credit_note_id: string;
  p_amount: number;
  p_method?: string | null;
  p_reason?: string | null;
  p_remarks?: string | null;
  p_refund_date?: string | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_company_refund", args);
  throwIfError(error, "Could not save company refund.");
  return data as { id: string; refund_no: string };
}

export type ReturnRefundSource = {
  purchaseReturnId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  returnNo: string;
  date: string;
  invoiceNo: string;
  returnAmount: number;
  reason: string;
  creditNoteId: string;
  creditNoteNo: string;
  creditStatus: string;
  refundedTotal: number;
  remaining: number;
  outstanding: number;
};

/** Approved purchase returns. Remaining value follows the return, not a credit note. */
export async function loadReturnRefundSources(): Promise<ReturnRefundSource[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_return_refund_sources")
    .select(`
      purchase_return_id, store_id, store_code, store_name, return_no, return_date,
      invoice_no, return_amount, reason, credit_note_id, credit_note_no, credit_note_status,
      refunded_total, remaining_refundable, outstanding
    `)
    .order("return_date", { ascending: false });
  throwIfError(error, "Could not load refundable purchase returns.");
  return ((data || []) as any[]).map((row) => ({
    purchaseReturnId: String(row.purchase_return_id || ""),
    storeId: String(row.store_id || ""),
    storeCode: String(row.store_code || ""),
    storeName: String(row.store_name || ""),
    returnNo: String(row.return_no || ""),
    date: day(row.return_date),
    invoiceNo: String(row.invoice_no || ""),
    returnAmount: num(row.return_amount),
    reason: String(row.reason || ""),
    creditNoteId: String(row.credit_note_id || ""),
    creditNoteNo: String(row.credit_note_no || ""),
    creditStatus: String(row.credit_note_status || ""),
    refundedTotal: num(row.refunded_total),
    remaining: num(row.remaining_refundable),
    outstanding: num(row.outstanding),
  }));
}

export async function createCompanyRefundForReturnDb(args: {
  p_return_id: string;
  p_credit_note_id?: string | null;
  p_amount: number;
  p_method?: string | null;
  p_reason?: string | null;
  p_remarks?: string | null;
  p_refund_date?: string | null;
}) {
  await requireUserId();
  const { data, error } = await db().rpc("create_company_refund_for_return", args);
  throwIfError(error, "Could not save company refund.");
  return data as { id: string; refund_no: string };
}

// ---------------------------------------------------------------------------
// Company Credit Notes
// ---------------------------------------------------------------------------
export type DbCompanyCreditNote = {
  id: string;
  creditNoteNo: string;
  date: string;
  storeId: string;
  storeName: string;
  party: string;
  storeLocation: string;
  placeofreturn: string;
  amount: number;
  sgst: number;
  cgst: number;
  igst: number;
  roundOff: number;
  total: number;
  status: "Draft" | "Approved" | "Pending" | "Rejected";
  reason?: string;
  items: {
    productId: string;
    productName: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    taxableAmount: number;
    taxPercent: number;
    sgst: number;
    cgst: number;
    igst: number;
    total: number;
    reason: string;
  }[];
};

export async function loadCompanyCreditNotes(): Promise<DbCompanyCreditNote[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_credit_notes")
    .select(`
      id, store_id, credit_note_no, credit_note_date, reason,
      taxable_amount, sgst_amount, cgst_amount, igst_amount, round_off, total_amount, status,
      stores ( id, name, location ),
      company_credit_note_items (
        id, variant_id, batch_id, product_name, pack_size, batch_no, expiry_date,
        quantity, unit_price, discount_percent, discount_amount, taxable_amount,
        tax_percent, sgst_amount, cgst_amount, igst_amount, line_total, reason
      )
    `)
    .order("credit_note_date", { ascending: false });

  throwIfError(error, "Could not load company credit notes.");

  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    creditNoteNo: String(row.credit_note_no || ""),
    date: day(row.credit_note_date),
    storeId: String(row.store_id || ""),
    storeName: String(row.stores?.name || "Store"),
    party: String(row.stores?.name || "Store"),
    storeLocation: String(row.stores?.location || ""),
    placeofreturn: "",
    amount: num(row.taxable_amount),
    sgst: num(row.sgst_amount),
    cgst: num(row.cgst_amount),
    igst: num(row.igst_amount),
    roundOff: num(row.round_off),
    total: num(row.total_amount),
    status: row.status === "accepted" ? "Approved" : row.status === "issued" ? "Pending" : row.status === "cancelled" ? "Rejected" : "Draft",
    reason: String(row.reason || ""),
    items: (row.company_credit_note_items || []).map(mapCreditNoteItem),
  }));
}

function mapCreditNoteItem(item: any) {
  return {
    productId: String(item.variant_id || ""),
    productName: String(item.product_name || ""),
    packSize: String(item.pack_size || ""),
    batchNo: String(item.batch_no || ""),
    expiryDate: day(item.expiry_date),
    quantity: num(item.quantity),
    unitPrice: num(item.unit_price),
    discountPercent: num(item.discount_percent),
    discountAmount: num(item.discount_amount),
    taxableAmount: num(item.taxable_amount),
    taxPercent: num(item.tax_percent),
    sgst: num(item.sgst_amount),
    cgst: num(item.cgst_amount),
    igst: num(item.igst_amount),
    total: num(item.line_total),
    reason: String(item.reason || ""),
  };
}

export async function saveCompanyCreditNoteDb(
  creditNoteId: string | null,
  header: {
    store_id: string;
    credit_note_date?: string;
    company_invoice_id?: string | null;
    place_of_return?: string | null;
    store_location?: string | null;
    reason?: string | null;
    notes?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("save_company_credit_note", {
    p_credit_note_id: creditNoteId,
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not save company credit note.");
  return data as { id: string; credit_note_no: string };
}

export async function issueCompanyCreditNoteDb(creditNoteId: string) {
  await requireUserId();
  const { error } = await db().rpc("issue_company_credit_note", {
    p_credit_note_id: creditNoteId,
  });
  throwIfError(error, "Could not issue company credit note.");
}

export async function createIssuedCompanyCreditNoteDb(
  header: {
    store_id: string;
    credit_note_date?: string;
    reason?: string | null;
    notes?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_issued_company_credit_note", {
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not create the credit note.");
  return data as { id: string; credit_note_no: string; total_amount: number };
}

export type EligibleReturnCreditLine = {
  id: string;
  returnNo: string;
  returnDate: string;
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  availableQty: number;
  returnedQty: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  taxPercent: number;
  sgst: number;
  cgst: number;
  igst: number;
  lineTotal: number;
};

export async function loadEligibleReturnCredits(storeId: string): Promise<EligibleReturnCreditLine[]> {
  await requireUserId();
  const client = db();
  const returns = await client
    .from("purchase_return_items")
    .select(`
      id, product_name, pack_size, batch_no, expiry_date, quantity, unit_price,
      discount_percent, discount_amount, taxable_amount, tax_percent,
      sgst_amount, cgst_amount, igst_amount, line_total,
      purchase_returns!inner ( return_no, return_date, store_id, status )
    `)
    .eq("purchase_returns.store_id", storeId)
    .eq("purchase_returns.status", "approved");
  throwIfError(returns.error, "Could not load returned products.");
  const rows = (returns.data || []) as any[];
  const ids = rows.map((row) => String(row.id));
  const credited = new Map<string, number>();
  if (ids.length > 0) {
    const used = await client
      .from("company_credit_note_items")
      .select("purchase_return_item_id, quantity, company_credit_notes!inner(status)")
      .in("purchase_return_item_id", ids)
      .neq("company_credit_notes.status", "cancelled");
    throwIfError(used.error, "Could not load credited quantities.");
    for (const row of (used.data || []) as any[]) {
      const id = String(row.purchase_return_item_id || "");
      credited.set(id, (credited.get(id) || 0) + num(row.quantity));
    }
  }
  return rows
    .map((row) => {
      const returnedQty = num(row.quantity);
      const availableQty = Math.max(0, returnedQty - (credited.get(String(row.id)) || 0));
      const header = row.purchase_returns || {};
      return {
        id: String(row.id),
        returnNo: String(header.return_no || ""),
        returnDate: day(header.return_date),
        productName: String(row.product_name || ""),
        packSize: String(row.pack_size || ""),
        batchNo: String(row.batch_no || ""),
        expiryDate: day(row.expiry_date),
        availableQty,
        returnedQty,
        unitPrice: num(row.unit_price),
        discountPercent: num(row.discount_percent),
        discountAmount: num(row.discount_amount),
        taxableAmount: num(row.taxable_amount),
        taxPercent: num(row.tax_percent),
        sgst: num(row.sgst_amount),
        cgst: num(row.cgst_amount),
        igst: num(row.igst_amount),
        lineTotal: num(row.line_total),
      };
    })
    .filter((row) => row.availableQty > 0);
}

export async function loadStoreDebitNotes(storeId: string): Promise<DbCompanyCreditNote[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("company_credit_notes")
    .select(`
      id, store_id, credit_note_no, credit_note_date, reason,
      taxable_amount, sgst_amount, cgst_amount, igst_amount, round_off, total_amount, status,
      stores ( id, name, location ),
      company_credit_note_items (
        id, variant_id, batch_id, product_name, pack_size, batch_no, expiry_date,
        quantity, unit_price, discount_percent, discount_amount, taxable_amount,
        tax_percent, sgst_amount, cgst_amount, igst_amount, line_total, reason
      )
    `)
    .eq("store_id", storeId)
    .in("status", ["issued", "accepted"])
    .order("credit_note_date", { ascending: false });

  throwIfError(error, "Could not load store debit notes.");

  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    creditNoteNo: String(row.credit_note_no || ""),
    date: day(row.credit_note_date),
    storeId: String(row.store_id || ""),
    storeName: String(row.stores?.name || "Store"),
    party: String(row.stores?.name || "Store"),
    storeLocation: String(row.stores?.location || ""),
    placeofreturn: "",
    amount: num(row.taxable_amount),
    sgst: num(row.sgst_amount),
    cgst: num(row.cgst_amount),
    igst: num(row.igst_amount),
    roundOff: num(row.round_off),
    total: num(row.total_amount),
    status: row.status === "accepted" ? "Approved" : row.status === "issued" ? "Pending" : row.status === "cancelled" ? "Rejected" : "Draft",
    reason: String(row.reason || ""),
    items: (row.company_credit_note_items || []).map(mapCreditNoteItem),
  }));
}

export async function acceptDebitNoteDb(debitNoteId: string) {
  await requireUserId();
  const { error } = await db().rpc("accept_debit_note", {
    p_credit_note_id: debitNoteId,
  });
  throwIfError(error, "Could not accept debit note.");
}
