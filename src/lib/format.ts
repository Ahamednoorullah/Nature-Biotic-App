export function formatCurrency(n: number): string {
<<<<<<< HEAD
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
=======
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
>>>>>>> e0283a378f53f9323808f8e329490ccba99fabd8
  }).format(n);
}

export function formatCompact(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return formatCurrency(n);
}

export function formatDate(d: string): string {
<<<<<<< HEAD
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
=======
  const [yyyy, mm, dd] = d.split('-');
  if (!yyyy || !mm || !dd) return d;
  return `${dd}/${mm}/${yyyy.slice(-2)}`;
>>>>>>> e0283a378f53f9323808f8e329490ccba99fabd8
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
