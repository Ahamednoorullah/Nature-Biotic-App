import { useState, useMemo } from "react";
import {
  products as allProducts,
  productTypes,
  type Product,
} from "@/lib/data";
import { Card, Button, Input, Select, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, initials } from "@/lib/format";
import ProductAddForm from "@/components/ProductAddForm";
import ProductDetail from "@/pages/CompanyProductDetail";

const colorMap: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  teal: "from-teal-400 to-teal-600",
  red: "from-red-400 to-red-600",
  amber: "from-amber-400 to-amber-600",
  blue: "from-blue-400 to-blue-600",
  purple: "from-purple-400 to-purple-600",
};

export default function CompanyProducts() {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [products, setProducts] = useState<Product[]>(allProducts);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const ms =
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
          p.hsnCode.toLowerCase().includes(search.toLowerCase());
        const mt = typeFilter === "all" || p.productType === typeFilter;
        return ms && mt;
      }),
    [products, search, typeFilter],
  );

  const groupedProducts = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        productType: string;
        hsnCode: string;
        imageColor: string;
        variants: Product[];
      }
    >();

    filtered.forEach((product) => {
      const normalizedName = product.name
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      const key = `${product.productType.toLowerCase()}__${normalizedName}__${product.hsnCode}`;

      const existing = groups.get(key);
      if (existing) {
        existing.variants.push(product);
      } else {
        groups.set(key, {
          key,
          name: product.name,
          productType: product.productType,
          hsnCode: product.hsnCode,
          imageColor: product.imageColor,
          variants: [product],
        });
      }
    });

    const sizeValue = (size: string) => {
      const s = size.trim().toLowerCase();
      const n = Number.parseFloat(s) || 0;
      if (s.includes("kg")) return n * 1000000;
      if (s.includes("g")) return n * 1000;
      if (s.includes("l")) return n * 1000;
      return n;
    };

    return Array.from(groups.values()).map((group) => {
      const existingVariants = [...group.variants].sort(
        (a, b) => sizeValue(a.size) - sizeValue(b.size),
      );

      // If the source data contains only one row for a product,
      // expand it into the common pack sizes for this UI preview.
      if (existingVariants.length === 1) {
        const base = existingVariants[0];
        const isSolid =
          base.size.toLowerCase().includes("kg") ||
          base.size.toLowerCase().includes(" g");

        const packSizes = isSolid
          ? ["100 g", "250 g", "500 g", "1 Kg"]
          : ["100 ml", "250 ml", "500 ml", "1 L"];

        const priceFactors = [0.28, 0.55, 1, 1.85];

        return {
          ...group,
          variants: packSizes.map((size, index) => {
            const isOriginalSize =
              size.trim().toLowerCase() === base.size.trim().toLowerCase();

            return {
              ...base,
              id: `${base.id}-${size.replace(/\s+/g, "-").toLowerCase()}`,
              size,
              sellingPrice: isOriginalSize
                ? base.sellingPrice
                : Math.round(base.sellingPrice * priceFactors[index]),
              mrp: isOriginalSize
                ? base.mrp
                : Math.round(base.mrp * priceFactors[index]),
            };
          }),
        };
      }

      return {
        ...group,
        variants: existingVariants,
      };
    });
  }, [filtered]);

  function handleSaved() {
    setShowAdd(false);
  }

  if (showAdd) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setShowAdd(false)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>
              arrow_back
            </span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Add New Product
            </h1>
            <p className="text-slate-500 mt-1">
              Create a new Nature Biotic product master entry.
            </p>
          </div>
        </div>
        <ProductAddForm
          onCancel={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  if (selected) {
    return (
      <ProductDetail product={selected} onBack={() => setSelected(null)} />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Products
          </h1>
          <p className="text-slate-500 mt-1">
            Product master — saved details auto-load during sales entry.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={20} fill /> Add Product
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 max-w-md">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search products by name, manufacturer, HSN..."
              icon="search"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-52">
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="All Product Types"
                options={productTypes.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <Button variant="secondary">
              <Icon name="filter_alt" size={18} /> Filter
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-slate-500 font-medium">
            Showing{" "}
            <span className="font-bold text-slate-700">{filtered.length}</span>{" "}
            of {products.length} products
          </p>
          {(search || typeFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
              }}
              className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
            >
              <Icon name="filter_alt_off" size={16} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Product table */}
      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="inventory_2"
            title="No products found"
            description="Try adjusting your search or filters, or add a new product to the master."
            action={
              <Button onClick={() => setShowAdd(true)}>
                <Icon name="add" size={20} fill /> Add Product
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[12px] xl:text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 xl:text-xs">
                  <th className="w-[8%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                    Image
                  </th>
                  <th className="w-[14%] border-r border-slate-200 px-2 py-3 text-left font-semibold">
                    Product Type
                  </th>
                  <th className="w-[17%] border-r border-slate-200 px-2 py-3 text-left font-semibold">
                    Product Name
                  </th>
                  <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-left font-semibold">
                    HSN / SAC
                  </th>
                  <th className="w-[11%] border-r border-slate-200 px-2 py-3 text-left font-semibold">
                    Pack Size
                  </th>
                  <th className="w-[14%] border-r border-slate-200 px-2 py-3 text-right font-semibold">
                    Selling Price
                  </th>
                  <th className="w-[13%] border-r border-slate-200 px-2 py-3 text-right font-semibold">
                    MRP
                  </th>
                  <th className="w-[11%] px-2 py-3 text-center font-semibold">
                    Tax %
                  </th>
                </tr>
              </thead>

              <tbody>
                {groupedProducts.flatMap((group, groupIndex) =>
                  group.variants.map((variant, variantIndex) => (
                    <tr
                      key={variant.id}
                      onClick={() => setSelected(variant)}
                      className={`cursor-pointer border-b border-slate-100 transition-base hover:bg-brand-50/40 ${
                        groupIndex % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      }`}
                    >
                      {variantIndex === 0 && (
                        <>
                          <td
                            rowSpan={group.variants.length}
                            className="border-r border-slate-100 px-2 py-3 text-center align-middle"
                          >
                            <div
                              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${
                                colorMap[group.imageColor] ??
                                "from-slate-400 to-slate-600"
                              } text-sm font-bold text-white`}
                            >
                              {initials(group.name)}
                            </div>
                          </td>

                          <td
                            rowSpan={group.variants.length}
                            className="border-r border-slate-100 px-2 py-3 align-middle text-slate-600 break-words"
                          >
                            {group.productType}
                          </td>

                          <td
                            rowSpan={group.variants.length}
                            className="border-r border-slate-100 px-2 py-3 align-middle font-semibold text-slate-800 break-words"
                          >
                            {group.name}
                          </td>

                          <td
                            rowSpan={group.variants.length}
                            className="border-r border-slate-100 px-2 py-3 align-middle font-mono text-xs text-slate-600"
                          >
                            {group.hsnCode}
                          </td>
                        </>
                      )}

                      <td className="whitespace-nowrap border-r border-slate-100 px-2 py-3 text-slate-600">
                        {variant.size}
                      </td>

                      <td className="whitespace-nowrap border-r border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                        {formatCurrency(variant.sellingPrice)}
                      </td>

                      <td className="whitespace-nowrap border-r border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                        {formatCurrency(variant.mrp)}
                      </td>

                      <td className="px-2 py-3 text-center font-semibold tabular-nums text-slate-600">
                        {variant.taxPercentage}%
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
