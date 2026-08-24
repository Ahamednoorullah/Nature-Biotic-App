import { useMemo, useState } from "react";
import { productCategories } from "@/lib/data";
import { Card, Button, Input, Select, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

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
  unitPrice?: number;
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

  const totalStock = pack.availableStock + pack.stockInHand;

  return {
    lowStock: totalStock <= 5,
    expiringSoon: daysToExpiry >= 0 && daysToExpiry <= 92,
    expired: daysToExpiry < 0,
    noSale30: daysSinceSale >= 30,
    noSale60: daysSinceSale >= 60,
    noSale90: daysSinceSale >= 90,
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



export default function StoreInventory({ storeId }: { storeId: string }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Inventory is a current stock snapshot. Keep the same data/logic that
  // previously lived on the Store Dashboard.
  const rows = useMemo(() => stockData.today, [storeId]);

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

  return (
    <div>
      {/* ROW 3 — Stock Inventory */}
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
            Low Stock
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              event_upcoming
            </span>
            Expiry within 3 months
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale 30+ days
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale 60+ days
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale 90+ days
          </span>
        </div>

        {/* Excel-style table */}
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[12px] xl:text-sm">
              <thead className="sticky top-0">
                <tr className="bg-slate-100 text-slate-600 text-[10px] xl:text-xs uppercase tracking-wide border-b-2 border-slate-200">
                  <th className="w-[4%] px-1 py-3 text-center font-semibold border-r border-slate-200">
                    S.No
                  </th>
                  <th className="w-[9%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Product Type
                  </th>
                  <th className="w-[9%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Product Name
                  </th>
                  <th className="w-[7%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Pack Size
                  </th>
                  <th className="w-[9%] px-2 py-3 text-right font-semibold border-r border-slate-200">
                    Unit Price
                  </th>
                  <th className="w-[11%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Batch No
                  </th>
                  <th className="w-[11%] px-2 py-3 text-left font-semibold border-r border-slate-200">
                    Expiry Date
                  </th>
                  <th className="w-[9%] px-1.5 py-3 text-center font-semibold leading-tight border-r border-slate-200">
                    Store Stock
                  </th>
                  <th className="w-[8%] px-1.5 py-3 text-center font-semibold leading-tight border-r border-slate-200">
                    Hand Stock
                  </th>
                  <th className="w-[9%] px-1.5 py-3 text-center font-semibold leading-tight border-r border-slate-200">
                    Total Stock
                  </th>
                  <th className="w-[13%] px-2 py-3 text-right font-semibold">
                    Stock Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center py-10 text-slate-400"
                    >
                      No products match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.flatMap((product, productIndex) =>
                    product.packSizes.map((pack, packIndex) => {
                      const totalStock = pack.availableStock + pack.stockInHand;
                      const unitPrice =
                        pack.unitPrice ??
                        (totalStock > 0
                          ? Math.round(pack.stockValue / totalStock)
                          : 0);
                      const warnings = getStockWarnings(pack);

                      const rowWarningClass = warnings.expired
                        ? "bg-red-100/80"
                        : warnings.expiringSoon
                          ? "bg-amber-50"
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
                          <td className="px-2 py-2.5 border-r border-slate-100 text-right tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                            {formatCurrency(unitPrice)}
                          </td>
                          <td
                            className="px-2 py-2.5 border-r border-slate-100 text-slate-600 truncate"
                            title={pack.batchNo}
                          >
                            {pack.batchNo}
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
                                    ? "Expiry within 3 months"
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
                          <td className="px-1.5 py-2.5 border-r border-slate-100 text-center tabular-nums font-semibold text-slate-800">
                            {pack.availableStock}
                          </td>
                          <td className="px-1.5 py-2.5 border-r border-slate-100 text-center tabular-nums text-slate-700">
                            {pack.stockInHand}
                          </td>
                          <td className="px-1.5 py-2.5 border-r border-slate-100 text-center tabular-nums font-bold">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span
                                className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-md px-2 py-1 ${
                                  warnings.noSale90
                                    ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300"
                                    : warnings.noSale60
                                      ? "bg-orange-100 text-orange-800 ring-1 ring-orange-300"
                                      : warnings.noSale30
                                        ? "bg-purple-100 text-purple-800 ring-1 ring-purple-300"
                                        : "text-slate-800"
                                } ${
                                  warnings.lowStock ? "ring-2 ring-red-400" : ""
                                }`}
                                title={
                                  warnings.lowStock && warnings.noSale30
                                    ? `Low stock. No sale for ${warnings.daysSinceSale} days`
                                    : warnings.lowStock
                                      ? "Low total stock warning"
                                      : warnings.noSale30
                                        ? `No sale for ${warnings.daysSinceSale} days`
                                        : undefined
                                }
                              >
                                {warnings.lowStock && (
                                  <span
                                    className="material-symbols-rounded text-red-600"
                                    style={{ fontSize: 14 }}
                                  >
                                    warning
                                  </span>
                                )}
                                {warnings.noSale30 && (
                                  <span
                                    className="material-symbols-rounded"
                                    style={{ fontSize: 14 }}
                                  >
                                    history
                                  </span>
                                )}
                                {totalStock}
                              </span>

                              {warnings.noSale90 ? (
                                <span className="text-[9px] font-bold uppercase tracking-wide text-rose-700">
                                  90+ Days
                                </span>
                              ) : warnings.noSale60 ? (
                                <span className="text-[9px] font-bold uppercase tracking-wide text-orange-700">
                                  60+ Days
                                </span>
                              ) : warnings.noSale30 ? (
                                <span className="text-[9px] font-bold uppercase tracking-wide text-purple-700">
                                  30+ Days
                                </span>
                              ) : null}
                            </div>
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
                      colSpan={7}
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
