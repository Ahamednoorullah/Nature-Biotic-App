import type { UserRole } from "@/lib/auth/types";

export function roleLabel(role: UserRole) {
  if (role === "company_admin") return "Company Administrator";
  if (role === "store_admin") return "Store Administrator";
  return "Field Representative Officer";
}

/** Field staff use the FRO workspace. Other store staff use the store workspace. */
export function roleForStaffDesignation(designation: string): UserRole {
  const value = designation.trim().toLowerCase();
  if (
    value.includes("field") ||
    value.includes("fro") ||
    value.includes("sales executive")
  ) {
    return "fro";
  }
  return "store_admin";
}
