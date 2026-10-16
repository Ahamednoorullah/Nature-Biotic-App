import {
  getFarmersByStore,
  getFROCashPosition,
  getStaffRecords,
  settleLinkedFarmerAccounts,
  type Farmer,
  type Staff,
} from "@/lib/data";
import { roleForStaffDesignation } from "@/lib/auth/roles";
import {
  businessDate,
  formatDate,
  matchesSimpleDate,
  type SimpleDateFilter,
} from "@/lib/format";
import type { StoreDashboardLedger } from "@/lib/db/operations";

export type DateFilter =
  | "today"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

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
const RECEIPT_KEY = "nature-biotic-store-receipts-v3";
const VISIT_KEY = "nature-biotic-fro-visits-v1";

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

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = String(row?.id || row?.receiptNo || row?.invoiceNo || row?.returnNo || row?.refundNo || "");
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isVoidRefund(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  return (
    value === "cancelled" ||
    value === "canceled" ||
    value === "rejected" ||
    value === "void" ||
    value === "invalid"
  );
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
    case "custom":
      // Custom ranges use matchesSimpleDate(from, to); default bounds unused.
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
  }
  return { start, end };
}

export function inPeriod(
  value: unknown,
  filter: DateFilter,
  from = "",
  to = "",
) {
  // Asia/Kolkata business-date boundaries (shared with list pages).
  return matchesSimpleDate(
    String(value ?? ""),
    filter as SimpleDateFilter,
    from,
    to,
  );
}

const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function kolkataCalendar(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[read("weekday")];
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: weekday ?? 0,
  };
}

function kolkataMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - KOLKATA_OFFSET_MS);
}

/** Inclusive start and exclusive end for a creation timestamp, in Asia/Kolkata. */
export function creationPeriod(filter: DateFilter, now = new Date()) {
  const { year, month, day, weekday } = kolkataCalendar(now);
  const todayStart = kolkataMidnight(year, month, day);
  if (filter === "today") {
    return { start: todayStart, end: new Date(todayStart.getTime() + 86400000) };
  }
  if (filter === "weekly") {
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
    const start = new Date(todayStart.getTime() - daysFromMonday * 86400000);
    return { start, end: new Date(start.getTime() + 7 * 86400000) };
  }
  if (filter === "monthly") {
    const start = kolkataMidnight(year, month, 1);
    const end = month === 12 ? kolkataMidnight(year + 1, 1, 1) : kolkataMidnight(year, month + 1, 1);
    return { start, end };
  }
  if (filter === "quarterly") {
    const quarterMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const start = kolkataMidnight(year, quarterMonth, 1);
    const nextMonth = quarterMonth + 3;
    const end = nextMonth > 12 ? kolkataMidnight(year + 1, nextMonth - 12, 1) : kolkataMidnight(year, nextMonth, 1);
    return { start, end };
  }
  return { start: kolkataMidnight(year, 1, 1), end: kolkataMidnight(year + 1, 1, 1) };
}

export function createdInPeriod(
  value: unknown,
  filter: DateFilter,
  now = new Date(),
  from = "",
  to = "",
) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (filter === "custom") {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))
      ? raw.slice(0, 10)
      : businessDate(new Date(raw));
    if (!day || day === "Invalid Date") return false;
    return matchesSimpleDate(day, "custom", from, to);
  }
  const created = new Date(raw);
  if (Number.isNaN(created.getTime())) return false;
  const { start, end } = creationPeriod(filter, now);
  return created >= start && created < end;
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

function periodFarmCropCounts(storeId: string, filter: DateFilter) {
  let farms = 0;
  let crops = 0;

  getFarmersByStore(storeId).forEach((farmer) => {
    const record = farmer as Farmer & {
      farms?: Array<{ createdAt?: string; date?: string }>;
    };
    const farmList = Array.isArray(record.farms) ? record.farms : [];

    if (farmList.length > 0) {
      farmList.forEach((farm) => {
        const farmDate = String(
          farm.createdAt || farm.date || farmer.joinedDate || "",
        );
        if (inPeriod(farmDate, filter)) farms += 1;
      });
    } else if (farmer.farmAddress && inPeriod(farmer.joinedDate, filter)) {
      farms += 1;
    }

    const cropRows = Array.isArray(farmer.crops) ? farmer.crops : [];
    if (cropRows.length > 0) {
      cropRows.forEach((crop) => {
        const cropDate = String(
          (crop as { createdAt?: string; date?: string }).createdAt ||
            (crop as { date?: string }).date ||
            farmer.joinedDate ||
            "",
        );
        if (inPeriod(cropDate, filter)) crops += 1;
      });
    } else if (farmer.cropType && inPeriod(farmer.joinedDate, filter)) {
      crops += 1;
    }
  });

  return { farms, crops };
}

function farmerStats(storeId: string, farmerIds: Set<string>, farmerNames: Set<string>) {
  const farmers = getFarmersByStore(storeId).filter((farmer) => {
    if (farmerIds.has(String(farmer.id))) return true;
    return farmerNames.has(farmer.name.trim().toLowerCase());
  });
  const cropNames = new Set<string>();
  let farms = 0;
  farmers.forEach((farmer) => {
    const farmList = (farmer as Farmer & { farms?: unknown[] }).farms;
    if (Array.isArray(farmList) && farmList.length > 0) {
      farms += farmList.length;
    } else if (farmer.farmAddress) {
      farms += 1;
    }
    const crops = Array.isArray(farmer.crops) ? farmer.crops : [];
    if (crops.length === 0 && farmer.cropType) {
      cropNames.add(String(farmer.cropType));
      return;
    }
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

export function directSalesFromInvoices(
  storeId: string,
  filter: DateFilter,
  invoices: Array<{
    date?: string;
    invoiceNo?: string;
    through?: string;
    partyName?: string;
    farmerId?: string;
    farmerVillage?: string;
    farmerPhone?: string;
    amount?: number;
    status?: string;
  }>,
): ChannelSummary {
  const direct: ChannelSummary = {
    sales: 0,
    collection: 0,
    outstanding: 0,
    farmers: 0,
    farms: 0,
    crops: 0,
    salesRows: [],
    collectionRows: [],
    outstandingRows: [],
  };
  const farmerIds = new Set<string>();
  const farmerNames = new Set<string>();

  invoices.forEach((invoice) => {
    const status = String(invoice.status || "").toLowerCase();
    if (status === "cancelled") return;
    if (String(invoice.through || "").toLowerCase() === "executive") return;
    if (!inPeriod(invoice.date, filter)) return;
    const net = Math.max(0, money(invoice.amount));
    if (net <= 0) return;
    direct.sales += net;
    direct.outstanding += net;
    const farmerName = String(invoice.partyName || "-");
    const farmerId = String(invoice.farmerId || "").trim();
    if (farmerId) farmerIds.add(farmerId);
    else if (farmerName.trim() && farmerName !== "-") {
      farmerNames.add(farmerName.trim().toLowerCase());
    }
    direct.salesRows.push({
      date: displayDate(invoice.date),
      invoiceNo: String(invoice.invoiceNo || ""),
      receiptNo: "",
      farmer: farmerName,
      amount: net,
      method: "Direct",
      village: "",
      phone: "",
      ageing: "",
    });
    direct.outstandingRows.push({
      date: displayDate(invoice.date),
      invoiceNo: String(invoice.invoiceNo || ""),
      receiptNo: "",
      farmer: farmerName,
      amount: net,
      method: "",
      village: String(invoice.farmerVillage || "-"),
      phone: String(invoice.farmerPhone || "-"),
      ageing: ageingLabel(parseTxnDate(invoice.date)),
    });
  });

  const stats = farmerStats(storeId, farmerIds, farmerNames);
  direct.farmers = stats.farmers;
  direct.farms = stats.farms;
  direct.crops = stats.crops;
  return direct;
}

export function buildStoreDashboard(storeId: string, filter: DateFilter) {
  const invoices = uniqueRows(readRows(`${SALES_KEY}:${storeId}`)).filter(
    (row) => row.id !== "store-sale-1" && String(row.invoiceNo || "").toLowerCase() !== "nb-inv-2001",
  );
  const returns = uniqueRows(readRows(`${RETURN_KEY}:${storeId}`));
  const receipts = uniqueRows(readRows(`${RECEIPT_KEY}:${storeId}`));
  const refunds = uniqueRows(readRows(`nature-biotic-store-refunds-v2:${storeId}`));
  const visits = readRows(`${VISIT_KEY}:${storeId}`);
  const officers = getStaffRecords().filter(
    (member) => member.storeId === storeId && member.status !== "Inactive" && isFieldOfficer(member),
  );

  const returned = new Map<string, number>();
  returns.forEach((row) => {
    const status = String(row.status || "approved").trim().toLowerCase();
    if (status !== "approved") return;
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

  const resettle = (channel: ChannelSummary, officer?: Staff) => {
    const owns = (row: any, invoice?: any) => {
      const through = String(row?.through || invoice?.through || "").toLowerCase();
      const matched =
        through === "executive"
          ? matchOfficer({
              ...invoice,
              ...row,
              executiveName:
                row?.executiveName || row?.receivedBy || invoice?.executiveName,
              staffId: row?.staffId || row?.createdByStaffId || invoice?.staffId,
            })
          : undefined;
      if (officer) return matched?.id === officer.id;
      return through !== "executive";
    };
    const periodInvoices = invoices.filter(
      (invoice) => inPeriod(invoice.date, filter) && owns(invoice),
    );
    const invoiceNos = new Set(
      periodInvoices
        .map((invoice) => String(invoice.invoiceNo || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const includedReturns = returns.filter((row) => {
      if (row.status === "Rejected") return false;
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      const invoice = invoiceByNo.get(invoiceNo);
      if (!owns(row, invoice)) return false;
      return inPeriod(row.date || row.returnDate, filter) || invoiceNos.has(invoiceNo);
    });
    const returnNos = new Set(
      includedReturns
        .map((row) => String(row.returnNo || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const includedReceipts = receipts.filter((row) => {
      if (!inPeriod(row.date, filter)) return false;
      const invoice = invoiceByNo.get(String(row.invoiceNo || "").trim().toLowerCase());
      const receiptStaff = String(
        row.createdByStaffId || row.staffId || row.froId || "",
      );
      if (receiptStaff || row.receivedBy) {
        const receiptOfficer = matchOfficer({
          staffId: receiptStaff,
          createdByStaffId: receiptStaff,
          executiveName: row.receivedBy,
        });
        return officer
          ? receiptOfficer?.id === officer.id
          : !receiptOfficer;
      }
      return owns(
        { ...invoice, ...row, through: row.through || invoice?.through },
        invoice,
      );
    });
    const includedRefunds = refunds.filter((row) => {
      if (isVoidRefund(row.status)) return false;
      const salesReturn = returns.find(
        (item) =>
          String(item.returnNo || "")
            .trim()
            .toLowerCase() === String(row.referenceNo || "").trim().toLowerCase(),
      );
      const invoice = invoiceByNo.get(
        String(salesReturn?.invoiceNo || row.invoiceNo || "")
          .trim()
          .toLowerCase(),
      );
      const linked = returnNos.has(String(row.referenceNo || "").trim().toLowerCase());
      if (!inPeriod(row.date, filter) && !linked) return false;
      return owns(
        {
          ...row,
          through: row.through || salesReturn?.through || invoice?.through,
          executiveName:
            row.executiveName ||
            salesReturn?.executiveName ||
            invoice?.executiveName,
        },
        invoice,
      );
    });
    const settled = settleLinkedFarmerAccounts({
      invoices: periodInvoices,
      receipts: includedReceipts,
      returns: includedReturns,
      refunds: includedRefunds,
      linkInvoices: invoices,
      linkReturns: returns,
    });
    const currentInvoices = invoices.filter((invoice) => owns(invoice));
    const currentReturns = returns.filter((row) => {
      if (row.status === "Rejected") return false;
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      return owns(row, invoiceByNo.get(invoiceNo));
    });
    const currentReceipts = receipts.filter((row) => {
      const invoice = invoiceByNo.get(String(row.invoiceNo || "").trim().toLowerCase());
      const receiptStaff = String(
        row.createdByStaffId || row.staffId || row.froId || "",
      );
      if (receiptStaff || row.receivedBy) {
        const receiptOfficer = matchOfficer({
          staffId: receiptStaff,
          createdByStaffId: receiptStaff,
          executiveName: row.receivedBy,
        });
        return officer
          ? receiptOfficer?.id === officer.id
          : !receiptOfficer;
      }
      return owns(
        { ...invoice, ...row, through: row.through || invoice?.through },
        invoice,
      );
    });
    const currentRefunds = refunds.filter((row) => {
      if (isVoidRefund(row.status)) return false;
      const salesReturn = returns.find(
        (item) =>
          String(item.returnNo || "")
            .trim()
            .toLowerCase() === String(row.referenceNo || "").trim().toLowerCase(),
      );
      const invoice = invoiceByNo.get(
        String(salesReturn?.invoiceNo || row.invoiceNo || "")
          .trim()
          .toLowerCase(),
      );
      return owns(
        {
          ...row,
          through: row.through || salesReturn?.through || invoice?.through,
          executiveName:
            row.executiveName ||
            salesReturn?.executiveName ||
            invoice?.executiveName,
        },
        invoice,
      );
    });
    const current = settleLinkedFarmerAccounts({
      invoices: currentInvoices,
      receipts: currentReceipts,
      returns: currentReturns,
      refunds: currentRefunds,
      linkInvoices: invoices,
      linkReturns: returns,
    });
    channel.sales = settled.sales;
    channel.collection = settled.collection;
    channel.outstanding = current.outstanding;
    channel.outstandingRows = current.outstandingRows.map((row) => ({
      date: "-",
      invoiceNo: "",
      receiptNo: "",
      farmer: row.farmerName,
      amount: row.amount,
      method: "",
      village: "-",
      phone: "-",
      ageing: "",
    }));
    settled.collectionAdjustments.forEach((row) => {
      channel.collectionRows.push({
        date: "-",
        invoiceNo: "",
        receiptNo: row.ref,
        farmer: row.farmerName,
        amount: row.amount,
        method: "Refund",
        village: "",
        phone: "",
        ageing: "",
      });
    });
  };

  resettle(direct);
  officers.forEach((officer) => resettle(byOfficer.get(officer.id)!, officer));

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
      collectionInHand: getFROCashPosition(storeId, officer.name, officer.id).cashInHand,
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
      cashRows: getFROCashPosition(storeId, officer.name, officer.id).lines.map((line) => ({
        date: displayDate(line.date),
        invoiceNo: "",
        receiptNo: line.ref,
        farmer: line.party,
        amount: line.amount,
        method: "Cash",
        village: "",
        phone: "",
        ageing: "",
      })),
      outstandingRows: channel.outstandingRows,
    };
  });

  const overviewFarmers = farmerStats(storeId, allFarmerIds, allFarmerNames);
  const recorded = periodFarmCropCounts(storeId, filter);

  return {
    overview: {
      sales: direct.sales + executiveTotals.sales,
      collection: direct.collection + executiveTotals.collection,
      outstanding: direct.outstanding + executiveTotals.outstanding,
      farmers: overviewFarmers.farmers,
      farms: recorded.farms,
      crops: recorded.crops,
      visits: visits.filter((visit) => inPeriod(visit.date, filter)).length,
    },
    direct,
    executives,
  };
}

function blankChannel(): ChannelSummary {
  return {
    sales: 0,
    collection: 0,
    outstanding: 0,
    farmers: 0,
    farms: 0,
    crops: 0,
    salesRows: [],
    collectionRows: [],
    outstandingRows: [],
  };
}

export function summarizeStoreLedger(
  ledger: StoreDashboardLedger,
  filter: DateFilter,
  from = "",
  to = "",
) {
  const officerIds = new Set(ledger.officers.map((officer) => officer.id));
  const invoiceById = new Map(ledger.invoices.map((invoice) => [invoice.id, invoice]));
  const direct = blankChannel();
  const residual = blankChannel();
  const byOfficer = new Map<string, ChannelSummary>();
  ledger.officers.forEach((officer) => byOfficer.set(officer.id, blankChannel()));

  const channelFor = (channel: string, staffId: string) => {
    if (staffId && officerIds.has(staffId)) return byOfficer.get(staffId) || residual;
    if (String(channel || "").toLowerCase() === "executive") return residual;
    return direct;
  };

  ledger.invoices.forEach((invoice) => {
    if (String(invoice.status || "").toLowerCase() !== "final") return;
    if (!inPeriod(invoice.date, filter, from, to)) return;
    const channel = channelFor(invoice.channel, invoice.staffId);
    channel.sales += invoice.amount;
    channel.salesRows.push({
      date: displayDate(invoice.date),
      invoiceNo: invoice.invoiceNo,
      receiptNo: "",
      farmer: invoice.partyName || "-",
      amount: invoice.amount,
      method: String(invoice.channel).toLowerCase() === "executive" ? "Executive" : "Direct",
      village: invoice.village,
      phone: invoice.phone,
      ageing: "",
    });
  });

  ledger.salesReturns.forEach((salesReturn) => {
    if (String(salesReturn.status || "").toLowerCase() !== "approved") return;
    if (!inPeriod(salesReturn.date, filter, from, to)) return;
    const invoice = invoiceById.get(salesReturn.salesInvoiceId);
    const channel = channelFor(
      salesReturn.channel || invoice?.channel || "direct",
      salesReturn.staffId || invoice?.staffId || "",
    );
    channel.sales -= salesReturn.amount;
    channel.salesRows.push({
      date: displayDate(salesReturn.date),
      invoiceNo: salesReturn.returnNo,
      receiptNo: invoice?.invoiceNo || "",
      farmer: invoice?.partyName || "-",
      amount: -salesReturn.amount,
      method: "Sales Return",
      village: invoice?.village || "",
      phone: invoice?.phone || "",
      ageing: "",
    });
  });

  ledger.receipts.forEach((receipt) => {
    if (String(receipt.status || "").toLowerCase() !== "final") return;
    if (!inPeriod(receipt.date, filter, from, to)) return;
    const invoice = invoiceById.get(receipt.salesInvoiceId);
    const channel = channelFor(invoice?.channel || "direct", receipt.staffId || invoice?.staffId || "");
    channel.collection += receipt.amount;
    channel.collectionRows.push({
      date: displayDate(receipt.date),
      invoiceNo: invoice?.invoiceNo || "",
      receiptNo: receipt.receiptNo,
      farmer: receipt.farmerName || invoice?.partyName || "-",
      amount: receipt.amount,
      method: receipt.method,
      village: invoice?.village || "",
      phone: invoice?.phone || "",
      ageing: "",
    });
  });

  ledger.refunds.forEach((refund) => {
    if (String(refund.status || "").toLowerCase() !== "final") return;
    if (!inPeriod(refund.date, filter, from, to)) return;
    if (refund.cashPaid <= 0) return;
    const invoice = invoiceById.get(refund.salesInvoiceId);
    const channel = channelFor(
      refund.channel || invoice?.channel || "direct",
      refund.staffId || invoice?.staffId || "",
    );
    channel.collection -= refund.cashPaid;
    channel.collectionRows.push({
      date: displayDate(refund.date),
      invoiceNo: invoice?.invoiceNo || "",
      receiptNo: refund.refundNo,
      farmer: refund.farmerName || invoice?.partyName || "-",
      amount: -refund.cashPaid,
      method: "Refund",
      village: "",
      phone: "",
      ageing: "",
    });
  });

  ledger.outstanding.forEach((row) => {
    if (row.outstanding <= 0) return;
    const channel = channelFor(row.channel, row.staffId);
    channel.outstanding += row.outstanding;
    channel.outstandingRows.push({
      date: displayDate(row.date),
      invoiceNo: row.invoiceNo,
      receiptNo: "",
      farmer: row.partyName || "-",
      amount: row.outstanding,
      method: "",
      village: row.village || "-",
      phone: row.phone || "-",
      ageing: ageingLabel(parseTxnDate(row.date)),
    });
  });

  const createdFarmerIds = new Set(
    ledger.farmers
      .filter((farmer) => farmer.id && createdInPeriod(farmer.createdAt, filter, undefined, from, to))
      .map((farmer) => farmer.id),
  );
  const directFarmerIds = new Set(
    ledger.farmers
      .filter(
        (farmer) =>
          farmer.id &&
          farmer.channel === "direct" &&
          createdInPeriod(farmer.createdAt, filter, undefined, from, to),
      )
      .map((farmer) => farmer.id),
  );
  const farmIds = new Set<string>();
  const cropIds = new Set<string>();
  ledger.farmers.forEach((farmer) => {
    farmer.farms.forEach((farm) => {
      if (farm.id && createdInPeriod(farm.createdAt, filter, undefined, from, to)) farmIds.add(farm.id);
    });
    farmer.crops.forEach((crop) => {
      if (crop.id && createdInPeriod(crop.createdAt, filter, undefined, from, to)) cropIds.add(crop.id);
    });
  });

  direct.farmers = directFarmerIds.size;
  const executives: ExecutiveDashboard[] = ledger.officers.map((officer, index) => {
    const channel = byOfficer.get(officer.id) || blankChannel();
    return {
      id: officer.id,
      name: officer.name,
      color: colors[index % colors.length],
      sales: channel.sales,
      collection: channel.collection,
      collectionInHand: ledger.cashByStaff?.[officer.id] ?? 0,
      outstanding: channel.outstanding,
      farmers: new Set(
        ledger.farmers
          .filter(
            (farmer) =>
              farmer.id &&
              farmer.staffId === officer.id &&
              createdInPeriod(farmer.createdAt, filter, undefined, from, to),
          )
          .map((farmer) => farmer.id),
      ).size,
      farms: 0,
      crops: 0,
      visits: ledger.visits.filter(
        (visit) => visit.staffId === officer.id && inPeriod(visit.date, filter, from, to),
      ).length,
      target: {
        sales: periodTarget(officer.targetSales, filter, officer.joinedDate),
        farmers: Math.round(periodTarget(officer.targetFarmers, filter, officer.joinedDate)),
        farms: Math.round(periodTarget(officer.targetFarms, filter, officer.joinedDate)),
        visits: Math.round(periodTarget(officer.targetVisits, filter, officer.joinedDate)),
      },
      salesRows: channel.salesRows,
      collectionRows: channel.collectionRows,
      cashRows: (ledger.cashLines || [])
        .filter((line) => line.staffId === officer.id && inPeriod(line.date, filter, from, to))
        .map((line) => ({
          date: displayDate(line.date),
          invoiceNo: "",
          receiptNo: line.ref,
          farmer: line.farmerName,
          amount: line.amount,
          method: "Cash",
          village: line.village,
          phone: line.phone,
          ageing: "",
        })),
      outstandingRows: channel.outstandingRows,
    };
  });

  const purchases = ledger.purchases.filter((row) => inPeriod(row.date, filter, from, to));
  return {
    overview: {
      sales: direct.sales + residual.sales + executives.reduce((sum, officer) => sum + officer.sales, 0),
      collection:
        direct.collection +
        residual.collection +
        executives.reduce((sum, officer) => sum + officer.collection, 0),
      outstanding:
        direct.outstanding +
        residual.outstanding +
        executives.reduce((sum, officer) => sum + officer.outstanding, 0),
      farmers: createdFarmerIds.size,
      farms: farmIds.size,
      crops: cropIds.size,
      visits: ledger.visits.filter((visit) => inPeriod(visit.date, filter, from, to)).length,
    },
    direct,
    executives,
    stockCostValue: ledger.stockCostValue,
    purchases,
    receivedTotal: purchases.reduce((sum, row) => sum + row.total, 0),
  };
}

export function summarizeFroAccounts(
  ledger: Pick<StoreDashboardLedger, "invoices" | "receipts" | "refunds" | "salesReturns" | "outstanding">,
  staffId: string,
  filter: DateFilter,
  from = "",
  to = "",
) {
  const owns = (id: string) => Boolean(staffId) && id === staffId;
  const invoiceById = new Map(ledger.invoices.map((invoice) => [invoice.id, invoice]));
  const salesRows: Array<{
    date: string;
    invoiceNo: string;
    farmerName: string;
    village: string;
    phone: string;
    amount: number;
  }> = [];
  const collectionRows: Array<{
    date: string;
    receiptNo: string;
    farmerName: string;
    village: string;
    phone: string;
    amount: number;
  }> = [];
  const outstandingRows: Array<{
    date: string;
    invoiceNo: string;
    farmerName: string;
    village: string;
    phone: string;
    amount: number;
  }> = [];
  const seenInvoices = new Set<string>();
  let sales = 0;
  ledger.invoices.forEach((invoice) => {
    if (!invoice.id || seenInvoices.has(invoice.id)) return;
    if (String(invoice.status || "").toLowerCase() !== "final") return;
    if (!owns(invoice.staffId)) return;
    if (!inPeriod(invoice.date, filter, from, to)) return;
    seenInvoices.add(invoice.id);
    sales += invoice.amount;
    salesRows.push({
      date: invoice.date,
      invoiceNo: invoice.invoiceNo,
      farmerName: invoice.partyName || "-",
      village: invoice.village || "-",
      phone: invoice.phone || "-",
      amount: invoice.amount,
    });
  });
  const seenReturns = new Set<string>();
  ledger.salesReturns.forEach((salesReturn) => {
    if (!salesReturn.id || seenReturns.has(salesReturn.id)) return;
    if (String(salesReturn.status || "").toLowerCase() !== "approved") return;
    const invoice = invoiceById.get(salesReturn.salesInvoiceId);
    if (!owns(salesReturn.staffId || invoice?.staffId || "")) return;
    if (!inPeriod(salesReturn.date, filter, from, to)) return;
    seenReturns.add(salesReturn.id);
    sales -= salesReturn.amount;
    salesRows.push({
      date: salesReturn.date,
      invoiceNo: salesReturn.returnNo,
      farmerName: invoice?.partyName || "-",
      village: invoice?.village || "-",
      phone: invoice?.phone || "-",
      amount: -salesReturn.amount,
    });
  });

  const seenReceipts = new Set<string>();
  let collection = 0;
  ledger.receipts.forEach((receipt) => {
    if (!receipt.id || seenReceipts.has(receipt.id)) return;
    if (String(receipt.status || "").toLowerCase() !== "final") return;
    const invoice = invoiceById.get(receipt.salesInvoiceId);
    if (!owns(receipt.staffId || invoice?.staffId || "")) return;
    if (!inPeriod(receipt.date, filter, from, to)) return;
    seenReceipts.add(receipt.id);
    collection += receipt.amount;
    collectionRows.push({
      date: receipt.date,
      receiptNo: receipt.receiptNo,
      farmerName: receipt.farmerName || invoice?.partyName || "-",
      village: invoice?.village || "-",
      phone: invoice?.phone || "-",
      amount: receipt.amount,
    });
  });
  const seenRefunds = new Set<string>();
  ledger.refunds.forEach((refund) => {
    if (!refund.id || seenRefunds.has(refund.id)) return;
    if (String(refund.status || "").toLowerCase() !== "final") return;
    if (refund.cashPaid <= 0) return;
    const invoice = invoiceById.get(refund.salesInvoiceId);
    if (!owns(refund.staffId || invoice?.staffId || "")) return;
    if (!inPeriod(refund.date, filter, from, to)) return;
    seenRefunds.add(refund.id);
    collection -= refund.cashPaid;
    collectionRows.push({
      date: refund.date,
      receiptNo: refund.refundNo,
      farmerName: refund.farmerName || invoice?.partyName || "-",
      village: invoice?.village || "-",
      phone: invoice?.phone || "-",
      amount: -refund.cashPaid,
    });
  });

  const seenOutstanding = new Set<string>();
  let outstanding = 0;
  ledger.outstanding.forEach((row) => {
    if (!row.salesInvoiceId || seenOutstanding.has(row.salesInvoiceId)) return;
    if (!owns(row.staffId)) return;
    if (row.outstanding <= 0) return;
    seenOutstanding.add(row.salesInvoiceId);
    outstanding += row.outstanding;
    outstandingRows.push({
      date: row.date,
      invoiceNo: row.invoiceNo,
      farmerName: row.partyName || "-",
      village: row.village || "-",
      phone: row.phone || "-",
      amount: row.outstanding,
    });
  });

  return { sales, collection, outstanding, salesRows, collectionRows, outstandingRows };
}
