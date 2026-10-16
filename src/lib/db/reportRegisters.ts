/**
 * Authoritative register loaders for Company / Store / FRO Reports.
 * Uses persisted document totals (including round_off) — does not recalculate GST.
 */
import { db, requireUserId, throwIfError } from "@/lib/db/client";

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function day(value: unknown) {
  return String(value || "").slice(0, 10);
}

export type ReportPurchaseOrder = {
  id: string;
  poNo: string;
  date: string;
  storeId: string;
  storeName: string;
  status: string;
  itemCount: number;
  taxable: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
};

export type ReportGstInvoice = {
  id: string;
  invoiceNo: string;
  date: string;
  storeId: string;
  storeName: string;
  status: string;
  receiptStatus: string;
  taxable: number;
  sgst: number;
  cgst: number;
  igst: number;
  roundOff: number;
  total: number;
};

export type ReportStockDelivery = {
  id: string;
  sdNo: string;
  date: string;
  storeId: string;
  storeName: string;
  executive: string;
  status: string;
  productSummary: string;
  quantity: number;
};

export type ReportStockLine = {
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  available?: number;
  froName?: string;
  staffId?: string;
};

async function storeNames() {
  const { data, error } = await db().from("stores").select("id, name");
  throwIfError(error, "Could not load stores.");
  return new Map(((data || []) as any[]).map((row) => [String(row.id), String(row.name || "Store")]));
}

export async function loadCompanyPurchaseOrderRegister(): Promise<ReportPurchaseOrder[]> {
  await requireUserId();
  const names = await storeNames();
  const [{ data: orders, error: orderError }, { data: items, error: itemError }] =
    await Promise.all([
      db()
        .from("purchase_orders")
        .select(
          "id, store_id, po_no, po_date, taxable_amount, sgst_amount, cgst_amount, igst_amount, total_amount, total_quantity, status",
        )
        .order("po_date", { ascending: false }),
      db().from("purchase_order_items").select("id, po_id"),
    ]);
  throwIfError(orderError, "Could not load purchase orders.");
  throwIfError(itemError, "Could not load purchase order items.");
  const itemCount = new Map<string, number>();
  for (const row of (items || []) as any[]) {
    const poId = String(row.po_id || "");
    itemCount.set(poId, (itemCount.get(poId) || 0) + 1);
  }
  return ((orders || []) as any[]).map((row) => {
    const statusRaw = String(row.status || "").toLowerCase();
    const status =
      statusRaw === "accepted"
        ? "Accepted"
        : statusRaw === "rejected"
          ? "Rejected"
          : "Pending";
    return {
      id: String(row.id),
      poNo: String(row.po_no || ""),
      date: day(row.po_date),
      storeId: String(row.store_id || ""),
      storeName: names.get(String(row.store_id || "")) || "Store",
      status,
      itemCount: itemCount.get(String(row.id)) || 0,
      taxable: num(row.taxable_amount),
      sgst: num(row.sgst_amount),
      cgst: num(row.cgst_amount),
      igst: num(row.igst_amount),
      total: num(row.total_amount),
    };
  });
}

export async function loadCompanyGstInvoiceRegister(): Promise<ReportGstInvoice[]> {
  await requireUserId();
  const names = await storeNames();
  const { data, error } = await db()
    .from("company_invoices")
    .select(
      "id, invoice_no, invoice_date, store_id, taxable_amount, sgst_amount, cgst_amount, igst_amount, round_off, total_amount, status, receipt_status",
    )
    .neq("status", "cancelled")
    .order("invoice_date", { ascending: false });
  throwIfError(error, "Could not load company GST invoices.");
  return ((data || []) as any[]).map((row) => ({
    id: String(row.id),
    invoiceNo: String(row.invoice_no || ""),
    date: day(row.invoice_date),
    storeId: String(row.store_id || ""),
    storeName: names.get(String(row.store_id || "")) || "Store",
    status: String(row.status || "draft"),
    receiptStatus: String(row.receipt_status || ""),
    taxable: num(row.taxable_amount),
    sgst: num(row.sgst_amount),
    cgst: num(row.cgst_amount),
    igst: num(row.igst_amount),
    roundOff: num(row.round_off),
    total: num(row.total_amount),
  }));
}

export async function loadCompanyStockDeliveryRegister(): Promise<ReportStockDelivery[]> {
  await requireUserId();
  const names = await storeNames();
  const { data, error } = await db()
    .from("stock_deliveries")
    .select(`
      id, store_id, fro_staff_id, sd_no, delivery_date, status,
      stock_delivery_items ( product_name, pack_size, qty )
    `)
    .order("delivery_date", { ascending: false });
  throwIfError(error, "Could not load stock deliveries.");
  const staffIds = ((data || []) as any[]).map((row) => row.fro_staff_id).filter(Boolean);
  let staffName = new Map<string, string>();
  if (staffIds.length) {
    const staffResult = await db().from("staff").select("id, name").in("id", staffIds);
    throwIfError(staffResult.error, "Could not load delivery executives.");
    staffName = new Map(
      ((staffResult.data || []) as any[]).map((row) => [String(row.id), String(row.name || "")]),
    );
  }
  return ((data || []) as any[]).map((row) => {
    const items = (row.stock_delivery_items || []) as any[];
    const quantity = items.reduce((sum, item) => sum + num(item.qty), 0);
    const productSummary = items
      .map((item) => `${item.product_name || "Product"} ${item.pack_size || ""}`.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
    const statusRaw = String(row.status || "").toLowerCase();
    const status =
      statusRaw === "accepted"
        ? "Accepted"
        : statusRaw === "rejected"
          ? "Rejected"
          : "Pending";
    return {
      id: String(row.id),
      sdNo: String(row.sd_no || ""),
      date: day(row.delivery_date),
      storeId: String(row.store_id || ""),
      storeName: names.get(String(row.store_id || "")) || "Store",
      executive: staffName.get(String(row.fro_staff_id || "")) || "Executive",
      status,
      productSummary: productSummary || "—",
      quantity,
    };
  });
}

export async function loadStoreStockRegister(storeId: string): Promise<ReportStockLine[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("store_stock_available")
    .select(
      "product_name, pack_size, batch_no, expiry_date, quantity, available_quantity",
    )
    .eq("store_id", storeId)
    .order("product_name", { ascending: true });
  throwIfError(error, "Could not load store stock balances.");
  return ((data || []) as any[])
    .map((row) => ({
      productName: String(row.product_name || "Product"),
      packSize: String(row.pack_size || ""),
      batchNo: String(row.batch_no || "—"),
      expiryDate: day(row.expiry_date),
      quantity: num(row.quantity),
      available: num(row.available_quantity),
    }))
    .filter((row) => row.quantity > 0 || (row.available || 0) > 0);
}

export async function loadStoreFroHandStockRegister(
  storeId: string,
): Promise<ReportStockLine[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("fro_stock_balances")
    .select(
      "fro_staff_id, fro_name, product_name, pack_size, batch_no, expiry_date, quantity",
    )
    .eq("store_id", storeId)
    .gt("quantity", 0)
    .order("fro_name", { ascending: true });
  throwIfError(error, "Could not load FRO hand stock.");
  return ((data || []) as any[]).map((row) => ({
    productName: String(row.product_name || "Product"),
    packSize: String(row.pack_size || ""),
    batchNo: String(row.batch_no || "—"),
    expiryDate: day(row.expiry_date),
    quantity: num(row.quantity),
    froName: String(row.fro_name || "Executive"),
    staffId: String(row.fro_staff_id || ""),
  }));
}

export async function loadFroHandStockRegister(
  storeId: string,
  staffId: string,
): Promise<ReportStockLine[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("fro_stock_balances")
    .select("product_name, pack_size, batch_no, expiry_date, quantity")
    .eq("store_id", storeId)
    .eq("fro_staff_id", staffId)
    .gt("quantity", 0)
    .order("product_name", { ascending: true });
  throwIfError(error, "Could not load FRO hand stock.");
  return ((data || []) as any[]).map((row) => ({
    productName: String(row.product_name || "Product"),
    packSize: String(row.pack_size || ""),
    batchNo: String(row.batch_no || "—"),
    expiryDate: day(row.expiry_date),
    quantity: num(row.quantity),
  }));
}
