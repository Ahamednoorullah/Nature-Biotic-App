import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getFarmersByStore,
  getStore,
  getFROStockTxnsByExecutive,
} from "@/lib/data";
import { Card, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

const filters: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

type Summary = {
  sales: number;
  collection: number;
  cash: number;
  outstanding: number;
  visits: number;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseDataDate(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // YYYY-MM-DD / ISO timestamps
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD/MM/YY
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (slash) {
    const year =
      slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
    const d = new Date(year, Number(slash[2]) - 1, Number(slash[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateRange(filter: DateFilter, now = new Date()): [Date, Date] {
  const today = startOfDay(now);

  if (filter === "today") {
    return [today, endOfDay(today)];
  }

  if (filter === "weekly") {
    // Sunday -> Saturday
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [start, endOfDay(end)];
  }

  if (filter === "monthly") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return [start, endOfDay(end)];
  }

  if (filter === "quarterly") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const start = new Date(today.getFullYear(), quarterStartMonth, 1);
    const end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
    return [start, endOfDay(end)];
  }

  // Financial year: April 1 -> March 31.
  const fyStartYear =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const start = new Date(fyStartYear, 3, 1);
  const end = new Date(fyStartYear + 1, 2, 31);
  return [start, endOfDay(end)];
}

function inSelectedRange(value: unknown, filter: DateFilter) {
  const date = parseDataDate(value);
  if (!date) return false;
  const [start, end] = getDateRange(filter);
  return date >= start && date <= end;
}

type DetailKind =
  | "sales"
  | "collection"
  | "cash"
  | "outstanding"
  | "visits"
  | "stockReceived"
  | "handStock"
  | "farmers";

type DetailRow = Record<string, string | number>;

function readStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dateLabel(value: string) {
  if (!value) return "-";
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function DetailsPage({
  kind,
  rows,
  onBack,
}: {
  kind: DetailKind;
  rows: DetailRow[];
  onBack: () => void;
}) {
  const titles: Record<DetailKind, string> = {
    sales: "Sales",
    collection: "Collection",
    cash: "Cash in Hand",
    outstanding: "Outstanding",
    visits: "Visits",
    stockReceived: "Stock Received",
    handStock: "Hand Stock",
    farmers: "Farmers",
  };

  const columns: Record<
    DetailKind,
    { key: string; label: string; cls?: string }[]
  > = {
    sales: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Inv No" },
      { key: "farmerDetails", label: "Farmer Details" },
      { key: "amount", label: "Amount", cls: "text-right" },
    ],
    collection: [
      { key: "date", label: "Date" },
      { key: "receiptNo", label: "Rec No" },
      { key: "farmerDetails", label: "Farmer Details" },
      { key: "amount", label: "Amount", cls: "text-right" },
    ],
    cash: [
      { key: "date", label: "Date" },
      { key: "farmerDetails", label: "Farmer Details" },
      { key: "amount", label: "Amount", cls: "text-right" },
    ],
    outstanding: [
      { key: "date", label: "Date" },
      { key: "farmerDetails", label: "Farmer Details" },
      { key: "amount", label: "Amount", cls: "text-right" },
    ],
    visits: [
      { key: "farmerDetails", label: "Farmer Details" },
      { key: "count", label: "Count", cls: "text-center" },
      { key: "lastVisit", label: "Last Visit Date" },
    ],
    stockReceived: [
      { key: "date", label: "Date" },
      { key: "product", label: "Product-Size" },
      { key: "qty", label: "Qty", cls: "text-center" },
      { key: "value", label: "Value", cls: "text-right" },
    ],
    handStock: [
      { key: "sno", label: "S.No", cls: "text-center" },
      { key: "product", label: "Product-Size" },
      { key: "qty", label: "Qty", cls: "text-center" },
      { key: "value", label: "Value", cls: "text-right" },
    ],
    farmers: [
      { key: "sno", label: "S.No", cls: "text-center" },
      { key: "farmer", label: "Farmer" },
      { key: "village", label: "Village" },
      { key: "phone", label: "Phone No" },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-3 sm:px-5 sm:pt-4 lg:px-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95"
          aria-label="Back to dashboard"
        >
          <Icon name="arrow_back" size={20} />
        </button>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
            FRO Dashboard
          </p>
          <h2 className="truncate text-lg font-extrabold text-slate-800">
            {titles[kind]}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns[kind].map((col) => (
                <th
                  key={col.key}
                  className={`px-1.5 py-2.5 text-[8px] font-bold uppercase tracking-wide text-slate-500 sm:px-2 sm:text-[9px] md:px-3 md:text-[10px] ${col.cls || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={`${kind}-${index}`}
                  className="align-middle hover:bg-slate-50"
                >
                  {columns[kind].map((col) => (
                    <td
                      key={col.key}
                      className={`min-w-0 break-words px-1.5 py-2.5 text-[9px] leading-tight text-slate-700 sm:px-2 sm:text-[10px] md:px-3 md:py-3 md:text-xs ${col.cls || ""}`}
                    >
                      {col.key === "amount" || col.key === "value" ? (
                        <span className="whitespace-nowrap font-semibold">
                          {formatCurrency(Number(row[col.key] || 0))}
                        </span>
                      ) : col.key === "farmerDetails" ? (
                        <div className="min-w-0 leading-tight">
                          <div className="break-words font-semibold text-slate-800">
                            {String(row.farmerName ?? row.farmer ?? "-")}
                          </div>
                          <div className="break-words text-[8px] text-slate-500 sm:text-[9px] md:text-[10px]">
                            {String(row.village ?? "-")}
                          </div>
                          <div className="break-all text-[8px] text-slate-400 sm:text-[9px] md:text-[10px]">
                            {String(row.phone ?? "-")}
                          </div>
                        </div>
                      ) : (
                        <span className="break-words">
                          {String(row[col.key] ?? "-")}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns[kind].length}
                  className="px-4 py-10 text-center text-xs text-slate-400"
                >
                  No details available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FRODashboard({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    const refresh = () => setRefresh((x) => x + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-delivery-challan-updated", refresh);
    window.addEventListener("nature-biotic-fro-visits-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nature-biotic-delivery-challan-updated",
        refresh,
      );
      window.removeEventListener("nature-biotic-fro-visits-updated", refresh);
    };
  }, []);

  const store = getStore(storeId);
  if (!store || !user || user.role !== "fro") {
    return <EmptyState icon="error" title="FRO profile not found" />;
  }

  const froName = String(user.name || "")
    .trim()
    .toLowerCase();

  const sales = useMemo(() => {
    const rows = readStorage<any>(
      `nature-biotic-store-sales-invoices-v2:${storeId}`,
    );
    return rows
      .filter(
        (r) =>
          String(r.executiveName || "")
            .trim()
            .toLowerCase() === froName,
      )
      .map((r) => ({
        rawDate: r.date || r.createdAt || "",
        date: dateLabel(String(r.date || r.createdAt || "")),
        invoiceNo: r.invoiceNo || "-",
        farmerName: r.partyName || "Farmer",
        village: r.farmerVillage || "-",
        phone: r.farmerPhone || "-",
        amount: Number(r.amount || 0),
      }));
  }, [storeId, froName]);

  const collections = useMemo(() => {
    const rows = readStorage<any>(`nature-biotic-store-receipts-v3:${storeId}`);
    return rows
      .filter(
        (r) =>
          String(r.receivedBy || "")
            .trim()
            .toLowerCase() === froName,
      )
      .map((r) => ({
        rawDate: r.date || r.createdAt || "",
        date: dateLabel(String(r.date || r.createdAt || "")),
        receiptNo: r.receiptNo || "-",
        invoiceNo:
          String(r.invoiceNo || r.billNo || r.invoice || "").trim() || "-",
        farmerName: r.farmerName || "Farmer",
        village: r.village || "-",
        phone: r.phone || "-",
        amount: Number(r.amount || 0),
      }));
  }, [storeId, froName]);

  const stockReceived = useMemo(() => {
    const challans = readStorage<any>(
      `nature-biotic-store-delivery-challans-v2:${storeId}`,
    );
    return challans
      .filter(
        (c) =>
          String(c.executive || "")
            .trim()
            .toLowerCase() === froName,
      )
      .flatMap((c) =>
        (Array.isArray(c.items) ? c.items : []).map((item: any) => ({
          rawDate: c.date || c.createdAt || "",
          date: dateLabel(String(c.date || c.createdAt || "")),
          product: `${item.product || "-"} - ${item.packSize || "-"}`,
          qty: Number(item.qty || 0),
          value: Number(item.qty || 0) * Number(item.unitValue || 0),
        })),
      );
  }, [storeId, froName]);

  const froFarmers = useMemo(() => {
    const farmers = getFarmersByStore(storeId) || [];
    return farmers
      .filter(
        (farmer: any) =>
          String(farmer.executiveName || "")
            .trim()
            .toLowerCase() === froName,
      )
      .map((farmer: any, index: number) => ({
        sno: index + 1,
        farmer: farmer.name || "-",
        village: farmer.village || "-",
        phone: farmer.phone || "-",
      }));
  }, [storeId, froName]);

  const filteredSales = useMemo(
    () => sales.filter((row) => inSelectedRange(row.rawDate, dateFilter)),
    [sales, dateFilter],
  );

  const filteredCollections = useMemo(
    () => collections.filter((row) => inSelectedRange(row.rawDate, dateFilter)),
    [collections, dateFilter],
  );

  const filteredStockReceived = useMemo(
    () =>
      stockReceived.filter((row) => inSelectedRange(row.rawDate, dateFilter)),
    [stockReceived, dateFilter],
  );

  const cashRows = filteredCollections.map((r) => ({
    date: r.date,
    farmerName: r.farmerName,
    village: r.village,
    phone: r.phone,
    amount: r.amount,
  }));

  const receiptByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    collections.forEach((receipt) => {
      const invoiceNo = String(receipt.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo || invoiceNo === "-") return;
      map.set(
        invoiceNo,
        (map.get(invoiceNo) || 0) + Number(receipt.amount || 0),
      );
    });
    return map;
  }, [collections]);

  const outstandingRows = filteredSales
    .map((r) => {
      const invoiceNo = String(r.invoiceNo || "")
        .trim()
        .toLowerCase();
      const paid = receiptByInvoice.get(invoiceNo) || 0;
      return {
        date: r.date,
        farmerName: r.farmerName,
        village: r.village,
        phone: r.phone,
        amount: Math.max(Number(r.amount || 0) - paid, 0),
      };
    })
    .filter((r) => r.amount > 0);

  // Visit records are read from the existing visit-related localStorage data.
  // Multiple visit storage keys are supported so the dashboard does not depend
  // on one hard-coded key name.
  const visitRecords = useMemo(() => {
    const found: any[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (!/visit/i.test(key)) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          found.push(...parsed);
        } else if (parsed && Array.isArray(parsed.visits)) {
          found.push(...parsed.visits);
        }
      }
    } catch {}

    return found;
  }, [froName]);

  const visitRows = useMemo(() => {
    const assigned = new Set(
      froFarmers
        .map((f) =>
          String(f.farmer || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );

    const grouped = new Map<
      string,
      {
        farmerName: string;
        village: string;
        phone: string;
        count: number;
        lastVisitRaw: string;
      }
    >();

    visitRecords.forEach((v: any) => {
      const farmerName = String(
        v.farmerName ?? v.farmer ?? v.customerName ?? v.partyName ?? "",
      ).trim();

      if (!farmerName) return;

      const owner = String(
        v.executiveName ??
          v.froName ??
          v.createdBy ??
          v.userName ??
          v.ownerName ??
          "",
      )
        .trim()
        .toLowerCase();

      if (owner && owner !== froName) return;
      if (!owner && assigned.size && !assigned.has(farmerName.toLowerCase()))
        return;

      const village =
        String(v.village ?? v.farmerVillage ?? v.location ?? "").trim() || "-";
      const phone =
        String(v.phone ?? v.farmerPhone ?? v.mobile ?? "").trim() || "-";
      const visitDate = String(
        v.visitDate ?? v.date ?? v.createdAt ?? "",
      ).trim();

      const key = farmerName.toLowerCase();
      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, {
          farmerName,
          village,
          phone,
          count: 1,
          lastVisitRaw: visitDate,
        });
      } else {
        current.count += 1;
        if (
          visitDate &&
          (!current.lastVisitRaw ||
            new Date(visitDate).getTime() >
              new Date(current.lastVisitRaw).getTime())
        ) {
          current.lastVisitRaw = visitDate;
        }
        if (current.village === "-" && village !== "-")
          current.village = village;
        if (current.phone === "-" && phone !== "-") current.phone = phone;
      }
    });

    return Array.from(grouped.values())
      .sort(
        (a, b) =>
          b.count - a.count ||
          new Date(b.lastVisitRaw || 0).getTime() -
            new Date(a.lastVisitRaw || 0).getTime(),
      )
      .map((row) => ({
        farmerName: row.farmerName,
        village: row.village,
        phone: row.phone,
        count: row.count,
        rawDate: row.lastVisitRaw,
        lastVisit: row.lastVisitRaw ? dateLabel(row.lastVisitRaw) : "-",
      }));
  }, [visitRecords, froName, froFarmers]);

  const filteredVisitRows = useMemo(
    () => visitRows.filter((row) => inSelectedRange(row.rawDate, dateFilter)),
    [visitRows, dateFilter],
  );

  /*
   * Hand Stock is CURRENT stock, not a period total.
   * So Today / Weekly / Monthly / Quarterly / Yearly must all show the
   * same stock that is physically with this FRO right now.
   *
   * Stock flow:
   *   Delivery  -> +
   *   Sale      -> -
   *   Return    -> -
   *
   * We intentionally use ALL stock transactions here, without dateFilter.
   * Example: if 10 came yesterday and 3 were sold today, hand stock is 7
   * for Today, Weekly and Monthly alike. If all 10 were returned/sold,
   * current hand stock becomes 0.
   */
  const currentHandStock = useMemo(() => {
    const txns = getFROStockTxnsByExecutive(storeId, user?.name || "");

    const map = new Map<
      string,
      {
        product: string;
        qty: number;
        value: number;
        productId: string;
        packSize: string;
        batchNo: string;
        unitValue: number;
      }
    >();

    txns.forEach((txn: any) => {
      const qty = Number(txn.qty || 0);
      const key = [
        String(txn.productId || txn.productName || ""),
        String(txn.packSize || ""),
        String(txn.batchNo || ""),
      ].join("|");

      const existing = map.get(key);
      if (existing) {
        existing.qty += qty;
      } else {
        map.set(key, {
          product: `${txn.productName || "-"} - ${txn.packSize || "-"}`,
          qty,
          value: 0,
          productId: String(txn.productId || ""),
          packSize: String(txn.packSize || ""),
          batchNo: String(txn.batchNo || ""),
          unitValue: Number(txn.unitValue || 0),
        });
      }
    });

    return Array.from(map.values())
      .filter((row) => row.qty > 0)
      .map((row, index) => ({
        ...row,
        value: row.qty * row.unitValue,
        sno: index + 1,
      }));
  }, [storeId, user?.name]);

  const handStockValue = useMemo(
    () =>
      currentHandStock.reduce((sum, row) => sum + Number(row.value || 0), 0),
    [currentHandStock],
  );

  // Cash-in-hand follows the selected period:
  // collections received by this FRO - handovers - FRO expenses - refunds.
  const handovers = useMemo(
    () =>
      readStorage<any>(`nature-biotic-fro-handovers-v1:${storeId}`).filter(
        (row) =>
          (!row.handedOverBy ||
            String(row.handedOverBy).trim().toLowerCase() === froName) &&
          inSelectedRange(row.date || row.createdAt, dateFilter),
      ),
    [storeId, froName, dateFilter],
  );

  const froExpenses = useMemo(
    () =>
      readStorage<any>("naturebiotic_shared_expenses").filter(
        (row) =>
          String(row.enteredBy || "")
            .trim()
            .toLowerCase() === froName &&
          inSelectedRange(row.date || row.createdAt, dateFilter),
      ),
    [froName, dateFilter],
  );

  const froRefunds = useMemo(
    () =>
      readStorage<any>(`nature-biotic-fro-cash-refunds-v1:${storeId}`).filter(
        (row) => inSelectedRange(row.date || row.createdAt, dateFilter),
      ),
    [storeId, dateFilter],
  );

  const totalSales = filteredSales.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalCollection = filteredCollections.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalOutstanding = outstandingRows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalHandedOver = handovers.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalExpenses = froExpenses.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalRefunds = froRefunds.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const cashInHand = Math.max(
    totalCollection - totalHandedOver - totalExpenses - totalRefunds,
    0,
  );

  const stockReceivedValue = filteredStockReceived.reduce(
    (sum, row) => sum + Number(row.value || 0),
    0,
  );

  const farmerCount = froFarmers.filter((farmer: any) => {
    const rawDate =
      farmer.createdAt ||
      farmer.createdDate ||
      farmer.date ||
      farmer.joinedDate;
    return !rawDate || inSelectedRange(rawDate, dateFilter);
  }).length;

  const cards = [
    {
      label: "Sales",
      value: formatCurrency(totalSales),
      icon: "payments",
      kind: "sales" as DetailKind,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Collection",
      value: formatCurrency(totalCollection),
      icon: "account_balance_wallet",
      kind: "collection" as DetailKind,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Cash in Hand",
      value: formatCurrency(cashInHand),
      icon: "savings",
      kind: "cash" as DetailKind,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Outstanding",
      value: formatCurrency(totalOutstanding),
      icon: "receipt_long",
      kind: "outstanding" as DetailKind,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Visits",
      value: String(
        filteredVisitRows.reduce((sum, row) => sum + Number(row.count || 0), 0),
      ),
      icon: "event_available",
      kind: "visits" as DetailKind,
      tone: "bg-purple-50 text-purple-700",
    },
    {
      label: "Farmers",
      value: String(farmerCount),
      icon: "groups",
      kind: "farmers" as DetailKind,
      tone: "bg-purple-50 text-purple-700",
    },
    {
      label: "Stock Received",
      value: formatCurrency(stockReceivedValue),
      icon: "inventory_2",
      kind: "stockReceived" as DetailKind,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Hand Stock",
      value: formatCurrency(handStockValue),
      icon: "inventory",
      kind: "handStock" as DetailKind,
      tone: "bg-purple-50 text-purple-700",
    },
  ];

  const detailRows: Record<DetailKind, DetailRow[]> = {
    sales: filteredSales,
    collection: filteredCollections,
    cash: cashRows,
    outstanding: outstandingRows,
    visits: filteredVisitRows,
    stockReceived: filteredStockReceived,
    handStock: currentHandStock,
    farmers: froFarmers,
  };

  if (detail) {
    return (
      <DetailsPage
        kind={detail}
        rows={detailRows[detail]}
        onBack={() => setDetail(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={`min-w-0 flex-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold ${
                dateFilter === filter.key
                  ? "bg-brand-600 text-white"
                  : "text-slate-500"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Card
            key={card.label}
            onClick={() => setDetail(card.kind)}
            className="group flex min-h-[128px] cursor-pointer flex-col items-start justify-between rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition active:scale-[0.98]"
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}
              >
                <Icon name={card.icon} size={24} fill={false} />
              </span>
              <Icon name="chevron_right" size={18} className="text-slate-300" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-600">
                {card.label}
              </p>
              <p className="mt-1 text-[16px] font-extrabold text-slate-800">
                {card.value}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
