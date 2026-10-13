import { adoptDatabaseStaff, type Staff } from "@/lib/data";
import { db, requireUserId, throwIfError } from "@/lib/db/client";
import { DbError } from "@/lib/db/errors";

type StaffRow = {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  alternative_phone: string | null;
  email: string | null;
  dob: string | null;
  joined_date: string | null;
  blood_group: string | null;
  address: string | null;
  designation: string;
  level: number;
  target_sales: number | string;
  target_farmers: number;
  target_farms: number;
  target_visits: number;
  status: string;
  id_proof_name: string | null;
};

function uiStatus(value: string): Staff["status"] {
  if (value === "on_leave") return "On Leave";
  if (value === "inactive") return "Inactive";
  return "Active";
}

function dbStatus(value: string) {
  if (value === "On Leave") return "on_leave";
  if (value === "Inactive") return "inactive";
  return "active";
}

function ageFromDob(dob: string) {
  if (!dob) return 0;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

function toStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    phone: row.phone || "",
    alternativePhone: row.alternative_phone || "",
    email: row.email || "",
    dob: row.dob || "",
    age: ageFromDob(row.dob || ""),
    bloodGroup: row.blood_group || "",
    joinedDate: row.joined_date || "",
    address: row.address || "",
    proofIdName: row.id_proof_name || "",
    profileImageName: "",
    designation: row.designation,
    level: (row.level || 1) as Staff["level"],
    targetSales: Number(row.target_sales || 0),
    targetFarmers: Number(row.target_farmers || 0),
    targetFarms: Number(row.target_farms || 0),
    targetVisits: Number(row.target_visits || 0),
    role: row.designation,
    status: uiStatus(row.status),
  };
}

const STAFF_COLUMNS =
  "id, store_id, name, phone, alternative_phone, email, dob, joined_date, blood_group, address, designation, level, target_sales, target_farmers, target_farms, target_visits, status, id_proof_name";

export async function loadStaff() {
  await requireUserId();
  const result = await db().from("staff").select(STAFF_COLUMNS).order("name");
  throwIfError(result.error, "Could not load staff.");
  const rows = ((result.data || []) as StaffRow[]).map(toStaff);
  adoptDatabaseStaff(rows);
  return rows;
}

function payload(member: Staff) {
  return {
    store_id: member.storeId,
    name: member.name.trim(),
    phone: member.phone.trim(),
    alternative_phone: member.alternativePhone.trim() || null,
    email: member.email.trim() || null,
    dob: member.dob || null,
    joined_date: member.joinedDate || null,
    blood_group: member.bloodGroup || null,
    address: member.address || null,
    designation: member.designation.trim(),
    level: member.level,
    target_sales: Number(member.targetSales || 0),
    target_farmers: Number(member.targetFarmers || 0),
    target_farms: Number(member.targetFarms || 0),
    target_visits: Number(member.targetVisits || 0),
    status: dbStatus(member.status),
    id_proof_name: member.proofIdName || null,
  };
}

export async function createStaff(member: Staff) {
  await requireUserId();
  const inserted = await db().from("staff").insert(payload(member)).select("id").single();
  throwIfError(inserted.error, "Could not save the staff member.");
  const staffId = inserted.data?.id;
  if (!staffId) throw new DbError("Could not save the staff member.");
  await loadStaff();
  return staffId;
}

export async function updateStaff(member: Staff) {
  await requireUserId();
  const updated = await db().from("staff").update(payload(member)).eq("id", member.id);
  throwIfError(updated.error, "Could not update the staff member.");
  await loadStaff();
}
