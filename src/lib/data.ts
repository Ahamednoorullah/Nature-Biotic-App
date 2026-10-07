import { Key } from "react";

const TRANSACTION_RESET_FLAG = "nature-biotic-transaction-reset-v3";

function resetStoredTestTransactions() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(TRANSACTION_RESET_FLAG) === "1") return;
  } catch {
    return;
  }

  const removeExact = new Set([
    "nature-biotic-company-store-sales-v1",
    "nature-biotic-approved-po-receipts-v1",
    "nature-biotic-company-receipts-v1",
    "nature-biotic-store-purchase-status-v1",
    "nature-biotic-store-approval-requests-v1",
    "nature-biotic-processed-stock-movements-v1",
    "naturebiotic_shared_expenses",
    "nature-biotic-company-refunds-v1",
    "nature-biotic-company-expenses-v1",
    "nature-biotic-company-credit-note-sync-v1",
    "nature-biotic-physical-stock-entries-v1",
    "nature-biotic-farmer-purchases-v1",
  ]);
  const removePrefix = [
    "nature-biotic-store-receipts-v3",
    "nature-biotic-store-sales-invoices-v2",
    "nature-biotic-store-sales-returns-v2",
    "nature-biotic-store-credit-notes-v3",
    "nature-biotic-store-refunds-v2",
    "nature-biotic-store-delivery-challans-v2",
    "nature-biotic-store-return-challans-v2",
    "nature-biotic-store-stock-adjustments-v1",
    "nature-biotic-store-stock-return-received-v1",
    "nature-biotic-fro-accepted-deliveries-v1",
    "nature-biotic-fro-pending-deliveries-v1",
    "nature-biotic-fro-stock-return-requests-v1",
    "nature-biotic-fro-stock-txns-v1",
    "nature-biotic-fro-stock-v1",
    "nature-biotic-fro-sales-v1",
    "nature-biotic-fro-handovers-v1",
    "nature-biotic-fro-cash-received-v1",
    "nature-biotic-fro-cash-refunds-v1",
    "nature-biotic-fro-expense-settlement-v1",
    "nature-biotic-fro-visits-v1",
    "nature-biotic-quotations-",
    "naturebiotic:purchase-orders:",
    "naturebiotic:purchase-returns:",
    "naturebiotic:purchase-payments:",
    "nature-biotic-store-notification-reads-v1:",
    "nature-biotic-store-attendance-v1:",
  ];

  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (
        removeExact.has(key) ||
        removePrefix.some((prefix) => key.startsWith(prefix))
      ) {
        window.localStorage.removeItem(key);
      }
    });

    const farmersRaw = window.localStorage.getItem(
      "nature-biotic-store-farmers-v2",
    );
    if (farmersRaw) {
      const farmersSaved = JSON.parse(farmersRaw);
      if (Array.isArray(farmersSaved)) {
        window.localStorage.setItem(
          "nature-biotic-store-farmers-v2",
          JSON.stringify(
            farmersSaved.map((farmer) => ({
              ...farmer,
              outstanding: 0,
              totalPurchases: 0,
            })),
          ),
        );
      }
    }

    const storesRaw = window.localStorage.getItem(
      "nature-biotic-store-registry-v1",
    );
    if (storesRaw) {
      const storesSaved = JSON.parse(storesRaw);
      if (Array.isArray(storesSaved)) {
        window.localStorage.setItem(
          "nature-biotic-store-registry-v1",
          JSON.stringify(
            storesSaved.map((store) => ({
              ...store,
              todaySales: 0,
              monthlySales: 0,
              totalProfit: 0,
              outstanding: 0,
              activeCustomers: 0,
              inventoryValue: 0,
            })),
          ),
        );
      }
    }

    window.sessionStorage.removeItem("nature-biotic-open-store-invoice");
    window.sessionStorage.removeItem("nature-biotic-farmer-profile-tab");
    window.localStorage.setItem(TRANSACTION_RESET_FLAG, "1");
  } catch {
    // Leave the flag unset so the next load can finish the reset.
  }
}

resetStoredTestTransactions();

export const productSeed: Product[] = [];

export type Store = {
  id: string;
  code: string;
  name: string;
  owner: string;
  manager: string;
  location: string;
  address?: string;
  gst?: string;
  phone: string;
  status: "Active" | "Inactive";
  todaySales: number;
  monthlySales: number;
  totalProfit: number;
  outstanding: number;
  activeCustomers: number;
  inventoryValue: number;
  openedDate: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
  bankBranch?: string;
  bankUpiId?: string;
  email?: string;
  accountId?: string;
};

export type ProductCategory =
  | "Bio-stimulant"
  | "Pesticide"
  | "Fungicide"
  | "Nutrients (Fertilizer)"
  | "Manenes";

export type ProductType = "Liquid" | "Powder" | "Gel" | "Granules";

export type Purpose =
  | "Root Enhancer"
  | "Vegetative Growth Simulator"
  | "Tillers and Branche Developers"
  | "Flower Enhancer"
  | "Bud Developer"
  | "Yield Enhancer"
  | "Larvicide"
  | "Miticide & Acaricide"
  | "Botanical fungicide"
  | "Insecticide (Suckingpest)";

export type TaxType = "Intrastate" | "Interstate";

export type Product = {
  id: string;
  storeId: string;
  name: string;
  purpose: Purpose;
  productCategory: ProductCategory;
  productType: ProductType;
  manufacturer: string;
  vendor: string;
  unit: "Weight" | "Volume";
  size: string;
  hsnCode: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  taxType: TaxType;
  taxPercentage: number;
  sgst: number;
  cgst: number;
  igst: number;
  description: string;
  usageInstructions: string;
  safetyInfo: string;
  storageInfo: string;
  stock: number;
  minStock: number;
  maxStock: number;
  reservedStock: number;
  warehouse: string;
  lastUpdated: string;
  status: "Active" | "Inactive";
  sold: number;
  imageColor: string;
  applicationMethods?: string[];
  dosage?: number;
  dosageUnit?: string;
  filler?: number;
  fillerUnit?: string;
  fillerType?: "Water" | "NA" | "";
};

export type CustomerCategory = "Retail" | "Wholesale" | "Dealer";

export type FarmerCrop = {
  id: string;
  cropType: string;
  landSize: number;
  soilType: string;
  waterSource: string;
};

export type Farmer = {
  cropType3: any;
  cropType2: any;
  id: string;
  storeId: string;
  name: string;
  phone: string;
  altMobile: string;
  email: string;
  aadhar: string;
  gst: string;
  village: string;
  through?: "Direct" | "Executive";
  executiveName?: string;
  createdByStaffId?: string;
  createdByUserId?: string;
  landmark: string;
  district: string;
  state: string;
  pincode: string;
  farmAddress: string;
  customerCategory: CustomerCategory;
  crops: FarmerCrop[];

  // Legacy compatibility for existing farmer profile/list screens.
  // New farmer entries should use crops[] instead.
  taluk?: string;
  landSize: number;
  cropType: string;
  soilType: string;
  waterSource: string;
  paymentMethod?: string;
  creditLimit?: number;
  outstanding: number;
  remarks?: string;
  internalNotes?: string;
  totalPurchases: number;
  status: "Active" | "Inactive";
  joinedDate: string;
  profileColor: string;
  profileImage?: string;
};

export type FarmerPurchase = {
  id: string;
  farmerId: string;
  invoiceNo: string;
  date: string;
  product: string;
  quantity: number;
  amount: number;
  paymentStatus: "Paid" | "Pending";
};

export type FarmerPayment = {
  id: string;
  farmerId: string;
  receiptNo: string;
  date: string;
  amount: number;
  method: string;
  note: string;
};

export type Bill = {
  id: string;
  storeId: string;
  billNo: string;
  farmerName: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  paymentStatus: "Paid" | "Pending";
  billDate: string;
  executiveName?: string;
};

export type StockMovementType = "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT";

export type StockMovement = {
  id: string;
  productId: string;
  date: string;
  type: StockMovementType;
  referenceNo: string;
  quantity: number;
  balanceStock: number;
  handledBy: string;
  remarks: string;
};

export type DeliveryChallanItem = {
  productId: string;
  productName: string;
  packSize: string;
  batchNo: string;
  issuedQty: number;
  soldQty: number;
  returnedQty: number;
};

export type DeliveryChallan = {
  id: string;
  storeId: string;
  challanNo: string;
  date: string;
  executiveName: string;
  issuedBy: string;
  status: "Open" | "Partially Returned" | "Closed";
  remarks: string;
  items: DeliveryChallanItem[];
};

export type ExecutiveStockReturn = {
  id: string;
  storeId: string;
  returnNo: string;
  date: string;
  challanNo: string;
  executiveName: string;
  productName: string;
  packSize: string;
  pkgsize?: string;
  batchNo?: string;
  expiryDate?: string;
  hsn?: string;
  taxPercent?: number;
  discount?: number;
  discountPercent?: number;
  quantity: number;
  remarks: string;
};

// Company Credit Note -> Store Debit Note sync
export type CompanyCreditNoteSyncRecord = {
  id: string;
  creditNoteNo: string;
  storeId: string;
  storeName: string;
  returnDate: string;
  purchaseRef: string;
  invoiceNo?: string;
  product: string;
  productId?: string;
  packSize?: string;
  quantity: number;
  unitPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxPercent?: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  returnAmount: number;
  reason: string;
  placeOfReturn: string;
  status: "Draft" | "Pending" | "Approved" | "Rejected";
  notes?: string;
  pkgsize?: string;
  batchNo?: string;
  expiryDate?: string;
};

const COMPANY_CREDIT_NOTE_SYNC_KEY =
  "nature-biotic-company-credit-note-sync-v1";

export function getCompanyCreditNoteSyncRecords(): CompanyCreditNoteSyncRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(COMPANY_CREDIT_NOTE_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCompanyCreditNoteSyncRecords(
  rows: CompanyCreditNoteSyncRecord[],
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      COMPANY_CREDIT_NOTE_SYNC_KEY,
      JSON.stringify(rows),
    );
    window.dispatchEvent(new Event("company-credit-note-sync-updated"));
  } catch {
    // Frontend demo should continue even if localStorage is unavailable.
  }
}

export function adsdompanyCreditNoteSyncRecords(
  rows: CompanyCreditNoteSyncRecord[],
) {
  const existing = getCompanyCreditNoteSyncRecords();

  // Replace existing rows when the same ID is saved again.
  const incomingIds = new Set(rows.map((row) => row.id));

  const merged = [
    ...existing.filter((row) => !incomingIds.has(row.id)),
    ...rows,
  ];

  saveCompanyCreditNoteSyncRecords(merged);
  return merged;
}

export function getStoreDebitNotesFromCompanyCredits(storeId: string) {
  return getCompanyCreditNoteSyncRecords().filter(
    (row) => row.storeId === storeId,
  );
}

export type StockStatus = "Healthy" | "Low Stock" | "Out of Stock";

export type AdjustmentType = "Increase" | "Decrease";
export type AdjustmentReason =
  | "Damaged"
  | "Expired"
  | "Returned"
  | "Physical Count"
  | "Other";

export type Staff = {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  alternativePhone: string;
  email: string;
  dob: string;
  age: number;
  bloodGroup: string;
  joinedDate: string;
  address: string;
  proofIdName: string;
  profileImageName: string;
  designation: string;
  level: 1 | 2 | 3 | 4;
  targetSales: number;
  targetFarmers: number;
  targetFarms: number;
  targetVisits: number;
  role: string;
  status: "Active" | "On Leave" | "Inactive";
  accountId?: string;
};

export const stores: Store[] = [
  {
    id: "s1",
    code: "SAI",
    name: "Sairam Agri Input",
    owner: "Sairam",
    manager: "Sairam",
    location: "Rajapalayam",
    address: "14, Main Bazaar Street, Rajapalayam, Tamil Nadu 626117",
    gst: "33ABCDE1234F1Z5",
    phone: "9876543210",
    status: "Active",
    todaySales: 0,
    monthlySales: 0,
    totalProfit: 0,
    outstanding: 0,
    activeCustomers: 0,
    inventoryValue: 0,
    openedDate: "2021-06-15",
    bankAccountName: "SAIRAM AGRI INPUTS",
    bankAccountNo: "50200106535019",
    bankIfsc: "HDFC0000775",
    bankName: "HDFC Bank",
    bankBranch: "Rajapalayam",
    bankUpiId: "sujiyaso22-1@okhdfcbank",
  },
  {
    id: "s2",
    code: "ST",
    name: "Shriya Tech",
    owner: "Shriya",
    manager: "Shriya",
    location: "Tenkasi",
    address: "7, Court Road, Tenkasi, Tamil Nadu 627811",
    gst: "33FGHIJ5678K1Z2",
    phone: "9123456701",
    status: "Active",
    todaySales: 0,
    monthlySales: 0,
    totalProfit: 0,
    outstanding: 0,
    activeCustomers: 0,
    inventoryValue: 0,
    openedDate: "2022-01-20",
    bankAccountName: "SHRIYA",
    bankAccountNo: "60484655212398",
    bankIfsc: "HDFC0000257",
    bankName: "HDFC Bank",
    bankBranch: "Tenkasi",
    bankUpiId: "shriyaso25-1@okhdfcbank",
  },
  {
    id: "s3",
    code: "NBM",
    name: "Nature Bio Mart",
    owner: "",
    manager: "",
    location: "Idukki, Kerala",
    address: "Munnar Road, Idukki, Kerala 685602",
    gst: "32LMNOP9012R1Z8",
    phone: "9123456702",
    status: "Active",
    todaySales: 0,
    monthlySales: 0,
    totalProfit: 0,
    outstanding: 0,
    activeCustomers: 0,
    inventoryValue: 0,
    openedDate: "2020-11-08",
    bankAccountName: "Nature Bio Mart",
    bankAccountNo: "70106585911327",
    bankIfsc: "SBI0000851",
    bankName: "SBI Bank",
    bankBranch: "Idukki",
    bankUpiId: "naturebiomart18-1@oksbibank",
  },
];

const warehouses = ["Main Warehouse - Bellary", "Secondary Warehouse - Hospet"];
const PRODUCT_MASTER_KEY = "nature-biotic-product-master-v1";
const PRODUCT_PARTY_OPTIONS_KEY = "nature-biotic-product-party-options-v1";
export const productMasterUpdatedEvent = "product-master-updated";

export let products: Product[] = productSeed.map((p, i) => ({
  ...p,
  id: `p${i}`,
  storeId: "s1",
}));

if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(PRODUCT_MASTER_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Product[];
      if (Array.isArray(saved) && saved.length > 0) products = saved;
    }
  } catch {}
}

export function getProductMaster(): Product[] {
  return [...products];
}

export function saveProductMaster(rows: Product[]) {
  products = rows;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRODUCT_MASTER_KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event(productMasterUpdatedEvent));
  } catch {}
}

export function addProductMasterVariants(rows: Product[]) {
  const existing = getProductMaster();
  const ids = new Set(rows.map((row) => row.id));
  const next = [...rows, ...existing.filter((row) => !ids.has(row.id))];
  saveProductMaster(next);
  return next;
}

export function getProductPartyOptions() {
  const defaults = {
    manufacturers: ["Nature Biotic Pvt. Ltd."],
    vendors: ["Nature Biotic Distribution"],
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PRODUCT_PARTY_OPTIONS_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as typeof defaults;
    return {
      manufacturers: Array.from(
        new Set([...defaults.manufacturers, ...(saved.manufacturers || [])]),
      ),
      vendors: Array.from(
        new Set([...defaults.vendors, ...(saved.vendors || [])]),
      ),
    };
  } catch {
    return defaults;
  }
}

export function saveProductPartyOptions(options: {
  manufacturers: string[];
  vendors: string[];
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PRODUCT_PARTY_OPTIONS_KEY,
      JSON.stringify(options),
    );
  } catch {}
}

const farmerSeed: Omit<Farmer, "id" | "storeId">[] = [];

export type CompanyStoreSaleRecord = {
  returnAmount: number;
  unitPrice: number;
  beforeDiscount: number;
  price: number;
  discountAmount: number;
  discountPercent: number;
  taxableAmount: number;
  id: string;
  invoiceNo: string;
  date: string;
  storeId: string;
  storeName: string;
  storeLocation: string;
  placeOfSupply: string;
  product: string;
  packSize: string;
  quantity: number;
  rate: number;
  withoutTax: number;
  taxAmount: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  notes?: string;
  shippingAddress?: string;
  pkgsize?: string;
  batchNo?: string;
  expiryDate?: string;
  hsn?: string;
  taxPercent?: number;
  discount?: number;
  productId?: string;
  saleStatus?: "Draft" | "Final";
  purchaseOrderNo?: string;
};

const COMPANY_STORE_SALES_KEY = "nature-biotic-company-store-sales-v1";
const APPROVED_PO_RECEIPTS_KEY = "nature-biotic-approved-po-receipts-v1";

function isPurchaseOrderReference(value: unknown) {
  return /^[A-Z0-9]+-PO-\d+$/i.test(String(value || "").trim());
}

function isPurchaseOrderSale(row: CompanyStoreSaleRecord) {
  return (
    String(row?.id || "").startsWith("po-sync-") ||
    isPurchaseOrderReference(row?.invoiceNo)
  );
}

function readApprovedPurchaseOrders(): CompanyStoreSaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(APPROVED_PO_RECEIPTS_KEY);
    const rows = saved ? JSON.parse(saved) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveApprovedPurchaseOrders(rows: CompanyStoreSaleRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPROVED_PO_RECEIPTS_KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event("store-purchase-orders-updated"));
  } catch {}
}

export function getCompanyStoreSales(): CompanyStoreSaleRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(COMPANY_STORE_SALES_KEY);
    const rows = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(rows)) return [];

    localStorage.removeItem(APPROVED_PO_RECEIPTS_KEY);
    const purchaseOrders = rows.filter(isPurchaseOrderSale);
    const sales = rows.filter((row) => !isPurchaseOrderSale(row));
    if (purchaseOrders.length > 0) {
      // A purchase-order number stored as a sale is not an invoice. Drop it.
      localStorage.setItem(COMPANY_STORE_SALES_KEY, JSON.stringify(sales));
    }
    return sales;
  } catch {
    return [];
  }
}

export function saveCompanyStoreSales(rows: CompanyStoreSaleRecord[]) {
  try {
    localStorage.setItem(COMPANY_STORE_SALES_KEY, JSON.stringify(rows));

    window.dispatchEvent(new Event("company-store-sales-updated"));
  } catch {}
}

export function isFinalCompanyStoreSale(row: { saleStatus?: string }) {
  return row?.saleStatus !== "Draft";
}

export function getFinalCompanyStoreSales(): CompanyStoreSaleRecord[] {
  return getCompanyStoreSales().filter(isFinalCompanyStoreSale);
}

const RECEIPT_SEQUENCE_KEY = "nature-biotic-receipt-sequence-v1";
const COMPANY_RECEIPT_STORAGE_KEY = "nature-biotic-company-receipts-v1";
const STORE_RECEIPT_STORAGE_PREFIX = "nature-biotic-store-receipts-v3:";

function receiptSequenceValue(receiptNo: unknown) {
  const match = String(receiptNo ?? "")
    .trim()
    .match(/^RCP-(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function savedReceiptNumbers() {
  const numbers: number[] = [];
  if (typeof window === "undefined") return numbers;

  try {
    const sequence = Number(localStorage.getItem(RECEIPT_SEQUENCE_KEY) || 0);
    if (Number.isFinite(sequence) && sequence > 0) numbers.push(sequence);

    const company = JSON.parse(
      localStorage.getItem(COMPANY_RECEIPT_STORAGE_KEY) || "[]",
    );
    if (Array.isArray(company)) {
      company.forEach((row) => numbers.push(receiptSequenceValue(row?.receiptNo)));
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(STORE_RECEIPT_STORAGE_PREFIX)) continue;
      const rows = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(rows)) continue;
      rows.forEach((row) => numbers.push(receiptSequenceValue(row?.receiptNo)));
    }
  } catch {
    return numbers;
  }

  return numbers;
}

export function nextReceiptNumber() {
  const highest = savedReceiptNumbers().reduce(
    (max, value) => Math.max(max, value),
    0,
  );
  return `RCP-${String(highest + 1).padStart(4, "0")}`;
}

const STORE_DOCUMENT_SEQUENCE_KEY = "nature-biotic-store-document-sequence-v1";

export function nextStoreDocumentNo(
  storeCode: string,
  kind: string,
  existing: string[],
) {
  const code = String(storeCode || "ST").trim() || "ST";
  const prefix = `${code}-${kind}-`;
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`,
    "i",
  );
  let highest = 0;
  existing.forEach((value) => {
    const match = String(value || "").trim().match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORE_DOCUMENT_SEQUENCE_KEY) || "{}",
    );
    const marked = Number(saved?.[`${code}:${kind}`] || 0);
    if (marked > highest) highest = marked;
  } catch {
    // Numbering still continues from the saved documents.
  }
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export function rememberStoreDocumentNo(
  storeCode: string,
  kind: string,
  documentNo: string,
) {
  const code = String(storeCode || "ST").trim() || "ST";
  const match = String(documentNo || "")
    .trim()
    .match(new RegExp(`-${kind}-(\\d+)$`, "i"));
  if (!match || typeof window === "undefined") return;
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORE_DOCUMENT_SEQUENCE_KEY) || "{}",
    );
    const key = `${code}:${kind}`;
    const next = Math.max(Number(saved?.[key] || 0), Number(match[1]));
    localStorage.setItem(
      STORE_DOCUMENT_SEQUENCE_KEY,
      JSON.stringify({ ...saved, [key]: next }),
    );
  } catch {
    // The saved document still keeps its number.
  }
}

export function commitReceiptNumber(receiptNo: string) {
  if (typeof window === "undefined") return;
  const value = receiptSequenceValue(receiptNo);
  if (!value) return;

  try {
    const current = Number(localStorage.getItem(RECEIPT_SEQUENCE_KEY) || 0);
    if (value > current) {
      localStorage.setItem(RECEIPT_SEQUENCE_KEY, String(value));
    }
  } catch {
    // Keep the receipt save even if the sequence marker cannot be written.
  }
}

function purchaseItemName(item: any) {
  if (typeof item?.product === "string" && item.product.trim()) return item.product.trim();
  if (item?.product?.name) return String(item.product.name).trim();
  return String(item?.productName || "").trim();
}

export function syncApprovedPurchaseOrderToSales(
  _storeId: string,
  _storeName: string,
  _poNo: string,
  _poDate: string,
  _items: any[],
  _storeLocation: string,
  _placeOfSupply: string,
) {
  // Acceptance changes purchase-order status only.
  // It must not create a company sale or a store purchase bill.
  return getCompanyStoreSales();
}

export function approveStorePurchaseOrder(requestId: string) {
  const request = getStoreApprovalRequests().find((row) => row.id === requestId);
  if (!request) return getStoreApprovalRequests();
  if (request.status === "Approved" || request.status === "Rejected") {
    return getStoreApprovalRequests();
  }
  if (request.type !== "Purchase Order") {
    return updateStoreApprovalRequestStatus(requestId, "Approved");
  }

  setStorePurchaseOrderStatus(request.storeId, request.referenceNo, "Accepted");
  return updateStoreApprovalRequestStatus(requestId, "Approved");
}

export function rejectStoreApprovalRequest(requestId: string) {
  const request = getStoreApprovalRequests().find((row) => row.id === requestId);
  if (!request || request.status !== "Pending") return getStoreApprovalRequests();
  if (request.type === "Purchase Order") {
    setStorePurchaseOrderStatus(request.storeId, request.referenceNo, "Rejected");
  }
  return updateStoreApprovalRequestStatus(requestId, "Rejected");
}

function setStorePurchaseOrderStatus(
  storeId: string,
  poNo: string,
  status: "Accepted" | "Rejected",
) {
  if (typeof window === "undefined") return;
  try {
    const key = `naturebiotic:purchase-orders:${storeId}`;
    const orders = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(orders) || !orders.some((item: any) => item?.poNo === poNo)) {
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify(
        orders.map((item: any) =>
          item?.poNo === poNo ? { ...item, status } : item,
        ),
      ),
    );
    window.dispatchEvent(new Event("store-purchase-orders-updated"));
  } catch {}
}

/** Store POs the company has accepted, for linking to a company sale. */
export function getAcceptedStorePurchaseOrders(storeId?: string) {
  return getStoreApprovalRequests()
    .filter(
      (request) =>
        request.type === "Purchase Order" &&
        request.status === "Approved" &&
        (!storeId || request.storeId === storeId),
    )
    .flatMap((request) => {
      const order = readStorageArray(
        `naturebiotic:purchase-orders:${request.storeId}`,
      ).find((row) => row?.poNo === request.referenceNo);
      if (!order) return [];
      return [
        {
          storeId: request.storeId,
          storeName: request.storeName,
          poNo: String(order.poNo),
          date: String(order.date || request.date || ""),
          total: Number(order.total ?? request.amount ?? 0),
          items: (Array.isArray(order.items) ? order.items : []) as any[],
        },
      ];
    });
}

export type ApprovedStorePurchaseReturn = {
  storeId: string;
  storeName: string;
  returnNo: string;
  purchaseRef: string;
  date: string;
  amount: number;
  items: any[];
};

/** Purchase returns the company has approved; pending and rejected ones never count. */
export function getApprovedStorePurchaseReturns(
  storeId?: string,
): ApprovedStorePurchaseReturn[] {
  return getStoreApprovalRequests()
    .filter(
      (request) =>
        request.type === "Purchase Return" &&
        request.status === "Approved" &&
        (!storeId || request.storeId === storeId),
    )
    .map((request) => {
      const row = readStorageArray(
        `naturebiotic:purchase-returns:${request.storeId}`,
      ).find((item) => item?.returnNo === request.referenceNo);
      return {
        storeId: request.storeId,
        storeName: request.storeName,
        returnNo: request.referenceNo,
        purchaseRef: String(row?.purchaseRef || ""),
        date: String(row?.date || request.date || ""),
        amount: Math.max(0, Number(row?.total ?? request.amount ?? 0)),
        items: Array.isArray(row?.items) ? row.items : [],
      };
    });
}

/** Credit notes and approved purchase returns raised against one company invoice. */
export function getCompanyInvoiceCredits(storeId: string, invoiceNo: string) {
  const key = String(invoiceNo || "").trim().toLowerCase();
  if (!key) return 0;
  const credited = getCompanyCreditNoteSyncRecords().reduce((sum, note) => {
    if (
      note.storeId !== storeId ||
      note.status === "Rejected" ||
      note.status === "Draft"
    ) {
      return sum;
    }
    const noteInvoice = String(note.invoiceNo || note.purchaseRef || "")
      .trim()
      .toLowerCase();
    return noteInvoice === key ? sum + Math.max(0, Number(note.returnAmount) || 0) : sum;
  }, 0);
  const returned = getApprovedStorePurchaseReturns(storeId).reduce(
    (sum, row) => (row.purchaseRef.trim().toLowerCase() === key ? sum + row.amount : sum),
    0,
  );
  return credited + returned;
}

export function getStorePurchasesFromCompanySales(storeId: string) {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(APPROVED_PO_RECEIPTS_KEY);
    } catch {}
  }
  return getFinalCompanyStoreSales().filter((sale) => sale.storeId === storeId);
}

export const STORE_PURCHASE_STATUS_KEY = "nature-biotic-store-purchase-status-v1";
export const storePurchaseStatusUpdatedEvent =
  "nature-biotic-store-purchase-status-updated";

export function getStorePurchaseStatuses(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_PURCHASE_STATUS_KEY);
    const statuses = raw ? JSON.parse(raw) : {};
    return statuses && typeof statuses === "object" ? statuses : {};
  } catch {
    return {};
  }
}

export function isStorePurchaseReceived(invoiceNo: string) {
  return getStorePurchaseStatuses()[String(invoiceNo || "")] === "Received";
}

export const farmers: Farmer[] = farmerSeed.map((f, i) => ({
  ...f,
  id: `f${i}`,
  storeId: "s1",
  outstanding: 0,
  totalPurchases: 0,
}));

const STORE_FARMERS_KEY = "nature-biotic-store-farmers-v2";
export const storeFarmersUpdatedEvent = "store-farmers-updated";

function normalizeFarmer(farmer: Farmer): Farmer {
  const crops =
    Array.isArray(farmer.crops) && farmer.crops.length > 0
      ? farmer.crops
      : farmer.cropType
        ? [
            {
              id: `${farmer.id}-crop-1`,
              cropType: farmer.cropType,
              landSize: Number(farmer.landSize || 0),
              soilType: farmer.soilType || "",
              waterSource: farmer.waterSource || "",
            },
          ]
        : [];

  const totalLand = crops.reduce(
    (sum, crop) => sum + Number(crop.landSize || 0),
    0,
  );
  const firstCrop = crops[0];

  return {
    ...farmer,
    landmark: farmer.landmark || farmer.taluk || "",
    crops,
    landSize: totalLand,
    cropType: firstCrop?.cropType || farmer.cropType || "",
    soilType: firstCrop?.soilType || farmer.soilType || "",
    waterSource: firstCrop?.waterSource || farmer.waterSource || "",
  };
}

export function getStoredFarmers(): Farmer[] {
  if (typeof window === "undefined") return farmers.map(normalizeFarmer);

  try {
    const raw = window.localStorage.getItem(STORE_FARMERS_KEY);
    if (!raw) return farmers.map(normalizeFarmer);
    const saved = JSON.parse(raw) as Farmer[];
    return saved.map(normalizeFarmer);
  } catch {
    return farmers.map(normalizeFarmer);
  }
}

export function saveStoredFarmers(rows: Farmer[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORE_FARMERS_KEY,
      JSON.stringify(rows.map(normalizeFarmer)),
    );
    window.dispatchEvent(new Event(storeFarmersUpdatedEvent));
  } catch {}
}

export function addFarmer(
  row: Omit<
    Farmer,
    | "id"
    | "landSize"
    | "cropType"
    | "soilType"
    | "waterSource"
    | "outstanding"
    | "totalPurchases"
    | "status"
    | "joinedDate"
    | "profileColor"
  > &
    Partial<
      Pick<
        Farmer,
        | "id"
        | "outstanding"
        | "totalPurchases"
        | "status"
        | "joinedDate"
        | "profileColor"
      >
    >,
): Farmer {
  const existing = getStoredFarmers();
  const crops = row.crops ?? [];
  const firstCrop = crops[0];

  const next: Farmer = normalizeFarmer({
    ...row,
    id: row.id ?? `f-${Date.now()}`,
    landSize: crops.reduce((sum, crop) => sum + Number(crop.landSize || 0), 0),
    cropType: firstCrop?.cropType || "",
    soilType: firstCrop?.soilType || "",
    waterSource: firstCrop?.waterSource || "",
    outstanding: row.outstanding ?? 0,
    totalPurchases: row.totalPurchases ?? 0,
    status: row.status ?? "Active",
    joinedDate: row.joinedDate ?? new Date().toISOString().split("T")[0],
    profileColor: row.profileColor ?? "emerald",
  } as Farmer);

  saveStoredFarmers([
    next,
    ...existing.filter((farmer) => farmer.id !== next.id),
  ]);
  return next;
}

export function updateFarmer(updatedFarmer: Farmer): Farmer {
  const next = normalizeFarmer(updatedFarmer);
  const rows = getStoredFarmers().map((farmer) =>
    farmer.id === next.id ? next : farmer,
  );
  saveStoredFarmers(rows);
  return next;
}

export function deleteFarmer(id: string): void {
  const rows = getStoredFarmers().filter((farmer) => farmer.id !== id);
  saveStoredFarmers(rows);
}

export const farmerPurchases: FarmerPurchase[] = [];
export const farmerPayments: FarmerPayment[] = [];

const billDates: string[] = [];
for (let i = 0; i < 14; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  billDates.push(d.toISOString().split("T")[0]);
}

export const bills: Bill[] = [];

export const staff: Staff[] = [];

const STORE_REGISTRY_KEY = "nature-biotic-store-registry-v1";
const STAFF_REGISTRY_KEY = "nature-biotic-staff-registry-v1";

function readRegistry<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function mergeRegistry<T extends { id: string }>(target: T[], saved: T[]) {
  saved.forEach((row) => {
    const index = target.findIndex((item) => item.id === row.id);
    if (index >= 0) target[index] = { ...target[index], ...row };
    else target.push(row);
  });
}

mergeRegistry(stores, readRegistry<Store>(STORE_REGISTRY_KEY));
mergeRegistry(staff, readRegistry<Staff>(STAFF_REGISTRY_KEY));

export function getStores() {
  return stores;
}

export function getStaffRecords() {
  return staff;
}

export function replaceStoreRegistry(next: Store[]) {
  stores.splice(0, stores.length, ...next);
  try {
    localStorage.setItem(STORE_REGISTRY_KEY, JSON.stringify(stores));
  } catch {}
}

export function replaceStaffRegistry(next: Staff[]) {
  staff.splice(0, staff.length, ...next);
  try {
    localStorage.setItem(STAFF_REGISTRY_KEY, JSON.stringify(staff));
  } catch {}
}

const PRESERVED_STORAGE_KEYS = new Set([
  "nature-biotic-product-master-v1",
  "nature-biotic-product-party-options-v1",
  "nature-biotic-store-registry-v1",
  "nature-biotic-auth-accounts-v1",
  "nature-biotic-auth-credentials-v1",
  "nature-biotic-auth-session-v1",
  "nature_biotic_admin_details",
  "nature_biotic_admin_bank_details",
  "nature_biotic_company_address",
  "nature_biotic_company_info",
  TRANSACTION_RESET_FLAG,
]);

const PRESERVED_STORAGE_PREFIXES = [
  "nature-biotic-store-user-settings-v1:",
];

function isPreservedStorageKey(key: string) {
  return (
    PRESERVED_STORAGE_KEYS.has(key) ||
    PRESERVED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function isApplicationStorageKey(key: string) {
  return (
    key.startsWith("nature-biotic-") ||
    key.startsWith("naturebiotic") ||
    key.startsWith("nature_biotic_")
  );
}

/**
 * Clears saved operational and demo records. Master data, store records,
 * the product catalog, company settings, and company/store login accounts
 * are left in place. Call this only from an explicit action.
 */
export function resetApplicationData() {
  if (typeof window === "undefined") return;

  const accountKey = "nature-biotic-auth-accounts-v1";
  const credentialKey = "nature-biotic-auth-credentials-v1";
  const sessionKey = "nature-biotic-auth-session-v1";
  const settingsPrefix = "nature-biotic-store-user-settings-v1:";
  let keptIds = new Set<string>();

  try {
    const accounts = JSON.parse(localStorage.getItem(accountKey) || "[]");
    const keptAccounts = Array.isArray(accounts)
      ? accounts.filter(
          (account) =>
            account?.role === "company_admin" || account?.role === "store_admin",
        )
      : [];
    keptIds = new Set(keptAccounts.map((account) => account.id));
    localStorage.setItem(accountKey, JSON.stringify(keptAccounts));

    const credentials = JSON.parse(localStorage.getItem(credentialKey) || "[]");
    localStorage.setItem(
      credentialKey,
      JSON.stringify(
        Array.isArray(credentials)
          ? credentials.filter((row) => keptIds.has(row?.accountId))
          : [],
      ),
    );

    const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
    if (!session?.id || !keptIds.has(session.id)) {
      localStorage.removeItem(sessionKey);
      sessionStorage.removeItem(sessionKey);
    }
  } catch {
    // Keep the existing login records if stored auth data cannot be read.
  }

  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key) keys.push(key);
  }
  keys.forEach((key) => {
    if (key.startsWith(settingsPrefix) && !keptIds.has(key.slice(settingsPrefix.length))) {
      localStorage.removeItem(key);
      return;
    }
    if (!isApplicationStorageKey(key) || isPreservedStorageKey(key)) return;
    localStorage.removeItem(key);
  });

  sessionStorage.removeItem("nature-biotic-open-store-invoice");
  sessionStorage.removeItem("nature-biotic-farmer-profile-tab");

  stores.forEach((store) => {
    store.todaySales = 0;
    store.monthlySales = 0;
    store.totalProfit = 0;
    store.outstanding = 0;
    store.activeCustomers = 0;
    store.inventoryValue = 0;
  });
  try {
    localStorage.setItem(STORE_REGISTRY_KEY, JSON.stringify(stores));
  } catch {}

  staff.splice(0, staff.length);
}

export function attachAccountLink(
  kind: "store" | "staff",
  subjectId: string,
  accountId: string,
) {
  if (kind === "store") {
    const row = stores.find((store) => store.id === subjectId);
    if (!row || row.accountId === accountId) return;
    row.accountId = accountId;
    try {
      localStorage.setItem(STORE_REGISTRY_KEY, JSON.stringify(stores));
    } catch {}
    return;
  }
  const row = staff.find((member) => member.id === subjectId);
  if (!row || row.accountId === accountId) return;
  row.accountId = accountId;
  try {
    localStorage.setItem(STAFF_REGISTRY_KEY, JSON.stringify(staff));
  } catch {}
}

export const deliveryChallans: DeliveryChallan[] = [];

export const executiveStockReturns: ExecutiveStockReturn[] = [];

export function getDeliveryChallansByStore(storeId: string): DeliveryChallan[] {
  return deliveryChallans.filter((challan) => challan.storeId === storeId);
}

export function getExecutiveStockReturnsByStore(
  storeId: string,
): ExecutiveStockReturn[] {
  return executiveStockReturns.filter((item) => item.storeId === storeId);
}

export function getSalesTrend(
  storeId: string,
): { label: string; value: number }[] {
  const storeBills = bills.filter((b) => b.storeId === storeId);
  return billDates
    .slice(0, 7)
    .reverse()
    .map((date) => {
      const d = new Date(date);
      const value = storeBills
        .filter((b) => b.billDate === date)
        .reduce((sum, b) => sum + b.total, 0);
      return {
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        value,
      };
    });
}

export function getStore(id: string): Store | undefined {
  return stores.find((s) => s.id === id);
}

export function getProductsByStore(storeId: string): Product[] {
  return products.filter((p) => p.storeId === storeId);
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getStockStatus(p: Product): StockStatus {
  if (p.stock === 0) return "Out of Stock";
  if (p.stock < p.minStock) return "Low Stock";
  return "Healthy";
}

export const warehouseList = warehouses;

const movementHandlers = ["Ramesh Kumar", "Priya S", "Mohan L", "Karthik N"];
const movementRemarks: Record<StockMovementType, string[]> = {
  IN: [
    "Stock received from supplier",
    "New batch added",
    "Purchase order fulfilled",
  ],
  OUT: ["Sold to farmer", "Stock issued for demo", "Bulk sale to dealer"],
  TRANSFER: ["Transferred to secondary warehouse", "Inter-warehouse transfer"],
  ADJUSTMENT: [
    "Physical count adjustment",
    "Damaged stock removed",
    "Expired stock removed",
  ],
};

export const stockMovements: StockMovement[] = [];

export function getMovementsByProduct(productId: string): StockMovement[] {
  return stockMovements
    .filter((m) => m.productId === productId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getRecentMovements(
  storeId: string,
  limit = 6,
): StockMovement[] {
  const storeProductIds = getProductsByStore(storeId).map((p) => p.id);
  return stockMovements
    .filter((m) => storeProductIds.includes(m.productId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function getLowStockProducts(storeId: string): Product[] {
  return getProductsByStore(storeId).filter((p) => p.stock < p.minStock);
}

export function getOutOfStockProducts(storeId: string): Product[] {
  return getProductsByStore(storeId).filter((p) => p.stock === 0);
}

export function getFarmersByStore(storeId: string): Farmer[] {
  return getStoredFarmers().filter((f) => f.storeId === storeId);
}

export function getFarmerById(id: string): Farmer | undefined {
  return getStoredFarmers().find((f) => f.id === id);
}

export function getPurchasesByFarmer(farmerId: string): FarmerPurchase[] {
  return farmerPurchases
    .filter((p) => p.farmerId === farmerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPaymentsByFarmer(farmerId: string): FarmerPayment[] {
  return farmerPayments
    .filter((p) => p.farmerId === farmerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const cropTypes = [
  "Cotton",
  "Chilli",
  "Paddy",
  "Groundnut",
  "Sugarcane",
  "Banana",
];
export const soilTypes = [
  "Black Soil",
  "Red Soil",
  "Alluvial Soil",
  "Clay Soil",
  "Loamy Soil",
  "Red Loam",
  "Sandy Soil",
];
export const waterSources = [
  "Borewell",
  "Canal",
  "Drip Irrigation",
  "Open Well",
  "Rain-fed",
];
export const paymentMethods = ["Cash", "Bank Transfer", "UPI", "Cheque"];
export const customerCategories: CustomerCategory[] = [
  "Retail",
  "Wholesale",
  "Dealer",
];

export function getBillsByStore(storeId: string): Bill[] {
  return bills
    .filter((b) => b.storeId === storeId)
    .sort((a, b) => b.billDate.localeCompare(a.billDate));
}

export function getStaffByStore(storeId: string): Staff[] {
  return staff.filter((s) => s.storeId === storeId);
}

export const productSizes = [
  "10 ml",
  "50 ml",
  "100 ml",
  "250 ml",
  "500 ml",
  "1 L",
  "5 L",
  "10 L",
  "25 L",
  "10 g",
  "100 g",
  "250 g",
  "500 g",
  "1 Kg",
  "5 Kg",
  "10 Kg",
  "25 Kg",
];

export const productCategories: ProductCategory[] = [
  "Bio-stimulant",
  "Pesticide",
  "Fungicide",
  "Nutrients (Fertilizer)",
  "Manenes",
];

export const productTypes: ProductType[] = [
  "Liquid",
  "Powder",
  "Gel",
  "Granules",
];

export const purpose: Purpose[] = [
  "Root Enhancer",
  "Vegetative Growth Simulator",
  "Tillers and Branche Developers",
  "Flower Enhancer",
  "Bud Developer",
  "Yield Enhancer",
  "Larvicide",
  "Miticide & Acaricide",
  "Botanical fungicide",
  "Insecticide (Suckingpest)",
];

// Store Purchase Order / Purchase Return -> Company Approval sync
export type StoreApprovalRequestType = "Purchase Order" | "Purchase Return";
export type StoreApprovalRequestStatus = "Pending" | "Approved" | "Rejected";
export type StoreApprovalRequest = {
  id: string;
  type: StoreApprovalRequestType;
  storeId: string;
  storeName: string;
  date: string;
  referenceNo: string;
  amount: number;
  status: StoreApprovalRequestStatus;
  createdAt: number;
  decidedAt?: number;
};
const STORE_APPROVAL_REQUESTS_KEY = "nature-biotic-store-approval-requests-v1";
const STORE_APPROVAL_EVENT = "store-approval-requests-updated";

export function getStoreApprovalRequests(): StoreApprovalRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_APPROVAL_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function saveStoreApprovalRequests(rows: StoreApprovalRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORE_APPROVAL_REQUESTS_KEY,
      JSON.stringify(rows),
    );
    window.dispatchEvent(new Event(STORE_APPROVAL_EVENT));
  } catch {}
}
export function addStoreApprovalRequest(
  row: Omit<StoreApprovalRequest, "status" | "createdAt"> &
    Partial<Pick<StoreApprovalRequest, "status" | "createdAt">>,
) {
  const existing = getStoreApprovalRequests();
  const next: StoreApprovalRequest = {
    ...row,
    status: row.status ?? "Pending",
    createdAt: row.createdAt ?? Date.now(),
  };
  saveStoreApprovalRequests([
    next,
    ...existing.filter((item) => item.id !== next.id),
  ]);
  return next;
}
export function updateStoreApprovalRequestStatus(
  id: string,
  status: StoreApprovalRequestStatus,
) {
  const existing = getStoreApprovalRequests();
  const target = existing.find((row) => row.id === id);
  if (!target || target.status !== "Pending" || status === "Pending") {
    return existing;
  }
  const updated = existing.map((row) =>
    row.id === id ? { ...row, status, decidedAt: Date.now() } : row,
  );
  saveStoreApprovalRequests(updated);
  if (target.type === "Purchase Return") notifyStoreStockChanged();
  return updated;
}
export function getStoreApprovalRequest(
  type: StoreApprovalRequestType,
  storeId: string,
  referenceNo: string,
) {
  return getStoreApprovalRequests().find(
    (row) =>
      row.type === type &&
      row.storeId === storeId &&
      row.referenceNo === referenceNo,
  );
}
export const storeApprovalRequestsUpdatedEvent = STORE_APPROVAL_EVENT;

export type CompanyRefund = {
  id: string;
  date: string;
  storeId: string;
  storeName: string;
  referenceNo: string;
  amount: number;
  refundNo?: string;
  reason?: string;
  paymentMethod?: string;
  remarks?: string;
  balance?: number;
  purchaseRef?: string;
  /** Part of `amount` that reduced outstanding. The rest was paid out in cash. */
  appliedToOutstanding?: number;
};

const COMPANY_REFUND_KEY = "nature-biotic-company-refunds-v1";
export const companyRefundsUpdatedEvent = "nature-biotic-company-refunds-updated";

function roundMoney(value: number) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
}

/** A refund splits into the part that settles outstanding and the part paid in cash. */
export function companyRefundParts(refund: {
  amount?: number;
  appliedToOutstanding?: number;
}) {
  const amount = roundMoney(refund.amount || 0);
  const applied = Math.min(amount, roundMoney(refund.appliedToOutstanding || 0));
  return { amount, applied, paid: roundMoney(amount - applied) };
}

/**
 * Preview only. Outstanding changes when the refund is saved, not when this runs.
 * `cash` is the amount paid out. `applied` is what settles outstanding.
 * `settled` is both together and is what consumes the return.
 */
export function previewRefundSettlement(input: {
  refundable: number;
  outstanding: number;
  apply: boolean;
  cash: number;
}) {
  const refundable = roundMoney(input.refundable);
  const outstanding = roundMoney(input.outstanding);
  const applied = input.apply ? Math.min(refundable, outstanding) : 0;
  const maxCash = roundMoney(Math.max(0, refundable - applied));
  const cash = roundMoney(Math.max(0, input.cash));
  return {
    applied,
    maxCash,
    cash,
    exceeds: cash - maxCash > 0.001,
    settled: roundMoney(applied + Math.min(cash, maxCash)),
    outstandingAfter: roundMoney(Math.max(0, outstanding - applied)),
  };
}

type DueInvoice = { key: string; date: string; due: number };

/** Spend each applied refund on its invoice first, then the account's other invoices. */
function applyRefundsToInvoices(
  invoices: DueInvoice[],
  refunds: { invoiceKey: string; date: string; applied: number }[],
) {
  const rows = invoices.map((row) => ({ ...row, due: roundMoney(row.due) }));
  [...refunds]
    .filter((row) => row.applied > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((refund) => {
      let left = roundMoney(refund.applied);
      const primary = rows.find((row) => row.key === refund.invoiceKey);
      const order = [
        ...(primary ? [primary] : []),
        ...rows
          .filter((row) => row !== primary)
          .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)),
      ];
      order.forEach((row) => {
        if (left <= 0 || row.due <= 0) return;
        const take = Math.min(left, row.due);
        row.due = roundMoney(row.due - take);
        left = roundMoney(left - take);
      });
    });
  return rows;
}

export type CompanyStorePosition = {
  storeId: string;
  storeName: string;
  grossSales: number;
  receipts: number;
  appliedToOutstanding: number;
  cashRefunds: number;
  outstanding: number;
  invoiceDue: Map<string, number>;
};

/** What a store still owes the company. An approved return does not reduce this. */
export function getCompanyStorePositions(): Map<string, CompanyStorePosition> {
  const byStore = new Map<
    string,
    {
      storeName: string;
      invoices: Map<string, { invoiceNo: string; date: string; total: number; collected: number }>;
      refunds: { invoiceKey: string; date: string; applied: number; paid: number }[];
    }
  >();
  const take = (storeId: string, storeName?: string) => {
    const current: {
      storeName: string;
      invoices: Map<string, { invoiceNo: string; date: string; total: number; collected: number }>;
      refunds: { invoiceKey: string; date: string; applied: number; paid: number }[];
    } = byStore.get(storeId) || {
      storeName: storeName || "",
      invoices: new Map(),
      refunds: [],
    };
    if (storeName && !current.storeName) current.storeName = storeName;
    byStore.set(storeId, current);
    return current;
  };

  getFinalCompanyStoreSales().forEach((sale) => {
    const storeId = String(sale.storeId || "");
    const invoiceNo = String(sale.invoiceNo || "").trim();
    if (!storeId || !invoiceNo) return;
    const bucket = take(storeId, sale.storeName);
    const key = invoiceNo.toLowerCase();
    const current = bucket.invoices.get(key) || {
      invoiceNo,
      date: String(sale.date || ""),
      total: 0,
      collected: 0,
    };
    current.total += roundMoney(sale.total || 0);
    if (!current.date || String(sale.date || "") < current.date) {
      current.date = String(sale.date || "");
    }
    bucket.invoices.set(key, current);
  });

  let receipts: any[] = [];
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(COMPANY_RECEIPT_STORAGE_KEY)
        : null;
    const parsed = raw ? JSON.parse(raw) : [];
    receipts = Array.isArray(parsed) ? parsed : [];
  } catch {
    receipts = [];
  }
  receipts.forEach((receipt) => {
    const storeId = String(receipt?.storeId || "");
    const invoiceNo = String(receipt?.invoiceNo || "").trim();
    if (!storeId || !invoiceNo) return;
    const current = take(storeId, receipt?.storeName).invoices.get(invoiceNo.toLowerCase());
    if (current) current.collected += roundMoney(receipt?.amount || 0);
  });

  getCompanyRefunds().forEach((refund) => {
    if (!refund.storeId) return;
    const parts = companyRefundParts(refund);
    take(refund.storeId, refund.storeName).refunds.push({
      invoiceKey: String(refund.purchaseRef || "").trim().toLowerCase(),
      date: String(refund.date || ""),
      applied: parts.applied,
      paid: parts.paid,
    });
  });

  const positions = new Map<string, CompanyStorePosition>();
  byStore.forEach((bucket, storeId) => {
    const invoices = [...bucket.invoices.values()].map((row) => ({
      key: row.invoiceNo.toLowerCase(),
      date: row.date,
      due: Math.max(0, row.total - row.collected),
    }));
    const settled = applyRefundsToInvoices(invoices, bucket.refunds);
    const grossSales = [...bucket.invoices.values()].reduce((sum, row) => sum + row.total, 0);
    const collected = [...bucket.invoices.values()].reduce((sum, row) => sum + row.collected, 0);
    positions.set(storeId, {
      storeId,
      storeName: bucket.storeName,
      grossSales,
      receipts: collected,
      appliedToOutstanding: bucket.refunds.reduce((sum, row) => sum + row.applied, 0),
      cashRefunds: bucket.refunds.reduce((sum, row) => sum + row.paid, 0),
      outstanding: settled.reduce((sum, row) => sum + row.due, 0),
      invoiceDue: new Map(settled.map((row) => [row.key, row.due])),
    });
  });
  return positions;
}

export function getCompanyStoreOutstanding(storeId: string) {
  return getCompanyStorePositions().get(storeId)?.outstanding || 0;
}

export function getCompanyInvoiceDue(storeId: string, invoiceNo: string) {
  const due = getCompanyStorePositions()
    .get(storeId)
    ?.invoiceDue.get(String(invoiceNo || "").trim().toLowerCase());
  return due || 0;
}

export function getCompanyRefunds(): CompanyRefund[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPANY_REFUND_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function purchaseReturnRefundable(storeId: string, referenceNo: string) {
  const request = getStoreApprovalRequest(
    "Purchase Return",
    storeId,
    referenceNo,
  );
  if (!request || request.status !== "Approved") return 0;
  const seen = new Set<string>();
  const refunded = getCompanyRefunds().reduce((sum, row) => {
    if (row.storeId !== storeId) return sum;
    const identity = String(row.id || row.refundNo || "")
      .trim()
      .toLowerCase();
    if (identity && seen.has(identity)) return sum;
    if (identity) seen.add(identity);
    if (
      String(row.referenceNo || "").trim().toLowerCase() !==
      referenceNo.trim().toLowerCase()
    ) {
      return sum;
    }
    return sum + Math.max(0, Number(row.amount || 0));
  }, 0);
  return Math.max(0, Number(request.amount || 0) - refunded);
}

export function addCompanyRefund(input: {
  storeId: string;
  storeName: string;
  referenceNo: string;
  amount: number;
  date: string;
  refundNo?: string;
  reason?: string;
  paymentMethod?: string;
  remarks?: string;
  balance?: number;
  purchaseRef?: string;
  applyToOutstanding?: boolean;
}) {
  const amount = Math.round(Math.max(0, Number(input.amount || 0)) * 100) / 100;
  const referenceNo = input.referenceNo.trim();
  const refundNo = String(input.refundNo || "").trim();
  if (!input.storeId || !referenceNo || amount <= 0) {
    return { ok: false as const, error: "Enter a refund amount for this purchase return." };
  }
  const existing = getCompanyRefunds();
  if (
    refundNo &&
    existing.some(
      (item) =>
        String(item.refundNo || "").trim().toLowerCase() === refundNo.toLowerCase(),
    )
  ) {
    return { ok: false as const, error: "This refund number is already saved." };
  }
  const remaining = purchaseReturnRefundable(input.storeId, referenceNo);
  if (amount - remaining > 0.001) {
    return {
      ok: false as const,
      error: `Refund cannot exceed the remaining ${remaining.toFixed(2)} on ${referenceNo}.`,
    };
  }
  const row: CompanyRefund = {
    id: `company-refund-${input.storeId}-${referenceNo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: input.date,
    storeId: input.storeId,
    storeName: input.storeName,
    referenceNo,
    amount,
    refundNo,
    reason: input.reason || "",
    paymentMethod: input.paymentMethod || "",
    remarks: input.remarks || "",
    balance: input.balance,
    purchaseRef: input.purchaseRef || "",
    appliedToOutstanding: input.applyToOutstanding
      ? Math.min(amount, getCompanyStoreOutstanding(input.storeId))
      : 0,
  };
  if (existing.some((item) => item.id === row.id)) {
    return { ok: true as const, row };
  }
  window.localStorage.setItem(
    COMPANY_REFUND_KEY,
    JSON.stringify([row, ...existing]),
  );
  window.dispatchEvent(new Event(companyRefundsUpdatedEvent));
  return { ok: true as const, row };
}

/**
 * Company ↔ store account. An approved return lowers net sales only.
 * Outstanding stays until a refund is applied against it. The cash part of a
 * refund lowers collection and does not change outstanding.
 */
export function settleCompanyAccount(input: {
  grossSales: number;
  salesReturns: number;
  receipts: number;
  refunds: number;
  appliedToOutstanding?: number;
}) {
  const grossSales = Math.max(0, input.grossSales);
  const salesReturns = Math.min(grossSales, Math.max(0, input.salesReturns));
  const netSales = grossSales - salesReturns;
  const receipts = Math.max(0, input.receipts);
  const cashRefunds = Math.max(0, input.refunds);
  const applied = Math.max(0, input.appliedToOutstanding ?? 0);
  const collection = receipts - cashRefunds;
  const outstanding = Math.max(0, grossSales - receipts - applied);
  return { grossSales, salesReturns, netSales, collection, outstanding };
}

export function froOwnsTransaction(
  row: {
    createdByStaffId?: string;
    staffId?: string;
    froId?: string;
    receivedBy?: string;
    handedOverBy?: string;
    enteredBy?: string;
    froName?: string;
    executiveName?: string;
  },
  froName: string,
  staffId?: string,
) {
  const rowStaff = String(
    row?.createdByStaffId || row?.staffId || row?.froId || "",
  ).trim();
  const key = String(staffId || "").trim();
  if (rowStaff) return Boolean(key) && rowStaff === key;
  const owner = storedPerson(
    row?.receivedBy ||
      row?.handedOverBy ||
      row?.enteredBy ||
      row?.froName ||
      row?.executiveName,
  );
  const name = storedPerson(froName);
  return Boolean(owner) && Boolean(name) && owner === name;
}

// ===== FRO Current Stock Calculation =====

export type FROStockRow = {
  id: Key | null | undefined;
  unitValue: any;
  currentQty: any;
  productId: string;
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  issuedQty: number;
  returnedQty: number;
  currentStock: number; // issued - returned
};

// ============================================================
// FRO STOCK TRANSACTION LOG (date-wise, for filterable "Stocks in Hand")
// ============================================================

export type FROStockTxn = {
  id: string;
  storeId: string;
  executiveName: string;
  productId: string;
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  unitValue: number;
  qty: number; // positive = Delivery (IN), negative = Return/Sale (OUT)
  date: string; // yyyy-mm-dd
  type: "Delivery" | "Return" | "Sale" | "SaleReturn";
};

// Accepted Store → FRO delivery ledger.
// Store stock moves to Hand Stock only after the FRO accepts the delivery.
const FRO_ACCEPTED_DELIVERY_KEY = "nature-biotic-fro-accepted-deliveries-v1";
const STORE_RETURN_RECEIVED_PREFIX =
  "nature-biotic-store-stock-return-received-v1";
const FRO_PENDING_DELIVERY_PREFIX = "nature-biotic-fro-pending-deliveries-v1";
const FRO_RETURN_REQUEST_PREFIX = "nature-biotic-fro-stock-return-requests-v1";
const PROCESSED_STOCK_MOVEMENT_KEY =
  "nature-biotic-processed-stock-movements-v1";
const DELIVERY_CHALLAN_PREFIX = "nature-biotic-store-delivery-challans-v2";

function normStockText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normPackSize(value: unknown) {
  return normStockText(value).replace(/\s+/g, "");
}

function normBatchNo(value: unknown) {
  const text = normStockText(value);
  if (!text || text === "-" || text === "n/a" || text === "na") return "";
  return text;
}

function stockVariantsMatch(
  a: {
    productId?: string;
    productName?: string;
    packSize?: string;
    batchNo?: string;
  },
  b: {
    productId?: string;
    productName?: string;
    packSize?: string;
    batchNo?: string;
  },
) {
  if (normPackSize(a.packSize) !== normPackSize(b.packSize)) return false;

  const aBatch = normBatchNo(a.batchNo);
  const bBatch = normBatchNo(b.batchNo);
  if (aBatch !== bBatch) return false;

  const aId = String(a.productId || "");
  const bId = String(b.productId || "");
  if (aId && bId) return aId === bId;

  const aName = normStockText(a.productName);
  const bName = normStockText(b.productName);
  return Boolean(aName && bName && aName === bName);
}

type AcceptedStoreDeliveryItem = {
  productId: string;
  productName?: string;
  packSize: string;
  batchNo: string;
  qty: number;
};

type AcceptedStoreDelivery = {
  id: string;
  storeId: string;
  executiveName: string;
  date: string;
  items: AcceptedStoreDeliveryItem[];
};

function getProcessedStockMovementIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROCESSED_STOCK_MOVEMENT_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.map(String) : [];
  } catch {
    return [];
  }
}

function markStockMovementProcessed(movementId?: string) {
  if (!movementId || typeof window === "undefined") return;
  const existing = getProcessedStockMovementIds();
  if (existing.includes(movementId)) return;
  try {
    window.localStorage.setItem(
      PROCESSED_STOCK_MOVEMENT_KEY,
      JSON.stringify([movementId, ...existing]),
    );
  } catch {}
}

function isStockMovementProcessed(movementId?: string) {
  if (!movementId) return false;
  return getProcessedStockMovementIds().includes(movementId);
}

function notifyStoreStockChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("nature-biotic-store-inventory-updated"));
  window.dispatchEvent(new Event("fro-accepted-deliveries-updated"));
}

function getAcceptedStoreDeliveries(storeId: string): AcceptedStoreDelivery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      `${FRO_ACCEPTED_DELIVERY_KEY}:${storeId}`,
    );
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveAcceptedStoreDeliveries(
  storeId: string,
  rows: AcceptedStoreDelivery[],
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${FRO_ACCEPTED_DELIVERY_KEY}:${storeId}`,
      JSON.stringify(rows),
    );
    notifyStoreStockChanged();
  } catch {}
}

export function getAcceptedStoreDeliveryQty(
  storeId: string,
  productId: string,
  packSize: string,
  batchNo: string,
  productName?: string,
): number {
  const target = { productId, productName, packSize, batchNo };
  return getAcceptedStoreDeliveries(storeId).reduce((sum, delivery) => {
    return (
      sum +
      delivery.items.reduce((itemSum, item) => {
        return (
          itemSum +
          (stockVariantsMatch(item, target)
            ? Math.max(0, Number(item.qty || 0))
            : 0)
        );
      }, 0)
    );
  }, 0);
}

export function getAcceptedStoreReturns(storeId: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      `${STORE_RETURN_RECEIVED_PREFIX}:${storeId}`,
    );
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows)
      ? rows.filter((row: any) => row?.status === "accepted")
      : [];
  } catch {
    return [];
  }
}

export function getAcceptedStoreReturnQty(
  storeId: string,
  productId: string,
  packSize: string,
  batchNo: string,
  productName?: string,
): number {
  const target = { productId, productName, packSize, batchNo };
  return getAcceptedStoreReturns(storeId).reduce((sum, request: any) => {
    return (
      sum +
      (request.items || []).reduce((itemSum: number, item: any) => {
        return (
          itemSum +
          (stockVariantsMatch(
            {
              productId: item.productId,
              productName: item.product ?? item.productName,
              packSize: item.packSize,
              batchNo: item.batchNo,
            },
            target,
          )
            ? Math.max(0, Number(item.qty || 0))
            : 0)
        );
      }, 0)
    );
  }, 0);
}

const STORE_SALES_INVOICE_PREFIX = "nature-biotic-store-sales-invoices-v2";
const STORE_SALES_RETURN_PREFIX = "nature-biotic-store-sales-returns-v2";
const STORE_CREDIT_NOTE_PREFIX = "nature-biotic-store-credit-notes-v3";
const STORE_STOCK_ADJUSTMENT_PREFIX = "nature-biotic-store-stock-adjustments-v1";

type StoreInvoiceDue = {
  farmerId: string;
  farmerName: string;
  invoiceNo: string;
  due: number;
};

/** Invoice balances after receipts and refunds applied to outstanding. Returns do not reduce these. */
function storeInvoiceDueRows(storeId: string): StoreInvoiceDue[] {
  const invoices = readStorageArray(`${STORE_SALES_INVOICE_PREFIX}:${storeId}`).filter(
    (row) => !isVoidStatus(row?.status) && String(row?.invoiceNo || "").trim(),
  );
  const receipts = readStorageArray(`${STORE_RECEIPT_STORAGE_PREFIX}${storeId}`).filter(
    (row) => !isVoidStatus(row?.status),
  );
  const refunds = readStorageArray(`nature-biotic-store-refunds-v2:${storeId}`).filter(
    (row) => !isVoidStatus(row?.status),
  );
  const farmers = new Map<
    string,
    {
      invoices: DueInvoice[];
      meta: Map<string, { farmerId: string; farmerName: string; invoiceNo: string }>;
      refunds: { invoiceKey: string; date: string; applied: number }[];
    }
  >();
  invoices.forEach((row) => {
    const invoiceNo = String(row.invoiceNo || "").trim();
    const farmerId = String(row.farmerId || "").trim();
    const farmerName = String(row.partyName || row.farmerName || "").trim();
    const farmerKey = farmerId ? `id:${farmerId}` : `name:${farmerName.toLowerCase()}`;
    if (!farmerKey || farmerKey === "name:") return;
    const bucket: {
      invoices: DueInvoice[];
      meta: Map<string, { farmerId: string; farmerName: string; invoiceNo: string }>;
      refunds: { invoiceKey: string; date: string; applied: number }[];
    } = farmers.get(farmerKey) || {
      invoices: [],
      meta: new Map(),
      refunds: [],
    };
    const key = invoiceNo.toLowerCase();
    const existing = bucket.invoices.find((item) => item.key === key);
    const amount = roundMoney(row.amount || row.total || 0);
    if (existing) {
      existing.due += amount;
    } else {
      bucket.invoices.push({
        key,
        date: String(row.date || ""),
        due: amount,
      });
      bucket.meta.set(key, { farmerId, farmerName, invoiceNo });
    }
    farmers.set(farmerKey, bucket);
  });
  farmers.forEach((bucket) => {
    bucket.invoices.forEach((invoice) => {
      const collected = receipts.reduce((sum, receipt) => {
        return String(receipt?.invoiceNo || "").trim().toLowerCase() === invoice.key
          ? sum + roundMoney(receipt?.amount || 0)
          : sum;
      }, 0);
      invoice.due = Math.max(0, invoice.due - collected);
    });
  });
  refunds.forEach((row) => {
    const parts = companyRefundParts(row);
    if (parts.applied <= 0) return;
    const farmerId = String(row.farmerId || "").trim();
    const farmerName = String(row.farmerName || row.partyName || "").trim();
    const farmerKey = farmerId ? `id:${farmerId}` : `name:${farmerName.toLowerCase()}`;
    const bucket = farmers.get(farmerKey);
    if (!bucket) return;
    bucket.refunds.push({
      invoiceKey: String(row.invoiceNo || "").trim().toLowerCase(),
      date: String(row.date || ""),
      applied: parts.applied,
    });
  });
  const result: StoreInvoiceDue[] = [];
  farmers.forEach((bucket) => {
    applyRefundsToInvoices(bucket.invoices, bucket.refunds).forEach((row) => {
      const meta = bucket.meta.get(row.key);
      if (!meta) return;
      result.push({ ...meta, due: row.due });
    });
  });
  return result;
}

export function getStoreInvoiceOutstanding(storeId: string, invoiceNo: string) {
  const key = String(invoiceNo || "").trim().toLowerCase();
  return (
    storeInvoiceDueRows(storeId).find(
      (row) => row.invoiceNo.trim().toLowerCase() === key,
    )?.due || 0
  );
}

export function getStoreFarmerOutstanding(
  storeId: string,
  farmerId?: string,
  farmerName?: string,
) {
  const id = String(farmerId || "").trim();
  const name = String(farmerName || "").trim().toLowerCase();
  return storeInvoiceDueRows(storeId).reduce((sum, row) => {
    if (id && row.farmerId === id) return sum + row.due;
    if (!id && name && row.farmerName.trim().toLowerCase() === name) return sum + row.due;
    return sum;
  }, 0);
}

function readStorageArray(key: string): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function variantOf(item: any) {
  const named =
    item?.productName ||
    item?.product?.name ||
    (typeof item?.product === "string" ? item.product : "") ||
    item?.name ||
    "";
  return {
    productId: String(item?.catalogProductId || item?.productId || ""),
    productName: String(named),
    packSize: String(item?.packSize || item?.pkgsize || item?.size || ""),
    batchNo: String(item?.batchNo || ""),
  };
}

function isExecutiveMovement(row: any) {
  return String(row?.through || "").trim().toLowerCase() === "executive";
}

function directStoreSaleQty(storeId: string, target: any) {
  return readStorageArray(`${STORE_SALES_INVOICE_PREFIX}:${storeId}`).reduce(
    (sum, invoice) => {
      if (isExecutiveMovement(invoice)) return sum;
      const lines = Array.isArray(invoice?.products) ? invoice.products : [];
      return (
        sum +
        lines.reduce((lineSum: number, line: any) => {
          return (
            lineSum +
            (stockVariantsMatch(variantOf(line), target)
              ? Math.max(0, Number(line?.quantity ?? line?.qty ?? 0))
              : 0)
          );
        }, 0)
      );
    },
    0,
  );
}

function directStoreReturnQty(storeId: string, target: any) {
  const salesReturns = readStorageArray(
    `${STORE_SALES_RETURN_PREFIX}:${storeId}`,
  ).reduce((sum, row) => {
    if (isExecutiveMovement(row)) return sum;
    const lines = Array.isArray(row?.items) ? row.items : [];
    return (
      sum +
      lines.reduce((lineSum: number, line: any) => {
        return (
          lineSum +
          (stockVariantsMatch(variantOf(line), target)
            ? Math.max(0, Number(line?.quantity ?? line?.qty ?? 0))
            : 0)
        );
      }, 0)
    );
  }, 0);

  const creditNotes = readStorageArray(
    `${STORE_CREDIT_NOTE_PREFIX}:${storeId}`,
  ).reduce((sum, row) => {
    if (
      isExecutiveMovement(row) ||
      row?.status === "Rejected" ||
      row?.status === "Draft"
    ) {
      return sum;
    }
    return (
      sum +
      (stockVariantsMatch(variantOf(row), target)
        ? Math.max(0, Number(row?.quantity || 0))
        : 0)
    );
  }, 0);

  return salesReturns + creditNotes;
}

function approvedCompanyCreditQty(storeId: string, target: any) {
  return getCompanyCreditNoteSyncRecords().reduce((sum, row) => {
    if (row.storeId !== storeId || row.status !== "Approved") return sum;
    return (
      sum +
      (stockVariantsMatch(
        {
          productId: (row as any).productId,
          productName: row.product,
          packSize: row.packSize || row.pkgsize,
          batchNo: row.batchNo,
        },
        target,
      )
        ? Math.max(0, Number(row.quantity || 0))
        : 0)
    );
  }, 0);
}

function approvedPurchaseReturnQty(storeId: string | undefined, target: any) {
  return getApprovedStorePurchaseReturns(storeId).reduce(
    (sum, row) =>
      sum +
      row.items.reduce(
        (lineSum: number, line: any) =>
          lineSum +
          (stockVariantsMatch(variantOf(line), target)
            ? Math.max(0, Number(line?.quantity || 0))
            : 0),
        0,
      ),
    0,
  );
}

export type StoreStockAdjustmentRecord = {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  packSize: string;
  batchNo: string;
  qty: number;
  reason: string;
  date: string;
};

export function getStoreStockAdjustments(storeId: string) {
  return readStorageArray(
    `${STORE_STOCK_ADJUSTMENT_PREFIX}:${storeId}`,
  ) as StoreStockAdjustmentRecord[];
}

export function recordStoreStockAdjustment(row: StoreStockAdjustmentRecord) {
  if (typeof window === "undefined" || !row?.id) return;
  const key = `${STORE_STOCK_ADJUSTMENT_PREFIX}:${row.storeId}`;
  const existing = getStoreStockAdjustments(row.storeId);
  if (existing.some((item) => item.id === row.id)) return;
  try {
    window.localStorage.setItem(key, JSON.stringify([row, ...existing]));
    notifyStoreStockChanged();
  } catch {}
}

export function allocateStoreStockAdjustment(input: StoreStockAdjustmentRecord) {
  const existing = getStoreStockAdjustments(input.storeId);
  if (
    existing.some(
      (row) => row.id === input.id || row.id.startsWith(`${input.id}:`),
    )
  ) {
    return;
  }

  if (input.qty >= 0) {
    recordStoreStockAdjustment({ ...input, batchNo: input.batchNo || "" });
    return;
  }

  const sameSize = (item: {
    productId?: string;
    productName?: string;
    packSize?: string;
  }) =>
    stockVariantsMatch(
      {
        productId: item.productId,
        productName: item.productName,
        packSize: item.packSize,
        batchNo: "",
      },
      {
        productId: input.productId,
        productName: input.productName,
        packSize: input.packSize,
        batchNo: "",
      },
    );

  const batches = new Set<string>();
  getStorePurchasesFromCompanySales(input.storeId).forEach((purchase) => {
    if (!isStorePurchaseReceived(String(purchase.invoiceNo || ""))) return;
    if (
      sameSize({
        productId: (purchase as any).productId,
        productName: purchase.product,
        packSize: purchase.packSize || purchase.pkgsize,
      })
    ) {
      batches.add(String(purchase.batchNo || ""));
    }
  });

  let remaining = Math.abs(input.qty);
  batches.forEach((batchNo) => {
    if (remaining <= 0) return;
    const available = getStoreAvailableQty(
      input.storeId,
      input.productId,
      input.packSize,
      batchNo,
      input.productName,
    );
    const take = Math.min(available, remaining);
    if (take <= 0) return;
    recordStoreStockAdjustment({
      ...input,
      id: `${input.id}:${batchNo || "none"}`,
      batchNo,
      qty: -take,
    });
    remaining -= take;
  });
}

function storeAdjustmentQty(storeId: string, target: any) {
  return getStoreStockAdjustments(storeId).reduce((sum, row) => {
    return (
      sum +
      (stockVariantsMatch(variantOf(row), target) ? Number(row.qty || 0) : 0)
    );
  }, 0);
}

export function getStoreAvailableQty(
  storeId: string,
  productId: string,
  packSize: string,
  batchNo: string,
  productName?: string,
): number {
  const target = { productId, productName, packSize, batchNo };
  const purchased = getStorePurchasesFromCompanySales(storeId).reduce(
    (sum, purchase) => {
      if (!isStorePurchaseReceived(String(purchase.invoiceNo || ""))) return sum;
      const matches = stockVariantsMatch(
        {
          productId: String((purchase as any).productId || ""),
          productName: String(purchase.product || ""),
          packSize: String(purchase.packSize || purchase.pkgsize || ""),
          batchNo: String(purchase.batchNo || ""),
        },
        target,
      );
      return matches ? sum + Math.max(0, Number(purchase.quantity || 0)) : sum;
    },
    0,
  );

  const delivered = getAcceptedStoreDeliveryQty(
    storeId,
    productId,
    packSize,
    batchNo,
    productName,
  );
  const returned = getAcceptedStoreReturnQty(
    storeId,
    productId,
    packSize,
    batchNo,
    productName,
  );
  const sold = directStoreSaleQty(storeId, target);
  const customerReturns = directStoreReturnQty(storeId, target);
  const adjustments = storeAdjustmentQty(storeId, target);
  const companyCredits = approvedCompanyCreditQty(storeId, target);
  const purchaseReturns = approvedPurchaseReturnQty(storeId, target);

  return Math.max(
    0,
    purchased -
      delivered +
      returned -
      sold +
      customerReturns +
      adjustments -
      companyCredits -
      purchaseReturns,
  );
}

export function getCompanyAvailableQty(
  productId: string,
  packSize: string,
  productName?: string,
) {
  const target = {
    productId,
    productName,
    packSize,
    batchNo: "",
  };
  const sameSize = (item: {
    productId?: string;
    productName?: string;
    packSize?: string;
  }) =>
    stockVariantsMatch(
      {
        productId: item.productId,
        productName: item.productName,
        packSize: item.packSize,
        batchNo: "",
      },
      target,
    );

  const opening = getProductMaster()
    .filter((product) =>
      sameSize({
        productId: product.id,
        productName: product.name,
        packSize: product.size,
      }),
    )
    .reduce((sum, product) => sum + Math.max(0, Number(product.stock || 0)), 0);

  const sold = getFinalCompanyStoreSales().reduce((sum, sale) => {
    return (
      sum +
      (sameSize({
        productId: sale.productId,
        productName: sale.product,
        packSize: sale.packSize || sale.pkgsize,
      })
        ? Math.max(0, Number(sale.quantity || 0))
        : 0)
    );
  }, 0);

  const returned = getCompanyCreditNoteSyncRecords().reduce((sum, row) => {
    if (row.status !== "Approved") return sum;
    return (
      sum +
      (sameSize({
        productId: (row as any).productId,
        productName: row.product,
        packSize: row.packSize || row.pkgsize,
      })
        ? Math.max(0, Number(row.quantity || 0))
        : 0)
    );
  }, 0);

  const purchaseReturned = getApprovedStorePurchaseReturns().reduce(
    (sum, row) =>
      sum +
      row.items.reduce((lineSum: number, line: any) => {
        const variant = variantOf(line);
        return (
          lineSum +
          (sameSize(variant) ? Math.max(0, Number(line?.quantity || 0)) : 0)
        );
      }, 0),
    0,
  );

  return Math.max(0, opening - sold + returned + purchaseReturned);
}

export function approveCompanyCreditNotes(storeId: string, creditNoteNo: string) {
  const rows = getCompanyCreditNoteSyncRecords().map((row) =>
    row.storeId === storeId && row.creditNoteNo === creditNoteNo
      ? { ...row, status: "Approved" as const }
      : row,
  );
  saveCompanyCreditNoteSyncRecords(rows);
  notifyStoreStockChanged();
  return rows;
}

export function recordAcceptedStoreDelivery(
  storeId: string,
  executiveName: string,
  items: AcceptedStoreDeliveryItem[],
  date?: string,
  deliveryId?: string,
) {
  const existing = getAcceptedStoreDeliveries(storeId);

  if (deliveryId && existing.some((row) => row.id === deliveryId)) {
    markStockMovementProcessed(deliveryId);
    return existing;
  }

  const next: AcceptedStoreDelivery = {
    id:
      deliveryId ||
      `accepted-delivery-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    storeId,
    executiveName,
    date: date || new Date().toISOString().split("T")[0],
    items: items.map((item) => ({
      productId: String(item.productId || ""),
      productName: String(item.productName || ""),
      packSize: String(item.packSize || ""),
      batchNo: String(item.batchNo || ""),
      qty: Math.max(0, Number(item.qty || 0)),
    })),
  };

  const rows = [next, ...existing];
  saveAcceptedStoreDeliveries(storeId, rows);
  markStockMovementProcessed(next.id);
  return rows;
}

export function recordAcceptedStoreReturn(storeId: string, request: any) {
  if (typeof window === "undefined") return [];
  try {
    const key = `${STORE_RETURN_RECEIVED_PREFIX}:${storeId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const rows = Array.isArray(existing) ? existing : [];
    if (rows.some((row: any) => String(row.id) === String(request.id))) {
      markStockMovementProcessed(request.id);
      return rows;
    }

    const next = [
      {
        ...request,
        status: "accepted",
        source: "FRO",
        receivedBy: "Store",
      },
      ...rows,
    ];
    localStorage.setItem(key, JSON.stringify(next));
    markStockMovementProcessed(request.id);
    notifyStoreStockChanged();
    window.dispatchEvent(new Event("nature-biotic-store-stock-return-updated"));
    return next;
  } catch {
    return [];
  }
}

export function persistDeliveryChallanAccepted(accepted: {
  id: string;
  storeId?: string;
  executive?: string;
  [key: string]: any;
}) {
  if (typeof window === "undefined") return;

  const updateKey = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) return false;
      let found = false;
      const next = rows.map((item: any) => {
        if (String(item.id) === String(accepted.id)) {
          found = true;
          return { ...item, ...accepted, status: "accepted" };
        }
        return item;
      });
      if (found) localStorage.setItem(key, JSON.stringify(next));
      return found;
    } catch {
      return false;
    }
  };

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith(`${DELIVERY_CHALLAN_PREFIX}:`) ||
      key.startsWith(`${FRO_PENDING_DELIVERY_PREFIX}:`)
    ) {
      keys.push(key);
    }
  }
  keys.forEach(updateKey);

  if (accepted.storeId) {
    const storeKey = `${DELIVERY_CHALLAN_PREFIX}:${accepted.storeId}`;
    const found = updateKey(storeKey);
    if (!found) {
      try {
        const existing = JSON.parse(localStorage.getItem(storeKey) || "[]");
        const rows = Array.isArray(existing) ? existing : [];
        localStorage.setItem(
          storeKey,
          JSON.stringify([
            { ...accepted, status: "accepted" },
            ...rows.filter((row: any) => String(row.id) !== String(accepted.id)),
          ]),
        );
      } catch {}
    }
  }

  window.dispatchEvent(new Event("nature-biotic-delivery-challan-updated"));
}

export function persistFROReturnAccepted(accepted: {
  id: string;
  froName?: string;
  storeId?: string;
  [key: string]: any;
}) {
  if (typeof window === "undefined") return;

  const requestId = String(accepted.id || "");
  if (!requestId) return;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${FRO_RETURN_REQUEST_PREFIX}:`)) keys.push(key);
    }

    keys.forEach((key) => {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(saved)) return;
      if (!saved.some((item: any) => String(item?.id || "") === requestId)) return;
      localStorage.setItem(
        key,
        JSON.stringify(
          saved.map((item: any) =>
            String(item?.id || "") === requestId
              ? { ...item, ...accepted, status: "accepted" }
              : item,
          ),
        ),
      );
    });
  } catch {}

  window.dispatchEvent(new Event("nature-biotic-fro-stock-return-updated"));
}

export function readStoreFROStockReturns(storeId: string) {
  if (typeof window === "undefined") return [];

  const targetStore = String(storeId || "");
  const requests: any[] = [];

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${FRO_RETURN_REQUEST_PREFIX}:`)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((item) => {
        if (!item) return;
        if (String(item.storeId || "") !== targetStore) return;
        requests.push(item);
      });
    }

    const received = JSON.parse(
      localStorage.getItem(`${STORE_RETURN_RECEIVED_PREFIX}:${targetStore}`) ||
        "[]",
    );
    const acceptedIds = new Set(
      (Array.isArray(received) ? received : []).map((item: any) =>
        String(item?.id || ""),
      ),
    );

    return requests.map((item) =>
      acceptedIds.has(String(item.id || "")) ||
      String(item.status || "").toLowerCase() === "accepted"
        ? { ...item, status: "accepted" }
        : item,
    );
  } catch {
    return requests;
  }
}

export function getFROAvailableQty(
  storeId: string,
  executiveName: string,
  productId: string,
  packSize: string,
  batchNo: string,
  productName?: string,
): number {
  const target = { productId, productName, packSize, batchNo };
  return getFROStock(storeId).reduce((sum, row) => {
    if (normStockText(row.executiveName) !== normStockText(executiveName)) {
      return sum;
    }
    if (
      !stockVariantsMatch(
        {
          productId: row.productId,
          productName: row.productName,
          packSize: row.packSize,
          batchNo: row.batchNo,
        },
        target,
      )
    ) {
      return sum;
    }
    return sum + Math.max(0, Number(row.currentQty || 0));
  }, 0);
}

// Called from Delivery Challan → Store gives stock to FRO
export function addFROStock(
  storeId: string,
  executiveName: string,
  items: {
    productId: string;
    productName: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
    unitValue: number;
    qty: number;
  }[],
  date?: string,
  deliveryId?: string,
) {
  if (deliveryId) {
    if (isStockMovementProcessed(deliveryId)) {
      return getFROStock(storeId);
    }
    if (
      getAcceptedStoreDeliveries(storeId).some(
        (row) => String(row.id) === String(deliveryId),
      )
    ) {
      markStockMovementProcessed(deliveryId);
      return getFROStock(storeId);
    }
  }

  const rows = getFROStock(storeId);

  items.forEach((item) => {
    const qty = Math.max(0, Number(item.qty || 0));
    if (qty <= 0) return;
    const existing = rows.find(
      (row) =>
        normStockText(row.executiveName) === normStockText(executiveName) &&
        stockVariantsMatch(
          {
            productId: row.productId,
            productName: row.productName,
            packSize: row.packSize,
            batchNo: row.batchNo,
          },
          {
            productId: item.productId,
            productName: item.productName,
            packSize: item.packSize,
            batchNo: item.batchNo,
          },
        ),
    );
    if (existing) {
      existing.currentQty = Math.max(0, Number(existing.currentQty || 0)) + qty;
    } else {
      rows.push({
        id: `fro-stock-${Date.now()}-${Math.random()}`,
        storeId,
        executiveName,
        productId: item.productId,
        productName: item.productName,
        packSize: item.packSize,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        unitValue: item.unitValue,
        currentQty: qty,
        issuedQty: 0,
        returnedQty: 0,
        currentStock: 0,
      });
    }
  });

  saveFROStock(storeId, rows);

  // One unique accepted-delivery record per challan id.
  recordAcceptedStoreDelivery(
    storeId,
    executiveName,
    items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      packSize: item.packSize,
      batchNo: item.batchNo,
      qty: item.qty,
    })),
    date,
    deliveryId,
  );

  const txnDate = date || new Date().toISOString().split("T")[0];
  addFROStockTxns(
    storeId,
    items.map((item) => ({
      id: deliveryId
        ? `fro-txn-delivery-${deliveryId}-${item.productId}-${item.packSize}-${item.batchNo}`
        : `fro-txn-${Date.now()}-${Math.random()}`,
      storeId,
      executiveName,
      productId: item.productId,
      productName: item.productName,
      packSize: item.packSize,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
      unitValue: item.unitValue,
      qty: item.qty,
      date: txnDate,
      type: "Delivery" as const,
    })),
  );

  markStockMovementProcessed(deliveryId);
  return getFROStock(storeId);
}

// Called from Return Challan (FRO → Store) AND from Executive Sale (FRO → Farmer)
export function reduceFROStock(
  storeId: string,
  executiveName: string,
  items: {
    productId: string;
    productName?: string;
    packSize: string;
    batchNo: string;
    qty: number;
  }[],
  date?: string,
  txnType: "Return" | "Sale" = "Sale",
  movementId?: string,
) {
  if (movementId && isStockMovementProcessed(movementId)) {
    return getFROStock(storeId);
  }

  const rows = getFROStock(storeId);
  items.forEach((item) => {
    let remaining = Math.max(0, Number(item.qty || 0));

    for (const row of rows) {
      if (remaining <= 0) break;
      if (normStockText(row.executiveName) !== normStockText(executiveName)) {
        continue;
      }
      if (
        !stockVariantsMatch(
          {
            productId: row.productId,
            productName: row.productName,
            packSize: row.packSize,
            batchNo: row.batchNo,
          },
          {
            productId: item.productId,
            productName: item.productName,
            packSize: item.packSize,
            batchNo: item.batchNo,
          },
        )
      ) {
        continue;
      }

      const available = Math.max(0, Number(row.currentQty || 0));
      const take = Math.min(available, remaining);
      row.currentQty = available - take;
      remaining -= take;
    }
  });
  saveFROStock(storeId, rows);

  const txnDate = date || new Date().toISOString().split("T")[0];
  const rowsMap = getFROStock(storeId);
  addFROStockTxns(
    storeId,
    items.map((item) => {
      const ref = rowsMap.find(
        (r) =>
          normStockText(r.executiveName) === normStockText(executiveName) &&
          stockVariantsMatch(
            {
              productId: r.productId,
              productName: r.productName,
              packSize: r.packSize,
              batchNo: r.batchNo,
            },
            {
              productId: item.productId,
              productName: item.productName,
              packSize: item.packSize,
              batchNo: item.batchNo,
            },
          ),
      );
      return {
        id: movementId
          ? `fro-txn-return-${movementId}-${item.productId}-${item.packSize}-${item.batchNo}`
          : `fro-txn-${Date.now()}-${Math.random()}`,
        storeId,
        executiveName,
        productId: item.productId,
        productName: ref?.productName || item.productName || "",
        packSize: item.packSize,
        batchNo: item.batchNo,
        expiryDate: ref?.expiryDate || "",
        unitValue: ref?.unitValue || 0,
        qty: -Math.abs(item.qty),
        date: txnDate,
        type: txnType,
      };
    }),
  );

  markStockMovementProcessed(movementId);
  return rows;
}

export function increaseFROStock(
  storeId: string,
  executiveName: string,
  items: {
    productId: string;
    productName?: string;
    packSize: string;
    batchNo: string;
    expiryDate?: string;
    unitValue?: number;
    qty: number;
  }[],
  date?: string,
  movementId?: string,
) {
  if (movementId && isStockMovementProcessed(movementId)) {
    return getFROStock(storeId);
  }

  const rows = getFROStock(storeId);
  items.forEach((item) => {
    const qty = Math.max(0, Number(item.qty || 0));
    if (qty <= 0) return;
    const existing = rows.find(
      (row) =>
        normStockText(row.executiveName) === normStockText(executiveName) &&
        stockVariantsMatch(
          {
            productId: row.productId,
            productName: row.productName,
            packSize: row.packSize,
            batchNo: row.batchNo,
          },
          {
            productId: item.productId,
            productName: item.productName,
            packSize: item.packSize,
            batchNo: item.batchNo,
          },
        ),
    );
    if (existing) {
      existing.currentQty = Math.max(0, Number(existing.currentQty || 0)) + qty;
    } else {
      rows.push({
        id: `fro-stock-${Date.now()}-${Math.random()}`,
        storeId,
        executiveName,
        productId: item.productId,
        productName: item.productName || "",
        packSize: item.packSize,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate || "",
        unitValue: Number(item.unitValue || 0),
        currentQty: qty,
        issuedQty: 0,
        returnedQty: 0,
        currentStock: 0,
      });
    }
  });
  saveFROStock(storeId, rows);

  const txnDate = date || new Date().toISOString().split("T")[0];
  addFROStockTxns(
    storeId,
    items.map((item) => ({
      id: movementId
        ? `fro-txn-sale-return-${movementId}-${item.productId}-${item.packSize}-${item.batchNo}`
        : `fro-txn-${Date.now()}-${Math.random()}`,
      storeId,
      executiveName,
      productId: item.productId,
      productName: item.productName || "",
      packSize: item.packSize,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate || "",
      unitValue: Number(item.unitValue || 0),
      qty: Math.abs(Number(item.qty || 0)),
      date: txnDate,
      type: "SaleReturn" as const,
    })),
  );

  markStockMovementProcessed(movementId);
  return rows;
}

const FRO_STOCK_TXN_KEY = "nature-biotic-fro-stock-txns-v1";

function froStockTxnKey(storeId: string) {
  return `${FRO_STOCK_TXN_KEY}:${storeId}`;
}

export function getFROStockTxns(storeId: string): FROStockTxn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(froStockTxnKey(storeId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFROStockTxns(storeId: string, rows: FROStockTxn[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(froStockTxnKey(storeId), JSON.stringify(rows));
    window.dispatchEvent(new Event("fro-stock-txns-updated"));
  } catch {}
}

function addFROStockTxns(storeId: string, txns: FROStockTxn[]) {
  const existing = getFROStockTxns(storeId);
  const ids = new Set(existing.map((txn) => txn.id));
  const fresh = txns.filter((txn) => txn.id && !ids.has(txn.id));
  if (fresh.length === 0) return;
  saveFROStockTxns(storeId, [...fresh, ...existing]);
}

export function getFROStockTxnsByExecutive(
  storeId: string,
  executiveName: string,
): FROStockTxn[] {
  const name = normStockText(executiveName);
  return getFROStockTxns(storeId).filter(
    (t) => normStockText(t.executiveName) === name,
  );
}

const RETURN_CHALLAN_PREFIX = "nature-biotic-store-return-challans-v2";

export function getFROCurrentStock(
  executiveName: string,
  storeId: string,
): FROStockRow[] {
  if (typeof window === "undefined") return [];

  const map = new Map<string, FROStockRow>();

  // 1. Add issued qty from Delivery Challans
  try {
    const raw = window.localStorage.getItem(
      `${DELIVERY_CHALLAN_PREFIX}:${storeId}`,
    );
    const challans = raw ? JSON.parse(raw) : [];

    challans
      .filter(
        (c: any) =>
          c.executive === executiveName &&
          (c.status === "accepted" || !c.status),
      )
      .forEach((c: any) => {
        c.items.forEach((item: any) => {
          const key = `${item.productId || item.product}-${item.packSize}-${item.batchNo}`;
          const existing = map.get(key) || {
            id: item.id ?? null,
            unitValue: item.unitValue ?? 0,
            currentQty: item.currentQty ?? 0,
            productId: item.productId || "",
            productName: item.product,
            packSize: item.packSize,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate || "", // ✅ ADD
            issuedQty: 0,
            returnedQty: 0,
            currentStock: 0,
          };
          existing.issuedQty += Number(item.qty || 0);
          map.set(key, existing);
        });
      });
  } catch {}

  // 2. Subtract returned qty from Return Challans
  try {
    const raw = window.localStorage.getItem(
      `${RETURN_CHALLAN_PREFIX}:${storeId}`,
    );
    const returns = raw ? JSON.parse(raw) : [];

    returns
      .filter((r: any) => r.executive === executiveName)
      .forEach((r: any) => {
        r.items.forEach((item: any) => {
          const key = `${item.productId || item.product}-${item.packSize}-${item.batchNo}`;
          const existing = map.get(key) || {
            id: item.id ?? null,
            unitValue: item.unitValue ?? 0,
            currentQty: item.currentQty ?? 0,
            productId: item.productId || "",
            productName: item.product,
            packSize: item.packSize,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate || "", // ✅ ADD
            issuedQty: 0,
            returnedQty: 0,
            currentStock: 0,
          };
          existing.returnedQty += Number(item.returnedQty || 0);
          map.set(key, existing);
        });
      });
  } catch {}

  // 3. Compute current stock count
  const rows = Array.from(map.values()).map((row) => ({
    ...row,
    currentStock: row.issuedQty - row.returnedQty,
  }));

  return rows;
}

export function getFROTotalStockCount(
  executiveName: string,
  storeId: string,
): number {
  const name = normStockText(executiveName);
  return getFROStock(storeId).reduce((sum, row) => {
    if (normStockText(row.executiveName) !== name) return sum;
    return sum + Math.max(0, Number(row.currentQty || 0));
  }, 0);
}

const FRO_STOCK_KEY = "nature-biotic-fro-stock-v1";

type StoredFROStockRow = Omit<FROStockRow, "id"> & {
  id: string;
  storeId: string;
  executiveName: string;
  productName: string;
  expiryDate: string;
};

function getFROStock(storeId: string): StoredFROStockRow[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(`${FRO_STOCK_KEY}:${storeId}`);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveFROStock(storeId: string, rows: StoredFROStockRow[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${FRO_STOCK_KEY}:${storeId}`,
      JSON.stringify(rows),
    );
    window.dispatchEvent(new Event("fro-stock-updated"));
  } catch {}
}
// ✅ Correct implementation
function matchKey(
  executiveName: string,
  productId: string,
  packSize: string,
  batchNo: string,
): string {
  return `${executiveName}|${productId}|${packSize}|${batchNo}`;
}

// ============================================================
// FRO current stock (by executive) — used by Sales Invoice + Dashboard
// ============================================================

export function getFROStockByExecutive(storeId: string, executiveName: string) {
  const name = normStockText(executiveName);
  return getFROStock(storeId).filter(
    (r) => normStockText(r.executiveName) === name && Number(r.currentQty || 0) > 0,
  );
}

export function getFROHandQty(
  storeId: string,
  productId: string,
  packSize: string,
  batchNo: string,
  productName?: string,
  executiveName?: string,
) {
  const target = { productId, productName, packSize, batchNo };
  const executive = normStockText(executiveName);
  return getFROStock(storeId).reduce((sum, row) => {
    if (executive && normStockText(row.executiveName) !== executive) return sum;
    if (
      !stockVariantsMatch(
        {
          productId: row.productId,
          productName: row.productName,
          packSize: row.packSize,
          batchNo: row.batchNo,
        },
        target,
      )
    ) {
      return sum;
    }
    return sum + Math.max(0, Number(row.currentQty || 0));
  }, 0);
}

export function getFROStockHolders(
  storeId: string,
  productId: string,
  packSize: string,
  batchNo: string,
  productName?: string,
) {
  const target = { productId, productName, packSize, batchNo };
  const totals = new Map<string, number>();

  getFROStock(storeId).forEach((row) => {
    const qty = Math.max(0, Number(row.currentQty || 0));
    if (qty <= 0) return;
    if (
      !stockVariantsMatch(
        {
          productId: row.productId,
          productName: row.productName,
          packSize: row.packSize,
          batchNo: row.batchNo,
        },
        target,
      )
    ) {
      return;
    }
    const name = String(row.executiveName || "").trim() || "FRO";
    totals.set(name, (totals.get(name) || 0) + qty);
  });

  return Array.from(totals.entries()).map(([name, quantity]) => ({
    name,
    quantity,
  }));
}

// ============================================================
// FRO SALES / COLLECTION / OUTSTANDING / CASH-IN-HAND LEDGER
// ============================================================

export type FROSaleRecord = {
  id: string;
  storeId: string;
  executiveName: string;
  date: string;
  invoiceNo: string;
  farmerId: string;
  farmerName: string;
  amount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionMode: "CashInHand" | "Deposited" | "Pending";
};

const FRO_SALES_KEY = "nature-biotic-fro-sales-v1";

function froSalesKey(storeId: string) {
  return `${FRO_SALES_KEY}:${storeId}`;
}

export function getFROSales(storeId: string): FROSaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(froSalesKey(storeId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFROSalesRows(storeId: string, rows: FROSaleRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(froSalesKey(storeId), JSON.stringify(rows));
    window.dispatchEvent(new Event("fro-sales-updated"));
  } catch {}
}

export function addFROSale(storeId: string, row: Omit<FROSaleRecord, "id">) {
  const rows = getFROSales(storeId);
  const next: FROSaleRecord = {
    ...row,
    id: `fro-sale-${Date.now()}-${Math.random()}`,
  };
  saveFROSalesRows(storeId, [next, ...rows]);
  return next;
}

export function depositFROCash(
  storeId: string,
  executiveName: string,
  amount: number,
) {
  const rows = getFROSales(storeId);
  let remaining = amount;
  for (const row of rows) {
    if (
      row.executiveName !== executiveName ||
      row.collectionMode !== "CashInHand"
    )
      continue;
    if (remaining <= 0) break;
    const take = Math.min(remaining, row.collectedAmount);
    row.collectedAmount -= take;
    remaining -= take;
    if (row.collectedAmount === 0) row.collectionMode = "Deposited";
  }
  saveFROSalesRows(storeId, rows);
}

export function getFROSummary(storeId: string, executiveName: string) {
  const sales = getFROSales(storeId).filter(
    (s) => s.executiveName === executiveName,
  );
  const totalSales = sales.reduce((s, r) => s + r.amount, 0);
  const totalCollection = sales.reduce((s, r) => s + r.collectedAmount, 0);
  const cashInHand = sales
    .filter((r) => r.collectionMode === "CashInHand")
    .reduce((s, r) => s + r.collectedAmount, 0);
  const outstanding = sales.reduce((s, r) => s + r.outstandingAmount, 0);
  return {
    totalSales,
    totalCollection,
    cashInHand,
    outstanding,
    saleRows: sales,
  };
}

// ============================================================
// FARMER PURCHASE HISTORY — persisted (so Product History tab updates live)
// ============================================================

const FARMER_PURCHASES_KEY = "nature-biotic-farmer-purchases-v1";

export function getStoredFarmerPurchases(): FarmerPurchase[] {
  if (typeof window === "undefined") return farmerPurchases;
  try {
    const raw = window.localStorage.getItem(FARMER_PURCHASES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return farmerPurchases;
}

function readStoredRows(key: string): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function storedPerson(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isCashMethod(method: unknown) {
  const value = String(method ?? "Cash")
    .trim()
    .toLowerCase();
  return value === "" || value === "cash";
}

function isVoidStatus(status: unknown) {
  const value = String(status || "")
    .trim()
    .toLowerCase();
  return (
    value === "cancelled" ||
    value === "canceled" ||
    value === "rejected" ||
    value === "void" ||
    value === "invalid"
  );
}

export type FarmerAccountRow = {
  farmerId?: string;
  farmerName?: string;
  amount?: number;
  appliedToOutstanding?: number;
};

export type FarmerAccountBucket = {
  farmerName: string;
  gross: number;
  receipts: number;
  returns: number;
  refunds: number;
  appliedRefunds: number;
  cashRefunds: number;
};

function farmerAccountKey(farmerId: unknown, name: unknown) {
  const id = String(farmerId || "").trim();
  if (id) return `id:${id}`;
  const farmerName = String(name || "")
    .trim()
    .toLowerCase();
  return farmerName ? `name:${farmerName}` : "";
}

function uniqueTransactionRows(rows: any[], idOf: (row: any) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = idOf(row).trim().toLowerCase();
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function findInvoiceForAccount(invoices: any[], invoiceNo: unknown) {
  const key = String(invoiceNo || "").trim().toLowerCase();
  if (!key) return undefined;
  return invoices.find(
    (row) => String(row?.invoiceNo || "").trim().toLowerCase() === key,
  );
}

function findReturnForAccount(returns: any[], returnNo: unknown) {
  const key = String(returnNo || "").trim().toLowerCase();
  if (!key) return undefined;
  return returns.find((row) => {
    const number = String(row?.returnNo || row?.creditNoteNo || "")
      .trim()
      .toLowerCase();
    return number === key;
  });
}

/** Refund → sales return → original invoice → that invoice's farmer. */
export function farmerFromRefund(
  refund: any,
  returns: any[],
  invoices: any[],
) {
  const salesReturn = findReturnForAccount(
    returns,
    refund?.referenceNo || refund?.returnNo,
  );
  const invoice = findInvoiceForAccount(
    invoices,
    salesReturn?.invoiceNo || refund?.invoiceNo,
  );
  const farmerId = String(
    invoice?.farmerId || salesReturn?.farmerId || "",
  ).trim();
  const farmerName = String(
    invoice?.partyName ||
      invoice?.farmerName ||
      salesReturn?.partyName ||
      salesReturn?.farmerName ||
      "",
  ).trim();
  return {
    farmerId,
    farmerName,
    invoiceNo: String(salesReturn?.invoiceNo || refund?.invoiceNo || ""),
    returnNo: String(salesReturn?.returnNo || refund?.referenceNo || ""),
    salesReturn,
    invoice,
  };
}

/** One refund record once, and never more than its sales return. */
function applicableRefundRows(refunds: any[], returns: any[], invoices: any[]) {
  const seen = new Set<string>();
  const usedByReturn = new Map<string, number>();
  const rows: {
    row: any;
    amount: number;
    appliedToOutstanding: number;
    farmerId: string;
    farmerName: string;
  }[] = [];
  refunds.forEach((row) => {
    if (isVoidStatus(row?.status)) return;
    const keys = [row?.id, row?.refundNo]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (keys.some((key) => seen.has(key))) return;
    keys.forEach((key) => seen.add(key));
    const farmer = farmerFromRefund(row, returns, invoices);
    if (!farmer.farmerId && !farmer.farmerName) return;
    const requested = Math.max(0, Number(row?.amount || 0));
    const returnKey = farmer.returnNo.trim().toLowerCase();
    const returnTotal = Math.max(
      0,
      Number(
        farmer.salesReturn?.total ||
          farmer.salesReturn?.amount ||
          farmer.salesReturn?.returnAmount ||
          0,
      ),
    );
    let amount = requested;
    if (returnKey && farmer.salesReturn) {
      const used = usedByReturn.get(returnKey) || 0;
      amount = Math.max(0, Math.min(requested, returnTotal - used));
      usedByReturn.set(returnKey, used + amount);
    }
    if (!amount) return;
    rows.push({
      row,
      amount,
      appliedToOutstanding: Math.min(
        amount,
        Math.max(0, Number(row?.appliedToOutstanding || 0)),
      ),
      farmerId: farmer.farmerId,
      farmerName: farmer.farmerName,
    });
  });
  return rows;
}

export function settleLinkedFarmerAccounts(input: {
  invoices: any[];
  receipts: any[];
  returns: any[];
  refunds: any[];
  linkInvoices?: any[];
  linkReturns?: any[];
}) {
  const linkInvoices = input.linkInvoices || input.invoices;
  const linkReturns = input.linkReturns || input.returns;
  const invoices = uniqueTransactionRows(
    input.invoices,
    (row) => String(row?.id || row?.invoiceNo || ""),
  ).filter((row) => !isVoidStatus(row?.status));
  const receipts = uniqueTransactionRows(
    input.receipts,
    (row) => String(row?.id || row?.receiptNo || ""),
  ).filter((row) => !isVoidStatus(row?.status));
  const returns = uniqueTransactionRows(
    input.returns,
    (row) => String(row?.id || row?.returnNo || row?.creditNoteNo || ""),
  ).filter(
    (row) => !isVoidStatus(row?.status) && String(row?.status || "") !== "Rejected",
  );
  const refunds = applicableRefundRows(
    input.refunds,
    linkReturns,
    linkInvoices,
  );

  const buckets = buildFarmerBuckets(
    invoices.map((row) => ({
      farmerId: row?.farmerId,
      farmerName: row?.partyName || row?.farmerName,
      amount: row?.amount,
    })),
    receipts.map((row) => ({
      farmerId: row?.farmerId,
      farmerName: row?.farmerName || row?.partyName,
      amount: row?.amount,
    })),
    returns.map((row) => {
      const invoice = findInvoiceForAccount(linkInvoices, row?.invoiceNo);
      return {
        farmerId: invoice?.farmerId || row?.farmerId,
        farmerName:
          invoice?.partyName ||
          invoice?.farmerName ||
          row?.partyName ||
          row?.farmerName,
        amount: row?.total || row?.amount || row?.returnAmount,
      };
    }),
    refunds.map((row) => ({
      farmerId: row.farmerId,
      farmerName: row.farmerName,
      amount: row.amount,
      appliedToOutstanding: row.appliedToOutstanding,
    })),
  );
  return settleFarmerAccounts(buckets);
}

/** One farmer balance from invoices, receipts, returns, and refunds. */
export function buildFarmerBuckets(
  invoices: FarmerAccountRow[],
  receipts: FarmerAccountRow[],
  returns: FarmerAccountRow[],
  refunds: FarmerAccountRow[],
) {
  const map = new Map<string, FarmerAccountBucket>();
  const take = (farmerId: unknown, name: unknown) => {
    const key = farmerAccountKey(farmerId, name);
    if (!key) return null;
    const current = map.get(key) || {
      farmerName: String(name || "").trim() || "Farmer",
      gross: 0,
      receipts: 0,
      returns: 0,
      refunds: 0,
      appliedRefunds: 0,
      cashRefunds: 0,
    };
    const label = String(name || "").trim();
    if (label && current.farmerName === "Farmer") current.farmerName = label;
    map.set(key, current);
    return current;
  };
  invoices.forEach((row) => {
    const bucket = take(row.farmerId, row.farmerName);
    if (bucket) bucket.gross += Math.max(0, Number(row.amount || 0));
  });
  receipts.forEach((row) => {
    const bucket = take(row.farmerId, row.farmerName);
    if (bucket) bucket.receipts += Math.max(0, Number(row.amount || 0));
  });
  returns.forEach((row) => {
    const bucket = take(row.farmerId, row.farmerName);
    if (bucket) bucket.returns += Math.max(0, Number(row.amount || 0));
  });
  refunds.forEach((row) => {
    const bucket = take(row.farmerId, row.farmerName);
    if (!bucket) return;
    const amount = Math.max(0, Number(row.amount || 0));
    const applied = Math.min(
      amount,
      Math.max(0, Number(row.appliedToOutstanding || 0)),
    );
    bucket.refunds += amount;
    bucket.appliedRefunds += applied;
    bucket.cashRefunds += amount - applied;
  });
  return map;
}

/**
 * A return lowers net sales and leaves outstanding unchanged.
 * Outstanding falls only by the refund amount applied against it.
 * The cash part of a refund lowers collection.
 */
export function settleFarmerAccounts(buckets: Map<string, FarmerAccountBucket>) {
  let sales = 0;
  let collection = 0;
  let outstanding = 0;
  const collectionAdjustments: {
    farmerName: string;
    amount: number;
    ref: string;
  }[] = [];
  const outstandingRows: {
    farmerName: string;
    amount: number;
  }[] = [];
  const farmers: {
    farmerId: string;
    farmerName: string;
    sales: number;
    collection: number;
    outstanding: number;
    returns: number;
    refunds: number;
  }[] = [];

  buckets.forEach((row, key) => {
    const gross = Math.max(0, row.gross);
    const receipts = Math.max(0, row.receipts);
    const returns = Math.min(Math.max(0, row.returns), gross);
    const refundTotal = Math.max(0, row.refunds);
    const cashRefunds = Math.max(0, row.cashRefunds);
    const applied = Math.min(
      Math.max(0, gross - receipts),
      Math.max(0, row.appliedRefunds),
    );
    const netCollection = receipts - cashRefunds;
    const netSales = Math.max(0, gross - returns);
    const due = Math.max(0, gross - receipts - applied);
    sales += netSales;
    collection += netCollection;
    outstanding += due;
    if (cashRefunds > 0) {
      collectionAdjustments.push({
        farmerName: row.farmerName || "Farmer",
        amount: -cashRefunds,
        ref: "Refund",
      });
    }
    if (due > 0) {
      outstandingRows.push({
        farmerName: row.farmerName || "Farmer",
        amount: due,
      });
    }
    farmers.push({
      farmerId: key.startsWith("id:") ? key.slice(3) : "",
      farmerName: row.farmerName || "Farmer",
      sales: netSales,
      collection: netCollection,
      outstanding: due,
      returns: Math.max(0, row.returns),
      refunds: Math.max(0, row.refunds),
    });
  });

  return {
    sales,
    collection,
    outstanding,
    collectionAdjustments,
    outstandingRows,
    farmers,
  };
}

/** FRO sales, collection and outstanding from saved invoices and receipts. */
export function summarizeFroAccounts(
  invoices: FarmerAccountRow[],
  receipts: FarmerAccountRow[],
) {
  const map = new Map<string, { farmerName: string; sales: number; collection: number }>();
  const take = (farmerId: unknown, name: unknown) => {
    const key = farmerAccountKey(farmerId, name) || "unknown";
    const current = map.get(key) || {
      farmerName: String(name || "").trim() || "Farmer",
      sales: 0,
      collection: 0,
    };
    const label = String(name || "").trim();
    if (label && current.farmerName === "Farmer") current.farmerName = label;
    map.set(key, current);
    return current;
  };

  invoices.forEach((row) => {
    const bucket = take(row.farmerId, row.farmerName);
    bucket.sales += Math.max(0, Number(row.amount || 0));
  });
  receipts.forEach((row) => {
    const bucket = take(row.farmerId, row.farmerName);
    bucket.collection += Math.max(0, Number(row.amount || 0));
  });

    let sales = 0;
    let collection = 0;
    let outstanding = 0;
    const outstandingRows: { farmerName: string; amount: number }[] = [];
    map.forEach((row) => {
      sales += row.sales;
      collection += row.collection;
      const due = Math.max(0, row.sales - row.collection);
      outstanding += due;
      if (due > 0) {
        outstandingRows.push({ farmerName: row.farmerName, amount: due });
      }
    });

  return { sales, collection, outstanding, outstandingRows };
}

export type FROCashLine = {
  date: string;
  ref: string;
  party: string;
  amount: number;
};

export type FROCashPosition = {
  cashCollected: number;
  otherCash: number;
  cashHandover: number;
  cashExpenses: number;
  cashRefunds: number;
  cashInHand: number;
  lines: FROCashLine[];
};

export function handoverBelongsToFro(
  row: {
    createdByStaffId?: string;
    staffId?: string;
    froId?: string;
    handedOverBy?: string;
  },
  froName: string,
  staffIds: Array<string | undefined>,
) {
  const rowIds = [row?.createdByStaffId, row?.staffId, row?.froId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const keys = staffIds
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (rowIds.some((id) => keys.includes(id))) return true;
  const owner = storedPerson(row?.handedOverBy);
  const name = storedPerson(froName);
  return Boolean(owner) && Boolean(name) && owner === name;
}

/** Current physical cash for one FRO. Each accepted handover is counted once. */
export function getFROCashPosition(
  storeId: string,
  froName: string,
  staffId?: string,
  accountId?: string,
): FROCashPosition {
  const name = storedPerson(froName);
  const empty: FROCashPosition = {
    cashCollected: 0,
    otherCash: 0,
    cashHandover: 0,
    cashExpenses: 0,
    cashRefunds: 0,
    cashInHand: 0,
    lines: [],
  };
  if (!storeId || !name) return empty;

  const lines: FROCashLine[] = [];
  let cashCollected = 0;
  const seenReceipts = new Set<string>();
  readStoredRows(`nature-biotic-store-receipts-v3:${storeId}`).forEach((row) => {
    const receiptId = String(row?.id || row?.receiptNo || "");
    if (receiptId && seenReceipts.has(receiptId)) return;
    if (receiptId) seenReceipts.add(receiptId);
    if (!froOwnsTransaction(row, name, staffId)) return;
    if (isVoidStatus(row?.status)) return;
    if (!isCashMethod(row?.method || row?.paymentMethod)) return;
    const amount = Math.max(0, Number(row?.amount || 0));
    if (!amount) return;
    cashCollected += amount;
    lines.push({
      date: String(row?.date || ""),
      ref: String(row?.receiptNo || "Receipt"),
      party: String(row?.farmerName || row?.partyName || "Farmer"),
      amount,
    });
  });

  let otherCash = 0;
  const settlementOwner = new Map<string, string>();
  readStoredRows(`nature-biotic-fro-cash-received-v1:${storeId}`).forEach((row) => {
    const owner = storedPerson(row?.requestedFor);
    if (row?.settlementId && owner) {
      settlementOwner.set(String(row.settlementId), owner);
    }
    if (!froOwnsTransaction({ ...row, receivedBy: row?.requestedFor }, name, staffId) && owner !== name) return;
    if (String(row?.status || "") !== "accepted") return;
    if (!isCashMethod(row?.method)) return;
    const amount = Math.max(0, Number(row?.amount || 0));
    if (!amount) return;
    otherCash += amount;
    lines.push({
      date: String(row?.date || ""),
      ref: String(row?.id || "Cash received"),
      party: String(row?.receivedFrom || "Store"),
      amount,
    });
  });

  let cashHandover = 0;
  const seenHandover = new Set<string>();
  readStoredRows(`nature-biotic-fro-handovers-v1:${storeId}`).forEach((row) => {
    const id = String(row?.id || "");
    if (!id || seenHandover.has(id)) return;
    if (!handoverBelongsToFro(row, froName, [staffId, accountId])) return;
    if (!isCashMethod(row?.method)) return;
    const status = String(row?.status || "accepted").trim().toLowerCase();
    if (status !== "accepted") return;
    const amount = Math.max(0, Number(row?.amount || 0));
    if (!amount) return;
    seenHandover.add(id);
    cashHandover += amount;
    lines.push({
      date: String(row?.date || ""),
      ref: id,
      party: "Cash handover",
      amount: -amount,
    });
  });

  let cashExpenses = 0;
  readStoredRows("naturebiotic_shared_expenses").forEach((row) => {
    if (!froOwnsTransaction(row, name, staffId)) return;
    if (isVoidStatus(row?.status)) return;
    if (String(row?.status || "accepted").toLowerCase() !== "accepted") return;
    if (!isCashMethod(row?.method)) return;
    const amount = Math.max(0, Number(row?.amount || 0));
    if (!amount) return;
    cashExpenses += amount;
    lines.push({
      date: String(row?.date || ""),
      ref: String(row?.expenseNo || row?.id || "Expense"),
      party: String(row?.category || "Expense"),
      amount: -amount,
    });
  });

  let cashRefunds = 0;
  readStoredRows(`nature-biotic-fro-cash-refunds-v1:${storeId}`).forEach((row) => {
    const owner =
      storedPerson(row?.enteredBy || row?.froName) ||
      settlementOwner.get(String(row?.settlementId || "")) ||
      "";
    if (
      !froOwnsTransaction(
        { ...row, receivedBy: row?.enteredBy || row?.froName },
        name,
        staffId,
      ) &&
      owner !== name
    ) {
      return;
    }
    if (!isCashMethod(row?.method)) return;
    const amount = Math.max(0, Number(row?.amount || 0));
    if (!amount) return;
    cashRefunds += amount;
    lines.push({
      date: String(row?.date || ""),
      ref: String(row?.id || "Refund"),
      party: String(row?.refundedTo || "Refund"),
      amount: -amount,
    });
  });

  const salesReturns = readStoredRows(
    `nature-biotic-store-sales-returns-v2:${storeId}`,
  );
  const salesInvoices = readStoredRows(
    `nature-biotic-store-sales-invoices-v2:${storeId}`,
  );
  applicableRefundRows(
    readStoredRows(`nature-biotic-store-refunds-v2:${storeId}`),
    salesReturns,
    salesInvoices,
  ).forEach(({ row, amount }) => {
    const linked = farmerFromRefund(row, salesReturns, salesInvoices);
    const owner = {
      ...row,
      createdByStaffId:
        row?.createdByStaffId ||
        linked.salesReturn?.createdByStaffId ||
        linked.invoice?.createdByStaffId,
      staffId:
        row?.staffId ||
        linked.salesReturn?.staffId ||
        linked.invoice?.staffId,
      executiveName:
        row?.executiveName ||
        linked.salesReturn?.executiveName ||
        linked.invoice?.executiveName,
    };
    if (!froOwnsTransaction(owner, name, staffId)) return;
    if (!isCashMethod(row?.paymentMethod || row?.method)) return;
    cashRefunds += amount;
    lines.push({
      date: String(row?.date || ""),
      ref: String(row?.refundNo || row?.referenceNo || "Refund"),
      party: String(linked.farmerName || row?.farmerName || "Refund"),
      amount: -amount,
    });
  });

  return {
    cashCollected,
    otherCash,
    cashHandover,
    cashExpenses,
    cashRefunds,
    cashInHand: Math.max(
      0,
      cashCollected + otherCash - cashHandover - cashExpenses - cashRefunds,
    ),
    lines,
  };
}

export function getFROReturnedAmountByInvoice(storeId: string, froName: string) {
  const name = storedPerson(froName);
  const totals = new Map<string, number>();
  if (!storeId || !name) return totals;
  readStoredRows(`nature-biotic-store-sales-returns-v2:${storeId}`).forEach(
    (row) => {
      if (isVoidStatus(row?.status)) return;
      if (storedPerson(row?.executiveName) !== name) return;
      const invoiceNo = String(row?.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo) return;
      const amount = Math.max(0, Number(row?.total || row?.amount || 0));
      totals.set(invoiceNo, (totals.get(invoiceNo) || 0) + amount);
    },
  );
  return totals;
}

function saveFarmerPurchasesRows(rows: FarmerPurchase[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FARMER_PURCHASES_KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event("farmer-purchases-updated"));
  } catch {}
}

export function addFarmerPurchaseRecord(row: Omit<FarmerPurchase, "id">) {
  const rows = getStoredFarmerPurchases();
  const next: FarmerPurchase = {
    ...row,
    id: `fp-${Date.now()}-${Math.random()}`,
  };
  saveFarmerPurchasesRows([next, ...rows]);
  return next;
}
