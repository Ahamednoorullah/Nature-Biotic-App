import { useEffect, useMemo, useState } from "react";
import {
  getCompanyRefunds,
  getFinalCompanyStoreSales,
  getApprovedStorePurchaseReturns,
  companyRefundParts,
  getCompanyStorePositions,
  settleCompanyAccount,
  settleLinkedFarmerAccounts,
  stores as allStores,
} from "@/lib/data";
import { Button, Card, Icon, Input } from "@/components/ui";
import { CategoryDonut, CompareBars, HorizontalBars, TrendBars } from "@/components/ReportCharts";
import {
  formatCurrency,
  formatDate,
  matchesSimpleDate,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";
import { usesSupabaseData } from "@/lib/db/mode";
import {
  loadCompanyDashboardSnapshot,
  loadExpenses,
  type CompanyDashboardSnapshot,
} from "@/lib/db/operations";
import { loadCompanyCreditNotes } from "@/lib/db/financials";
import {
  loadCompanyPurchaseOrderRegister,
  loadCompanyGstInvoiceRegister,
  loadCompanyStockDeliveryRegister,
  type ReportPurchaseOrder,
  type ReportGstInvoice,
  type ReportStockDelivery,
} from "@/lib/db/reportRegisters";
import { dbErrorMessage } from "@/lib/db/errors";
import { buildCompanyReportFromSnapshot } from "@/lib/companyReportMetrics";
import {
  effectiveCustomRange,
  exportReportTablePdf,
  moneyPdf,
} from "@/lib/reportExport";

type DateFilter = SimpleDateFilter;

const STORE_SALES_KEY = "nature-biotic-store-sales-invoices-v2";
const STORE_RETURN_KEY = "nature-biotic-store-sales-returns-v2";
const STORE_RECEIPT_KEY = "nature-biotic-store-receipts-v3";
const COMPANY_RECEIPT_KEY = "nature-biotic-company-receipts-v1";
const COMPANY_EXPENSE_KEY = "nature-biotic-company-expenses-v1";

type StoreReport = {
  id: string;
  name: string;
  sales: number;
  collection: number;
  outstanding: number;
};

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

function periodBounds(filter: DateFilter, from = "", to = "") {
  if (filter === "custom") {
    const start = from ? new Date(`${from}T00:00:00`) : new Date(8640000000000000);
    const end = to ? new Date(`${to}T23:59:59.999`) : new Date(0);
    return { start, end };
  }
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

function inPeriod(value: unknown, filter: DateFilter, from = "", to = "") {
  const date = parseTxnDate(value);
  if (!date) return false;
  const { start, end } = periodBounds(filter, from, to);
  return date >= start && date <= end;
}

function buildReport(filter: DateFilter, from = "", to = "") {
  const companyInvoices = new Map<
    string,
    { date: string; storeId: string; storeName: string; total: number }
  >();
  getFinalCompanyStoreSales().forEach((line) => {
    const invoiceNo = String(line.invoiceNo || "").trim();
    if (!invoiceNo) return;
    const key = `${line.storeId}|${invoiceNo.toLowerCase()}`;
    const existing = companyInvoices.get(key);
    if (existing) existing.total += money(line.total);
    else {
      companyInvoices.set(key, {
        date: String(line.date || ""),
        storeId: String(line.storeId || ""),
        storeName: String(line.storeName || ""),
        total: money(line.total),
      });
    }
  });

  const companyReceipts = readRows(COMPANY_RECEIPT_KEY);
  const companyPaid = new Map<string, number>();
  companyReceipts.forEach((receipt) => {
    const invoiceNo = String(receipt.invoiceNo || "").trim().toLowerCase();
    if (!invoiceNo) return;
    const key = `${receipt.storeId || ""}|${invoiceNo}`;
    companyPaid.set(key, (companyPaid.get(key) || 0) + money(receipt.amount));
  });

  const companyGrossSales = new Map<string, number>();
  const companyGrossCollection = new Map<string, number>();
  const companyRefunds = new Map<string, number>();
  companyInvoices.forEach((invoice, key) => {
    if (!inPeriod(invoice.date, filter, from, to)) return;
    const net = invoice.total;
    companyGrossSales.set(
      invoice.storeId,
      (companyGrossSales.get(invoice.storeId) || 0) + net,
    );
  });
  companyReceipts.forEach((receipt) => {
    if (!inPeriod(receipt.date, filter, from, to)) return;
    const storeId = String(receipt.storeId || "");
    companyGrossCollection.set(
      storeId,
      (companyGrossCollection.get(storeId) || 0) + money(receipt.amount),
    );
  });
  getCompanyRefunds().forEach((refund) => {
    if (!inPeriod(refund.date, filter, from, to)) return;
    const paid = companyRefundParts(refund).paid;
    if (paid <= 0) return;
    companyRefunds.set(refund.storeId, (companyRefunds.get(refund.storeId) || 0) + paid);
  });
  const purchaseReturns = getApprovedStorePurchaseReturns();
  const companyReturns = new Map<string, number>();
  purchaseReturns.forEach((row) => {
    if (!inPeriod(row.date, filter, from, to)) return;
    companyReturns.set(
      row.storeId,
      (companyReturns.get(row.storeId) || 0) + row.amount,
    );
  });
  let companyGross = 0;
  let companySalesReturn = 0;
  let companySales = 0;
  let companyCollection = 0;
  const companyStoreIds = new Set<string>([
    ...companyGrossSales.keys(),
    ...companyGrossCollection.keys(),
    ...companyReturns.keys(),
    ...companyRefunds.keys(),
  ]);
  const companyPeriodByStore = new Map<string, number>();
  companyStoreIds.forEach((storeId) => {
    const settled = settleCompanyAccount({
      grossSales: companyGrossSales.get(storeId) || 0,
      salesReturns: companyReturns.get(storeId) || 0,
      receipts: companyGrossCollection.get(storeId) || 0,
      refunds: companyRefunds.get(storeId) || 0,
    });
    companyPeriodByStore.set(storeId, settled.netSales);
    companyGross += settled.grossSales;
    companySalesReturn += settled.salesReturns;
    companySales += settled.netSales;
    companyCollection += settled.collection;
  });

  let companyOutstanding = 0;
  const lifetimeOutstanding = new Map<string, number>();
  getCompanyStorePositions().forEach((position, storeId) => {
    lifetimeOutstanding.set(storeId, position.outstanding);
    companyOutstanding += position.outstanding;
  });

  const storeBooks = allStores.map((store) => {
    const invoices = readRows(`${STORE_SALES_KEY}:${store.id}`);
    const returns = readRows(`${STORE_RETURN_KEY}:${store.id}`);
    const receipts = readRows(`${STORE_RECEIPT_KEY}:${store.id}`);
    const returned = new Map<string, number>();
    returns.forEach((row) => {
      if (row.status === "Rejected" || row.status === "Draft") return;
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      if (!invoiceNo) return;
      returned.set(invoiceNo, (returned.get(invoiceNo) || 0) + money(row.total));
    });
    const paid = new Map<string, number>();
    receipts.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      if (!invoiceNo) return;
      paid.set(invoiceNo, (paid.get(invoiceNo) || 0) + money(row.amount));
    });
    return { store, invoices, receipts, returned, paid };
  });

  const storeRows: StoreReport[] = storeBooks.map(
    ({ store, invoices, receipts, returned, paid }) => {
      let sales = 0;
      invoices.forEach((invoice) => {
        if (!inPeriod(invoice.date, filter, from, to)) return;
        const invoiceNo = String(invoice.invoiceNo || "").trim().toLowerCase();
        const net = Math.max(
          0,
          money(invoice.amount) - (returned.get(invoiceNo) || 0),
        );
        sales += net;
      });
      const collection = receipts.reduce((sum, receipt) => {
        return inPeriod(receipt.date, filter, from, to) ? sum + money(receipt.amount) : sum;
      }, 0);
      const current = settleLinkedFarmerAccounts({
        invoices,
        receipts,
        returns: readRows(`${STORE_RETURN_KEY}:${store.id}`).filter(
          (row) => row.status !== "Rejected" && row.status !== "Draft",
        ),
        refunds: readRows(`nature-biotic-store-refunds-v2:${store.id}`),
        linkInvoices: invoices,
        linkReturns: readRows(`${STORE_RETURN_KEY}:${store.id}`).filter(
          (row) => row.status !== "Draft",
        ),
      });
      return {
        id: store.id,
        name: store.name,
        sales,
        collection,
        outstanding: current.outstanding,
      };
    },
  );

  const companyByStore = new Map<string, { sales: number; outstanding: number }>();
  companyStoreIds.forEach((storeId) => {
    companyByStore.set(storeId, {
      sales: companyPeriodByStore.get(storeId) || 0,
      outstanding: lifetimeOutstanding.get(storeId) || 0,
    });
  });
  const storeComparison = storeRows.map((store) => {
    const company = companyByStore.get(store.id) || { sales: 0, outstanding: 0 };
    return {
      name: store.name,
      sales: store.sales + company.sales,
      outstanding: store.outstanding + (lifetimeOutstanding.get(store.id) || company.outstanding),
    };
  });

  const marketSales = storeRows.reduce((sum, row) => sum + row.sales, 0);
  const marketCollection = storeRows.reduce((sum, row) => sum + row.collection, 0);
  const marketOutstanding = storeRows.reduce((sum, row) => sum + row.outstanding, 0);

  const expenses = readRows(COMPANY_EXPENSE_KEY).filter((row) =>
    inPeriod(row.date, filter, from, to),
  );
  const expenseTotal = expenses.reduce((sum, row) => sum + money(row.amount), 0);
  const expenseCategories = new Map<string, number>();
  expenses.forEach((row) => {
    const category = String(row.category || "Other");
    expenseCategories.set(
      category,
      (expenseCategories.get(category) || 0) + money(row.amount),
    );
  });

  const { start, end } = periodBounds(filter, from, to);
  const buckets: { label: string; sales: number; collection: number }[] = [];
  const cursor = new Date(start);
  const monthly = filter === "quarterly" || filter === "yearly";
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    if (monthly) bucketEnd.setMonth(bucketEnd.getMonth() + 1);
    else bucketEnd.setDate(bucketEnd.getDate() + 1);
    const label = monthly
      ? bucketStart.toLocaleString("en-IN", { month: "short" })
      : formatDate(
          `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, "0")}-${String(bucketStart.getDate()).padStart(2, "0")}`,
        );
    const inBucket = (value: unknown) => {
      const date = parseTxnDate(value);
      return !!date && date >= bucketStart && date < bucketEnd && date <= end;
    };
    let sales = 0;
    companyInvoices.forEach((invoice, key) => {
      if (!inBucket(invoice.date)) return;
      sales += invoice.total;
    });
    purchaseReturns.forEach((row) => {
      if (inBucket(row.date)) sales -= row.amount;
    });
    storeBooks.forEach(({ invoices, returned }) => {
      invoices.forEach((invoice) => {
        if (!inBucket(invoice.date)) return;
        const invoiceNo = String(invoice.invoiceNo || "").trim().toLowerCase();
        sales += Math.max(
          0,
          money(invoice.amount) - (returned.get(invoiceNo) || 0),
        );
      });
    });
    let collection = companyReceipts.reduce(
      (sum, receipt) => (inBucket(receipt.date) ? sum + money(receipt.amount) : sum),
      0,
    );
    getCompanyRefunds().forEach((refund) => {
      if (inBucket(refund.date)) collection -= companyRefundParts(refund).paid;
    });
    storeBooks.forEach(({ receipts }) => {
      collection += receipts.reduce(
        (sum, receipt) => (inBucket(receipt.date) ? sum + money(receipt.amount) : sum),
        0,
      );
    });
    buckets.push({ label, sales, collection });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
    if (buckets.length > 40) break;
  }

  const productSales = new Map<string, number>();
  getFinalCompanyStoreSales().forEach((line) => {
    if (!inPeriod(line.date, filter, from, to)) return;
    const name = String(line.product || "Product");
    productSales.set(name, (productSales.get(name) || 0) + money(line.total));
  });
  storeBooks.forEach(({ invoices }) => {
    invoices.forEach((invoice) => {
      if (!inPeriod(invoice.date, filter, from, to)) return;
      const products = Array.isArray(invoice.products) ? invoice.products : [];
      products.forEach((product: any) => {
        const name = String(
          product?.product?.name || product?.productName || product?.name || "Product",
        );
        productSales.set(
          name,
          (productSales.get(name) || 0) +
            money(product?.rowTotal || product?.total || product?.amount),
        );
      });
    });
  });

  return {
    companyGross,
    companySalesReturn,
    companySales,
    marketSales,
    sales: companySales + marketSales,
    companyCollection,
    marketCollection,
    collection: companyCollection + marketCollection,
    companyOutstanding,
    marketOutstanding,
    outstanding: companyOutstanding + marketOutstanding,
    expenseTotal,
    expenseCategories: Array.from(expenseCategories.entries()).map(
      ([name, value]) => ({ name, value }),
    ),
    storeRows,
    storeComparison,
    buckets,
    productRows: Array.from(productSales.entries()).map(([name, value]) => ({
      name,
      value,
    })),
  };
}

export default function CompanyReports() {
  const supabaseMode = usesSupabaseData();
  const [filter, setFilter] = useState<DateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<CompanyDashboardSnapshot | null>(null);
  const [dbExpenses, setDbExpenses] = useState<
    Awaited<ReturnType<typeof loadExpenses>>
  >([]);
  const [dbCreditNotes, setDbCreditNotes] = useState<
    Awaited<ReturnType<typeof loadCompanyCreditNotes>>
  >([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ReportPurchaseOrder[]>([]);
  const [gstInvoices, setGstInvoices] = useState<ReportGstInvoice[]>([]);
  const [stockDeliveries, setStockDeliveries] = useState<ReportStockDelivery[]>([]);
  const [loading, setLoading] = useState(supabaseMode);
  const [loadError, setLoadError] = useState("");
  const [exportingKey, setExportingKey] = useState("");

  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("company-store-sales-updated", refresh);
    window.addEventListener("nature-biotic-company-receipts-updated", refresh);
    window.addEventListener("nature-biotic-store-receipts-updated", refresh);
    window.addEventListener("nature-biotic-company-expense-updated", refresh);
    window.addEventListener("company-credit-note-sync-updated", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("company-store-sales-updated", refresh);
      window.removeEventListener("nature-biotic-company-receipts-updated", refresh);
      window.removeEventListener("nature-biotic-store-receipts-updated", refresh);
      window.removeEventListener("nature-biotic-company-expense-updated", refresh);
      window.removeEventListener("company-credit-note-sync-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (!supabaseMode) return;
    let active = true;
    setLoading(true);
    Promise.all([
      loadCompanyDashboardSnapshot(),
      loadExpenses("company"),
      loadCompanyCreditNotes(),
      loadCompanyPurchaseOrderRegister(),
      loadCompanyGstInvoiceRegister(),
      loadCompanyStockDeliveryRegister(),
    ])
      .then(([nextSnapshot, expenses, creditNotes, orders, invoices, deliveries]) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
        setDbExpenses(expenses);
        setDbCreditNotes(creditNotes);
        setPurchaseOrders(orders);
        setGstInvoices(invoices);
        setStockDeliveries(deliveries);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setSnapshot(null);
        setLoadError(dbErrorMessage(error, "Could not load company reports."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supabaseMode, version]);

  const range = useMemo(
    () => effectiveCustomRange(filter, customFrom, customTo),
    [filter, customFrom, customTo],
  );
  const rangeError = range.error;
  const rangeFrom = range.from;
  const rangeTo = range.to;
  const filterReady = filter !== "custom" || !rangeError;

  const report = useMemo(() => {
    if (!filterReady) {
      return {
        companyGross: 0,
        companySalesReturn: 0,
        companySales: 0,
        marketSales: 0,
        sales: 0,
        companyCollection: 0,
        marketCollection: 0,
        collection: 0,
        companyOutstanding: 0,
        marketOutstanding: 0,
        outstanding: 0,
        expenseTotal: 0,
        expenseCategories: [] as { name: string; value: number }[],
        creditNoteTotal: 0,
        creditNoteCount: 0,
        storeRows: [] as {
          id: string;
          name: string;
          sales: number;
          collection: number;
          outstanding: number;
          farmers?: number;
          companySales?: number;
        }[],
        storeComparison: [] as { name: string; sales: number; outstanding: number }[],
        buckets: [] as { label: string; sales: number; collection: number }[],
        productRows: [] as { name: string; value: number }[],
        companyInvoiceRows: [] as {
          date: string;
          invoiceNo: string;
          storeName: string;
          amount: number;
        }[],
        companyReceiptRows: [] as {
          date: string;
          receiptNo: string;
          storeName: string;
          invoiceNo: string;
          amount: number;
        }[],
        purchaseReturnRows: [] as {
          date: string;
          returnNo: string;
          storeName: string;
          amount: number;
        }[],
      };
    }
    if (supabaseMode && snapshot) {
      return buildCompanyReportFromSnapshot(snapshot, filter, {
        expenses: dbExpenses.map((row) => ({
          date: row.date,
          amount: row.amount,
          category: row.category,
          status: row.status,
        })),
        creditNotes: dbCreditNotes.map((row) => ({
          date: row.date,
          total: row.total ?? row.amount ?? 0,
          status: row.status,
        })),
        from: rangeFrom,
        to: rangeTo,
      });
    }
    return {
      ...buildReport(filter, rangeFrom, rangeTo),
      creditNoteTotal: 0,
      creditNoteCount: 0,
      companyInvoiceRows: [] as {
        date: string;
        invoiceNo: string;
        storeName: string;
        amount: number;
      }[],
      companyReceiptRows: [] as {
        date: string;
        receiptNo: string;
        storeName: string;
        invoiceNo: string;
        amount: number;
      }[],
      purchaseReturnRows: [] as {
        date: string;
        returnNo: string;
        storeName: string;
        amount: number;
      }[],
    };
  }, [
    supabaseMode,
    snapshot,
    filter,
    filterReady,
    rangeFrom,
    rangeTo,
    dbExpenses,
    dbCreditNotes,
    version,
  ]);

  const hasActivity =
    report.sales > 0 ||
    report.collection > 0 ||
    report.outstanding > 0 ||
    report.expenseTotal > 0 ||
    report.creditNoteCount > 0;

  const filteredPurchaseOrders = useMemo(
    () =>
      filterReady
        ? purchaseOrders.filter((row) =>
            matchesSimpleDate(row.date, filter, rangeFrom, rangeTo),
          )
        : [],
    [purchaseOrders, filter, filterReady, rangeFrom, rangeTo],
  );
  const filteredGstInvoices = useMemo(
    () =>
      filterReady
        ? gstInvoices.filter(
            (row) =>
              matchesSimpleDate(row.date, filter, rangeFrom, rangeTo) &&
              String(row.status || "").toLowerCase() === "final",
          )
        : [],
    [gstInvoices, filter, filterReady, rangeFrom, rangeTo],
  );
  const filteredStockDeliveries = useMemo(
    () =>
      filterReady
        ? stockDeliveries.filter((row) =>
            matchesSimpleDate(row.date, filter, rangeFrom, rangeTo),
          )
        : [],
    [stockDeliveries, filter, filterReady, rangeFrom, rangeTo],
  );

  const exportTable = async (
    key: string,
    title: string,
    headers: string[],
    rows: string[][],
    total?: string[],
    aligns?: Array<"left" | "right" | "center">,
  ) => {
    if (exportingKey) return;
    if (filter === "custom" && rangeError) {
      window.alert(rangeError);
      return;
    }
    setExportingKey(key);
    try {
      await exportReportTablePdf({
        fileName: `nature-biotic-company-${key}.pdf`,
        title,
        scopeLabel: "Company",
        filter,
        customFrom: rangeFrom,
        customTo: rangeTo,
        headers,
        aligns,
        rows,
        total,
      });
      window.alert("PDF downloaded.");
    } catch {
      window.alert("The PDF could not be created. Please try again.");
    } finally {
      setExportingKey("");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Reports
          </h1>
          <p className="mt-1 text-slate-500">
            Company and market performance from saved transactions.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
            {simpleDateFilterOptions.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-base sm:px-5 ${
                  filter === tab.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {filter === "custom" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                label="Start date"
                type="date"
                value={customFrom}
                onChange={setCustomFrom}
                className="w-full sm:w-40"
              />
              <Input
                label="End date"
                type="date"
                value={customTo}
                onChange={setCustomTo}
                className="w-full sm:w-40"
              />
            </div>
          ) : null}
          {rangeError ? (
            <p className="text-sm font-medium text-red-600">{rangeError}</p>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <Card className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </Card>
      ) : null}
      {loading ? (
        <Card className="mb-4 p-6 text-center text-sm text-slate-500">Loading reports…</Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Summary
          label="Sales"
          value={report.sales}
          detail={`Company ${formatCurrency(report.companyGross)} − Return ${formatCurrency(report.companySalesReturn)} = ${formatCurrency(report.companySales)} · Market ${formatCurrency(report.marketSales)}`}
        />
        <Summary
          label="Collection"
          value={report.collection}
          detail={`Company ${formatCurrency(report.companyCollection)} · Market ${formatCurrency(report.marketCollection)}`}
        />
        <Summary
          label="Outstanding"
          value={report.outstanding}
          detail={`Company ${formatCurrency(report.companyOutstanding)} · Market ${formatCurrency(report.marketOutstanding)}`}
        />
        <Summary label="Expenses" value={report.expenseTotal} detail="Accepted company expenses" />
        <Summary
          label="Credit notes"
          value={report.creditNoteTotal}
          detail={`${report.creditNoteCount} GST document(s) · not cash/stock`}
        />
      </div>

      {!loading && !hasActivity ? (
        <Card className="p-8 text-center">
          <Icon name="bar_chart" size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">No data available for this period.</p>
        </Card>
      ) : !loading && hasActivity ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-slate-800">Sales and collection</h2>
            <p className="mt-1 text-xs text-slate-500">
              Company and market amounts in the selected period.
            </p>
            <TrendChart buckets={report.buckets} />
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-slate-800">Sales distribution</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nature Biotic sales and combined store sales.
            </p>
            <Donut
              parts={[
                { label: "Company sales", value: report.companySales, color: "#15803d" },
                { label: "Market sales", value: report.marketSales, color: "#86efac" },
              ]}
            />
          </Card>
          <Card className="overflow-hidden xl:col-span-2">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Icon name="storefront" size={22} className="text-brand-600" />
              <h2 className="font-bold text-slate-800">Store-wise business</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 text-left font-semibold">Store</th>
                    <th className="px-5 py-3 text-right font-semibold">Company sales</th>
                    <th className="px-5 py-3 text-right font-semibold">Market sales</th>
                    <th className="px-5 py-3 text-right font-semibold">Collection</th>
                    <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
                    <th className="px-5 py-3 text-right font-semibold">Farmers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.storeRows.map((store) => (
                    <tr key={store.id}>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {store.name}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {formatCurrency(
                          "companySales" in store
                            ? Number((store as { companySales?: number }).companySales || 0)
                            : 0,
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">{formatCurrency(store.sales)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {formatCurrency(store.collection)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {formatCurrency(store.outstanding)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {"farmers" in store
                          ? Number((store as { farmers?: number }).farmers || 0)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <BarList
                title="Sales by store"
                rows={report.storeRows.map((store) => ({
                  label: store.name,
                  value: store.sales,
                }))}
              />
              <BarList
                title="Collection by store"
                rows={report.storeRows.map((store) => ({
                  label: store.name,
                  value: store.collection,
                }))}
              />
              <BarList
                title="Outstanding by store"
                rows={report.storeRows.map((store) => ({
                  label: store.name,
                  value: store.outstanding,
                }))}
              />
            </div>
          </Card>
          <Card className="p-5 xl:col-span-2">
            <h2 className="font-bold text-slate-800">Expenses by category</h2>
            {report.expenseCategories.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No data available for this period.</p>
            ) : (
              <BarList title="" rows={report.expenseCategories.map((row) => ({
                label: row.name,
                value: row.value,
              }))} />
            )}
          </Card>
        </div>
      ) : null}

      {!loading && supabaseMode ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ReportDocTable
              title="Company sales invoices"
              headers={["Date", "Invoice", "Store", "Amount"]}
              rows={report.companyInvoiceRows.map((row) => [
                formatDate(row.date),
                row.invoiceNo,
                row.storeName,
                formatCurrency(row.amount),
              ])}
              onExport={() =>
                exportTable(
                  "sales-summary",
                  "Company sales invoices",
                  ["Date", "Invoice", "Store", "Amount"],
                  report.companyInvoiceRows.map((row) => [
                    formatDate(row.date),
                    row.invoiceNo,
                    row.storeName,
                    moneyPdf(row.amount),
                  ]),
                  [
                    "",
                    "",
                    "Total",
                    moneyPdf(
                      report.companyInvoiceRows.reduce((sum, row) => sum + row.amount, 0),
                    ),
                  ],
                  ["left", "left", "left", "right"],
                )
              }
              exporting={exportingKey === "sales-summary"}
            />
            <ReportDocTable
              title="Company receipts / refunds"
              headers={["Date", "Receipt", "Store", "Invoice", "Amount"]}
              rows={report.companyReceiptRows.map((row) => [
                formatDate(row.date),
                row.receiptNo,
                row.storeName,
                row.invoiceNo,
                formatCurrency(row.amount),
              ])}
              onExport={() =>
                exportTable(
                  "receipts",
                  "Company receipts / refunds",
                  ["Date", "Receipt", "Store", "Invoice", "Amount"],
                  report.companyReceiptRows.map((row) => [
                    formatDate(row.date),
                    row.receiptNo,
                    row.storeName,
                    row.invoiceNo,
                    moneyPdf(row.amount),
                  ]),
                  [
                    "",
                    "",
                    "",
                    "Total",
                    moneyPdf(
                      report.companyReceiptRows.reduce((sum, row) => sum + row.amount, 0),
                    ),
                  ],
                  ["left", "left", "left", "left", "right"],
                )
              }
              exporting={exportingKey === "receipts"}
            />
            <ReportDocTable
              title="Approved purchase returns"
              headers={["Date", "Return No", "Store", "Amount"]}
              rows={report.purchaseReturnRows.map((row) => [
                formatDate(row.date),
                row.returnNo,
                row.storeName,
                formatCurrency(row.amount),
              ])}
              onExport={() =>
                exportTable(
                  "purchase-returns",
                  "Approved purchase returns",
                  ["Date", "Return No", "Store", "Amount"],
                  report.purchaseReturnRows.map((row) => [
                    formatDate(row.date),
                    row.returnNo,
                    row.storeName,
                    moneyPdf(row.amount),
                  ]),
                  [
                    "",
                    "",
                    "Total",
                    moneyPdf(
                      report.purchaseReturnRows.reduce((sum, row) => sum + row.amount, 0),
                    ),
                  ],
                  ["left", "left", "left", "right"],
                )
              }
              exporting={exportingKey === "purchase-returns"}
            />
          </div>

          <ReportDocTable
            title="Purchase order register"
            headers={[
              "PO No",
              "Date",
              "Store",
              "Status",
              "Items",
              "Taxable",
              "Total",
            ]}
            rows={filteredPurchaseOrders.map((row) => [
              row.poNo,
              formatDate(row.date),
              row.storeName,
              row.status,
              String(row.itemCount),
              formatCurrency(row.taxable),
              formatCurrency(row.total),
            ])}
            onExport={() =>
              exportTable(
                "purchase-orders",
                "Purchase order register",
                ["PO No", "Date", "Store", "Status", "Items", "Taxable", "Total"],
                filteredPurchaseOrders.map((row) => [
                  row.poNo,
                  formatDate(row.date),
                  row.storeName,
                  row.status,
                  String(row.itemCount),
                  moneyPdf(row.taxable),
                  moneyPdf(row.total),
                ]),
                [
                  "",
                  "",
                  "",
                  "",
                  "Total",
                  moneyPdf(
                    filteredPurchaseOrders.reduce((sum, row) => sum + row.taxable, 0),
                  ),
                  moneyPdf(
                    filteredPurchaseOrders.reduce((sum, row) => sum + row.total, 0),
                  ),
                ],
                ["left", "left", "left", "left", "right", "right", "right"],
              )
            }
            exporting={exportingKey === "purchase-orders"}
          />

          <ReportDocTable
            title="GST invoice register"
            headers={[
              "Invoice",
              "Date",
              "Store",
              "Taxable",
              "CGST",
              "SGST",
              "IGST",
              "Round off",
              "Grand total",
            ]}
            rows={filteredGstInvoices.map((row) => [
              row.invoiceNo,
              formatDate(row.date),
              row.storeName,
              formatCurrency(row.taxable),
              formatCurrency(row.cgst),
              formatCurrency(row.sgst),
              formatCurrency(row.igst),
              formatCurrency(row.roundOff),
              formatCurrency(row.total),
            ])}
            onExport={() =>
              exportTable(
                "gst-invoices",
                "GST invoice register",
                [
                  "Invoice",
                  "Date",
                  "Store",
                  "Taxable",
                  "CGST",
                  "SGST",
                  "IGST",
                  "Round off",
                  "Grand total",
                ],
                filteredGstInvoices.map((row) => [
                  row.invoiceNo,
                  formatDate(row.date),
                  row.storeName,
                  moneyPdf(row.taxable),
                  moneyPdf(row.cgst),
                  moneyPdf(row.sgst),
                  moneyPdf(row.igst),
                  moneyPdf(row.roundOff),
                  moneyPdf(row.total),
                ]),
                [
                  "",
                  "",
                  "Total",
                  moneyPdf(filteredGstInvoices.reduce((s, r) => s + r.taxable, 0)),
                  moneyPdf(filteredGstInvoices.reduce((s, r) => s + r.cgst, 0)),
                  moneyPdf(filteredGstInvoices.reduce((s, r) => s + r.sgst, 0)),
                  moneyPdf(filteredGstInvoices.reduce((s, r) => s + r.igst, 0)),
                  moneyPdf(filteredGstInvoices.reduce((s, r) => s + r.roundOff, 0)),
                  moneyPdf(filteredGstInvoices.reduce((s, r) => s + r.total, 0)),
                ],
                [
                  "left",
                  "left",
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ],
              )
            }
            exporting={exportingKey === "gst-invoices"}
          />

          <ReportDocTable
            title="Stock delivery register"
            headers={[
              "Delivery No",
              "Date",
              "Store",
              "Executive",
              "Products",
              "Qty",
              "Status",
            ]}
            rows={filteredStockDeliveries.map((row) => [
              row.sdNo,
              formatDate(row.date),
              row.storeName,
              row.executive,
              row.productSummary,
              String(row.quantity),
              row.status,
            ])}
            onExport={() =>
              exportTable(
                "stock-deliveries",
                "Stock delivery register",
                ["Delivery No", "Date", "Store", "Executive", "Products", "Qty", "Status"],
                filteredStockDeliveries.map((row) => [
                  row.sdNo,
                  formatDate(row.date),
                  row.storeName,
                  row.executive,
                  row.productSummary,
                  String(row.quantity),
                  row.status,
                ]),
                [
                  "",
                  "",
                  "",
                  "",
                  "Total qty",
                  String(
                    filteredStockDeliveries.reduce((sum, row) => sum + row.quantity, 0),
                  ),
                  "",
                ],
              )
            }
            exporting={exportingKey === "stock-deliveries"}
          />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-5">
          <TrendBars
            title="Sales trend"
            points={report.buckets.map((bucket) => ({
              label: bucket.label,
              value: bucket.sales,
            }))}
          />
        </Card>
        <Card className="min-w-0 p-5">
          <TrendBars
            title="Collection trend"
            points={report.buckets.map((bucket) => ({
              label: bucket.label,
              value: bucket.collection,
            }))}
          />
        </Card>
        <Card className="min-w-0 p-5">
          <CompareBars title="Sales vs collection" points={report.buckets} />
        </Card>
        <Card className="min-w-0 p-5">
          <HorizontalBars
            title="Outstanding by store"
            points={report.storeComparison.map((store) => ({
              label: store.name,
              value: store.outstanding,
            }))}
          />
        </Card>
        <Card className="min-w-0 p-5">
          <HorizontalBars
            title="Store-wise sales"
            points={report.storeComparison.map((store) => ({
              label: store.name,
              value: store.sales,
            }))}
          />
        </Card>
        <Card className="min-w-0 p-5">
          <CategoryDonut
            title="Product-wise sales"
            points={report.productRows.map((row) => ({
              label: row.name,
              value: row.value,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(value)}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </Card>
  );
}

function ReportDocTable({
  title,
  headers,
  rows,
  onExport,
  exporting,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  onExport?: () => void;
  exporting?: boolean;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="font-bold text-slate-800">{title}</h2>
        {onExport ? (
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={onExport}
            disabled={!!exporting}
          >
            <Icon name="download" size={18} />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          No data available for this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TrendChart({
  buckets,
}: {
  buckets: { label: string; sales: number; collection: number }[];
}) {
  const max = Math.max(
    1,
    ...buckets.map((bucket) => Math.max(bucket.sales, bucket.collection)),
  );
  const visible = buckets.filter(
    (bucket, index) =>
      bucket.sales > 0 ||
      bucket.collection > 0 ||
      index === buckets.length - 1 ||
      buckets.length <= 12,
  );
  if (visible.every((bucket) => bucket.sales === 0 && bucket.collection === 0)) {
    return <p className="mt-6 text-sm text-slate-500">No data available for this period.</p>;
  }
  return (
    <div className="mt-5">
      <div className="flex h-40 items-end gap-1">
        {visible.map((bucket) => (
          <div key={bucket.label} className="flex min-w-0 flex-1 items-end gap-0.5">
            <div
              className="w-1/2 rounded-t bg-brand-700"
              style={{ height: `${(bucket.sales / max) * 100}%` }}
              title={`Sales ${formatCurrency(bucket.sales)}`}
            />
            <div
              className="w-1/2 rounded-t bg-brand-300"
              style={{ height: `${(bucket.collection / max) * 100}%` }}
              title={`Collection ${formatCurrency(bucket.collection)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand-700" /> Sales
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand-300" /> Collection
        </span>
      </div>
    </div>
  );
}

function Donut({
  parts,
}: {
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) {
    return <p className="mt-6 text-sm text-slate-500">No data available for this period.</p>;
  }
  let offset = 0;
  const circles = parts.map((part) => {
    const fraction = part.value / total;
    const dash = `${fraction * 100} ${100 - fraction * 100}`;
    const circle = (
      <circle
        key={part.label}
        cx="20"
        cy="20"
        r="14"
        fill="none"
        stroke={part.color}
        strokeWidth="6"
        strokeDasharray={dash}
        strokeDashoffset={-offset}
        pathLength={100}
      />
    );
    offset += fraction * 100;
    return circle;
  });
  return (
    <div className="mt-5 flex items-center gap-6">
      <svg viewBox="0 0 40 40" className="h-32 w-32 -rotate-90">
        {circles}
      </svg>
      <div className="space-y-2 text-sm">
        {parts.map((part) => (
          <div key={part.label}>
            <p className="text-slate-500">{part.label}</p>
            <p className="font-bold text-slate-800">{formatCurrency(part.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const active = rows.filter((row) => row.value > 0);
  const max = Math.max(1, ...active.map((row) => row.value));
  if (active.length === 0) {
    return (
      <div>
        {title && <p className="mb-3 text-sm font-semibold text-slate-700">{title}</p>}
        <p className="text-sm text-slate-500">No data available for this period.</p>
      </div>
    );
  }
  return (
    <div>
      {title && <p className="mb-3 text-sm font-semibold text-slate-700">{title}</p>}
      <div className="space-y-3">
        {active.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs text-slate-500">
              <span className="truncate">{row.label}</span>
              <span>{formatCurrency(row.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-brand-600"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
