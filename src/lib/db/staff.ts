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
  profile_image_path: string | null;
};

type LoginStateRow = {
  staff_id: string;
  account_status: string;
  user_id: string;
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

function notifyStaffChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("nature-biotic-staff-updated"));
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

function imageName(path: string) {
  const file = path.split("/").pop() || "";
  return file.replace(/^\d+-[a-z0-9]+\./, "") || file;
}

function toStaff(row: StaffRow, signedUrl?: string, login?: LoginStateRow): Staff {
  const path = row.profile_image_path?.trim() || "";
  const status = login?.account_status;
  const loginStatus =
    status === "invitation_pending" || status === "active" || status === "disabled"
      ? status
      : "not_invited";
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
    profileImage: signedUrl || "",
    profileImagePath: path,
    profileImageName: path ? imageName(path) : "",
    designation: row.designation,
    level: (row.level || 1) as Staff["level"],
    targetSales: Number(row.target_sales || 0),
    targetFarmers: Number(row.target_farmers || 0),
    targetFarms: Number(row.target_farms || 0),
    targetVisits: Number(row.target_visits || 0),
    role: row.designation,
    status: uiStatus(row.status),
    accountId: login?.user_id,
    loginStatus,
  };
}

const STAFF_COLUMNS =
  "id, store_id, name, phone, alternative_phone, email, dob, joined_date, blood_group, address, designation, level, target_sales, target_farmers, target_farms, target_visits, status, id_proof_name, profile_image_path";

function base64ToBlob(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new DbError("The profile image could not be read.");
  const mime = match[1];
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") {
    throw new DbError("Profile images must be JPG, PNG, or WEBP.");
  }
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}

export async function uploadStaffProfileImage(
  storeId: string,
  staffId: string,
  imageData: string,
) {
  await requireUserId();
  const { blob, mime } = base64ToBlob(imageData);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const filePath = `staff/${storeId}/${staffId}/${Date.now()}.${ext}`;
  const uploaded = await db().storage.from("company-assets").upload(filePath, blob, {
    contentType: mime,
    upsert: false,
  });
  if (uploaded.error) {
    throw new DbError(`Could not upload the profile image: ${uploaded.error.message}`);
  }
  return filePath;
}

async function removeStaffImage(path: string) {
  if (!path.startsWith("staff/")) return;
  await db().storage.from("company-assets").remove([path]);
}

export async function loadStaff() {
  await requireUserId();
  const client = db();
  const result = await client.from("staff").select(STAFF_COLUMNS).order("name");
  throwIfError(result.error, "Could not load staff.");
  const rawRows = (result.data || []) as StaffRow[];
  const paths = Array.from(
    new Set(rawRows.map((row) => row.profile_image_path).filter((path): path is string => Boolean(path?.trim()))),
  );
  const signedUrlMap = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await client.storage.from("company-assets").createSignedUrls(paths, 60 * 60 * 24 * 7);
    if (signed.error) {
      throw new DbError(`Could not open staff profile images: ${signed.error.message}`);
    }
    for (const item of signed.data || []) {
      if (item.path && item.signedUrl) signedUrlMap.set(item.path, item.signedUrl);
    }
  }
  const logins = await client.rpc("staff_login_states");
  throwIfError(logins.error, "Could not load staff login status.");
  const loginByStaff = new Map<string, LoginStateRow>();
  for (const row of (logins.data || []) as LoginStateRow[]) {
    if (row.staff_id) loginByStaff.set(row.staff_id, row);
  }
  const rows = rawRows.map((row) =>
    toStaff(row, row.profile_image_path ? signedUrlMap.get(row.profile_image_path) : "", loginByStaff.get(row.id)),
  );
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

async function saveProfileImagePath(staffId: string, path: string | null) {
  const updated = await db().from("staff").update({ profile_image_path: path }).eq("id", staffId);
  throwIfError(updated.error, "Could not save the profile image.");
}

export async function createStaff(member: Staff) {
  await requireUserId();
  const inserted = await db().from("staff").insert(payload(member)).select("id").single();
  throwIfError(inserted.error, "Could not save the staff member.");
  const staffId = inserted.data?.id;
  if (!staffId) throw new DbError("Could not save the staff member.");
  const image = member.profileImage || "";
  if (!image.startsWith("data:")) {
    await loadStaff();
    notifyStaffChanged();
    return staffId;
  }
  let path = "";
  try {
    path = await uploadStaffProfileImage(member.storeId, staffId, image);
    await saveProfileImagePath(staffId, path);
  } catch (error) {
    if (path) await removeStaffImage(path);
    await db().from("staff").delete().eq("id", staffId);
    throw error;
  }
  await loadStaff();
  notifyStaffChanged();
  return staffId;
}

export async function updateStaff(member: Staff) {
  await requireUserId();
  const image = member.profileImage || "";
  let nextPath = member.profileImagePath || "";
  let uploaded = "";
  if (image.startsWith("data:")) {
    uploaded = await uploadStaffProfileImage(member.storeId, member.id, image);
    nextPath = uploaded;
  } else if (!image) {
    nextPath = "";
  }
  const updated = await db()
    .from("staff")
    .update({ ...payload(member), profile_image_path: nextPath || null })
    .eq("id", member.id);
  if (updated.error) {
    if (uploaded) await removeStaffImage(uploaded);
    throw new DbError(updated.error.message || "Could not update the staff member.");
  }
  if (uploaded && member.profileImagePath && member.profileImagePath !== uploaded) {
    await removeStaffImage(member.profileImagePath);
  }
  await loadStaff();
  notifyStaffChanged();
}

export async function removeStaffMember(staffId: string, mode: "remove" | "deactivate") {
  await requireUserId();
  const result = await db().rpc("remove_staff", { p_staff_id: staffId, p_mode: mode });
  throwIfError(result.error, "Could not remove the staff member.");
  const outcome = result.data as { result?: string; name?: string; image_path?: string } | null;
  const action = outcome?.result;
  if (action !== "deleted" && action !== "deactivated" && action !== "needs_deactivation") {
    throw new DbError("Could not remove the staff member.");
  }
  let imageWarning = "";
  if (action === "deleted" && outcome?.image_path?.startsWith("staff/")) {
    const removed = await db().storage.from("company-assets").remove([outcome.image_path]);
    if (removed.error) {
      imageWarning = `The profile image could not be deleted: ${removed.error.message}`;
    }
  }
  if (action !== "needs_deactivation") await loadStaff();
  return { result: action, name: outcome?.name || "", imageWarning };
}
