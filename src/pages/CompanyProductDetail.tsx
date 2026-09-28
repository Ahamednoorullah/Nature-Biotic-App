import type { Product } from "@/lib/data";
import { Card, Badge, Button, Icon, SectionTitle } from "@/components/ui";
import { formatCurrency, initials } from "@/lib/format";
import { useState, useEffect } from "react";

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
  onSave,
}: {
  product: Product;
  onBack: () => void;
  onSave?: (updated: Product) => void;
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

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...masterProduct });

  const startEdit = () => {
    setFormData({ ...masterProduct });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setFormData({ ...masterProduct });
    setIsEditing(false);
  };

  const saveEdit = () => {
    onSave?.(formData);
    setIsEditing(false);
  };

  const update = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
  if (!isEditing) {
    setFormData({ ...masterProduct });
  }
}, [product]);


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

          {isEditing ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit}>
              <Icon name="close" size={16} />
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={saveEdit}>
              <Icon name="check" size={16} />
              Save
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={startEdit}>
            <Icon name="edit" size={16} />
            Edit
          </Button>
        )}
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <SectionTitle
          icon="info"
          title="General Information"
          description="Core product master information."
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <DetailField
            label="Product Name"
            value={formData.name}
            editing={isEditing}
            onChange={(v) => update("name", v)}
          />
          <DetailField
            label="Product Type"
            value={formData.productType}
            editing={isEditing}
            onChange={(v) => update("productType", v)}
          />
          <DetailField
            label="Product Category"
            value={formData.productCategory}
            editing={isEditing}
            onChange={(v) => update("productCategory", v)}
          />
          <DetailField
            label="Product Purpose"
            value={formData.purpose}
            editing={isEditing}
            onChange={(v) => update("purpose", v)}
          />
          <DetailField
            label="Packing Type"
            value={formData.unit}
            editing={isEditing}
            onChange={(v) => update("unit", v)}
          />
          <DetailField
            label="HSN / SAC Code"
            value={formData.hsnCode}
            editing={isEditing}
            onChange={(v) => update("hsnCode", v)}
          />
          <DetailField
            label="Manufacturer"
            value={formData.manufacturer}
            editing={isEditing}
            onChange={(v) => update("manufacturer", v)}
          />
          <DetailField
            label="Vendor"
            value={formData.vendor}
            editing={isEditing}
            onChange={(v) => update("vendor", v)}
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
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dosage
            </p>
            {isEditing ? (
              <div className="mt-1.5 flex gap-1">
                <input
                  type="number"
                  className="w-2/3 rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                  value={formData.dosage ?? ""}
                  onChange={(e) => update("dosage", e.target.value === "" ? undefined : Number(e.target.value))}
                />
                <input
                  type="text"
                  className="w-1/3 rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                  value={formData.dosageUnit || ""}
                  onChange={(e) => update("dosageUnit", e.target.value)}
                  placeholder="unit"
                />
              </div>
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">
                {masterProduct.dosage !== undefined
                  ? `${masterProduct.dosage} ${masterProduct.dosageUnit || ""}`.trim()
                  : "-"}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filler Type
            </p>
            {isEditing ? (
              <select
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                value={formData.fillerType || ""}
                onChange={(e) => update("fillerType", e.target.value)}
              >
                <option value="">-</option>
                <option value="Water">Water</option>
                <option value="NA">NA</option>
              </select>
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">
                {masterProduct.fillerType || "-"}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filler
            </p>
            {isEditing ? (
              formData.fillerType === "NA" ? (
                <p className="mt-1.5 text-sm font-bold text-slate-800">NA</p>
              ) : (
                <div className="mt-1.5 flex gap-1">
                  <input
                    type="number"
                    className="w-2/3 rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                    value={formData.filler ?? ""}
                    onChange={(e) => update("filler", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                  <input
                    type="text"
                    className="w-1/3 rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                    value={formData.fillerUnit || ""}
                    onChange={(e) => update("fillerUnit", e.target.value)}
                    placeholder="unit"
                  />
                </div>
              )
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">
                {masterProduct.fillerType === "NA"
                  ? "NA"
                  : masterProduct.filler !== undefined
                    ? `${masterProduct.filler} ${masterProduct.fillerUnit || ""}`.trim()
                    : "-"}
              </p>
            )}
          </div>
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
          <DetailField
            label="Pack Size"
            value={formData.size}
            editing={isEditing}
            onChange={(v) => update("size", v)}
          />
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Purchase Price
            </p>
            {isEditing ? (
              <input
                type="number"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                value={formData.purchasePrice ?? ""}
                onChange={(e) => update("purchasePrice", e.target.value === "" ? undefined : Number(e.target.value))}
              />
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">{formatCurrency(product.purchasePrice)}</p>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Selling Price
            </p>
            {isEditing ? (
              <input
                type="number"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                value={formData.sellingPrice ?? ""}
                onChange={(e) => update("sellingPrice", e.target.value === "" ? undefined : Number(e.target.value))}
              />
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">{formatCurrency(product.sellingPrice)}</p>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              MRP
            </p>
            {isEditing ? (
              <input
                type="number"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                value={formData.mrp ?? ""}
                onChange={(e) => update("mrp", e.target.value === "" ? undefined : Number(e.target.value))}
              />
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">{formatCurrency(product.mrp)}</p>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              GST Rate
            </p>
            {isEditing ? (
              <input
                type="number"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                value={formData.taxPercentage ?? ""}
                onChange={(e) => update("taxPercentage", e.target.value === "" ? undefined : Number(e.target.value))}
              />
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">{product.taxPercentage}%</p>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Low Stock Limit
            </p>
            {isEditing ? (
              <input
                type="number"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
                value={formData.minStock ?? ""}
                onChange={(e) => update("minStock", e.target.value === "" ? undefined : Number(e.target.value))}
              />
            ) : (
              <p className="mt-1.5 text-sm font-bold text-slate-800">{product.minStock}</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function DetailField({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {editing ? (
        <input
          type="text"
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-800"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <p className="mt-1.5 break-words text-sm font-bold text-slate-800">
          {value || "-"}
        </p>
      )}
    </div>
  );
}
