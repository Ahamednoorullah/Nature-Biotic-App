import { useEffect, useMemo, useState } from "react";
import {
  getCompanyCreditNoteSyncRecords,
  getCompanyRefunds,
  getFinalCompanyStoreSales,
  settleCompanyRefund,
  settleLinkedFarmerAccounts,
  stores as allStores,
} from "@/lib/data";
import { Card, Icon } from "@/components/ui";
import { CategoryDonut, CompareBars, HorizontalBars, TrendBars } from "@/components/ReportCharts";
import {
  formatCurrency,
  formatDate,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";

type DateFilter = SimpleDateFilter;

const STORE_SALES_KEY = "nature-biotic-store-sales-invoices-v2";
const STORE_RETURN_KEY = "nature-biotic-store-sales-returns-v2";
const STORE_CREDIT_KEY = "nature-biotic-store-credit-notes-v3";
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

  const companyCredits = new Map<string, number>();
  getCompanyCreditNoteSyncRecords().forEach((note) => {
    if (note.status === "Rejected") return;
    const invoiceNo = String(note.invoiceNo || note.purchaseRef || "")
      .trim()
      .toLowerCase();
    if (!invoiceNo) return;
    const key = `${note.storeId}|${invoiceNo}`;
    companyCredits.set(key, (companyCredits.get(key) || 0) + money(note.returnAmount));
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
    const net = Math.max(0, invoice.total - (companyCredits.get(key) || 0));
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
    companyRefunds.set(
      refund.storeId,
      (companyRefunds.get(refund.storeId) || 0) + money(refund.amount),
    );
  });
  let companySales = 0;
  let companyCollection = 0;
  const companyStoreIds = new Set<string>([
    ...companyGrossSales.keys(),
    ...companyGrossCollection.keys(),
    ...companyRefunds.keys(),
  ]);
  companyStoreIds.forEach((storeId) => {
    const settled = settleCompanyRefund(
      companyGrossSales.get(storeId) || 0,
      companyGrossCollection.get(storeId) || 0,
      companyRefunds.get(storeId) || 0,
    );
    companySales += settled.sales;
    companyCollection += settled.collection;
  });

  const lifetimeSales = new Map<string, number>();
  const lifetimeCollection = new Map<string, number>();
  const lifetimeRefunds = new Map<string, number>();
  companyInvoices.forEach((invoice, key) => {
    const net = Math.max(0, invoice.total - (companyCredits.get(key) || 0));
    lifetimeSales.set(
      invoice.storeId,
      (lifetimeSales.get(invoice.storeId) || 0) + net,
    );
  });
  companyReceipts.forEach((receipt) => {
    const storeId = String(receipt.storeId || "");
    lifetimeCollection.set(
      storeId,
      (lifetimeCollection.get(storeId) || 0) + money(receipt.amount),
    );
  });
  getCompanyRefunds().forEach((refund) => {
    lifetimeRefunds.set(
      refund.storeId,
      (lifetimeRefunds.get(refund.storeId) || 0) + money(refund.amount),
    );
  });
  let companyOutstanding = 0;
  const lifetimeOutstanding = new Map<string, number>();
  const lifetimeStoreIds = new Set<string>([
    ...lifetimeSales.keys(),
    ...lifetimeCollection.keys(),
    ...lifetimeRefunds.keys(),
  ]);
  lifetimeStoreIds.forEach((storeId) => {
    const settled = settleCompanyRefund(
      lifetimeSales.get(storeId) || 0,
      lifetimeCollection.get(storeId) || 0,
      lifetimeRefunds.get(storeId) || 0,
    );
    lifetimeOutstanding.set(storeId, settled.outstanding);
    companyOutstanding += settled.outstanding;
  });

  const storeBooks = allStores.map((store) => {
    const invoices = readRows(`${STORE_SALES_KEY}:${store.id}`);
    const returns = readRows(`${STORE_RETURN_KEY}:${store.id}`);
    const credits = readRows(`${STORE_CREDIT_KEY}:${store.id}`);
    const receipts = readRows(`${STORE_RECEIPT_KEY}:${store.id}`);
    const returned = new Map<string, number>();
    [...returns, ...credits].forEach((row) => {
      if (row.status === "Rejected") return;
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
        returns: [...readRows(`${STORE_RETURN_KEY}:${store.id}`), ...readRows(`${STORE_CREDIT_KEY}:${store.id}`)].filter(
          (row) => row.status !== "Rejected",
        ),
        refunds: readRows(`nature-biotic-store-refunds-v2:${store.id}`),
        linkInvoices: invoices,
        linkReturns: [
          ...readRows(`${STORE_RETURN_KEY}:${store.id}`),
          ...readRows(`${STORE_CREDIT_KEY}:${store.id}`),
        ],
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
    const settled = settleCompanyRefund(
      companyGrossSales.get(storeId) || 0,
      companyGrossCollection.get(storeId) || 0,
      companyRefunds.get(storeId) || 0,
    );
    companyByStore.set(storeId, {
      sales: settled.sales,
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
      sales += Math.max(0, invoice.total - (companyCredits.get(key) || 0));
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
  const [filter, setFilter] = useState<DateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [version, setVersion] = useState(0);

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

  const report = useMemo(
    () => buildReport(filter, customFrom, customTo),
    [filter, customFrom, customTo, version],
  );
  const hasActivity =
    report.sales > 0 ||
    report.collection > 0 ||
    report.outstanding > 0 ||
    report.expenseTotal > 0;

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
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
          {simpleDateFilterOptions.map((tab) => (
            <button
              key={tab.value}
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
      </div>

      {filter === "custom" && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <label className="text-sm text-slate-600">
            From
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            To
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary
          label="Sales"
          value={report.sales}
          detail={`Company ${formatCurrency(report.companySales)} · Market ${formatCurrency(report.marketSales)}`}
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
        <Summary label="Expenses" value={report.expenseTotal} detail="Company expenses" />
      </div>

      {!hasActivity ? (
        <Card className="p-8 text-center">
          <Icon name="bar_chart" size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">No data available for this period.</p>
        </Card>
      ) : (
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
              <h2 className="font-bold text-slate-800">Store performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 text-left font-semibold">Store</th>
                    <th className="px-5 py-3 text-right font-semibold">Sales</th>
                    <th className="px-5 py-3 text-right font-semibold">Collection</th>
                    <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.storeRows.map((store) => (
                    <tr key={store.id}>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {store.name}
                      </td>
                      <td className="px-5 py-3.5 text-right">{formatCurrency(store.sales)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {formatCurrency(store.collection)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {formatCurrency(store.outstanding)}
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
      )}

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
