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

export function formatDate(d: string): string {
  if (!d) return "";

  // YYYY-MM-DD
  const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}/${mm}/${yyyy.slice(-2)}`;
  }

  // DD-MMM-YY / DD-MMM-YYYY
  const shortMatch = d.match(/^(\d{2})-([A-Za-z]{3})-(\d{2,4})$/);

  if (shortMatch) {
    const [, dd, monthName, year] = shortMatch;

    const months: Record<string, string> = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };

    const mm = months[monthName];

    if (mm) {
      return `${dd}/${mm}/${year.slice(-2)}`;
    }
  }

  return d;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
