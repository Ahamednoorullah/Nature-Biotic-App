import { useState } from "react";
import {
  getProductById,
  getMovementsByProduct,
  getStockStatus,
  getStorePurchasesFromCompanySales,
  isStorePurchaseReceived,
  type Product,
  type StockMovement,
} from "@/lib/data";
import { useNav } from "@/context/NavContext";
import { Card, Badge, Button, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, formatDate, initials } from "@/lib/format";

type Tab = "overview" | "movement" | "purchase" | "sales";

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "movement", label: "Stock Movement", icon: "sync_alt" },
  { key: "purchase", label: "Purchase History", icon: "shopping_cart" },
  { key: "sales", label: "Sales History", icon: "point_of_sale" },
];

const colorMap: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  teal: "from-teal-400 to-teal-600",
  red: "from-red-400 to-red-600",
  amber: "from-amber-400 to-amber-600",
  blue: "from-blue-400 to-blue-600",
  purple: "from-purple-400 to-purple-600",
};

const movementColor: Record<string, string> = {
  IN: "text-brand-600 bg-brand-50",
  OUT: "text-blue-600 bg-blue-50",
  TRANSFER: "text-purple-600 bg-purple-50",
  ADJUSTMENT: "text-amber-600 bg-amber-50",
};

export default function StoreInventoryDetail({
  storeId,
  productId,
}: {
  storeId: string;
  productId: string;
}) {
  const { goStorePage } = useNav();
  const [tab, setTab] = useState<Tab>("overview");
  const product = getProductById(productId);

  if (!product) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="inventory_2"
          title="Product not found"
          description="This product may have been removed from inventory."
          action={
            <Button onClick={() => goStorePage("stock-management")}>
              <Icon name="arrow_back" size={18} /> Back to Stock Management
            </Button>
          }
        />
      </Card>
    );
  }

  const status = getStockStatus(product);
  const availableQty = product.stock - product.reservedStock;
  const stockValue = product.stock * product.sellingPrice;
  const movements = getMovementsByProduct(productId);

  return (
    <div>
      <button
        onClick={() => goStorePage("stock-management")}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium text-sm mb-4 transition-base"
      >
        <Icon name="arrow_back" size={18} /> Back to Stock Management
      </button>

      {/* Header */}
      <Card className="p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${colorMap[product.imageColor] ?? "from-slate-400 to-slate-600"} flex items-center justify-center text-white font-bold text-2xl shrink-0 mx-auto sm:mx-0`}
          >
            {initials(product.name)}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {product.name}
            </h1>
            <p className="text-slate-500 mt-1">
              {product.productCategory} · {product.manufacturer}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Icon name="warehouse" size={16} />
                {product.warehouse}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="update" size={16} />
                {formatDate(product.lastUpdated)}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <Badge
              color={
                status === "Healthy"
                  ? "green"
                  : status === "Low Stock"
                    ? "amber"
                    : "red"
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "currentColor" }}
              />
              {status}
            </Badge>
          </div>
        </div>

        {/* Stock metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400 font-medium">Current Stock</p>
            <p className="text-xl font-bold text-slate-800 mt-1">
              {product.stock}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Available Qty</p>
            <p className="text-xl font-bold text-brand-600 mt-1">
              {availableQty}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Reserved Qty</p>
            <p className="text-xl font-bold text-amber-600 mt-1">
              {product.reservedStock}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Stock Value</p>
            <p className="text-xl font-bold text-slate-800 mt-1">
              {formatCurrency(stockValue)}
            </p>
          </div>
        </div>

        {/* Min/Max levels */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Icon
              name="arrow_circle_down"
              size={18}
              className="text-slate-400"
            />
            <div>
              <p className="text-xs text-slate-400 font-medium">Min Level</p>
              <p className="text-sm font-bold text-slate-600">
                {product.minStock}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="arrow_circle_up" size={18} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Max Level</p>
              <p className="text-sm font-bold text-slate-600">
                {product.maxStock}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="warehouse" size={18} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Warehouse</p>
              <p className="text-sm font-bold text-slate-600 truncate">
                {product.warehouse}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="inventory" size={18} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Pack Size</p>
              <p className="text-sm font-bold text-slate-600">{product.size}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-base ${
              tab === t.key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon name={t.icon} size={18} fill={tab === t.key} /> {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === "overview" && <OverviewTab product={product} />}
        {tab === "movement" && <MovementTab movements={movements} />}
        {tab === "purchase" && (
          <PurchaseHistoryTab storeId={storeId} product={product} />
        )}
        {tab === "sales" && (
          <SalesHistoryTab storeId={storeId} product={product} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ product }: { product: Product }) {
  const items = [
    {
      icon: "inventory_2",
      label: "Product Type",
      value: product.productCategory,
    },
    { icon: "factory", label: "Manufacturer", value: product.manufacturer },
    { icon: "local_shipping", label: "Vendor", value: product.vendor },
    { icon: "qr_code", label: "HSN Code", value: product.hsnCode },
    { icon: "straighten", label: "Unit", value: product.unit },
    { icon: "inventory", label: "Pack Size", value: product.size },
    {
      icon: "currency_rupee",
      label: "Purchase Price",
      value: formatCurrency(product.purchasePrice),
    },
    {
      icon: "sell",
      label: "Selling Price",
      value: formatCurrency(product.sellingPrice),
    },
    { icon: "price_check", label: "MRP", value: formatCurrency(product.mrp) },
    {
      icon: "receipt_long",
      label: "Tax",
      value: `${product.taxPercentage}% (${product.taxType})`,
    },
  ];
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-4">Product Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon name={item.icon} size={18} className="text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            <div className="p-4 rounded-xl bg-slate-50">
              <p className="text-xs text-slate-400 font-semibold mb-1">
                Description
              </p>
              <p className="text-sm text-slate-600">{product.description}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-600 font-semibold mb-1 flex items-center gap-1">
                <Icon name="warning" size={14} /> Safety Info
              </p>
              <p className="text-sm text-slate-600">{product.safetyInfo}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 font-semibold mb-1 flex items-center gap-1">
                <Icon name="warehouse" size={14} /> Storage Info
              </p>
              <p className="text-sm text-slate-600">{product.storageInfo}</p>
            </div>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Total Sold</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {product.sold}{" "}
            <span className="text-sm font-medium text-slate-400">units</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Stock Value</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">
            {formatCurrency(product.stock * product.sellingPrice)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 font-medium">Profit Margin</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {Math.round(
              ((product.sellingPrice - product.purchasePrice) /
                product.sellingPrice) *
                100,
            )}
            %
          </p>
        </Card>
      </div>
    </div>
  );
}

function MovementTab({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="sync_alt"
          title="No stock movements"
          description="No movements recorded for this product."
        />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">
                Movement Date
              </th>
              <th className="text-left font-semibold px-5 py-3.5">Type</th>
              <th className="text-left font-semibold px-5 py-3.5">
                Reference No.
              </th>
              <th className="text-right font-semibold px-5 py-3.5">Quantity</th>
              <th className="text-right font-semibold px-5 py-3.5">
                Balance Stock
              </th>
              <th className="text-left font-semibold px-5 py-3.5">
                Handled By
              </th>
              <th className="text-left font-semibold px-5 py-3.5">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/50 transition-base">
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(m.date)}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${movementColor[m.type]}`}
                  >
                    {m.type}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-semibold text-brand-600">
                  {m.referenceNo}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-700">
                  {m.type === "IN" ? "+" : m.type === "OUT" ? "-" : ""}
                  {m.quantity}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {m.balanceStock}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{m.handledBy}</td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">
                  {m.remarks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PurchaseHistoryTab({
  storeId,
  product,
}: {
  storeId: string;
  product: Product;
}) {
  const productName = product.name.trim().toLowerCase();
  const purchases = getStorePurchasesFromCompanySales(storeId)
    .filter(
      (row) =>
        isStorePurchaseReceived(row.invoiceNo) &&
        String(row.product || "").trim().toLowerCase() === productName,
    )
    .map((row) => ({
      poNo: row.invoiceNo,
      date: row.date,
      supplier: "Nature Biotic",
      qty: Number(row.quantity || 0),
      rate: Number(row.rate || 0),
      amount: Number(row.total || 0),
    }));
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">PO Number</th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Supplier</th>
              <th className="text-right font-semibold px-5 py-3.5">Quantity</th>
              <th className="text-right font-semibold px-5 py-3.5">Rate</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((p) => (
              <tr key={p.poNo} className="hover:bg-slate-50/50 transition-base">
                <td className="px-5 py-3.5 font-semibold text-brand-600">
                  {p.poNo}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(p.date)}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{p.supplier}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-slate-700">
                  {p.qty}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {formatCurrency(p.rate)}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                  {formatCurrency(p.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SalesHistoryTab({
  storeId,
  product,
}: {
  storeId: string;
  product: Product;
}) {
  const productName = product.name.trim().toLowerCase();
  let sales: {
    invoiceNo: string;
    date: string;
    customer: string;
    qty: number;
    amount: number;
    status: string;
  }[] = [];
  try {
    const raw = localStorage.getItem(
      `nature-biotic-store-sales-invoices-v2:${storeId}`,
    );
    const rows = raw ? JSON.parse(raw) : [];
    if (Array.isArray(rows)) {
      sales = rows.flatMap((row) => {
        const lines = Array.isArray(row?.products) ? row.products : [];
        return lines
          .filter((line: { productId?: string; productName?: string; name?: string }) => {
            const lineName = String(line.productName || line.name || "")
              .trim()
              .toLowerCase();
            return line.productId === product.id || lineName === productName;
          })
          .map((line: { quantity?: number; qty?: number; amount?: number; lineTotal?: number }) => ({
            invoiceNo: String(row.invoiceNo || ""),
            date: String(row.date || ""),
            customer: String(row.partyName || ""),
            qty: Number(line.quantity || line.qty || 0),
            amount: Number(line.amount || line.lineTotal || 0),
            status: "Saved",
          }));
      });
    }
  } catch {
    sales = [];
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">
                Invoice No.
              </th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Customer</th>
              <th className="text-right font-semibold px-5 py-3.5">Quantity</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
              <th className="text-center font-semibold px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((s) => (
              <tr
                key={s.invoiceNo}
                className="hover:bg-slate-50/50 transition-base"
              >
                <td className="px-5 py-3.5 font-semibold text-brand-600">
                  {s.invoiceNo}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(s.date)}
                </td>
                <td className="px-5 py-3.5 text-slate-700 font-medium">
                  {s.customer}
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-slate-700">
                  {s.qty}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                  {formatCurrency(s.amount)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Badge color={s.status === "Paid" ? "green" : "amber"}>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "currentColor" }}
                    />
                    {s.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
