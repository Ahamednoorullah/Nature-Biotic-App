import { db, requireUserId, throwIfError } from "@/lib/db/client";

export type RpcLine = {
  product_id?: string | null;
  product_name?: string | null;
  pack_size?: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price?: number;
  discount_percent?: number;
  discount_amount?: number;
  taxable_amount?: number;
  tax_percent?: number;
  tax_rate?: number;
  hsn_code?: string | null;
  sgst_amount?: number;
  cgst_amount?: number;
  igst_amount?: number;
  tax_amount?: number;
  line_total?: number;
  batch_id?: string | null;
  batch_no?: string | null;
  expiry_date?: string | null;
  source_item_id?: string | null;
  line_type?: string | null;
  reason?: string | null;
  notes?: string | null;
};

async function callRpc<T>(fn: string, args: Record<string, unknown>) {
  await requireUserId();
  const result = await db().rpc(fn, args);
  throwIfError(result.error, `Could not complete ${fn}.`);
  return result.data as T;
}

export function submitPurchaseOrder(
  header: { store_id: string; po_date?: string; notes?: string; round_off?: number },
  lines: RpcLine[],
) {
  return callRpc<{ id: string; po_no: string; total_amount: number }>(
    "submit_purchase_order",
    { p_header: header, p_lines: lines },
  );
}

export function decidePurchaseOrder(
  poId: string,
  decision: "accepted" | "rejected",
  note?: string,
) {
  return callRpc<void>("decide_purchase_order", {
    p_po_id: poId,
    p_decision: decision,
    p_note: note ?? null,
  });
}

export function peekDocumentNo(docType: string, storeId?: string | null) {
  return callRpc<string>("peek_document_no", {
    p_doc_type: docType,
    p_store_id: storeId ?? null,
  });
}

export function saveCompanyInvoice(
  invoiceId: string | null,
  header: Record<string, unknown>,
  lines: RpcLine[],
  finalize = false,
) {
  return callRpc<Record<string, unknown>>("save_company_invoice", {
    p_invoice_id: invoiceId,
    p_header: header,
    p_lines: lines,
    p_finalize: finalize,
  });
}

export function markCompanyInvoiceReceived(invoiceId: string) {
  return callRpc<void>("mark_company_invoice_received", {
    p_invoice_id: invoiceId,
  });
}

export function submitPurchaseReturn(
  header: {
    company_invoice_id: string;
    return_date?: string;
    supplier?: string;
    place_of_return?: string;
    reason?: string;
  },
  lines: RpcLine[],
) {
  return callRpc<{ id: string; return_no: string; total_amount: number; status: string }>(
    "submit_purchase_return",
    { p_header: header, p_lines: lines },
  );
}

export function decidePurchaseReturn(
  returnId: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  return callRpc<void>("decide_purchase_return", {
    p_return_id: returnId,
    p_decision: decision,
    p_note: note ?? null,
  });
}

export function createSalesInvoice(
  header: Record<string, unknown>,
  lines: RpcLine[],
) {
  return callRpc<Record<string, unknown>>("create_sales_invoice", {
    p_header: header,
    p_lines: lines,
  });
}

export function createSalesReturn(
  header: Record<string, unknown>,
  lines: RpcLine[],
) {
  return callRpc<Record<string, unknown>>("create_sales_return", {
    p_header: header,
    p_lines: lines,
  });
}

export function createStoreReceipt(header: Record<string, unknown>) {
  return callRpc<Record<string, unknown>>("create_store_receipt", {
    p_header: header,
  });
}

export function createStoreRefund(args: {
  p_source_type: string;
  p_source_id: string;
  p_amount: number;
  p_method?: string | null;
  p_reason?: string | null;
  p_remarks?: string | null;
  p_refund_date?: string | null;
  p_place_of_supply?: string | null;
}) {
  return callRpc<Record<string, unknown>>("create_store_refund", args);
}

export function createCompanyReceipt(header: Record<string, unknown>) {
  return callRpc<Record<string, unknown>>("create_company_receipt", {
    p_header: header,
  });
}

export function createCompanyRefund(args: {
  p_credit_note_id: string;
  p_amount: number;
  p_method?: string | null;
  p_reason?: string | null;
  p_remarks?: string | null;
  p_refund_date?: string | null;
}) {
  return callRpc<Record<string, unknown>>("create_company_refund", args);
}

export function createStockAdjustment(args: {
  p_store_id: string;
  p_variant_id: string;
  p_qty: number;
  p_reason: string;
  p_batch_id?: string | null;
  p_batch_no?: string | null;
  p_adjustment_date?: string | null;
  p_remarks?: string | null;
}) {
  return callRpc<Record<string, unknown>>("create_stock_adjustment", args);
}

export function createStockDelivery(
  header: Record<string, unknown>,
  lines: RpcLine[],
) {
  return callRpc<Record<string, unknown>>("create_stock_delivery", {
    p_header: header,
    p_lines: lines,
  });
}

export function acceptStockDelivery(deliveryId: string) {
  return callRpc<void>("accept_stock_delivery", { p_delivery_id: deliveryId });
}

export function submitStockReturn(
  header: Record<string, unknown>,
  lines: RpcLine[],
) {
  return callRpc<Record<string, unknown>>("submit_stock_return", {
    p_header: header,
    p_lines: lines,
  });
}

export function createExpense(args: {
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
  return callRpc<Record<string, unknown>>("create_expense", args);
}

export async function loadCompanyDashboardMetrics() {
  await requireUserId();
  const result = await db().from("company_dashboard_metrics").select("*").maybeSingle();
  throwIfError(result.error, "Could not load company dashboard metrics.");
  return result.data;
}

export async function loadStoreDashboardMetrics(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("store_dashboard_metrics")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  throwIfError(result.error, "Could not load store dashboard metrics.");
  return result.data;
}
