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
};

export type CustomerCategory = "Retail" | "Wholesale" | "Dealer";

export type Farmer = {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  altMobile: string;
  email: string;
  aadhar: string;
  gst: string;
  village: string;
  taluk: string;
  district: string;
  state: string;
  pincode: string;
  farmAddress: string;
  landSize: number;
  cropType: string;
  soilType: string;
  waterSource: string;
  paymentMethod: string;
  creditLimit: number;
  outstanding: number;
  customerCategory: CustomerCategory;
  remarks: string;
  internalNotes: string;
  totalPurchases: number;
  status: "Active" | "Inactive";
  joinedDate: string;
  profileColor: string;
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
  quantity: number;
  remarks: string;
};

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
  },
];

const warehouses = ["Main Warehouse - Bellary", "Secondary Warehouse - Hospet"];

const productSeed: Omit<Product, "id" | "storeId">[] = [
  {
    name: "Electra",
    purpose: "Larvicide",
    productCategory: "Pesticide",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Volume",
    size: "500 ml",
    hsnCode: "380893",
    purchasePrice: 320,
    sellingPrice: 450,
    mrp: 520,
    taxType: "Intrastate",
    taxPercentage: 12,
    sgst: 6,
    cgst: 6,
    igst: 0,
    description:
      "Electra is a premium crop nutrition supplement enriched with essential micronutrients for healthy plant growth and higher yields.",
    usageInstructions:
      "Mix 2-3 ml per litre of water and spray on crops during early morning or evening.",
    safetyInfo:
      "Wear protective gloves while handling. Avoid contact with skin and eyes.",
    storageInfo:
      "Store in a cool, dry place away from direct sunlight. Keep out of reach of children.",
    stock: 120,
    minStock: 30,
    maxStock: 300,
    reservedStock: 12,
    warehouse: warehouses[0],
    lastUpdated: "2026-07-22",
    status: "Active",
    sold: 340,
    imageColor: "emerald",
  },
  {
    name: "Aalga",
    purpose: "Tillers and Branche Developers",
    productCategory: "Bio-stimulant",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Volume",
    size: "250 ml",
    hsnCode: "300190",
    purchasePrice: 280,
    sellingPrice: 380,
    mrp: 450,
    taxType: "Intrastate",
    taxPercentage: 5,
    sgst: 2.5,
    cgst: 2.5,
    igst: 0,
    description:
      "Aalga is a seaweed extract-based bio product that promotes root development and enhances crop resistance to stress.",
    usageInstructions:
      "Apply 1-2 ml per litre of water as a foliar spray every 15 days.",
    safetyInfo:
      "Natural product. Still, avoid ingestion and wash hands after use.",
    storageInfo: "Store in original container in a cool place. Do not freeze.",
    stock: 85,
    minStock: 25,
    maxStock: 200,
    reservedStock: 5,
    warehouse: warehouses[0],
    lastUpdated: "2026-07-21",
    status: "Active",
    sold: 210,
    imageColor: "teal",
  },
  {
    name: "Astra",
    purpose: "Miticide & Acaricide",
    productCategory: "Pesticide",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Volume",
    size: "100 ml",
    hsnCode: "380891",
    purchasePrice: 410,
    sellingPrice: 560,
    mrp: 650,
    taxType: "Interstate",
    taxPercentage: 18,
    sgst: 0,
    cgst: 0,
    igst: 18,
    description:
      "Astra is a broad-spectrum pesticide effective against a wide range of crop-damaging pests including aphids and bollworms.",
    usageInstructions:
      "Mix 1-1.5 ml per litre of water. Spray uniformly on affected areas.",
    safetyInfo:
      "Highly toxic. Use protective clothing, mask, and gloves. Do not inhale spray mist.",
    storageInfo:
      "Store in a locked, ventilated area away from food and feed. Keep away from children.",
    stock: 18,
    minStock: 20,
    maxStock: 150,
    reservedStock: 0,
    warehouse: warehouses[1],
    lastUpdated: "2026-07-20",
    status: "Active",
    sold: 180,
    imageColor: "red",
  },
  {
    name: "Alpha",
    purpose: "Yield Enhancer",
    productCategory: "Bio-stimulant",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Weight",
    size: "5 Kg",
    hsnCode: "310210",
    purchasePrice: 850,
    sellingPrice: 1100,
    mrp: 1250,
    taxType: "Intrastate",
    taxPercentage: 5,
    sgst: 2.5,
    cgst: 2.5,
    igst: 0,
    description:
      "Alpha is a balanced NPK fertilizer with added micronutrients designed for all-round crop nutrition and maximum yield.",
    usageInstructions:
      "Apply 25-50 kg per acre as basal dressing or top dressing as per crop requirement.",
    safetyInfo:
      "Avoid direct contact with skin. Wash thoroughly after handling.",
    storageInfo:
      "Store in a dry, ventilated warehouse. Keep bags sealed to prevent moisture absorption.",
    stock: 200,
    minStock: 50,
    maxStock: 400,
    reservedStock: 25,
    warehouse: warehouses[0],
    lastUpdated: "2026-07-22",
    status: "Active",
    sold: 520,
    imageColor: "amber",
  },
  {
    name: "Nuetra",
    purpose: "Botanical fungicide",
    productCategory: "Bio-stimulant",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Volume",
    size: "1 L",
    hsnCode: "380893",
    purchasePrice: 520,
    sellingPrice: 680,
    mrp: 780,
    taxType: "Interstate",
    taxPercentage: 12,
    sgst: 0,
    cgst: 0,
    igst: 12,
    description:
      "Nuetra is an advanced crop nutrition formula providing complete micronutrient support for sustained plant health.",
    usageInstructions:
      "Mix 3-5 ml per litre of water and spray during active growth stages.",
    safetyInfo: "Use protective gear. Avoid spraying in windy conditions.",
    storageInfo: "Store in a cool, dry place. Seal tightly after use.",
    stock: 12,
    minStock: 15,
    maxStock: 120,
    reservedStock: 2,
    warehouse: warehouses[1],
    lastUpdated: "2026-07-19",
    status: "Active",
    sold: 95,
    imageColor: "blue",
  },
  {
    name: "Ultra",
    purpose: "Insecticide (Suckingpest)",
    productCategory: "Pesticide",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Weight",
    size: "500 g",
    hsnCode: "380892",
    purchasePrice: 380,
    sellingPrice: 520,
    mrp: 600,
    taxType: "Intrastate",
    taxPercentage: 18,
    sgst: 9,
    cgst: 9,
    igst: 0,
    description:
      "Ultra is a systemic fungicide that protects crops from fungal diseases and prevents spore germination.",
    usageInstructions:
      "Dissolve 2-3 g per litre of water and spray preventively at 10-15 day intervals.",
    safetyInfo:
      "Toxic if swallowed. Wear mask and gloves. Do not mix with alkaline substances.",
    storageInfo:
      "Store in original container in a cool, dry place away from children and animals.",
    stock: 0,
    minStock: 10,
    maxStock: 100,
    reservedStock: 0,
    warehouse: warehouses[0],
    lastUpdated: "2026-07-18",
    status: "Active",
    sold: 65,
    imageColor: "purple",
  },
  {
    name: "Electra Plus",
    purpose: "Larvicide",
    productCategory: "Pesticide",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Volume",
    size: "1 L",
    hsnCode: "380893",
    purchasePrice: 640,
    sellingPrice: 850,
    mrp: 980,
    taxType: "Intrastate",
    taxPercentage: 12,
    sgst: 6,
    cgst: 6,
    igst: 0,
    description:
      "Electra Plus is the concentrated version of Electra with enhanced micronutrient profile for commercial farming.",
    usageInstructions:
      "Mix 1.5-2 ml per litre of water. Ideal for large-scale foliar application.",
    safetyInfo: "Wear protective gloves and mask. Avoid contact with eyes.",
    storageInfo: "Store in a cool, dry place. Keep container tightly closed.",
    stock: 60,
    minStock: 20,
    maxStock: 200,
    reservedStock: 8,
    warehouse: warehouses[1],
    lastUpdated: "2026-07-21",
    status: "Active",
    sold: 130,
    imageColor: "emerald",
  },
  {
    name: "Aalga Gold",
    purpose: "Root Enhancer",
    productCategory: "Bio-stimulant",
    productType: "Liquid",
    manufacturer: "Nature Biotic Pvt. Ltd.",
    vendor: "Nature Biotic Distribution",
    unit: "Volume",
    size: "500 ml",
    hsnCode: "300190",
    purchasePrice: 520,
    sellingPrice: 680,
    mrp: 800,
    taxType: "Interstate",
    taxPercentage: 5,
    sgst: 0,
    cgst: 0,
    igst: 5,
    description:
      "Aalga Gold is a premium bio-stimulant with enriched seaweed extract and amino acids for superior crop vigor.",
    usageInstructions:
      "Apply 2-3 ml per litre of water every 10-15 days during growth cycle.",
    safetyInfo: "Natural product. Wash hands after use. Avoid eye contact.",
    storageInfo:
      "Store in original container in a cool place. Protect from freezing.",
    stock: 0,
    minStock: 15,
    maxStock: 150,
    reservedStock: 0,
    warehouse: warehouses[0],
    lastUpdated: "2026-07-17",
    status: "Inactive",
    sold: 48,
    imageColor: "teal",
  },
];

export const products: Product[] = productSeed.map((p, i) => ({
  ...p,
  id: `p${i}`,
  storeId: "s1",
}));

const farmerSeed: Omit<Farmer, "id" | "storeId">[] = [
  {
    name: "Murugan",
    phone: "9876543201",
    altMobile: "9123456701",
    email: "murugan.farm@gmail.com",
    aadhar: "XXXX-XXXX-4521",
    gst: "",
    village: "Rajapalayam",
    taluk: "Rajapalayam",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626117",
    farmAddress: "Survey No. 14, West Street, Rajapalayam",
    landSize: 4.5,
    cropType: "Cotton",
    soilType: "Black Soil",
    waterSource: "Borewell",
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
  },
  {
    name: "Ramesh",
    phone: "9876543202",
    altMobile: "9123456702",
    email: "ramesh.agri@gmail.com",
    aadhar: "XXXX-XXXX-7832",
    gst: "33ABCDE1234F1Z5",
    village: "Srivilliputhur",
    taluk: "Srivilliputhur",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626135",
    farmAddress: "Plot No. 8, Agraharam Street, Srivilliputhur",
    landSize: 8.0,
    cropType: "Paddy",
    soilType: "Alluvial Soil",
    waterSource: "Canal",
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
  },
  {
    name: "Selvam",
    phone: "9876543203",
    altMobile: "",
    email: "selvam.k@gmail.com",
    aadhar: "XXXX-XXXX-1290",
    gst: "",
    village: "Sivakasi",
    taluk: "Sivakasi",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626123",
    farmAddress: "No. 22, Kamarajar Street, Sivakasi",
    landSize: 3.0,
    cropType: "Chilli",
    soilType: "Red Soil",
    waterSource: "Borewell",
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
  },
  {
    name: "Karthikeyan",
    phone: "9876543204",
    altMobile: "9123456704",
    email: "karthik.farms@gmail.com",
    aadhar: "XXXX-XXXX-9034",
    gst: "33FGHIJ5678K1Z2",
    village: "Virudhunagar",
    taluk: "Virudhunagar",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626001",
    farmAddress: "SF No. 5, Mill Street, Virudhunagar",
    landSize: 12.5,
    cropType: "Sugarcane",
    soilType: "Loamy Soil",
    waterSource: "Canal",
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
  },
  {
    name: "Arumugam",
    phone: "9876543205",
    altMobile: "9123456705",
    email: "arumugam.paddy@gmail.com",
    aadhar: "XXXX-XXXX-3378",
    gst: "",
    village: "Rajapalayam",
    taluk: "Rajapalayam",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626117",
    farmAddress: "No. 7, East Street, Rajapalayam",
    landSize: 5.5,
    cropType: "Paddy",
    soilType: "Clay Soil",
    waterSource: "Borewell",
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
  },
  {
    name: "Palanisamy",
    phone: "9876543206",
    altMobile: "",
    email: "palanisamy.g@gmail.com",
    aadhar: "XXXX-XXXX-6721",
    gst: "",
    village: "Srivilliputhur",
    taluk: "Srivilliputhur",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626135",
    farmAddress: "Survey No. 31, Keezh Street, Srivilliputhur",
    landSize: 2.5,
    cropType: "Groundnut",
    soilType: "Red Loam",
    waterSource: "Borewell",
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
  },
  {
    name: "Lakshmanan",
    phone: "9876543207",
    altMobile: "9123456707",
    email: "lakshmanan.banana@gmail.com",
    aadhar: "XXXX-XXXX-5412",
    gst: "33LMNOP9012R1Z8",
    village: "Sivakasi",
    taluk: "Sivakasi",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626123",
    farmAddress: "Plot No. 14, Match Factory Road, Sivakasi",
    landSize: 6.0,
    cropType: "Banana",
    soilType: "Alluvial Soil",
    waterSource: "Drip Irrigation",
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
  },
  {
    name: "Sankaralingam",
    phone: "9876543208",
    altMobile: "",
    email: "sankar.cotton@gmail.com",
    aadhar: "XXXX-XXXX-8901",
    gst: "",
    village: "Virudhunagar",
    taluk: "Virudhunagar",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626001",
    farmAddress: "SF No. 19, Bazaar Street, Virudhunagar",
    landSize: 3.5,
    cropType: "Cotton",
    soilType: "Black Soil",
    waterSource: "Borewell",
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
  },
  {
    name: "Thangapandi",
    phone: "9876543209",
    altMobile: "9123456709",
    email: "thangapandi.k@gmail.com",
    aadhar: "XXXX-XXXX-2267",
    gst: "",
    village: "Rajapalayam",
    taluk: "Rajapalayam",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626117",
    farmAddress: "No. 3, South Street, Rajapalayam",
    landSize: 1.5,
    cropType: "Chilli",
    soilType: "Red Soil",
    waterSource: "Borewell",
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
  },
  {
    name: "Velmurugan",
    phone: "9876543210",
    altMobile: "",
    email: "velmurugan.s@gmail.com",
    aadhar: "XXXX-XXXX-4598",
    gst: "33VWXYZ3456S1Z9",
    village: "Srivilliputhur",
    taluk: "Srivilliputhur",
    district: "Virudhunagar",
    state: "Tamil Nadu",
    pincode: "626135",
    farmAddress: "Survey No. 42, Agraharam, Srivilliputhur",
    landSize: 10.0,
    cropType: "Sugarcane",
    soilType: "Loamy Soil",
    waterSource: "Canal",
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
  },
];

export type CompanyStoreSaleRecord = {
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

export function getStorePurchasesFromCompanySales(storeId: string) {
  return getCompanyStoreSales().filter((sale) => sale.storeId === storeId);
}

export const farmers: Farmer[] = farmerSeed.map((f, i) => ({
  ...f,
  id: `f${i}`,
  storeId: "s1",
}));

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
    id: "dc1",
    storeId: "s1",
    challanNo: "DC-2026-001",
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
    id: "dc2",
    storeId: "s1",
    challanNo: "DC-2026-002",
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
    id: "dc3",
    storeId: "s1",
    challanNo: "DC-2026-003",
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
    challanNo: "DC-2026-001",
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
    challanNo: "DC-2026-002",
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
    challanNo: "DC-2026-003",
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
  return farmers.filter((f) => f.storeId === storeId);
}

export function getFarmerById(id: string): Farmer | undefined {
  return farmers.find((f) => f.id === id);
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
