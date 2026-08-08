import { useState, useMemo } from "react";
import {
  getLowStockProducts,
  getStockStatus,
  warehouseList,
  type Product,
  type StockStatus,
} from "@/lib/data";
import { useNav } from "@/context/NavContext";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  EmptyState,
  StatCard,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate, initials } from "@/lib/format";

const colorMap: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  teal: "from-teal-400 to-teal-600",
  red: "from-red-400 to-red-600",
  amber: "from-amber-400 to-amber-600",
  blue: "from-blue-400 to-blue-600",
  purple: "from-purple-400 to-purple-600",
};

const statusColor: Record<StockStatus, "green" | "amber" | "red"> = {
  Healthy: "green",
  "Low Stock": "amber",
  "Out of Stock": "red",
};

export default function StoreLowStock({ storeId }: { storeId: string }) {
  const { goStorePage, goProductDetail } = useNav();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const lowStockProducts = useMemo(
    () => getLowStockProducts(storeId),
    [storeId],
  );

  const filtered = useMemo(
    () =>
      lowStockProducts.filter((p) => {
        const ms = p.name.toLowerCase().includes(search.toLowerCase());
        const mw = warehouseFilter === "all" || p.warehouse === warehouseFilter;
        return ms && mw;
      }),
    [lowStockProducts, search, warehouseFilter],
  );

  const lowCount = lowStockProducts.filter((p) => p.stock > 0).length;
  const outCount = lowStockProducts.filter((p) => p.stock === 0).length;
  const restockValue = lowStockProducts.reduce(
    (s, p) => s + (p.minStock - p.stock) * p.purchasePrice,
    0,
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Low Stock Products
            </h1>
            <Badge color="amber">
              <Icon name="warning" size={14} />
              {lowStockProducts.length}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Products below minimum stock level need attention.
          </p>
        </div>
        <Button onClick={() => goStorePage("add-stock")}>
          <Icon name="add" size={20} fill /> Restock All
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Low Stock Products"
          value={String(lowCount)}
          icon="warning"
          color="amber"
        />
        <StatCard
          label="Out of Stock"
          value={String(outCount)}
          icon="error"
          color="red"
        />
        <StatCard
          label="Estimated Restock Value"
          value={formatCurrency(restockValue)}
          icon="payments"
          color="brand"
        />
      </div>

      {/* Toolbar */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search products..."
              icon="search"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select
              value={warehouseFilter}
              onChange={setWarehouseFilter}
              placeholder="All Warehouses"
              options={warehouseList.map((w) => ({ value: w, label: w }))}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="check_circle"
            title="No low stock products"
            description="All products are above their minimum stock levels."
            action={
              <Button onClick={() => goStorePage("stock-management")}>
                <Icon name="arrow_back" size={18} /> Back to Stock Management
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold px-5 py-3.5">
                    Product
                  </th>
                  <th className="text-left font-semibold px-5 py-3.5">
                    Category
                  </th>
                  <th className="text-right font-semibold px-5 py-3.5">
                    Current
                  </th>
                  <th className="text-right font-semibold px-5 py-3.5">
                    Minimum
                  </th>
                  <th className="text-right font-semibold px-5 py-3.5">
                    Shortfall
                  </th>
                  <th className="text-left font-semibold px-5 py-3.5">
                    Warehouse
                  </th>
                  <th className="text-center font-semibold px-5 py-3.5">
                    Status
                  </th>
                  <th className="text-center font-semibold px-5 py-3.5">
                    Quick Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const status = getStockStatus(p);
                  const shortfall = p.minStock - p.stock;
                  const isOut = p.stock === 0;
                  return (
                    <tr
                      key={p.id}
                      className={`transition-base ${isOut ? "bg-red-50/40" : "bg-amber-50/30"} hover:bg-amber-50/60`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorMap[p.imageColor] ?? "from-slate-400 to-slate-600"} flex items-center justify-center text-white font-bold text-xs shrink-0`}
                          >
                            {initials(p.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {p.name}
                            </p>
                            <p className="text-xs text-slate-400">{p.size}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {p.productCategory}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`font-bold ${isOut ? "text-red-500" : "text-amber-600"}`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500">
                        {p.minStock}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-bold text-red-500">
                          {shortfall}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">
                        {p.warehouse}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge color={statusColor[status]}>
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "currentColor" }}
                          />
                          {status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => goStorePage("add-stock")}
                            className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base"
                            title="Restock"
                          >
                            <Icon name="add_box" size={18} />
                          </button>
                          <button
                            onClick={() => goStorePage("stock-adjustment")}
                            className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-base"
                            title="Transfer Stock"
                          >
                            <Icon name="sync_alt" size={18} />
                          </button>
                          <button
                            onClick={() => goProductDetail(p.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-base"
                            title="View Product"
                          >
                            <Icon name="visibility" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
