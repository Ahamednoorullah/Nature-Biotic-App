export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Round a money amount to paise without truncating to a whole rupee. */
export function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Nearest-rupee adjustment. 1234.56 becomes payable 1235 and round-off +0.44. */
export function roundOffToRupee(exact: unknown) {
  const amount = money(exact);
  const payable = Math.round(amount);
  return {
    exact: amount,
    roundOff: money(payable - amount),
    payable,
  };
}

export function formatRoundOff(value: unknown) {
  const amount = money(value);
  if (amount > 0) return `+${formatCurrency(amount)}`;
  return formatCurrency(amount);
}

export function formatCompact(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return formatCurrency(n);
}

export type SimpleDateFilter =
  | "today"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export const simpleDateFilterOptions: {
  value: SimpleDateFilter;
  label: string;
}[] = [
  { value: "today", label: "Today" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom Date" },
];

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Calendar date in Asia/Kolkata, as YYYY-MM-DD. */
export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function businessCalendar(date = new Date()) {
  const [year, month, day] = businessDate(date).split("-").map(Number);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(date);
  return {
    year,
    month,
    day,
    weekday: WEEKDAY_INDEX[weekdayName] ?? 0,
  };
}

export function parseBusinessDate(value: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const local = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!local) return null;
  let year = Number(local[3]);
  if (year < 100) year += 2000;
  const date = new Date(year, Number(local[2]) - 1, Number(local[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function matchesSimpleDate(
  value: string,
  filter: SimpleDateFilter,
  from = "",
  to = "",
) {
  const date = parseBusinessDate(value);
  if (!date) return false;
  const todayParts = businessCalendar();
  const today = new Date(todayParts.year, todayParts.month - 1, todayParts.day);
  date.setHours(0, 0, 0, 0);
  if (filter === "today") return date.getTime() === today.getTime();
  if (filter === "weekly") {
    const start = new Date(today);
    start.setDate(start.getDate() - (todayParts.weekday === 0 ? 6 : todayParts.weekday - 1));
    return date >= start && date <= today;
  }
  if (filter === "monthly") {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth()
    );
  }
  if (filter === "quarterly") {
    return (
      date.getFullYear() === today.getFullYear() &&
      Math.floor(date.getMonth() / 3) === Math.floor(today.getMonth() / 3)
    );
  }
  if (filter === "yearly") return date.getFullYear() === today.getFullYear();
  const start = from ? parseBusinessDate(from) : null;
  const end = to ? parseBusinessDate(to) : null;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return Boolean(start || end);
}

export function formatDate(d: string): string {
  const [yyyy, mm, dd] = d.split("-");
  if (!yyyy || !mm || !dd) return d;
  return `${dd}/${mm}/${yyyy.slice(-2)}`;
}

/** Indian rupee amount in words. Same wording the document screens already show. */
export function numberToWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }

  const rounded = Math.round(Number(num) || 0);
  if (rounded === 0) return "Zero Rupees Only";
  return `${convert(rounded)} Rupees Only`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
