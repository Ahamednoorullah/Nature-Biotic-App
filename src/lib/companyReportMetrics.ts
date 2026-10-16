/**
 * Company Reports metrics from the same Supabase snapshot the Company Dashboard uses.
 * Company sales (Nature Biotic → stores) stay distinct from market (store → farmer) sales.
 */
import {
  companyPeriodNetSales,
  settleCompanyAccount,
  settleLinkedFarmerAccounts,
} from "@/lib/data";
import { formatDate, matchesSimpleDate, type SimpleDateFilter } from "@/lib/format";
import type { CompanyDashboardSnapshot } from "@/lib/db/operations";

export type CompanyReportFilter = SimpleDateFilter;

export type CompanyReportStoreRow = {
  id: string;
  name: string;
  /** Store → farmer (market) net sales in period */
  sales: number;
  collection: number;
  outstanding: number;
  farmers: number;
  /** Company → store net sales in period */
  companySales: number;
  companyCollection: number;
};

export type CompanyReportBucket = {
  label: string;
  sales: number;
  collection: number;
};

export type CompanyReportResult = {
  companyGross: number;
  companySalesReturn: number;
  companySales: number;
  marketSales: number;
  sales: number;
  companyCollection: number;
  marketCollection: number;
  collection: number;
  companyOutstanding: number;
  marketOutstanding: number;
  outstanding: number;
  expenseTotal: number;
  expenseCategories: { name: string; value: number }[];
  creditNoteTotal: number;
  creditNoteCount: number;
  storeRows: CompanyReportStoreRow[];
  storeComparison: { name: string; sales: number; outstanding: number }[];
  buckets: CompanyReportBucket[];
  productRows: { name: string; value: number }[];
  companyInvoiceRows: {
    date: string;
    invoiceNo: string;
    storeName: string;
    amount: number;
  }[];
  companyReceiptRows: {
    date: string;
    receiptNo: string;
    storeName: string;
    invoiceNo: string;
    amount: number;
  }[];
  purchaseReturnRows: {
    date: string;
    returnNo: string;
    storeName: string;
    amount: number;
  }[];
};

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function inPeriod(value: unknown, filter: CompanyReportFilter, from = "", to = "") {
  return matchesSimpleDate(String(value || ""), filter, from, to);
}

type ExpenseRow = {
  date: string;
  amount: number;
  category: string;
  status?: string;
};

type CreditNoteRow = {
  date: string;
  total: number;
  status?: string;
};

export function buildCompanyReportFromSnapshot(
  snapshot: CompanyDashboardSnapshot,
  filter: CompanyReportFilter,
  options?: {
    expenses?: ExpenseRow[];
    creditNotes?: CreditNoteRow[];
    from?: string;
    to?: string;
  },
): CompanyReportResult {
  const from = options?.from || "";
  const to = options?.to || "";
  const storeName = new Map(snapshot.stores.map((store) => [store.id, store.name]));
  const nameOf = (storeId: string) => storeName.get(storeId) || "Store";

  const grossSalesByStore = new Map<string, number>();
  const grossCollectionByStore = new Map<string, number>();
  const returnsByStore = new Map<string, number>();
  const cashRefundsByStore = new Map<string, number>();
  const companyInvoiceRows: CompanyReportResult["companyInvoiceRows"] = [];
  const companyReceiptRows: CompanyReportResult["companyReceiptRows"] = [];
  const purchaseReturnRows: CompanyReportResult["purchaseReturnRows"] = [];

  snapshot.companyInvoices.forEach((invoice) => {
    if (!inPeriod(invoice.date, filter, from, to) || invoice.total <= 0) return;
    grossSalesByStore.set(
      invoice.storeId,
      (grossSalesByStore.get(invoice.storeId) || 0) + invoice.total,
    );
    companyInvoiceRows.push({
      date: invoice.date,
      invoiceNo: invoice.invoiceNo,
      storeName: nameOf(invoice.storeId),
      amount: invoice.total,
    });
  });

  snapshot.purchaseReturns.forEach((row) => {
    if (!inPeriod(row.date, filter, from, to) || row.amount <= 0) return;
    returnsByStore.set(row.storeId, (returnsByStore.get(row.storeId) || 0) + row.amount);
    purchaseReturnRows.push({
      date: row.date,
      returnNo: row.returnNo,
      storeName: nameOf(row.storeId),
      amount: row.amount,
    });
  });

  snapshot.companyReceipts.forEach((receipt) => {
    if (!inPeriod(receipt.date, filter, from, to) || receipt.amount <= 0) return;
    grossCollectionByStore.set(
      receipt.storeId,
      (grossCollectionByStore.get(receipt.storeId) || 0) + receipt.amount,
    );
    companyReceiptRows.push({
      date: receipt.date,
      receiptNo: receipt.receiptNo,
      storeName: nameOf(receipt.storeId),
      invoiceNo: receipt.invoiceNo || "-",
      amount: receipt.amount,
    });
  });

  snapshot.companyRefunds.forEach((refund) => {
    if (!inPeriod(refund.date, filter, from, to) || refund.cashPaid <= 0) return;
    cashRefundsByStore.set(
      refund.storeId,
      (cashRefundsByStore.get(refund.storeId) || 0) + refund.cashPaid,
    );
    companyReceiptRows.push({
      date: refund.date,
      receiptNo: `Refund ${refund.refundNo}`,
      storeName: nameOf(refund.storeId),
      invoiceNo: "-",
      amount: -refund.cashPaid,
    });
  });

  let companyGross = 0;
  let companySalesReturn = 0;
  let companySales = 0;
  let companyCollection = 0;
  const companyPeriodByStore = new Map<string, number>();
  const companyCollectionByStore = new Map<string, number>();
  const periodStoreIds = new Set<string>([
    ...grossSalesByStore.keys(),
    ...grossCollectionByStore.keys(),
    ...returnsByStore.keys(),
    ...cashRefundsByStore.keys(),
  ]);
  periodStoreIds.forEach((storeId) => {
    const gross = grossSalesByStore.get(storeId) || 0;
    const returns = returnsByStore.get(storeId) || 0;
    const settled = settleCompanyAccount({
      grossSales: gross,
      salesReturns: returns,
      receipts: grossCollectionByStore.get(storeId) || 0,
      refunds: cashRefundsByStore.get(storeId) || 0,
    });
    const net = companyPeriodNetSales(gross, returns);
    companyPeriodByStore.set(storeId, net);
    companyCollectionByStore.set(storeId, settled.collection);
    companyGross += gross;
    companySalesReturn += returns;
    companySales += net;
    companyCollection += settled.collection;
  });

  // Lifetime company outstanding (matches Company Dashboard).
  const invoicedByStore = new Map<string, number>();
  const receivedByStore = new Map<string, number>();
  const appliedRefundByStore = new Map<string, number>();
  snapshot.companyInvoices.forEach((invoice) => {
    invoicedByStore.set(invoice.storeId, (invoicedByStore.get(invoice.storeId) || 0) + invoice.total);
  });
  snapshot.companyReceipts.forEach((receipt) => {
    receivedByStore.set(receipt.storeId, (receivedByStore.get(receipt.storeId) || 0) + receipt.amount);
  });
  snapshot.companyRefunds.forEach((refund) => {
    appliedRefundByStore.set(
      refund.storeId,
      (appliedRefundByStore.get(refund.storeId) || 0) + refund.appliedToOutstanding,
    );
  });
  let companyOutstanding = 0;
  const lifetimeOutstanding = new Map<string, number>();
  snapshot.stores.forEach((store) => {
    const due = Math.max(
      0,
      (invoicedByStore.get(store.id) || 0) -
        (receivedByStore.get(store.id) || 0) -
        (appliedRefundByStore.get(store.id) || 0),
    );
    lifetimeOutstanding.set(store.id, due);
    companyOutstanding += due;
  });

  const storeRows: CompanyReportStoreRow[] = snapshot.stores.map((store) => {
    const invoices = snapshot.salesInvoices.filter((row) => row.storeId === store.id);
    const returns = snapshot.salesReturns.filter(
      (row) => row.storeId === store.id && String(row.status || "").toLowerCase() === "approved",
    );
    const receipts = snapshot.storeReceipts.filter((row) => row.storeId === store.id);
    const refunds = snapshot.storeRefunds.filter((row) => row.storeId === store.id);
    const periodInvoices = invoices.filter((row) => inPeriod(row.date, filter, from, to));
    const periodReturns = returns.filter((row) => inPeriod(row.date, filter, from, to));
    const periodReceipts = receipts.filter((row) => inPeriod(row.date, filter, from, to));
    const periodRefunds = refunds.filter((row) => inPeriod(row.date, filter, from, to));
    const settled = settleLinkedFarmerAccounts({
      invoices: periodInvoices,
      receipts: periodReceipts,
      returns: periodReturns,
      refunds: periodRefunds,
      linkInvoices: invoices,
      linkReturns: returns,
    });
    const current = settleLinkedFarmerAccounts({
      invoices,
      receipts,
      returns,
      refunds,
      linkInvoices: invoices,
      linkReturns: returns,
    });
    return {
      id: store.id,
      name: store.name,
      sales: settled.sales,
      collection: settled.collection,
      outstanding: current.outstanding,
      farmers: snapshot.activeFarmersByStore.find((row) => row.storeId === store.id)?.count || 0,
      companySales: companyPeriodByStore.get(store.id) || 0,
      companyCollection: companyCollectionByStore.get(store.id) || 0,
    };
  });

  const marketSales = storeRows.reduce((sum, row) => sum + row.sales, 0);
  const marketCollection = storeRows.reduce((sum, row) => sum + row.collection, 0);
  const marketOutstanding = storeRows.reduce((sum, row) => sum + row.outstanding, 0);

  const expenses = (options?.expenses || []).filter((row) => {
    const status = String(row.status || "accepted").toLowerCase();
    if (status === "rejected" || status === "cancelled" || status === "canceled") return false;
    if (status === "pending") return false;
    return inPeriod(row.date, filter, from, to);
  });
  const expenseTotal = expenses.reduce((sum, row) => sum + money(row.amount), 0);
  const expenseCategories = new Map<string, number>();
  expenses.forEach((row) => {
    const category = String(row.category || "Other");
    expenseCategories.set(category, (expenseCategories.get(category) || 0) + money(row.amount));
  });

  // Credit notes are documentation-only — totals for reporting, never cash/stock.
  const creditNotes = (options?.creditNotes || []).filter((row) =>
    inPeriod(row.date, filter, from, to),
  );
  const creditNoteTotal = creditNotes.reduce((sum, row) => sum + money(row.total), 0);

  // Trend buckets: company net + market net for sales; company + market collection.
  const dayKeys = new Set<string>();
  const addDay = (value: string) => {
    const key = String(value || "").slice(0, 10);
    if (key && inPeriod(key, filter, from, to)) dayKeys.add(key);
  };
  snapshot.companyInvoices.forEach((row) => addDay(row.date));
  snapshot.purchaseReturns.forEach((row) => addDay(row.date));
  snapshot.companyReceipts.forEach((row) => addDay(row.date));
  snapshot.companyRefunds.forEach((row) => addDay(row.date));
  snapshot.salesInvoices.forEach((row) => addDay(row.date));
  snapshot.storeReceipts.forEach((row) => addDay(row.date));
  snapshot.salesReturns.forEach((row) => addDay(row.date));
  snapshot.storeRefunds.forEach((row) => addDay(row.date));

  const sortedDays = Array.from(dayKeys).sort();
  const buckets: CompanyReportBucket[] = [];
  const useMonth = filter === "quarterly" || filter === "yearly";
  if (useMonth) {
    const byMonth = new Map<string, { sales: number; collection: number }>();
    const monthKey = (d: string) => d.slice(0, 7);
    const bump = (key: string, sales: number, collection: number) => {
      const cur = byMonth.get(key) || { sales: 0, collection: 0 };
      cur.sales += sales;
      cur.collection += collection;
      byMonth.set(key, cur);
    };
    snapshot.companyInvoices.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to)) return;
      bump(monthKey(row.date), row.total, 0);
    });
    snapshot.purchaseReturns.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to)) return;
      bump(monthKey(row.date), -row.amount, 0);
    });
    snapshot.companyReceipts.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to)) return;
      bump(monthKey(row.date), 0, row.amount);
    });
    snapshot.companyRefunds.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to) || row.cashPaid <= 0) return;
      bump(monthKey(row.date), 0, -row.cashPaid);
    });
    snapshot.salesInvoices.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to)) return;
      bump(monthKey(row.date), row.amount, 0);
    });
    snapshot.salesReturns.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to)) return;
      if (String(row.status || "").toLowerCase() !== "approved") return;
      bump(monthKey(row.date), -row.amount, 0);
    });
    snapshot.storeReceipts.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to)) return;
      bump(monthKey(row.date), 0, row.amount);
    });
    snapshot.storeRefunds.forEach((row) => {
      if (!inPeriod(row.date, filter, from, to) || row.cashPaid <= 0) return;
      bump(monthKey(row.date), 0, -row.cashPaid);
    });
    Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        const [y, m] = key.split("-").map(Number);
        buckets.push({
          label: new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short" }),
          sales: value.sales,
          collection: value.collection,
        });
      });
  } else {
    sortedDays.slice(-40).forEach((day) => {
      let sales = 0;
      let collection = 0;
      snapshot.companyInvoices.forEach((row) => {
        if (row.date.slice(0, 10) === day) sales += row.total;
      });
      snapshot.purchaseReturns.forEach((row) => {
        if (row.date.slice(0, 10) === day) sales -= row.amount;
      });
      snapshot.companyReceipts.forEach((row) => {
        if (row.date.slice(0, 10) === day) collection += row.amount;
      });
      snapshot.companyRefunds.forEach((row) => {
        if (row.date.slice(0, 10) === day && row.cashPaid > 0) collection -= row.cashPaid;
      });
      snapshot.salesInvoices.forEach((row) => {
        if (row.date.slice(0, 10) === day) sales += row.amount;
      });
      snapshot.salesReturns.forEach((row) => {
        if (
          row.date.slice(0, 10) === day &&
          String(row.status || "").toLowerCase() === "approved"
        ) {
          sales -= row.amount;
        }
      });
      snapshot.storeReceipts.forEach((row) => {
        if (row.date.slice(0, 10) === day) collection += row.amount;
      });
      snapshot.storeRefunds.forEach((row) => {
        if (row.date.slice(0, 10) === day && row.cashPaid > 0) collection -= row.cashPaid;
      });
      buckets.push({
        label: formatDate(day) || day,
        sales,
        collection,
      });
    });
  }

  // Store performance table shows market figures; comparison chart = market + company sales
  // without double-counting outstanding (company outstanding separate from farmer AR).
  const storeComparison = storeRows.map((store) => ({
    name: store.name,
    sales: store.sales + store.companySales,
    outstanding: store.outstanding,
  }));

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
    expenseCategories: Array.from(expenseCategories.entries()).map(([name, value]) => ({
      name,
      value,
    })),
    creditNoteTotal,
    creditNoteCount: creditNotes.length,
    storeRows,
    storeComparison,
    buckets,
    productRows: [],
    companyInvoiceRows: companyInvoiceRows.sort((a, b) => b.date.localeCompare(a.date)),
    companyReceiptRows: companyReceiptRows.sort((a, b) => b.date.localeCompare(a.date)),
    purchaseReturnRows: purchaseReturnRows.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
