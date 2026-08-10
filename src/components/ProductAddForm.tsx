import { useMemo, useState } from "react";
import {
  Card,
  Button,
  Input,
  Select,
  SectionTitle,
  Icon,
} from "@/components/ui";

type PackingType = "Volume" | "Weight";

type ProductDetailRow = {
  id: number;
  size: string;
  sellingPrice: string;
  mrp: string;
  limitStock: string;
};

type FormState = {
  name: string;
  productType: string;
  productCategory: string;
  packingType: PackingType | "";
  hsnCode: string;
  gstRate: string;
  manufacturer: string;
  vendor: string;
  productPurpose: string;
  dosage: string;
  safetyColor: string;
};

const emptyForm: FormState = {
  name: "",
  productType: "",
  productCategory: "",
  packingType: "",
  hsnCode: "",
  gstRate: "",
  manufacturer: "Nature Biotic Pvt. Ltd.",
  vendor: "Nature Biotic Distribution",
  productPurpose: "",
  dosage: "",
  safetyColor: "",
};

const productTypeOptions = ["Powder", "Granules", "Gel", "Liquid"];

const productCategoryOptions = [
  "Bio-stimulant",
  "Pesticide",
  "Fungicide",
  "Nutrients (Fertilizer)",
  "Manenes",
];

const productPurposeOptions = [
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

const applicationMethodOptions = [
  "Foliar Spray",
  "Drenching",
  "Fertigation",
  "Broadcasting",
  "Drip Irrigation / Drip Application",
];

const safetyColorOptions = ["Green", "Red", "Orange", "White", "Blue"];

const volumeSizes = [
  "10 ml",
  "25 ml",
  "50 ml",
  "100 ml",
  "250 ml",
  "500 ml",
  "1 L",
  "2 L",
  "5 L",
  "10 L",
  "20 L",
  "25 L",
  "50 L",
];
const weightSizes = [
  "10 g",
  "25 g",
  "50 g",
  "100 g",
  "250 g",
  "500 g",
  "1 Kg",
  "2 Kg",
  "5 Kg",
  "10 Kg",
  "20 Kg",
  "25 Kg",
  "50 Kg",
];

export default function ProductAddForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [details, setDetails] = useState<ProductDetailRow[]>([
    { id: 1, size: "", sellingPrice: "", mrp: "", limitStock: "" },
  ]);
  const [applicationMethods, setApplicationMethods] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const sizeOptions = useMemo(() => {
    if (form.packingType === "Volume") return volumeSizes;
    if (form.packingType === "Weight") return weightSizes;
    return [];
  }, [form.packingType]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePackingTypeChange(value: string) {
    update("packingType", value as PackingType);
    setDetails([
      { id: Date.now(), size: "", sellingPrice: "", mrp: "", limitStock: "" },
    ]);
  }

  function updateDetail(
    id: number,
    key: keyof Omit<ProductDetailRow, "id">,
    value: string,
  ) {
    setDetails((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }

  function addDetailRow() {
    setDetails((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        size: "",
        sellingPrice: "",
        mrp: "",
        limitStock: "",
      },
    ]);
  }

  function removeDetailRow(id: number) {
    setDetails((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id),
    );
  }

  function toggleApplicationMethod(method: string) {
    setApplicationMethods((prev) =>
      prev.includes(method)
        ? prev.filter((item) => item !== method)
        : [...prev, method],
    );
  }

  function resetForm() {
    setForm(emptyForm);
    setDetails([
      { id: Date.now(), size: "", sellingPrice: "", mrp: "", limitStock: "" },
    ]);
    setApplicationMethods([]);
  }

  function showSaved(callback?: () => void) {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      callback?.();
    }, 900);
  }

  function handleSave() {
    showSaved(onSaved);
  }

  function handleSaveAndAdd() {
    showSaved(resetForm);
  }

  const generalValid =
    form.name &&
    form.productType &&
    form.productCategory &&
    form.packingType &&
    form.hsnCode &&
    form.gstRate;

  const productDetailsValid =
    details.length > 0 &&
    details.every(
      (row) =>
        row.size &&
        row.sellingPrice.trim() &&
        row.mrp.trim() &&
        row.limitStock.trim(),
    );

  const additionalDetailsValid =
    form.productPurpose &&
    form.dosage.trim() &&
    form.safetyColor &&
    applicationMethods.length > 0;

  const isFormValid = Boolean(
    generalValid && productDetailsValid && additionalDetailsValid,
  );

  return (
    <div className="mx-auto max-w-5xl">
      {saved && (
        <div className="fixed right-6 top-20 z-50 animate-scale-in">
          <div className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-white shadow-elevated">
            <Icon name="check_circle" size={20} fill />
            <span className="text-sm font-semibold">
              Product saved successfully!
            </span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <Card className="p-6">
          <SectionTitle
            icon="info"
            title="General Information"
            description="Enter the common details that apply to all pack sizes of this product."
          />

          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Product Image
            </label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-base hover:border-brand-400 hover:bg-brand-50/30">
                <div className="text-center">
                  <Icon
                    name="add_a_photo"
                    size={28}
                    className="text-slate-400"
                  />
                  <p className="mt-1 text-xs text-slate-400">Upload</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Upload a product image
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  PNG, JPG up to 2MB. Recommended 500 × 500px.
                </p>
                <Button variant="secondary" size="sm" className="mt-3">
                  <Icon name="upload" size={16} /> Choose File
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Product Name"
              value={form.name}
              onChange={(v) => update("name", v)}
              placeholder="e.g. Electra"
              icon="inventory_2"
              required
            />

            <Select
              label="Product Type"
              value={form.productType}
              onChange={(v) => update("productType", v)}
              placeholder="Select product type"
              options={productTypeOptions.map((item) => ({
                value: item,
                label: item,
              }))}
              required
            />

            <Select
              label="Product Category"
              value={form.productCategory}
              onChange={(v) => update("productCategory", v)}
              placeholder="Select product category"
              options={productCategoryOptions.map((item) => ({
                value: item,
                label: item,
              }))}
              required
            />

            <Select
              label="Packing Type"
              value={form.packingType}
              onChange={handlePackingTypeChange}
              placeholder="Select packing type"
              options={[
                { value: "Volume", label: "Volume (ml / Litre)" },
                { value: "Weight", label: "Weight (Gram / Kg)" },
              ]}
              required
            />

            <Input
              label="HSN / SAC Code"
              value={form.hsnCode}
              onChange={(v) => update("hsnCode", v)}
              placeholder="e.g. 380893"
              icon="qr_code"
              required
            />

            <Select
              label="GST Rate"
              value={form.gstRate}
              onChange={(v) => update("gstRate", v)}
              placeholder="Select GST rate"
              options={["5", "12", "18"].map((rate) => ({
                value: rate,
                label: `${rate}%`,
              }))}
              required
            />

            <Input
              label="Manufacturer Name"
              value={form.manufacturer}
              onChange={(v) => update("manufacturer", v)}
              placeholder="e.g. Nature Biotic Pvt. Ltd."
              icon="factory"
            />

            <Input
              label="Vendor Name"
              value={form.vendor}
              onChange={(v) => update("vendor", v)}
              placeholder="e.g. Nature Biotic Distribution"
              icon="local_shipping"
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionTitle
              icon="inventory_2"
              title="Product Details"
              description="Add one or more pack sizes with price and low-stock limit."
            />
            <Button
              onClick={addDetailRow}
              disabled={!form.packingType}
              className="shrink-0"
            >
              <Icon name="add" size={18} /> Add Size
            </Button>
          </div>

          {!form.packingType && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-600">
              <Icon name="info" size={18} />
              Select Packing Type first. Size options will load automatically.
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_48px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <div>Size</div>
              <div>Selling Price</div>
              <div>MRP</div>
              <div>Limit Stock</div>
              <div />
            </div>

            <div className="divide-y divide-slate-100">
              {details.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_1fr_1fr_1fr_48px] md:items-end md:gap-3"
                >
                  <Select
                    label={`Size ${index + 1}`}
                    value={row.size}
                    onChange={(v) => updateDetail(row.id, "size", v)}
                    placeholder={
                      form.packingType
                        ? "Select pack size"
                        : "Select packing type first"
                    }
                    options={sizeOptions.map((size) => ({
                      value: size,
                      label: size,
                    }))}
                    required
                  />

                  <Input
                    label="Selling Price"
                    type="number"
                    value={row.sellingPrice}
                    onChange={(v) => updateDetail(row.id, "sellingPrice", v)}
                    placeholder="0"
                    icon="currency_rupee"
                    required
                  />

                  <Input
                    label="MRP"
                    type="number"
                    value={row.mrp}
                    onChange={(v) => updateDetail(row.id, "mrp", v)}
                    placeholder="0"
                    icon="currency_rupee"
                    required
                  />

                  <Input
                    label="Limit Stock"
                    type="number"
                    value={row.limitStock}
                    onChange={(v) => updateDetail(row.id, "limitStock", v)}
                    placeholder="e.g. 5"
                    icon="warning"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => removeDetailRow(row.id)}
                    disabled={details.length === 1}
                    title="Remove size"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
                  >
                    <Icon name="delete" size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {details.length} pack size{details.length !== 1 ? "s" : ""} added
            </p>

            <button
              type="button"
              onClick={addDetailRow}
              disabled={!form.packingType}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <Icon name="add_circle" size={18} />
              Add another size
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            icon="description"
            title="Additional Details"
            description="Set product purpose, application methods, dosage and safety colour."
          />

          <div className="space-y-5">
            <Select
              label="Product Purpose"
              value={form.productPurpose}
              onChange={(v) => update("productPurpose", v)}
              placeholder="Select product purpose"
              options={productPurposeOptions.map((item) => ({
                value: item,
                label: item,
              }))}
              required
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Application Method <span className="text-red-500">*</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {applicationMethodOptions.map((method) => {
                  const checked = applicationMethods.includes(method);

                  return (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                        checked
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleApplicationMethod(method)}
                        className="h-4 w-4 accent-brand-600"
                      />
                      <span>{method}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Dosage"
                value={form.dosage}
                onChange={(v) => update("dosage", v)}
                placeholder="e.g. 2 ml / Litre or 500 ml / acre"
                icon="science"
                required
              />

              <Select
                label="Safety Information"
                value={form.safetyColor}
                onChange={(v) => update("safetyColor", v)}
                placeholder="Select safety colour"
                options={safetyColorOptions.map((color) => ({
                  value: color,
                  label: color,
                }))}
                required
              />
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3 pb-6 pt-2 sm:flex-row">
          <Button variant="secondary" onClick={onCancel} className="sm:mr-auto">
            <Icon name="close" size={18} /> Cancel
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              onClick={handleSaveAndAdd}
              disabled={!isFormValid}
            >
              <Icon name="add" size={18} /> Save & Add Another
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid}>
              <Icon name="save" size={18} /> Save Product
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
