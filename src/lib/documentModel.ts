import { formatCurrency, formatDate } from "@/lib/format";

export type DocumentType = "quotation" | "salesInvoice" | "salesReturn";

/** Which optional sections each document shows. Invoice payment and QR stay inside the invoice layout. */
export const documentConfig: Record<
  DocumentType,
  { title: string; showPayment: boolean; showQr: boolean }
> = {
  quotation: { title: "Quotation", showPayment: false, showQr: false },
  salesInvoice: { title: "TAX INVOICE", showPayment: true, showQr: true },
  salesReturn: { title: "Sales Return", showPayment: false, showQr: false },
};

const PRODUCT_SLOTS = 7;

/** Shared 7-row slot count. Screen quotations still reserve 10 rows. */
export function blankProductSlots(
  productCount: number,
  layout: "quotation-screen" | "document" | "invoice" = "document",
) {
  if (layout === "quotation-screen") return Math.max(0, 10 - productCount);
  if (layout === "invoice") return Math.max(0, PRODUCT_SLOTS - productCount);
  const remainder = productCount % PRODUCT_SLOTS;
  if (productCount > 0 && remainder === 0) return 0;
  return PRODUCT_SLOTS - remainder;
}

export type QuotationDocumentInput = {
  quotationNo: string;
  date: string;
  farmer?: string;
  village?: string;
  phone?: string;
  crop?: string;
  acre?: string;
  placeOfSupply?: string;
  products?: {
    id: string;
    productName?: string;
    pkgsize?: string;
    qty?: string | number;
    rate?: string | number;
    sgstPercent?: number;
    cgstPercent?: number;
    igstPercent?: number;
  }[];
  withoutTax?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  roundOff?: number;
  amount?: number;
};

export type DocumentCell = {
  text: string;
  className: string;
  colSpan?: number;
};

export type DocumentHeaderCell = {
  text: string;
  className: string;
  rowSpan?: number;
  colSpan?: number;
  width?: string;
};

export type CommonDocumentData = {
  heading: string;
  farmerName: string;
  village: string;
  phone: string;
  middleTitle: string;
  middleLines: { label: string; value: string }[];
  sideTitle: string;
  sideLines: { label: string; value: string }[];
  headers: DocumentHeaderCell[];
  subHeaders: DocumentHeaderCell[];
  colWidths: string[];
  rows: { id: string; cells: DocumentCell[] }[];
  totalCells: DocumentCell[];
  columnCount: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  roundOff: number;
  grandTotal: number;
  defaultNotes: string;
  farmerTitle?: string;
  kind?: "invoice";
  issuer?: {
    name: string;
    address: string;
    gstin: string;
    phone: string;
  };
  payment?: {
    accountName: string;
    accountNo: string;
    ifsc: string;
    bankName: string;
    branch: string;
    upiId: string;
    payable: number;
    qrUrl: string;
  };
};

const head = (
  text: string,
  className: string,
  rowSpan?: number,
  colSpan?: number,
  width?: string,
): DocumentHeaderCell => ({
  text,
  className,
  rowSpan,
  colSpan,
  width,
});

const cell = (text: string, className: string, colSpan?: number): DocumentCell => ({
  text,
  className,
  colSpan,
});

const SPAN = "border-r border-slate-300 px-2 py-2 text-center whitespace-nowrap";
const LEFT = "border-r border-slate-300 px-2 py-2 font-semibold text-slate-800";
const RIGHT = "border-r border-slate-300 px-2 py-2 text-right whitespace-nowrap tabular-nums";
const PERCENT = "border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap tabular-nums";
const LAST = "px-2 py-2 text-right font-bold text-slate-800 whitespace-nowrap tabular-nums";
const H_SPAN = "border-r border-slate-300 px-2 py-2 text-center whitespace-nowrap";
const H_LEFT = "border-r border-slate-300 px-2 py-2 text-left whitespace-nowrap";
const H_RIGHT = "border-r border-slate-300 px-2 py-2 text-right whitespace-nowrap";
const H_TAX = "border-r border-slate-300 px-1 py-1.5 text-center whitespace-nowrap";
const SUB_PERCENT = "border-r border-slate-300 px-1 py-1 text-center whitespace-nowrap";
const SUB_AMT = "border-r border-slate-300 px-1 py-1 text-right whitespace-nowrap";

function taxHeaders(label: string, width: string) {
  return head(label, `${H_TAX}`, undefined, 2, width);
}

function taxSubs() {
  return [head("%", SUB_PERCENT), head("Amt", SUB_AMT)];
}

function taxCells(percent: number, amount: number) {
  return [
    cell(Number(percent || 0).toFixed(2), PERCENT),
    cell(formatCurrency(amount), RIGHT),
  ];
}

function shown(value?: string) {
  const text = String(value || "").trim();
  return text && text !== "-" ? text : "-";
}

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function quotationToDocument(
  quotation: QuotationDocumentInput,
  notes = "",
): CommonDocumentData {
  const products = quotation.products || [];
  const rows = products.map((item, index) => {
    const withoutTax = Number(item.qty || 0) * Number(item.rate || 0);
    const sgstAmount = (withoutTax * Number(item.sgstPercent || 0)) / 100;
    const cgstAmount = (withoutTax * Number(item.cgstPercent || 0)) / 100;
    const igstAmount = (withoutTax * Number(item.igstPercent || 0)) / 100;
    const lineTotal = withoutTax + sgstAmount + cgstAmount + igstAmount;
    return {
      id: item.id || `line-${index}`,
      cells: [
        cell(String(index + 1), SPAN),
        cell(item.productName || "-", LEFT),
        cell(item.pkgsize || "", SPAN),
        cell(String(item.qty ?? ""), "border-r border-slate-300 px-2 py-2 text-center font-semibold"),
        cell(formatCurrency(Number(item.rate || 0)), RIGHT),
        cell(formatCurrency(withoutTax), RIGHT),
        ...taxCells(Number(item.sgstPercent || 0), sgstAmount),
        ...taxCells(Number(item.cgstPercent || 0), cgstAmount),
        ...taxCells(Number(item.igstPercent || 0), igstAmount),
        cell(formatCurrency(lineTotal), LAST),
      ],
      qty: Number(item.qty || 0),
      withoutTax,
      sgstAmount,
      cgstAmount,
      igstAmount,
      lineTotal,
    };
  });

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalWithoutTax = rows.reduce((sum, row) => sum + row.withoutTax, 0);
  const totalSgst = rows.reduce((sum, row) => sum + row.sgstAmount, 0);
  const totalCgst = rows.reduce((sum, row) => sum + row.cgstAmount, 0);
  const totalIgst = rows.reduce((sum, row) => sum + row.igstAmount, 0);
  const totalLine = totalWithoutTax + totalSgst + totalCgst + totalIgst;

  return {
    heading: "Quotation",
    farmerName: quotation.farmer || "",
    village: quotation.village || "-",
    phone: quotation.phone || "-",
    middleTitle: "Farm Details",
    middleLines: [
      { label: "Crop", value: quotation.crop || "-" },
      { label: "Acre", value: quotation.acre || "-" },
      { label: "Place of Supply", value: quotation.placeOfSupply || "-" },
    ],
    sideTitle: "Quotation Details",
    sideLines: [
      { label: "Quotation No", value: quotation.quotationNo },
      { label: "Date", value: formatDate(quotation.date) },
    ],
    headers: [
      head("S.No", `w-[4%] ${H_SPAN}`, 2),
      head("Product", `w-[16%] ${H_LEFT}`, 2),
      head("Pkg Size", `w-[8%] ${H_SPAN}`, 2),
      head("Qty", `w-[5%] ${H_SPAN}`, 2),
      head("Rate", `w-[8%] ${H_RIGHT}`, 2),
      head("Without Tax", `w-[9%] ${H_RIGHT}`, 2),
      taxHeaders("SGST", "11%"),
      taxHeaders("CGST", "11%"),
      taxHeaders("IGST", "11%"),
      head("Line Total", "w-[17%] px-2 py-2 text-right whitespace-nowrap", 2),
    ],
    subHeaders: [...taxSubs(), ...taxSubs(), ...taxSubs()],
    colWidths: [
      "4%", "16%", "8%", "5%", "8%", "9%",
      "3%", "8%", "3%", "8%", "3%", "8%",
      "17%",
    ],
    rows: rows.map(({ id, cells }) => ({ id, cells })),
    totalCells: [
      cell("Total", "border-r border-slate-300 px-2 py-2 text-center", 3),
      cell(String(totalQty), SPAN),
      cell("", RIGHT),
      cell(formatCurrency(totalWithoutTax), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalSgst), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalCgst), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalIgst), RIGHT),
      cell(formatCurrency(totalLine), "px-2 py-2 text-right"),
    ],
    columnCount: 13,
    withoutTax: Number(quotation.withoutTax || 0),
    sgst: Number(quotation.sgst || 0),
    cgst: Number(quotation.cgst || 0),
    igst: Number(quotation.igst || 0),
    roundOff: Number(quotation.roundOff || 0),
    grandTotal: Number(quotation.amount || 0),
    defaultNotes:
      notes.trim() ||
      `Purchase order raised by ${quotation.placeOfSupply ?? "this store"} to Nature Biotic.`,
  };
}

export type InvoiceDocumentLine = {
  id: string;
  productName?: string;
  hsn?: string;
  pkgSize?: string;
  batchNo?: string;
  expiryDate?: string;
  quantity?: number;
  rate?: number;
  discount?: number;
  taxable?: number;
  taxPercent?: number;
  taxAmount?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  lineTotal?: number;
};

export type InvoiceDocumentInput = {
  invoiceNo: string;
  date: string;
  farmerName: string;
  village: string;
  phone: string;
  address?: string;
  through?: string;
  executiveName?: string;
  placeOfSupply?: string;
  notes?: string;
  withoutTax?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  amount?: number;
  lines: InvoiceDocumentLine[];
  issuer?: CommonDocumentData["issuer"];
  payment?: CommonDocumentData["payment"];
};

function splitTax(line: InvoiceDocumentLine) {
  const taxable = Number(line.taxable || 0);
  const storedSgst = Number(line.sgst || 0);
  const storedCgst = Number(line.cgst || 0);
  const storedIgst = Number(line.igst || 0);
  const stored = storedSgst + storedCgst + storedIgst;
  const taxAmount = stored > 0 ? stored : Number(line.taxAmount || 0);
  const sgst = stored > 0 ? storedSgst : taxAmount / 2;
  const cgst = stored > 0 ? storedCgst : taxAmount / 2;
  const igst = stored > 0 ? storedIgst : 0;
  const percent = Number(line.taxPercent || 0);
  const sgstPercent = taxable > 0 && sgst > 0 ? (sgst / taxable) * 100 : percent / 2;
  const cgstPercent = taxable > 0 && cgst > 0 ? (cgst / taxable) * 100 : percent / 2;
  const igstPercent = taxable > 0 && igst > 0 ? (igst / taxable) * 100 : 0;
  return { taxable, sgst, cgst, igst, sgstPercent, cgstPercent, igstPercent };
}

function invoiceStyleTable(
  lines: InvoiceDocumentLine[],
  options: { includeExpiry: boolean; rateLabel: string; totalLabel: string },
) {
  const rows = lines.map((line, index) => {
    const tax = splitTax(line);
    const cells = [
      cell(String(index + 1), SPAN),
      cell(shown(line.productName), LEFT),
      cell(shown(line.hsn), SPAN),
      cell(shown(line.pkgSize), SPAN),
      cell(shown(line.batchNo), SPAN),
    ];
    if (options.includeExpiry) cells.push(cell(shown(line.expiryDate), SPAN));
    cells.push(
      cell(String(line.quantity ?? ""), "border-r border-slate-300 px-2 py-2 text-center font-semibold"),
      cell(formatCurrency(Number(line.rate || 0)), RIGHT),
      cell(formatCurrency(Number(line.discount || 0)), RIGHT),
      cell(formatCurrency(tax.taxable), RIGHT),
      ...taxCells(tax.cgstPercent, tax.cgst),
      ...taxCells(tax.sgstPercent, tax.sgst),
      ...taxCells(tax.igstPercent, tax.igst),
      cell(formatCurrency(Number(line.lineTotal || 0)), LAST),
    );
    return { id: line.id || `line-${index}`, cells, qty: Number(line.quantity || 0), tax };
  });

  const headers = [
    head("S.No", "w-[3.5%] border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap", 2),
    head("Product", `${options.includeExpiry ? "w-[9.5%]" : "w-[16%]"} border-r border-slate-300 px-1 py-2 text-left whitespace-nowrap`, 2),
    head("HSN", "w-[5.5%] border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap", 2),
    head("Pkg Size", "w-[6%] border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap", 2),
    head("Batch", "w-[6.5%] border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap", 2),
  ];
  if (options.includeExpiry) {
    headers.push(head("Expiry", "w-[6.5%] border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap", 2));
  }
  headers.push(
    head("Qty", "w-[4%] border-r border-slate-300 px-1 py-2 text-center whitespace-nowrap", 2),
    head(options.rateLabel, "w-[6.5%] border-r border-slate-300 px-1 py-2 text-right whitespace-nowrap", 2),
    head("Discount", "w-[6%] border-r border-slate-300 px-1 py-2 text-right whitespace-nowrap", 2),
    head("Taxable", "w-[6.5%] border-r border-slate-300 px-1 py-2 text-right whitespace-nowrap", 2),
    taxHeaders("CGST", "10.5%"),
    taxHeaders("SGST", "10.5%"),
    taxHeaders("IGST", "10.5%"),
    head(options.totalLabel, "w-[8%] px-1 py-2 text-right whitespace-nowrap", 2),
  );
  const colWidths = options.includeExpiry
    ? [
        "3.5%", "9.5%", "5.5%", "6%", "6.5%", "6.5%",
        "4%", "6.5%", "6%", "6.5%",
        "3.2%", "7.3%", "3.2%", "7.3%", "3.2%", "7.3%",
        "8%",
      ]
    : [
        "3.5%", "16%", "5.5%", "6%", "6.5%",
        "4%", "6.5%", "6%", "6.5%",
        "3.2%", "7.3%", "3.2%", "7.3%", "3.2%", "7.3%",
        "8%",
      ];

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalDiscount = lines.reduce((sum, line) => sum + Number(line.discount || 0), 0);
  const totalTaxable = rows.reduce((sum, row) => sum + row.tax.taxable, 0);
  const totalCgst = rows.reduce((sum, row) => sum + row.tax.cgst, 0);
  const totalSgst = rows.reduce((sum, row) => sum + row.tax.sgst, 0);
  const totalIgst = rows.reduce((sum, row) => sum + row.tax.igst, 0);
  const totalLine = lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  const leadingSpan = options.includeExpiry ? 6 : 5;

  return {
    headers,
    subHeaders: [...taxSubs(), ...taxSubs(), ...taxSubs()],
    colWidths,
    rows: rows.map(({ id, cells }) => ({ id, cells })),
    totalCells: [
      cell("Total", "border-r border-slate-300 px-2 py-2 text-center", leadingSpan),
      cell(String(totalQty), SPAN),
      cell("", RIGHT),
      cell(formatCurrency(totalDiscount), RIGHT),
      cell(formatCurrency(totalTaxable), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalCgst), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalSgst), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalIgst), RIGHT),
      cell(formatCurrency(totalLine), "px-2 py-2 text-right"),
    ],
    columnCount: rows[0]?.cells.length || headers.reduce((sum, item) => sum + (item.colSpan || 1), 0),
  };
}

const INVOICE_HEAD = "border-r border-slate-300 px-1 py-1 text-center align-middle leading-tight font-bold";
const INVOICE_SUB = "border-r border-slate-300 px-0.5 py-1 text-center align-middle leading-tight font-semibold";

function salesInvoiceTable(lines: InvoiceDocumentLine[]) {
  const rows = lines.map((line, index) => {
    const tax = splitTax(line);
    const quantity = Number(line.quantity || 0);
    const rate = Number(line.rate || 0);
    const beforeDiscount = round2(quantity * rate);
    const discountAmount = Number(line.discount || 0);
    const discountPercent = beforeDiscount > 0 ? (discountAmount / beforeDiscount) * 100 : 0;
    return {
      id: line.id || `line-${index}`,
      cells: [
        cell(String(index + 1), SPAN),
        cell(shown(line.productName), LEFT),
        cell(shown(line.hsn), SPAN),
        cell(shown(line.pkgSize), SPAN),
        cell(shown(line.batchNo), SPAN),
        cell(shown(line.expiryDate ? formatDate(line.expiryDate) : ""), SPAN),
        cell(String(line.quantity ?? ""), "border-r border-slate-300 px-1 py-1 text-center font-semibold whitespace-nowrap"),
        cell(formatCurrency(rate), RIGHT),
        cell(formatCurrency(beforeDiscount), RIGHT),
        cell(discountPercent.toFixed(2), PERCENT),
        cell(formatCurrency(discountAmount), RIGHT),
        cell(formatCurrency(tax.taxable), RIGHT),
        ...taxCells(tax.cgstPercent, tax.cgst),
        ...taxCells(tax.sgstPercent, tax.sgst),
        ...taxCells(tax.igstPercent, tax.igst),
        cell(formatCurrency(Number(line.lineTotal || 0)), LAST),
      ],
      quantity,
      beforeDiscount,
      discountAmount,
      tax,
    };
  });

  const headers = [
    head("S.No", INVOICE_HEAD, 2),
    head("Product", INVOICE_HEAD, 2),
    head("HSN Code", INVOICE_HEAD, 2),
    head("PKG Size", INVOICE_HEAD, 2),
    head("Batch No", INVOICE_HEAD, 2),
    head("Exp Date", INVOICE_HEAD, 2),
    head("Qty", INVOICE_HEAD, 2),
    head("Unit Price", INVOICE_HEAD, 2),
    head("Before Discount", INVOICE_HEAD, 2),
    head("Discount", INVOICE_HEAD, undefined, 2),
    head("Taxable (₹)", INVOICE_HEAD, 2),
    head("CGST (₹)", INVOICE_HEAD, undefined, 2),
    head("SGST (₹)", INVOICE_HEAD, undefined, 2),
    head("IGST (₹)", INVOICE_HEAD, undefined, 2),
    head("Line Total", "px-1 py-1 text-center align-middle leading-tight font-bold", 2),
  ];
  const subHeaders = [
    head("%", INVOICE_SUB),
    head("Amt", INVOICE_SUB),
    head("Rate %", INVOICE_SUB),
    head("Amount", INVOICE_SUB),
    head("Rate %", INVOICE_SUB),
    head("Amount", INVOICE_SUB),
    head("Rate %", INVOICE_SUB),
    head("Amount", "px-0.5 py-1 text-center align-middle leading-tight font-semibold"),
  ];
  const colWidths = [
    "3%", "8.6%", "5.2%", "5%", "6%", "6%",
    "3.2%", "6%", "6.6%",
    "3.4%", "6%",
    "6.2%",
    "3.4%", "6%",
    "3.4%", "6%",
    "3.4%", "6%",
    "6.6%",
  ];
  const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalBefore = rows.reduce((sum, row) => sum + row.beforeDiscount, 0);
  const totalDiscount = rows.reduce((sum, row) => sum + row.discountAmount, 0);
  const totalTaxable = rows.reduce((sum, row) => sum + row.tax.taxable, 0);
  const totalCgst = rows.reduce((sum, row) => sum + row.tax.cgst, 0);
  const totalSgst = rows.reduce((sum, row) => sum + row.tax.sgst, 0);
  const totalIgst = rows.reduce((sum, row) => sum + row.tax.igst, 0);
  const totalLine = lines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);

  return {
    headers,
    subHeaders,
    colWidths,
    rows: rows.map(({ id, cells }) => ({ id, cells })),
    totalCells: [
      cell("Total", "border-r border-slate-300 px-1 py-1 text-center", 6),
      cell(String(totalQty), SPAN),
      cell("", RIGHT),
      cell(formatCurrency(totalBefore), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalDiscount), RIGHT),
      cell(formatCurrency(totalTaxable), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalCgst), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalSgst), RIGHT),
      cell("", PERCENT),
      cell(formatCurrency(totalIgst), RIGHT),
      cell(formatCurrency(totalLine), "px-1 py-1 text-right"),
    ],
    columnCount: 19,
  };
}

export function invoicePaymentQrUrl(input: {
  upiId: string;
  accountName: string;
  amount: number;
  invoiceNo: string;
}) {
  const upiId = input.upiId.trim();
  if (!upiId.includes("@")) return "";
  const payload = `upi://pay?pa=${upiId}&pn=${input.accountName.trim() || "Nature Biotic"}&am=${Number(input.amount || 0).toFixed(2)}&cu=INR&tn=Invoice ${input.invoiceNo}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payload)}`;
}

export function salesInvoiceToDocument(input: InvoiceDocumentInput): CommonDocumentData {
  const table = salesInvoiceTable(input.lines);
  const withoutTax = Number(input.withoutTax || 0);
  const sgst = Number(input.sgst || 0);
  const cgst = Number(input.cgst || 0);
  const igst = Number(input.igst || 0);
  const grandTotal = Number(input.amount || 0);
  const roundOff = round2(grandTotal - (withoutTax + sgst + cgst + igst));
  return {
    kind: "invoice",
    heading: "Tax Invoice",
    farmerTitle: "Billing Address",
    farmerName: input.farmerName,
    village: shown(input.village),
    phone: shown(input.phone),
    issuer: input.issuer,
    payment: input.payment,
    middleTitle: "Delivery Address",
    middleLines: [
      { label: "Address", value: shown(input.address) },
      { label: "Village", value: shown(input.village) },
      { label: "Contact", value: shown(input.phone) },
    ],
    sideTitle: "Invoice Details",
    sideLines: [
      { label: "Invoice No", value: input.invoiceNo },
      { label: "Date", value: formatDate(input.date) },
      { label: "Through", value: shown(input.through) },
      { label: "Executive", value: shown(input.executiveName) },
      { label: "Place of Supply", value: shown(input.placeOfSupply) },
    ],
    ...table,
    withoutTax,
    sgst,
    cgst,
    igst,
    roundOff,
    grandTotal,
    defaultNotes: input.notes?.trim() || "-",
  };
}

export type ReturnDocumentInput = {
  returnNo: string;
  date: string;
  invoiceNo: string;
  farmerName: string;
  village: string;
  phone: string;
  address?: string;
  through?: string;
  executiveName?: string;
  notes?: string;
  withoutTax?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total?: number;
  lines: InvoiceDocumentLine[];
};

export function salesReturnToDocument(input: ReturnDocumentInput): CommonDocumentData {
  const table = invoiceStyleTable(input.lines, {
    includeExpiry: false,
    rateLabel: "Rate",
    totalLabel: "Total",
  });
  const withoutTax = Number(input.withoutTax || 0);
  const sgst = Number(input.sgst || 0);
  const cgst = Number(input.cgst || 0);
  const igst = Number(input.igst || 0);
  const grandTotal = Number(input.total || 0);
  const roundOff = round2(grandTotal - (withoutTax + sgst + cgst + igst));
  return {
    heading: "Sales Return",
    farmerName: input.farmerName,
    village: shown(input.village),
    phone: shown(input.phone),
    middleTitle: "Original Invoice",
    middleLines: [
      { label: "Against Invoice", value: shown(input.invoiceNo) },
      { label: "Through", value: shown(input.through) },
      { label: "Executive", value: shown(input.executiveName) },
      { label: "Address", value: shown(input.address) },
    ],
    sideTitle: "Return Details",
    sideLines: [
      { label: "Return No", value: input.returnNo },
      { label: "Date", value: formatDate(input.date) },
    ],
    ...table,
    withoutTax,
    sgst,
    cgst,
    igst,
    roundOff,
    grandTotal,
    defaultNotes: input.notes?.trim() || "-",
  };
}
