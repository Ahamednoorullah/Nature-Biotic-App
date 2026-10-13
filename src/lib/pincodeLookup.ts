export type PincodePostOffice = {
  name: string;
  district: string;
  state: string;
};

export type PincodeLookupResult =
  | { status: "invalid" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ok"; offices: PincodePostOffice[] };

export function isValidIndianPincode(value: string) {
  return /^\d{6}$/.test(String(value || "").trim());
}

function officeName(row: Record<string, unknown>) {
  return String(row.Name || row.OfficeName || row.BranchOffice || "").trim();
}

export async function lookupIndianPincode(
  pincode: string,
): Promise<PincodeLookupResult> {
  const pin = String(pincode || "").trim();
  if (!isValidIndianPincode(pin)) return { status: "invalid" };

  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`,
    );
    if (!response.ok) {
      return { status: "error", message: "Pincode lookup is unavailable." };
    }
    const payload = await response.json();
    const block = Array.isArray(payload) ? payload[0] : payload;
    const offices = Array.isArray(block?.PostOffice) ? block.PostOffice : [];
    const mapped = offices
      .map((row: Record<string, unknown>) => ({
        name: officeName(row),
        district: String(row.District || "").trim(),
        state: String(row.State || "").trim(),
      }))
      .filter((row: PincodePostOffice) => row.name && row.district);
    const unique = mapped.filter(
      (row: PincodePostOffice, index: number, list: PincodePostOffice[]) =>
        list.findIndex(
          (item) =>
            item.name.toLowerCase() === row.name.toLowerCase() &&
            item.district.toLowerCase() === row.district.toLowerCase(),
        ) === index,
    );
    if (unique.length === 0) return { status: "empty" };
    return { status: "ok", offices: unique };
  } catch {
    return { status: "error", message: "Pincode lookup failed. Enter Village and District manually." };
  }
}
