import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getProductsByStore,
  getStorePurchasesFromCompanySales,
  getAcceptedStoreDeliveryQty,
  getFROStockByExecutive,
  getFROStockTxns,
  productCategories,
} from "@/lib/data";
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

type WarningPopupType =
  | "low-stock"
  | "expiry"
  | "no-sale-30"
  | "no-sale-60"
  | "no-sale-90";

type WarningDetailRow = {
  id: string;
  productType: string;
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  lastSaleDate: string;
  daysSinceSale: number;
  availableStock: number;
  stockInHand: number;
  totalStock: number;
  stockValue: number;
  unitPrice: number;
};

export default function StoreInventory({ storeId }: { storeId: string }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warningPopup, setWarningPopup] = useState<WarningPopupType | null>(
    null,
  );
  const [handStockPopup, setHandStockPopup] = useState<{
    productId: string;
    productName: string;
    packSize: string;
    batchNo: string;
    expiryDate: string;
  } | null>(null);

  const [inventoryVersion, setInventoryVersion] = useState(0);

  // Refresh when Purchase / Stock Delivery / FRO acceptance changes.
  useEffect(() => {
    const refresh = () => setInventoryVersion((v) => v + 1);
    window.addEventListener("company-store-sales-updated", refresh);
    window.addEventListener("fro-accepted-deliveries-updated", refresh);
    window.addEventListener("nature-biotic-store-inventory-updated", refresh);
    window.addEventListener("fro-stock-updated", refresh);
    window.addEventListener("nature-biotic-delivery-challan-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("company-store-sales-updated", refresh);
      window.removeEventListener("fro-accepted-deliveries-updated", refresh);
      window.removeEventListener(
        "nature-biotic-store-inventory-updated",
        refresh,
      );
      window.removeEventListener("fro-stock-updated", refresh);
      window.removeEventListener(
        "nature-biotic-delivery-challan-updated",
        refresh,
      );
      window.removeEventListener("focus", refresh);
    };
  }, [storeId]);

  // Build the inventory from the store's actual purchase records.
  // A Stock Delivery is deducted only from the accepted-delivery ledger.
  const rows = useMemo<StockRow[]>(() => {
    const products = getProductsByStore(storeId);
    const purchases = getStorePurchasesFromCompanySales(storeId);
    const productByName = new Map(
      products.map((product: any) => [
        String(product.name).trim().toLowerCase(),
        product,
      ]),
    );

    type Group = {
      productId: string;
      productType: string;
      productName: string;
      packSize: string;
      batchNo: string;
      expiryDate: string;
      quantity: number;
      unitPrice: number;
      lastSaleDate: string;
    };

    const grouped = new Map<string, Group>();

    purchases.forEach((purchase: any) => {
      const productName = String(purchase.product ?? "").trim();
      if (!productName) return;

      const product =
        (purchase.productId
          ? products.find(
              (p: any) => String(p.id) === String(purchase.productId),
            )
          : undefined) ?? productByName.get(productName.toLowerCase());

      if (!product) return;

      const productId = String(product.id);
      const packSize = String(
        purchase.packSize ??
          purchase.pkgsize ??
          purchase.size ??
          product.size ??
          "",
      ).trim();
      if (!packSize) return;

      const batchNo =
        String(purchase.batchNo ?? purchase.batchId ?? "").trim() || "-";
      const expiryDate =
        String(
          purchase.expiryDate ?? purchase.expDate ?? purchase.expiry ?? "",
        ).trim() || "-";
      const quantity = Math.max(
        0,
        Number(purchase.quantity ?? purchase.qty ?? 0),
      );
      if (quantity <= 0) return;

      const unitPrice = Number(
        purchase.unitPrice ??
          purchase.rate ??
          purchase.price ??
          product.sellingPrice ??
          0,
      );
      const key = [
        productId,
        packSize.toLowerCase(),
        batchNo.toLowerCase(),
        expiryDate,
      ].join("::");
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += quantity;
        existing.unitPrice = existing.unitPrice || unitPrice;
        if (String(purchase.date || "") > existing.lastSaleDate) {
          existing.lastSaleDate = String(purchase.date || "");
        }
      } else {
        grouped.set(key, {
          productId,
          productType: String(
            product.productType ?? product.productCategory ?? "-",
          ),
          productName,
          packSize,
          batchNo,
          expiryDate,
          quantity,
          unitPrice,
          lastSaleDate: String(purchase.date || ""),
        });
      }
    });

    const byProduct = new Map<string, StockRow>();

    grouped.forEach((group) => {
      const acceptedQty = getAcceptedStoreDeliveryQty(
        storeId,
        group.productId,
        group.packSize,
        group.batchNo,
      );
      const storeQty = Math.max(0, group.quantity - acceptedQty);
      if (storeQty <= 0 && acceptedQty <= 0) return;

      const productKey = group.productId;
      const productRow = byProduct.get(productKey) ?? {
        id: productKey,
        productType: group.productType,
        productName: group.productName,
        packSizes: [],
      };

      const totalQty = storeQty + acceptedQty;
      productRow.packSizes.push({
        packSize: group.packSize,
        batchNo: group.batchNo,
        expiryDate: group.expiryDate,
        lastSaleDate: group.lastSaleDate || "-",
        availableStock: storeQty,
        stockInHand: acceptedQty,
        stockValue: totalQty * group.unitPrice,
        unitPrice: group.unitPrice,
      });
      byProduct.set(productKey, productRow);
    });

    return Array.from(byProduct.values());
  }, [storeId, inventoryVersion]);

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

  const warningDetails = useMemo<WarningDetailRow[]>(() => {
    if (!warningPopup) return [];

    return rows.flatMap((product) =>
      product.packSizes.flatMap((pack) => {
        const warnings = getStockWarnings(pack);
        const totalStock = pack.availableStock + pack.stockInHand;
        const unitPrice =
          pack.unitPrice ??
          (totalStock > 0 ? Math.round(pack.stockValue / totalStock) : 0);

        const matches =
          warningPopup === "low-stock"
            ? warnings.lowStock
            : warningPopup === "expiry"
              ? warnings.expiringSoon || warnings.expired
              : warningPopup === "no-sale-30"
                ? warnings.noSale30
                : warningPopup === "no-sale-60"
                  ? warnings.noSale60
                  : warnings.noSale90;

        if (!matches) return [];

        return [
          {
            id: `${product.id}-${pack.packSize}-${pack.batchNo}`,
            productType: product.productType,
            productName: product.productName,
            packSize: pack.packSize,
            batchNo: pack.batchNo,
            expiryDate: pack.expiryDate,
            lastSaleDate: pack.lastSaleDate,
            daysSinceSale: warnings.daysSinceSale,
            availableStock: pack.availableStock,
            stockInHand: pack.stockInHand,
            totalStock,
            stockValue: pack.stockValue,
            unitPrice,
          },
        ];
      }),
    );
  }, [rows, warningPopup]);

  const warningPopupConfig = warningPopup
    ? {
        "low-stock": {
          title: "Low Stock Details",
          subtitle: "Products with total stock of 5 or below.",
          icon: "warning",
        },
        expiry: {
          title: "Expiry Details",
          subtitle: "Expired products and products expiring within 3 months.",
          icon: "event_upcoming",
        },
        "no-sale-30": {
          title: "No Sale 30+ Days",
          subtitle: "Products with no sales for 30 days or more.",
          icon: "history",
        },
        "no-sale-60": {
          title: "No Sale 60+ Days",
          subtitle: "Products with no sales for 60 days or more.",
          icon: "history",
        },
        "no-sale-90": {
          title: "No Sale 90+ Days",
          subtitle: "Products with no sales for 90 days or more.",
          icon: "history",
        },
      }[warningPopup]
    : null;

  const handStockDetails = useMemo(() => {
    if (!handStockPopup) return [];

    const executives = Array.from(
      new Set(
        getFROStockTxns(storeId)
          .map((txn: any) => String(txn.executiveName || "").trim())
          .filter(Boolean),
      ),
    );

    return executives
      .map((executiveName) => {
        const row = getFROStockByExecutive(storeId, executiveName).find(
          (stock: any) =>
            String(stock.productId || "") === handStockPopup.productId &&
            String(stock.packSize || "")
              .trim()
              .toLowerCase() === handStockPopup.packSize.trim().toLowerCase() &&
            String(stock.batchNo || "")
              .trim()
              .toLowerCase() === handStockPopup.batchNo.trim().toLowerCase(),
        );

        return {
          executiveName,
          quantity: Number(row?.currentQty || 0),
        };
      })
      .filter((row) => row.quantity > 0);
  }, [storeId, handStockPopup, inventoryVersion]);

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to download the PDF.");
      return;
    }

    const rowsForPdf = filteredRows
      .flatMap((product, productIndex) =>
        product.packSizes.map((pack, packIndex) => {
          const totalStock = pack.availableStock + pack.stockInHand;
          const unitPrice =
            pack.unitPrice ??
            (totalStock > 0 ? Math.round(pack.stockValue / totalStock) : 0);

          return `
          <tr>
            <td>${packIndex === 0 ? productIndex + 1 : ""}</td>
            <td>${packIndex === 0 ? product.productType : ""}</td>
            <td>${packIndex === 0 ? product.productName : ""}</td>
            <td>${pack.packSize}</td>
            <td class="right">${formatCurrency(unitPrice)}</td>
            <td>${pack.batchNo}</td>
            <td>${pack.expiryDate}</td>
            <td class="center">${pack.availableStock}</td>
            <td class="center">${pack.stockInHand}</td>
            <td class="center">${totalStock}</td>
            <td class="right">${formatCurrency(pack.stockValue)}</td>
          </tr>
        `;
        }),
      )
      .join("");

    const generatedDate = new Date().toLocaleDateString("en-IN");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Store Inventory Report</title>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              margin: 24px;
              color: #1e293b;
              font-size: 11px;
            }
            h1 {
              margin: 0 0 4px;
              font-size: 20px;
              color: #14532d;
            }
            .subtitle {
              color: #64748b;
              margin-bottom: 18px;
            }
            .summary {
              display: flex;
              gap: 10px;
              margin-bottom: 16px;
            }
            .summary-box {
              border: 1px solid #dbe3ea;
              border-radius: 6px;
              padding: 8px 12px;
              min-width: 110px;
            }
            .summary-label {
              color: #64748b;
              font-size: 9px;
            }
            .summary-value {
              font-size: 14px;
              font-weight: 700;
              margin-top: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th {
              background: #e2e8f0;
              color: #334155;
              font-size: 9px;
              text-transform: uppercase;
              padding: 7px 5px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 6px 5px;
              border: 1px solid #e2e8f0;
              vertical-align: middle;
              word-break: break-word;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            tfoot td {
              background: #f1f5f9;
              font-weight: 700;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
          </style>
        </head>
        <body>
          <h1>Store Inventory Report</h1>
          <div class="subtitle">Generated on ${generatedDate}</div>

          <div class="summary">
            <div class="summary-box">
              <div class="summary-label">Store Stock</div>
              <div class="summary-value">${totals.availableStock}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Hand Stock</div>
              <div class="summary-value">${totals.stockInHand}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Total Stock</div>
              <div class="summary-value">${totals.totalStock}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Stock Value</div>
              <div class="summary-value">${formatCurrency(totals.stockValue)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:4%">S.No</th>
                <th style="width:10%">Product Type</th>
                <th style="width:12%">Product Name</th>
                <th style="width:8%">Pack Size</th>
                <th style="width:9%">Unit Price</th>
                <th style="width:11%">Batch No</th>
                <th style="width:11%">Expiry Date</th>
                <th style="width:8%">Store Stock</th>
                <th style="width:8%">Hand Stock</th>
                <th style="width:8%">Total Stock</th>
                <th style="width:11%">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              ${rowsForPdf}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7" class="right">Total</td>
                <td class="center">${totals.availableStock}</td>
                <td class="center">${totals.stockInHand}</td>
                <td class="center">${totals.totalStock}</td>
                <td class="right">${formatCurrency(totals.stockValue)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

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
              <Button variant="secondary" onClick={exportToPDF}>
                <Icon name="download" size={18} /> Export PDF
              </Button>
            </div>
          </div>
        </Card>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setWarningPopup("low-stock")}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700 transition hover:bg-red-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              warning
            </span>
            Low Stock
          </button>
          <button
            type="button"
            onClick={() => setWarningPopup("expiry")}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700 transition hover:bg-amber-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              event_upcoming
            </span>
            Expiry within 3 months
          </button>
          <button
            type="button"
            onClick={() => setWarningPopup("no-sale-30")}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-700 transition hover:bg-purple-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale 30+ days
          </button>
          <button
            type="button"
            onClick={() => setWarningPopup("no-sale-60")}
            className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700 transition hover:bg-orange-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale 60+ days
          </button>
          <button
            type="button"
            onClick={() => setWarningPopup("no-sale-90")}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700 transition hover:bg-rose-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              history
            </span>
            No sale 90+ days
          </button>
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
                            <button
                              type="button"
                              onClick={() =>
                                pack.stockInHand > 0 &&
                                setHandStockPopup({
                                  productId: product.id,
                                  productName: product.productName,
                                  packSize: pack.packSize,
                                  batchNo: pack.batchNo,
                                  expiryDate: pack.expiryDate,
                                })
                              }
                              disabled={pack.stockInHand <= 0}
                              className={`font-semibold ${
                                pack.stockInHand > 0
                                  ? "cursor-pointer text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-900"
                                  : "cursor-default text-slate-400"
                              }`}
                              title={
                                pack.stockInHand > 0
                                  ? "View FRO-wise hand stock"
                                  : "No FRO hand stock"
                              }
                            >
                              {pack.stockInHand}
                            </button>
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

      {handStockPopup &&
        createPortal(
          <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[82vh] w-[94vw] max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    FRO Hand Stock
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {handStockPopup.productName} · {handStockPopup.packSize} ·
                    Batch {handStockPopup.batchNo}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Expiry: {handStockPopup.expiryDate}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHandStockPopup(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="border-b border-slate-200 px-6 py-3">
                <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Total with FROs</span>
                  <span className="font-bold text-brand-700">
                    {handStockDetails.reduce(
                      (sum, row) => sum + row.quantity,
                      0,
                    )}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr className="border-b border-slate-200">
                      <th className="w-[15%] border-r border-slate-200 px-3 py-3 text-center">
                        S.No
                      </th>
                      <th className="border-r border-slate-200 px-3 py-3 text-left">
                        FRO Name
                      </th>
                      <th className="w-[25%] px-3 py-3 text-center">
                        Hand Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {handStockDetails.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-10 text-center text-slate-400"
                        >
                          No FRO stock found for this product.
                        </td>
                      </tr>
                    ) : (
                      handStockDetails.map((row, index) => (
                        <tr
                          key={row.executiveName}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="border-r border-slate-100 px-3 py-3 text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td className="border-r border-slate-100 px-3 py-3 font-semibold text-slate-800">
                            {row.executiveName}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-brand-700">
                            {row.quantity}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {handStockDetails.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-800">
                        <td colSpan={2} className="px-3 py-3 text-right">
                          Total
                        </td>
                        <td className="px-3 py-3 text-center text-brand-700">
                          {handStockDetails.reduce(
                            (sum, row) => sum + row.quantity,
                            0,
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setHandStockPopup(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {warningPopup &&
        warningPopupConfig &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex h-[78vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon name={warningPopupConfig.icon} size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {warningPopupConfig.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {warningPopupConfig.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setWarningPopup(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="border-b border-slate-200 px-6 py-3">
                <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Total Records</span>
                  <span className="font-bold text-slate-800">
                    {warningDetails.length}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1050px] table-fixed border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr className="border-b border-slate-200">
                      <th className="w-[5%] border-r border-slate-200 px-2 py-3 text-center">
                        S.No
                      </th>
                      <th className="w-[12%] border-r border-slate-200 px-3 py-3 text-left">
                        Product Type
                      </th>
                      <th className="w-[13%] border-r border-slate-200 px-3 py-3 text-left">
                        Product
                      </th>
                      <th className="w-[9%] border-r border-slate-200 px-2 py-3 text-center">
                        Pack Size
                      </th>
                      <th className="w-[11%] border-r border-slate-200 px-2 py-3 text-left">
                        Batch No
                      </th>
                      <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                        Expiry
                      </th>
                      <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                        Last Sale
                      </th>
                      <th className="w-[8%] border-r border-slate-200 px-2 py-3 text-center">
                        Store
                      </th>
                      <th className="w-[8%] border-r border-slate-200 px-2 py-3 text-center">
                        Hand
                      </th>
                      <th className="w-[8%] border-r border-slate-200 px-2 py-3 text-center">
                        Total
                      </th>
                      <th className="w-[12%] px-3 py-3 text-right">
                        Stock Value
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {warningDetails.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          No matching stock warning records.
                        </td>
                      </tr>
                    ) : (
                      warningDetails.map((item, index) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-500">
                            {index + 1}
                          </td>
                          <td className="border-r border-slate-100 px-3 py-3 text-slate-600">
                            {item.productType}
                          </td>
                          <td className="border-r border-slate-100 px-3 py-3 font-semibold text-slate-800">
                            {item.productName}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-center">
                            {item.packSize}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-slate-600">
                            {item.batchNo}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-center">
                            {item.expiryDate}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-center">
                            <div className="font-medium text-slate-700">
                              {item.lastSaleDate || "-"}
                            </div>
                            {item.daysSinceSale > 0 && (
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {item.daysSinceSale} days ago
                              </div>
                            )}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">
                            {item.availableStock}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-center">
                            {item.stockInHand}
                          </td>
                          <td className="border-r border-slate-100 px-2 py-3 text-center font-bold text-slate-800">
                            {item.totalStock}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-700">
                            {formatCurrency(item.stockValue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setWarningPopup(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
