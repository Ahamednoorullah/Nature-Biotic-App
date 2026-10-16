import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatRoundOff,
  money,
  matchesSimpleDate,
  roundOffToRupee,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";
import {
  getProductMaster,
  productMasterUpdatedEvent,
  getStore,
  getFarmersByStore,
  getStorePurchasesFromCompanySales,
  getFROStockByExecutive,
  getStoreAvailableQty,
  getStoreStockLines,
  getStaffByStore,
  reduceFROStock,
  nextStoreDocumentNo,
  rememberStoreDocumentNo,
  type Product,
} from "@/lib/data";
import { loadCatalog } from "@/lib/db/products";
import { roleForStaffDesignation } from "@/lib/auth/roles";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";
import { usesSupabaseData } from "@/lib/db/mode";
import { loadSalesInvoices, createSalesInvoiceDb, loadQuotations, convertQuotationToInvoiceDb, type DbQuotation } from "@/lib/db/sales";
import { peekDocumentNo, type RpcLine } from "@/lib/db/rpc";
import { refreshPurchasingData } from "@/lib/db/purchasing";
import { dbErrorMessage } from "@/lib/db/errors";
import { StoreInvoiceBillModal } from "@/components/StoreInvoiceBillModal";
import { CommonDocumentBill } from "@/components/CommonDocumentBill";
import {
  FroDocumentActions,
} from "@/components/FroDocumentActions";
import {
  detailedShareMessage,
  farmerContactText,
} from "@/lib/whatsappShare";
import {
  DOCUMENT_PDF_WIDTH_PX,
  documentPdfFileName,
  printDocumentPdf,
  shareDocumentPdf,
} from "@/lib/documentPdf";

type SaleType = "Direct" | "Executive";

type SaleRow = {
  notes: string;
  id: string;
  date: string;
  invoiceNo: string;
  through: SaleType;
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
  roundOff?: number;
  products: AddedRow[];
};

type EntryForm = {
  productId: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
};

type AddedRow = {
  igst: number;
  cgst: number;
  sgst: number;
  key: string;
  productId: string;
  variantId?: string;
  batchId?: string;
  product?: Product;
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
};

const STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

function isSampleSale(row: { id?: string; invoiceNo?: string }) {
  return (
    row.id === "store-sale-1" ||
    String(row.invoiceNo || "").trim().toLowerCase() === "nb-inv-2001"
  );
}

function emptyEntry(): EntryForm {
  return {
    productId: "",
    pkgsize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    sellingPrice: 0,
    discount: 0,
  };
}

function formatDateInput(value: string) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(-2)}`;
}

export default function StoreSalesInvoice({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage, goFarmerProfile } = useNav();
  const isFRO = user?.role === "fro";
  const froName = user?.name?.trim() || "";
  const storageKey = `${STORAGE_KEY}:${storeId}`;
  const store = getStore(storeId);
  const storeFarmers = useMemo(() => getFarmersByStore(storeId), [storeId]);
  const storeExecutives = useMemo(
    () =>
      getStaffByStore(storeId)
        .filter((member) => member.status !== "Inactive")
        .filter((member) => roleForStaffDesignation(member.designation) === "fro")
        .map((member) => member.name.trim())
        .filter(Boolean),
    [storeId],
  );

  const [rows, setRows] = useState<SaleRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((row) => !isSampleSale(row)) : [];
    } catch {
      return [];
    }
  });
  const [listLoading, setListLoading] = useState(usesSupabaseData());
  const [listError, setListError] = useState("");
  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const openedInvoice = useRef(false);
  const invoiceReturn = useRef<{ from?: string; farmerId?: string } | null>(
    null,
  );

  function closeSelectedInvoice() {
    const back = invoiceReturn.current;
    invoiceReturn.current = null;
    setSelectedSale(null);
    if (back?.from === "farmer-details" && back.farmerId) {
      sessionStorage.setItem(
        "nature-biotic-farmer-profile-tab",
        JSON.stringify({ farmerId: back.farmerId, tab: "invoices" }),
      );
      goFarmerProfile(back.farmerId);
    }
  }

  const reloadDbInvoices = async () => {
    if (!usesSupabaseData()) return;
    setListLoading(true);
    setListError("");
    try {
      const data = await loadSalesInvoices(storeId);
      setRows(data as unknown as SaleRow[]);
    } catch (error) {
      setRows([]);
      setListError(dbErrorMessage(error, "Could not load sales invoices."));
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (!usesSupabaseData()) return;
    void reloadDbInvoices();
    loadQuotations(storeId)
      .then((rows) => {
        setOpenQuotations(
          rows.filter((row) => String(row.status || "").toLowerCase() === "open"),
        );
      })
      .catch(() => {
        setOpenQuotations([]);
      });
  }, [storeId]);

  useEffect(() => {
    if (usesSupabaseData()) return;
    const cleaned = rows.filter((row) => !isSampleSale(row));
    if (cleaned.length === rows.length) return;
    setRows(cleaned);
    try {
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
    } catch {
      // The list still hides the sample invoice.
    }
  }, [rows, storageKey]);

  useEffect(() => {
    if (openedInvoice.current) return;
    const raw = sessionStorage.getItem("nature-biotic-open-store-invoice");
    if (!raw) return;
    sessionStorage.removeItem("nature-biotic-open-store-invoice");
    openedInvoice.current = true;
    try {
      const target = JSON.parse(raw) as {
        storeId?: string;
        invoiceNo?: string;
        from?: string;
        farmerId?: string;
      };
      if (target.storeId !== storeId || !target.invoiceNo) return;
      if (target.from === "farmer-details" && target.farmerId) {
        invoiceReturn.current = {
          from: target.from,
          farmerId: target.farmerId,
        };
      }
      const match = rows.find((row) => row.invoiceNo === target.invoiceNo);
      if (match) setSelectedSale(match);
    } catch {
      // Ignore a stale invoice request.
    }
  }, [rows, storeId]);

  useEffect(() => {
    if (isFRO) {
      setThrough("Executive");
      setExecutiveName(froName);
    }
  }, [isFRO, froName]);
  const [stockVersion, setStockVersion] = useState(0);
  const savingSale = useRef(false);
  const [productMaster, setProductMaster] = useState<Product[]>(() =>
    getProductMaster(),
  );

  useEffect(() => {
    const refresh = () => setProductMaster(getProductMaster());
    window.addEventListener(productMasterUpdatedEvent, refresh);
    if (usesSupabaseData() && getProductMaster().length === 0) {
      void loadCatalog().then(setProductMaster);
    }
    return () => window.removeEventListener(productMasterUpdatedEvent, refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setStockVersion((version) => version + 1);
    window.addEventListener("nature-biotic-store-inventory-updated", refresh);
    window.addEventListener("fro-stock-updated", refresh);
    window.addEventListener("company-store-sales-updated", refresh);
    window.addEventListener("fro-accepted-deliveries-updated", refresh);
    window.addEventListener("nature-biotic-store-stock-return-updated", refresh);
    return () => {
      window.removeEventListener("nature-biotic-store-inventory-updated", refresh);
      window.removeEventListener("fro-stock-updated", refresh);
      window.removeEventListener("company-store-sales-updated", refresh);
      window.removeEventListener("fro-accepted-deliveries-updated", refresh);
      window.removeEventListener(
        "nature-biotic-store-stock-return-updated",
        refresh,
      );
    };
  }, []);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [invoiceNo, setInvoiceNo] = useState("");
  const [through, setThrough] = useState<SaleType>(
    isFRO ? "Executive" : "Direct",
  );
  const [partyName, setPartyName] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [openQuotations, setOpenQuotations] = useState<DbQuotation[]>([]);
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerVillage, setFarmerVillage] = useState("");
  const [farmerCrop, setFarmerCrop] = useState("");
  const [farmerAcre, setFarmerAcre] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");
  const [executiveName, setExecutiveName] = useState(froName);
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [added, setAdded] = useState<AddedRow[]>([]);

  const registeredFarmers = useMemo(() => {
    const storeFarmers = getFarmersByStore(storeId);

    if (!isFRO) return storeFarmers;

    const normalizedFroName = froName.toLowerCase();
    return storeFarmers.filter(
      (farmer) =>
        String(farmer.executiveName || "")
          .trim()
          .toLowerCase() === normalizedFroName,
    );
  }, [storeId, isFRO, froName]);

  const visibleRows = useMemo(() => {
    if (!isFRO) return rows;

    const staffKey = String(user?.staffId || user?.id || "");
    const normalizedFroName = froName.toLowerCase();
    return rows.filter((row) => {
      const byName = row.executiveName?.trim().toLowerCase() === normalizedFroName;
      const byStaff =
        Boolean(row.createdByStaffId) &&
        Boolean(staffKey) &&
        String(row.createdByStaffId) === staffKey;
      return byName || byStaff;
    });
  }, [rows, isFRO, froName, user?.staffId, user?.id]);

  const invoiceListMessage = listError
    || (listLoading ? "Loading sales invoices..." : "No sales invoices found.");

  const listedRows = useMemo(
    () =>
      visibleRows.filter((row) =>
        matchesSimpleDate(row.date, dateFilter, customFrom, customTo),
      ),
    [visibleRows, dateFilter, customFrom, customTo],
  );

  function nextInvoiceNo(current = rows) {
    return nextStoreDocumentNo(
      store?.code || "ST",
      "INV",
      current.map((row) => row.invoiceNo),
    );
  }
   const storePurchaseRows = useMemo(
    () => (getStorePurchasesFromCompanySales(storeId) || []) as any[],
    [storeId, stockVersion],
  );

  const storeStockVariants = useMemo(() => {
    const seen = new Map<string, any>();
    storePurchaseRows.forEach((row: any) => {
      const name = String(row.productName ?? row.product ?? "").trim();
      const size = String(row.packSize ?? row.pkgsize ?? row.size ?? "").trim();
      const batchNo = String(row.batchNo ?? "");
      if (!name) return;
      const master = productMaster.find(
        (p) =>
          (row.productId && p.id === row.productId) ||
          (p.name.toLowerCase() === name.toLowerCase() &&
            p.size.trim().toLowerCase() === size.toLowerCase()),
      );
      const productId = String(master?.id ?? row.productId ?? "");
      const key = `${productId || name.toLowerCase()}|${size.toLowerCase()}|${batchNo.toLowerCase()}`;
      if (seen.has(key)) return;
      const quantity = getStoreAvailableQty(storeId, productId, size, batchNo, name);
      if (quantity <= 0) return;
      const stockLine = getStoreStockLines(storeId).find(
        (line) =>
          line.variantId === productId &&
          line.batchNo.trim().toLowerCase() === batchNo.trim().toLowerCase() &&
          line.available > 0,
      );
      const defaultSellingPrice =
        Number(master?.sellingPrice ?? 0) > 0
          ? Number(master?.sellingPrice)
          : Number(row.sellingPrice ?? 0);
      seen.set(key, {
        key,
        productId: productId || key,
        variantId: stockLine?.variantId || productId,
        batchId: stockLine?.batchId || "",
        product: master,
        name,
        size,
        batchNo,
        expiryDate: String(row.expiryDate ?? ""),
        quantity,
        sellingPrice: defaultSellingPrice,
        taxPercentage: Number(
          master?.taxPercentage ?? row.taxPercent ?? row.taxPercentage ?? 0,
        ),
      });
    });
    return Array.from(seen.values());
  }, [storePurchaseRows, storeId, productMaster]);

  // FRO's own delivered stock — used when Through = Executive
    const froStockVariants = useMemo(() => {
    if (through !== "Executive" || !executiveName) return [];
    return getFROStockByExecutive(storeId, executiveName, isFRO ? user?.staffId : undefined)
      .map((item: any, index: number) => {
        const master = productMaster.find(
          (p) =>
            p.id === item.productId ||
            (p.name.toLowerCase() === (item.productName || "").toLowerCase() &&
              p.size.trim().toLowerCase() === (item.packSize || "").trim().toLowerCase()),
        );
        const defaultSellingPrice =
          Number(master?.sellingPrice ?? 0) > 0
            ? Number(master?.sellingPrice)
            : Number(item.sellingPrice ?? 0);
        return {
          key: `${item.variantId || item.productId}-${item.packSize}-${item.batchNo}-${item.expiryDate}-${index}`,
          productId: master?.id || item.variantId || item.productId,
          variantId: item.variantId || master?.id || item.productId,
          batchId: item.batchId || "",
          product: master,
          name: item.productName,
          size: item.packSize,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          quantity: item.currentQty,
          sellingPrice: defaultSellingPrice,
          taxPercentage: Number(master?.taxPercentage ?? item.taxPercent ?? 0),
        };
      })
      .filter((item: any) => item.name && item.quantity > 0);
  }, [through, executiveName, storeId, stockVersion, productMaster, isFRO, user?.staffId]);

  // Switch source based on sale type
  const activeStockVariants =
    through === "Executive" ? froStockVariants : storeStockVariants;

  const storeProductChoices = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    activeStockVariants.forEach((item: { name: string }) => {
      const key = item.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { value: item.name, label: item.name });
    });
    return Array.from(seen.values());
  }, [activeStockVariants]);

  const selectedProductName =
    activeStockVariants.find((item) => item.productId === entry.productId)
      ?.name || "";

  const selectedSizeVariants = useMemo(
    () =>
      activeStockVariants.filter((item) => item.name === selectedProductName),
    [activeStockVariants, selectedProductName],
  );

  const entryProduct = productMaster.find((p) => p.id === entry.productId);

  const totals = useMemo(() => {
    const withoutTax = money(added.reduce((sum, row) => sum + row.withoutTax, 0));
    const sgst = money(added.reduce((sum, row) => sum + row.sgst, 0));
    const cgst = money(added.reduce((sum, row) => sum + row.cgst, 0));
    const igst = money(added.reduce((sum, row) => sum + row.igst, 0));
    const exact = money(added.reduce((sum, row) => sum + row.rowTotal, 0));
    const rounded = roundOffToRupee(exact);
    return {
      withoutTax,
      sgst,
      cgst,
      igst,
      exact,
      roundOff: rounded.roundOff,
      grandTotal: rounded.payable,
    };
  }, [added]);

  const farmerQuotations = useMemo(
    () => openQuotations.filter((row) => row.farmerId && row.farmerId === farmerId),
    [openQuotations, farmerId],
  );

  function selectFarmer(id: string, preserveQuotation = false) {
    if (!preserveQuotation && id !== farmerId) {
      setQuotationId("");
      setAdded((current) => current.filter((row) => !row.key.startsWith("quote-")));
    }
    setFarmerId(id);
    const farmer = registeredFarmers.find((item) => item.id === id);
    if (!farmer) {
      setPartyName("");
      setFarmerPhone("");
      setFarmerVillage("");
      setFarmerCrop("");
      setFarmerAcre("");
      return;
    }

    setPartyName(farmer.name || "");
    setFarmerPhone(farmer.phone || "");
    setFarmerVillage(farmer.village || "");
    setFarmerCrop(farmer.cropType || farmer.crops?.[0]?.cropType || "");
    const acre =
      Number(farmer.landSize || 0) || Number(farmer.crops?.[0]?.landSize || 0);
    setFarmerAcre(acre > 0 ? String(acre) : "");
    setPlaceOfSupply(
      (farmer.state || "").toLowerCase() === "tamil nadu"
        ? "Tamil Nadu"
        : "Others",
    );
  }

  function selectProductName(productName: string) {
    const first = activeStockVariants.find(
      (item: { name: string }) => item.name === productName,
    );
    setEntry((prev) => ({
      ...prev,
      productId: first?.productId || "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      sellingPrice: 0,
    }));
  }

  function maxEntryQty(
    productId: string,
    pkgsize: string,
    batchNo: string,
    expiryDate: string,
  ) {
    const selectedStock = activeStockVariants.find(
      (item) =>
        item.productId === productId &&
        item.size === pkgsize &&
        item.batchNo === batchNo &&
        item.expiryDate === expiryDate,
    );
    if (!selectedStock) return 0;
    const reserved = added
      .filter(
        (item) =>
          item.productId === productId &&
          item.pkgsize === pkgsize &&
          item.batchNo === batchNo,
      )
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return Math.max(0, Number(selectedStock.quantity || 0) - reserved);
  }

  function clampStockQty(raw: string, max: number) {
    const parsed = Number(String(raw).trim());
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(Math.floor(parsed), Math.max(0, max));
  }

  function batchesForEntrySize(size: string) {
    const seen = new Map<string, (typeof selectedSizeVariants)[number]>();
    selectedSizeVariants
      .filter((item) => item.size === size && String(item.batchNo || "").trim())
      .forEach((item) => {
        const key = String(item.batchNo).trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, item);
      });
    return Array.from(seen.values());
  }

  function selectProductSize(size: string) {
    const batches = batchesForEntrySize(size);
    const variant = batches.length === 1 ? batches[0] : undefined;
    const fallback = selectedSizeVariants.find((item) => item.size === size);
    setEntry((prev) => {
      const productId = variant?.productId || fallback?.productId || prev.productId;
      const batchNo = variant?.batchNo || "";
      const expiryDate = variant?.expiryDate || "";
      const max = batchNo
        ? maxEntryQty(productId, size, batchNo, expiryDate)
        : 0;
      const current = prev.quantity > 0 ? prev.quantity : 1;
      return {
        ...prev,
        productId,
        pkgsize: size,
        batchNo,
        expiryDate,
        sellingPrice: variant?.sellingPrice || fallback?.sellingPrice || 0,
        quantity: batchNo ? Math.min(current, max) : 0,
      };
    });
  }

  function selectEntryBatch(batchNo: string) {
    const variant = selectedSizeVariants.find(
      (item) => item.size === entry.pkgsize && item.batchNo === batchNo,
    );
    if (!variant) return;
    setEntry((prev) => {
      const max = maxEntryQty(
        variant.productId,
        prev.pkgsize,
        batchNo,
        variant.expiryDate,
      );
      return {
        ...prev,
        productId: variant.productId,
        batchNo,
        expiryDate: variant.expiryDate,
        sellingPrice: variant.sellingPrice || 0,
        quantity: Math.min(prev.quantity > 0 ? prev.quantity : 1, max),
      };
    });
  }

  function setEntryQuantity(raw: string) {
    setEntry((prev) => ({
      ...prev,
      quantity: clampStockQty(
        raw,
        maxEntryQty(prev.productId, prev.pkgsize, prev.batchNo, prev.expiryDate),
      ),
    }));
  }

  function addProduct() {
    if (
      !entry.productId ||
      !entry.pkgsize ||
      !entry.batchNo ||
      entry.quantity < 1
    ) {
      window.alert("Please select a product, pack size, batch number, and quantity.");
      return;
    }

    const selectedStock = activeStockVariants.find(
      (item) =>
        item.productId === entry.productId &&
        item.size === entry.pkgsize &&
        item.batchNo === entry.batchNo,
    );
    if (!selectedStock) {
      window.alert("Selected stock batch is not available.");
      return;
    }

    const product =
      selectedStock?.product ||
      productMaster.find((p) => p.id === entry.productId) ||
      productMaster.find(
        (p) =>
          p.name.toLowerCase() === selectedStock.name.toLowerCase() &&
          p.size.trim().toLowerCase() === selectedStock.size.trim().toLowerCase(),
      );

    const safeProduct: Product = product || {
      id: entry.productId,
      storeId: "catalog",
      name: selectedStock.name,
      purpose: "General",
      productCategory: "Bio-stimulant",
      productType: "Liquid",
      manufacturer: "",
      vendor: "",
      unit: "bottle",
      size: entry.pkgsize,
      hsnCode: "",
      purchasePrice: 0,
      sellingPrice: entry.sellingPrice || selectedStock.sellingPrice || 0,
      mrp: 0,
      taxType: "Intrastate",
      taxPercentage: selectedStock.taxPercentage || 0,
      sgst: (selectedStock.taxPercentage || 0) / 2,
      cgst: (selectedStock.taxPercentage || 0) / 2,
      igst: 0,
      description: "",
      usageInstructions: "",
      safetyInfo: "",
      storageInfo: "",
      stock: selectedStock.quantity || 0,
      minStock: 0,
      maxStock: 0,
      reservedStock: 0,
      warehouse: "",
      lastUpdated: new Date().toISOString().slice(0, 10),
      status: "Active",
      sold: 0,
      imageColor: "emerald",
      applicationMethods: [],
      dosage: 0,
      dosageUnit: "",
      filler: 0,
      fillerUnit: "",
      fillerType: "Water",
    };

    const reserved = added
      .filter(
        (item) =>
          item.productId === entry.productId &&
          item.pkgsize === entry.pkgsize &&
          item.batchNo === entry.batchNo,
      )
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (entry.quantity + reserved > selectedStock.quantity) {
      window.alert(
        `Only ${Math.max(0, selectedStock.quantity - reserved)} available in ${through === "Executive" ? "FRO" : "store"} stock.`,
      );
      return;
    }

    const sellingPrice = money(
      entry.sellingPrice !== undefined && entry.sellingPrice !== null && !isNaN(entry.sellingPrice) && entry.sellingPrice > 0
        ? entry.sellingPrice
        : selectedStock.sellingPrice || safeProduct.sellingPrice || 0,
    );
    const gross = money(entry.quantity * sellingPrice);
    const discount = money(Math.max(0, Number(entry.discount || 0)));
    const withoutTax = money(Math.max(0, gross - discount));
    const taxPercent =
      selectedStock.taxPercentage || safeProduct.taxPercentage || 0;
    const taxAmount = money((withoutTax * taxPercent) / 100);
    const intrastate = placeOfSupply.trim().toLowerCase() === "tamil nadu";
    const sgst = intrastate ? money(taxAmount / 2) : 0;
    const cgst = intrastate ? money(taxAmount - sgst) : 0;
    const igst = intrastate ? 0 : taxAmount;
    const rowTotal = money(withoutTax + taxAmount);

    const row: AddedRow = {
      key: `${Date.now()}-${Math.random()}`,
      productId: entry.productId,
      variantId: selectedStock.variantId || selectedStock.product?.id || entry.productId,
      batchId: selectedStock.batchId || "",
      product: safeProduct,
      pkgsize: entry.pkgsize,
      batchNo: entry.batchNo,
      expiryDate: entry.expiryDate || selectedStock.expiryDate || "",
      packSize: safeProduct.size || entry.pkgsize,
      hsn: safeProduct.hsnCode || "",
      taxPercent,
      quantity: entry.quantity,
      sellingPrice,
      discount,
      withoutTax,
      taxAmount,
      rowTotal,
      igst,
      cgst,
      sgst,
    };

    setAdded((prev) => [...prev, row]);
    setEntry(emptyEntry());
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((r) => r.key !== key));
  }

  function repriceLine(
    row: AddedRow,
    patch: Partial<Pick<AddedRow, "quantity" | "sellingPrice" | "discount">>,
    supply = placeOfSupply,
  ): AddedRow {
    const quantity = Math.max(0, Number(patch.quantity ?? row.quantity) || 0);
    const sellingPrice = money(patch.sellingPrice ?? row.sellingPrice);
    const discount = money(Math.max(0, Number(patch.discount ?? row.discount) || 0));
    const withoutTax = money(Math.max(0, money(quantity * sellingPrice) - discount));
    const taxAmount = money((withoutTax * Number(row.taxPercent || 0)) / 100);
    const intrastate = supply.trim().toLowerCase() === "tamil nadu";
    const sgst = intrastate ? money(taxAmount / 2) : 0;
    const cgst = intrastate ? money(taxAmount - sgst) : 0;
    const igst = intrastate ? 0 : taxAmount;
    return {
      ...row,
      quantity,
      sellingPrice,
      discount,
      withoutTax,
      taxAmount,
      sgst,
      cgst,
      igst,
      rowTotal: money(withoutTax + taxAmount),
    };
  }

  function updateAdded(
    key: string,
    patch: Partial<Pick<AddedRow, "quantity" | "sellingPrice" | "discount">>,
  ) {
    setAdded((prev) => prev.map((row) => (row.key === key ? repriceLine(row, patch) : row)));
  }

  function batchChoices(row: AddedRow) {
    const size = String(row.packSize || row.pkgsize || "").trim().toLowerCase();
    return activeStockVariants.filter(
      (stock) =>
        stock.productId === row.productId &&
        String(stock.size || "").trim().toLowerCase() === size,
    );
  }

  function changeAddedBatch(key: string, batchNo: string) {
    setAdded((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const stock = batchChoices(row).find((item) => item.batchNo === batchNo);
        if (!stock) return row;
        return {
          ...row,
          batchNo: stock.batchNo,
          expiryDate: stock.expiryDate || "",
        };
      }),
    );
  }

  function applyQuotation(id: string) {
    setQuotationId(id);
    const quote = openQuotations.find((row) => row.id === id);
    if (!quote) return;
    const farmer = quote.farmerId
      ? registeredFarmers.find((item) => item.id === quote.farmerId)
      : undefined;
    const supply = farmer
      ? (farmer.state || "").toLowerCase() === "tamil nadu"
        ? "Tamil Nadu"
        : "Others"
      : quote.placeOfSupply || "Tamil Nadu";
    if (quote.farmerId) selectFarmer(quote.farmerId, true);
    else {
      setPartyName(quote.farmer || "");
      setFarmerPhone(quote.phone || "");
      setFarmerVillage(quote.village || "");
      setFarmerCrop(quote.crop || "");
      setFarmerAcre(quote.acre || "");
      setPlaceOfSupply(supply);
    }
    const lines: AddedRow[] = [];
    quote.products.forEach((item, index) => {
      const matches = activeStockVariants.filter(
        (stock) =>
          stock.productId === String(item.productId || "") &&
          stock.size.trim().toLowerCase() === String(item.pkgsize || "").trim().toLowerCase(),
      );
      const stock = [...matches].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
      if (!stock?.product) return;
      const draft: AddedRow = {
        key: `quote-${quote.id}-${index}`,
        productId: stock.productId,
        product: stock.product,
        pkgsize: stock.size,
        batchNo: stock.batchNo,
        expiryDate: stock.expiryDate || "",
        packSize: stock.size,
        hsn: stock.product.hsnCode || "",
        taxPercent: Number(item.taxPercent || stock.taxPercentage || 0),
        quantity: Number(item.quantity || 0),
        sellingPrice: money(item.sellingPrice || 0),
        discount: money(item.discount || 0),
        withoutTax: 0,
        taxAmount: 0,
        rowTotal: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
      };
      lines.push(repriceLine(draft, {}, supply));
    });
    setAdded(lines);
  }

  function resetForm() {
    setSaleDate(new Date().toISOString().split("T")[0]);
    if (usesSupabaseData()) {
      peekDocumentNo("sales_invoice", storeId)
        .then((nextNo) => {
          if (nextNo) setInvoiceNo(nextNo);
        })
        .catch(() => {
          setInvoiceNo(nextInvoiceNo());
        });
    } else {
      setInvoiceNo(nextInvoiceNo());
    }
    setThrough(isFRO ? "Executive" : "Direct");
    setPartyName("");
    setFarmerId("");
    setQuotationId("");
    setFarmerPhone("");
    setFarmerVillage("");
    setFarmerCrop("");
    setFarmerAcre("");
    setPlaceOfSupply("Tamil Nadu");
    setExecutiveName(isFRO ? froName : "");
    setEntry(emptyEntry());
    setAdded([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  useEffect(() => {
    if (showCreate) savingSale.current = false;
  }, [showCreate]);

  async function handleCreate() {
    if (savingSale.current) return;
    if (!partyName.trim() || added.length === 0) return;
    if (through === "Executive" && !(isFRO ? froName : executiveName).trim())
      return;
    if (
      !usesSupabaseData() &&
      rows.some(
        (item) =>
          item.invoiceNo.trim().toLowerCase() === invoiceNo.trim().toLowerCase(),
      )
    ) {
      window.alert("This invoice number is already saved.");
      return;
    }

    const requested = new Map<string, number>();
    for (const item of added) {
      const qty = Number(item.quantity || 0);
      if (qty < 1) {
        window.alert("Quantity must be at least 1 and cannot be negative.");
        return;
      }
      const key = `${item.productId}|${item.pkgsize}|${item.batchNo}`;
      requested.set(key, (requested.get(key) || 0) + qty);
    }
    for (const [key, qty] of requested) {
      const [productId, pkgsize, batchNo] = key.split("|");
      const stock = activeStockVariants.find(
        (item) =>
          item.productId === productId &&
          item.size === pkgsize &&
          item.batchNo === batchNo,
      );
      const available = Number(stock?.quantity || 0);
      if (qty > available) {
        window.alert(
          `Only ${available} available in ${through === "Executive" ? "FRO" : "store"} stock.`,
        );
        return;
      }
    }

    savingSale.current = true;
    try {
      const saleThrough: SaleType = isFRO ? "Executive" : "Direct";

      if (usesSupabaseData()) {
        const froStaffId =
          saleThrough === "Executive"
            ? user?.staffId || (user?.role === "fro" ? user.id : null)
            : null;
        const dbLines: RpcLine[] = added.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId || item.product?.id || item.productId,
          batch_id: item.batchId || null,
          product_name: item.product?.name || "",
          pack_size: item.pkgsize,
          batch_no: item.batchNo,
          expiry_date: item.expiryDate || null,
          quantity: item.quantity,
          unit_price: item.sellingPrice,
          discount_amount: item.discount,
          taxable_amount: item.withoutTax,
          tax_percent: item.taxPercent,
          tax_rate: item.taxPercent,
          tax_amount: item.taxAmount,
          sgst_amount: item.sgst,
          cgst_amount: item.cgst,
          igst_amount: item.igst,
          line_total: item.rowTotal,
          hsn_code: item.hsn,
        }));
        const header = {
          store_id: storeId,
          fro_staff_id: froStaffId,
          channel: saleThrough === "Executive" ? "executive" as const : "direct" as const,
          farmer_id: farmerId || null,
          customer_name: partyName.trim(),
          party_name: partyName.trim(),
          customer_phone: farmerPhone.trim() || null,
          farmer_phone: farmerPhone.trim() || null,
          customer_village: farmerVillage.trim() || null,
          farmer_village: farmerVillage.trim() || null,
          farmer_crop: farmerCrop.trim() || null,
          farmer_acre: farmerAcre.trim() || null,
          place_of_supply: placeOfSupply || "Tamil Nadu",
          invoice_date: saleDate,
          payment_method: "cash",
          notes: "",
          round_off: totals.roundOff,
        };
        if (quotationId) {
          await convertQuotationToInvoiceDb(quotationId, header, dbLines);
          setOpenQuotations((current) => current.filter((row) => row.id !== quotationId));
        } else {
          await createSalesInvoiceDb(header, dbLines);
        }
        await refreshPurchasingData();
        await reloadDbInvoices();
        window.dispatchEvent(new Event("nature-biotic-sales-invoices-updated"));
        setShowCreate(false);
        resetForm();
        return;
      }

      const allocatedNo = nextInvoiceNo();
      const row: SaleRow = {
        id: `store-sale-${Date.now()}`,
        date: formatDateInput(saleDate),
        invoiceNo: allocatedNo,
        through: saleThrough,
        partyName: partyName.trim(),
        farmerId,
        farmerPhone,
        farmerVillage,
        farmerCrop,
        farmerAcre,
        placeOfSupply,
        createdByStaffId: isFRO ? user?.staffId || user?.id : undefined,
        executiveName: saleThrough === "Executive" ? froName : "",
        withoutTax: totals.withoutTax,
        sgst: totals.sgst,
        cgst: totals.cgst,
        igst: totals.igst,
        amount: totals.grandTotal,
        roundOff: totals.roundOff,
        products: added,
        notes: "",
      };

      const next = [row, ...rows];
      setRows(next);
      rememberStoreDocumentNo(store?.code || "ST", "INV", allocatedNo);

      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        window.dispatchEvent(new Event("nature-biotic-store-sales-updated"));
      } catch {}

      if (row.through === "Executive") {
        reduceFROStock(
          storeId,
          row.executiveName || "",
          added.map((item) => ({
            productId: item.productId,
            productName: item.product?.name,
            packSize: item.pkgsize,
            batchNo: item.batchNo,
            qty: item.quantity,
          })),
          saleDate,
          "Sale",
          `sale:${row.id}`,
        );
      } else {
        window.dispatchEvent(new Event("nature-biotic-store-inventory-updated"));
      }

      setShowCreate(false);
      resetForm();
    } catch (error: any) {
      window.alert(dbErrorMessage(error, "Failed to create sales invoice."));
    } finally {
      savingSale.current = false;
    }
  }

  const canCreate =
    !!invoiceNo.trim() &&
    !!farmerId &&
    !!partyName.trim() &&
    added.length > 0 &&
    (through === "Direct" || !!executiveName.trim());

  const selectedSaleContact = farmerContactText(
    storeFarmers.find((farmer) => farmer.id === selectedSale?.farmerId),
    {
      name: selectedSale?.partyName,
      village: selectedSale?.farmerVillage,
      phone: selectedSale?.farmerPhone,
    },
  );
  const invoiceSheetRef = useRef<HTMLDivElement>(null);
  const sharingInvoice = useRef(false);

  return (
    <div>
      {!isFRO ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sales Invoice</h1>
            <p className="mt-1 text-slate-500">
              Direct and executive sales invoices.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <div className="w-full sm:w-44">
              <Select
                label="Date Filter"
                value={dateFilter}
                onChange={(value) => setDateFilter(value as SimpleDateFilter)}
                options={simpleDateFilterOptions}
              />
            </div>
            {dateFilter === "custom" && (
              <>
                <div className="w-full sm:w-40">
                  <Input
                    label="From Date"
                    type="date"
                    value={customFrom}
                    onChange={setCustomFrom}
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Input
                    label="To Date"
                    type="date"
                    value={customTo}
                    onChange={setCustomTo}
                  />
                </div>
              </>
            )}
            <Button
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <Icon name="add" size={18} />
              Create Sale
            </Button>
          </div>
        </div>
      ) : !showCreate && !selectedSale ? (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goStorePage("sales")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back"
            >
              <Icon name="arrow_back" size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800">
                Sales Invoice
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Direct and executive sales invoices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm hover:bg-brand-700"
            aria-label="Create Sale"
          >
            <Icon name="add" size={20} />
          </button>
        </div>
      ) : null}

      {isFRO && !showCreate && !selectedSale && (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-[9px] uppercase tracking-wider text-slate-500">
                  <th className="w-[12%] border-r border-slate-200 px-2 py-2.5 text-center font-semibold">
                    S.No
                  </th>
                  <th className="w-[18%] border-r border-slate-200 px-2 py-2.5 text-center font-semibold">
                    Date
                  </th>
                  <th className="w-[45%] border-r border-slate-200 px-2 py-2.5 text-left font-semibold">
                    Farmer Details
                  </th>
                  <th className="w-[25%] px-2 py-2.5 text-right font-semibold">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className={`px-3 py-10 text-center text-sm ${listError ? "font-medium text-red-600" : "text-slate-400"}`}
                    >
                      {invoiceListMessage}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r, i) => {
                    const contact = farmerContactText(
                      storeFarmers.find((farmer) => farmer.id === r.farmerId),
                      {
                        name: r.partyName,
                        village: r.farmerVillage,
                        phone: r.farmerPhone,
                      },
                    );
                    return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedSale(r)}
                      className="cursor-pointer border-b border-slate-100 bg-white transition hover:bg-brand-50/30 active:bg-slate-50"
                    >
                      <td className="px-2 py-3 text-center font-medium text-slate-500">
                        {i + 1}
                      </td>
                      <td className="border-l border-slate-100 px-2 py-3 text-center text-slate-500">
                        {r.date}
                      </td>
                      <td className="border-l border-slate-100 px-2 py-3 text-left">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {contact.name}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {contact.village}
                        </p>
                        <p className="truncate text-[9px] text-slate-400">
                          {contact.phone}
                        </p>
                      </td>
                      <td className="border-l border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-brand-700">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isFRO && (
        <Card className="overflow-hidden p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[850px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                  <th
                    rowSpan={2}
                    className="w-[6%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[10%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Date
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[14%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Invoice No
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[11%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Through
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[15%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
                  >
                    Farmer Name
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[11%] border-r border-slate-200 px-2 py-3 text-right font-semibold"
                  >
                    Without Tax
                  </th>
                  <th
                    colSpan={3}
                    className="w-[21%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                  >
                    Tax
                  </th>
                  <th
                    rowSpan={2}
                    className="w-[12%] px-2 py-3 text-right font-semibold"
                  >
                    Total
                  </th>
                </tr>

                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="border-r border-slate-100 px-2 py-2 text-right font-semibold">
                    SGST
                  </th>
                  <th className="border-r border-slate-100 px-2 py-2 text-right font-semibold">
                    CGST
                  </th>
                  <th className="border-r border-slate-200 px-2 py-2 text-right font-semibold">
                    IGST
                  </th>
                </tr>
              </thead>

              <tbody>
                {listedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className={`px-4 py-10 text-center text-sm ${listError ? "font-medium text-red-600" : "text-slate-400"}`}
                    >
                      {invoiceListMessage}
                    </td>
                  </tr>
                ) : listedRows.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedSale(r)}
                    title="Click to view invoice"
                    className={`cursor-pointer border-b border-slate-100 ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    } transition hover:bg-brand-50/30`}
                  >
                    <td className="px-2 py-3 text-center font-medium text-slate-500">
                      {i + 1}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-center text-slate-500">
                      {r.date}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                      {r.invoiceNo}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          r.through === "Direct"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {r.through === "Executive"
                          ? r.executiveName || "Executive"
                          : "Direct"}
                      </span>
                    </td>
                    <td className="truncate border-l border-slate-100 px-2 py-3 text-center text-slate-700">
                      {r.partyName}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {formatCurrency(r.withoutTax)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.sgst)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.cgst)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(r.igst)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                      {formatCurrency(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden">
            {listedRows.length === 0 ? (
              <div className={`px-4 py-10 text-center text-sm ${listError ? "font-medium text-red-600" : "text-slate-400"}`}>
                {invoiceListMessage}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {listedRows.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedSale(r)}
                    className="block w-full p-4 text-left transition active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Invoice {i + 1}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-800">
                          {r.invoiceNo}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        {r.through}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">Date</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-700">
                          {r.date}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">Farmer</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">
                          {r.partyName}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-400">
                          Without Tax
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-700">
                          {formatCurrency(r.withoutTax)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-brand-50 p-2.5">
                        <p className="text-[10px] text-brand-600">Total</p>
                        <p className="mt-0.5 text-sm font-bold text-brand-700">
                          {formatCurrency(r.amount)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {selectedSale && isFRO && (
        <div className="min-h-full w-full max-w-full overflow-x-hidden bg-slate-50">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={closeSelectedInvoice}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back"
            >
              <Icon name="arrow_back" size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">
                Sales Invoice
              </h1>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {selectedSale.invoiceNo} · {formatDate(selectedSale.date)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Farmer Details
                </p>
                <p className="mt-1.5 break-words text-sm font-extrabold text-slate-800">
                  {selectedSaleContact.name}
                </p>
                <p className="mt-0.5 break-words text-xs text-slate-500">
                  {selectedSaleContact.village}
                </p>
                <p className="mt-0.5 break-words text-xs text-slate-500">
                  {selectedSaleContact.phone}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Farm Details
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <span className="text-slate-400">Crop</span>
                    <p className="font-semibold text-slate-700">
                      {selectedSale.farmerCrop || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Acre</span>
                    <p className="font-semibold text-slate-700">
                      {selectedSale.farmerAcre || "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Place</span>
                    <p className="font-semibold text-slate-700">
                      {selectedSale.placeOfSupply || "Tamil Nadu"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Products
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedSale.products.length} item(s)
                  </p>
                </div>
                <p className="text-sm font-extrabold text-brand-700">
                  {formatCurrency(selectedSale.amount)}
                </p>
              </div>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[280px] table-fixed border-collapse text-[11px] sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">
                      <th className="w-[12%] px-2 py-2.5 text-center font-semibold">
                        S.No
                      </th>
                      <th className="w-[48%] px-2 py-2.5 text-left font-semibold">
                        Product
                      </th>
                      <th className="w-[16%] px-1 py-2.5 text-center font-semibold">
                        Qty
                      </th>
                      <th className="w-[24%] px-2 py-2.5 text-right font-semibold">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSale.products.length > 0 ? (
                      selectedSale.products.map((item, index) => (
                        <tr key={item.key}>
                          <td className="px-2 py-3 text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td className="min-w-0 px-2 py-3">
                            <p className="break-words font-semibold leading-4 text-slate-800">
                              {item.product?.name || "Product"}
                            </p>
                            <p className="mt-0.5 break-words text-[10px] text-slate-500">
                              {item.pkgsize || item.packSize || "-"}
                            </p>
                          </td>
                          <td className="px-1 py-3 text-center font-medium text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                            {formatCurrency(item.rowTotal)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-8 text-center text-xs text-slate-400"
                        >
                          Product details are not available for this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Invoice Summary
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <SummaryRow
                  label="Without Tax"
                  value={formatCurrency(selectedSale.withoutTax)}
                />
                <SummaryRow
                  label="SGST"
                  value={formatCurrency(selectedSale.sgst)}
                />
                <SummaryRow
                  label="CGST"
                  value={formatCurrency(selectedSale.cgst)}
                />
                <SummaryRow
                  label="IGST"
                  value={formatCurrency(selectedSale.igst)}
                />
                <SummaryRow
                  label="Round Off"
                  value={formatRoundOff(selectedSale.roundOff || 0)}
                />
                <div className="border-t border-slate-200 pt-2">
                  <SummaryRow
                    label="Grand Total"
                    value={formatCurrency(selectedSale.amount)}
                    bold
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <FroDocumentActions
              onWhatsApp={() => {
                void shareDocumentPdf({
                  sheet: invoiceSheetRef.current,
                  phone: selectedSaleContact.phone,
                  fileName: documentPdfFileName(selectedSale.invoiceNo),
                  lock: sharingInvoice,
                  message: detailedShareMessage({
                    farmerName: selectedSaleContact.name,
                    intro: "Please find your Sales Invoice details.",
                    numberLabel: "Invoice No",
                    number: selectedSale.invoiceNo,
                    date: formatDate(selectedSale.date),
                    lines: (selectedSale.products || []).map((item) => ({
                      name: item.product?.name || "-",
                      packSize: item.pkgsize || item.packSize || "-",
                      qty: item.quantity,
                      rate: formatCurrency(item.sellingPrice),
                      amount: formatCurrency(item.rowTotal),
                    })),
                    lineAmountLabel: "Amount",
                    totalLabel: "Grand Total",
                    total: formatCurrency(selectedSale.amount),
                    storeName: store?.name || "Nature Biotic",
                  }),
                });
              }}
              onPrint={() => {
                void printDocumentPdf(invoiceSheetRef.current);
              }}
              onClose={closeSelectedInvoice}
            />
            {createPortal(
              <div
                ref={invoiceSheetRef}
                className="document-pdf-sheet"
                aria-hidden="true"
                style={{
                  position: "fixed",
                  left: -2400,
                  top: 0,
                  width: DOCUMENT_PDF_WIDTH_PX,
                  background: "#fff",
                  pointerEvents: "none",
                }}
              >
                <CommonDocumentBill
                  documentType="salesInvoice"
                  storeId={storeId}
                  sale={selectedSale}
                  notes={selectedSale.notes || ""}
                  documentMode
                />
              </div>,
              document.body,
            )}
          </div>
        </div>
      )}

      {selectedSale && !isFRO && (
        <StoreInvoiceBillModal
          storeId={storeId}
          sale={selectedSale}
          onClose={closeSelectedInvoice}
        />
      )}

      {showCreate &&
        (isFRO ? (
          <div className="min-h-[calc(100vh-80px)] w-full bg-slate-50">
            <div className="flex min-h-full w-full flex-col overflow-hidden bg-white">
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  aria-label="Back"
                >
                  <Icon name="arrow_back" size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-800">
                    Create Sales Invoice
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Create a sales invoice for farmer
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Sale Information
                  </h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      label="Sale Date"
                      type="date"
                      value={saleDate}
                      onChange={setSaleDate}
                    />

                    <Input
                      label="Invoice Number"
                      value={invoiceNo}
                      onChange={() => {}}
                      readOnly
                      required
                    />

                    {!isFRO && (
                      <Input
                        label="Sale Type"
                        value="Direct"
                        onChange={() => {}}
                        readOnly
                      />
                    )}

                    {isFRO && (
                      <Input
                        label="Executive"
                        value={froName}
                        onChange={() => {}}
                        readOnly
                      />
                    )}

                    <Select
                      label="Farmer Name"
                      value={farmerId}
                      onChange={selectFarmer}
                      placeholder="Select registered farmer"
                      options={registeredFarmers.map((farmer) => ({
                        value: farmer.id,
                        label: `${farmer.name} - ${farmer.phone}`,
                      }))}
                      required
                    />

                    {usesSupabaseData() && (
                      <Select
                        label="Quotation"
                        value={quotationId}
                        onChange={applyQuotation}
                        placeholder={
                          farmerId
                            ? "Optional — create without a quotation"
                            : "Select a farmer first"
                        }
                        options={
                          farmerId
                            ? farmerQuotations.map((quote) => ({
                                value: quote.id,
                                label: quote.quotationNo,
                              }))
                            : []
                        }
                        menuLimit={5}
                      />
                    )}

                    <Input
                      label="Mobile Number"
                      value={farmerPhone}
                      onChange={() => {}}
                      readOnly
                    />
                    <Input
                      label="Village"
                      value={farmerVillage}
                      onChange={() => {}}
                      readOnly
                    />
                    <Input
                      label="Place of Supply"
                      value={placeOfSupply}
                      onChange={() => {}}
                      readOnly
                    />

                    {!isFRO && through === "Executive" && (
                      <Select
                        label="Executive"
                        value={executiveName}
                        onChange={(value) => {
                          setExecutiveName(value);
                          setEntry(emptyEntry());
                          setAdded([]);
                        }}
                        placeholder="Select executive"
                        options={storeExecutives.map((name) => ({
                          value: name,
                          label: name,
                        }))}
                        required
                      />
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Add Product
                  </h4>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                      <Select
                        label="Select Product"
                        value={selectedProductName}
                        onChange={selectProductName}
                        placeholder="Choose store product"
                        options={storeProductChoices}
                      />

                      <Select
                        label="PKG Size"
                        value={entry.pkgsize}
                        onChange={selectProductSize}
                        placeholder={
                          selectedProductName
                            ? "Select available size"
                            : "Select product first"
                        }
                        options={Array.from(
                          new Map<string, { value: string; label: string }>(
                            selectedSizeVariants.map((item: { size: any }) => [
                              item.size,
                              { value: item.size, label: item.size },
                            ]),
                          ).values(),
                        )}
                      />

                      {batchesForEntrySize(entry.pkgsize).length > 1 ? (
                        <Select
                          label="Batch ID"
                          value={entry.batchNo}
                          onChange={selectEntryBatch}
                          placeholder="Select batch"
                          options={batchesForEntrySize(entry.pkgsize).map((item) => ({
                            value: item.batchNo,
                            label: item.batchNo,
                          }))}
                        />
                      ) : (
                        <Input
                          label="Batch ID"
                          value={entry.batchNo}
                          onChange={() => {}}
                          placeholder={entry.pkgsize ? "Auto" : "Select size first"}
                          readOnly
                        />
                      )}

                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={() => {}}
                        readOnly
                      />

                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={setEntryQuantity}
                      />

                      <Input
                        label="Selling Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            sellingPrice: Number(v) || 0,
                          }))
                        }
                      />

                      <Input
                        label="Discount"
                        type="number"
                        value={String(entry.discount)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            discount: Number(v) || 0,
                          }))
                        }
                      />

                      <Button
                        onClick={addProduct}
                        className="h-[50px] w-full px-3"
                      >
                        <Icon name="add" size={18} />
                        Add Product
                      </Button>
                    </div>

                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-6">
                        <DetailField
                          label="Product"
                          value={entryProduct.name}
                        />
                        <DetailField
                          label="Pack Size"
                          value={entryProduct.size}
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
                          label="Tax %"
                          value={`${entryProduct.taxPercentage}%`}
                        />
                        <DetailField
                          label="Selling Price"
                          value={formatCurrency(entry.sellingPrice)}
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
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
                        className="mx-auto text-slate-300"
                      />
                      <p className="mt-2 text-sm text-slate-400">
                        No products added yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
                        <table className="w-full table-fixed text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                              <th className="w-[6%] px-2 py-3 text-center">
                                S.No
                              </th>
                              <th className="w-[15%] px-2 py-3 text-left">
                                Product
                              </th>
                              <th className="w-[11%] px-2 py-3 text-left">
                                Batch
                              </th>
                              <th className="w-[11%] px-2 py-3 text-center">
                                Expiry
                              </th>
                              <th className="w-[10%] px-2 py-3 text-center">
                                Size
                              </th>
                              <th className="w-[8%] px-2 py-3 text-right">
                                Qty
                              </th>
                              <th className="w-[11%] px-2 py-3 text-right">
                                Price
                              </th>
                              <th className="w-[10%] px-2 py-3 text-right">
                                Discount
                              </th>
                              <th className="w-[9%] px-2 py-3 text-right">
                                Tax
                              </th>
                              <th className="w-[9%] px-2 py-3 text-center">
                                Total
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {added.map((r, i) => (
                              <tr key={r.key}>
                                <td className="px-2 py-3 text-center">
                                  {i + 1}
                                </td>
                                <td className="truncate px-2 py-3 font-semibold">
                                  {r.product?.name}
                                </td>
                                <td className="px-2 py-3">
                                  {batchChoices(r).length > 1 ? (
                                    <select
                                      value={r.batchNo}
                                      onChange={(event) => changeAddedBatch(r.key, event.target.value)}
                                      className="w-full rounded-md border border-slate-200 bg-white px-1 py-1 text-xs"
                                    >
                                      {batchChoices(r).map((stock, index) => (
                                        <option key={`${stock.batchNo}-${index}`} value={stock.batchNo}>
                                          {stock.batchNo}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    r.batchNo
                                  )}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {r.expiryDate}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {r.packSize}
                                </td>
                                <td className="px-2 py-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={r.quantity}
                                    onChange={(event) =>
                                      updateAdded(r.key, { quantity: Number(event.target.value) })
                                    }
                                    className="w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm"
                                  />
                                </td>
                                <td className="px-2 py-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={r.sellingPrice}
                                    onChange={(event) =>
                                      updateAdded(r.key, { sellingPrice: Number(event.target.value) })
                                    }
                                    className="w-24 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm"
                                  />
                                </td>
                                <td className="px-2 py-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={r.discount}
                                    onChange={(event) =>
                                      updateAdded(r.key, { discount: Number(event.target.value) })
                                    }
                                    className="w-24 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm"
                                  />
                                </td>
                                <td className="px-2 py-3 text-right">
                                  {formatCurrency(r.taxAmount)}
                                </td>
                                <td className="px-2 py-3 text-right font-bold">
                                  <div className="flex items-center justify-end gap-2">
                                    <span>{formatCurrency(r.rowTotal)}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeAdded(r.key)}
                                      className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Icon name="delete" size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-3 md:hidden">
                        {added.map((r, i) => (
                          <div
                            key={r.key}
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Product {i + 1}
                                </p>
                                <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                                  {r.product?.name || "Product"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAdded(r.key)}
                                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Remove product"
                              >
                                <Icon name="delete" size={16} />
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              {batchChoices(r).length > 1 ? (
                                <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                  <span className="text-[10px] font-medium text-slate-500">Batch</span>
                                  <select
                                    value={r.batchNo}
                                    onChange={(event) => changeAddedBatch(r.key, event.target.value)}
                                    className="mt-0.5 w-full bg-transparent text-xs font-semibold"
                                  >
                                    {batchChoices(r).map((stock, index) => (
                                      <option key={`${stock.batchNo}-${index}`} value={stock.batchNo}>
                                        {stock.batchNo}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : (
                                <DetailField label="Batch" value={r.batchNo || "-"} />
                              )}
                              <DetailField
                                label="Expiry"
                                value={r.expiryDate || "-"}
                              />
                              <DetailField
                                label="Size"
                                value={r.packSize || r.pkgsize || "-"}
                              />
                              <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                <span className="text-[10px] font-medium text-slate-500">Qty</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={r.quantity}
                                  onChange={(event) => updateAdded(r.key, { quantity: Number(event.target.value) })}
                                  className="mt-0.5 w-full bg-transparent text-right text-xs font-semibold"
                                />
                              </label>
                              <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                <span className="text-[10px] font-medium text-slate-500">Price</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={r.sellingPrice}
                                  onChange={(event) => updateAdded(r.key, { sellingPrice: Number(event.target.value) })}
                                  className="mt-0.5 w-full bg-transparent text-right text-xs font-semibold"
                                />
                              </label>
                              <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                <span className="text-[10px] font-medium text-slate-500">Discount</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={r.discount}
                                  onChange={(event) => updateAdded(r.key, { discount: Number(event.target.value) })}
                                  className="mt-0.5 w-full bg-transparent text-right text-xs font-semibold"
                                />
                              </label>
                              <DetailField
                                label="Tax"
                                value={formatCurrency(r.taxAmount)}
                              />
                              <div className="rounded-lg bg-brand-50 px-2 py-1.5">
                                <p className="text-[10px] font-medium text-brand-600">
                                  Total
                                </p>
                                <p className="mt-0.5 text-xs font-bold text-brand-700">
                                  {formatCurrency(r.rowTotal)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>

                <section className="flex justify-end">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h5 className="mb-3 text-sm font-bold text-slate-800">
                      Invoice Summary
                    </h5>

                    <div className="space-y-2 text-sm">
                      <SummaryRow
                        label="Without Tax"
                        value={formatCurrency(totals.withoutTax)}
                      />
                      <SummaryRow
                        label="SGST"
                        value={formatCurrency(totals.sgst)}
                      />
                      <SummaryRow
                        label="CGST"
                        value={formatCurrency(totals.cgst)}
                      />
                      <SummaryRow
                        label="IGST"
                        value={formatCurrency(totals.igst)}
                      />
                      <SummaryRow
                        label="Round Off"
                        value={formatRoundOff(totals.roundOff)}
                      />

                      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
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

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
                <Button
                  variant="secondary"
                  onClick={closeForm}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!canCreate}
                  className="w-full sm:w-auto"
                >
                  <Icon name="check_circle" size={18} />
                  Create Sale
                </Button>
              </div>
            </div>
          </div>
        ) : (
          createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
              <div className="flex max-h-[94vh] w-[calc(100vw-16px)] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[94vw]">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Create Store Sale
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Create a new direct or executive sale.
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

                <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
                  <section>
                    <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                      Sale Information
                    </h4>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Input
                        label="Sale Date"
                        type="date"
                        value={saleDate}
                        onChange={setSaleDate}
                      />

                      <Input
                        label="Invoice Number"
                        value={invoiceNo}
                        onChange={() => {}}
                        readOnly
                        required
                      />

                      {!isFRO && (
                        <Input
                          label="Sale Type"
                          value="Direct"
                          onChange={() => {}}
                          readOnly
                        />
                      )}

                      {isFRO && (
                        <Input
                          label="Executive"
                          value={froName}
                          onChange={() => {}}
                          readOnly
                        />
                      )}

                      <Select
                        label="Farmer Name"
                        value={farmerId}
                        onChange={selectFarmer}
                        placeholder="Select registered farmer"
                        options={registeredFarmers.map((farmer) => ({
                          value: farmer.id,
                          label: `${farmer.name} - ${farmer.phone}`,
                        }))}
                        required
                      />

                      {usesSupabaseData() && (
                        <Select
                          label="Quotation"
                          value={quotationId}
                          onChange={applyQuotation}
                          placeholder={
                            farmerId
                              ? "Optional — create without a quotation"
                              : "Select a farmer first"
                          }
                          options={
                            farmerId
                              ? farmerQuotations.map((quote) => ({
                                  value: quote.id,
                                  label: quote.quotationNo,
                                }))
                              : []
                          }
                          menuLimit={5}
                        />
                      )}

                      <Input
                        label="Mobile Number"
                        value={farmerPhone}
                        onChange={() => {}}
                        readOnly
                      />
                      <Input
                        label="Village"
                        value={farmerVillage}
                        onChange={() => {}}
                        readOnly
                      />
                      <Input
                        label="Place of Supply"
                        value={placeOfSupply}
                        onChange={() => {}}
                        readOnly
                      />

                      {!isFRO && through === "Executive" && (
                        <Select
                          label="Executive"
                          value={executiveName}
                          onChange={(value) => {
                            setExecutiveName(value);
                            setEntry(emptyEntry());
                            setAdded([]);
                          }}
                          placeholder="Select executive"
                          options={storeExecutives.map((name) => ({
                            value: name,
                            label: name,
                          }))}
                          required
                        />
                      )}
                    </div>
                  </section>

                  <section>
                    <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                      Add Product
                    </h4>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                        <Select
                          label="Select Product"
                          value={selectedProductName}
                          onChange={selectProductName}
                          placeholder="Choose store product"
                          options={storeProductChoices}
                        />

                        <Select
                          label="PKG Size"
                          value={entry.pkgsize}
                          onChange={selectProductSize}
                          placeholder={
                            selectedProductName
                              ? "Select available size"
                              : "Select product first"
                          }
                          options={Array.from(
                            new Map<string, { value: string; label: string }>(
                              selectedSizeVariants.map(
                                (item: { size: any }) => [
                                  item.size,
                                  { value: item.size, label: item.size },
                                ],
                              ),
                            ).values(),
                          )}
                        />

                        {batchesForEntrySize(entry.pkgsize).length > 1 ? (
                          <Select
                            label="Batch ID"
                            value={entry.batchNo}
                            onChange={selectEntryBatch}
                            placeholder="Select batch"
                            options={batchesForEntrySize(entry.pkgsize).map((item) => ({
                              value: item.batchNo,
                              label: item.batchNo,
                            }))}
                          />
                        ) : (
                          <Input
                            label="Batch ID"
                            value={entry.batchNo}
                            onChange={() => {}}
                            placeholder={entry.pkgsize ? "Auto" : "Select size first"}
                            readOnly
                          />
                        )}

                        <Input
                          label="Expiry Date"
                          type="date"
                          value={entry.expiryDate}
                          onChange={() => {}}
                          readOnly
                        />

                        <Input
                          label="Quantity"
                          type="number"
                          value={String(entry.quantity)}
                          onChange={setEntryQuantity}
                        />

                        <Input
                          label="Selling Price"
                          type="number"
                          value={String(entry.sellingPrice)}
                          onChange={(v) =>
                            setEntry((prev) => ({
                              ...prev,
                              sellingPrice: Number(v) || 0,
                            }))
                          }
                        />

                        <Input
                          label="Discount"
                          type="number"
                          value={String(entry.discount)}
                          onChange={(v) =>
                            setEntry((prev) => ({
                              ...prev,
                              discount: Number(v) || 0,
                            }))
                          }
                        />

                        <Button
                          onClick={addProduct}
                          className="h-[50px] w-full px-3"
                        >
                          <Icon name="add" size={18} />
                          Add Product
                        </Button>
                      </div>

                      {entryProduct && (
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-6">
                          <DetailField
                            label="Product"
                            value={entryProduct.name}
                          />
                          <DetailField
                            label="Pack Size"
                            value={entryProduct.size}
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
                            label="Tax %"
                            value={`${entryProduct.taxPercentage}%`}
                          />
                          <DetailField
                            label="Selling Price"
                            value={formatCurrency(entry.sellingPrice)}
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
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
                          className="mx-auto text-slate-300"
                        />
                        <p className="mt-2 text-sm text-slate-400">
                          No products added yet.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
                          <table className="w-full table-fixed text-sm">
                            <thead>
                              <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                                <th className="w-[6%] px-2 py-3 text-center">
                                  S.No
                                </th>
                                <th className="w-[15%] px-2 py-3 text-left">
                                  Product
                                </th>
                                <th className="w-[11%] px-2 py-3 text-left">
                                  Batch
                                </th>
                                <th className="w-[11%] px-2 py-3 text-center">
                                  Expiry
                                </th>
                                <th className="w-[10%] px-2 py-3 text-center">
                                  Size
                                </th>
                                <th className="w-[8%] px-2 py-3 text-right">
                                  Qty
                                </th>
                                <th className="w-[11%] px-2 py-3 text-right">
                                  Price
                                </th>
                                <th className="w-[10%] px-2 py-3 text-right">
                                  Discount
                                </th>
                                <th className="w-[9%] px-2 py-3 text-right">
                                  Tax
                                </th>
                                <th className="w-[9%] px-2 py-3 text-center">
                                  Total
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {added.map((r, i) => (
                                <tr key={r.key}>
                                  <td className="px-2 py-3 text-center">
                                    {i + 1}
                                  </td>
                                  <td className="truncate px-2 py-3 font-semibold">
                                    {r.product?.name}
                                  </td>
                                  <td className="px-2 py-3">
                                    {batchChoices(r).length > 1 ? (
                                      <select
                                        value={r.batchNo}
                                        onChange={(event) => changeAddedBatch(r.key, event.target.value)}
                                        className="w-full rounded-md border border-slate-200 bg-white px-1 py-1 text-xs"
                                      >
                                        {batchChoices(r).map((stock, index) => (
                                          <option key={`${stock.batchNo}-${index}`} value={stock.batchNo}>
                                            {stock.batchNo}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      r.batchNo
                                    )}
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    {r.expiryDate}
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    {r.packSize}
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={r.quantity}
                                      onChange={(event) =>
                                        updateAdded(r.key, { quantity: Number(event.target.value) })
                                      }
                                      className="w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={r.sellingPrice}
                                      onChange={(event) =>
                                        updateAdded(r.key, { sellingPrice: Number(event.target.value) })
                                      }
                                      className="w-24 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={r.discount}
                                      onChange={(event) =>
                                        updateAdded(r.key, { discount: Number(event.target.value) })
                                      }
                                      className="w-24 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    {formatCurrency(r.taxAmount)}
                                  </td>
                                  <td className="px-2 py-3 text-right font-bold">
                                    <div className="flex items-center justify-end gap-2">
                                      <span>{formatCurrency(r.rowTotal)}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeAdded(r.key)}
                                        className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                      >
                                        <Icon name="delete" size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {added.map((r, i) => (
                            <div
                              key={r.key}
                              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    Product {i + 1}
                                  </p>
                                  <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                                    {r.product?.name || "Product"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAdded(r.key)}
                                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove product"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                {batchChoices(r).length > 1 ? (
                                  <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                    <span className="text-[10px] font-medium text-slate-500">Batch</span>
                                    <select
                                      value={r.batchNo}
                                      onChange={(event) => changeAddedBatch(r.key, event.target.value)}
                                      className="mt-0.5 w-full bg-transparent text-xs font-semibold"
                                    >
                                      {batchChoices(r).map((stock, index) => (
                                        <option key={`${stock.batchNo}-${index}`} value={stock.batchNo}>
                                          {stock.batchNo}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : (
                                  <DetailField label="Batch" value={r.batchNo || "-"} />
                                )}
                                <DetailField
                                  label="Expiry"
                                  value={r.expiryDate || "-"}
                                />
                                <DetailField
                                  label="Size"
                                  value={r.packSize || r.pkgsize || "-"}
                                />
                                <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                  <span className="text-[10px] font-medium text-slate-500">Qty</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={r.quantity}
                                    onChange={(event) => updateAdded(r.key, { quantity: Number(event.target.value) })}
                                    className="mt-0.5 w-full bg-transparent text-right text-xs font-semibold"
                                  />
                                </label>
                                <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                  <span className="text-[10px] font-medium text-slate-500">Price</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={r.sellingPrice}
                                    onChange={(event) => updateAdded(r.key, { sellingPrice: Number(event.target.value) })}
                                    className="mt-0.5 w-full bg-transparent text-right text-xs font-semibold"
                                  />
                                </label>
                                <label className="block rounded-lg bg-slate-50 px-2 py-1.5">
                                  <span className="text-[10px] font-medium text-slate-500">Discount</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={r.discount}
                                    onChange={(event) => updateAdded(r.key, { discount: Number(event.target.value) })}
                                    className="mt-0.5 w-full bg-transparent text-right text-xs font-semibold"
                                  />
                                </label>
                                <DetailField
                                  label="Tax"
                                  value={formatCurrency(r.taxAmount)}
                                />
                                <div className="rounded-lg bg-brand-50 px-2 py-1.5">
                                  <p className="text-[10px] font-medium text-brand-600">
                                    Total
                                  </p>
                                  <p className="mt-0.5 text-xs font-bold text-brand-700">
                                    {formatCurrency(r.rowTotal)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>

                  <section className="flex justify-end">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h5 className="mb-3 text-sm font-bold text-slate-800">
                        Invoice Summary
                      </h5>

                      <div className="space-y-2 text-sm">
                        <SummaryRow
                          label="Without Tax"
                          value={formatCurrency(totals.withoutTax)}
                        />
                        <SummaryRow
                          label="SGST"
                          value={formatCurrency(totals.sgst)}
                        />
                        <SummaryRow
                          label="CGST"
                          value={formatCurrency(totals.cgst)}
                        />
                        <SummaryRow
                          label="IGST"
                          value={formatCurrency(totals.igst)}
                        />
                        <SummaryRow
                          label="Round Off"
                          value={formatRoundOff(totals.roundOff)}
                        />

                        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
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

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
                  <Button
                    variant="secondary"
                    onClick={closeForm}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!canCreate}
                    className="w-full sm:w-auto"
                  >
                    <Icon name="check_circle" size={18} />
                    Create Sale
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        ))}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="truncate text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}


function SummaryRow({
  label,
  value,
  bold = false,
  muted = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          bold
            ? "font-bold text-slate-800"
            : muted
              ? "text-slate-400"
              : "text-slate-500"
        }
      >
        {label}
      </span>
      <span
        className={
          bold
            ? "font-bold tabular-nums text-slate-800"
            : muted
              ? "font-semibold tabular-nums text-slate-400"
              : "font-semibold tabular-nums text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}
