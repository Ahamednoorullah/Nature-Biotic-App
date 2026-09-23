import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getBillsByStore,
  getProductsByStore,
  getStorePurchasesFromCompanySales,
  productCategories,
  type CompanyStoreSaleRecord,
} from "@/lib/data";
import { Card, Button, Input, Select, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

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

function buildInventoryRows(
  storeId: string,
  purchases: CompanyStoreSaleRecord[],
): StockRow[] {
  const products = getProductsByStore(storeId);
  const bills = getBillsByStore(storeId);

  const productTypeByName = new Map(
    products.map((product) => [
      product.name.trim().toLowerCase(),
      product.productCategory || "Product",
    ]),
  );

  // Keep the latest sale date for each product. The current Bill model does
  // not contain batch/pack information, so sales are used only for the
  // product-level "Last Sale" warning.
  const lastSaleByProduct = new Map<string, string>();

  bills.forEach((bill) => {
    bill.items.forEach((item) => {
      const key = item.name.trim().toLowerCase();
      const existing = lastSaleByProduct.get(key);
      if (!existing || bill.billDate > existing) {
        lastSaleByProduct.set(key, bill.billDate);
      }
    });
  });

  // One inventory row is created for each Product + Pack Size + Batch.
  // Quantity comes only from the store purchase records, so products that
  // were never purchased by this store do not appear here.
  const grouped = new Map<
    string,
    {
      id: string;
      productType: string;
      productName: string;
      packSize: string;
      batchNo: string;
      expiryDate: string;
      quantity: number;
      stockValue: number;
      unitPrice: number;
      lastSaleDate: string;
    }
  >();

  purchases.forEach((purchase) => {
    const productName = String(purchase.product || "").trim();
    if (!productName) return;

    const packSize = String(purchase.packSize || purchase.pkgsize || "").trim();

    const batchNo = String(purchase.batchNo || "").trim();
    const expiryDate = String(purchase.expiryDate || "").trim();

    const quantity = Math.max(0, Number(purchase.quantity || 0));
    if (quantity <= 0) return;

    const unitPrice = Number(
      purchase.unitPrice ?? purchase.rate ?? purchase.price ?? 0,
    );

    const key = [
      productName.toLowerCase(),
      packSize.toLowerCase(),
      batchNo.toLowerCase(),
    ].join("::");

    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += quantity;
      existing.stockValue += quantity * unitPrice;

      if ((!existing.expiryDate || existing.expiryDate === "-") && expiryDate) {
        existing.expiryDate = expiryDate;
      }

      if ((!existing.batchNo || existing.batchNo === "-") && batchNo) {
        existing.batchNo = batchNo;
      }

      if (unitPrice > 0) {
        existing.unitPrice =
          existing.quantity > 0
            ? Math.round(existing.stockValue / existing.quantity)
            : unitPrice;
      }
    } else {
      grouped.set(key, {
        id: `${purchase.id}-${productName}-${packSize}-${batchNo}`,
        productType:
          productTypeByName.get(productName.toLowerCase()) || "Product",
        productName,
        packSize: packSize || "-",
        batchNo: batchNo || "-",
        expiryDate: expiryDate || "-",
        quantity,
        stockValue: quantity * unitPrice,
        unitPrice,
        lastSaleDate: lastSaleByProduct.get(productName.toLowerCase()) || "",
      });
    }
  });

  const productMap = new Map<string, StockRow>();

  Array.from(grouped.values())
    .sort((a, b) => {
      const productCompare = a.productName.localeCompare(b.productName);
      if (productCompare !== 0) return productCompare;

      const packCompare = a.packSize.localeCompare(b.packSize);
      if (packCompare !== 0) return packCompare;

      return a.batchNo.localeCompare(b.batchNo);
    })
    .forEach((item) => {
      const productKey = item.productName.toLowerCase();

      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          id: `inventory-${productKey}`,
          productType: item.productType,
          productName: item.productName,
          packSizes: [],
        });
      }

      productMap.get(productKey)!.packSizes.push({
        packSize: item.packSize,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        lastSaleDate: item.lastSaleDate,
        availableStock: item.quantity,
        // Purchased stock starts in the store. Hand Stock is increased later
        // by the FRO stock/hand-over flow.
        stockInHand: 0,
        stockValue: Math.round(item.stockValue),
        unitPrice: item.unitPrice > 0 ? Math.round(item.unitPrice) : undefined,
      });
    });

  return Array.from(productMap.values());
}

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
  const [purchases, setPurchases] = useState<CompanyStoreSaleRecord[]>(() =>
    getStorePurchasesFromCompanySales(storeId),
  );

  useEffect(() => {
    const refresh = () => {
      setPurchases(getStorePurchasesFromCompanySales(storeId));
    };

    refresh();

    window.addEventListener("company-store-sales-updated", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("company-store-sales-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [storeId]);

  // Inventory is now built only from the purchases made by this store.
  const rows = useMemo(
    () => buildInventoryRows(storeId, purchases),
    [storeId, purchases],
  );

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
