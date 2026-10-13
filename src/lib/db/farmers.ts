import {
  adoptDatabaseFarmers,
  type Farmer,
  type FarmerCrop,
  type FarmerFarm,
} from "@/lib/data";
import { db, requireUserId, throwIfError } from "@/lib/db/client";
import { DbError } from "@/lib/db/errors";

type CropRow = {
  id: string;
  crop_type: string | null;
  land_size: number | string | null;
  soil_type: string | null;
  water_source: string | null;
};
type FarmRow = {
  id: string;
  village: string | null;
  landmark: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  farm_address: string | null;
  farmer_crops: CropRow[] | null;
};
type FarmerRow = {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  alt_mobile: string | null;
  email: string | null;
  gst: string | null;
  aadhar: string | null;
  village: string | null;
  landmark: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  customer_category: Farmer["customerCategory"];
  channel: string;
  fro_staff_id: string | null;
  payment_method: string | null;
  credit_limit: number | string | null;
  remarks: string | null;
  internal_notes: string | null;
  status: string;
  joined_date: string;
  farmer_farms: FarmRow[] | null;
};

function toCrop(row: CropRow): FarmerCrop {
  return {
    id: row.id,
    cropType: row.crop_type || "",
    landSize: Number(row.land_size || 0),
    soilType: row.soil_type || "",
    waterSource: row.water_source || "",
  };
}

function toFarmer(row: FarmerRow): Farmer {
  const farms: FarmerFarm[] = (row.farmer_farms || []).map((farm) => ({
    id: farm.id,
    village: farm.village || "",
    farmAddress: farm.farm_address || "",
    crops: (farm.farmer_crops || []).map(toCrop),
  }));
  const crops = farms.flatMap((farm) => farm.crops || []);
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    phone: row.phone,
    altMobile: row.alt_mobile || "",
    email: row.email || "",
    aadhar: row.aadhar || "",
    gst: row.gst || "",
    village: row.village || "",
    landmark: row.landmark || "",
    district: row.district || "",
    state: row.state || "",
    pincode: row.pincode || "",
    farmAddress: farms[0]?.farmAddress || "",
    customerCategory: row.customer_category,
    crops,
    farms,
    through: row.channel === "executive" ? "Executive" : "Direct",
    createdByStaffId: row.fro_staff_id || undefined,
    landSize: crops.reduce((sum, crop) => sum + Number(crop.landSize || 0), 0),
    cropType: crops[0]?.cropType || "",
    soilType: crops[0]?.soilType || "",
    waterSource: crops[0]?.waterSource || "",
    paymentMethod: row.payment_method || "",
    creditLimit:
      row.credit_limit === null || row.credit_limit === undefined
        ? undefined
        : Number(row.credit_limit),
    outstanding: 0,
    remarks: row.remarks || "",
    internalNotes: row.internal_notes || "",
    totalPurchases: 0,
    status: row.status === "inactive" ? "Inactive" : "Active",
    joinedDate: row.joined_date,
    profileColor: "emerald",
    cropType2: undefined,
    cropType3: undefined,
  };
}

export async function loadFarmers() {
  await requireUserId();
  const result = await db()
    .from("farmers")
    .select(
      "id, store_id, name, phone, alt_mobile, email, gst, aadhar, village, landmark, district, state, pincode, customer_category, channel, fro_staff_id, payment_method, credit_limit, remarks, internal_notes, status, joined_date, farmer_farms(id, village, landmark, district, state, pincode, farm_address, farmer_crops(id, crop_type, land_size, soil_type, water_source))",
    )
    .order("name");
  throwIfError(result.error, "Could not load farmers.");
  const rows = ((result.data || []) as FarmerRow[]).map(toFarmer);
  adoptDatabaseFarmers(rows);
  return rows;
}

export async function createFarmer(row: Farmer) {
  await requireUserId();
  const channel = row.through === "Executive" ? "executive" : "direct";
  const staffId = row.createdByStaffId || null;
  if (channel === "executive" && !staffId) {
    throw new DbError(
      "An executive farmer needs an FRO staff record before it can be saved.",
    );
  }
  const client = db();
  const inserted = await client
    .from("farmers")
    .insert({
      store_id: row.storeId,
      name: row.name.trim(),
      phone: row.phone.trim(),
      alt_mobile: row.altMobile.trim() || null,
      email: row.email.trim() || null,
      gst: row.gst.trim() || null,
      aadhar: row.aadhar.trim() || null,
      village: row.village || null,
      landmark: row.landmark || null,
      district: row.district || null,
      state: row.state || null,
      pincode: row.pincode || null,
      customer_category: row.customerCategory || "Retail",
      channel,
      fro_staff_id: channel === "executive" ? staffId : null,
      payment_method: row.paymentMethod || null,
      credit_limit: row.creditLimit ?? null,
      remarks: row.remarks || null,
      internal_notes: row.internalNotes || null,
      status: row.status === "Inactive" ? "inactive" : "active",
      joined_date: row.joinedDate || new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  throwIfError(inserted.error, "Could not save the farmer.");
  if (!inserted.data?.id) throw new DbError("Could not save the farmer.");
  const farmerId = inserted.data.id as string;
  const farms = row.farms?.length
    ? row.farms
    : [
        {
          village: row.village,
          landmark: row.landmark,
          district: row.district,
          state: row.state,
          pincode: row.pincode,
          farmAddress: row.farmAddress,
          crops: row.crops,
        },
      ];
  for (const farm of farms) {
    const farmInsert = await client
      .from("farmer_farms")
      .insert({
        farmer_id: farmerId,
        village: farm.village || null,
        landmark: String((farm as { landmark?: string }).landmark || "") || null,
        district: String((farm as { district?: string }).district || "") || null,
        state: String((farm as { state?: string }).state || "") || null,
        pincode: String((farm as { pincode?: string }).pincode || "") || null,
        farm_address: farm.farmAddress || null,
      })
      .select("id")
      .single();
    throwIfError(farmInsert.error, "Could not save the farm.");
    const farmId = farmInsert.data?.id;
    if (!farmId) throw new DbError("Could not save the farm.");
    const crops = farm.crops || [];
    if (!crops.length) continue;
    const cropInsert = await client.from("farmer_crops").insert(
      crops.map((crop) => ({
        farmer_id: farmerId,
        farm_id: farmId,
        crop_type: crop.cropType,
        land_size: Number(crop.landSize || 0),
        soil_type: crop.soilType || null,
        water_source: crop.waterSource || null,
      })),
    );
    throwIfError(cropInsert.error, "Could not save the crops.");
  }
  await loadFarmers();
  return farmerId;
}
