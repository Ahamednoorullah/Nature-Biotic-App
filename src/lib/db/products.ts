import type { Product } from "@/lib/data";
import { adoptDatabaseProducts } from "@/lib/data";
import { db, requireUserId, throwIfError } from "@/lib/db/client";
import { DbError } from "@/lib/db/errors";

type PartyKind = "manufacturer" | "vendor";

type PartyRow = { id: string; kind: string; name: string };
type ProductRow = {
  id: string;
  name: string;
  product_category: Product["productCategory"];
  product_type: Product["productType"];
  purpose: Product["purpose"];
  unit: Product["unit"];
  hsn_code: string;
  manufacturer_id: string | null;
  vendor_id: string | null;
  tax_type: string;
  tax_percent: number | string;
  description: string | null;
  usage_instructions: string | null;
  safety_info: string | null;
  storage_info: string | null;
  application_methods: string[] | null;
  dosage: string | null;
  dosage_unit: string | null;
  filler: string | null;
  filler_unit: string | null;
  filler_type: string | null;
  status: string;
};
type VariantRow = {
  id: string;
  product_id: string;
  pack_size: string;
  purchase_price: number | string;
  selling_price: number | string;
  mrp: number | string;
  min_stock: number | string;
  status: string;
};

function titleTax(value: string): Product["taxType"] {
  return value === "interstate" ? "Interstate" : "Intrastate";
}

function uiStatus(value: string): Product["status"] {
  return value === "inactive" ? "Inactive" : "Active";
}

function dbStatus(value: string) {
  return value.trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

function groupKey(row: Pick<Product, "productCategory" | "name" | "hsnCode">) {
  return `${row.productCategory}|${row.name.trim().toLowerCase()}|${row.hsnCode.trim()}`;
}

function toProduct(
  product: ProductRow,
  variant: VariantRow,
  parties: Map<string, PartyRow>,
): Product {
  const tax = Number(product.tax_percent || 0);
  const interstate = product.tax_type === "interstate";
  return {
    id: variant.id,
    storeId: "catalog",
    name: product.name,
    purpose: product.purpose,
    productCategory: product.product_category,
    productType: product.product_type,
    manufacturer: parties.get(product.manufacturer_id || "")?.name || "",
    vendor: parties.get(product.vendor_id || "")?.name || "",
    unit: product.unit,
    size: variant.pack_size,
    hsnCode: product.hsn_code,
    purchasePrice: Number(variant.purchase_price || 0),
    sellingPrice: Number(variant.selling_price || 0),
    mrp: Number(variant.mrp || 0),
    taxType: titleTax(product.tax_type),
    taxPercentage: tax,
    sgst: interstate ? 0 : tax / 2,
    cgst: interstate ? 0 : tax / 2,
    igst: interstate ? tax : 0,
    description: product.description || "",
    usageInstructions: product.usage_instructions || "",
    safetyInfo: product.safety_info || "",
    storageInfo: product.storage_info || "",
    stock: 0,
    minStock: Number(variant.min_stock || 0),
    maxStock: 0,
    reservedStock: 0,
    warehouse: "",
    lastUpdated: new Date().toISOString().slice(0, 10),
    status: uiStatus(variant.status || product.status),
    sold: 0,
    imageColor: "emerald",
    applicationMethods: product.application_methods || [],
    dosage: Number(product.dosage || 0),
    dosageUnit: product.dosage_unit || "",
    filler: Number(product.filler || 0),
    fillerUnit: product.filler_unit || "",
    fillerType: (product.filler_type || "") as Product["fillerType"],
  };
}

export async function loadCatalog() {
  await requireUserId();
  const client = db();
  const [partiesResult, productsResult, variantsResult] = await Promise.all([
    client.from("product_parties").select("id, kind, name"),
    client
      .from("products")
      .select(
        "id, name, product_category, product_type, purpose, unit, hsn_code, manufacturer_id, vendor_id, tax_type, tax_percent, description, usage_instructions, safety_info, storage_info, application_methods, dosage, dosage_unit, filler, filler_unit, filler_type, status",
      ),
    client
      .from("product_variants")
      .select(
        "id, product_id, pack_size, purchase_price, selling_price, mrp, min_stock, status",
      ),
  ]);
  throwIfError(partiesResult.error, "Could not load product parties.");
  throwIfError(productsResult.error, "Could not load products.");
  throwIfError(variantsResult.error, "Could not load product variants.");

  const parties = new Map(
    ((partiesResult.data || []) as PartyRow[]).map((row) => [row.id, row]),
  );
  const products = new Map(
    ((productsResult.data || []) as ProductRow[]).map((row) => [row.id, row]),
  );
  const rows = ((variantsResult.data || []) as VariantRow[]).flatMap((variant) => {
    const product = products.get(variant.product_id);
    return product ? [toProduct(product, variant, parties)] : [];
  });
  const manufacturers = ((partiesResult.data || []) as PartyRow[])
    .filter((row) => row.kind === "manufacturer")
    .map((row) => row.name);
  const vendors = ((partiesResult.data || []) as PartyRow[])
    .filter((row) => row.kind === "vendor")
    .map((row) => row.name);
  adoptDatabaseProducts(rows, { manufacturers, vendors });
  return rows;
}

async function ensureParty(kind: PartyKind, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const client = db();
  const existing = await client
    .from("product_parties")
    .select("id, name")
    .eq("kind", kind);
  throwIfError(existing.error, "Could not read product parties.");
  const found = ((existing.data || []) as { id: string; name: string }[]).find(
    (row) => row.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (found) return found.id;
  const inserted = await client
    .from("product_parties")
    .insert({ kind, name: trimmed })
    .select("id")
    .single();
  throwIfError(inserted.error, "Could not save the product party.");
  const partyId = inserted.data?.id;
  if (!partyId) throw new DbError("Could not save the product party.");
  return partyId;
}

export async function createCatalogProducts(rows: Product[]) {
  if (!rows.length) throw new DbError("Add at least one pack size.");
  await requireUserId();
  const header = rows[0];
  const manufacturerId = await ensureParty("manufacturer", header.manufacturer);
  const vendorId = await ensureParty("vendor", header.vendor);
  const client = db();
  const existing = await client
    .from("products")
    .select("id")
    .eq("product_category", header.productCategory)
    .eq("hsn_code", header.hsnCode.trim())
    .ilike("name", header.name.trim());
  throwIfError(existing.error, "Could not check existing products.");
  const matches = (existing.data || []) as { id: string }[];
  if (matches.length > 1) {
    throw new DbError(
      "More than one product matches this category, name, and HSN.",
    );
  }

  let productId = matches[0]?.id;
  const payload = {
    name: header.name.trim(),
    product_category: header.productCategory,
    product_type: header.productType,
    purpose: header.purpose,
    unit: header.unit,
    hsn_code: header.hsnCode.trim(),
    manufacturer_id: manufacturerId,
    vendor_id: vendorId,
    tax_type: header.taxType.toLowerCase() === "interstate" ? "interstate" : "intrastate",
    tax_percent: Number(header.taxPercentage || 0),
    description: header.description || null,
    usage_instructions: header.usageInstructions || null,
    safety_info: header.safetyInfo || null,
    storage_info: header.storageInfo || null,
    application_methods: header.applicationMethods || [],
    dosage: header.dosage ? String(header.dosage) : null,
    dosage_unit: header.dosageUnit || null,
    filler: header.filler ? String(header.filler) : null,
    filler_unit: header.fillerUnit || null,
    filler_type: header.fillerType || null,
    status: dbStatus(header.status),
  };

  if (!productId) {
    const inserted = await client.from("products").insert(payload).select("id").single();
    throwIfError(inserted.error, "Could not save the product.");
    const createdId = inserted.data?.id;
    if (!createdId) throw new DbError("Could not save the product.");
    productId = createdId;
  } else {
    const updated = await client.from("products").update(payload).eq("id", productId);
    throwIfError(updated.error, "Could not update the product.");
  }

  for (const row of rows) {
    const pack = row.size.trim();
    const current = await client
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .ilike("pack_size", pack)
      .maybeSingle();
    throwIfError(current.error, "Could not check the pack size.");
    const variantPayload = {
      product_id: productId,
      pack_size: pack,
      purchase_price: Number(row.purchasePrice || 0),
      selling_price: Number(row.sellingPrice || 0),
      mrp: Number(row.mrp || 0),
      min_stock: Number(row.minStock || 0),
      status: dbStatus(row.status),
    };
    if (current.data?.id) {
      const updated = await client
        .from("product_variants")
        .update(variantPayload)
        .eq("id", current.data.id);
      throwIfError(updated.error, "Could not update the pack size.");
    } else {
      const inserted = await client.from("product_variants").insert(variantPayload);
      throwIfError(inserted.error, "Could not save the pack size.");
    }
  }

  return loadCatalog();
}

export async function updateCatalogProduct(row: Product) {
  await requireUserId();
  const client = db();
  const variant = await client
    .from("product_variants")
    .select("id, product_id")
    .eq("id", row.id)
    .maybeSingle();
  throwIfError(variant.error, "Could not find this pack size.");
  if (!variant.data?.product_id) {
    throw new DbError("This pack size is not in the database.");
  }
  const manufacturerId = await ensureParty("manufacturer", row.manufacturer);
  const vendorId = await ensureParty("vendor", row.vendor);
  const productUpdate = await client
    .from("products")
    .update({
      name: row.name.trim(),
      product_category: row.productCategory,
      product_type: row.productType,
      purpose: row.purpose,
      unit: row.unit,
      hsn_code: row.hsnCode.trim(),
      manufacturer_id: manufacturerId,
      vendor_id: vendorId,
      tax_type: row.taxType.toLowerCase() === "interstate" ? "interstate" : "intrastate",
      tax_percent: Number(row.taxPercentage || 0),
      description: row.description || null,
      usage_instructions: row.usageInstructions || null,
      safety_info: row.safetyInfo || null,
      storage_info: row.storageInfo || null,
      application_methods: row.applicationMethods || [],
      dosage: row.dosage ? String(row.dosage) : null,
      dosage_unit: row.dosageUnit || null,
      filler: row.filler ? String(row.filler) : null,
      filler_unit: row.fillerUnit || null,
      filler_type: row.fillerType || null,
      status: dbStatus(row.status),
    })
    .eq("id", variant.data.product_id);
  throwIfError(productUpdate.error, "Could not update the product.");
  const variantUpdate = await client
    .from("product_variants")
    .update({
      pack_size: row.size.trim(),
      purchase_price: Number(row.purchasePrice || 0),
      selling_price: Number(row.sellingPrice || 0),
      mrp: Number(row.mrp || 0),
      min_stock: Number(row.minStock || 0),
      status: dbStatus(row.status),
    })
    .eq("id", row.id);
  throwIfError(variantUpdate.error, "Could not update the pack size.");
  return loadCatalog();
}

export function catalogGroupKey(row: Product) {
  return groupKey(row);
}
