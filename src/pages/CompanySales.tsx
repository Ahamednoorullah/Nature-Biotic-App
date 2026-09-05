import { useState, useMemo, useEffect } from "react";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  EmptyState,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  stores,
  getProductMaster,
  productMasterUpdatedEvent,
  type Product,
} from "@/lib/data";
import { createPortal } from "react-dom";

import {
  getCompanyStoreSales,
  saveCompanyStoreSales,
  type CompanyStoreSaleRecord,
} from "@/lib/data";

type TaxType = "Tamilnadu (SGST + CGST)" | "Others (IGST)";

type SaleRow = CompanyStoreSaleRecord & {
  discount?: number;
  pkgsize?: string;
  batchNo?: string;
  expiryDate?: string;
  hsn?: string;
  taxPercent?: number;
  discountPercent?: number;
};

type AddedRow = {
  key: string;
  productId: string;
  pkgsize: string;
  product?: Product;
  batchNo: string;
  expiryDate: string;
  packSize: string;
  hsn: string;
  mrp: number;
  taxType: TaxType;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  rowTotal: number;
};

type EntryForm = {
  productId: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discountPercent: number;
};

const taxTypes: TaxType[] = ["Tamilnadu (SGST + CGST)", "Others (IGST)"];

const PAYMENT_BANK = {
  accountName: "SAIRAM AGRI INPUTS",
  accountNo: "50200106535019",
  ifsc: "HDFC0000775",
  bankName: "HDFC Bank",
  branch: "Rajapalayam",
  upiId: "sujiyaso22-1@okhdfcbank",
};

function buildPaymentQrUrl(amount: number, invoiceNo: string) {
  const payableAmount = Math.max(0, Math.round(amount));
  const upiPayload =
    `upi://pay?pa=${encodeURIComponent(PAYMENT_BANK.upiId)}` +
    `&pn=${encodeURIComponent(PAYMENT_BANK.accountName)}` +
    `&am=${payableAmount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Invoice ${invoiceNo}`)}`;

  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
    upiPayload,
  )}`;
}


function computeAdded(
  r: Omit<AddedRow, "key" | "discountAmount" | "taxAmount" | "rowTotal">,
): AddedRow {
  const gross = r.quantity * r.sellingPrice;
  const safeDiscountPercent = Math.min(
    100,
    Math.max(0, Number(r.discountPercent) || 0),
  );
  const discountAmount =
    Math.round(gross * (safeDiscountPercent / 100) * 100) / 100;
  const afterDiscount = Math.max(0, gross - discountAmount);
  const taxAmount =
    Math.round(afterDiscount * (r.taxPercent / 100) * 100) / 100;
  const rowTotal = Math.round((afterDiscount + taxAmount) * 100) / 100;

  return {
    ...r,
    discountPercent: safeDiscountPercent,
    discountAmount,
    key: Math.random().toString(36).slice(2),
    taxAmount,
    rowTotal,
  };
}

function emptyEntry(): EntryForm {
  return {
    productId: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    sellingPrice: 0,
    discountPercent: 0,
    pkgsize: "",
  };
}

function InvoiceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-800">{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-400 font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700 truncate">{value}</p>
    </div>
  );
}

function numberToWords(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    }
    if (n < 1000) {
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + convert(n % 100) : "")
      );
    }
    if (n < 100000) {
      return (
        convert(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 ? " " + convert(n % 1000) : "")
      );
    }
    if (n < 10000000) {
      return (
        convert(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 ? " " + convert(n % 100000) : "")
      );
    }

    return (
      convert(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 ? " " + convert(n % 10000000) : "")
    );
  }

  const rounded = Math.round(Number(num) || 0);

  if (rounded === 0) return "Zero Rupees Only";

  return `${convert(rounded)} Rupees Only`;
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-400 text-xs" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${muted ? "text-slate-500 text-xs" : "font-semibold text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function CompanySales() {
  const [sales, setSales] = useState<SaleRow[]>(() => getCompanyStoreSales());
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    invoiceNo: string;
    header: SaleRow;
    rows: SaleRow[];
  } | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingInvoiceNo, setEditingInvoiceNo] = useState<string | null>(null);
  const [purchaseStatuses, setPurchaseStatuses] = useState<
    Record<string, "Dispatched" | "Received">
  >(() => {
    try {
      const raw = localStorage.getItem(
        "nature-biotic-store-purchase-status-v1",
      );
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [storeId, setStoreId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [added, setAdded] = useState<AddedRow[]>([]);
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");
  const [productMaster, setProductMaster] = useState<Product[]>(() =>
    getProductMaster(),
  );

  const selectedStore = stores.find((s) => s.id === storeId);
  const entryProduct = productMaster.find((p) => p.id === entry.productId);

  const productChoices = useMemo(() => {
    const byName = new Map<string, Product>();

    productMaster
      .filter((product) => product.status !== "Inactive")
      .forEach((product) => {
        if (!byName.has(product.name)) byName.set(product.name, product);
      });

    return Array.from(byName.values());
  }, [productMaster]);

  const selectedProductVariants = useMemo(() => {
    if (!entryProduct) return [];

    return productMaster.filter(
      (product) =>
        product.name === entryProduct.name &&
        product.unit === entryProduct.unit &&
        product.status !== "Inactive",
    );
  }, [productMaster, entryProduct]);

  // Lock background scroll while the form is open
  useEffect(() => {
    if (showCreate) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showCreate]);

  useEffect(() => {
    const refreshProductMaster = () => {
      setProductMaster(getProductMaster());
    };

    window.addEventListener(productMasterUpdatedEvent, refreshProductMaster);
    window.addEventListener("focus", refreshProductMaster);

    return () => {
      window.removeEventListener(
        productMasterUpdatedEvent,
        refreshProductMaster,
      );
      window.removeEventListener("focus", refreshProductMaster);
    };
  }, []);

  useEffect(() => {
    const refreshPurchaseStatuses = () => {
      try {
        const raw = localStorage.getItem(
          "nature-biotic-store-purchase-status-v1",
        );
        setPurchaseStatuses(raw ? JSON.parse(raw) : {});
      } catch {
        setPurchaseStatuses({});
      }
    };

    window.addEventListener("focus", refreshPurchaseStatuses);
    window.addEventListener(
      "store-purchase-status-updated",
      refreshPurchaseStatuses,
    );

    return () => {
      window.removeEventListener("focus", refreshPurchaseStatuses);
      window.removeEventListener(
        "store-purchase-status-updated",
        refreshPurchaseStatuses,
      );
    };
  }, []);

  const filtered = useMemo(() => {
    const today = new Date();
    const normalize = (value: string) => new Date(`${value}T00:00:00`);

    const isWithinDateFilter = (dateValue: string) => {
      const rowDate = normalize(dateValue);

      if (dateFilter === "all") return true;

      if (dateFilter === "today") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowDate.getMonth() === today.getMonth() &&
          rowDate.getDate() === today.getDate()
        );
      }

      if (dateFilter === "monthly") {
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowDate.getMonth() === today.getMonth()
        );
      }

      if (dateFilter === "quarterly") {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const rowQuarter = Math.floor(rowDate.getMonth() / 3);

        return (
          rowDate.getFullYear() === today.getFullYear() &&
          rowQuarter === currentQuarter
        );
      }

      if (dateFilter === "yearly") {
        return rowDate.getFullYear() === today.getFullYear();
      }

      if (dateFilter === "custom") {
        if (!customFrom && !customTo) return true;

        const fromDate = customFrom ? normalize(customFrom) : null;
        const toDate = customTo ? normalize(customTo) : null;

        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate > toDate) return false;

        return true;
      }

      return true;
    };

    return sales.filter((s) => {
      const matchesSearch =
        s.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
        s.storeName.toLowerCase().includes(search.toLowerCase()) ||
        s.product.toLowerCase().includes(search.toLowerCase());

      const matchesStore = storeFilter === "all" || s.storeId === storeFilter;

      return matchesSearch && matchesStore && isWithinDateFilter(s.date);
    });
  }, [sales, search, storeFilter, dateFilter, customFrom, customTo]);


  const invoiceSummaryRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        header: SaleRow;
        rows: SaleRow[];
        withoutTax: number;
        sgst: number;
        cgst: number;
        igst: number;
        taxAmount: number;
        total: number;
      }
    >();

    filtered.forEach((row) => {
      const key = `${row.invoiceNo}__${row.storeId}__${row.date}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.rows.push(row);
        existing.withoutTax += Number(row.withoutTax || 0);
        existing.sgst += Number(row.sgst || 0);
        existing.cgst += Number(row.cgst || 0);
        existing.igst += Number(row.igst || 0);
        existing.taxAmount += Number(row.taxAmount || 0);
        existing.total += Number(row.total || 0);
      } else {
        grouped.set(key, {
          header: row,
          rows: [row],
          withoutTax: Number(row.withoutTax || 0),
          sgst: Number(row.sgst || 0),
          cgst: Number(row.cgst || 0),
          igst: Number(row.igst || 0),
          taxAmount: Number(row.taxAmount || 0),
          total: Number(row.total || 0),
        });
      }
    });

    return Array.from(grouped.values());
  }, [filtered]);

  const totals = useMemo(() => {
    const subtotal = added.reduce((s, r) => s + r.quantity * r.sellingPrice, 0);
    const totalDiscount = added.reduce((s, r) => s + r.discountAmount, 0);
    const totalTax = added.reduce((s, r) => s + r.taxAmount, 0);
    const sgst = added.reduce(
      (s, r) =>
        s + (r.taxType === "Tamilnadu (SGST + CGST)" ? r.taxAmount / 2 : 0),
      0,
    );
    const cgst = added.reduce(
      (s, r) =>
        s + (r.taxType === "Tamilnadu (SGST + CGST)" ? r.taxAmount / 2 : 0),
      0,
    );
    const igst = added.reduce(
      (s, r) => s + (r.taxType === "Others (IGST)" ? r.taxAmount : 0),
      0,
    );
    const grandTotal = added.reduce((s, r) => s + r.rowTotal, 0);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [added]);

  function selectProduct(productId: string) {
    const product = productMaster.find((p) => p.id === productId);

    if (!product) {
      setEntry((prev) => ({
        ...prev,
        productId: "",
        pkgsize: "",
        sellingPrice: 0,
      }));
      return;
    }

    const variants = productMaster.filter(
      (item) =>
        item.name === product.name &&
        item.unit === product.unit &&
        item.status !== "Inactive",
    );

    const firstVariant = variants[0] || product;

    setEntry((prev) => ({
      ...prev,
      productId: firstVariant.id,
      pkgsize: firstVariant.size,
      sellingPrice: firstVariant.sellingPrice,
    }));
  }

  function selectPackSize(size: string) {
    if (!entryProduct) return;

    const variant = productMaster.find(
      (item) =>
        item.name === entryProduct.name &&
        item.unit === entryProduct.unit &&
        item.size === size &&
        item.status !== "Inactive",
    );

    setEntry((prev) => ({
      ...prev,
      productId: variant?.id || prev.productId,
      pkgsize: size,
      sellingPrice: variant?.sellingPrice ?? prev.sellingPrice,
    }));
  }

  function addProduct() {
    if (
      !entry.productId ||
      !entry.pkgsize ||
      !entry.batchNo ||
      !entry.expiryDate ||
      entry.quantity < 1
    ) {
      return;
    }

    const product = productMaster.find((p) => p.id === entry.productId);

    if (!product) return;

    // Place of Supply decides the tax type
    const taxType: TaxType =
      placeOfSupply === "Tamil Nadu"
        ? "Tamilnadu (SGST + CGST)"
        : "Others (IGST)";

    const newRow = computeAdded({
      productId: entry.productId,
      product,
      pkgsize: entry.pkgsize,
      batchNo: entry.batchNo,
      expiryDate: entry.expiryDate,
      packSize: product.size,
      hsn: product.hsnCode || "",
      mrp: product.mrp || 0,
      taxType,
      taxPercent: product.taxPercentage || 0,
      quantity: entry.quantity,
      sellingPrice: entry.sellingPrice,
      discountPercent: entry.discountPercent,
    });

    setAdded((prev) => [...prev, newRow]);
    setEntry(emptyEntry());
  }

  function updateAdded(key: string, patch: Partial<AddedRow>) {
    setAdded((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const merged = { ...r, ...patch };
        const {
          key: _key,
          discountAmount: _discountAmount,
          taxAmount: _taxAmount,
          rowTotal: _rowTotal,
          ...recalculable
        } = merged;
        return computeAdded(recalculable);
      }),
    );
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((r) => r.key !== key));
  }

  function openInvoice(row: SaleRow) {
    const invoiceRows = sales.filter(
      (item) =>
        item.invoiceNo === row.invoiceNo &&
        item.storeId === row.storeId &&
        item.date === row.date,
    );

    setSelectedInvoice({
      invoiceNo: row.invoiceNo,
      header: row,
      rows: invoiceRows.length > 0 ? invoiceRows : [row],
    });
  }

  function invoiceIsLocked(invoiceNo: string) {
    return purchaseStatuses[invoiceNo] === "Received";
  }

  function buildFormRows(): SaleRow[] | null {
    if (!storeId || !invoiceNo || added.length === 0) return null;

    const store = stores.find((s) => s.id === storeId);
    if (!store) return null;

    return added.map((r, i) => {
      const withoutTax = Math.max(
        0,
        r.quantity * r.sellingPrice - r.discountAmount,
      );
      const taxAmount =
        Math.round(withoutTax * (r.taxPercent / 100) * 100) / 100;
      const isTamilNadu = placeOfSupply === "Tamil Nadu";
      const sgst = isTamilNadu ? Math.round((taxAmount / 2) * 100) / 100 : 0;
      const cgst = isTamilNadu ? Math.round((taxAmount / 2) * 100) / 100 : 0;
      const igst = !isTamilNadu ? taxAmount : 0;

      return {
        id: `preview-${i}`,
        invoiceNo,
        date: saleDate,
        storeId: store.id,
        storeName: store.name,
        storeLocation: store.location,
        placeOfSupply,
        product: r.product?.name || "",
        packSize: r.packSize,
        pkgsize: r.pkgsize,
        batchNo: r.batchNo,
        expiryDate: r.expiryDate,
        hsn: r.hsn,
        taxPercent: r.taxPercent,
        quantity: r.quantity,
        rate: r.sellingPrice,
        unitPrice: r.sellingPrice,
        beforeDiscount: r.quantity * r.sellingPrice,
        price: r.sellingPrice,
        discount: r.discountAmount,
        discountPercent: r.discountPercent,
        discountAmount: r.discountAmount,
        withoutTax,
        taxableAmount: withoutTax,
        taxAmount,
        sgst,
        cgst,
        igst,
        total: Math.round((withoutTax + taxAmount) * 100) / 100,
        returnAmount: 0,
      };
    });
  }

  function handlePreview() {
    if (!canCreate) return;

    const previewRows = buildFormRows();
    if (!previewRows?.length) return;

    setSelectedInvoice({
      invoiceNo: previewRows[0].invoiceNo,
      header: previewRows[0],
      rows: previewRows,
    });
    setIsPreviewMode(true);
    setShowCreate(false);
  }

  function closeInvoiceView() {
    setSelectedInvoice(null);

    if (isPreviewMode) {
      setIsPreviewMode(false);
      setShowCreate(true);
    }
  }

  function openEditInvoice(invoice: { header: SaleRow; rows: SaleRow[] }) {
    if (invoiceIsLocked(invoice.header.invoiceNo)) return;

    const header = invoice.header;

    setEditingInvoiceNo(header.invoiceNo);
    setInvoiceNo(header.invoiceNo);
    setSaleDate(header.date);
    setStoreId(header.storeId);
    setPlaceOfSupply(header.placeOfSupply || "Tamil Nadu");

    const nextAdded: AddedRow[] = invoice.rows.map((row, index) => {
      const product = productMaster.find((p) => p.name === row.product);
      const taxType: TaxType =
        (row.placeOfSupply || "Tamil Nadu") === "Tamil Nadu"
          ? "Tamilnadu (SGST + CGST)"
          : "Others (IGST)";

      return {
        key: `edit-${index}-${Date.now()}`,
        productId: product?.id || "",
        pkgsize: row.pkgsize || row.packSize || product?.size || "",
        product,
        batchNo: row.batchNo || "",
        expiryDate: row.expiryDate || "",
        packSize: row.packSize || product?.size || "",
        hsn: row.hsn || product?.hsnCode || "",
        mrp: product?.mrp || 0,
        taxType,
        taxPercent:
          row.taxPercent ??
          product?.taxPercentage ??
          (row.withoutTax > 0
            ? Math.round((row.taxAmount / row.withoutTax) * 10000) / 100
            : 0),
        quantity: row.quantity,
        sellingPrice: row.rate,
        discountPercent:
          row.discountPercent ??
          (row.quantity * row.rate > 0
            ? (Number(row.discount || 0) / (row.quantity * row.rate)) * 100
            : 0),
        discountAmount: Number(row.discount || 0),
        taxAmount: row.taxAmount,
        rowTotal: row.total,
      };
    });

    setAdded(nextAdded);
    setRemarks("");
    setSelectedInvoice(null);
    setIsPreviewMode(false);
    setShowCreate(true);
  }

  function resetForm() {
    setInvoiceNo("");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setStoreId("");
    setRemarks("");
    setEntry(emptyEntry());
    setAdded([]);
    setEditingInvoiceNo(null);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function handleSaveDraft() {
    // Draft save: keep form open, no-op persistence in this demo
  }

  function handleCreate() {
    if (!canCreate) return;

    if (editingInvoiceNo && invoiceIsLocked(editingInvoiceNo)) {
      window.alert(
        "This invoice has already been received by the store and can no longer be edited.",
      );
      return;
    }

    const builtRows = buildFormRows();
    if (!builtRows?.length) return;

    const newRows: SaleRow[] = builtRows.map((row, i) => ({
      ...row,
      id: editingInvoiceNo
        ? `${editingInvoiceNo}-edit-${Date.now()}-${i}`
        : `s${sales.length + i}-${Date.now()}`,
    }));

    const remainingSales = editingInvoiceNo
      ? sales.filter((row) => row.invoiceNo !== editingInvoiceNo)
      : sales;

    const nextSales = [...newRows, ...remainingSales];
    setSales(nextSales);
    saveCompanyStoreSales(nextSales);

    resetForm();
    setShowCreate(false);
  }

  const canAdd =
    !!entry.productId &&
    !!entry.pkgsize &&
    !!entry.batchNo &&
    !!entry.expiryDate &&
    entry.quantity >= 1;
  const canCreate = !!storeId && !!invoiceNo && added.length > 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Sales
          </h1>
          <p className="text-slate-500 mt-1">
            Nature Biotic to Store sales records.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <Icon name="add" size={20} fill /> Create Invoice
        </Button>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-end xl:gap-2">
          <div className="w-full xl:w-[245px] xl:shrink-0">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by invoice, store, product..."
              icon="search"
            />
          </div>

          <div className="w-full xl:w-[175px] xl:shrink-0">
            <Select
              label="Store"
              value={storeFilter}
              onChange={setStoreFilter}
              placeholder="All Stores"
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div className="w-full xl:w-[155px] xl:shrink-0">
            <Select
              label="Date Filter"
              value={dateFilter}
              onChange={(value) =>
                setDateFilter(
                  value as
                    | "all"
                    | "today"
                    | "monthly"
                    | "quarterly"
                    | "yearly"
                    | "custom",
                )
              }
              options={[
                { value: "all", label: "All Dates" },
                { value: "today", label: "Today" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
                { value: "custom", label: "Custom Date" },
              ]}
            />
          </div>

          {dateFilter === "custom" && (
            <>
              <div className="w-full xl:w-[140px] xl:shrink-0">
                <Input
                  label="From"
                  type="date"
                  value={customFrom}
                  onChange={setCustomFrom}
                />
              </div>

              <div className="w-full xl:w-[140px] xl:shrink-0">
                <Input
                  label="To"
                  type="date"
                  value={customTo}
                  onChange={setCustomTo}
                />
              </div>
            </>
          )}

          {(storeFilter !== "all" ||
            dateFilter !== "all" ||
            customFrom ||
            customTo ||
            search) && (
            <Button
              variant="secondary"
              className="xl:shrink-0"
              onClick={() => {
                setSearch("");
                setStoreFilter("all");
                setDateFilter("all");
                setCustomFrom("");
                setCustomTo("");
              }}
            >
              <Icon name="filter_alt_off" size={17} />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {invoiceSummaryRows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="point_of_sale"
            title="No sales found"
            description="Adjust filters or create a new sale."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-y-auto max-h-[600px]">
            <table className="w-full table-fixed border-collapse text-[11px] xl:text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                  <th
                    rowSpan={2}
                    className="w-[5%] border-r border-slate-200 px-1 py-3 text-center font-semibold"
                  >
                    S.No
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[8%] border-r border-slate-200 px-1 py-3 text-center font-semibold"
                  >
                    Date
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[11%] border-r border-slate-200 px-1 py-3 text-center font-semibold"
                  >
                    Invoice No
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[17%] border-r border-slate-200 px-1 py-3 text-center font-semibold"
                  >
                    Store Name
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[11%] border-r border-slate-200 px-1 py-3 text-center font-semibold"
                  >
                    Without Tax
                  </th>

                  <th
                    colSpan={2}
                    className="w-[14%] border-r border-slate-200 px-1 py-2 text-center font-semibold"
                  >
                    SGST
                  </th>

                  <th
                    colSpan={2}
                    className="w-[14%] border-r border-slate-200 px-1 py-2 text-center font-semibold"
                  >
                    CGST
                  </th>

                  <th
                    colSpan={2}
                    className="w-[14%] border-r border-slate-200 px-1 py-2 text-center font-semibold"
                  >
                    IGST
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[12%] px-1 py-3 text-center font-semibold"
                  >
                    Total
                  </th>
                </tr>

                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500">
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    %
                  </th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    Amt
                  </th>

                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    %
                  </th>
                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    Amt
                  </th>

                  <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">
                    %
                  </th>
                  <th className="border-r border-slate-200 px-1 py-2 text-center font-semibold">
                    Amt
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoiceSummaryRows.map((invoice, i) => {
                  const s = invoice.header;
                  const totalTaxRate =
                    invoice.withoutTax > 0
                      ? (invoice.taxAmount / invoice.withoutTax) * 100
                      : 0;

                  const sgstRate =
                    invoice.sgst > 0 ? totalTaxRate / 2 : 0;
                  const cgstRate =
                    invoice.cgst > 0 ? totalTaxRate / 2 : 0;
                  const igstRate =
                    invoice.igst > 0 ? totalTaxRate : 0;

                  return (
                    <tr
                      key={`${s.invoiceNo}-${s.storeId}-${s.date}`}
                      onClick={() =>
                        setSelectedInvoice({
                          invoiceNo: s.invoiceNo,
                          header: s,
                          rows: invoice.rows,
                        })
                      }
                      title="Click to view invoice"
                      className={`cursor-pointer border-b border-slate-100 ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      } hover:bg-brand-50/40 transition-base`}
                    >
                      <td className="px-1.5 py-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                        {i + 1}
                      </td>

                      <td className="px-1.5 py-3 text-center text-slate-500 border-r border-slate-100 whitespace-nowrap">
                        {formatDate(s.date)}
                      </td>

                      <td className="px-1.5 py-3 text-center font-semibold text-slate-800 border-r border-slate-100 truncate">
                        {s.invoiceNo}
                      </td>

                      <td className="px-1.5 py-3 text-center text-slate-700 border-r border-slate-100 truncate">
                        {s.storeName}
                      </td>

                      <td className="px-1.5 py-3 text-right tabular-nums font-semibold text-slate-700 border-r border-slate-100">
                        {formatCurrency(invoice.withoutTax)}
                      </td>

                      <td className="px-1 py-3 text-center tabular-nums text-slate-600 border-r border-slate-100">
                        {sgstRate.toFixed(2)}%
                      </td>
                      <td className="px-1 py-3 text-right tabular-nums text-slate-600 border-r border-slate-100">
                        {formatCurrency(invoice.sgst)}
                      </td>

                      <td className="px-1 py-3 text-center tabular-nums text-slate-600 border-r border-slate-100">
                        {cgstRate.toFixed(2)}%
                      </td>
                      <td className="px-1 py-3 text-right tabular-nums text-slate-600 border-r border-slate-100">
                        {formatCurrency(invoice.cgst)}
                      </td>

                      <td className="px-1 py-3 text-center tabular-nums text-slate-600 border-r border-slate-100">
                        {igstRate.toFixed(2)}%
                      </td>
                      <td className="px-1 py-3 text-right tabular-nums text-slate-600 border-r border-slate-100">
                        {formatCurrency(invoice.igst)}
                      </td>

                      <td className="px-1.5 py-3 text-right tabular-nums font-bold text-slate-800 border-r border-slate-100">
                        {formatCurrency(invoice.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedInvoice &&
        createPortal(
          <div className="invoice-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
  @media print {
    @page {
      size: A4 landscape;
      margin: 6mm;
    }

    html, body {
      width: 297mm;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: visible !important;
    }

    * {
      box-sizing: border-box !important;
    }

    body > *:not(.invoice-modal-backdrop) {
    display: none !important;
    }

    .invoice-print-area,
    .invoice-print-area * {
      visibility: visible !important;
    }

    .invoice-modal-backdrop {
      position: static !important;
      display: block !important;
      background: none !important;
      padding: 0 !important;
      backdrop-filter: none !important;
      height: auto !important;
      width: 100% !important;
    }

    .invoice-print-area {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: #fff !important;
      margin: 0 !important;
      display: block !important;
    }

    .invoice-print-scroll {
      overflow: visible !important;
      padding: 0 !important;
      display: block !important;
      height: auto !important;
    }

    .invoice-print-scroll > div {
      display: block !important;
      height: auto !important;
      overflow: visible !important;
    }

    .invoice-print-table {
      width: 100% !important;
      table-layout: auto !important;
      font-size: 8px !important;
    }

    .invoice-print-table th,
    .invoice-print-table td {
      padding: 2px 3px !important;
      line-height: 1.15 !important;
    }

    .invoice-print-table th:not(:nth-child(2)),
    .invoice-print-table td:not(:nth-child(2)) {
      white-space: nowrap !important;
    }

    .invoice-print-table th:nth-child(2),
    .invoice-print-table td:nth-child(2) {
      white-space: normal !important;
      word-break: break-word !important;
    }

    .invoice-print-header {
      break-inside: avoid !important;
    }

    .invoice-print-footer-block {
      break-inside: avoid !important;
    }

    .invoice-screen-only {
      display: none !important;
    }
  }
`}</style>
            <div className="invoice-print-area flex max-h-[94vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="invoice-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Invoice
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedInvoice.header.invoiceNo}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isPreviewMode ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        Preview
                      </span>
                    ) : invoiceIsLocked(selectedInvoice.header.invoiceNo) ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Store Received · Locked
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        Editable until Store Received
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeInvoiceView}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="invoice-print-scroll min-h-0 flex-1 overflow-y-auto p-3">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="invoice-print-header border-b border-slate-300">
                    <div className="grid grid-cols-[1.2fr_.8fr]">
                      <div className="border-r border-slate-300 p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden bg-white">
                            <img
                              src="/logo_NB.webp"
                              alt="Nature Biotic"
                              className="max-h-14 max-w-full object-contain"
                            />
                          </div>

                          <div className="leading-tight">
                            <h3 className="text-base font-extrabold tracking-wide text-slate-900">
                              NATURE BIOTIC
                            </h3>
                            <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-700">
                              4/130/A1, Velavan Nagar, Velayudhampuram,
                              Rajapalayam, Tamil Nadu - 626102
                            </p>
                            <p className="mt-1 text-[10px] text-slate-600">
                              GSTIN: 33AEZPV5328P1ZC
                            </p>
                            <p className="text-[10px] text-slate-600">
                              Cell: 96008 44446
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center p-3">
                        <div className="text-center">
                          <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                            Tax Invoice
                          </h2>
                          {/*<p className="mt-1 text-[10px] text-slate-500">
                            Nature Biotic to Store
                          </p> */}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 border-t border-slate-300 text-[9px] leading-4">
                      <div className="border-r border-slate-300 p-3">
                        <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                          Billing Address
                        </p>
                        <p className="font-bold text-slate-900">
                          {selectedInvoice.header.storeName}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {selectedStore?.address ||
                            selectedInvoice.header.storeLocation ||
                            "-"}
                        </p>
                        <p className="mt-1 text-slate-600">
                          GSTIN: {selectedStore?.gst || "-"}
                        </p>
                        <p className="text-slate-600">
                          Contact: {selectedStore?.phone || "-"}
                        </p>
                      </div>

                      <div className="border-r border-slate-300 p-3">
                        <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                          Delivery Address
                        </p>
                        <p className="font-bold text-slate-900">
                          {selectedInvoice.header.storeName}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {selectedStore?.address ||
                            selectedInvoice.header.storeLocation ||
                            "-"}
                        </p>
                      </div>

                      <div className="p-3">
                        <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                          Invoice Details
                        </p>

                        <div className="grid grid-cols-[92px_1fr] gap-y-1">
                          <span className="text-slate-500">Invoice No</span>
                          <span className="font-semibold text-slate-800">
                            {selectedInvoice.header.invoiceNo}
                          </span>

                          <span className="text-slate-500">Invoice Date</span>
                          <span className="font-semibold text-slate-800">
                            {formatDate(selectedInvoice.header.date)}
                          </span>

                          <span className="text-slate-500">Store Code</span>
                          <span className="font-semibold text-slate-800">
                            {selectedStore?.code || "-"}
                          </span>

                           <span className="text-slate-500">
                            Place of Supply
                          </span>
                          <span className="font-semibold text-slate-800">
                            {selectedInvoice.header.placeOfSupply || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="invoice-print-table w-full border-collapse text-[8.5px] xl:text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-700">
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            HSN Code
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            PKG Size
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Batch No
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Exp Date
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Qty
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Unit Price
                          </th>
                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Before Discount
                          </th>

                          <th
                            colSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Discount
                          </th>

                          <th
                            rowSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Taxable (₹)
                          </th>

                          <th
                            colSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            CGST
                          </th>

                          <th
                            colSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            SGST (₹)
                          </th>

                          <th
                            colSpan={2}
                            className=" border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            IGST (₹)
                          </th>

                          <th rowSpan={2} className=" px-1 py-1.5 text-center">
                            Line Total
                          </th>
                        </tr>

                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-600">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amt
                          </th>

                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amount
                          </th>

                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amount
                          </th>

                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedInvoice.rows.map((row, index) => {
                          const beforeDiscount =
                            Number(row.quantity || 0) * Number(row.rate || 0);

                          const discountAmount = Number(row.discount || 0);

                          const discountPercent =
                            beforeDiscount > 0
                              ? (discountAmount / beforeDiscount) * 100
                              : 0;

                          const totalTaxRate =
                            row.taxPercent ??
                            (row.withoutTax > 0
                              ? (Number(row.taxAmount || 0) /
                                  Number(row.withoutTax || 1)) *
                                100
                              : 0);

                          const cgstRate =
                            Number(row.cgst || 0) > 0 ? totalTaxRate / 2 : 0;

                          const sgstRate =
                            Number(row.sgst || 0) > 0 ? totalTaxRate / 2 : 0;

                          const igstRate =
                            Number(row.igst || 0) > 0 ? totalTaxRate : 0;

                          return (
                            <tr
                              key={row.id}
                              >
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {index + 1}
                              </td>

                              <td className="max-w-[78px] border-r border-slate-300 px-1 py-1.5 font-semibold leading-tight text-slate-800 whitespace-normal break-words">
                                {row.product || "-"}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-center whitespace-nowrap">
                                {row.hsn || "-"}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-center whitespace-nowrap">
                                {row.pkgsize || row.packSize || "-"}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-center whitespace-nowrap">
                                {row.batchNo || "-"}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-center whitespace-nowrap">
                                {row.expiryDate
                                  ? formatDate(row.expiryDate)
                                  : "-"}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-center tabular-nums">
                                {row.quantity}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {formatCurrency(row.rate)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold tabular-nums">
                                {formatCurrency(beforeDiscount)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {discountPercent.toFixed(2)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {formatCurrency(discountAmount)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold tabular-nums">
                                {formatCurrency(row.withoutTax)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {cgstRate.toFixed(2)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {formatCurrency(row.cgst)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {sgstRate.toFixed(2)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {formatCurrency(row.sgst)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {igstRate.toFixed(2)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {formatCurrency(row.igst)}
                              </td>

                              <td className="px-1 py-1.5 text-right font-bold tabular-nums text-slate-900">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          );
                        })}

                        {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                        {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(0, MIN_ROWS - selectedInvoice.rows.length);
                        const columnCount = 19;

                        return Array.from({ length: fillerCount }).map((_, i) => (
                          <tr key={`filler-${i}`}>
                            {Array.from({ length: columnCount }).map((_, colIdx) => (
                              <td
                                key={colIdx}
                                className={`px-1 py-1.5 ${
                                  colIdx < columnCount - 1 ? "border-r border-slate-300" : ""
                                }`}
                              >
                                &nbsp;
                              </td>
                            ))}
                          </tr>
                        ));
                      })()}

                        <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                          {/* ... existing Total row, unchanged */}
                        </tr>


                        <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                          <td
                            colSpan={8}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Total
                          </td>

                          <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) =>
                                  sum +
                                  Number(row.quantity || 0) *
                                    Number(row.rate || 0),
                                0,
                              ),
                            )}
                          </td>

                          <td className="border-r border-slate-300 px-1 py-1.5" />

                          <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) => sum + Number(row.discount || 0),
                                0,
                              ),
                            )}
                          </td>

                          <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) => sum + Number(row.withoutTax || 0),
                                0,
                              ),
                            )}
                          </td>

                          <td className="border-r border-slate-300 px-1 py-1.5" />
                          <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) => sum + Number(row.cgst || 0),
                                0,
                              ),
                            )}
                          </td>

                          <td className="border-r border-slate-300 px-1 py-1.5" />
                          <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) => sum + Number(row.sgst || 0),
                                0,
                              ),
                            )}
                          </td>

                          <td className="border-r border-slate-300 px-1 py-1.5" />
                          <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) => sum + Number(row.igst || 0),
                                0,
                              ),
                            )}
                          </td>

                          <td className="px-1 py-1.5 text-right">
                            {formatCurrency(
                              selectedInvoice.rows.reduce(
                                (sum, row) => sum + Number(row.total || 0),
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-3">
                      {(() => {
                        const grandTotal = selectedInvoice.rows.reduce(
                          (sum, row) => sum + Number(row.total || 0),
                          0,
                        );

                        const roundedTotal = Math.round(grandTotal);

                        return (
                          <div className="flex h-full items-center">
                            <p className="text-[12px] font-semibold text-slate-700">
                              Amount in Words :{" "}
                              <span className="font-bold text-slate-900">
                                {numberToWords(roundedTotal)}
                              </span>
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="p-3 text-[10px]">
                    {(() => {
                      const totalBeforeDiscount = selectedInvoice.rows.reduce(
                        (sum, row) =>
                          sum + Number(row.quantity || 0) * Number(row.rate || 0),
                        0,
                      );

                      const discount = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.discount || 0),
                        0,
                      );

                      const taxableTotal = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.withoutTax || 0),
                        0,
                      );

                      const cgst = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.cgst || 0),
                        0,
                      );

                      const sgst = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.sgst || 0),
                        0,
                      );

                      const igst = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.igst || 0),
                        0,
                      );

                      const exactTotal = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.total || 0),
                        0,
                      );

                      const roundedTotal = Math.round(exactTotal);
                      const roundOff = roundedTotal - exactTotal;

                      return (
                        <div className="space-y-1.5">
                          <SummaryRow label="Round Off" value={formatCurrency(roundOff)} />

                          <div className="mt-2 flex items-center justify-between border-t border-slate-300 pt-2">
                            <span className="font-bold text-slate-900">Total</span>
                            <span className="text-base font-extrabold text-slate-900">
                              {formatCurrency(roundedTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Row 2: Notes (left) + Authorised Signatory (right) */}
                <div className="invoice-print-footer-block grid grid-cols-[1fr_300px] border-t border-slate-300">
                  <div className="border-r border-slate-300 min-w-0 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Notes
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      This invoice is generated for goods supplied by Nature Biotic to the
                      registered store shown above.
                    </p>

                    {(() => {
                      const exactTotal = selectedInvoice.rows.reduce(
                        (sum, row) => sum + Number(row.total || 0),
                        0,
                      );
                      const payableTotal = Math.round(exactTotal);

                      return (
                        <div className="mt-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Details</p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                            <div className="text-[8.5px] leading-4 text-slate-600">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                <span className="whitespace-nowrap">
                                  <span className="text-slate-500">Account Name : </span>
                                  <span className="font-bold text-slate-800">{PAYMENT_BANK.accountName}</span>
                                </span>
                                <span className="text-slate-300">|</span>

                                <span className="whitespace-nowrap">
                                  <span className="text-slate-500">Account No : </span>
                                  <span className="font-semibold text-slate-800">{PAYMENT_BANK.accountNo}</span>
                                </span>
                                <span className="text-slate-300">|</span>

                                <span className="whitespace-nowrap">
                                  <span className="text-slate-500">IFSC Code : </span>
                                  <span className="font-semibold text-slate-800">{PAYMENT_BANK.ifsc}</span>
                                </span>
                                <span className="text-slate-300">|</span>

                                <span className="whitespace-nowrap">
                                  <span className="text-slate-500">Bank Name : </span>
                                  <span className="font-semibold text-slate-800">{PAYMENT_BANK.bankName}</span>
                                </span>
                                <span className="text-slate-300">|</span>

                                <span className="whitespace-nowrap">
                                  <span className="text-slate-500">Branch : </span>
                                  <span className="font-semibold text-slate-800">{PAYMENT_BANK.branch}</span>
                                </span>
                                <span className="text-slate-300">|</span>

                                <span className="whitespace-nowrap">
                                  <span className="text-slate-500">UPI ID : </span>
                                  <span className="font-semibold text-slate-800">{PAYMENT_BANK.upiId}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="rounded-lg border border-slate-300 bg-white p-1.5">
                                <img
                                  src={buildPaymentQrUrl(
                                    payableTotal,
                                    selectedInvoice.invoiceNo,
                                  )}
                                  alt={`UPI QR for ${formatCurrency(payableTotal)}`}
                                  className="h-[70px] w-[70px] object-contain"
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">
                                  Scan QR to Pay
                                </p>
                                <p className="mt-0.5 text-xs font-extrabold text-slate-900">
                                  {formatCurrency(payableTotal)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="p-2 text-center flex flex-col justify-end">
                    <div className="h-12 border-b border-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Authorised Signatory
                    </p>
                  </div>
                </div>
              </div>
            </div>

              <div className="invoice-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
                <Button variant="secondary" onClick={closeInvoiceView}>
                  Close
                </Button>

                {!isPreviewMode &&
                  !invoiceIsLocked(selectedInvoice.header.invoiceNo) && (
                    <Button
                      variant="secondary"
                      onClick={() => openEditInvoice(selectedInvoice)}
                    >
                      <Icon name="edit" size={18} />
                      Edit Invoice
                    </Button>
                  )}

                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Invoice
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Create Store Sale — same popup shell as Credit Note (portal + fixed header/footer + scroll body) */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Fixed header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {editingInvoiceNo ? "Edit Invoice" : "Create Store Sale"}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {editingInvoiceNo
                      ? "Update the invoice before the store receives it."
                      : "Create a new Nature Biotic sale for a registered store"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-7">
                {/* Sale Information */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Sale Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Sale Date"
                      type="date"
                      value={saleDate}
                      onChange={setSaleDate}
                    />
                    <Input
                      label="Invoice Number"
                      value={invoiceNo}
                      onChange={setInvoiceNo}
                      placeholder="e.g. NB-INV-2050"
                      readOnly={!!editingInvoiceNo}
                      required
                    />
                    <Select
                      label="Select Store"
                      value={storeId}
                      onChange={setStoreId}
                      placeholder="Choose a registered store"
                      options={stores.map((s) => ({
                        value: s.id,
                        label: `${s.name} — ${s.location}`,
                      }))}
                      required
                    />
                    <Select
                      label="Place of Supply"
                      value={placeOfSupply}
                      onChange={setPlaceOfSupply}
                      options={[
                        { value: "Tamil Nadu", label: "Tamil Nadu" },
                        { value: "Others", label: "Others" },
                      ]}
                    />
                    <Input
                      label="Store Address"
                      value={selectedStore?.address || ""}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />
                    <Input
                      label="GST Number"
                      value={selectedStore?.gst || ""}
                      onChange={() => {}}
                      placeholder="Auto-filled from store"
                      readOnly
                    />
                  </div>
                </section>

                {/* Product Entry */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Add Product
                  </h4>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    {/* Entry row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 items-end">
                      <div className="lg:col-span-1">
                        <Select
                          label="Select Product"
                          value={entry.productId}
                          onChange={selectProduct}
                          placeholder="Choose product"
                          options={productChoices.map((p) => ({
                            value: p.id,
                            label: p.name,
                          }))}
                        />
                      </div>

                      {/* PKG Size */}
                      <div>
                        <Select
                          label="PKG Size"
                          value={entry.pkgsize}
                          onChange={selectPackSize}
                          placeholder={
                            entryProduct
                              ? `Select ${entryProduct.unit} size`
                              : "Select product first"
                          }
                          options={selectedProductVariants.map((variant) => ({
                            value: variant.size,
                            label: `${variant.size} (${variant.unit})`,
                          }))}
                        />
                      </div>

                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, batchNo: v }))
                        }
                        placeholder="e.g. BAT-001"
                        required
                      />
                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, expiryDate: v }))
                        }
                        required
                      />
                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))
                        }
                      />
                      <Input
                        label="Selling Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={() => {}}
                        readOnly
                      />
                      <Input
                        label="Discount %"
                        type="number"
                        value={String(entry.discountPercent)}
                        onChange={(v) =>
                          setEntry((p) => ({
                            ...p,
                            discountPercent: Math.min(
                              100,
                              Math.max(0, Number(v) || 0),
                            ),
                          }))
                        }
                        placeholder="0 - 100"
                      />
                      <Button
                        onClick={addProduct}
                        disabled={!canAdd}
                        className="w-full h-[50px] px-3"
                      >
                        <Icon name="add" size={18} />{" "}
                        <span className="whitespace-nowrap">Add Product</span>
                      </Button>
                    </div>

                    {/* Auto-loaded product details */}
                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-200">
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                          <div
                            className={`w-10 h-10 rounded-lg bg-${entryProduct.imageColor}-100 flex items-center justify-center shrink-0`}
                          >
                            <Icon
                              name="image"
                              size={20}
                              className={`text-${entryProduct.imageColor}-600`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-400 font-medium">
                              Product Image
                            </p>
                            <p className="text-xs font-semibold text-slate-700 truncate">
                              {entryProduct.name}
                            </p>
                          </div>
                        </div>
                        <DetailField
                          label="Unit Type"
                          value={entryProduct.unit}
                        />
                        <DetailField
                          label="Pack Size"
                          value={entry.pkgsize || entryProduct.size}
                        />
                        <DetailField
                          label="HSN / SAC"
                          value={entryProduct.hsnCode}
                        />
                        <DetailField
                          label="MRP"
                          value={formatCurrency(entryProduct.mrp)}
                        />
                        <DetailField
                          label="Tax Type"
                          value={entryProduct.taxType}
                        />
                        <DetailField
                          label="Tax %"
                          value={`${entryProduct.taxPercentage}%`}
                        />
                        <DetailField
                          label="SGST"
                          value={`${entryProduct.sgst}%`}
                        />
                        <DetailField
                          label="CGST"
                          value={`${entryProduct.cgst}%`}
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Added Products Table */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Added Products
                    </h4>
                    <span className="text-xs font-semibold text-slate-400">
                      {added.length} item(s)
                    </span>
                  </div>
                  {added.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                      <Icon
                        name="inventory_2"
                        size={32}
                        className="text-slate-300 mx-auto"
                      />
                      <p className="text-sm text-slate-400 mt-2">
                        No products added yet. Use the row above to add
                        products.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-sm min-w-[1100px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                            <th className="text-left font-semibold px-3 py-2.5">
                              S.No
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Product
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Batch No
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Expiry Date
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              Pack Size
                            </th>
                            <th className="text-left font-semibold px-3 py-2.5">
                              HSN / SAC
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Quantity
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Selling Price
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Discount %
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Tax
                            </th>
                            <th className="text-right font-semibold px-3 py-2.5">
                              Row Total
                            </th>
                            <th className="text-center font-semibold px-3 py-2.5">
                              Remove
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {added.map((r, i) => (
                            <tr
                              key={r.key}
                              className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-brand-50/30 transition-base`}
                            >
                              <td className="px-3 py-2.5 text-slate-500 font-medium">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-800">
                                {r.product?.name}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {r.batchNo}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {formatDate(r.expiryDate)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {r.packSize}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {r.hsn}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={r.quantity}
                                  onChange={(e) =>
                                    updateAdded(r.key, {
                                      quantity: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={r.sellingPrice}
                                  onChange={(e) =>
                                    updateAdded(r.key, {
                                      sellingPrice: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-24 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={r.discountPercent}
                                  onChange={(e) =>
                                    updateAdded(r.key, {
                                      discountPercent: Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          Number(e.target.value) || 0,
                                        ),
                                      ),
                                    })
                                  }
                                  className="w-20 text-right tabular-nums rounded-lg border border-slate-200 px-2 py-1 text-slate-700 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                                {formatCurrency(r.taxAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">
                                {formatCurrency(r.rowTotal)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => removeAdded(r.key)}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-base"
                                  title="Remove"
                                >
                                  <Icon name="delete" size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Totals + Remarks */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional notes"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus resize-none"
                    />
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 lg:self-start">
                    <h5 className="text-sm font-bold text-slate-800 mb-3">
                      Invoice Summary
                    </h5>
                    <div className="space-y-2 text-sm">
                      <SummaryRow
                        label="Subtotal"
                        value={formatCurrency(totals.subtotal)}
                      />
                      <SummaryRow
                        label="Total Discount"
                        value={formatCurrency(totals.totalDiscount)}
                      />
                      <SummaryRow
                        label="Total Tax"
                        value={formatCurrency(totals.totalTax)}
                      />
                      <div className="pl-4 space-y-1.5 pt-1">
                        <SummaryRow
                          label="SGST"
                          value={formatCurrency(totals.sgst)}
                          muted
                        />
                        <SummaryRow
                          label="CGST"
                          value={formatCurrency(totals.cgst)}
                          muted
                        />
                        <SummaryRow
                          label="IGST"
                          value={formatCurrency(totals.igst)}
                          muted
                        />
                      </div>
                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200">
                        <span className="font-bold text-slate-800">
                          Grand Total
                        </span>
                        <span className="text-lg font-bold text-brand-700">
                          {formatCurrency(totals.grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Fixed footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft}>
                  Save Draft
                </Button>

                <Button
                  variant="secondary"
                  onClick={handlePreview}
                  disabled={!canCreate}
                >
                  <Icon name="visibility" size={18} />
                  Preview
                </Button>

                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="check_circle" size={18} />
                  {editingInvoiceNo ? "Update Invoice" : "Create Invoice"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
