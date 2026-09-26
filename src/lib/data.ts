import { Key } from "react";
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
  status: "Pending" | "Approved" | "Rejected";
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
    todaySales: 24500,
    monthlySales: 485000,
    totalProfit: 96000,
    outstanding: 32000,
    activeCustomers: 142,
    inventoryValue: 540000,
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
    todaySales: 18200,
    monthlySales: 392000,
    totalProfit: 78000,
    outstanding: 21500,
    activeCustomers: 118,
    inventoryValue: 410000,
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
    todaySales: 31800,
    monthlySales: 612000,
    totalProfit: 124000,
    outstanding: 18400,
    activeCustomers: 165,
    inventoryValue: 680000,
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

const farmerSeed: Omit<Farmer, "id" | "storeId">[] = [
  {
    name: "Murugan",
    phone: "9876543201",
    altMobile: "9123456701",
    email: "murugan.farm@gmail.com",
    aadhar: "XXXX-XXXX-4521",
    gst: "",
    village: "Rajapalayam",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626117",
    farmAddress: "Survey No. 14, West Street, Rajapalayam",
    landSize: 4.5,
    cropType: "Cotton",
    soilType: "Black Soil",
    waterSource: "Borewell",
    crops: [
      {
        id: "crop-1",
        cropType: "Cotton",
        landSize: 4.5,
        soilType: "Black Soil",
        waterSource: "Borewell",
      },
    ],
    paymentMethod: "Cash",
    creditLimit: 15000,
    outstanding: 8500,
    customerCategory: "Retail",
    remarks: "Regular customer, prefers organic products.",
    internalNotes: "Prompt payment history.",
    totalPurchases: 48200,
    status: "Active",
    joinedDate: "2022-03-15",
    profileColor: "emerald",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Ramesh",
    phone: "9876543202",
    altMobile: "9123456702",
    email: "ramesh.agri@gmail.com",
    aadhar: "XXXX-XXXX-7832",
    gst: "33ABCDE1234F1Z5",
    village: "Srivilliputhur",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626135",
    farmAddress: "Plot No. 8, Agraharam Street, Srivilliputhur",
    landSize: 8.0,
    cropType: "Paddy",
    soilType: "Alluvial Soil",
    waterSource: "Canal",
    crops: [
      {
        id: "crop-1",
        cropType: "Paddy",
        landSize: 8.0,
        soilType: "Alluvial Soil",
        waterSource: "Canal",
      },
    ],
    paymentMethod: "Bank Transfer",
    creditLimit: 30000,
    outstanding: 0,
    customerCategory: "Wholesale",
    remarks: "Bulk buyer, monthly settlements.",
    internalNotes: "Eligible for dealer pricing slab.",
    totalPurchases: 124500,
    status: "Active",
    joinedDate: "2021-11-20",
    profileColor: "blue",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Selvam",
    phone: "9876543203",
    altMobile: "",
    email: "selvam.k@gmail.com",
    aadhar: "XXXX-XXXX-1290",
    gst: "",
    village: "Sivakasi",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626123",
    farmAddress: "No. 22, Kamarajar Street, Sivakasi",
    landSize: 3.0,
    cropType: "Chilli",
    soilType: "Red Soil",
    waterSource: "Borewell",
    crops: [
      {
        id: "crop-1",
        cropType: "Chilli",
        landSize: 3.0,
        soilType: "Red Soil",
        waterSource: "Borewell",
      },
    ],
    paymentMethod: "Cash",
    creditLimit: 10000,
    outstanding: 4200,
    customerCategory: "Retail",
    remarks: "Chilli farmer, needs pest control guidance.",
    internalNotes: "Occasional late payments.",
    totalPurchases: 31800,
    status: "Active",
    joinedDate: "2023-01-08",
    profileColor: "red",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Karthikeyan",
    phone: "9876543204",
    altMobile: "9123456704",
    email: "karthik.farms@gmail.com",
    aadhar: "XXXX-XXXX-9034",
    gst: "33FGHIJ5678K1Z2",
    village: "Virudhunagar",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626001",
    farmAddress: "SF No. 5, Mill Street, Virudhunagar",
    landSize: 12.5,
    cropType: "Sugarcane",
    soilType: "Loamy Soil",
    waterSource: "Canal",
    crops: [
      {
        id: "crop-1",
        cropType: "Sugarcane",
        landSize: 12.5,
        soilType: "Loamy Soil",
        waterSource: "Canal",
      },
    ],
    paymentMethod: "Bank Transfer",
    creditLimit: 50000,
    outstanding: 12500,
    customerCategory: "Dealer",
    remarks: "Large-scale sugarcane farmer, high volume buyer.",
    internalNotes: "Key account, offer seasonal discount.",
    totalPurchases: 215000,
    status: "Active",
    joinedDate: "2021-06-12",
    profileColor: "amber",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Arumugam",
    phone: "9876543205",
    altMobile: "9123456705",
    email: "arumugam.paddy@gmail.com",
    aadhar: "XXXX-XXXX-3378",
    gst: "",
    village: "Rajapalayam",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626117",
    farmAddress: "No. 7, East Street, Rajapalayam",
    landSize: 5.5,
    cropType: "Paddy",
    soilType: "Clay Soil",
    waterSource: "Borewell",
    crops: [
      {
        id: "crop-1",
        cropType: "Paddy",
        landSize: 5.5,
        soilType: "Clay Soil",
        waterSource: "Borewell",
      },
    ],
    paymentMethod: "Cash",
    creditLimit: 12000,
    outstanding: 0,
    customerCategory: "Retail",
    remarks: "Paddy farmer, buys fertilizers every season.",
    internalNotes: "Reliable customer.",
    totalPurchases: 62300,
    status: "Active",
    joinedDate: "2022-07-22",
    profileColor: "teal",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Palanisamy",
    phone: "9876543206",
    altMobile: "",
    email: "palanisamy.g@gmail.com",
    aadhar: "XXXX-XXXX-6721",
    gst: "",
    village: "Srivilliputhur",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626135",
    farmAddress: "Survey No. 31, Keezh Street, Srivilliputhur",
    landSize: 2.5,
    cropType: "Groundnut",
    soilType: "Red Loam",
    waterSource: "Borewell",
    crops: [
      {
        id: "crop-1",
        cropType: "Groundnut",
        landSize: 2.5,
        soilType: "Red Loam",
        waterSource: "Borewell",
      },
    ],
    paymentMethod: "Cash",
    creditLimit: 8000,
    outstanding: 3100,
    customerCategory: "Retail",
    remarks: "Groundnut farmer, small land holding.",
    internalNotes: "Micro-credit eligible.",
    totalPurchases: 18900,
    status: "Active",
    joinedDate: "2023-04-03",
    profileColor: "blue",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Lakshmanan",
    phone: "9876543207",
    altMobile: "9123456707",
    email: "lakshmanan.banana@gmail.com",
    aadhar: "XXXX-XXXX-5412",
    gst: "33LMNOP9012R1Z8",
    village: "Sivakasi",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626123",
    farmAddress: "Plot No. 14, Match Factory Road, Sivakasi",
    landSize: 6.0,
    cropType: "Banana",
    soilType: "Alluvial Soil",
    waterSource: "Drip Irrigation",
    crops: [
      {
        id: "crop-1",
        cropType: "Banana",
        landSize: 6.0,
        soilType: "Alluvial Soil",
        waterSource: "Drip Irrigation",
      },
    ],
    paymentMethod: "Bank Transfer",
    creditLimit: 25000,
    outstanding: 7800,
    customerCategory: "Wholesale",
    remarks: "Banana plantation owner, bulk buyer of bio products.",
    internalNotes: "Interested in organic line.",
    totalPurchases: 87600,
    status: "Active",
    joinedDate: "2022-01-18",
    profileColor: "emerald",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Sankaralingam",
    phone: "9876543208",
    altMobile: "",
    email: "sankar.cotton@gmail.com",
    aadhar: "XXXX-XXXX-8901",
    gst: "",
    village: "Virudhunagar",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626001",
    farmAddress: "SF No. 19, Bazaar Street, Virudhunagar",
    landSize: 3.5,
    cropType: "Cotton",
    soilType: "Black Soil",
    waterSource: "Borewell",
    crops: [
      {
        id: "crop-1",
        cropType: "Cotton",
        landSize: 3.5,
        soilType: "Black Soil",
        waterSource: "Borewell",
      },
    ],
    paymentMethod: "Cash",
    creditLimit: 10000,
    outstanding: 0,
    customerCategory: "Retail",
    remarks: "Cotton farmer, seasonal buyer.",
    internalNotes: "Good payment record.",
    totalPurchases: 28400,
    status: "Active",
    joinedDate: "2023-02-11",
    profileColor: "amber",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Thangapandi",
    phone: "9876543209",
    altMobile: "9123456709",
    email: "thangapandi.k@gmail.com",
    aadhar: "XXXX-XXXX-2267",
    gst: "",
    village: "Rajapalayam",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626117",
    farmAddress: "No. 3, South Street, Rajapalayam",
    landSize: 1.5,
    cropType: "Chilli",
    soilType: "Red Soil",
    waterSource: "Borewell",
    crops: [
      {
        id: "crop-1",
        cropType: "Chilli",
        landSize: 1.5,
        soilType: "Red Soil",
        waterSource: "Borewell",
      },
    ],
    paymentMethod: "Cash",
    creditLimit: 5000,
    outstanding: 1800,
    customerCategory: "Retail",
    remarks: "Small-scale chilli farmer.",
    internalNotes: "New customer, building trust.",
    totalPurchases: 9200,
    status: "Active",
    joinedDate: "2023-09-05",
    profileColor: "red",
    cropType3: undefined,
    cropType2: undefined,
  },
  {
    name: "Velmurugan",
    phone: "9876543210",
    altMobile: "",
    email: "velmurugan.s@gmail.com",
    aadhar: "XXXX-XXXX-4598",
    gst: "33VWXYZ3456S1Z9",
    village: "Srivilliputhur",
    landmark: "",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626135",
    farmAddress: "Survey No. 42, Agraharam, Srivilliputhur",
    landSize: 10.0,
    cropType: "Sugarcane",
    soilType: "Loamy Soil",
    waterSource: "Canal",
    crops: [
      {
        id: "crop-1",
        cropType: "Sugarcane",
        landSize: 10.0,
        soilType: "Loamy Soil",
        waterSource: "Canal",
      },
    ],
    paymentMethod: "Bank Transfer",
    creditLimit: 40000,
    outstanding: 15600,
    customerCategory: "Dealer",
    remarks: "Large sugarcane estate, high-volume buyer.",
    internalNotes: "Priority account, assign relationship manager.",
    totalPurchases: 178000,
    status: "Active",
    joinedDate: "2021-09-30",
    profileColor: "teal",
    cropType3: undefined,
    cropType2: undefined,
  },
];

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
};

const COMPANY_STORE_SALES_KEY = "nature-biotic-company-store-sales-v1";

export function getCompanyStoreSales(): CompanyStoreSaleRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(COMPANY_STORE_SALES_KEY);

    return saved ? JSON.parse(saved) : [];
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
  storeId: string,
  storeName: string,
  poNo: string,
  poDate: string,
  items: any[],
  storeLocation: string,
  placeOfSupply: string,
) {
  const existing = getCompanyStoreSales();

  // Avoid duplicate sync if this PO was already converted
  const alreadySynced = existing.some((row) => row.invoiceNo === poNo);
  if (alreadySynced) return existing;

  const newRows: CompanyStoreSaleRecord[] = (items || []).map((item, i) => {
    const quantity = Math.max(0, Number(item?.quantity ?? item?.qty ?? 0));
    const price = Number(item?.price ?? item?.sellingPrice ?? item?.rate ?? 0);
    const withoutTax = Number(item?.withoutTax ?? quantity * price);
    const sgst = Number(item?.sgst ?? 0);
    const cgst = Number(item?.cgst ?? 0);
    const igst = Number(item?.igst ?? 0);
    const total = Number(item?.total ?? item?.rowTotal ?? withoutTax + sgst + cgst + igst);
    const packSize = String(item?.packSize || item?.pkgsize || "").trim();
    return {
      id: `po-sync-${poNo}-${i}`,
      invoiceNo: poNo,
      date: poDate,
      storeId,
      storeName,
      storeLocation,
      placeOfSupply,
      product: purchaseItemName(item),
      productId: String(item?.productId || ""),
      packSize,
      pkgsize: packSize,
      batchNo: String(item?.batchNo || ""),
      expiryDate: String(item?.expiryDate || ""),
      quantity,
      rate: price,
      withoutTax,
      taxAmount: sgst + cgst + igst,
      sgst,
      cgst,
      igst,
      total,
      returnAmount: 0,
      unitPrice: price,
      beforeDiscount: withoutTax,
      price: total,
      discountAmount: Number(item?.discountAmount ?? 0),
      discountPercent: Number(item?.discountPercent ?? 0),
      taxableAmount: withoutTax,
    };
  }).filter((row) => row.product && row.quantity > 0);

  const merged = [...newRows, ...existing];
  saveCompanyStoreSales(merged);
  return merged;
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

  if (typeof window !== "undefined") {
    try {
      const key = `naturebiotic:purchase-orders:${request.storeId}`;
      const orders = JSON.parse(localStorage.getItem(key) || "[]");
      const po = Array.isArray(orders)
        ? orders.find((item: any) => item?.poNo === request.referenceNo)
        : null;
      if (po) {
        syncApprovedPurchaseOrderToSales(
          request.storeId,
          request.storeName,
          po.poNo,
          po.date,
          po.items || [],
          stores.find((store) => store.id === request.storeId)?.location || "",
          "Tamil Nadu",
        );
        localStorage.setItem(
          key,
          JSON.stringify(
            orders.map((item: any) =>
              item?.poNo === request.referenceNo
                ? { ...item, status: "Approved" }
                : item,
            ),
          ),
        );
        window.dispatchEvent(new Event("store-purchase-orders-updated"));
      }
    } catch {}
  }

  return updateStoreApprovalRequestStatus(requestId, "Approved");
}

export function getStorePurchasesFromCompanySales(storeId: string) {
  return getCompanyStoreSales().filter((sale) => sale.storeId === storeId);
}

export const farmers: Farmer[] = farmerSeed.map((f, i) => ({
  ...f,
  id: `f${i}`,
  storeId: "s1",
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

const productNames = products.map((p) => p.name);

export const farmerPurchases: FarmerPurchase[] = [];
export const farmerPayments: FarmerPayment[] = [];
let purchaseCounter = 1;
let paymentCounter = 1;

farmers.forEach((farmer, fi) => {
  const purchaseCount = 4 + (fi % 4);
  for (let p = 0; p < purchaseCount; p++) {
    const prod = productNames[(fi + p) % productNames.length];
    const qty = 1 + ((fi + p) % 5);
    const price = products.find((pr) => pr.name === prod)?.sellingPrice ?? 400;
    const amount = qty * price;
    const daysAgo = (p + 1) * 12 + fi * 3;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const date = d.toISOString().split("T")[0];
    farmerPurchases.push({
      id: `fp${purchaseCounter}`,
      farmerId: farmer.id,
      invoiceNo: `NB-S1-${String(purchaseCounter).padStart(4, "0")}`,
      date,
      product: prod,
      quantity: qty,
      amount,
      paymentStatus: p % 3 === 0 ? "Pending" : "Paid",
    });
    purchaseCounter++;
  }
  const paymentCount = 2 + (fi % 3);
  for (let pay = 0; pay < paymentCount; pay++) {
    const amount = 2000 + (((fi + pay) * 1371) % 8000);
    const daysAgo = (pay + 1) * 20 + fi * 5;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const date = d.toISOString().split("T")[0];
    const methods = ["Cash", "Bank Transfer", "UPI"];
    farmerPayments.push({
      id: `fpm${paymentCounter}`,
      farmerId: farmer.id,
      receiptNo: `RCP-${String(paymentCounter).padStart(4, "0")}`,
      date,
      amount,
      method: methods[pay % 3],
      note: pay === 0 ? "Advance payment" : "Settlement",
    });
    paymentCounter++;
  }
});

const billDates: string[] = [];
for (let i = 0; i < 14; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  billDates.push(d.toISOString().split("T")[0]);
}

export const bills: Bill[] = [];
let billCounter = 1;
billDates.forEach((date, di) => {
  const billsPerDay = 3;
  for (let b = 0; b < billsPerDay; b++) {
    const farmer = farmers[(di + b) % farmers.length];
    const itemCount = 1 + (b % 4);
    const items = Array.from({ length: itemCount }, (_, k) => {
      const prod = products[(di + b + k) % products.length];
      const qty = 1 + ((di + b + k) % 5);
      return {
        name: prod?.name ?? "Product",
        qty,
        price: prod?.sellingPrice ?? 100,
      };
    });
    const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    bills.push({
      id: `b${di}${b}`,
      storeId: "s1",
      billNo: `NB-S1-${String(billCounter).padStart(4, "0")}`,
      farmerName: farmer.name,
      items,
      total,
      paymentStatus: (di + b) % 3 === 0 ? "Pending" : "Paid",
      billDate: date,
      executiveName: "Direct",
    });
    billCounter++;
  }
});

const roles = [
  "Field Executive",
  "Sales Executive",
  "Store Manager",
  "Accountant",
  "Inventory Clerk",
];

const staffNames = [
  "Ram Kumar",
  "Ajith Kumar",
  "PeriyaSamy",
  "Sarath KUmar",
  "Vijay",
];

export const staff: Staff[] = staffNames.map((name, i) => ({
  id: `st${i}`,
  storeId: stores[i % stores.length]?.id ?? "s1",
  name,
  phone: `98765432${10 + i}`,
  alternativePhone: `91234567${10 + i}`,
  email: `${name.toLowerCase().replace(/\s/g, ".")}@naturebiotic.in`,
  dob: `199${2 + i}-0${(i % 8) + 1}-1${i % 9}`,
  age: 29 + i,
  bloodGroup: ["O+", "A+", "B+", "AB+", "O-"][i % 5],
  joinedDate: `202${1 + (i % 3)}-0${1 + (i % 9)}-1${i % 9}`,
  address: [
    "Rajapalayam, Virudhunagar, Tamil Nadu",
    "Srivilliputhur, Virudhunagar, Tamil Nadu",
    "Sivakasi, Virudhunagar, Tamil Nadu",
    "Tenkasi, Tamil Nadu",
    "Idukki, Kerala",
  ][i],
  proofIdName: `staff-proof-${i + 1}.pdf`,
  profileImageName: "",
  designation: [
    "Field Exective",
    "Field Exective",
    "Field Exective",
    "Field Exective",
    "Field Exective",
  ][i],
  level: ((i % 4) + 1) as 1 | 2 | 3 | 4,
  targetSales: [30000, 25000, 22000, 18000, 15000][i],
  targetFarmers: [50, 45, 40, 35, 30][i],
  targetFarms: [35, 32, 28, 24, 20][i],
  targetVisits: [10, 20, 40, 120, 250][i],
  role: roles[i % roles.length],
  status: i === 3 ? "On Leave" : "Active",
}));

export const deliveryChallans: DeliveryChallan[] = [
  {
    id: "sd1",
    storeId: "s1",
    challanNo: "sd-2026-001",
    date: "2026-08-14",
    executiveName: "Ram Kumar",
    issuedBy: "Store Manager",
    status: "Open",
    remarks: "Morning field stock issue",
    items: [
      {
        productId: "p0",
        productName: "Electra",
        packSize: "500 ml",
        batchNo: "ELE140826",
        issuedQty: 20,
        soldQty: 12,
        returnedQty: 3,
      },
      {
        productId: "p2",
        productName: "Astra",
        packSize: "100 ml",
        batchNo: "AST140826",
        issuedQty: 10,
        soldQty: 6,
        returnedQty: 1,
      },
    ],
  },
  {
    id: "sd2",
    storeId: "s1",
    challanNo: "sd-2026-002",
    date: "2026-08-14",
    executiveName: "Ajith Kumar",
    issuedBy: "Store Manager",
    status: "Open",
    remarks: "Field visit stock",
    items: [
      {
        productId: "p0",
        productName: "Electra",
        packSize: "500 ml",
        batchNo: "ELE140826",
        issuedQty: 15,
        soldQty: 8,
        returnedQty: 2,
      },
      {
        productId: "p1",
        productName: "Aalga",
        packSize: "250 ml",
        batchNo: "AAL140826",
        issuedQty: 12,
        soldQty: 7,
        returnedQty: 1,
      },
    ],
  },
  {
    id: "sd3",
    storeId: "s1",
    challanNo: "sd-2026-003",
    date: "2026-08-13",
    executiveName: "PeriyaSamy",
    issuedBy: "Store Manager",
    status: "Partially Returned",
    remarks: "Route stock issue",
    items: [
      {
        productId: "p3",
        productName: "Alpha",
        packSize: "5 Kg",
        batchNo: "ALP130826",
        issuedQty: 8,
        soldQty: 3,
        returnedQty: 2,
      },
      {
        productId: "p4",
        productName: "Nuetra",
        packSize: "1 L",
        batchNo: "NUE130826",
        issuedQty: 6,
        soldQty: 2,
        returnedQty: 1,
      },
    ],
  },
];

export const executiveStockReturns: ExecutiveStockReturn[] = [
  {
    id: "ret1",
    storeId: "s1",
    returnNo: "RET-001",
    date: "2026-08-14",
    challanNo: "sd-2026-001",
    executiveName: "Ram Kumar",
    productName: "Electra",
    packSize: "500 ml",
    quantity: 3,
    remarks: "Unsold stock returned",
  },
  {
    id: "ret2",
    storeId: "s1",
    returnNo: "RET-002",
    date: "2026-08-14",
    challanNo: "sd-2026-002",
    executiveName: "Ajith Kumar",
    productName: "Electra",
    packSize: "500 ml",
    quantity: 2,
    remarks: "Balance returned",
  },
  {
    id: "ret3",
    storeId: "s1",
    returnNo: "RET-003",
    date: "2026-08-13",
    challanNo: "sd-2026-003",
    executiveName: "PeriyaSamy",
    productName: "Alpha",
    packSize: "5 Kg",
    quantity: 2,
    remarks: "Route return",
  },
];

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
let movementCounter = 1;
products.forEach((product) => {
  const movementCount = 4 + (parseInt(product.id.replace("p", ""), 10) % 4);
  let runningBalance = Math.max(0, product.stock - 40);
  for (let m = 0; m < movementCount; m++) {
    const types: StockMovementType[] = ["IN", "OUT", "TRANSFER", "ADJUSTMENT"];
    const type =
      types[(parseInt(product.id.replace("p", ""), 10) + m) % types.length];
    const qty = 5 + (((m + 3) * 7) % 40);
    if (type === "OUT" || type === "ADJUSTMENT")
      runningBalance = Math.max(0, runningBalance - qty);
    else runningBalance += qty;
    const daysAgo = (m + 1) * 5 + parseInt(product.id.replace("p", ""), 10) * 2;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    stockMovements.push({
      id: `sm${movementCounter}`,
      productId: product.id,
      date: d.toISOString().split("T")[0],
      type,
      referenceNo: `${type === "IN" ? "PO" : type === "OUT" ? "INV" : type === "TRANSFER" ? "TRF" : "ADJ"}-${String(movementCounter).padStart(5, "0")}`,
      quantity: qty,
      balanceStock: runningBalance,
      handledBy: movementHandlers[m % movementHandlers.length],
      remarks: movementRemarks[type][m % movementRemarks[type].length],
    });
    movementCounter++;
  }
});

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
  const updated = getStoreApprovalRequests().map((row) =>
    row.id === id ? { ...row, status } : row,
  );
  saveStoreApprovalRequests(updated);
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
    if (isExecutiveMovement(row) || row?.status === "Rejected") return sum;
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

  return Math.max(
    0,
    purchased -
      delivered +
      returned -
      sold +
      customerReturns +
      adjustments -
      companyCredits,
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

  const sold = getCompanyStoreSales().reduce((sum, sale) => {
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

  return Math.max(0, opening - sold + returned);
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

  const froKey = String(accepted.froName || "")
    .trim()
    .toLowerCase();
  if (!froKey) return;

  try {
    const requestKey = `${FRO_RETURN_REQUEST_PREFIX}:${froKey}`;
    const saved = JSON.parse(localStorage.getItem(requestKey) || "[]");
    if (Array.isArray(saved)) {
      localStorage.setItem(
        requestKey,
        JSON.stringify(
          saved.map((item: any) =>
            String(item.id) === String(accepted.id)
              ? { ...item, ...accepted, status: "accepted" }
              : item,
          ),
        ),
      );
    }
  } catch {}

  window.dispatchEvent(new Event("nature-biotic-fro-stock-return-updated"));
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
