function filled(value?: string) {
  const text = String(value || "").trim();
  return text && text !== "-" ? text : "";
}

/** Farmer name, village, and phone from the farmer record, then the document. */
export function farmerContactText(
  farmer: { name?: string; village?: string; phone?: string } | null | undefined,
  fallback?: { name?: string; village?: string; phone?: string },
) {
  return {
    name: filled(farmer?.name) || filled(fallback?.name) || "-",
    village: filled(farmer?.village) || filled(fallback?.village) || "-",
    phone: filled(farmer?.phone) || filled(fallback?.phone) || "-",
  };
}

function phoneDigits(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

export function shareableWhatsAppPhone(phone: string) {
  if (!phoneDigits(phone)) {
    window.alert("Farmer phone number is not available.");
    return false;
  }
  return true;
}

export type DocumentShareLine = {
  name: string;
  packSize: string;
  qty: string | number;
  rate: string;
  amount: string;
};

export function detailedShareMessage(input: {
  farmerName: string;
  intro: string;
  numberLabel: string;
  number: string;
  date: string;
  lines: DocumentShareLine[];
  lineAmountLabel: string;
  totalLabel: string;
  total: string;
  storeName: string;
}) {
  const name = input.farmerName.trim() || "Farmer";
  const storeName = input.storeName.trim() || "Nature Biotic";
  const products = input.lines
    .map((line, index) =>
      [
        `${index + 1}. ${line.name.trim() || "-"}`,
        `   Pack Size: ${line.packSize.trim() || "-"}`,
        `   Qty: ${line.qty}`,
        `   Rate: ${line.rate}`,
        `   ${input.lineAmountLabel}: ${line.amount}`,
      ].join("\n"),
    )
    .join("\n\n");
  return [
    `Dear ${name},`,
    "",
    input.intro,
    "",
    `${input.numberLabel}: ${input.number}`,
    `Date: ${input.date}`,
    "",
    "Products:",
    "",
    products || "-",
    "",
    `${input.totalLabel}: ${input.total}`,
    "",
    "Thank you,",
    storeName,
    "Nature Biotic",
  ].join("\n");
}

export function documentShareMessage(input: {
  kind: "Sales Invoice" | "Quotation" | "Sales Return";
  farmerName: string;
  numberLabel: string;
  number: string;
  date: string;
  amount: string;
}) {
  const name = input.farmerName.trim() || "Farmer";
  return [
    `Dear ${name},`,
    "",
    `Please find your ${input.kind}:`,
    "",
    `${input.numberLabel}: ${input.number}`,
    `Date: ${input.date}`,
    `Amount: ${input.amount}`,
    "",
    "Thank you,",
    "Nature Biotic",
  ].join("\n");
}

/**
 * Opens WhatsApp with the farmer's number and a pre-filled text message.
 * The user still has to press Send. Returns false when the phone cannot be used.
 */
export function openWhatsAppShare(
  phone: string,
  message: string,
  options?: { stayOnPage?: boolean },
) {
  const digits = phoneDigits(phone);
  if (!digits) {
    window.alert("Farmer phone number is not available.");
    return false;
  }
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    if (options?.stayOnPage) {
      window.alert("Allow pop-ups to open WhatsApp. The PDF has been downloaded.");
      return false;
    }
    window.location.href = url;
  }
  return true;
}
