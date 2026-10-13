import {
  adoptDatabaseStores,
  type Store,
} from "@/lib/data";
import { db, requireUserId, throwIfError } from "@/lib/db/client";
import { DbError } from "@/lib/db/errors";

type StoreRow = {
  id: string;
  code: string;
  name: string;
  owner_name: string;
  manager_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  location: string | null;
  gst_number: string | null;
  opened_date: string | null;
  status: string;
  outstanding_limit: number | string | null;
  outstanding_limit_action: string;
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_upi_id: string | null;
};

function toStore(row: StoreRow): Store {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    owner: row.owner_name,
    manager: row.manager_name || row.owner_name,
    location: row.location || "",
    address: row.address || "",
    gst: row.gst_number || "",
    phone: row.phone || "",
    email: row.email || "",
    status: row.status === "inactive" ? "Inactive" : "Active",
    todaySales: 0,
    monthlySales: 0,
    totalProfit: 0,
    outstanding: 0,
    outstandingLimit:
      row.outstanding_limit === null || row.outstanding_limit === undefined
        ? undefined
        : Number(row.outstanding_limit),
    outstandingLimitAction:
      row.outstanding_limit_action === "block" ? "block" : "warn",
    activeCustomers: 0,
    inventoryValue: 0,
    openedDate: row.opened_date || "",
    bankAccountName: row.bank_account_name || "",
    bankAccountNo: row.bank_account_no || "",
    bankIfsc: row.bank_ifsc || "",
    bankName: row.bank_name || "",
    bankBranch: row.bank_branch || "",
    bankUpiId: row.bank_upi_id || "",
  };
}

const STORE_COLUMNS =
  "id, code, name, owner_name, manager_name, phone, email, address, city, district, state, location, gst_number, opened_date, status, outstanding_limit, outstanding_limit_action, bank_account_name, bank_account_no, bank_ifsc, bank_name, bank_branch, bank_upi_id";

export async function loadStores() {
  await requireUserId();
  const result = await db().from("stores").select(STORE_COLUMNS).order("name");
  throwIfError(result.error, "Could not load stores.");
  const rows = ((result.data || []) as StoreRow[]).map(toStore);
  adoptDatabaseStores(rows);
  return rows;
}

function storeCode(value: string, name: string) {
  const code = (value || name.slice(0, 3)).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    throw new DbError("Store code must be 2 to 10 letters or numbers.");
  }
  return code;
}

function storePayload(store: Store, includeCode: boolean) {
  const location = store.location || "";
  const payload: Record<string, unknown> = {
    name: store.name.trim(),
    owner_name: store.owner.trim() || store.name.trim(),
    manager_name: store.manager.trim() || store.owner.trim() || null,
    phone: store.phone.trim(),
    email: store.email?.trim() || null,
    address: store.address?.trim() || null,
    location: location || null,
    gst_number: store.gst?.trim() || null,
    opened_date: store.openedDate || null,
    status: store.status === "Inactive" ? "inactive" : "active",
    outstanding_limit: store.outstandingLimit ?? null,
    outstanding_limit_action:
      store.outstandingLimitAction === "block" ? "block" : "warn",
    bank_account_name: store.bankAccountName || null,
    bank_account_no: store.bankAccountNo || null,
    bank_ifsc: store.bankIfsc || null,
    bank_name: store.bankName || null,
    bank_branch: store.bankBranch || null,
    bank_upi_id: store.bankUpiId || null,
  };
  if (includeCode) payload.code = storeCode(store.code, store.name);
  return payload;
}

export async function createStore(store: Store) {
  await requireUserId();
  const inserted = await db()
    .from("stores")
    .insert(storePayload(store, true))
    .select("id")
    .single();
  throwIfError(inserted.error, "Could not save the store.");
  const storeId = inserted.data?.id;
  if (!storeId) throw new DbError("Could not save the store.");
  await loadStores();
  return storeId;
}

export async function updateStore(store: Store) {
  await requireUserId();
  const updated = await db()
    .from("stores")
    .update(storePayload(store, false))
    .eq("id", store.id);
  throwIfError(updated.error, "Could not update the store.");
  await loadStores();
}

export async function storeAdminEmails(storeId: string) {
  await requireUserId();
  const linked = await db()
    .from("profiles")
    .select("email")
    .eq("store_id", storeId)
    .eq("role", "store_admin")
    .order("email");
  throwIfError(linked.error, "Could not check this store's logins.");
  return (linked.data || [])
    .map((row) => row.email)
    .filter((email): email is string => Boolean(email));
}

export async function deleteStore(storeId: string) {
  await requireUserId();
  const removed = await db().rpc("delete_empty_store", { p_store_id: storeId });
  throwIfError(removed.error, "Could not delete the store.");
  await loadStores();
}
