import type { Product } from "@/lib/data";
import { Card, Badge, Button, Icon, SectionTitle } from "@/components/ui";
import { formatCurrency, initials } from "@/lib/format";

const colorMap: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  teal: "from-teal-400 to-teal-600",
  red: "from-red-400 to-red-600",
  amber: "from-amber-400 to-amber-600",
  blue: "from-blue-400 to-blue-600",
  purple: "from-purple-400 to-purple-600",
};

export default function CompanyProductDetail({
  product,
  onBack,
}: {
  product: Product;
  onBack: () => void;
}) {
  const masterProduct = product as Product & {
    productImage?: string;
    applicationMethods?: string[];
    dosage?: number;
    dosageUnit?: string;
    filler?: number;
    fillerUnit?: string;
    fillerType?: "Water" | "NA" | "";
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl p-2 text-slate-500 transition-base hover:bg-slate-100"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 22 }}>
            arrow_back
          </span>
        </button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            {product.name}
          </h1>
          <p className="mt-1 text-slate-500">Product master details</p>
        </div>
      </div>

      <Card className="mb-6 p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          {masterProduct.productImage ? (
            <img
              src={masterProduct.productImage}
              alt={product.name}
              className="h-20 w-20 shrink-0 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div
              className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${
                colorMap[product.imageColor] ??
                "from-slate-400 to-slate-600"
              } text-xl font-bold text-white`}
            >
              {initials(product.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">
                {product.name}
              </h2>
              <Badge color="blue">{product.productCategory}</Badge>
            </div>

            <p className="text-sm text-slate-500">
              {product.manufacturer}
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              {product.vendor}
            </p>
          </div>

          <Button variant="secondary" size="sm">
            <Icon name="edit" size={16} />
            Edit
          </Button>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <SectionTitle
          icon="info"
          title="General Information"
          description="Core product master information."
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <DetailField label="Product Name" value={product.name} />
          <DetailField
            label="Product Type"
            value={product.productType}
          />
          <DetailField
            label="Product Category"
            value={product.productCategory}
          />
          <DetailField
            label="Product Purpose"
            value={product.purpose}
          />
          <DetailField
            label="Packing Type"
            value={product.unit}
          />
          <DetailField
            label="HSN / SAC Code"
            value={product.hsnCode}
          />
          <DetailField
            label="Manufacturer"
            value={product.manufacturer}
          />
          <DetailField
            label="Vendor"
            value={product.vendor}
          />
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <SectionTitle
          icon="description"
          title="Application / Dosage"
          description="Application method, dosage and filler information."
        />

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Application Method
            </p>

            {masterProduct.applicationMethods?.length ? (
              <div className="flex flex-wrap gap-2">
                {masterProduct.applicationMethods.map((method) => (
                  <span
                    key={method}
                    className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700"
                  >
                    {method}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500">-</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <DetailField
              label="Dosage"
              value={
                masterProduct.dosage !== undefined
                  ? `${masterProduct.dosage} ${masterProduct.dosageUnit || ""}`.trim()
                  : "-"
              }
            />

            <DetailField
              label="Filler Type"
              value={masterProduct.fillerType || "-"}
            />

            <DetailField
              label="Filler"
              value={
                masterProduct.fillerType === "NA"
                  ? "NA"
                  : masterProduct.filler !== undefined
                    ? `${masterProduct.filler} ${masterProduct.fillerUnit || ""}`.trim()
                    : "-"
              }
            />
          </div>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <SectionTitle
          icon="inventory_2"
          title="Product Details"
          description="Pack size and pricing details."
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <DetailField label="Pack Size" value={product.size} />
          <DetailField
            label="Purchase Price"
            value={formatCurrency(product.purchasePrice)}
          />
          <DetailField
            label="Selling Price"
            value={formatCurrency(product.sellingPrice)}
          />
          <DetailField
            label="MRP"
            value={formatCurrency(product.mrp)}
          />
          <DetailField
            label="GST Rate"
            value={`${product.taxPercentage}%`}
          />
          <DetailField
            label="Low Stock Limit"
            value={String(product.minStock)}
          />
        </div>
      </Card>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm font-bold text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}
