import { db, requireUserId, throwIfError } from "@/lib/db/client";
import {
  adoptDatabaseFroStock,
  adoptDatabasePurchasing,
  type CompanyStoreSaleRecord,
  type DatabaseFroStockLine,
  type DatabasePurchaseOrder,
  type DatabasePurchaseReturn,
  type DatabaseStockLine,
} from "@/lib/data";

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function day(value: unknown) {
  return String(value || "").slice(0, 10);
}

function poStatus(value: string): DatabasePurchaseOrder["status"] {
  if (value === "accepted") return "Accepted";
  if (value === "rejected") return "Rejected";
  return "Pending";
}

function returnStatus(value: string): DatabasePurchaseReturn["status"] {
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  return "Pending";
}

async function selectAll<T>(table: string, columns: string) {
  await requireUserId();
  const result = await db()
    .from(table as "stores")
    .select(columns);
  throwIfError(result.error, `Could not load ${table}.`);
  return (result.data ?? []) as T[];
}

export async function refreshPurchasingData() {
  const [orders, orderItems, invoices, invoiceItems, returns, returnItems, stock, stores] =
    await Promise.all([
      selectAll<Record<string, unknown>>(
        "purchase_orders",
        "id, store_id, po_no, po_date, taxable_amount, sgst_amount, cgst_amount, igst_amount, total_amount, total_quantity, status, notes",
      ),
      selectAll<Record<string, unknown>>(
        "purchase_order_items",
        "id, po_id, variant_id, product_name, pack_size, hsn_code, quantity, unit_price, tax_percent, taxable_amount, sgst_amount, cgst_amount, igst_amount, line_total",
      ),
      selectAll<Record<string, unknown>>(
        "company_invoices",
        "id, invoice_no, invoice_date, store_id, purchase_order_id, place_of_supply, store_location, shipping_address, notes, taxable_amount, sgst_amount, cgst_amount, igst_amount, total_amount, status, receipt_status",
      ),
      selectAll<Record<string, unknown>>(
        "company_invoice_items",
        "id, invoice_id, variant_id, product_name, pack_size, hsn_code, batch_no, expiry_date, quantity, unit_price, discount_percent, discount_amount, taxable_amount, tax_percent, sgst_amount, cgst_amount, igst_amount, tax_amount, line_total",
      ),
      selectAll<Record<string, unknown>>(
        "purchase_returns",
        "id, store_id, return_no, return_date, company_invoice_id, reason, decision_note, total_amount, status",
      ),
      selectAll<Record<string, unknown>>(
        "purchase_return_items",
        "id, return_id, company_invoice_item_id, product_name, pack_size, batch_no, expiry_date, quantity, unit_price, discount_amount, sgst_amount, cgst_amount, igst_amount, line_total, reason",
      ),
      selectAll<Record<string, unknown>>(
        "store_stock_available",
        "store_id, variant_id, batch_id, product_name, pack_size, batch_no, expiry_date, quantity, available_quantity",
      ),
      selectAll<Record<string, unknown>>("stores", "id, name, code"),
    ]);

  const storeName = new Map(stores.map((row) => [String(row.id), String(row.name || "")]));
  const storeCode = new Map(stores.map((row) => [String(row.id), String(row.code || "")]));
  const mappedOrders: DatabasePurchaseOrder[] = orders.map((order) => {
    const items = orderItems
      .filter((item) => item.po_id === order.id)
      .map((item) => ({
        id: String(item.id),
        productId: String(item.variant_id),
        product: String(item.product_name || ""),
        productName: String(item.product_name || ""),
        hsnCode: String(item.hsn_code || ""),
        packSize: String(item.pack_size || ""),
        quantity: num(item.quantity),
        price: num(item.unit_price),
        sellingPrice: num(item.unit_price),
        taxPercent: num(item.tax_percent),
        discountAmount: 0,
        taxableAmount: num(item.taxable_amount),
        amount: num(item.line_total),
        withoutTax: num(item.taxable_amount),
        sgst: num(item.sgst_amount),
        cgst: num(item.cgst_amount),
        igst: num(item.igst_amount),
        total: num(item.line_total),
        batchNo: "",
        expiryDate: "",
      }));
    return {
      id: String(order.id),
      storeId: String(order.store_id),
      storeName: storeName.get(String(order.store_id)) || "",
      poNo: String(order.po_no || ""),
      date: day(order.po_date),
      totalProduct: num(order.total_quantity),
      withoutTax: num(order.taxable_amount),
      sgst: num(order.sgst_amount),
      cgst: num(order.cgst_amount),
      igst: num(order.igst_amount),
      total: num(order.total_amount),
      status: poStatus(String(order.status || "")),
      notes: String(order.notes || ""),
      items,
    };
  });

  const poById = new Map(mappedOrders.map((order) => [order.id, order]));
  const sales: CompanyStoreSaleRecord[] = [];
  const statuses: Record<string, string> = {};
  invoices
    .filter((invoice) => invoice.status !== "cancelled")
    .forEach((invoice) => {
      const invoiceNo = String(invoice.invoice_no || "");
      const linked = poById.get(String(invoice.purchase_order_id || ""));
      const lines = invoiceItems.filter((item) => item.invoice_id === invoice.id);
      if (invoiceNo && invoice.receipt_status === "received") statuses[invoiceNo] = "Received";
      else if (invoiceNo) statuses[invoiceNo] = "Dispatched";
      lines.forEach((item) => {
        sales.push({
          id: String(item.id),
          invoiceId: String(invoice.id),
          invoiceItemId: String(item.id),
          invoiceNo,
          date: day(invoice.invoice_date),
          storeId: String(invoice.store_id),
          storeName: storeName.get(String(invoice.store_id)) || "",
          storeLocation: String(invoice.store_location || ""),
          placeOfSupply: String(invoice.place_of_supply || ""),
          product: String(item.product_name || ""),
          packSize: String(item.pack_size || ""),
          pkgsize: String(item.pack_size || ""),
          quantity: num(item.quantity),
          rate: num(item.unit_price),
          unitPrice: num(item.unit_price),
          price: num(item.unit_price),
          beforeDiscount: num(item.quantity) * num(item.unit_price),
          discountPercent: num(item.discount_percent),
          discountAmount: num(item.discount_amount),
          discount: num(item.discount_amount),
          withoutTax: num(item.taxable_amount),
          taxableAmount: num(item.taxable_amount),
          taxAmount: num(item.tax_amount),
          taxPercent: num(item.tax_percent),
          sgst: num(item.sgst_amount),
          cgst: num(item.cgst_amount),
          igst: num(item.igst_amount),
          total: num(item.line_total),
          returnAmount: 0,
          notes: String(invoice.notes || ""),
          shippingAddress: String(invoice.shipping_address || ""),
          batchNo: String(item.batch_no || ""),
          expiryDate: day(item.expiry_date),
          hsn: String(item.hsn_code || ""),
          productId: String(item.variant_id),
          saleStatus: invoice.status === "draft" ? "Draft" : "Final",
          purchaseOrderId: invoice.purchase_order_id ? String(invoice.purchase_order_id) : undefined,
          purchaseOrderNo: linked?.poNo,
        });
      });
    });

  const invoiceNoById = new Map(
    invoices.map((invoice) => [String(invoice.id), String(invoice.invoice_no || "")]),
  );
  const mappedReturns: DatabasePurchaseReturn[] = returns.map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    storeName: storeName.get(String(row.store_id)) || "",
    storeCode: storeCode.get(String(row.store_id)) || "",
    returnNo: String(row.return_no || ""),
    date: day(row.return_date),
    invoiceId: String(row.company_invoice_id),
    invoiceNo: invoiceNoById.get(String(row.company_invoice_id)) || "",
    total: num(row.total_amount),
    reason: String(row.reason || ""),
    decisionNote: String(row.decision_note || ""),
    status: returnStatus(String(row.status || "")),
    items: returnItems
      .filter((item) => item.return_id === row.id)
      .map((item) => ({
        id: String(item.id),
        sourceItemId: String(item.company_invoice_item_id),
        product: String(item.product_name || ""),
        packSize: String(item.pack_size || ""),
        batchNo: String(item.batch_no || ""),
        expiryDate: day(item.expiry_date),
        quantity: num(item.quantity),
        price: num(item.unit_price),
        discountAmount: num(item.discount_amount),
        sgst: num(item.sgst_amount),
        cgst: num(item.cgst_amount),
        igst: num(item.igst_amount),
        total: num(item.line_total),
        reason: String(item.reason || ""),
      })),
  }));

  const mappedStock: DatabaseStockLine[] = stock.map((row) => ({
    storeId: String(row.store_id),
    variantId: String(row.variant_id),
    batchId: String(row.batch_id || ""),
    productName: String(row.product_name || ""),
    packSize: String(row.pack_size || ""),
    batchNo: String(row.batch_no || ""),
    expiryDate: day(row.expiry_date),
    quantity: num(row.quantity),
    available: num(row.available_quantity),
  }));

  adoptDatabasePurchasing({
    sales,
    orders: mappedOrders,
    returns: mappedReturns,
    statuses,
    stock: mappedStock,
  });
  await refreshFroStock();
}

export async function refreshFroStock() {
  await requireUserId();
  const balances = await selectAll<Record<string, unknown>>(
    "fro_stock_balances",
    "store_id, fro_staff_id, fro_name, variant_id, batch_id, product_name, pack_size, batch_no, expiry_date, quantity",
  );
  const movementResult = await db()
    .from("stock_movements")
    .select("store_id, fro_staff_id, variant_id, batch_id, unit_value, created_at")
    .eq("location", "fro")
    .eq("movement_type", "delivery_in")
    .order("created_at", { ascending: true });
  throwIfError(movementResult.error, "Could not load FRO stock values.");
  const unitValue = new Map<string, number>();
  for (const row of movementResult.data || []) {
    const value = num(row.unit_value);
    if (value <= 0) continue;
    const key = `${row.store_id}|${row.fro_staff_id}|${row.variant_id}|${row.batch_id || ""}`;
    unitValue.set(key, value);
  }
  const rows: DatabaseFroStockLine[] = balances.map((row) => {
    const key = `${row.store_id}|${row.fro_staff_id}|${row.variant_id}|${row.batch_id || ""}`;
    return {
      storeId: String(row.store_id),
      staffId: String(row.fro_staff_id || ""),
      froName: String(row.fro_name || ""),
      variantId: String(row.variant_id),
      batchId: String(row.batch_id || ""),
      productName: String(row.product_name || ""),
      packSize: String(row.pack_size || ""),
      batchNo: String(row.batch_no || ""),
      expiryDate: day(row.expiry_date),
      quantity: num(row.quantity),
      unitValue: unitValue.get(key) || 0,
    };
  });
  adoptDatabaseFroStock(rows);
  return rows;
}
