import { useState, useMemo } from "react";
import { getStore, productCategories, ProductCategory } from "@/lib/data";
import {
  Card,
  StatCard,
  EmptyState,
  Button,
  Input,
  Select,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatCompact, initials } from "@/lib/format";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

const filterTabs: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

type ExecKey = "ram" | "ajith" | "periya";

type ExecSummary = {
  sales: number;
  collection: number;
  collectionInHand: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  bills: number;
  bestArea: string;
  topProduct: string;
};

const execNames: Record<ExecKey, string> = {
  ram: "Ram Kumar",
  ajith: "Ajith Kumar",
  periya: "PeriyaSamy",
};

const execColors: Record<ExecKey, string> = {
  ram: "from-emerald-400 to-emerald-600",
  ajith: "from-blue-400 to-blue-600",
  periya: "from-amber-400 to-amber-600",
};

const execData: Record<ExecKey, Record<DateFilter, ExecSummary>> = {
  ram: {
    today: {
      sales: 24500,
      collection: 21600,
      collectionInHand: 3400,
      outstanding: 2900,
      farmers: 42,
      farms: 31,
      crops: 8,
      bills: 18,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    weekly: {
      sales: 168400,
      collection: 142800,
      collectionInHand: 22800,
      outstanding: 25600,
      farmers: 46,
      farms: 34,
      crops: 10,
      bills: 126,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    monthly: {
      sales: 485000,
      collection: 412000,
      collectionInHand: 64500,
      outstanding: 73000,
      farmers: 52,
      farms: 38,
      crops: 12,
      bills: 542,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    quarterly: {
      sales: 1425000,
      collection: 1186000,
      collectionInHand: 184200,
      outstanding: 239000,
      farmers: 58,
      farms: 42,
      crops: 14,
      bills: 1604,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    yearly: {
      sales: 5820000,
      collection: 4740000,
      collectionInHand: 726000,
      outstanding: 1080000,
      farmers: 64,
      farms: 48,
      crops: 16,
      bills: 6580,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
  },
  ajith: {
    today: {
      sales: 19800,
      collection: 17200,
      collectionInHand: 2800,
      outstanding: 2600,
      farmers: 36,
      farms: 28,
      crops: 7,
      bills: 14,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    weekly: {
      sales: 132600,
      collection: 110500,
      collectionInHand: 18600,
      outstanding: 22100,
      farmers: 39,
      farms: 30,
      crops: 9,
      bills: 98,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    monthly: {
      sales: 392000,
      collection: 318000,
      collectionInHand: 52400,
      outstanding: 74000,
      farmers: 44,
      farms: 33,
      crops: 11,
      bills: 418,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    quarterly: {
      sales: 1148000,
      collection: 942000,
      collectionInHand: 148600,
      outstanding: 206000,
      farmers: 49,
      farms: 36,
      crops: 13,
      bills: 1242,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    yearly: {
      sales: 4680000,
      collection: 3820000,
      collectionInHand: 584000,
      outstanding: 860000,
      farmers: 54,
      farms: 41,
      crops: 15,
      bills: 5060,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
  },
  periya: {
    today: {
      sales: 17600,
      collection: 15400,
      collectionInHand: 2400,
      outstanding: 2200,
      farmers: 31,
      farms: 24,
      crops: 6,
      bills: 11,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    weekly: {
      sales: 118200,
      collection: 98600,
      collectionInHand: 16200,
      outstanding: 19600,
      farmers: 34,
      farms: 26,
      crops: 8,
      bills: 82,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    monthly: {
      sales: 348000,
      collection: 286000,
      collectionInHand: 46800,
      outstanding: 62000,
      farmers: 38,
      farms: 29,
      crops: 10,
      bills: 356,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    quarterly: {
      sales: 1024000,
      collection: 848000,
      collectionInHand: 132400,
      outstanding: 176000,
      farmers: 42,
      farms: 31,
      crops: 12,
      bills: 1068,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    yearly: {
      sales: 4180000,
      collection: 3420000,
      collectionInHand: 518000,
      outstanding: 760000,
      farmers: 47,
      farms: 35,
      crops: 14,
      bills: 4320,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
  },
};

type KpiData = {
  sales: number;
  collection: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  trends: {
    sales: string;
    collection: string;
    outstanding: string;
    farmers: string;
    farms: string;
    crops: string;
  };
};

const kpiData: Record<DateFilter, KpiData> = {
  today: {
    sales: 61900,
    collection: 54200,
    outstanding: 7700,
    farmers: 142,
    farms: 96,
    crops: 38,
    trends: {
      sales: "+6.8% vs yesterday",
      collection: "+4.2% vs yesterday",
      outstanding: "-1.4% vs yesterday",
      farmers: "+2 new today",
      farms: "+1 new today",
      crops: "38 active crops",
    },
  },
  weekly: {
    sales: 419200,
    collection: 351900,
    outstanding: 67300,
    farmers: 148,
    farms: 101,
    crops: 42,
    trends: {
      sales: "+12.3% vs last week",
      collection: "+9.1% vs last week",
      outstanding: "-3.2% vs last week",
      farmers: "+9 this week",
      farms: "+5 this week",
      crops: "+4 this week",
    },
  },
  monthly: {
    sales: 1225000,
    collection: 1016000,
    outstanding: 209000,
    farmers: 156,
    farms: 108,
    crops: 47,
    trends: {
      sales: "+18.2% this month",
      collection: "+14.6% this month",
      outstanding: "-5.1% this month",
      farmers: "+24 this month",
      farms: "+12 this month",
      crops: "+9 this month",
    },
  },
  quarterly: {
    sales: 3597000,
    collection: 2976000,
    outstanding: 621000,
    farmers: 166,
    farms: 117,
    crops: 52,
    trends: {
      sales: "+22.4% this quarter",
      collection: "+18.9% this quarter",
      outstanding: "-7.8% this quarter",
      farmers: "+38 this quarter",
      farms: "+21 this quarter",
      crops: "+14 this quarter",
    },
  },
  yearly: {
    sales: 14680000,
    collection: 11980000,
    outstanding: 2700000,
    farmers: 184,
    farms: 132,
    crops: 58,
    trends: {
      sales: "+24.6% this year",
      collection: "+21.3% this year",
      outstanding: "-9.2% this year",
      farmers: "+72 this year",
      farms: "+48 this year",
      crops: "+22 this year",
    },
  },
};

// type StockRow = {
//   id: string;
//   name: string;
//   productType: string;
//   packSize: string;
//   available: number;
//   stockValue: number;
//   lastUpdated: string;
// };
type PackSizeStock = {
  packSize: string;
  batchNo: string;
  expiryDate: string;
  lastSaleDate: string;
  availableStock: number;
  stockInHand: number;
  stockValue: number;
};

type StockRow = {
  id: string;
  productType: string;
  productName: string;
  packSizes: PackSizeStock[];
};

//
const DAY_MS = 24 * 60 * 60 * 1000;

function parseExpiryMonth(value: string) {
  const match = value.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;

  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  const monthIndex = monthNames.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) return null;

  const year = Number(match[2]);
  return new Date(year, monthIndex + 1, 0, 23, 59, 59);
}

function getStockWarnings(pack: PackSizeStock) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = parseExpiryMonth(pack.expiryDate);
  const lastSale = new Date(`${pack.lastSaleDate}T00:00:00`);

  const daysToExpiry = expiry
    ? Math.ceil((expiry.getTime() - today.getTime()) / DAY_MS)
    : Number.POSITIVE_INFINITY;

  const daysSinceSale = Number.isNaN(lastSale.getTime())
    ? 0
    : Math.floor((today.getTime() - lastSale.getTime()) / DAY_MS);

  return {
    lowStock: pack.availableStock <= 5,
    expiringSoon: daysToExpiry >= 0 && daysToExpiry <= 31,
    expired: daysToExpiry < 0,
    noRecentSale: daysSinceSale >= 30,
    daysSinceSale,
  };
}

// const stockData: Record<DateFilter, StockRow[]> = {
//   today: [
//     {
//       id: "p0",
//       name: "Electra",
//       productType: "Crop Nutrition",
//       packSize: "500 ml",
//       available: 125,
//       stockValue: 56250,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p1",
//       name: "Aalga",
//       productType: "Bio Product",
//       packSize: "250 ml",
//       available: 85,
//       stockValue: 32300,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p2",
//       name: "Astra",
//       productType: "Pesticide",
//       packSize: "100 ml",
//       available: 18,
//       stockValue: 10080,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p3",
//       name: "Alpha",
//       productType: "Fertilizer",
//       packSize: "5 Kg",
//       available: 200,
//       stockValue: 220000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p4",
//       name: "Neutra",
//       productType: "Crop Nutrition",
//       packSize: "1 L",
//       available: 12,
//       stockValue: 8160,
//       lastUpdated: "02 Aug 2026",
//     },
//     {
//       id: "p5",
//       name: "Rootra",
//       productType: "Bio Product",
//       packSize: "500 ml",
//       available: 50,
//       stockValue: 26000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p6",
//       name: "Ultra",
//       productType: "Fungicide",
//       packSize: "500 g",
//       available: 4,
//       stockValue: 2080,
//       lastUpdated: "01 Aug 2026",
//     },
//   ],
//   weekly: [
//     {
//       id: "p0",
//       name: "Electra",
//       productType: "Crop Nutrition",
//       packSize: "500 ml",
//       available: 105,
//       stockValue: 47250,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p1",
//       name: "Aalga",
//       productType: "Bio Product",
//       packSize: "250 ml",
//       available: 65,
//       stockValue: 24700,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p2",
//       name: "Astra",
//       productType: "Pesticide",
//       packSize: "100 ml",
//       available: 24,
//       stockValue: 13440,
//       lastUpdated: "02 Aug 2026",
//     },
//     {
//       id: "p3",
//       name: "Alpha",
//       productType: "Fertilizer",
//       packSize: "5 Kg",
//       available: 180,
//       stockValue: 198000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p4",
//       name: "Neutra",
//       productType: "Crop Nutrition",
//       packSize: "1 L",
//       available: 18,
//       stockValue: 12240,
//       lastUpdated: "01 Aug 2026",
//     },
//     {
//       id: "p5",
//       name: "Rootra",
//       productType: "Bio Product",
//       packSize: "500 ml",
//       available: 60,
//       stockValue: 31200,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p6",
//       name: "Ultra",
//       productType: "Fungicide",
//       packSize: "500 g",
//       available: 8,
//       stockValue: 4160,
//       lastUpdated: "31 Jul 2026",
//     },
//   ],
//   monthly: [
//     {
//       id: "p0",
//       name: "Electra",
//       productType: "Crop Nutrition",
//       packSize: "500 ml",
//       available: 120,
//       stockValue: 54000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p1",
//       name: "Aalga",
//       productType: "Bio Product",
//       packSize: "250 ml",
//       available: 85,
//       stockValue: 32300,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p2",
//       name: "Astra",
//       productType: "Pesticide",
//       packSize: "100 ml",
//       available: 18,
//       stockValue: 10080,
//       lastUpdated: "02 Aug 2026",
//     },
//     {
//       id: "p3",
//       name: "Alpha",
//       productType: "Fertilizer",
//       packSize: "5 Kg",
//       available: 200,
//       stockValue: 220000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p4",
//       name: "Neutra",
//       productType: "Crop Nutrition",
//       packSize: "1 L",
//       available: 12,
//       stockValue: 8160,
//       lastUpdated: "01 Aug 2026",
//     },
//     {
//       id: "p5",
//       name: "Rootra",
//       productType: "Bio Product",
//       packSize: "500 ml",
//       available: 50,
//       stockValue: 26000,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p6",
//       name: "Ultra",
//       productType: "Fungicide",
//       packSize: "500 g",
//       available: 4,
//       stockValue: 2080,
//       lastUpdated: "28 Jul 2026",
//     },
//   ],
//   quarterly: [
//     {
//       id: "p0",
//       name: "Electra",
//       productType: "Crop Nutrition",
//       packSize: "500 ml",
//       available: 120,
//       stockValue: 54000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p1",
//       name: "Aalga",
//       productType: "Bio Product",
//       packSize: "250 ml",
//       available: 85,
//       stockValue: 32300,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p2",
//       name: "Astra",
//       productType: "Pesticide",
//       packSize: "100 ml",
//       available: 18,
//       stockValue: 10080,
//       lastUpdated: "02 Aug 2026",
//     },
//     {
//       id: "p3",
//       name: "Alpha",
//       productType: "Fertilizer",
//       packSize: "5 Kg",
//       available: 200,
//       stockValue: 220000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p4",
//       name: "Neutra",
//       productType: "Crop Nutrition",
//       packSize: "1 L",
//       available: 12,
//       stockValue: 8160,
//       lastUpdated: "01 Aug 2026",
//     },
//     {
//       id: "p5",
//       name: "Rootra",
//       productType: "Bio Product",
//       packSize: "500 ml",
//       available: 50,
//       stockValue: 26000,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p6",
//       name: "Ultra",
//       productType: "Fungicide",
//       packSize: "500 g",
//       available: 4,
//       stockValue: 2080,
//       lastUpdated: "20 Jul 2026",
//     },
//   ],
//   yearly: [
//     {
//       id: "p0",
//       name: "Electra",
//       productType: "Crop Nutrition",
//       packSize: "500 ml",
//       available: 120,
//       stockValue: 54000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p1",
//       name: "Aalga",
//       productType: "Bio Product",
//       packSize: "250 ml",
//       available: 85,
//       stockValue: 32300,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p2",
//       name: "Astra",
//       productType: "Pesticide",
//       packSize: "100 ml",
//       available: 18,
//       stockValue: 10080,
//       lastUpdated: "02 Aug 2026",
//     },
//     {
//       id: "p3",
//       name: "Alpha",
//       productType: "Fertilizer",
//       packSize: "5 Kg",
//       available: 200,
//       stockValue: 220000,
//       lastUpdated: "04 Aug 2026",
//     },
//     {
//       id: "p4",
//       name: "Neutra",
//       productType: "Crop Nutrition",
//       packSize: "1 L",
//       available: 12,
//       stockValue: 8160,
//       lastUpdated: "01 Aug 2026",
//     },
//     {
//       id: "p5",
//       name: "Rootra",
//       productType: "Bio Product",
//       packSize: "500 ml",
//       available: 50,
//       stockValue: 26000,
//       lastUpdated: "03 Aug 2026",
//     },
//     {
//       id: "p6",
//       name: "Ultra",
//       productType: "Fungicide",
//       packSize: "500 g",
//       available: 4,
//       stockValue: 2080,
//       lastUpdated: "15 Jul 2026",
//     },
//   ],
// };
const stockData: Record<DateFilter, StockRow[]> = {
  today: [
    {
      id: "p1",
      productType: "Pesticide",
      productName: "Electra",
      packSizes: [
        {
          packSize: "100 ml",
          batchNo: "ELE020826",
          expiryDate: "DEC 2026",
          lastSaleDate: "2026-08-05",
          availableStock: 125,
          stockInHand: 10,
          stockValue: 60000,
        },
        {
          packSize: "100 ml",
          batchNo: "ELE030826",
          expiryDate: "JAN 2027",
          lastSaleDate: "2026-06-20",
          availableStock: 145,
          stockInHand: 15,
          stockValue: 60000,
        },
        {
          packSize: "250 ml",
          batchNo: "ELE010826",
          expiryDate: "Aug 2026",
          lastSaleDate: "2026-08-02",
          availableStock: 85,
          stockInHand: 12,
          stockValue: 25000,
        },
        {
          packSize: "500 ml",
          batchNo: "ELE020826",
          expiryDate: "Jul 2028",
          lastSaleDate: "2026-05-25",

          availableStock: 50,
          stockInHand: 5,
          stockValue: 10000,
        },
        {
          packSize: "1 L",
          batchNo: "ELE020826",
          expiryDate: "Jul 2028",
          lastSaleDate: "2026-07-30",
          availableStock: 3,
          stockInHand: 1,
          stockValue: 20000,
        },
      ],
    },
    {
      id: "p2",
      productType: "Pesticide",
      productName: "Astra",
      packSizes: [
        {
          packSize: "100 ml",
          batchNo: "AST010826",
          expiryDate: "Sep 2028",
          lastSaleDate: "2026-07-25",

          availableStock: 40,
          stockInHand: 5,
          stockValue: 18000,
        },
        {
          packSize: "250 ml",
          batchNo: "AST010826",
          expiryDate: "Sep 2028",
          lastSaleDate: "2026-08-03",
          availableStock: 30,
          stockInHand: 4,
          stockValue: 22000,
        },
        {
          packSize: "500 ml",
          batchNo: "AST010826",
          expiryDate: "Aug 2028",
          lastSaleDate: "2026-06-10",
          availableStock: 2,
          stockInHand: 3,
          stockValue: 26000,
        },
        {
          packSize: "1 L",
          batchNo: "AST020826",
          expiryDate: "Aug 2028",
          lastSaleDate: "2026-08-01",
          availableStock: 10,
          stockInHand: 2,
          stockValue: 30000,
        },
        {
          packSize: "1 L",
          batchNo: "AST030826",
          expiryDate: "DEC 2026",
          lastSaleDate: "2026-06-28",
          availableStock: 19,
          stockInHand: 2,
          stockValue: 30000,
        },
      ],
    },
  ],

  weekly: [],
  monthly: [],
  quarterly: [],
  yearly: [],
};

export default function StoreDashboard({ storeId }: { storeId: string }) {
  const store = getStore(storeId);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const data = useMemo(() => kpiData[dateFilter], [dateFilter]);
  const rows = useMemo(() => stockData[dateFilter], [dateFilter]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const searchText = search.trim().toLowerCase();

        const matchesSearch =
          row.productName.toLowerCase().includes(searchText) ||
          row.productType.toLowerCase().includes(searchText) ||
          row.packSizes.some((pack) =>
            pack.packSize.toLowerCase().includes(searchText),
          );

        const matchesType =
          typeFilter === "all" || row.productType === typeFilter;

        return matchesSearch && matchesType;
      }),
    [rows, search, typeFilter],
  );

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (total, product) => {
          product.packSizes.forEach((pack) => {
            total.availableStock += pack.availableStock;
            total.stockInHand += pack.stockInHand;
            total.totalStock += pack.availableStock + pack.stockInHand;
            total.stockValue += pack.stockValue;
          });

          return total;
        },
        {
          availableStock: 0,
          stockInHand: 0,
          totalStock: 0,
          stockValue: 0,
        },
      ),
    [filteredRows],
  );

  if (!store) return <EmptyState icon="error" title="Store not found" />;

  return (
    <div>
      {/* Sticky date filter */}
      {/* <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 mb-10 bg-slate-50 border-b border-slate-200 shadow-sm">
        <div className="flex justify-end">
          <SegmentedDateFilter value={dateFilter} onChange={setDateFilter} />
        </div>
      </div> */}

      {/* ROW 1 — Business Overview */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
          Business Overview
        </h2>
        <p>Overall Store view</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 stagger">
          <StatCard
            label="Sales"
            value={formatCompact(data.sales)}
            icon="payments"
            color="brand"
            trend={data.trends.sales}
            trendUp
          />
          <StatCard
            label="Collection"
            value={formatCompact(data.collection)}
            icon="account_balance_wallet"
            color="blue"
            trend={data.trends.collection}
            trendUp
          />
          <StatCard
            label="Outstanding"
            value={formatCompact(data.outstanding)}
            icon="receipt_long"
            color="amber"
            trend={data.trends.outstanding}
            trendUp
          />
          <StatCard
            label="Farmers"
            value={String(data.farmers)}
            icon="groups"
            color="purple"
            trend={data.trends.farmers}
            trendUp
          />
          <StatCard
            label="Farms"
            value={String(data.farms)}
            icon="agriculture"
            color="brand"
            trend={data.trends.farms}
            trendUp
          />
          <StatCard
            label="Crops"
            value={String(data.crops)}
            icon="spa"
            color="blue"
            trend={data.trends.crops}
            trendUp
          />
        </div>
      </div>

      {/* ROW 2 — Executive Summary */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
          Executive Summary
        </h2>
        <div className="space-y-3">
          {(Object.keys(execNames) as ExecKey[]).map((key) => {
            const e = execData[key][dateFilter];
            return (
              <Card key={key} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${execColors[key]} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                  >
                    {initials(execNames[key])}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                      {execNames[key]}
                    </h3>
                    <p className="text-xs text-slate-400">Field Executive</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-8 gap-2">
                  <ExecField
                    icon="payments"
                    label="Sales"
                    value={formatCurrency(e.sales)}
                    color="text-brand-600"
                  />
                  <ExecField
                    icon="account_balance_wallet"
                    label="Collection"
                    value={formatCurrency(e.collection)}
                    color="text-blue-600"
                  />
                  <ExecField
                    icon="savings"
                    label="Cash in Hand"
                    value={formatCurrency(e.collectionInHand)}
                    color="text-emerald-600"
                  />
                  <ExecField
                    icon="receipt_long"
                    label="Outstanding"
                    value={formatCurrency(e.outstanding)}
                    color="text-amber-600"
                  />
                  <ExecField
                    icon="groups"
                    label="Farmers"
                    value={String(e.farmers)}
                  />
                  <ExecField
                    icon="agriculture"
                    label="Farms"
                    value={String(e.farms)}
                  />
                  <ExecField icon="spa" label="Crops" value={String(e.crops)} />
                  <ExecField
                    icon="receipt"
                    label="Bills"
                    value={String(e.bills)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ROW 3 — Product Stock Statement */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
          Product Stock Statement
        </h2>

        {/* Controls */}
        <Card className="p-4 mb-5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 max-w-md">
              <Input
                value={search}
                onChange={setSearch}
                placeholder="Search product..."
                icon="search"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-52">
                <Select
                  value={typeFilter}
                  onChange={setTypeFilter}
                  placeholder="All Product Types"
                  options={productCategories.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                />
              </div>
              <Button variant="secondary">
                <Icon name="download" size={18} /> Export to Excel
              </Button>
            </div>
          </div>
        </Card>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              warning
            </span>
            Store Stock ≤ 5
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              event_upcoming
            </span>
            Expiry within 1 month
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale for 30+ days
          </span>
        </div>

        {/* Excel-style table */}
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[12px] xl:text-sm">
              <thead className="sticky top-0">
                <tr className="bg-slate-100 text-slate-600 text-[10px] xl:text-xs uppercase tracking-wide border-b-2 border-slate-200">
                  <th className="w-[5%] px-1.5 py-3 text-center font-semibold border-r border-slate-200">
                    S.No
                  </th>
                  <th className="w-[11%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Product Type
                  </th>
                  <th className="w-[12%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Product Name
                  </th>
                  <th className="w-[8%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Pack Size
                  </th>
                  <th className="w-[12%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Batch No
                  </th>
                  <th className="w-[10%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Expiry Date
                  </th>
                  <th className="w-[10%] px-1.5 py-3 text-center font-semibold leading-tight border-r border-slate-200">
                    Store Stock
                  </th>
                  <th className="w-[9%] px-1.5 py-3 text-center font-semibold leading-tight border-r border-slate-200">
                    Hand Stock
                  </th>
                  <th className="w-[9%] px-1.5 py-3 text-center font-semibold leading-tight border-r border-slate-200">
                    Total Stock
                  </th>
                  <th className="w-[14%] px-2 py-3 text-right font-semibold">
                    Stock Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-10 text-slate-400"
                    >
                      No products match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.flatMap((product, productIndex) =>
                    product.packSizes.map((pack, packIndex) => {
                      const totalStock = pack.availableStock + pack.stockInHand;
                      const warnings = getStockWarnings(pack);

                      const rowWarningClass = warnings.expired
                        ? "bg-red-100/80"
                        : warnings.expiringSoon
                          ? "bg-amber-50"
                          : warnings.lowStock
                            ? "bg-red-50"
                            : warnings.noRecentSale
                              ? "bg-purple-50/60"
                              : productIndex % 2 === 0
                                ? "bg-white"
                                : "bg-slate-50/60";

                      return (
                        <tr
                          key={`${product.id}-${pack.packSize}-${pack.batchNo}`}
                          className={`border-b border-slate-100 ${rowWarningClass} hover:brightness-[0.98] transition-base`}
                        >
                          {packIndex === 0 && (
                            <>
                              <td
                                rowSpan={product.packSizes.length}
                                className="text-center px-1.5 py-2.5 border-r border-slate-100 text-slate-400 font-medium align-middle"
                              >
                                {productIndex + 1}
                              </td>

                              <td
                                rowSpan={product.packSizes.length}
                                className="px-2 py-2.5 border-r border-slate-100 text-slate-600 align-middle break-words"
                              >
                                {product.productType}
                              </td>

                              <td
                                rowSpan={product.packSizes.length}
                                className="px-2 py-2.5 border-r border-slate-100 font-semibold text-slate-700 align-middle break-words"
                              >
                                {product.productName}
                              </td>
                            </>
                          )}

                          <td className="px-2 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                            {pack.packSize}
                          </td>
                          <td
                            className="px-2 py-2.5 border-r border-slate-100 text-slate-600"
                            title={pack.batchNo}
                          >
                            <div className="flex min-w-0 items-center gap-1">
                              <span className="truncate">{pack.batchNo}</span>
                              {warnings.noRecentSale && (
                                <span
                                  className="material-symbols-rounded shrink-0 text-purple-600"
                                  style={{ fontSize: 15 }}
                                  title={`No sale for ${warnings.daysSinceSale} days`}
                                >
                                  history
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 border-r border-slate-100 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${
                                warnings.expired
                                  ? "bg-red-100 text-red-700"
                                  : warnings.expiringSoon
                                    ? "bg-amber-100 text-amber-700"
                                    : "text-slate-600"
                              }`}
                              title={
                                warnings.expired
                                  ? "Expired"
                                  : warnings.expiringSoon
                                    ? "Expiry within 1 month"
                                    : undefined
                              }
                            >
                              {(warnings.expired || warnings.expiringSoon) && (
                                <span
                                  className="material-symbols-rounded"
                                  style={{ fontSize: 14 }}
                                >
                                  {warnings.expired
                                    ? "error"
                                    : "event_upcoming"}
                                </span>
                              )}
                              {pack.expiryDate}
                            </span>
                          </td>
                          <td className="px-1.5 py-2.5 border-r border-slate-100 text-center tabular-nums font-semibold">
                            <span
                              className={`inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-0.5 ${
                                warnings.lowStock
                                  ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                                  : "text-slate-800"
                              }`}
                              title={
                                warnings.lowStock
                                  ? "Low stock warning"
                                  : undefined
                              }
                            >
                              {warnings.lowStock && (
                                <span
                                  className="material-symbols-rounded mr-0.5"
                                  style={{ fontSize: 13 }}
                                >
                                  warning
                                </span>
                              )}
                              {pack.availableStock}
                            </span>
                          </td>
                          <td className="px-1.5 py-2.5 border-r border-slate-100 text-center tabular-nums text-slate-700">
                            {pack.stockInHand}
                          </td>
                          <td className="px-1.5 py-2.5 border-r border-slate-100 text-center tabular-nums font-bold text-slate-800">
                            {totalStock}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                            {formatCurrency(pack.stockValue)}
                          </td>
                        </tr>
                      );
                    }),
                  )
                )}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-700 border-t-2 border-slate-200">
                    <td
                      colSpan={6}
                      className="px-2 py-3 text-right border-r border-slate-200"
                    >
                      Total
                    </td>
                    <td className="px-1.5 py-3 text-center tabular-nums border-r border-slate-200">
                      {totals.availableStock}
                    </td>
                    <td className="px-1.5 py-3 text-center tabular-nums border-r border-slate-200">
                      {totals.stockInHand}
                    </td>
                    <td className="px-1.5 py-3 text-center tabular-nums border-r border-slate-200">
                      {totals.totalStock}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(totals.stockValue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SegmentedDateFilter({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (v: DateFilter) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto max-w-full">
      {filterTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-base whitespace-nowrap ${
            value === tab.key
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ExecField({
  icon,
  label,
  value,
  color = "text-slate-800",
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50/70">
      <Icon name={icon} size={15} className="text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
          {label}
        </p>
        <p className={`text-sm font-bold leading-tight ${color} truncate`}>
          {value}
        </p>
      </div>
    </div>
  );
}
