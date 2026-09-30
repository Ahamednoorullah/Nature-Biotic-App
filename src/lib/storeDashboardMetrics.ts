import { getFarmersByStore, getStaffRecords, type Staff } from "@/lib/data";
import { roleForStaffDesignation } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";

export type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

export type DashboardDetail = {
  date: string;
  invoiceNo: string;
  receiptNo: string;
  farmer: string;
  amount: number;
  method: string;
  village: string;
  phone: string;
  ageing: string;
};

export type ChannelSummary = {
  sales: number;
  collection: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  salesRows: DashboardDetail[];
  collectionRows: DashboardDetail[];
  outstandingRows: DashboardDetail[];
};

export type ExecutiveDashboard = {
  id: string;
  name: string;
  color: string;
  sales: number;
  collection: number;
  collectionInHand: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  visits: number;
  target: { sales: number; farmers: number; farms: number; visits: number };
  salesRows: DashboardDetail[];
  collectionRows: DashboardDetail[];
  cashRows: DashboardDetail[];
  outstandingRows: DashboardDetail[];
};

const SALES_KEY = "nature-biotic-store-sales-invoices-v2";
const RETURN_KEY = "nature-biotic-store-sales-returns-v2";
const CREDIT_KEY = "nature-biotic-store-credit-notes-v3";
const RECEIPT_KEY = "nature-biotic-store-receipts-v3";
const VISIT_KEY = "nature-biotic-fro-visits-v1";
const HANDOVER_KEY = "nature-biotic-fro-handovers-v1";

const colors = [
  "from-emerald-400 to-emerald-600",
  "from-blue-400 to-blue-600",
  "from-amber-400 to-amber-600",
];

function readRows(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function parseTxnDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const local = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (local) {
    let year = Number(local[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, Number(local[2]) - 1, Number(local[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function periodBounds(filter: DateFilter) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;
  switch (filter) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "weekly": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      break;
    }
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarterly":
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case "yearly":
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { start, end };
}

export function inPeriod(value: unknown, filter: DateFilter) {
  const date = parseTxnDate(value);
  if (!date) return false;
  const { start, end } = periodBounds(filter);
  return date >= start && date <= end;
}

function displayDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return formatDate(raw.slice(0, 10));
  return raw || "-";
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function monthCount(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  if (end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

export function periodTarget(monthly: number, filter: DateFilter, joined?: unknown) {
  const now = new Date();
  const daily = monthly / daysInMonth(now.getFullYear(), now.getMonth());
  if (filter === "today") return daily;
  if (filter === "weekly") {
    const { start } = periodBounds("weekly");
    const days = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
    return daily * Math.max(1, days);
  }
  if (filter === "monthly") return monthly;
  const joinedDate = parseTxnDate(joined);
  if (filter === "quarterly") {
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), quarterStart.getMonth() + 2, 1);
    const from = joinedDate && joinedDate > quarterStart ? joinedDate : quarterStart;
    return monthly * monthCount(from, quarterEnd);
  }
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 1);
  const from = joinedDate && joinedDate > yearStart ? joinedDate : yearStart;
  return monthly * monthCount(from, yearEnd);
}

function ageingLabel(invoiceDate: Date | null) {
  if (!invoiceDate) return "0-30 Days";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - invoiceDate.getTime()) / 86400000);
  if (days <= 30) return "0-30 Days";
  if (days <= 60) return "31-60 Days";
  if (days <= 90) return "61-90 Days";
  return "90+ Days";
}

function isFieldOfficer(member: Staff) {
  return roleForStaffDesignation(member.designation || member.role || "") === "fro";
}

function farmerStats(storeId: string, farmerIds: Set<string>, farmerNames: Set<string>) {
  const farmers = getFarmersByStore(storeId).filter((farmer) => {
    if (farmerIds.has(String(farmer.id))) return true;
    return farmerNames.has(farmer.name.trim().toLowerCase());
  });
  const cropNames = new Set<string>();
  let farms = 0;
  farmers.forEach((farmer) => {
    const crops = Array.isArray(farmer.crops) ? farmer.crops : [];
    if (crops.length === 0 && farmer.cropType) {
      farms += 1;
      cropNames.add(String(farmer.cropType));
      return;
    }
    farms += crops.length;
    crops.forEach((crop) => {
      if (crop.cropType) cropNames.add(String(crop.cropType));
    });
  });
  return {
    farmers: farmerIds.size + farmerNames.size,
    farms,
    crops: cropNames.size,
  };
}

export function buildStoreDashboard(storeId: string, filter: DateFilter) {
  const invoices = readRows(`${SALES_KEY}:${storeId}`).filter(
    (row) => row.id !== "store-sale-1" && String(row.invoiceNo || "").toLowerCase() !== "nb-inv-2001",
  );
  const returns = readRows(`${RETURN_KEY}:${storeId}`);
  const credits = readRows(`${CREDIT_KEY}:${storeId}`);
  const receipts = readRows(`${RECEIPT_KEY}:${storeId}`);
  const visits = readRows(`${VISIT_KEY}:${storeId}`);
  const handovers = readRows(`${HANDOVER_KEY}:${storeId}`);
  const officers = getStaffRecords().filter(
    (member) => member.storeId === storeId && member.status !== "Inactive" && isFieldOfficer(member),
  );

  const returned = new Map<string, number>();
  [...returns, ...credits].forEach((row) => {
    if (row.status === "Rejected") return;
    const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
    if (!invoiceNo) return;
    returned.set(invoiceNo, (returned.get(invoiceNo) || 0) + money(row.total || row.amount));
  });

  const paid = new Map<string, number>();
  receipts.forEach((row) => {
    const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
    if (!invoiceNo) return;
    paid.set(invoiceNo, (paid.get(invoiceNo) || 0) + money(row.amount));
  });

  const invoiceByNo = new Map<string, any>();
  invoices.forEach((invoice) => {
    const invoiceNo = String(invoice.invoiceNo || "").trim().toLowerCase();
    if (invoiceNo) invoiceByNo.set(invoiceNo, invoice);
  });

  const emptyChannel = (): ChannelSummary => ({
    sales: 0,
    collection: 0,
    outstanding: 0,
    farmers: 0,
    farms: 0,
    crops: 0,
    salesRows: [],
    collectionRows: [],
    outstandingRows: [],
  });

  const direct = emptyChannel();
  const executiveTotals = emptyChannel();
  const byOfficer = new Map<string, ChannelSummary>();
  officers.forEach((officer) => byOfficer.set(officer.id, emptyChannel()));

  const matchOfficer = (invoice: any) => {
    const staffId = String(invoice.staffId || invoice.froId || invoice.createdByStaffId || "");
    if (staffId) {
      const byId = officers.find((officer) => officer.id === staffId || officer.accountId === staffId);
      if (byId) return byId;
    }
    const name = String(invoice.executiveName || "").trim().toLowerCase();
    if (!name) return undefined;
    return officers.find((officer) => officer.name.trim().toLowerCase() === name);
  };

  const directFarmerIds = new Set<string>();
  const directFarmerNames = new Set<string>();
  const allFarmerIds = new Set<string>();
  const allFarmerNames = new Set<string>();

  invoices.forEach((invoice) => {
    if (!inPeriod(invoice.date, filter)) return;
    const invoiceNo = String(invoice.invoiceNo || "").trim();
    const key = invoiceNo.toLowerCase();
    const net = Math.max(0, money(invoice.amount) - (returned.get(key) || 0));
    if (net <= 0) return;
    const balance = Math.max(0, net - (paid.get(key) || 0));
    const officer = String(invoice.through || "").toLowerCase() === "executive" ? matchOfficer(invoice) : undefined;
    const channel = officer ? byOfficer.get(officer.id) : String(invoice.through || "").toLowerCase() === "executive" ? null : direct;
    if (!channel) return;
    channel.sales += net;
    channel.outstanding += balance;
    const farmerName = String(invoice.partyName || invoice.farmerName || "-");
    const farmerId = String(invoice.farmerId || "").trim();
    if (farmerId) {
      allFarmerIds.add(farmerId);
      if (!officer) directFarmerIds.add(farmerId);
    } else if (farmerName.trim()) {
      allFarmerNames.add(farmerName.trim().toLowerCase());
      if (!officer) directFarmerNames.add(farmerName.trim().toLowerCase());
    }
    channel.salesRows.push({
      date: displayDate(invoice.date),
      invoiceNo,
      receiptNo: "",
      farmer: farmerName,
      amount: net,
      method: officer ? "Executive" : "Direct",
      village: "",
      phone: "",
      ageing: "",
    });
    if (balance > 0) {
      channel.outstandingRows.push({
        date: displayDate(invoice.date),
        invoiceNo,
        receiptNo: "",
        farmer: farmerName,
        amount: balance,
        method: "",
        village: String(invoice.farmerVillage || invoice.village || "-"),
        phone: String(invoice.farmerPhone || invoice.phone || "-"),
        ageing: ageingLabel(parseTxnDate(invoice.date)),
      });
    }
  });

  receipts.forEach((receipt) => {
    if (!inPeriod(receipt.date, filter)) return;
    const amount = money(receipt.amount);
    if (amount <= 0) return;
    const invoice = invoiceByNo.get(String(receipt.invoiceNo || "").trim().toLowerCase());
    const through = String(receipt.through || invoice?.through || "");
    const officer =
      through.toLowerCase() === "executive"
        ? matchOfficer({ ...invoice, ...receipt, executiveName: receipt.executiveName || invoice?.executiveName })
        : undefined;
    const channel = officer ? byOfficer.get(officer.id) : through.toLowerCase() === "executive" ? null : direct;
    if (!channel) return;
    channel.collection += amount;
    channel.collectionRows.push({
      date: displayDate(receipt.date),
      invoiceNo: String(receipt.invoiceNo || ""),
      receiptNo: String(receipt.receiptNo || "-"),
      farmer: String(receipt.partyName || receipt.farmerName || invoice?.partyName || "-"),
      amount,
      method: String(receipt.method || receipt.paymentMethod || "-"),
      village: "",
      phone: "",
      ageing: "",
    });
  });

  const directStats = farmerStats(storeId, directFarmerIds, directFarmerNames);
  direct.farmers = directStats.farmers;
  direct.farms = directStats.farms;
  direct.crops = directStats.crops;

  const executives: ExecutiveDashboard[] = officers.map((officer, index) => {
    const channel = byOfficer.get(officer.id)!;
    const nameKey = officer.name.trim().toLowerCase();
    const officerVisits = visits.filter((visit) => {
      if (String(visit.storeId || storeId) !== storeId) return false;
      if (!inPeriod(visit.date, filter)) return false;
      const visitName = String(visit.froName || "").trim().toLowerCase();
      const visitId = String(visit.froId || visit.staffId || "");
      return visitName === nameKey || visitId === officer.id || visitId === officer.accountId;
    });
    const handed = handovers
      .filter(
        (row) =>
          row.status === "accepted" &&
          String(row.handedOverBy || "").trim().toLowerCase() === nameKey &&
          inPeriod(row.date || row.acceptedAt, filter),
      )
      .reduce((sum, row) => sum + money(row.amount), 0);
    const farmerIds = new Set<string>();
    const farmerNames = new Set<string>();
    channel.salesRows.forEach((row) => {
      if (row.farmer && row.farmer !== "-") farmerNames.add(row.farmer.trim().toLowerCase());
    });
    const stats = farmerStats(storeId, farmerIds, farmerNames);
    executiveTotals.sales += channel.sales;
    executiveTotals.collection += channel.collection;
    executiveTotals.outstanding += channel.outstanding;
    return {
      id: officer.id,
      name: officer.name,
      color: colors[index % colors.length],
      sales: channel.sales,
      collection: channel.collection,
      collectionInHand: Math.max(0, channel.collection - handed),
      outstanding: channel.outstanding,
      farmers: farmerNames.size,
      farms: stats.farms,
      crops: stats.crops,
      visits: officerVisits.length,
      target: {
        sales: periodTarget(money(officer.targetSales), filter, officer.joinedDate),
        farmers: Math.round(periodTarget(money(officer.targetFarmers), filter, officer.joinedDate)),
        farms: Math.round(periodTarget(money(officer.targetFarms), filter, officer.joinedDate)),
        visits: Math.round(periodTarget(money(officer.targetVisits), filter, officer.joinedDate)),
      },
      salesRows: channel.salesRows,
      collectionRows: channel.collectionRows,
      cashRows: channel.collectionRows.map((row) => ({ ...row })),
      outstandingRows: channel.outstandingRows,
    };
  });

  const overviewFarmers = farmerStats(storeId, allFarmerIds, allFarmerNames);

  return {
    overview: {
      sales: direct.sales + executiveTotals.sales,
      collection: direct.collection + executiveTotals.collection,
      outstanding: direct.outstanding + executiveTotals.outstanding,
      farmers: overviewFarmers.farmers,
      farms: overviewFarmers.farms,
      crops: overviewFarmers.crops,
      visits: visits.filter((visit) => inPeriod(visit.date, filter)).length,
    },
    direct,
    executives,
  };
}
