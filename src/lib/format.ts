export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (filter === "today") return date.getTime() === today.getTime();
  if (filter === "weekly") {
    const start = new Date(today);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
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

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
