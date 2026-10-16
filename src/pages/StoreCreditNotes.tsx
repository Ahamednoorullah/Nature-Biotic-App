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
import { formatCurrency, formatDate, formatRoundOff, numberToWords, roundOffToRupee } from "@/lib/format";
import {
  products as allProducts,
  getStore,
  getStorePurchasesFromCompanySales,
  nextStoreDocumentNo,
  rememberStoreDocumentNo,
  type Product,
} from "@/lib/data";
import { createPortal } from "react-dom";
import { usesSupabaseData } from "@/lib/db/mode";
import { loadStoreCreditNotes, saveStoreCreditNoteDb, issueStoreCreditNoteDb } from "@/lib/db/financials";
import { loadEligibleSalesReturnCredits, loadSalesInvoices, type EligibleSalesReturnCredit } from "@/lib/db/sales";
import { peekDocumentNo, type RpcLine } from "@/lib/db/rpc";
import { dbErrorMessage } from "@/lib/db/errors";

type StoreSaleType = "Direct" | "Executive";

type StoredSaleProduct = {
  key: string;
  productId: string;
  product?: Product;
  pkgsize?: string;
  packSize?: string;
  batchNo: string;
  expiryDate: string;
  hsn?: string;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  withoutTax: number;
  taxAmount: number;
  rowTotal: number;
};

type StoredSaleInvoice = {
  id: string;
  date: string;
  invoiceNo: string;
  through: StoreSaleType;
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  products: StoredSaleProduct[];
};

const STORE_SALES_INVOICE_STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

type CreditNoteStatus = "Draft" | "Approved" | "Pending" | "Rejected";

type CreditNote = {
  id: string;
  creditNoteNo: string;
  party: string;
  Date: string;
  amount: number; // Without Tax
  sgst: number;
  cgst: number;
  igst: number;
  roundOff?: number;
  documentTotal?: number;
  total: number;
  storeLocation: string;
  placeofreturn: string;
  storeId?: string;
  product?: string;
  quantity?: number;
  reason?: string;
  status?: CreditNoteStatus;
  invoiceNo?: string;
  pkgsize?: string;
  batchNo?: string;
  expiryDate?: string;
  sellingPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxPercent?: number;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  through?: StoreSaleType;
  executiveName?: string;
  catalogProductId?: string;
  lines?: CreditNote[];
};

type AddedProduct = {
  key: string;
  productId: string;
  productName: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
  reason: string;
  soldQuantity: number;
  taxPercent: number;
  discountAmount: number;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  catalogProductId?: string;
  sourceItemId?: string;
  farmerId?: string;
  returnNo?: string;
  hsnCode?: string;
  availableQty?: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function wholeCount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) > 0.000001) return null;
  return nearest;
}

function typedWholeCount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

function creditPortion(line: EligibleSalesReturnCredit, quantity: number) {
  const ratio = line.returnedQty > 0 ? quantity / line.returnedQty : 0;
  const taxable = money(line.taxableAmount * ratio);
  const sgst = money(line.sgst * ratio);
  const cgst = money(line.cgst * ratio);
  const igst = money(line.igst * ratio);
  return {
    discountAmount: money(line.discountAmount * ratio),
    taxableAmount: taxable,
    sgst,
    cgst,
    igst,
    total: money(taxable + sgst + cgst + igst),
  };
}

const statusColor: Record<CreditNoteStatus, "green" | "amber" | "red" | "slate"> = {
  Draft: "slate",
  Approved: "green",
  Pending: "amber",
  Rejected: "red",
};

function CreditInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function StoreCreditNotes({
  storeId: currentStoreId,
}: {
  storeId: string;
}) {
  const storageKey = `nature-biotic-store-credit-notes-v3:${currentStoreId}`;

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    if (usesSupabaseData()) return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dbInvoices, setDbInvoices] = useState<StoredSaleInvoice[]>([]);
  const [listError, setListError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");

  const reloadDbCreditNotes = async () => {
    try {
      const dbRows = await loadStoreCreditNotes(currentStoreId);
      const flat: CreditNote[] = dbRows.map((row) => ({
        id: row.id,
        creditNoteNo: row.creditNoteNo,
        party: row.farmer,
        Date: row.date,
        amount: row.amount,
        sgst: row.sgst,
        cgst: row.cgst,
        igst: row.igst,
        roundOff: row.roundOff,
        documentTotal: row.total,
        total: row.total,
        storeLocation: row.placeOfSupply || "Tamil Nadu",
        placeofreturn: "",
        storeId: currentStoreId,
        status: row.status as CreditNoteStatus,
        taxableAmount: row.amount,
        through: row.through,
        farmerPhone: row.phone,
        farmerVillage: row.village,
        lines: (row.items || []).map((item, idx) => ({
          id: `${row.id}:${idx}`,
          creditNoteNo: row.creditNoteNo,
          party: row.farmer,
          Date: row.date,
          amount: item.taxableAmount,
          sgst: item.sgst,
          cgst: item.cgst,
          igst: item.igst,
          roundOff: row.roundOff,
          documentTotal: row.total,
          total: item.total,
          storeLocation: row.placeOfSupply || "Tamil Nadu",
          placeofreturn: "",
          storeId: currentStoreId,
          product: item.productName,
          quantity: item.quantity,
          reason: item.reason,
          status: row.status as CreditNoteStatus,
          pkgsize: item.packSize,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          sellingPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableAmount: item.taxableAmount,
          taxPercent: item.taxPercent,
          through: row.through,
          farmerPhone: row.phone,
          farmerVillage: row.village,
        })),
      }));
      setCreditNotes(flat);
      setListError("");
    } catch (error) {
      setCreditNotes([]);
      setListError(dbErrorMessage(error, "Could not load store credit notes."));
    }
  };

  const reloadDbInvoices = async () => {
    try {
      const invoices = await loadSalesInvoices(currentStoreId);
      setDbInvoices(invoices as unknown as StoredSaleInvoice[]);
      setInvoiceError("");
    } catch (error) {
      setDbInvoices([]);
      setInvoiceError(dbErrorMessage(error, "Could not load sales invoices."));
    }
  };

  useEffect(() => {
    if (!usesSupabaseData()) return;
    void reloadDbCreditNotes();
    void reloadDbInvoices();
  }, [currentStoreId]);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "monthly" | "quarterly" | "yearly" | "custom"
  >("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [salesReturnCredits, setSalesReturnCredits] = useState<EligibleSalesReturnCredit[]>([]);
  const [salesReturnCreditsLoading, setSalesReturnCreditsLoading] = useState(false);
  const [salesReturnCreditError, setSalesReturnCreditError] = useState("");
  const [creditQtyRaw, setCreditQtyRaw] = useState("");
  const [editingCreditNo, setEditingCreditNo] = useState("");

  useEffect(() => {
    if (!usesSupabaseData() || !showCreate) return;
    let active = true;
    setSalesReturnCreditsLoading(true);
    setSalesReturnCreditError("");
    loadEligibleSalesReturnCredits(currentStoreId)
      .then((rows) => {
        if (active) setSalesReturnCredits(rows);
      })
      .catch((error) => {
        if (!active) return;
        setSalesReturnCredits([]);
        setSalesReturnCreditError(dbErrorMessage(error, "Could not load returned products."));
      })
      .finally(() => {
        if (active) setSalesReturnCreditsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentStoreId, showCreate]);
  const [selectesdreditNote, setSelectesdreditNote] = useState<{
    header: CreditNote;
    rows: CreditNote[];
  } | null>(null);

  // Form state
  const [returnDate, setReturnDate] = useState("");
  const [creditNoteNo, setCreditNoteNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const currentStore = getStore(currentStoreId);

  const storeSalesInvoices = useMemo<StoredSaleInvoice[]>(() => {
    if (usesSupabaseData()) {
      return dbInvoices;
    }
    try {
      const raw = localStorage.getItem(
        `${STORE_SALES_INVOICE_STORAGE_KEY}:${currentStoreId}`,
      );
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [currentStoreId, showCreate, dbInvoices]);
  const [storeId, setStoreId] = useState(currentStoreId);
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");
  const [farmerId, setFarmerId] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerVillage, setFarmerVillage] = useState("");
  const [farmerCrop, setFarmerCrop] = useState("");
  const [farmerAcre, setFarmerAcre] = useState("");
  const [through, setThrough] = useState<StoreSaleType>("Direct");
  const [executiveName, setExecutiveName] = useState("");
  const [remarks, setRemarks] = useState("");
  const purchaseOrderNotesDefault = `Purchase order raised by ${
    currentStore?.name ?? "this store"
  } to Nature Biotic.`;
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState(
    purchaseOrderNotesDefault,
  );
  const [entry, setEntry] = useState({
    productName: "",
    productId: "",
    pkgsize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 0,
    sellingPrice: 0,
    discount: 0,
    reason: "",
  });
  const [added, setAdded] = useState<AddedProduct[]>([]);

  const selectedStore = currentStore;
  const selectedInvoice = useMemo(
    () => storeSalesInvoices.find((invoice) => invoice.invoiceNo === invoiceNo),
    [storeSalesInvoices, invoiceNo],
  );

  const selectedInvoiceRows = selectedInvoice?.products || [];

  const entryProduct = selectedInvoiceRows.find(
    (_, index) => String(index) === entry.productId,
  );

  const canAdd =
    Boolean(entry.productId) &&
    entry.quantity > 0 &&
    entry.sellingPrice > 0;

  const catalogRows = useMemo(() => {
    const master = allProducts
      .filter((product) => product.name)
      .map((product) => ({
        id: product.id,
        name: product.name,
        size: product.size || "",
        price: Number(product.sellingPrice || 0),
        tax: Number(product.taxPercentage || 0),
        batchNo: "",
        expiryDate: "",
      }));
    if (master.length > 0) return master;

    return (getStorePurchasesFromCompanySales(currentStoreId) || [])
      .map((row: any, index: number) => ({
        id: String(row.productId || `purchase-${index}-${row.batchNo || ""}`),
        name: String(row.productName || row.product || "").trim(),
        size: String(row.packSize || row.pkgsize || row.size || ""),
        price: Number(row.sellingPrice || row.rate || 0),
        tax: Number(row.taxPercent || row.taxPercentage || 0),
        batchNo: String(row.batchNo || ""),
        expiryDate: String(row.expiryDate || ""),
      }))
      .filter((row) => row.name);
  }, [currentStoreId]);

  const selectedReturnLine = salesReturnCredits.find((line) => line.id === entry.productId);
  const returnLinesReady =
    added.length > 0 &&
    added.every((item) => {
      const line = salesReturnCredits.find((row) => row.id === item.sourceItemId);
      const available = line ? wholeCount(line.availableQty) : null;
      return Boolean(
        line &&
          available != null &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= available,
      );
    });
  const canCreate = usesSupabaseData()
    ? Boolean(creditNoteNo && returnDate && returnLinesReady)
    : Boolean(creditNoteNo && storeId && returnDate && added.length > 0);

  function nextCreditNo() {
    return nextStoreDocumentNo(
      currentStore?.code || "ST",
      "CN",
      creditNotes.map((note) => note.creditNoteNo),
    );
  }

  // ---- Totals: calculated live from the added products list ----
  const totals = useMemo(() => {
    return added.reduce(
      (acc, item) => ({
        subtotal: acc.subtotal + item.sellingPrice * item.quantity,
        totalDiscount:
          acc.totalDiscount +
          (item.sellingPrice * item.quantity * item.discount) / 100,
        sgst: acc.sgst + item.sgst,
        cgst: acc.cgst + item.cgst,
        igst: acc.igst + item.igst,
        grandTotal: acc.grandTotal + item.total,
      }),
      {
        subtotal: 0,
        totalDiscount: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        grandTotal: 0,
      },
    );
  }, [added]);

  function isTamilNaduSupply() {
    return placeOfSupply === "Tamil Nadu";
  }

  function computeLine(
    productId: string,
    quantity: number,
    sellingPrice: number,
    discount: number,
  ) {
    const saleRow = invoiceNo
      ? selectedInvoiceRows[Number(productId)]
      : undefined;
    const catalog = catalogRows.find((product) => product.id === productId);
    const gross = sellingPrice * quantity;
    const discountAmt = (gross * discount) / 100;
    const taxableAmount = Math.max(0, gross - discountAmt);

    const taxPercent = Number(
      saleRow?.taxPercent || catalog?.tax || 0,
    );
    const intrastate = (placeOfSupply || "Tamil Nadu") === "Tamil Nadu";

    const sgstAmt = intrastate ? (taxableAmount * (taxPercent / 2)) / 100 : 0;
    const cgstAmt = intrastate ? (taxableAmount * (taxPercent / 2)) / 100 : 0;
    const igstAmt = !intrastate ? (taxableAmount * taxPercent) / 100 : 0;

    return {
      taxableAmount,
      sgst: sgstAmt,
      cgst: cgstAmt,
      igst: igstAmt,
      total: taxableAmount + sgstAmt + cgstAmt + igstAmt,
    };
  }

  function selectProduct(productId: string) {
    if (!invoiceNo) {
      const product = catalogRows.find((item) => item.id === productId);
      if (!product) return;
      setEntry((current) => ({
        ...current,
        productId,
        pkgsize: product.size || "",
        batchNo: product.batchNo || current.batchNo,
        expiryDate: product.expiryDate || current.expiryDate,
        quantity: current.quantity > 0 ? current.quantity : 1,
        sellingPrice: Number(product.price || 0),
      }));
      return;
    }

    const saleRow = selectedInvoiceRows[Number(productId)];
    if (!saleRow) return;

    const gross =
      Number(saleRow.quantity || 0) * Number(saleRow.sellingPrice || 0);

    const discountPercent =
      gross > 0 ? (Number(saleRow.discount || 0) / gross) * 100 : 0;

    setEntry((p) => ({
      ...p,
      productName: lineName(saleRow),
      productId,
      pkgsize:
        saleRow.pkgsize || saleRow.packSize || saleRow.product?.size || "",
      batchNo: saleRow.batchNo || "",
      expiryDate: saleRow.expiryDate || "",
      quantity: 1,
      sellingPrice: Number(saleRow.sellingPrice || 0),
      discount: discountPercent,
    }));
  }

  function lineName(row: { product?: { name?: string } }) {
    return String(row.product?.name || "Product").trim();
  }

  function lineSize(row: {
    pkgsize?: string;
    packSize?: string;
    product?: { size?: string };
  }) {
    return String(row.pkgsize || row.packSize || row.product?.size || "").trim();
  }

  function creditProductNames() {
    const seen = new Set<string>();
    const names: string[] = [];
    const source = invoiceNo ? selectedInvoiceRows.map((row) => lineName(row)) : catalogRows.map((row) => row.name);
    source.forEach((name) => {
      const clean = String(name || "").trim();
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) return;
      seen.add(key);
      names.push(clean);
    });
    return names;
  }

  function creditSizes(name: string) {
    const key = name.trim().toLowerCase();
    const sizes = new Set<string>();
    if (!key) return [];
    if (invoiceNo) {
      selectedInvoiceRows.forEach((row) => {
        if (lineName(row).toLowerCase() !== key) return;
        const size = lineSize(row);
        if (size) sizes.add(size);
      });
      return Array.from(sizes);
    }
    catalogRows.forEach((row) => {
      if (row.name.trim().toLowerCase() !== key) return;
      if (row.size) sizes.add(row.size);
    });
    return Array.from(sizes);
  }

  function creditBatches(name: string, size: string) {
    const nameKey = name.trim().toLowerCase();
    const sizeKey = size.trim().toLowerCase();
    const batches = new Set<string>();
    if (!nameKey || !sizeKey) return [];
    if (invoiceNo) {
      selectedInvoiceRows.forEach((row) => {
        if (lineName(row).toLowerCase() !== nameKey) return;
        if (lineSize(row).toLowerCase() !== sizeKey) return;
        const batch = String(row.batchNo || "").trim();
        if (batch) batches.add(batch);
      });
    } else {
    getStorePurchasesFromCompanySales(currentStoreId).forEach((row: any) => {
      const rowName = String(row.product || row.productName || "").trim().toLowerCase();
      const rowSize = String(row.packSize || row.pkgsize || row.size || "").trim().toLowerCase();
      if (rowName !== nameKey || rowSize !== sizeKey) return;
      const batch = String(row.batchNo || "").trim();
      if (batch && batch !== "-") batches.add(batch);
    });
    }
    return Array.from(batches).filter(
      (batch) =>
        !added.some(
          (item) =>
            item.productName.trim().toLowerCase() === nameKey &&
            item.pkgsize.trim().toLowerCase() === sizeKey &&
            item.batchNo.trim().toLowerCase() === batch.trim().toLowerCase(),
        ),
    );
  }

  function expiryForBatch(name: string, size: string, batch: string) {
    const nameKey = name.trim().toLowerCase();
    const sizeKey = size.trim().toLowerCase();
    if (invoiceNo) {
      const row = selectedInvoiceRows.find(
        (item) =>
          lineName(item).toLowerCase() === nameKey &&
          lineSize(item).toLowerCase() === sizeKey &&
          String(item.batchNo || "").trim() === batch,
      );
      return String(row?.expiryDate || "");
    }
    const purchase = getStorePurchasesFromCompanySales(currentStoreId).find(
      (row: any) => {
        const rowName = String(row.product || row.productName || "")
          .trim()
          .toLowerCase();
        const rowSize = String(row.packSize || row.pkgsize || row.size || "")
          .trim()
          .toLowerCase();
        return (
          rowName === nameKey &&
          rowSize === sizeKey &&
          String(row.batchNo || "").trim() === batch
        );
      },
    );
    return String(purchase?.expiryDate || "");
  }

  function applyCreditLine(name: string, size: string, batch: string) {
    if (invoiceNo) {
      const index = selectedInvoiceRows.findIndex((row) => {
        if (lineName(row).toLowerCase() !== name.trim().toLowerCase()) return false;
        if (lineSize(row).toLowerCase() !== size.trim().toLowerCase()) return false;
        return !batch || String(row.batchNo || "").trim() === batch;
      });
      if (index >= 0) {
        selectProduct(String(index));
        return;
      }
    }
    const catalog = catalogRows.find(
      (row) =>
        row.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        row.size.trim().toLowerCase() === size.trim().toLowerCase(),
    );
    setEntry((current) => ({
      ...current,
      productName: name,
      productId: catalog?.id || "",
      pkgsize: size,
      batchNo: batch,
      expiryDate: expiryForBatch(name, size, batch) || catalog?.expiryDate || "",
      quantity: size ? (current.quantity > 0 ? current.quantity : 1) : 0,
      sellingPrice: catalog ? Number(catalog.price || 0) : 0,
    }));
  }

  function chooseCreditProduct(name: string) {
    const sizes = creditSizes(name);
    const size = sizes.length === 1 ? sizes[0] : "";
    const batches = size ? creditBatches(name, size) : [];
    if (!size) {
      setEntry((current) => ({
        ...current,
        productName: name,
        productId: "",
        pkgsize: "",
        batchNo: "",
        expiryDate: "",
        quantity: 0,
        sellingPrice: 0,
      }));
      return;
    }
    applyCreditLine(name, size, batches.length === 1 ? batches[0] : "");
  }

  function chooseCreditSize(size: string) {
    const batches = creditBatches(entry.productName, size);
    applyCreditLine(entry.productName, size, batches.length === 1 ? batches[0] : "");
  }

  function chooseCreditBatch(batch: string) {
    applyCreditLine(entry.productName, entry.pkgsize, batch);
  }

  function comboAlreadyAdded(name: string, size: string, batch: string) {
    return added.some(
      (item) =>
        item.productName.trim().toLowerCase() === name.trim().toLowerCase() &&
        item.pkgsize.trim().toLowerCase() === size.trim().toLowerCase() &&
        item.batchNo.trim().toLowerCase() === batch.trim().toLowerCase(),
    );
  }

  function maxCreditQuantity(
    name = entry.productName,
    size = entry.pkgsize,
    batch = entry.batchNo,
  ) {
    if (!name || !size || !batch) return 0;
    const pending = added
      .filter(
        (item) =>
          item.productName.trim().toLowerCase() === name.trim().toLowerCase() &&
          item.pkgsize.trim().toLowerCase() === size.trim().toLowerCase() &&
          item.batchNo.trim().toLowerCase() === batch.trim().toLowerCase(),
      )
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (invoiceNo) {
      const row = selectedInvoiceRows.find(
        (item) =>
          lineName(item).toLowerCase() === name.trim().toLowerCase() &&
          lineSize(item).toLowerCase() === size.trim().toLowerCase() &&
          String(item.batchNo || "").trim() === batch,
      );
      if (!row) return 0;
      const already = creditNotes
        .filter(
          (note) =>
            note.creditNoteNo !== editingCreditNo &&
            note.invoiceNo === invoiceNo &&
            note.product === lineName(row) &&
            note.batchNo === String(row.batchNo || "") &&
            note.status !== "Rejected" &&
            note.status !== "Draft",
        )
        .reduce((sum, note) => sum + Number(note.quantity || 0), 0);
      return Math.max(0, Number(row.quantity || 0) - already - pending);
    }
    const catalog = catalogRows.find(
      (item) =>
        item.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        item.size.trim().toLowerCase() === size.trim().toLowerCase(),
    );
    if (!catalog) return Number.POSITIVE_INFINITY;
    return Number.POSITIVE_INFINITY;
  }

  function returnQuantityMessage(line: EligibleSalesReturnCredit, raw: string) {
    const available = wholeCount(line.availableQty);
    const label = `${line.productName} ${line.packSize}`.trim();
    if (available == null) return `Available quantity for ${label} is not a whole number.`;
    if (!raw.trim()) return "";
    const quantity = typedWholeCount(raw);
    if (quantity == null) return `Credit quantity for ${label} must be a whole number.`;
    const pending = added
      .filter((item) => item.sourceItemId === line.id)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (quantity + pending > available) {
      return `Credit quantity for ${label} cannot exceed ${Math.max(0, available - pending)}.`;
    }
    return "";
  }

  function addReturnedProduct() {
    const line = salesReturnCredits.find((row) => row.id === entry.productId);
    if (!line) {
      setSalesReturnCreditError("Select a product from an approved sales return.");
      return;
    }
    const message = returnQuantityMessage(line, creditQtyRaw);
    const quantity = typedWholeCount(creditQtyRaw);
    if (message || quantity == null || quantity <= 0) {
      setSalesReturnCreditError(message || "Enter a credit quantity greater than zero.");
      return;
    }
    if (added.some((item) => item.sourceItemId === line.id)) {
      setSalesReturnCreditError("This returned product is already on the credit note.");
      return;
    }
    const part = creditPortion(line, quantity);
    setAdded((prev) => [
      ...prev,
      {
        key: line.id,
        productId: line.id,
        sourceItemId: line.id,
        farmerId: line.farmerId,
        returnNo: line.returnNo,
        hsnCode: line.hsnCode,
        availableQty: line.availableQty,
        productName: line.productName,
        pkgsize: line.packSize,
        batchNo: line.batchNo,
        expiryDate: line.expiryDate,
        quantity,
        sellingPrice: line.unitPrice,
        discount: line.discountPercent,
        reason: line.reason,
        soldQuantity: line.returnedQty,
        taxPercent: line.taxPercent,
        ...part,
      },
    ]);
    setSalesReturnCreditError("");
    setCreditQtyRaw("");
    setEntry({
      productName: "",
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
  }

  function addProduct() {
    if (usesSupabaseData()) {
      addReturnedProduct();
      return;
    }
    if (!canAdd) return;
    if (comboAlreadyAdded(entry.productName, entry.pkgsize, entry.batchNo)) {
      window.alert(
        "This product, package size, and batch is already on the credit note.",
      );
      return;
    }
    const maxQty = maxCreditQuantity();
    if (Number.isFinite(maxQty) && entry.quantity > maxQty) {
      window.alert(
        `Only ${maxQty} quantity is available for this batch.`,
      );
      return;
    }

    const saleRow = invoiceNo
      ? selectedInvoiceRows[Number(entry.productId)]
      : undefined;
    const catalog = catalogRows.find((item) => item.id === entry.productId);
    if (!saleRow && !catalog) return;

    if (saleRow) {
      const alreadyReturned = creditNotes
        .filter(
          (note) =>
            note.invoiceNo === invoiceNo &&
            note.product === (saleRow.product?.name || "") &&
            note.batchNo === saleRow.batchNo &&
            note.status !== "Rejected" &&
            note.status !== "Draft" &&
            note.creditNoteNo !== editingCreditNo,
        )
        .reduce((sum, note) => sum + Number(note.quantity || 0), 0);

      const remainingQty = Math.max(
        0,
        Number(saleRow.quantity || 0) - alreadyReturned,
      );

      if (entry.quantity > remainingQty) {
        window.alert(
          `Only ${remainingQty} quantity can be returned from this invoice line.`,
        );
        return;
      }
    }

    const computed = computeLine(
      entry.productId,
      entry.quantity,
      entry.sellingPrice,
      entry.discount,
    );

    const newItem: AddedProduct = {
      key: `${entry.productId}-${entry.batchNo}-${String(
        globalThis.Date.now(),
      )}-${Math.random().toString(36).slice(2, 6)}`,
      productId: entry.productId,
      productName: saleRow?.product?.name || catalog?.name || "Product",
      catalogProductId: saleRow?.productId || catalog?.id || "",
      pkgsize:
        entry.pkgsize ||
        saleRow?.pkgsize ||
        saleRow?.packSize ||
        saleRow?.product?.size ||
        catalog?.size ||
        "",
      batchNo: entry.batchNo || saleRow?.batchNo || "",
      expiryDate: entry.expiryDate || saleRow?.expiryDate || "",
      quantity: entry.quantity,
      sellingPrice: entry.sellingPrice,
      discount: entry.discount,
      reason: entry.reason,
      soldQuantity: Number(saleRow?.quantity || 0),
      taxPercent: Number(saleRow?.taxPercent || catalog?.tax || 0),
      discountAmount:
        (entry.sellingPrice * entry.quantity * entry.discount) / 100,
      ...computed,
    };

    setAdded((prev) => [...prev, newItem]);

    setEntry({
      productName: "",
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
  }

  function updateAdded(key: string, updates: Partial<AddedProduct>) {
    setAdded((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        if (item.sourceItemId) {
          const line = salesReturnCredits.find((row) => row.id === item.sourceItemId);
          const quantity = updates.quantity ?? item.quantity;
          const part =
            line && Number.isInteger(quantity) && quantity > 0
              ? creditPortion(line, quantity)
              : { discountAmount: 0, taxableAmount: 0, sgst: 0, cgst: 0, igst: 0, total: 0 };
          return { ...item, quantity, ...part };
        }
        const merged = { ...item, ...updates };
        const computed = computeLine(
          merged.productId,
          merged.quantity,
          merged.sellingPrice,
          merged.discount,
        );
        return { ...merged, ...computed };
      }),
    );
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((item) => item.key !== key));
  }

  function openCreditNote(row: CreditNote) {
    const relatedRows = row.lines?.length
      ? row.lines
      : creditNotes.filter(
          (item) =>
            item.creditNoteNo === row.creditNoteNo &&
            (item.storeId || item.party) === (row.storeId || row.party) &&
            item.Date === row.Date &&
            item.product,
        );
    if (row.status === "Draft") {
      const lines = (relatedRows.length > 0 ? relatedRows : [row]).filter(
        (item) => item.product,
      );
      setSelectesdreditNote(null);
      setEditingCreditNo(row.creditNoteNo);
      setCreditNoteNo(row.creditNoteNo);
      setReturnDate(row.Date || "");
      setInvoiceNo(row.invoiceNo || "");
      setFarmerName(row.party === "Draft" ? "" : row.party);
      setFarmerPhone(row.farmerPhone || "");
      setFarmerVillage(row.farmerVillage || "");
      setFarmerCrop(row.farmerCrop || "");
      setFarmerAcre(row.farmerAcre || "");
      setPlaceOfSupply(row.storeLocation || "Tamil Nadu");
      setRemarks(lines[0]?.reason || "");
      setAdded(
        lines.map((item) => ({
          key: item.id,
          productId: item.catalogProductId || "",
          productName: item.product || "",
          catalogProductId: item.catalogProductId,
          pkgsize: item.pkgsize || "",
          batchNo: item.batchNo || "",
          expiryDate: item.expiryDate || "",
          quantity: Number(item.quantity || 0),
          sellingPrice: Number(item.sellingPrice || 0),
          discount: Number(item.discountPercent || 0),
          reason: item.reason || "",
          soldQuantity: Number(item.quantity || 0),
          taxPercent: Number(item.taxPercent || 0),
          discountAmount: Number(item.discountAmount || 0),
          taxableAmount: Number(item.taxableAmount || item.amount || 0),
          sgst: Number(item.sgst || 0),
          cgst: Number(item.cgst || 0),
          igst: Number(item.igst || 0),
          total: Number(item.total || 0),
        })),
      );
      setShowCreate(true);
      return;
    }

    setSelectesdreditNote({
      header: row,
      rows: relatedRows.length > 0 ? relatedRows : [row],
    });
  }

  function resetForm() {
    setReturnDate(new Date().toISOString().split("T")[0]);
    if (usesSupabaseData()) {
      peekDocumentNo("store_credit_note", currentStoreId).then((nextNo) => {
        if (nextNo) setCreditNoteNo(nextNo);
      }).catch(() => {
        setCreditNoteNo(nextCreditNo());
      });
    } else {
      setCreditNoteNo(nextCreditNo());
    }
    setFarmerId("");
    setInvoiceNo("");
    setStoreId(currentStoreId);
    setPlaceOfSupply("Tamil Nadu");
    setFarmerName("");
    setFarmerPhone("");
    setFarmerVillage("");
    setFarmerCrop("");
    setFarmerAcre("");
    setThrough("Direct");
    setExecutiveName("");
    setRemarks("");
    setEditingCreditNo("");
    setEntry({
      productName: "",
      productId: "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      quantity: 0,
      sellingPrice: 0,
      discount: 0,
      reason: "",
    });
    setAdded([]);
    setCreditQtyRaw("");
    setSalesReturnCreditError("");
  }

  async function persistCreditNote(status: "Draft" | "Pending") {
    if (!selectedStore || !creditNoteNo) return;
    if (status === "Pending" && !canCreate) return;

    if (usesSupabaseData()) {
      const farmerIds = [...new Set(added.map((item) => item.farmerId).filter(Boolean))];
      const partyNames = [
        ...new Set(
          added
            .map((item) => {
              const line = salesReturnCredits.find((row) => row.id === item.sourceItemId);
              return String(line?.partyName || "").trim();
            })
            .filter(Boolean),
        ),
      ];
      const dbLines: RpcLine[] = added.map((item) => ({
        source_item_id: item.sourceItemId || null,
        quantity: item.quantity,
        line_type: "return",
        reason: item.reason || remarks || null,
      }));

      try {
        const res = await saveStoreCreditNoteDb(
          null,
          {
            store_id: currentStoreId,
            credit_note_date: returnDate,
            farmer_id: farmerIds.length === 1 ? farmerIds[0] : null,
            party_name:
              farmerIds.length > 1
                ? "Multiple farmers"
                : partyNames[0] || farmerName || null,
            notes: remarks || null,
            reason: remarks || null,
          },
          dbLines,
        );
        if (status === "Pending") {
          await issueStoreCreditNoteDb(res.id);
        }
        await reloadDbCreditNotes();
        closeForm();
        if (status === "Draft") window.alert("Credit Note saved as draft.");
        return;
      } catch (err: any) {
        window.alert(dbErrorMessage(err, "Failed to save store credit note."));
        return;
      }
    }

    const allocatedNo = editingCreditNo || creditNoteNo;
    const createdAt = new globalThis.Date().getTime();
    const lines = added.length
      ? added
      : [
          {
            key: "header",
            productId: "",
            productName: "",
            catalogProductId: "",
            pkgsize: "",
            batchNo: "",
            expiryDate: "",
            quantity: 0,
            sellingPrice: 0,
            discount: 0,
            reason: remarks,
            soldQuantity: 0,
            taxPercent: 0,
            discountAmount: 0,
            taxableAmount: 0,
            sgst: 0,
            cgst: 0,
            igst: 0,
            total: 0,
          },
        ];
    const storeRows: CreditNote[] = lines.map((item, index) => ({
      id: `${allocatedNo}-${item.key}-${createdAt}-${index}`,
      creditNoteNo: allocatedNo,
      party: farmerName || selectedStore.name || "GST Credit Note",
      Date: returnDate,
      amount: item.taxableAmount,
      sgst: item.sgst,
      cgst: item.cgst,
      igst: item.igst,
      total: item.total,
      storeLocation: placeOfSupply || selectedStore.location || "",
      placeofreturn: farmerVillage || selectedStore.location?.split(",")[0] || "",
      storeId: selectedStore.id,
      product: item.productName,
      catalogProductId: item.catalogProductId || "",
      quantity: item.quantity,
      reason: item.reason || remarks || "",
      status,
      invoiceNo,
      pkgsize: item.pkgsize,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
      sellingPrice: item.sellingPrice,
      discountPercent: item.discount,
      discountAmount: item.discountAmount,
      taxableAmount: item.taxableAmount,
      taxPercent: item.taxPercent,
      farmerPhone,
      farmerVillage,
      farmerCrop,
      farmerAcre,
      through: "Direct" as const,
      executiveName: "",
    }));
    const next = [
      ...storeRows,
      ...creditNotes.filter((note) => note.creditNoteNo !== allocatedNo),
    ];
    setCreditNotes(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    rememberStoreDocumentNo(currentStore?.code || "ST", "CN", allocatedNo);
    closeForm();
    if (status === "Draft") window.alert("Credit Note saved as draft.");
  }

  function handleSaveDraft() {
    if (!creditNoteNo) return;
    persistCreditNote("Draft");
  }

  function handleCreate() {
    if (!canCreate || !selectedStore) {
      return;
    }
    persistCreditNote("Pending");
  }

  const DetailField = ({ label, value }: any) => (
    <div>
      <p className="text-[11px] text-slate-400 font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
  const SummaryRow = ({ label, value, muted }: any) => (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-700"}>
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${muted ? "text-slate-500" : "text-slate-800"}`}
      >
        {value}
      </span>
    </div>
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new globalThis.Date();

    const normalize = (value: string) =>
      new globalThis.Date(`${value}T00:00:00`);

    const isWithinDateFilter = (value: string) => {
      const rowDate = normalize(value);

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
        return (
          rowDate.getFullYear() === today.getFullYear() &&
          Math.floor(rowDate.getMonth() / 3) ===
            Math.floor(today.getMonth() / 3)
        );
      }

      if (dateFilter === "yearly") {
        return rowDate.getFullYear() === today.getFullYear();
      }

      if (dateFilter === "custom") {
        if (!customFrom && !customTo) return true;

        const from = customFrom ? normalize(customFrom) : null;
        const to = customTo ? normalize(customTo) : null;

        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
      }

      return true;
    };

    return creditNotes.filter((c) => {
      const matchesSearch =
        !q ||
        c.creditNoteNo.toLowerCase().includes(q) ||
        c.party.toLowerCase().includes(q) ||
        `${c.product || ""} ${c.batchNo || ""}`.toLowerCase().includes(q) ||
        (c.lines || []).some((line) =>
          `${line.product || ""} ${line.batchNo || ""}`.toLowerCase().includes(q),
        );

      return matchesSearch && isWithinDateFilter(c.Date);
    });
  }, [search, creditNotes, dateFilter, customFrom, customTo]);

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Store Credit Notes
          </h1>
          {listError || invoiceError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {listError || invoiceError}
            </p>
          ) : null}
          <p className="text-slate-500 mt-1">
            Credit notes issued by this store. Company debit notes received from Nature Biotic are listed under Debit Notes.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <Icon name="add" size={20} fill />
          Create Credit Note
        </Button>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-end xl:gap-2">
          <div className="w-full xl:w-[245px] xl:shrink-0">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by CN no or farmer..."
              icon="search"
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

          {(search || dateFilter !== "all" || customFrom || customTo) && (
            <Button
              variant="secondary"
              className="xl:shrink-0"
              onClick={() => {
                setSearch("");
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

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="undo"
            title="No credit notes found"
            description="Adjust your search or create a new credit note."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                  <th
                    rowSpan={2}
                    className="w-[6%] text-center font-semibold px-1 py-3 border-r border-slate-200"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] text-center font-semibold px-1 py-3 border-r border-slate-200 whitespace-nowrap"
                  >
                    Date
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[16%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    CN No.
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[14%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Without Tax
                  </th>

                  <th
                    colSpan={2}
                    className="w-[14%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    SGST
                  </th>
                  <th
                    colSpan={2}
                    className="w-[14%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    CGST
                  </th>
                  <th
                    colSpan={2}
                    className="w-[14%] px-1 py-2 text-center font-semibold border-r border-slate-200"
                  >
                    IGST
                  </th>

                  <th
                    rowSpan={2}
                    className="w-[14%] px-2 py-3 text-center font-semibold border-r border-slate-200"
                  >
                    Total
                  </th>
                </tr>

                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    %
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    Amt
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    %
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    Amt
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    %
                  </th>
                  <th className="px-1 py-2 text-center font-semibold border-r border-slate-200">
                    Amt
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => openCreditNote(c)}
                    title="Click to view credit note details"
                    className="cursor-pointer hover:bg-brand-50/40 transition-base"
                  >
                    <td className="px-1 py-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                      {i + 1}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500 border-r border-slate-100">
                      {formatDate(c.Date)}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-800 border-r border-slate-100">
                      {c.creditNoteNo}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.sgst > 0 && c.amount > 0
                        ? `${((c.sgst / c.amount) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.sgst)}
                    </td>

                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.cgst > 0 && c.amount > 0
                        ? `${((c.cgst / c.amount) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.cgst)}
                    </td>

                    <td className="px-1 py-3 text-center text-slate-600 border-r border-slate-100">
                      {c.igst > 0 && c.amount > 0
                        ? `${((c.igst / c.amount) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.igst)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-600 border-r border-slate-100">
                      {formatCurrency(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectesdreditNote &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 5mm; }
                body * { visibility: hidden !important; }
                .credit-note-print-area,
                .credit-note-print-area * { visibility: visible !important; }
                .credit-note-print-area {
                  position: absolute !important;
                  inset: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: white !important;
                }
                .credit-note-screen-only { display: none !important; }
                .credit-note-scroll { overflow: visible !important; padding: 0 !important; }
                .credit-note-table { font-size: 7.5px !important; }
                .credit-note-table th,
                .credit-note-table td { padding: 3px 4px !important; }
              }
            `}</style>

            <div className="credit-note-print-area nb-print-panel flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="credit-note-screen-only flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Credit Note
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectesdreditNote.header.creditNoteNo}
                  </h2>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      selectesdreditNote.header.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectesdreditNote.header.status === "Rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectesdreditNote.header.status || "Pending"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectesdreditNote(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="credit-note-scroll min-h-0 flex-1 overflow-y-auto p-2">
                <div className="min-h-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.35fr_.65fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 px-6 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-slate-900">
                            {currentStore?.name || "STORE"}
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                            {currentStore?.address ||
                              currentStore?.location ||
                              "-"}
                          </p>
                          {currentStore?.gst ? (
                            <p className="text-[10px] text-slate-600">
                              GSTIN: {currentStore.gst}
                            </p>
                          ) : null}
                          {currentStore?.phone ? (
                            <p className="text-[10px] text-slate-600">
                              Cell: {currentStore.phone}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 text-[10px] leading-5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Credit Note Details
                      </p>
                      <div className="grid grid-cols-[110px_1fr] gap-y-0.5">
                        <span className="text-slate-500">CN No</span>
                        <span className="font-semibold text-slate-800">
                          {selectesdreditNote.header.creditNoteNo}
                        </span>
                        <span className="text-slate-500">Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selectesdreditNote.header.Date)}
                        </span>
                        <span className="text-slate-500">Through</span>
                        <span className="font-semibold text-slate-800">
                          {selectesdreditNote.header.through || "Direct"}
                        </span>
                        <span className="text-slate-500">Place of Supply</span>
                        <span className="font-semibold text-slate-800">
                          {selectesdreditNote.header.storeLocation ||
                            "Tamil Nadu"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-300 px-4 py-3 text-center">
                    <h3 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                      Credit Note
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="credit-note-table w-full min-w-[1300px] border-collapse text-[8px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-600">
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-left"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            PKG Size
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            Batch No
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            Exp Date
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2"
                          >
                            Qty
                          </th>
                          {/* <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-left"
                          >
                            Reason
                          </th> */}
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-right"
                          >
                            Unit Price
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-right"
                          >
                            Before Discount
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            Discount
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 p-2 text-right"
                          >
                            Taxable (₹)
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            SGST
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 p-1"
                          >
                            IGST
                          </th>
                          <th rowSpan={2} className="p-2 text-right">
                            Line Total
                          </th>
                        </tr>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-600">
                          <th className="border-r border-slate-300 p-1">%</th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 p-1">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amount
                          </th>
                          <th className="border-r border-slate-300 p-1">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amount
                          </th>
                          <th className="border-r border-slate-300 p-1">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 p-1 text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectesdreditNote.rows.map((row, index) => {
                          const qty = Number(row.quantity || 0);
                          const price = Number(row.sellingPrice || 0);
                          const discountAmt = Number(row.discountAmount || 0);
                          const taxable = Number(
                            row.taxableAmount ?? row.amount ?? 0,
                          );
                          const beforeDiscount =
                            price > 0 ? price * qty : taxable + discountAmt;
                          const discountPct = Number(row.discountPercent || 0);
                          const taxPct = Number(row.taxPercent || 0);

                          return (
                            <tr key={row.id} className="border-slate-300">
                              <td className="border-r border-slate-300 p-2 text-center">
                                {index + 1}
                              </td>
                              <td className="border-r border-slate-300 p-2 font-semibold">
                                {row.product || "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.pkgsize || "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.batchNo || "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.expiryDate
                                  ? formatDate(row.expiryDate)
                                  : "-"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.quantity ?? "-"}
                              </td>
                              {/* <td className="border-r border-slate-300 p-2 text-slate-600">
                                {row.reason || "-"}
                              </td> */}
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(price)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right font-semibold">
                                {formatCurrency(beforeDiscount)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {discountPct.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(discountAmt)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right font-semibold">
                                {formatCurrency(taxable)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.cgst > 0
                                  ? (taxPct / 2).toFixed(2)
                                  : "0.00"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(row.cgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.sgst > 0
                                  ? (taxPct / 2).toFixed(2)
                                  : "0.00"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(row.sgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {row.igst > 0 ? taxPct.toFixed(2) : "0.00"}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(row.igst)}
                              </td>
                              <td className="p-2 text-right font-bold">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                      {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(
                          0,
                          MIN_ROWS - selectesdreditNote.rows.length,
                        );
                        const columnCount = 18;

                        return Array.from({ length: fillerCount }).map(
                          (_, i) => (
                            <tr key={`filler-${i}`}>
                              {Array.from({ length: columnCount }).map(
                                (_, colIdx) => (
                                  <td
                                    key={colIdx}
                                    className={`px-1 py-1.5 ${
                                      colIdx < columnCount - 1
                                        ? "border-r border-slate-300"
                                        : ""
                                    }`}
                                  >
                                    &nbsp;
                                  </td>
                                ),
                              )}
                            </tr>
                          ),
                        );
                      })()}

                      <tfoot>
                        {(() => {
                          const rows = selectesdreditNote?.rows ?? [];
                          const totalQty = rows.reduce(
                            (s, r) => s + Number(r.quantity || 0),
                            0,
                          );
                          const totalBeforeDiscount = rows.reduce((s, r) => {
                            const qty = Number(r.quantity || 0);
                            const price = Number(r.sellingPrice || 0);
                            const discountAmt = Number(r.discountAmount || 0);
                            const taxable = Number(
                              r.taxableAmount ?? r.amount ?? 0,
                            );
                            const beforeDiscount =
                              price > 0 ? price * qty : taxable + discountAmt;
                            return s + beforeDiscount;
                          }, 0);
                          const totalDiscountAmt = rows.reduce(
                            (s, r) => s + Number(r.discountAmount || 0),
                            0,
                          );
                          const totalTaxable = rows.reduce(
                            (s, r) =>
                              s + Number(r.taxableAmount ?? r.amount ?? 0),
                            0,
                          );
                          const totalCgst = rows.reduce(
                            (s, r) => s + Number(r.cgst || 0),
                            0,
                          );
                          const totalSgst = rows.reduce(
                            (s, r) => s + Number(r.sgst || 0),
                            0,
                          );
                          const totalIgst = rows.reduce(
                            (s, r) => s + Number(r.igst || 0),
                            0,
                          );
                          const totalLine = rows.reduce(
                            (s, r) => s + Number(r.total || 0),
                            0,
                          );

                          return (
                            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                              <td
                                colSpan={5}
                                className="border-r border-slate-300 p-2 text-center"
                              >
                                Total
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {totalQty}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalBeforeDiscount)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalDiscountAmt)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalTaxable)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalSgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalCgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalIgst)}
                              </td>
                              <td className="p-2 text-right">
                                {formatCurrency(totalLine)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {/* ROW 1: Amount in Words (left) + Round Off / Total (right) */}
                  <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                    {(() => {
                      const header = selectesdreditNote.header;
                      const rows = selectesdreditNote.rows;
                      const lineSum = rows.reduce(
                        (sum, row) => sum + Number(row.total || 0),
                        0,
                      );
                      const computed = roundOffToRupee(lineSum);
                      const taxable = rows.reduce(
                        (sum, row) =>
                          sum + Number(row.taxableAmount ?? row.amount ?? 0),
                        0,
                      );
                      const sgst = rows.reduce((sum, row) => sum + Number(row.sgst || 0), 0);
                      const cgst = rows.reduce((sum, row) => sum + Number(row.cgst || 0), 0);
                      const igst = rows.reduce((sum, row) => sum + Number(row.igst || 0), 0);
                      const roundOff =
                        typeof header.roundOff === "number"
                          ? Number(header.roundOff)
                          : computed.roundOff;
                      const grandTotal =
                        typeof header.documentTotal === "number"
                          ? Number(header.documentTotal)
                          : computed.payable;
                      return (
                        <>
                    <div className="border-r border-slate-300 p-3 flex items-center">
                      <p className="text-[12px] font-semibold text-slate-700">
                        Amount in Words:{" "}
                        <span className="font-bold text-slate-900">
                          {numberToWords(grandTotal)}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-1.5 p-3 text-[11px]">
                      <SummaryRow label="Taxable Amount" value={formatCurrency(taxable)} />
                      <SummaryRow label="SGST" value={formatCurrency(sgst)} />
                      <SummaryRow label="CGST" value={formatCurrency(cgst)} />
                      <SummaryRow label="IGST" value={formatCurrency(igst)} />
                      <SummaryRow label="Round Off" value={formatRoundOff(roundOff)} muted />

                      <div className="flex items-center justify-between border-t border-slate-300 pt-2">
                        <span className="text-sm font-bold text-slate-900">
                          Grand Total
                        </span>
                        <span className="text-base font-extrabold text-slate-900">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                  <div className="grid min-h-[110px] grid-cols-[1fr_300px] border-t border-slate-300">
                    {/* NOTES */}
                    <div className="flex flex-col justify-end border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>

                      {(() => {
                        const defaultNotes = `Purchase order raised by ${
                          currentStore?.name ?? "this store"
                        } to Nature Biotic.`;

                        return (
                          <>
                            {/* Screen - Editable Notes */}
                            <textarea
                              value={purchaseOrderNotes}
                              onChange={(e) =>
                                setPurchaseOrderNotes(e.target.value)
                              }
                              rows={2}
                              placeholder="Enter notes..."
                              className="po-print-hide mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 focus:border-brand-500 focus:outline-none"
                            />

                            {/* Print - Show edited notes */}
                            <p className="po-print-only mt-1.5 hidden whitespace-pre-line text-xs text-slate-500">
                              {purchaseOrderNotes || defaultNotes}
                            </p>
                          </>
                        );
                      })()}
                    </div>

                    {/* AUTHORISED SIGNATORY */}
                    <div className="flex items-end justify-center p-3">
                      <div className="w-full text-center">
                        <div className="border-b border-slate-300" />
                        <p className="mt-1.5 text-xs font-semibold text-slate-500">
                          Authorised Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="credit-note-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <Button
                  variant="secondary"
                  onClick={() => setSelectesdreditNote(null)}
                >
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Credit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Create Creditnote — full-screen form, rendered via portal so it always sits above everything and scrolls properly */}
      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="nb-modal-panel flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Header (fixed, does not scroll) */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Credit Note
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {usesSupabaseData()
                      ? "Credit products from this store's approved sales returns. This store credit note does not change stock or payments."
                      : "Create a GST credit note. This does not change sales, stock, or payments."}
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

              {/* Scrollable body (everything between header and footer) */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Basic details */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Date"
                      type="date"
                      value={returnDate}
                      onChange={setReturnDate}
                      required
                    />

                    <Input
                      label="Credit Note Number"
                      value={creditNoteNo}
                      onChange={() => {}}
                      readOnly
                      required
                    />

                    <Input
                      label="Created Through"
                      value="Direct"
                      onChange={() => {}}
                      readOnly
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

                    <div className="md:col-span-2">
                      <Input
                        label="Remarks"
                        value={remarks}
                        onChange={setRemarks}
                        placeholder="Optional GST notes"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Entry */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 px-6">
                    Add Product
                  </h4>

                  {usesSupabaseData() ? (
                    <div className="mx-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      {salesReturnCreditsLoading ? (
                        <p className="text-sm text-slate-500">Loading returned products…</p>
                      ) : salesReturnCreditError && salesReturnCredits.length === 0 ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {salesReturnCreditError}
                        </p>
                      ) : salesReturnCredits.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                          No approved sales return quantity is left to credit for this store.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Select
                              label="Select Product"
                              value={entry.productId}
                              onChange={(id) => {
                                const line = salesReturnCredits.find((row) => row.id === id);
                                setCreditQtyRaw("");
                                setSalesReturnCreditError("");
                                if (!line) {
                                  setEntry((current) => ({
                                    ...current,
                                    productId: "",
                                    productName: "",
                                    pkgsize: "",
                                    batchNo: "",
                                    expiryDate: "",
                                    quantity: 0,
                                    sellingPrice: 0,
                                    discount: 0,
                                  }));
                                  return;
                                }
                                setEntry((current) => ({
                                  ...current,
                                  productId: line.id,
                                  productName: line.productName,
                                  pkgsize: line.packSize,
                                  batchNo: line.batchNo,
                                  expiryDate: line.expiryDate,
                                  quantity: 0,
                                  sellingPrice: line.unitPrice,
                                  discount: line.discountPercent,
                                  reason: line.reason,
                                }));
                              }}
                              placeholder="Select a returned product"
                              options={salesReturnCredits.map((line) => ({
                                value: line.id,
                                label: salesReturnCredits.filter((row) => row.productName === line.productName).length > 1
                                  ? `${line.productName} · ${line.packSize} · ${line.batchNo} · ${line.returnNo}`
                                  : line.productName,
                              }))}
                            />
                            <div>
                              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                Quantity
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={selectedReturnLine ? wholeCount(selectedReturnLine.availableQty) ?? 0 : 0}
                                step={1}
                                value={creditQtyRaw}
                                disabled={!selectedReturnLine}
                                onKeyDown={(event) => {
                                  if (["e", "E", "+", "-", "."].includes(event.key)) event.preventDefault();
                                }}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next !== "" && !/^\d+$/.test(next)) {
                                    setSalesReturnCreditError("Credit quantity must be a whole number.");
                                    return;
                                  }
                                  setCreditQtyRaw(next);
                                  setSalesReturnCreditError(
                                    selectedReturnLine ? returnQuantityMessage(selectedReturnLine, next) : "",
                                  );
                                }}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-brand-500 focus:outline-none"
                              />
                              {selectedReturnLine ? (
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  Available {wholeCount(selectedReturnLine.availableQty) ?? selectedReturnLine.availableQty}
                                </p>
                              ) : null}
                            </div>
                            <Button
                              onClick={addProduct}
                              disabled={!selectedReturnLine || !creditQtyRaw || Boolean(returnQuantityMessage(selectedReturnLine!, creditQtyRaw)) || typedWholeCount(creditQtyRaw) === 0}
                              className="h-[50px] self-end"
                            >
                              <Icon name="add" size={18} />
                              Add Product
                            </Button>
                          </div>
                          {salesReturnCreditError ? (
                            <p className="mt-3 text-sm text-red-600">{salesReturnCreditError}</p>
                          ) : null}
                          {selectedReturnLine ? (
                            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-6">
                              <DetailField label="Product" value={selectedReturnLine.productName} />
                              <DetailField label="HSN" value={selectedReturnLine.hsnCode || "-"} />
                              <DetailField label="Package size" value={selectedReturnLine.packSize || "-"} />
                              <DetailField label="Batch" value={selectedReturnLine.batchNo || "-"} />
                              <DetailField label="Expiry" value={selectedReturnLine.expiryDate ? formatDate(selectedReturnLine.expiryDate) : "-"} />
                              <DetailField label="Sales return" value={selectedReturnLine.returnNo} />
                              <DetailField label="Unit rate" value={formatCurrency(selectedReturnLine.unitPrice)} />
                              <DetailField label="Discount" value={formatCurrency(selectedReturnLine.discountAmount)} />
                              <DetailField label="GST %" value={`${selectedReturnLine.taxPercent.toFixed(2)}%`} />
                              <DetailField label="SGST" value={formatCurrency(selectedReturnLine.sgst)} />
                              <DetailField label="CGST" value={formatCurrency(selectedReturnLine.cgst)} />
                              <DetailField label="IGST" value={formatCurrency(selectedReturnLine.igst)} />
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {!usesSupabaseData() && (
                  <div className="mx-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-3 items-end">
                      <Select
                        label="Select Product"
                        value={entry.productName}
                        onChange={chooseCreditProduct}
                        placeholder="Select"
                        options={creditProductNames().map((name) => ({
                          value: name,
                          label: name,
                        }))}
                      />

                      {creditSizes(entry.productName).length > 1 ? (
                        <Select
                          label="PKG Size"
                          value={entry.pkgsize}
                          onChange={chooseCreditSize}
                          placeholder="Select size"
                          options={creditSizes(entry.productName).map((size) => ({
                            value: size,
                            label: size,
                          }))}
                        />
                      ) : (
                        <Input
                          label="PKG Size"
                          value={entry.pkgsize}
                          onChange={() => {}}
                          placeholder="Auto"
                          readOnly
                        />
                      )}

                      {creditBatches(entry.productName, entry.pkgsize).length > 1 ? (
                        <Select
                          label="Batch No"
                          value={entry.batchNo}
                          onChange={chooseCreditBatch}
                          placeholder="Select batch"
                          options={creditBatches(entry.productName, entry.pkgsize).map(
                            (batch) => ({ value: batch, label: batch }),
                          )}
                          required
                        />
                      ) : (
                        <Input
                          label="Batch No"
                          value={entry.batchNo}
                          onChange={(v) =>
                            creditBatches(entry.productName, entry.pkgsize).length === 0
                              ? setEntry((p) => ({ ...p, batchNo: v }))
                              : undefined
                          }
                          placeholder={entry.pkgsize ? "Auto" : "Select size first"}
                          readOnly={
                            creditBatches(entry.productName, entry.pkgsize).length === 1
                          }
                          required
                        />
                      )}

                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, expiryDate: v }))
                        }
                        readOnly={Boolean(invoiceNo)}
                        required
                      />

                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) => {
                          const next = Math.max(0, Number(v) || 0);
                          const max = maxCreditQuantity();
                          setEntry((p) => ({
                            ...p,
                            quantity: max > 0 ? Math.min(next, max) : 0,
                          }));
                        }}
                      />

                      <Input
                        label="Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={(v) =>
                          invoiceNo
                            ? undefined
                            : setEntry((p) => ({
                                ...p,
                                sellingPrice: Number(v) || 0,
                              }))
                        }
                        readOnly={Boolean(invoiceNo)}
                      />

                      <Input
                        label="Discount %"
                        type="number"
                        value={String(entry.discount)}
                        onChange={(v) =>
                          invoiceNo
                            ? undefined
                            : setEntry((p) => ({
                                ...p,
                                discount: Number(v) || 0,
                              }))
                        }
                        readOnly={Boolean(invoiceNo)}
                      />

                      <Input
                        label="Reason"
                        type="text"
                        value={entry.reason}
                        onChange={(v) => setEntry((p) => ({ ...p, reason: v }))}
                        placeholder="Enter reason"
                      />

                      <Button
                        onClick={addProduct}
                        disabled={!canAdd}
                        className="w-full h-[50px] px-3"
                      >
                        <Icon name="add" size={18} />
                        <span className="whitespace-nowrap">Add Product</span>
                      </Button>
                    </div>

                    {/* Original invoice line details */}
                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-200">
                        <DetailField
                          label="Product"
                          value={entryProduct.product?.name || "Product"}
                        />
                        <DetailField
                          label="Pack Size"
                          value={
                            (entryProduct as any).pkgsize ||
                            entryProduct.packSize ||
                            "-"
                          }
                        />
                        <DetailField
                          label="HSN"
                          value={(entryProduct as any).hsn || "-"}
                        />
                        <DetailField
                          label="Sold Qty"
                          value={String(entryProduct.quantity)}
                        />
                        <DetailField
                          label="Unit Price"
                          value={formatCurrency(entryProduct.sellingPrice)}
                        />
                        <DetailField
                          label="Discount %"
                          value={`${Number((entryProduct as any).discountPercent || 0).toFixed(2)}%`}
                        />
                        <DetailField
                          label="Tax %"
                          value={`${Number((entryProduct as any).taxPercent || 0).toFixed(2)}%`}
                        />
                        <DetailField
                          label="Invoice Total"
                          value={formatCurrency(entryProduct.rowTotal)}
                        />
                      </div>
                    )}
                  </div>
                  )}
                </section>

                {/* Added Products list */}
                <section className="mt-6">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 px-6">
                    Added Products ({added.length})
                  </h4>

                  {added.length === 0 ? (
                    <div className="mx-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      No products added yet. Fill the form above and click "Add
                      Product".
                    </div>
                  ) : (
                    <div className="mx-6 overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                            <th className="px-3 py-2 text-left font-semibold">
                              Product
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Batch
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Price
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Disc %
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Taxable
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              SGST
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              CGST
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              IGST
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Total
                            </th>
                            <th className="px-3 py-2 text-center font-semibold"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {added.map((item) => (
                            <tr
                              key={item.key}
                              className="border-t border-slate-100 hover:bg-slate-50/50"
                            >
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                {item.productName}
                              </td>
                              <td className="px-3 py-2 text-slate-500">
                                {item.batchNo}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.sourceItemId ? item.availableQty : undefined}
                                  step={item.sourceItemId ? 1 : undefined}
                                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center"
                                  value={item.quantity}
                                  onKeyDown={(event) => {
                                    if (item.sourceItemId && ["e", "E", "+", "-", "."].includes(event.key)) {
                                      event.preventDefault();
                                    }
                                  }}
                                  onChange={(e) =>
                                    updateAdded(item.key, {
                                      quantity: e.target.value === "" ? 0 : Number(e.target.value),
                                    })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  readOnly={Boolean(item.sourceItemId)}
                                  className="w-20 rounded border border-slate-200 px-1 py-0.5 text-center read-only:bg-slate-50"
                                  value={item.sellingPrice}
                                  onChange={(e) =>
                                    updateAdded(item.key, {
                                      sellingPrice: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  readOnly={Boolean(item.sourceItemId)}
                                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center read-only:bg-slate-50"
                                  value={item.discount}
                                  onChange={(e) =>
                                    updateAdded(item.key, {
                                      discount: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.taxableAmount)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.sgst)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.cgst)}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {formatCurrency(item.igst)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-700">
                                {formatCurrency(item.total)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAdded(item.key)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Summary */}
                {added.length > 0 && (
                  <section className="mt-6 px-6 pb-6">
                    <div className="ml-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
                      <SummaryRow
                        label="Subtotal"
                        value={formatCurrency(totals.subtotal)}
                        muted
                      />
                      <SummaryRow
                        label="Discount"
                        value={`- ${formatCurrency(totals.totalDiscount)}`}
                        muted
                      />
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
                      <div className="border-t border-slate-200 pt-2">
                        <SummaryRow
                          label="Grand Total"
                          value={formatCurrency(totals.grandTotal)}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer (fixed, does not scroll) */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveDraft}
                  disabled={!creditNoteNo}
                >
                  <Icon name="save" size={18} />
                  Save Draft
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Credit Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
