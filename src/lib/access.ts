import type { AuthUser } from "@/context/AuthContext";
import type { StorePage } from "@/context/NavContext";

export function isFRO(user: AuthUser | null | undefined): boolean {
  return user?.role === "fro";
}

export function isCompanyAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "company_admin";
}

export function isStoreAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "store_admin";
}

/**
 * Common store-page permission layer.
 *
 * FRO uses the same existing Store pages. We do not create duplicate FRO pages.
 * Pages can later use recordBelongsToUser()/filterForUser() when they need
 * row-level ownership filtering.
 */
const FRO_ALLOWED_PAGES = new Set<StorePage>([
  "dashboard",
  "stock-management",
  "delivery-challan",
  "return-challan",
  "sales",
  "farmers",
  "add-farmer",
  "quotation",
  "sales-invoice",
  "sales-return",
  "credit-notes",
  "receipt",
  "refund",
  "expenses",
  "attendance",
  "reports",
  "farmer-profile",
  "inventory-detail",
]);

export function canAccessStorePage(
  user: AuthUser | null | undefined,
  page: StorePage,
): boolean {
  if (!user) return false;
  if (user.role === "company_admin" || user.role === "store_admin") return true;
  if (user.role === "fro") return FRO_ALLOWED_PAGES.has(page);
  return false;
}

export function recordBelongsToUser(
  user: AuthUser | null | undefined,
  record: Record<string, unknown>,
): boolean {
  if (!user) return false;
  if (user.role === "company_admin") return true;

  if (user.storeId) {
    const recordStoreId = record.storeId ?? record.store_id ?? record.storeID;
    if (recordStoreId && String(recordStoreId) !== user.storeId) return false;
  }

  if (user.role !== "fro") return true;

  const ownershipFields = [
    "froId",
    "staffId",
    "createdById",
    "createdByStaffId",
    "executiveId",
  ];

  const hasOwnershipField = ownershipFields.some(
    (field) => record[field] !== undefined && record[field] !== null,
  );

  if (hasOwnershipField) {
    return ownershipFields.some(
      (field) =>
        record[field] !== undefined &&
        record[field] !== null &&
        String(record[field]) === String(user.staffId ?? user.id),
    );
  }

  const nameFields = [
    "executiveName",
    "executive",
    "froName",
    "createdBy",
    "createdByName",
    "receivedBy",
  ];

  return nameFields.every((field) => {
    const value = record[field];
    if (value === undefined || value === null || value === "") return true;
    return (
      String(value).trim().toLowerCase() === user.name.trim().toLowerCase()
    );
  });
}

export function filterForUser<T extends Record<string, unknown>>(
  user: AuthUser | null | undefined,
  rows: T[],
): T[] {
  return rows.filter((row) => recordBelongsToUser(user, row));
}
