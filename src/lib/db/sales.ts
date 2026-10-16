import { db, requireUserId, throwIfError } from "@/lib/db/client";
import { type RpcLine } from "@/lib/db/rpc";

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function day(v: unknown): string {
  return String(v || "").slice(0, 10);
}

function text(value: unknown): string {
  const cleaned = String(value ?? "").trim();
  return cleaned === "-" ? "" : cleaned;
}

type ProductIdentity = {
  name: string;
  hsn: string;
  pack: string;
  batch: string;
  expiry: string;
};

async function invoiceIdentities(ids: string[]) {
  const map = new Map<string, ProductIdentity>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data, error } = await db()
    .from("sales_invoice_items")
    .select("id, product_name, hsn_code, pack_size, batch_no, expiry_date")
    .in("id", unique);
  throwIfError(error, "Could not load invoice products for sales returns.");
  for (const row of (data || []) as any[]) {
    map.set(String(row.id), {
      name: text(row.product_name),
      hsn: text(row.hsn_code),
      pack: text(row.pack_size),
      batch: text(row.batch_no),
      expiry: day(row.expiry_date),
    });
  }
  return map;
}

async function variantIdentities(ids: string[]) {
  const map = new Map<string, ProductIdentity>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data, error } = await db()
    .from("product_variants")
    .select("id, pack_size, products(name, hsn_code)")
    .in("id", unique);
  throwIfError(error, "Could not load catalog products for sales returns.");
  for (const row of (data || []) as any[]) {
    const product = Array.isArray(row.products) ? row.products[0] || {} : row.products || {};
    map.set(String(row.id), {
      name: text(product.name),
      hsn: text(product.hsn_code),
      pack: text(row.pack_size),
      batch: "",
      expiry: "",
    });
  }
  return map;
}

function firstText(...values: string[]) {
  return values.find((value) => value.trim()) || "";
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

export type DbSaleInvoice = {
  id: string;
  date: string;
  invoiceNo: string;
  through: "Direct" | "Executive";
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName?: string;
  createdByStaffId?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  status: string;
  notes: string;
  products: {
    key: string;
    productId: string;
    pkgsize: string;
    batchNo: string;
    expiryDate: string;
    packSize: string;
    hsn: string;
    taxPercent: number;
    quantity: number;
    sellingPrice: number;
    discount: number;
    withoutTax: number;
    taxAmount: number;
    rowTotal: number;
    sgst: number;
    cgst: number;
    igst: number;
  }[];
};

export async function loadSalesInvoices(storeId: string): Promise<DbSaleInvoice[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("sales_invoices")
    .select(`
      id, store_id, fro_staff_id, invoice_no, invoice_date, channel,
      farmer_id, party_name, farmer_phone, farmer_village, farmer_crop,
      farmer_acre, place_of_supply, taxable_amount, sgst_amount, cgst_amount,
      igst_amount, round_off, total_amount, status, notes,
      sales_invoice_items (
        id, variant_id, batch_id, product_name, pack_size, hsn_code,
        batch_no, expiry_date, quantity, unit_price, discount_percent,
        discount_amount, taxable_amount, tax_percent, sgst_amount,
        cgst_amount, igst_amount, tax_amount, line_total
      )
    `)
    .eq("store_id", storeId)
    .order("invoice_date", { ascending: false });

  throwIfError(error, "Could not load sales invoices.");
  const names = await staffNames(((data || []) as any[]).map((row) => row.fro_staff_id));

  return ((data || []) as any[]).map((row) => {
    const isExecutive = row.channel === "executive";
    const items = (row.sales_invoice_items || []).map((item: any, idx: number) => ({
      key: `db-${item.id || idx}`,
      sourceItemId: String(item.id || ""),
      productId: String(item.variant_id || ""),
      product: { name: String(item.product_name || "") },
      productName: String(item.product_name || ""),
      pkgsize: String(item.pack_size || ""),
      batchNo: String(item.batch_no || ""),
      expiryDate: day(item.expiry_date),
      packSize: String(item.pack_size || ""),
      hsn: String(item.hsn_code || ""),
      taxPercent: num(item.tax_percent),
      quantity: num(item.quantity),
      sellingPrice: num(item.unit_price),
      discount: num(item.discount_amount),
      withoutTax: num(item.taxable_amount),
      taxAmount: num(item.tax_amount),
      rowTotal: num(item.line_total),
      sgst: num(item.sgst_amount),
      cgst: num(item.cgst_amount),
      igst: num(item.igst_amount),
    }));

    return {
      id: String(row.id),
      date: day(row.invoice_date),
      invoiceNo: String(row.invoice_no || ""),
      through: isExecutive ? "Executive" : "Direct",
      partyName: String(row.party_name || ""),
      farmerId: row.farmer_id ? String(row.farmer_id) : undefined,
      farmerPhone: String(row.farmer_phone || ""),
      farmerVillage: String(row.farmer_village || ""),
      farmerCrop: String(row.farmer_crop || ""),
      farmerAcre: String(row.farmer_acre || ""),
      placeOfSupply: String(row.place_of_supply || "Tamil Nadu"),
      executiveName: names.get(String(row.fro_staff_id || "")) || undefined,
      createdByStaffId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
      withoutTax: num(row.taxable_amount),
      sgst: num(row.sgst_amount),
      cgst: num(row.cgst_amount),
      igst: num(row.igst_amount),
      amount: num(row.total_amount),
      roundOff: num(row.round_off),
      status: String(row.status || "final"),
      notes: String(row.notes || ""),
      products: items,
    };
  });
}

export async function createSalesInvoiceDb(
  header: {
    store_id: string;
    fro_staff_id?: string | null;
    channel?: "direct" | "executive";
    farmer_id?: string | null;
    customer_name: string;
    party_name?: string;
    customer_phone?: string | null;
    farmer_phone?: string | null;
    customer_village?: string | null;
    farmer_village?: string | null;
    farmer_crop?: string | null;
    farmer_acre?: string | null;
    place_of_supply?: string | null;
    invoice_date?: string;
    payment_method?: string;
    notes?: string | null;
    round_off?: number;
    quotation_id?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_sales_invoice", {
    p_header: {
      ...header,
      party_name: header.party_name || header.customer_name,
      farmer_phone: header.farmer_phone ?? header.customer_phone ?? null,
      farmer_village: header.farmer_village ?? header.customer_village ?? null,
    },
    p_lines: lines,
  });
  throwIfError(error, "Could not save sales invoice.");
  return data as { id: string; invoice_no: string; total_amount: number };
}

export async function cancelSalesInvoiceDb(invoiceId: string, reason: string) {
  await requireUserId();
  const { error } = await db().rpc("cancel_sales_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason,
  });
  throwIfError(error, "Could not cancel sales invoice.");
}

export type DbQuotation = {
  roundOff: number;
  id: string;
  quotationNo: string;
  date: string;
  farmerId: string;
  farmer: string;
  phone: string;
  village: string;
  crop: string;
  acre: string;
  placeOfSupply: string;
  remarks: string;
  executiveName?: string;
  createdByStaffId?: string;
  through?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  status: string;
  products: {
    id: string;
    product: string;
    productName: string;
    pkgsize: string;
    batchNo?: string;
    qty: string;
    rate: string;
    taxPercent: number;
    sgstPercent: number;
    cgstPercent: number;
    igstPercent: number;
    productId?: string;
    quantity?: number;
    sellingPrice?: number;
    discount?: number;
    withoutTax?: number;
    taxAmount?: number;
    rowTotal?: number;
    sgst?: number;
    cgst?: number;
    igst?: number;
  }[];
};

export async function loadQuotations(storeId: string): Promise<DbQuotation[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("quotations")
    .select(`
      id, store_id, fro_staff_id, quotation_no, quotation_date,
      farmer_id, farmer_name, phone, village, crop, acre,
      place_of_supply, taxable_amount, sgst_amount, cgst_amount, igst_amount,
      total_amount, round_off, status, converted_invoice_id, remarks, channel,
      quotation_items (
        id, variant_id, product_name, pack_size, hsn_code,
        quantity, unit_price, discount_percent,
        discount_amount, taxable_amount, tax_percent, sgst_amount,
        cgst_amount, igst_amount, tax_amount, line_total
      )
    `)
    .eq("store_id", storeId)
    .order("quotation_date", { ascending: false });

  throwIfError(error, "Could not load quotations.");
  const names = await staffNames(((data || []) as any[]).map((row) => row.fro_staff_id));

  return ((data || []) as any[]).map((row) => {
    const isExecutive = Boolean(row.fro_staff_id) || row.channel === "executive";
    const isInter = String(row.place_of_supply || "").toLowerCase() !== "tamil nadu";
    const items = (row.quotation_items || []).map((item: any, idx: number) => {
      const taxRate = num(item.tax_percent);
      return {
        id: `db-q-${item.id || idx}`,
        key: `db-q-${item.id || idx}`,
        product: String(item.product_name || ""),
        productName: String(item.product_name || ""),
        productId: String(item.variant_id || ""),
        variantId: String(item.variant_id || ""),
        pkgsize: String(item.pack_size || ""),
        batchNo: "",
        expiryDate: "",
        packSize: String(item.pack_size || ""),
        hsn: String(item.hsn_code || ""),
        qty: String(item.quantity || 0),
        quantity: num(item.quantity),
        rate: String(item.unit_price || 0),
        sellingPrice: num(item.unit_price),
        discount: num(item.discount_amount),
        withoutTax: num(item.taxable_amount),
        taxAmount: num(item.tax_amount),
        rowTotal: num(item.line_total),
        taxPercent: taxRate,
        sgstPercent: isInter ? 0 : taxRate / 2,
        cgstPercent: isInter ? 0 : taxRate / 2,
        igstPercent: isInter ? taxRate : 0,
        sgst: num(item.sgst_amount),
        cgst: num(item.cgst_amount),
        igst: num(item.igst_amount),
      };
    });

    return {
      roundOff: num(row.round_off),
      id: String(row.id),
      quotationNo: String(row.quotation_no || ""),
      date: day(row.quotation_date),
      farmerId: String(row.farmer_id || ""),
      farmer: String(row.farmer_name || ""),
      phone: String(row.phone || ""),
      village: String(row.village || ""),
      crop: String(row.crop || ""),
      acre: String(row.acre || ""),
      placeOfSupply: String(row.place_of_supply || "Tamil Nadu"),
      remarks: String(row.remarks || ""),
      executiveName: names.get(String(row.fro_staff_id || "")) || undefined,
      createdByStaffId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
      through: isExecutive ? "Executive" : "Direct",
      withoutTax: num(row.taxable_amount),
      sgst: num(row.sgst_amount),
      cgst: num(row.cgst_amount),
      igst: num(row.igst_amount),
      amount: num(row.total_amount),
      status: row.status === "converted" ? "Converted" : row.status === "cancelled" ? "Cancelled" : "Open",
      products: items,
    };
  });
}

export async function saveQuotationDb(
  quotationId: string | null,
  header: {
    store_id: string;
    fro_staff_id?: string | null;
    farmer_id?: string | null;
    farmer_name: string;
    customer_name?: string;
    phone?: string | null;
    customer_phone?: string | null;
    village?: string | null;
    customer_village?: string | null;
    crop?: string | null;
    acre?: string | null;
    quotation_date?: string;
    valid_until?: string | null;
    place_of_supply?: string | null;
    remarks?: string | null;
    notes?: string | null;
    channel?: "direct" | "executive";
    round_off?: number;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("save_quotation", {
    p_quotation_id: quotationId,
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not save quotation.");
  return data as { id: string; quotation_no: string; total_amount: number; status: string };
}

export async function cancelQuotationDb(quotationId: string) {
  await requireUserId();
  const { error } = await db().rpc("cancel_quotation", {
    p_quotation_id: quotationId,
  });
  throwIfError(error, "Could not cancel quotation.");
}

export async function convertQuotationToInvoiceDb(
  quotationId: string,
  header: Record<string, unknown>,
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("convert_quotation_to_invoice", {
    p_quotation_id: quotationId,
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not convert quotation to invoice.");
  return data as { id: string; invoice_no: string };
}

export type DbSalesReturn = {
  id: string;
  date: string;
  returnNo: string;
  invoiceNo: string;
  through: "Direct" | "Executive";
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName: string;
  froStaffId?: string;
  beforeDiscount: number;
  discountAmount: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  roundOff: number;
  total: number;
  status: string;
  items: {
    key: string;
    productId: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    quantity: number;
    price: number;
    beforeDiscount: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    withoutTax: number;
    sgst: number;
    cgst: number;
    igst: number;
    total: number;
    taxAmount: number;
    rowTotal: number;
    reason: string;
  }[];
};

async function invoiceNumbers(ids: unknown[]) {
  const unique = [...new Set(ids.map((id) => String(id || "")).filter(Boolean))];
  const numbers = new Map<string, string>();
  if (unique.length === 0) return numbers;
  const { data, error } = await db()
    .from("sales_invoices")
    .select("id, invoice_no")
    .in("id", unique);
  throwIfError(error, "Could not load invoices linked to sales returns.");
  for (const row of data || []) numbers.set(String(row.id), String(row.invoice_no || ""));
  return numbers;
}

export async function loadSalesReturns(storeId: string): Promise<DbSalesReturn[]> {
  await requireUserId();
  const { data, error } = await db()
    .from("sales_returns")
    .select(`
      id, store_id, fro_staff_id, sales_invoice_id, farmer_id, return_no, return_date,
      party_name, farmer_phone, farmer_village, channel,
      taxable_amount, sgst_amount, cgst_amount, igst_amount, round_off, total_amount, status,
      rejection_reason,
      sales_return_items (
        id, sales_invoice_item_id, variant_id, batch_id, product_name,
        pack_size, hsn_code, batch_no, expiry_date, quantity, unit_price,
        discount_percent, discount_amount, taxable_amount, tax_percent,
        sgst_amount, cgst_amount, igst_amount, line_total, reason
      )
    `)
    .eq("store_id", storeId)
    .order("return_date", { ascending: false });

  throwIfError(error, "Could not load sales returns.");
  const rows = (data || []) as any[];
  const [names, invoices] = await Promise.all([
    staffNames(rows.map((row) => row.fro_staff_id)),
    invoiceNumbers(rows.map((row) => row.sales_invoice_id)),
  ]);

  const rawItems = rows.flatMap((row) => row.sales_return_items || []);
  const missingIdentity = rawItems.filter(
    (item: any) => !text(item.product_name) || !text(item.hsn_code),
  );
  const [invoicesByItem, variantsById] = await Promise.all([
    invoiceIdentities(missingIdentity.map((item: any) => String(item.sales_invoice_item_id || ""))),
    variantIdentities(missingIdentity.map((item: any) => String(item.variant_id || ""))),
  ]);

  return rows.map((row) => {
    const isExecutive = row.channel === "executive" || Boolean(row.fro_staff_id);
    let totalWithoutTax = 0;
    let totalSgst = 0;
    let totalCgst = 0;
    let totalIgst = 0;
    let totalDiscount = 0;

    const items = (row.sales_return_items || []).map((item: any, idx: number) => {
      const lineTaxable = num(item.taxable_amount);
      const lineSgst = num(item.sgst_amount);
      const lineCgst = num(item.cgst_amount);
      const lineIgst = num(item.igst_amount);
      const lineTotal = num(item.line_total);
      const lineDisc = num(item.discount_amount);
      const lineTax = lineSgst + lineCgst + lineIgst;
      const invoiceLine = invoicesByItem.get(String(item.sales_invoice_item_id || ""));
      const variantLine = variantsById.get(String(item.variant_id || ""));
      const productName = firstText(text(item.product_name), invoiceLine?.name || "", variantLine?.name || "");
      const hsnCode = firstText(text(item.hsn_code), invoiceLine?.hsn || "", variantLine?.hsn || "");
      const packSize = firstText(text(item.pack_size), invoiceLine?.pack || "", variantLine?.pack || "");
      const batchNo = firstText(text(item.batch_no), invoiceLine?.batch || "");
      const expiryDate = firstText(day(item.expiry_date), invoiceLine?.expiry || "");

      totalWithoutTax += lineTaxable;
      totalSgst += lineSgst;
      totalCgst += lineCgst;
      totalIgst += lineIgst;
      totalDiscount += lineDisc;

      return {
        key: `db-sr-${item.id || idx}`,
        sourceItemId: String(item.sales_invoice_item_id || ""),
        productId: String(item.variant_id || ""),
        product: productName || hsnCode
          ? { name: productName, hsnCode, size: packSize }
          : undefined,
        packSize,
        batchNo,
        expiryDate,
        quantity: num(item.quantity),
        price: num(item.unit_price),
        beforeDiscount: lineTaxable + lineDisc,
        discountPercent: num(item.discount_percent),
        discountAmount: lineDisc,
        taxPercent: num(item.tax_percent) || (lineTaxable > 0 ? (lineTax / lineTaxable) * 100 : 0),
        withoutTax: lineTaxable,
        sgst: lineSgst,
        cgst: lineCgst,
        igst: lineIgst,
        total: lineTotal,
        taxAmount: lineTax,
        rowTotal: lineTotal,
        reason: String(item.reason || ""),
      };
    });

    return {
      id: String(row.id),
      date: day(row.return_date),
      returnNo: String(row.return_no || ""),
      invoiceNo: invoices.get(String(row.sales_invoice_id || "")) || "",
      through: isExecutive ? "Executive" : "Direct",
      partyName: String(row.party_name || ""),
      farmerId: row.farmer_id ? String(row.farmer_id) : undefined,
      farmerPhone: String(row.farmer_phone || ""),
      farmerVillage: String(row.farmer_village || ""),
      farmerCrop: "",
      farmerAcre: "",
      placeOfSupply: "Tamil Nadu",
      executiveName: names.get(String(row.fro_staff_id || "")) || "",
      froStaffId: row.fro_staff_id ? String(row.fro_staff_id) : undefined,
      beforeDiscount: totalWithoutTax + totalDiscount,
      discountAmount: totalDiscount,
      withoutTax: num(row.taxable_amount) || totalWithoutTax,
      sgst: num(row.sgst_amount) || totalSgst,
      cgst: num(row.cgst_amount) || totalCgst,
      igst: num(row.igst_amount) || totalIgst,
      roundOff: num(row.round_off),
      total: num(row.total_amount),
      status: String(row.status || "pending"),
      items,
    };
  });
}

export async function createSalesReturnDb(
  header: {
    sales_invoice_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    return_date?: string;
    reason?: string | null;
    place_of_return?: string | null;
  },
  lines: RpcLine[],
) {
  await requireUserId();
  const { data, error } = await db().rpc("create_sales_return", {
    p_header: header,
    p_lines: lines,
  });
  throwIfError(error, "Could not create sales return.");
  return data as { id: string; return_no: string; total_amount: number; status: string };
}

export async function approveSalesReturnDb(returnId: string) {
  await requireUserId();
  const { error } = await db().rpc("approve_sales_return", {
    p_return_id: returnId,
  });
  throwIfError(error, "Could not approve sales return.");
}

export async function rejectSalesReturnDb(returnId: string, reason: string) {
  await requireUserId();
  const { error } = await db().rpc("reject_sales_return", {
    p_return_id: returnId,
    p_reason: reason,
  });
  throwIfError(error, "Could not reject sales return.");
}

export type EligibleSalesReturnCredit = {
  id: string;
  returnNo: string;
  returnDate: string;
  partyName: string;
  farmerId: string;
  productName: string;
  hsnCode: string;
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
  reason: string;
};

export async function loadEligibleSalesReturnCredits(storeId: string): Promise<EligibleSalesReturnCredit[]> {
  await requireUserId();
  const client = db();
  const returns = await client
    .from("sales_return_items")
    .select(`
      id, sales_invoice_item_id, variant_id, product_name, pack_size, hsn_code,
      batch_no, expiry_date, quantity, unit_price, discount_percent, discount_amount,
      taxable_amount, tax_percent, sgst_amount, cgst_amount, igst_amount, line_total, reason,
      sales_returns!inner ( return_no, return_date, store_id, status, party_name, farmer_id )
    `)
    .eq("sales_returns.store_id", storeId)
    .eq("sales_returns.status", "approved");
  throwIfError(returns.error, "Could not load returned products.");
  const rows = (returns.data || []) as any[];
  const missing = rows.filter((row) => !text(row.product_name) || !text(row.hsn_code));
  const [invoicesByItem, variantsById] = await Promise.all([
    invoiceIdentities(missing.map((row) => String(row.sales_invoice_item_id || ""))),
    variantIdentities(missing.map((row) => String(row.variant_id || ""))),
  ]);
  const ids = rows.map((row) => String(row.id));
  const credited = new Map<string, number>();
  if (ids.length > 0) {
    const used = await client
      .from("store_credit_note_items")
      .select("sales_return_item_id, quantity, store_credit_notes!inner(status)")
      .in("sales_return_item_id", ids)
      .neq("store_credit_notes.status", "cancelled");
    throwIfError(used.error, "Could not load credited return quantities.");
    for (const row of (used.data || []) as any[]) {
      const id = String(row.sales_return_item_id || "");
      credited.set(id, (credited.get(id) || 0) + num(row.quantity));
    }
  }
  return rows
    .map((row) => {
      const header = row.sales_returns || {};
      const invoiceLine = invoicesByItem.get(String(row.sales_invoice_item_id || ""));
      const variantLine = variantsById.get(String(row.variant_id || ""));
      const returnedQty = num(row.quantity);
      const availableQty = Math.max(0, returnedQty - (credited.get(String(row.id)) || 0));
      return {
        id: String(row.id),
        returnNo: String(header.return_no || ""),
        returnDate: day(header.return_date),
        partyName: String(header.party_name || ""),
        farmerId: String(header.farmer_id || ""),
        productName: firstText(text(row.product_name), invoiceLine?.name || "", variantLine?.name || ""),
        hsnCode: firstText(text(row.hsn_code), invoiceLine?.hsn || "", variantLine?.hsn || ""),
        packSize: firstText(text(row.pack_size), invoiceLine?.pack || "", variantLine?.pack || ""),
        batchNo: firstText(text(row.batch_no), invoiceLine?.batch || ""),
        expiryDate: firstText(day(row.expiry_date), invoiceLine?.expiry || ""),
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
        reason: String(row.reason || ""),
      };
    })
    .filter((row) => row.productName && row.availableQty > 0);
}
