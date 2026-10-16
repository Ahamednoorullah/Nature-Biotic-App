import {
  adoptDatabaseFarmers,
  settleLinkedFarmerAccounts,
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
  created_by: string | null;
  created_by_name: string | null;
  payment_method: string | null;
  credit_limit: number | string | null;
  remarks: string | null;
  internal_notes: string | null;
  profile_image_path: string | null;
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

function toFarmer(
  row: FarmerRow,
  signedUrlMap?: Map<string, string>,
  staffNames?: Map<string, string>,
): Farmer {
  const farms: FarmerFarm[] = (row.farmer_farms || []).map((farm) => ({
    id: farm.id,
    village: farm.village || "",
    farmAddress: farm.farm_address || "",
    crops: (farm.farmer_crops || []).map(toCrop),
  }));
  const crops = farms.flatMap((farm) => farm.crops || []);
  const resolvedImage =
    (row.profile_image_path
      ? signedUrlMap?.get(row.profile_image_path)
      : undefined) ||
    row.profile_image_path ||
    undefined;

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
    createdByUserId: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    executiveName:
      row.channel === "executive"
        ? staffNames?.get(String(row.fro_staff_id || "")) || row.created_by_name || ""
        : "",
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
    profileImage: resolvedImage,
    cropType2: undefined,
    cropType3: undefined,
  };
}

function base64ToBlob(base64: string): { blob: Blob; mime: string } {
  const match = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new DbError("Invalid image format provided for upload.");
  }
  const mime = match[1];
  const binaryStr = atob(match[2]);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: mime }), mime };
}

export async function uploadFarmerProfileImage(
  storeId: string,
  imageData: string,
): Promise<string> {
  await requireUserId();
  if (!imageData || !imageData.startsWith("data:")) {
    if (imageData && (imageData.startsWith("farmers/") || !imageData.startsWith("http"))) {
      return imageData;
    }
    return "";
  }

  const { blob, mime } = base64ToBlob(imageData);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const filePath = `farmers/${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const client = db();
  const { error } = await client.storage.from("company-assets").upload(filePath, blob, {
    contentType: mime,
    upsert: true,
  });

  if (error) {
    throw new DbError(`Failed to upload farmer profile image: ${error.message}`);
  }

  return filePath;
}

export async function loadFarmers() {
  await requireUserId();
  const client = db();
  const result = await client
    .from("farmers")
    .select(
      "id, store_id, name, phone, alt_mobile, email, gst, aadhar, village, landmark, district, state, pincode, customer_category, channel, fro_staff_id, created_by, created_by_name, payment_method, credit_limit, remarks, internal_notes, profile_image_path, status, joined_date, farmer_farms(id, village, landmark, district, state, pincode, farm_address, farmer_crops(id, crop_type, land_size, soil_type, water_source))",
    )
    .order("name");
  throwIfError(result.error, "Could not load farmers.");

  const rawRows = (result.data || []) as FarmerRow[];
  const paths = Array.from(
    new Set(
      rawRows
        .map((r) => r.profile_image_path)
        .filter((p): p is string => Boolean(p && typeof p === "string" && p.trim())),
    ),
  );

  const signedUrlMap = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data: signedList } = await client.storage
        .from("company-assets")
        .createSignedUrls(paths, 60 * 60 * 24 * 7);
      if (Array.isArray(signedList)) {
        signedList.forEach((item) => {
          if (item?.path && item?.signedUrl) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        });
      }
    } catch {
      // Non-fatal if signed URL generation fails; will fall back to stored path
    }
  }

  const staffIds = Array.from(
    new Set(rawRows.map((row) => row.fro_staff_id).filter((id): id is string => Boolean(id))),
  );
  const staffNames = new Map<string, string>();
  if (staffIds.length > 0) {
    const staffResult = await client.from("staff").select("id, name").in("id", staffIds);
    if (!staffResult.error) {
      for (const member of (staffResult.data || []) as { id: string; name: string }[]) {
        staffNames.set(String(member.id), String(member.name || ""));
      }
    }
  }

  const rows = rawRows.map((row) => toFarmer(row, signedUrlMap, staffNames));
  adoptDatabaseFarmers(rows);
  return rows;
}

export async function createFarmer(row: Farmer) {
  const userId = await requireUserId();
  const profileResult = await db()
    .from("profiles")
    .select("role, store_id, staff_id")
    .eq("id", userId)
    .maybeSingle();
  throwIfError(profileResult.error, "Could not confirm this account.");
  const profile = profileResult.data as {
    role?: string;
    store_id?: string | null;
    staff_id?: string | null;
  } | null;
  const isFro = profile?.role === "fro";
  if (isFro && (!profile?.store_id || !profile.staff_id)) {
    throw new DbError("This login is not linked to a staff record for a store.");
  }
  const storeId = isFro ? String(profile?.store_id) : row.storeId;
  const channel = isFro ? "executive" : row.through === "Executive" ? "executive" : "direct";
  const staffId = isFro ? String(profile?.staff_id) : row.createdByStaffId || null;
  if (channel === "executive" && !staffId) {
    throw new DbError(
      "An executive farmer needs an FRO staff record before it can be saved.",
    );
  }

  let profileImagePath: string | null = null;
  if (row.profileImage) {
    profileImagePath = await uploadFarmerProfileImage(storeId, row.profileImage);
  }

  const client = db();
  const inserted = await client
    .from("farmers")
    .insert({
      store_id: storeId,
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
      profile_image_path: profileImagePath || null,
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

export async function updateFarmer(row: Farmer) {
  await requireUserId();
  const channel = row.through === "Executive" ? "executive" : "direct";
  const staffId = row.createdByStaffId || null;

  let profileImagePath: string | null | undefined = undefined;
  if (row.profileImage !== undefined) {
    if (row.profileImage && row.profileImage.startsWith("data:")) {
      profileImagePath = await uploadFarmerProfileImage(row.storeId, row.profileImage);
    } else if (
      row.profileImage &&
      (row.profileImage.startsWith("farmers/") || !row.profileImage.startsWith("http"))
    ) {
      profileImagePath = row.profileImage;
    } else if (!row.profileImage) {
      profileImagePath = null;
    }
  }

  const client = db();

  const updatePayload: Record<string, any> = {
    name: row.name.trim(),
    phone: row.phone.trim(),
    alt_mobile: row.altMobile?.trim() || null,
    email: row.email?.trim() || null,
    gst: row.gst?.trim() || null,
    aadhar: row.aadhar?.trim() || null,
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
  };
  if (profileImagePath !== undefined) {
    updatePayload.profile_image_path = profileImagePath;
  }

  const updateResult = await client
    .from("farmers")
    .update(updatePayload)
    .eq("id", row.id);
  throwIfError(updateResult.error, "Could not update the farmer.");

  if (row.farms && row.farms.length > 0) {
    // Delete existing crops and farms to update cleanly or upsert
    await client.from("farmer_crops").delete().eq("farmer_id", row.id);
    await client.from("farmer_farms").delete().eq("farmer_id", row.id);

    for (const farm of row.farms) {
      const farmInsert = await client
        .from("farmer_farms")
        .insert({
          farmer_id: row.id,
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
      if (!farmId) continue;

      const crops = farm.crops || [];
      if (!crops.length) continue;
      const cropInsert = await client.from("farmer_crops").insert(
        crops.map((crop) => ({
          farmer_id: row.id,
          farm_id: farmId,
          crop_type: crop.cropType,
          land_size: Number(crop.landSize || 0),
          soil_type: crop.soilType || null,
          water_source: crop.waterSource || null,
        })),
      );
      throwIfError(cropInsert.error, "Could not save the crops.");
    }
  }

  await loadFarmers();
}

export async function countActiveFarmers(storeId: string) {
  await requireUserId();
  const result = await db()
    .from("farmers")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "active");
  throwIfError(result.error, "Could not load farmers.");
  return result.count || 0;
}

export type FarmerActivity = {
  invoices: {
    id: string;
    invoiceNo: string;
    date: string;
    farmerId: string;
    partyName: string;
    farmerPhone: string;
    farmerVillage: string;
    farmerCrop: string;
    farmerAcre: string;
    placeOfSupply: string;
    through: "Direct" | "Executive";
    executiveName?: string;
    withoutTax: number;
    sgst: number;
    cgst: number;
    igst: number;
    amount: number;
    status: string;
    notes: string;
    products: {
      id: string;
      key: string;
      productName: string;
      product: { name: string };
      packSize: string;
      pkgsize: string;
      hsn: string;
      batchNo: string;
      expiryDate: string;
      quantity: number;
      sellingPrice: number;
      discount: number;
      withoutTax: number;
      taxPercent: number;
      taxAmount: number;
      sgst: number;
      cgst: number;
      igst: number;
      lineTotal: number;
      rowTotal: number;
    }[];
  }[];
  receipts: {
    id: string;
    receiptNo: string;
    date: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    method: string;
    invoiceNo: string;
    remarks: string;
    status: string;
  }[];
  returns: {
    id: string;
    returnNo: string;
    date: string;
    farmerId: string;
    partyName: string;
    amount: number;
    status: string;
    invoiceNo: string;
    items: {
      id: string;
      productName: string;
      packSize: string;
      quantity: number;
      lineTotal: number;
      batchNo: string;
      reason: string;
    }[];
  }[];
  refunds: {
    id: string;
    refundNo: string;
    date: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    appliedToOutstanding: number;
    referenceNo: string;
    status: string;
  }[];
};

function paymentLabel(method: unknown) {
  const value = String(method || "").toLowerCase();
  if (value === "upi") return "UPI";
  if (value === "bank_transfer") return "Bank Transfer";
  if (value === "cheque") return "Cheque";
  if (value === "cash") return "Cash";
  return String(method || "Cash");
}

function day(value: unknown) {
  return String(value || "").slice(0, 10);
}

export async function loadFarmerActivity(
  storeId: string,
  farmerId: string,
): Promise<FarmerActivity> {
  await requireUserId();
  const client = db();
  const [invoiceResult, receiptResult, returnResult, refundResult] = await Promise.all([
    client
      .from("sales_invoices")
      .select(`
        id, invoice_no, invoice_date, channel, farmer_id, party_name,
        farmer_phone, farmer_village, farmer_crop, farmer_acre, place_of_supply,
        taxable_amount, sgst_amount, cgst_amount, igst_amount, total_amount,
        status, notes,
        sales_invoice_items (
          id, product_name, pack_size, hsn_code, batch_no, expiry_date,
          quantity, unit_price, discount_amount, taxable_amount, tax_percent,
          sgst_amount, cgst_amount, igst_amount, tax_amount, line_total
        )
      `)
      .eq("store_id", storeId)
      .eq("farmer_id", farmerId)
      .order("invoice_date", { ascending: false }),
    client
      .from("store_receipts")
      .select("id, receipt_no, receipt_date, farmer_id, farmer_name, amount, method, remarks, status, sales_invoice_id")
      .eq("store_id", storeId)
      .eq("farmer_id", farmerId)
      .order("receipt_date", { ascending: false }),
    client
      .from("sales_returns")
      .select(`
        id, return_no, return_date, farmer_id, party_name, total_amount, status, sales_invoice_id,
        sales_return_items (id, product_name, pack_size, quantity, line_total, batch_no, reason)
      `)
      .eq("store_id", storeId)
      .eq("farmer_id", farmerId)
      .order("return_date", { ascending: false }),
    client
      .from("store_refunds")
      .select("id, refund_no, refund_date, farmer_id, farmer_name, refund_amount, applied_to_outstanding, reference_no, status")
      .eq("store_id", storeId)
      .eq("farmer_id", farmerId)
      .order("refund_date", { ascending: false }),
  ]);
  throwIfError(invoiceResult.error, "Could not load this farmer's invoices.");
  throwIfError(receiptResult.error, "Could not load this farmer's receipts.");
  throwIfError(returnResult.error, "Could not load this farmer's returns.");
  throwIfError(refundResult.error, "Could not load this farmer's refunds.");

  const invoices = ((invoiceResult.data || []) as any[]).map((row) => ({
    id: String(row.id),
    invoiceNo: String(row.invoice_no || ""),
    date: day(row.invoice_date),
    farmerId: String(row.farmer_id || farmerId),
    partyName: String(row.party_name || ""),
    farmerPhone: String(row.farmer_phone || ""),
    farmerVillage: String(row.farmer_village || ""),
    farmerCrop: String(row.farmer_crop || ""),
    farmerAcre: String(row.farmer_acre || ""),
    placeOfSupply: String(row.place_of_supply || ""),
    through: row.channel === "executive" ? "Executive" as const : "Direct" as const,
    withoutTax: money(row.taxable_amount),
    sgst: money(row.sgst_amount),
    cgst: money(row.cgst_amount),
    igst: money(row.igst_amount),
    amount: money(row.total_amount),
    status: String(row.status || "final"),
    notes: String(row.notes || ""),
    products: ((row.sales_invoice_items || []) as any[]).map((item, index) => {
      const productName = String(item.product_name || "");
      const lineTotal = money(item.line_total);
      return {
        id: String(item.id),
        key: String(item.id || index),
        productName,
        product: { name: productName },
        packSize: String(item.pack_size || ""),
        pkgsize: String(item.pack_size || ""),
        hsn: String(item.hsn_code || ""),
        batchNo: String(item.batch_no || ""),
        expiryDate: day(item.expiry_date),
        quantity: Number(item.quantity || 0),
        sellingPrice: money(item.unit_price),
        discount: money(item.discount_amount),
        withoutTax: money(item.taxable_amount),
        taxPercent: money(item.tax_percent),
        taxAmount: money(item.tax_amount),
        sgst: money(item.sgst_amount),
        cgst: money(item.cgst_amount),
        igst: money(item.igst_amount),
        lineTotal,
        rowTotal: lineTotal,
      };
    }),
  }));
  const invoiceNoById = new Map(invoices.map((row) => [row.id, row.invoiceNo]));

  return {
    invoices,
    receipts: ((receiptResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      receiptNo: String(row.receipt_no || ""),
      date: day(row.receipt_date),
      farmerId: String(row.farmer_id || farmerId),
      farmerName: String(row.farmer_name || ""),
      amount: Number(row.amount || 0),
      method: paymentLabel(row.method),
      invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      remarks: String(row.remarks || ""),
      status: String(row.status || "final"),
    })),
    returns: ((returnResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      returnNo: String(row.return_no || ""),
      date: day(row.return_date),
      farmerId: String(row.farmer_id || farmerId),
      partyName: String(row.party_name || ""),
      amount: Number(row.total_amount || 0),
      status: String(row.status || ""),
      invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      items: ((row.sales_return_items || []) as any[]).map((item) => ({
        id: String(item.id),
        productName: String(item.product_name || ""),
        packSize: String(item.pack_size || ""),
        quantity: Number(item.quantity || 0),
        lineTotal: Number(item.line_total || 0),
        batchNo: String(item.batch_no || ""),
        reason: String(item.reason || ""),
      })),
    })),
    refunds: ((refundResult.data || []) as any[]).map((row) => ({
      id: String(row.id),
      refundNo: String(row.refund_no || ""),
      date: day(row.refund_date),
      farmerId: String(row.farmer_id || farmerId),
      farmerName: String(row.farmer_name || ""),
      amount: Number(row.refund_amount || 0),
      appliedToOutstanding: Number(row.applied_to_outstanding || 0),
      referenceNo: String(row.reference_no || ""),
      status: String(row.status || "final"),
    })),
  };
}

function money(value: unknown): number {
  if (value === null || value === undefined || value === "") return Number.NaN;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export async function loadStoreFarmerBalances(storeId: string) {
  await requireUserId();
  const client = db();
  const [invoiceResult, receiptResult, returnResult, refundResult] = await Promise.all([
    client
      .from("sales_invoices")
      .select("id, invoice_no, farmer_id, party_name, total_amount, status")
      .eq("store_id", storeId),
    client
      .from("store_receipts")
      .select("id, receipt_no, farmer_id, farmer_name, amount, status, sales_invoice_id")
      .eq("store_id", storeId),
    client
      .from("sales_returns")
      .select("id, return_no, farmer_id, party_name, total_amount, status, sales_invoice_id")
      .eq("store_id", storeId),
    client
      .from("store_refunds")
      .select("id, refund_no, farmer_id, farmer_name, refund_amount, applied_to_outstanding, status")
      .eq("store_id", storeId),
  ]);
  throwIfError(invoiceResult.error, "Could not load farmer invoices.");
  throwIfError(receiptResult.error, "Could not load farmer receipts.");
  throwIfError(returnResult.error, "Could not load farmer returns.");
  throwIfError(refundResult.error, "Could not load farmer refunds.");

  const invoiceNoById = new Map(
    ((invoiceResult.data || []) as any[]).map((row) => [String(row.id), String(row.invoice_no || "")]),
  );
  const finalStatus = (status: unknown) => String(status || "").toLowerCase() === "final";

  return settleLinkedFarmerAccounts({
    invoices: ((invoiceResult.data || []) as any[])
      .filter((row) => finalStatus(row.status))
      .map((row) => ({
        id: row.id,
        invoiceNo: row.invoice_no,
        farmerId: row.farmer_id,
        partyName: row.party_name,
        amount: money(row.total_amount),
        status: row.status,
      })),
    receipts: ((receiptResult.data || []) as any[])
      .filter((row) => finalStatus(row.status))
      .map((row) => ({
        id: row.id,
        receiptNo: row.receipt_no,
        farmerId: row.farmer_id,
        farmerName: row.farmer_name,
        amount: money(row.amount),
        status: row.status,
        invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      })),
    returns: ((returnResult.data || []) as any[])
      .filter((row) => String(row.status || "").toLowerCase() === "approved")
      .map((row) => ({
        id: row.id,
        returnNo: row.return_no,
        farmerId: row.farmer_id,
        partyName: row.party_name,
        amount: money(row.total_amount),
        status: row.status,
        invoiceNo: invoiceNoById.get(String(row.sales_invoice_id || "")) || "",
      })),
    refunds: ((refundResult.data || []) as any[])
      .filter((row) => finalStatus(row.status))
      .map((row) => ({
        id: row.id,
        refundNo: row.refund_no,
        farmerId: row.farmer_id,
        farmerName: row.farmer_name,
        amount: money(row.refund_amount),
        appliedToOutstanding: money(row.applied_to_outstanding),
        status: row.status,
      })),
  }).farmers;
}

export async function deleteFarmer(farmerId: string) {
  await requireUserId();
  const client = db();
  const result = await client.from("farmers").delete().eq("id", farmerId);
  throwIfError(result.error, "Could not delete this farmer.");
  await loadFarmers();
}

