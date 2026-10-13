import {
  getProductMaster,
  productMasterUpdatedEvent,
  type Product,
} from "@/lib/data";
import { isSupabaseAuthEnabled } from "@/lib/auth/localAuth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const PRODUCT_MASTER_KEY = "nature-biotic-product-master-v1";
const PRODUCT_PARTY_OPTIONS_KEY = "nature-biotic-product-party-options-v1";
const LOCAL_MAP_KEY = "nature-biotic-catalog-id-map-v1";
const REPORT_KEY = "nature-biotic-catalog-sync-report-v1";
const BACKUP_MASTER_KEY = "nature-biotic-backup-product-master-v1";
const BACKUP_PARTIES_KEY = "nature-biotic-backup-product-party-options-v1";
const BACKUP_TAKEN_KEY = "nature-biotic-catalog-backup-taken-v1";

const CATEGORIES = new Set([
  "Bio-stimulant",
  "Pesticide",
  "Fungicide",
  "Nutrients (Fertilizer)",
  "Manenes",
]);
const PRODUCT_TYPES = new Set(["Liquid", "Powder", "Gel", "Granules"]);
const PURPOSES = new Set([
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
]);
const UNITS = new Set(["Weight", "Volume"]);

type PartyKind = "manufacturer" | "vendor";
type MapEntity = "product_party" | "product" | "product_variant";

export type CatalogSyncFailure = {
  localId: string;
  stage: "party" | "product" | "variant" | "map";
  error: string;
};

export type DuplicateGroupCandidate = {
  groupKey: string;
  localIds: string[];
  packSize: string;
  reason: string;
};

export type CatalogSyncReport = {
  ranAt: string;
  skipped?: string;
  source: {
    productRows: number;
    partyOptionManufacturers: number;
    partyOptionVendors: number;
    uniqueParties: number;
    groupedProducts: number;
  };
  synced: {
    parties: number;
    products: number;
    variants: number;
    mappings: number;
  };
  unmappedLocalProductIds: string[];
  duplicateGroupingCandidates: DuplicateGroupCandidate[];
  failed: CatalogSyncFailure[];
};

type IdMap = Record<string, string>;

type PartyRow = { id: string; kind: string; name: string };
type ProductRow = {
  id: string;
  name: string;
  product_category: string;
  hsn_code: string;
};
type VariantRow = { id: string; product_id: string; pack_size: string };
type MapRow = { entity: string; local_id: string; remote_id: string };

let inFlight: Promise<CatalogSyncReport> | null = null;
let listenerBound = false;

function mapKey(entity: MapEntity, localId: string) {
  return `${entity}:${localId}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function snapshotSourceKeys() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(BACKUP_TAKEN_KEY) === "1") return;
  const master = window.localStorage.getItem(PRODUCT_MASTER_KEY);
  const parties = window.localStorage.getItem(PRODUCT_PARTY_OPTIONS_KEY);
  if (master !== null) window.localStorage.setItem(BACKUP_MASTER_KEY, master);
  if (parties !== null) window.localStorage.setItem(BACKUP_PARTIES_KEY, parties);
  window.localStorage.setItem(BACKUP_TAKEN_KEY, "1");
}

function rawPartyOptions(): { manufacturers: string[]; vendors: string[] } {
  if (typeof window === "undefined") {
    return { manufacturers: [], vendors: [] };
  }
  try {
    const raw = window.localStorage.getItem(PRODUCT_PARTY_OPTIONS_KEY);
    if (!raw) return { manufacturers: [], vendors: [] };
    const saved = JSON.parse(raw) as {
      manufacturers?: string[];
      vendors?: string[];
    };
    return {
      manufacturers: Array.isArray(saved.manufacturers)
        ? saved.manufacturers
        : [],
      vendors: Array.isArray(saved.vendors) ? saved.vendors : [],
    };
  } catch {
    return { manufacturers: [], vendors: [] };
  }
}

function normalizeTaxType(value: unknown): "intrastate" | "interstate" {
  return String(value || "")
    .trim()
    .toLowerCase() === "interstate"
    ? "interstate"
    : "intrastate";
}

function normalizeStatus(value: unknown): "active" | "inactive" {
  return String(value || "").trim().toLowerCase() === "inactive"
    ? "inactive"
    : "active";
}

function groupKey(row: Product) {
  return [
    String(row.productCategory || "").trim(),
    String(row.name || "").trim().toLowerCase(),
    String(row.hsnCode || "").trim(),
  ].join("|");
}

function packKey(size: unknown) {
  return String(size || "").trim().toLowerCase();
}

function partyLocalId(kind: PartyKind, name: string) {
  return `${kind}:${name.trim().toLowerCase()}`;
}

function validateProduct(row: Product): string | null {
  if (!String(row.id || "").trim()) return "Missing local product id.";
  if (!String(row.name || "").trim()) return "Missing product name.";
  if (!CATEGORIES.has(row.productCategory)) {
    return `Unsupported productCategory: ${row.productCategory}`;
  }
  if (!PRODUCT_TYPES.has(row.productType)) {
    return `Unsupported productType: ${row.productType}`;
  }
  if (!PURPOSES.has(row.purpose)) return `Unsupported purpose: ${row.purpose}`;
  if (!UNITS.has(row.unit)) return `Unsupported unit: ${row.unit}`;
  if (!String(row.hsnCode || "").trim()) return "Missing HSN code.";
  if (!String(row.size || "").trim()) return "Missing pack size.";
  return null;
}

function collectParties(rows: Product[]) {
  const fromOptions = rawPartyOptions();
  const names = new Map<string, { kind: PartyKind; name: string }>();
  const add = (kind: PartyKind, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    names.set(partyLocalId(kind, trimmed), { kind, name: trimmed });
  };
  fromOptions.manufacturers.forEach((name) => add("manufacturer", name));
  fromOptions.vendors.forEach((name) => add("vendor", name));
  rows.forEach((row) => {
    add("manufacturer", row.manufacturer);
    add("vendor", row.vendor);
  });
  return [...names.values()];
}

function productPayload(row: Product, manufacturerId: string | null, vendorId: string | null) {
  return {
    name: row.name.trim(),
    product_category: row.productCategory,
    product_type: row.productType,
    purpose: row.purpose,
    unit: row.unit,
    hsn_code: String(row.hsnCode).trim(),
    manufacturer_id: manufacturerId,
    vendor_id: vendorId,
    tax_type: normalizeTaxType(row.taxType),
    tax_percent: Number(row.taxPercentage || 0),
    description: row.description || null,
    usage_instructions: row.usageInstructions || null,
    safety_info: row.safetyInfo || null,
    storage_info: row.storageInfo || null,
    application_methods: Array.isArray(row.applicationMethods)
      ? row.applicationMethods
      : [],
    dosage:
      row.dosage === undefined || row.dosage === null || String(row.dosage) === ""
        ? null
        : String(row.dosage),
    dosage_unit: row.dosageUnit || null,
    filler:
      row.filler === undefined || row.filler === null || String(row.filler) === ""
        ? null
        : String(row.filler),
    filler_unit: row.fillerUnit || null,
    filler_type: row.fillerType || null,
    status: normalizeStatus(row.status),
  };
}

function variantPayload(row: Product, productId: string) {
  return {
    product_id: productId,
    pack_size: String(row.size).trim(),
    purchase_price: Math.max(0, Number(row.purchasePrice || 0)),
    selling_price: Math.max(0, Number(row.sellingPrice || 0)),
    mrp: Math.max(0, Number(row.mrp || 0)),
    min_stock: Math.max(0, Number(row.minStock || 0)),
    status: normalizeStatus(row.status),
  };
}

function emptyReport(skipped?: string): CatalogSyncReport {
  return {
    ranAt: new Date().toISOString(),
    skipped,
    source: {
      productRows: 0,
      partyOptionManufacturers: 0,
      partyOptionVendors: 0,
      uniqueParties: 0,
      groupedProducts: 0,
    },
    synced: { parties: 0, products: 0, variants: 0, mappings: 0 },
    unmappedLocalProductIds: [],
    duplicateGroupingCandidates: [],
    failed: [],
  };
}

function saveReport(report: CatalogSyncReport) {
  writeJson(REPORT_KEY, report);
  return report;
}

export function getLastCatalogSyncReport(): CatalogSyncReport | null {
  return readJson<CatalogSyncReport | null>(REPORT_KEY, null);
}

async function rememberMapping(
  dbMap: Map<string, string>,
  localMap: IdMap,
  entity: MapEntity,
  localId: string,
  remoteId: string,
  failed: CatalogSyncFailure[],
) {
  const key = mapKey(entity, localId);
  dbMap.set(key, remoteId);
  localMap[key] = remoteId;
  writeJson(LOCAL_MAP_KEY, localMap);
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabase().from("id_map").upsert(
    { entity, local_id: localId, remote_id: remoteId },
    { onConflict: "entity,local_id" },
  );
  if (error) {
    failed.push({
      localId,
      stage: "map",
      error: error.message,
    });
  }
}

async function runCatalogSync(): Promise<CatalogSyncReport> {
  snapshotSourceKeys();

  if (!isSupabaseAuthEnabled() || !isSupabaseConfigured()) {
    return saveReport(emptyReport("Supabase Auth is not the active source."));
  }

  const { data: sessionData, error: sessionError } =
    await getSupabase().auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return saveReport(emptyReport("No company-admin Supabase session."));
  }

  const products = getProductMaster();
  const options = rawPartyOptions();
  const parties = collectParties(products);
  const failed: CatalogSyncFailure[] = [];
  const duplicateGroupingCandidates: DuplicateGroupCandidate[] = [];
  const localMap = readJson<IdMap>(LOCAL_MAP_KEY, {});
  const dbMap = new Map<string, string>(Object.entries(localMap));

  const groups = new Map<string, Product[]>();
  products.forEach((row) => {
    const invalid = validateProduct(row);
    if (invalid) {
      failed.push({ localId: row.id, stage: "product", error: invalid });
      return;
    }
    const key = groupKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  });

  groups.forEach((rows, key) => {
    const packs = new Map<string, string[]>();
    rows.forEach((row) => {
      const pack = packKey(row.size);
      const ids = packs.get(pack) || [];
      ids.push(row.id);
      packs.set(pack, ids);
    });
    packs.forEach((ids, packSize) => {
      if (ids.length > 1) {
        duplicateGroupingCandidates.push({
          groupKey: key,
          localIds: ids,
          packSize,
          reason: "Same category + name + HSN + pack size.",
        });
      }
    });
    const canonical = rows[0];
    const drift = rows.filter(
      (row) =>
        row.purpose !== canonical.purpose ||
        row.productType !== canonical.productType ||
        row.unit !== canonical.unit ||
        normalizeTaxType(row.taxType) !== normalizeTaxType(canonical.taxType) ||
        Number(row.taxPercentage || 0) !== Number(canonical.taxPercentage || 0),
    );
    if (drift.length) {
      duplicateGroupingCandidates.push({
        groupKey: key,
        localIds: rows.map((row) => row.id),
        packSize: "",
        reason: "Grouped rows differ on purpose, type, unit, or tax.",
      });
    }
  });

  const supabase = getSupabase();
  const { data: mapRows, error: mapReadError } = await supabase
    .from("id_map")
    .select("entity, local_id, remote_id");
  if (mapReadError && !/id_map/.test(mapReadError.message)) {
    failed.push({
      localId: "*",
      stage: "map",
      error: mapReadError.message,
    });
  }
  ((mapRows || []) as MapRow[]).forEach((row) => {
    dbMap.set(mapKey(row.entity as MapEntity, row.local_id), row.remote_id);
  });

  const { data: partyRows, error: partyReadError } = await supabase
    .from("product_parties")
    .select("id, kind, name");
  if (partyReadError) {
    return saveReport({
      ...emptyReport(),
      failed: [{ localId: "*", stage: "party", error: partyReadError.message }],
    });
  }
  const partiesByNatural = new Map<string, string>();
  ((partyRows || []) as PartyRow[]).forEach((row) => {
    partiesByNatural.set(
      partyLocalId(row.kind as PartyKind, row.name),
      row.id,
    );
  });

  let syncedParties = 0;
  for (const party of parties) {
    const localId = partyLocalId(party.kind, party.name);
    let remoteId = partiesByNatural.get(localId) || dbMap.get(mapKey("product_party", localId));
    if (!remoteId) {
      const { data, error } = await supabase
        .from("product_parties")
        .insert({ kind: party.kind, name: party.name })
        .select("id")
        .maybeSingle();
      if (error || !data?.id) {
        const { data: existing } = await supabase
          .from("product_parties")
          .select("id, kind, name")
          .eq("kind", party.kind)
          .ilike("name", party.name)
          .maybeSingle();
        if (existing?.id) {
          remoteId = existing.id;
        } else {
          failed.push({
            localId,
            stage: "party",
            error: error?.message || "Could not upsert product party.",
          });
          continue;
        }
      } else {
        remoteId = data.id;
      }
    }
    if (!remoteId) continue;
    partiesByNatural.set(localId, remoteId);
    await rememberMapping(dbMap, localMap, "product_party", localId, remoteId, failed);
    syncedParties += 1;
  }

  const { data: productRows, error: productReadError } = await supabase
    .from("products")
    .select("id, name, product_category, hsn_code");
  if (productReadError) {
    failed.push({
      localId: "*",
      stage: "product",
      error: productReadError.message,
    });
  }
  const productsByNatural = new Map<string, string>();
  ((productRows || []) as ProductRow[]).forEach((row) => {
    productsByNatural.set(
      `${row.product_category}|${row.name.trim().toLowerCase()}|${row.hsn_code.trim()}`,
      row.id,
    );
  });

  const { data: variantRows, error: variantReadError } = await supabase
    .from("product_variants")
    .select("id, product_id, pack_size");
  if (variantReadError) {
    failed.push({
      localId: "*",
      stage: "variant",
      error: variantReadError.message,
    });
  }
  const variantsByNatural = new Map<string, string>();
  ((variantRows || []) as VariantRow[]).forEach((row) => {
    variantsByNatural.set(
      `${row.product_id}|${packKey(row.pack_size)}`,
      row.id,
    );
  });

  let syncedProducts = 0;
  let syncedVariants = 0;
  const mappedLocalIds = new Set<string>();

  for (const [key, rows] of groups) {
    const canonical = rows[0];
    const manufacturerId =
      partiesByNatural.get(partyLocalId("manufacturer", canonical.manufacturer)) ||
      null;
    const vendorId =
      partiesByNatural.get(partyLocalId("vendor", canonical.vendor)) || null;
    let productId =
      productsByNatural.get(key) || dbMap.get(mapKey("product", canonical.id));

    if (!productId) {
      const { data, error } = await supabase
        .from("products")
        .insert(productPayload(canonical, manufacturerId, vendorId))
        .select("id")
        .maybeSingle();
      if (error || !data?.id) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("product_category", canonical.productCategory)
          .eq("hsn_code", String(canonical.hsnCode).trim())
          .ilike("name", canonical.name.trim())
          .maybeSingle();
        if (existing?.id) {
          productId = existing.id;
        } else {
          rows.forEach((row) =>
            failed.push({
              localId: row.id,
              stage: "product",
              error: error?.message || "Could not upsert product.",
            }),
          );
          continue;
        }
      } else {
        productId = data.id;
      }
    } else {
      const { error } = await supabase
        .from("products")
        .update(productPayload(canonical, manufacturerId, vendorId))
        .eq("id", productId);
      if (error) {
        failed.push({
          localId: canonical.id,
          stage: "product",
          error: error.message,
        });
      }
    }

    if (!productId) continue;
    productsByNatural.set(key, productId);
    syncedProducts += 1;
    for (const row of rows) {
      await rememberMapping(dbMap, localMap, "product", row.id, productId, failed);
    }

    const seenPacks = new Set<string>();
    for (const row of rows) {
      const pack = packKey(row.size);
      const naturalVariantKey = `${productId}|${pack}`;
      let variantId =
        variantsByNatural.get(naturalVariantKey) ||
        dbMap.get(mapKey("product_variant", row.id));

      if (seenPacks.has(pack) && variantId) {
        await rememberMapping(
          dbMap,
          localMap,
          "product_variant",
          row.id,
          variantId,
          failed,
        );
        mappedLocalIds.add(row.id);
        syncedVariants += 1;
        continue;
      }

      if (!variantId) {
        const { data, error } = await supabase
          .from("product_variants")
          .insert(variantPayload(row, productId))
          .select("id")
          .maybeSingle();
        if (error || !data?.id) {
          const { data: existing } = await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", productId)
            .ilike("pack_size", String(row.size).trim())
            .maybeSingle();
          if (existing?.id) {
            variantId = existing.id;
          } else {
            failed.push({
              localId: row.id,
              stage: "variant",
              error: error?.message || "Could not upsert variant.",
            });
            continue;
          }
        } else {
          variantId = data.id;
        }
      } else if (!seenPacks.has(pack)) {
        const { error } = await supabase
          .from("product_variants")
          .update(variantPayload(row, productId))
          .eq("id", variantId);
        if (error) {
          failed.push({
            localId: row.id,
            stage: "variant",
            error: error.message,
          });
        }
      }

      if (!variantId) continue;
      variantsByNatural.set(naturalVariantKey, variantId);
      seenPacks.add(pack);
      await rememberMapping(
        dbMap,
        localMap,
        "product_variant",
        row.id,
        variantId,
        failed,
      );
      mappedLocalIds.add(row.id);
      syncedVariants += 1;
    }
  }

  const unmappedLocalProductIds = products
    .map((row) => row.id)
    .filter((id) => !mappedLocalIds.has(id));

  const report: CatalogSyncReport = {
    ranAt: new Date().toISOString(),
    source: {
      productRows: products.length,
      partyOptionManufacturers: options.manufacturers.length,
      partyOptionVendors: options.vendors.length,
      uniqueParties: parties.length,
      groupedProducts: groups.size,
    },
    synced: {
      parties: syncedParties,
      products: syncedProducts,
      variants: syncedVariants,
      mappings: Object.keys(localMap).length,
    },
    unmappedLocalProductIds,
    duplicateGroupingCandidates,
    failed,
  };
  return saveReport(report);
}

export function syncProductCatalogToSupabase() {
  if (inFlight) return inFlight;
  inFlight = runCatalogSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function bindProductCatalogSync() {
  if (typeof window === "undefined" || listenerBound) return;
  listenerBound = true;
  const run = () => {
    void syncProductCatalogToSupabase();
  };
  window.addEventListener(productMasterUpdatedEvent, run);
}
