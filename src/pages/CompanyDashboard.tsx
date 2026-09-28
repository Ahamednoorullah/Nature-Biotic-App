import { useEffect, useState, useMemo } from "react";
import {
  stores as allStores,
  getStoreApprovalRequests,
  updateStoreApprovalRequestStatus,
  approveStorePurchaseOrder,
  storeApprovalRequestsUpdatedEvent,
  getCompanyStoreSales,
  getCompanyCreditNoteSyncRecords,
  type StoreApprovalRequest,
} from "@/lib/data";
import { useNav } from "@/context/NavContext";
import { Card, StatCard, Button, Icon } from "@/components/ui";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { createPortal } from "react-dom";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";
type ActualDetailView = "sales" | "collection" | "outstanding" | null;

const filterTabs: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

const STORE_SALES_KEY = "nature-biotic-store-sales-invoices-v2";
const STORE_RETURN_KEY = "nature-biotic-store-sales-returns-v2";
const STORE_CREDIT_KEY = "nature-biotic-store-credit-notes-v3";
const STORE_RECEIPT_KEY = "nature-biotic-store-receipts-v3";
const COMPANY_RECEIPT_KEY = "nature-biotic-company-receipts-v1";

type SalesDetail = {
  date: string;
  invoiceNo: string;
  storeName: string;
  value: number;
};

type CollectionDetail = {
  date: string;
  receiptNo: string;
  storeName: string;
  amount: number;
};

type OutstandingDetail = {
  storeName: string;
  under30: number;
  over30: number;
  over60: number;
  over90: number;
  totalAmount: number;
};

type StoreDashboardRow = {
  storeId: string;
  sales: number;
  collection: number;
  outstanding: number;
  farmers: number;
};

function readRows(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function parseTxnDate(value: unknown): Date | null {
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

function periodBounds(filter: DateFilter) {
  const now = new Date();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  let start: Date;

  switch (filter) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "weekly": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = start.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
      break;
    }
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarterly": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterStartMonth, 1);
      break;
    }
    case "yearly":
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return { start, end };
}

function inPeriod(value: unknown, filter: DateFilter) {
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

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function ageBucket(invoiceDate: Date | null) {
  if (!invoiceDate) return "under30" as const;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor(
    (today.getTime() - invoiceDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 30) return "under30" as const;
  if (days <= 60) return "over30" as const;
  if (days <= 90) return "over60" as const;
  return "over90" as const;
}

function buildAdminDashboard(filter: DateFilter) {
  const companyLines = getCompanyStoreSales();
  const companyInvoices = new Map<
    string,
    {
      invoiceNo: string;
      date: string;
      storeId: string;
      storeName: string;
      total: number;
    }
  >();

  companyLines.forEach((line) => {
    const invoiceNo = String(line.invoiceNo || "").trim();
    if (!invoiceNo) return;
    const key = `${line.storeId}|${invoiceNo}`;
    const existing = companyInvoices.get(key);
    if (existing) {
      existing.total += money(line.total);
      return;
    }
    companyInvoices.set(key, {
      invoiceNo,
      date: String(line.date || ""),
      storeId: String(line.storeId || ""),
      storeName: String(line.storeName || ""),
      total: money(line.total),
    });
  });

  const creditsByInvoice = new Map<string, number>();
  getCompanyCreditNoteSyncRecords().forEach((note) => {
    if (note.status === "Rejected") return;
    const invoiceNo = String(note.invoiceNo || note.purchaseRef || "")
      .trim()
      .toLowerCase();
    if (!invoiceNo) return;
    const key = `${note.storeId}|${invoiceNo}`;
    creditsByInvoice.set(
      key,
      (creditsByInvoice.get(key) || 0) + money(note.returnAmount),
    );
  });

  const companyReceipts = readRows(COMPANY_RECEIPT_KEY);
  const paidByInvoice = new Map<string, number>();
  companyReceipts.forEach((receipt) => {
    const invoiceNo = String(receipt.invoiceNo || "")
      .trim()
      .toLowerCase();
    if (!invoiceNo) return;
    const key = `${receipt.storeId || ""}|${invoiceNo}`;
    paidByInvoice.set(key, (paidByInvoice.get(key) || 0) + money(receipt.amount));
  });

  const actualSalesList: SalesDetail[] = [];
  const outstandingMap = new Map<string, OutstandingDetail>();
  let actualSales = 0;
  let actualOutstanding = 0;

  companyInvoices.forEach((invoice) => {
    if (!inPeriod(invoice.date, filter)) return;
    const invoiceKey = `${invoice.storeId}|${invoice.invoiceNo.trim().toLowerCase()}`;
    const net = Math.max(
      0,
      invoice.total - (creditsByInvoice.get(invoiceKey) || 0),
    );
    if (net <= 0) return;
    actualSales += net;
    actualSalesList.push({
      date: displayDate(invoice.date),
      invoiceNo: invoice.invoiceNo,
      storeName: invoice.storeName || "-",
      value: net,
    });

    const balance = Math.max(0, net - (paidByInvoice.get(invoiceKey) || 0));
    actualOutstanding += balance;
    if (balance <= 0) return;
    const bucket = ageBucket(parseTxnDate(invoice.date));
    const row = outstandingMap.get(invoice.storeName) || {
      storeName: invoice.storeName || "-",
      under30: 0,
      over30: 0,
      over60: 0,
      over90: 0,
      totalAmount: 0,
    };
    row[bucket] += balance;
    row.totalAmount += balance;
    outstandingMap.set(invoice.storeName, row);
  });

  const actualCollectionList: CollectionDetail[] = [];
  let actualCollection = 0;
  companyReceipts.forEach((receipt) => {
    if (!inPeriod(receipt.date, filter)) return;
    const amount = money(receipt.amount);
    if (amount <= 0) return;
    actualCollection += amount;
    actualCollectionList.push({
      date: displayDate(receipt.date),
      receiptNo: String(receipt.receiptNo || "-"),
      storeName: String(receipt.storeName || "-"),
      amount,
    });
  });

  const storeRows: StoreDashboardRow[] = allStores.map((store) => {
    const invoices = readRows(`${STORE_SALES_KEY}:${store.id}`);
    const returns = readRows(`${STORE_RETURN_KEY}:${store.id}`);
    const credits = readRows(`${STORE_CREDIT_KEY}:${store.id}`);
    const receipts = readRows(`${STORE_RECEIPT_KEY}:${store.id}`);

    const returnedByInvoice = new Map<string, number>();
    returns.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo) return;
      returnedByInvoice.set(
        invoiceNo,
        (returnedByInvoice.get(invoiceNo) || 0) + money(row.total),
      );
    });
    credits.forEach((row) => {
      if (row.status === "Rejected") return;
      const invoiceNo = String(row.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo) return;
      returnedByInvoice.set(
        invoiceNo,
        (returnedByInvoice.get(invoiceNo) || 0) + money(row.total),
      );
    });

    const receiptPaid = new Map<string, number>();
    receipts.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo) return;
      receiptPaid.set(
        invoiceNo,
        (receiptPaid.get(invoiceNo) || 0) + money(row.amount),
      );
    });

    let sales = 0;
    let outstanding = 0;
    const farmers = new Set<string>();

    invoices.forEach((invoice) => {
      if (!inPeriod(invoice.date, filter)) return;
      const invoiceNo = String(invoice.invoiceNo || "")
        .trim()
        .toLowerCase();
      const net = Math.max(
        0,
        money(invoice.amount) - (returnedByInvoice.get(invoiceNo) || 0),
      );
      if (net <= 0) return;
      sales += net;
      outstanding += Math.max(0, net - (receiptPaid.get(invoiceNo) || 0));
      const farmerKey = String(
        invoice.farmerId || invoice.partyName || "",
      ).trim();
      if (farmerKey) farmers.add(farmerKey.toLowerCase());
    });

    const collection = receipts.reduce((sum, receipt) => {
      if (!inPeriod(receipt.date, filter)) return sum;
      return sum + money(receipt.amount);
    }, 0);

    return {
      storeId: store.id,
      sales,
      collection,
      outstanding,
      farmers: farmers.size,
    };
  });

  const marketFarmers = new Set<string>();
  allStores.forEach((store) => {
    const invoices = readRows(`${STORE_SALES_KEY}:${store.id}`);
    const returns = readRows(`${STORE_RETURN_KEY}:${store.id}`);
    const credits = readRows(`${STORE_CREDIT_KEY}:${store.id}`);
    const returnedByInvoice = new Map<string, number>();
    returns.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo) return;
      returnedByInvoice.set(
        invoiceNo,
        (returnedByInvoice.get(invoiceNo) || 0) + money(row.total),
      );
    });
    credits.forEach((row) => {
      if (row.status === "Rejected") return;
      const invoiceNo = String(row.invoiceNo || "")
        .trim()
        .toLowerCase();
      if (!invoiceNo) return;
      returnedByInvoice.set(
        invoiceNo,
        (returnedByInvoice.get(invoiceNo) || 0) + money(row.total),
      );
    });
    invoices.forEach((invoice) => {
      if (!inPeriod(invoice.date, filter)) return;
      const invoiceNo = String(invoice.invoiceNo || "")
        .trim()
        .toLowerCase();
      const net = Math.max(
        0,
        money(invoice.amount) - (returnedByInvoice.get(invoiceNo) || 0),
      );
      if (net <= 0) return;
      const farmerKey = String(
        invoice.farmerId || invoice.partyName || "",
      ).trim();
      if (farmerKey) marketFarmers.add(farmerKey.toLowerCase());
    });
  });

  return {
    actualSales,
    actualCollection,
    actualOutstanding,
    marketSales: storeRows.reduce((sum, row) => sum + row.sales, 0),
    marketCollection: storeRows.reduce((sum, row) => sum + row.collection, 0),
    marketOutstanding: storeRows.reduce((sum, row) => sum + row.outstanding, 0),
    marketFarmers: marketFarmers.size,
    storeRows,
    actualSalesList,
    actualCollectionList,
    actualOutstandingList: Array.from(outstandingMap.values()),
  };
}

export default function CompanyDashboard() {
  const { goStore } = useNav();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [actualDetailView, setActualDetailView] =
    useState<ActualDetailView>(null);

  const [approvalRequests, setApprovalRequests] = useState<
    StoreApprovalRequest[]
  >([]);
  const [showApprovals, setShowApprovals] = useState(false);

  const [dashboardVersion, setDashboardVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setApprovalRequests(getStoreApprovalRequests());
      setDashboardVersion((version) => version + 1);
    };
    refresh();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, refresh);
    window.addEventListener("company-store-sales-updated", refresh);
    window.addEventListener("company-credit-note-sync-updated", refresh);
    window.addEventListener("nature-biotic-company-receipts-updated", refresh);
    window.addEventListener("nature-biotic-store-inventory-updated", refresh);
    window.addEventListener("nature-biotic-store-receipts-updated", refresh);
    window.addEventListener("fro-stock-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(storeApprovalRequestsUpdatedEvent, refresh);
      window.removeEventListener("company-store-sales-updated", refresh);
      window.removeEventListener("company-credit-note-sync-updated", refresh);
      window.removeEventListener("nature-biotic-company-receipts-updated", refresh);
      window.removeEventListener("nature-biotic-store-inventory-updated", refresh);
      window.removeEventListener("nature-biotic-store-receipts-updated", refresh);
      window.removeEventListener("fro-stock-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const pendingApprovals = approvalRequests.filter(
    (row) => row.status === "Pending",
  );
  const approveRequest = (id: string) => {
    const request = approvalRequests.find((row) => row.id === id);
    if (!request || request.status !== "Pending") return;
    if (request.type === "Purchase Order") {
      setApprovalRequests(approveStorePurchaseOrder(id));
      return;
    }
    setApprovalRequests(updateStoreApprovalRequestStatus(id, "Approved"));
  };

  const dashboard = useMemo(
    () => buildAdminDashboard(dateFilter),
    [dateFilter, dashboardVersion],
  );
  const data = {
    actual: {
      receivable: dashboard.actualSales,
      revenue: dashboard.actualCollection,
      outstanding: dashboard.actualOutstanding,
    },
    market: {
      receivable: dashboard.marketSales,
      revenue: dashboard.marketCollection,
      outstanding: dashboard.marketOutstanding,
      farmers: dashboard.marketFarmers,
    },
  };

  return (
    <div>
      {/* Sticky date filter bar — solid background, stays below header */}
      {/* <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 mb-10 bg-slate-50 border-b border-slate-200 shadow-sm">
        <div className="flex justify-end">
          <SegmentedDateFilter value={dateFilter} onChange={setDateFilter} />
        </div>
      </div> */}
      <div className="mb-6 w-full overflow-x-auto lg:hidden">
        <SegmentedDateFilter value={dateFilter} onChange={setDateFilter} />
      </div>
      {createPortal(
        <div className="fixed right-4 top-[82px] z-[40] hidden max-w-[calc(100vw-2rem)] lg:block xl:right-8">
          <SegmentedDateFilter value={dateFilter} onChange={setDateFilter} />
        </div>,
        document.body,
      )}

      <div className="hidden h-[30px] lg:block" />

      {pendingApprovals.length > 0 && (
        <section className="mb-8">
          <button
            type="button"
            onClick={() => setShowApprovals((v) => !v)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Icon name="notifications_active" size={22} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Store Approvals</h2>
                  <p className="text-sm text-slate-500">
                    Purchase orders and purchase returns waiting for company
                    approval.
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                {pendingApprovals.length} Pending
              </div>
            </div>
          </button>

          {showApprovals && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {pendingApprovals.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No pending store approvals.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Store</th>
                        <th className="px-4 py-3 text-left">Ref No</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingApprovals.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {row.type}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.date}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.storeName}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {row.referenceNo}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Pending
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => approveRequest(row.id)}
                              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                            >
                              Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* SECTION 1 — Actual Sales */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Actual Sales
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Nature Biotic direct and company sales overview
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 stagger [&_p]:!text-sm">
          <button
            type="button"
            onClick={() =>
              setActualDetailView((prev) => (prev === "sales" ? null : "sales"))
            }
            className="text-left rounded-2xl transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <StatCard
              label="Sales"
              value={formatCurrency(data.actual.receivable)}
              icon="account_balance_wallet"
              color="brand"
            />
          </button>

          <button
            type="button"
            onClick={() =>
              setActualDetailView((prev) =>
                prev === "collection" ? null : "collection",
              )
            }
            className="text-left rounded-2xl transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <StatCard
              label="Collection"
              value={formatCurrency(data.actual.revenue)}
              icon="payments"
              color="blue"
            />
          </button>

          <button
            type="button"
            onClick={() =>
              setActualDetailView((prev) =>
                prev === "outstanding" ? null : "outstanding",
              )
            }
            className="text-left rounded-2xl transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <StatCard
              label="Outstanding"
              value={formatCurrency(data.actual.outstanding)}
              icon="receipt_long"
              color="amber"
            />
          </button>
        </div>

        {actualDetailView && (
          <div className="mt-5 animate-fade-in">
            <ActualDetailsBox
              view={actualDetailView}
              sales={dashboard.actualSalesList}
              collections={dashboard.actualCollectionList}
              outstanding={dashboard.actualOutstandingList}
              onClose={() => setActualDetailView(null)}
            />
          </div>
        )}
      </section>

      {/* SECTION 2 — Market Sales */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Market Sales
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Combined sales overview from all stores
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger [&_p]:!text-sm">
          <StatCard
            label="Sales"
            value={formatCurrency(data.market.receivable)}
            icon="account_balance_wallet"
            color="brand"
          />
          <StatCard
            label="Collection"
            value={formatCurrency(data.market.revenue)}
            icon="payments"
            color="blue"
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(data.market.outstanding)}
            icon="receipt_long"
            color="amber"
          />
          <StatCard
            label="No of Farmers"
            value={String(data.market.farmers)}
            icon="groups"
            color="purple"
          />
        </div>
      </section>

      {/* SECTION 3 — Store Overview */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Store Overview
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Performance summary for your registered store.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {allStores.map((store, index) => {
            const metrics = dashboard.storeRows.find(
              (row) => row.storeId === store.id,
            ) || {
              sales: 0,
              collection: 0,
              outstanding: 0,
              farmers: 0,
            };
            return (
        <Card key={store.id} className="p-5 sm:p-6 animate-fade-in">
          {/* Store details + KPI cards in one row on desktop */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-5">
            {/* Store details */}
            <div className="flex items-center gap-3 xl:w-[26%] shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                <span className="font-bold text-brand-700">
                  {initials(store.name)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                    Store {index + 1}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight truncate">
                    {store.name}
                  </h3>
                </div>
                <button
                  onClick={() => goStore(store.id)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold transition-base hover:bg-brand-700"
                >
                  <Icon name="dashboard" size={16} /> Open Dashboard
                </button>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
              <StoreKpi
                icon="account_balance_wallet"
                label="Sales"
                value={formatCurrency(metrics.sales)}
                color="brand"
              />
              <StoreKpi
                icon="payments"
                label="Collection"
                value={formatCurrency(metrics.collection)}
                color="blue"
              />
              <StoreKpi
                icon="receipt_long"
                label="Outstanding"
                value={formatCurrency(metrics.outstanding)}
                color="amber"
              />
              <StoreKpi
                icon="groups"
                label="No of Farmers"
                value={String(metrics.farmers)}
                color="purple"
              />
            </div>
          </div>
        </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ActualDetailsBox({
  view,
  sales,
  collections,
  outstanding,
  onClose,
}: {
  view: Exclude<ActualDetailView, null>;
  sales: SalesDetail[];
  collections: CollectionDetail[];
  outstanding: OutstandingDetail[];
  onClose: () => void;
}) {
  const config = {
    sales: {
      title: "Sales",
      icon: "receipt_long",
      tone: "brand",
    },
    collection: {
      title: "Collection",
      icon: "payments",
      tone: "blue",
    },
    outstanding: {
      title: "Outstanding",
      icon: "account_balance",
      tone: "amber",
    },
  }[view];

  const toneClass =
    config.tone === "brand"
      ? "bg-brand-50 text-brand-700"
      : config.tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : "bg-amber-50 text-amber-700";

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}
          >
            <Icon name={config.icon} size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{config.title}</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {view === "sales" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="bg-white text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-5 py-3 text-left font-semibold">
                  Invoice No
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Store Name
                </th>
                <th className="px-5 py-3 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((row) => (
                <tr key={`${row.invoiceNo}-${row.storeName}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">{row.date}</td>
                  <td className="px-5 py-3 font-semibold text-slate-700">
                    {row.invoiceNo}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{row.storeName}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "collection" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="bg-white text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-5 py-3 text-left font-semibold">
                  Receipt No
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Store Name
                </th>
                <th className="px-5 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collections.map((row) => (
                <tr key={row.receiptNo} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">{row.date}</td>
                  <td className="px-5 py-3 font-semibold text-slate-700">
                    {row.receiptNo}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{row.storeName}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "outstanding" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-left font-semibold">
                  Store Name
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  &lt; 30 Days
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  &gt; 30 Days
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  &gt; 60 Days
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  &gt; 90 Days
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  Total Amount
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {outstanding.map((row) => (
                <tr key={row.storeName} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {row.storeName}
                  </td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-700">
                    {formatCurrency(row.under30)}
                  </td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-700">
                    {formatCurrency(row.over30)}
                  </td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-700">
                    {formatCurrency(row.over60)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-700">
                    {formatCurrency(row.over90)}
                  </td>
                  <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-900">
                    {formatCurrency(row.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                <td className="px-5 py-4 text-right">Total</td>
                <td className="px-5 py-4 text-right tabular-nums">
                  {formatCurrency(
                    outstanding.reduce(
                      (sum, row) => sum + row.under30,
                      0,
                    ),
                  )}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">
                  {formatCurrency(
                    outstanding.reduce(
                      (sum, row) => sum + row.over30,
                      0,
                    ),
                  )}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">
                  {formatCurrency(
                    outstanding.reduce(
                      (sum, row) => sum + row.over60,
                      0,
                    ),
                  )}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">
                  {formatCurrency(
                    outstanding.reduce(
                      (sum, row) => sum + row.over90,
                      0,
                    ),
                  )}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-brand-700">
                  {formatCurrency(
                    outstanding.reduce(
                      (sum, row) => sum + row.totalAmount,
                      0,
                    ),
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function SegmentedDateFilter({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (v: DateFilter) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto max-w-full">
      {filterTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-base whitespace-nowrap ${
            value === tab.key
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function StoreKpi({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: "brand" | "blue" | "amber" | "purple";
}) {
  const colors: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="rounded-xl bg-slate-50 p-3 transition-base hover:bg-slate-100/70 flex items-center gap-2.5">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}
      >
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-800 tracking-tight leading-tight truncate">
          {value}
        </p>
        <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
          {label}
        </p>
      </div>
    </div>
  );
}
