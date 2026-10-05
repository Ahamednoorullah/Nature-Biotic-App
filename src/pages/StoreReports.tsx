import { useEffect, useMemo, useState } from "react";
import {
  froOwnsTransaction,
  getFROStockByExecutive,
  getFinalCompanyStoreSales,
  getStoredFarmers,
  isStorePurchaseReceived,
  settleLinkedFarmerAccounts,
  staff,
} from "@/lib/data";
import { buildInventoryRows } from "@/pages/StoreInventory";
import { useAuth } from "@/context/AuthContext";
import { Card, EmptyState } from "@/components/ui";
import {
  CategoryDonut,
  HorizontalBars,
  TrendBars,
} from "@/components/ReportCharts";
import { Icon } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  matchesSimpleDate,
  simpleDateFilterOptions,
  type SimpleDateFilter,
} from "@/lib/format";

function readRows(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function sameName(value: unknown, name: string) {
  return String(value || "").trim().toLowerCase() === name;
}

export default function StoreReports({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  if (user?.role === "fro") {
    return (
      <FroReportView
        storeId={storeId}
        name={user.name}
        staffId={user.staffId || user.id}
      />
    );
  }
  return <StoreReportView storeId={storeId} />;
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function inPeriod(
  value: unknown,
  filter: SimpleDateFilter,
  from: string,
  to: string,
) {
  return matchesSimpleDate(String(value || ""), filter, from, to);
}

function ReportTable({
  title,
  icon,
  headers,
  rows,
}: {
  title: string;
  icon: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
        <Icon name={icon} size={22} className="text-brand-600" />
        <h2 className="font-bold text-slate-800">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No data available for this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                {headers.map((header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-4 py-3 text-left font-semibold"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${index}-${cellIndex}`}
                      className="whitespace-nowrap px-4 py-3 text-slate-700"
                    >
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

function StoreReportView({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    const events = [
      "focus",
      "company-store-sales-updated",
      "nature-biotic-store-purchase-status-updated",
      "nature-biotic-store-receipts-updated",
      "nature-biotic-store-inventory-updated",
      "nature-biotic-purchase-returns-updated",
      "store-farmers-updated",
      "storage",
    ];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  const report = useMemo(() => {
    const dated = (value: unknown) => inPeriod(value, filter, customFrom, customTo);
    const sales = readRows(
      `nature-biotic-store-sales-invoices-v2:${storeId}`,
    ).filter(
      (row) =>
        row.id !== "store-sale-1" &&
        String(row.invoiceNo || "").trim().toLowerCase() !== "nb-inv-2001",
    );
    const returns = readRows(`nature-biotic-store-sales-returns-v2:${storeId}`);
    const receipts = readRows(`nature-biotic-store-receipts-v3:${storeId}`);
    const purchases = getFinalCompanyStoreSales().filter(
      (row) => row.storeId === storeId,
    );
    const purchaseReturns = readRows(`naturebiotic:purchase-returns:${storeId}`);
    const storeNames = new Set(
      staff
        .filter((member) => member.storeId === storeId)
        .map((member) => member.name.trim().toLowerCase())
        .filter(Boolean),
    );
    if (user?.name) storeNames.add(user.name.trim().toLowerCase());
    const expenses = readRows("naturebiotic_shared_expenses").filter((row) => {
      if (/^exp\d+$/.test(String(row.id || ""))) return false;
      const owner = String(row.enteredBy || "").trim().toLowerCase();
      const ownerStore = String(row.storeId || "");
      return ownerStore === storeId || storeNames.has(owner);
    });
    const farmers = getStoredFarmers().filter((farmer) => farmer.storeId === storeId);

    const returned = new Map<string, number>();
    returns.forEach((row) => {
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

    const periodSales = sales.filter((row) => dated(row.date));
    let salesValue = 0;
    let outstanding = 0;
    let quantitySold = 0;
    let directSales = 0;
    let executiveSales = 0;
    const salesByDate = new Map<string, number>();
    const outstandingByDate = new Map<string, number>();
    const productSales = new Map<string, { qty: number; value: number }>();
    const farmerSales = new Map<string, { sales: number; collection: number; outstanding: number }>();
    periodSales.forEach((invoice) => {
      const invoiceNo = String(invoice.invoiceNo || "").trim().toLowerCase();
      const net = Math.max(0, money(invoice.amount) - (returned.get(invoiceNo) || 0));
      salesValue += net;
      const due = Math.max(0, net - (paid.get(invoiceNo) || 0));
      outstanding += due;
      const products = Array.isArray(invoice.products) ? invoice.products : [];
      products.forEach((product: any) => {
        const qty = money(product.quantity);
        quantitySold += qty;
        const name = String(product.product?.name || product.productName || product.name || "Product");
        const current = productSales.get(name) || { qty: 0, value: 0 };
        current.qty += qty;
        current.value += money(product.rowTotal || product.total || product.amount);
        productSales.set(name, current);
      });
      const day = formatDate(String(invoice.date || "")) || "Undated";
      salesByDate.set(day, (salesByDate.get(day) || 0) + net);
      outstandingByDate.set(day, (outstandingByDate.get(day) || 0) + due);
      const through = String(invoice.through || "Direct").toLowerCase();
      if (through === "direct") directSales += net;
      else executiveSales += net;
      const farmer = String(invoice.partyName || "Customer");
      const current = farmerSales.get(farmer) || { sales: 0, collection: 0, outstanding: 0 };
      current.sales += net;
      current.outstanding += due;
      farmerSales.set(farmer, current);
    });

    const periodReceipts = receipts.filter((row) => dated(row.date));
    const collectionByDate = new Map<string, number>();
    const collection = periodReceipts.reduce((sum, row) => sum + money(row.amount), 0);
    periodReceipts.forEach((row) => {
      const day = formatDate(String(row.date || "")) || "Undated";
      collectionByDate.set(day, (collectionByDate.get(day) || 0) + money(row.amount));
    });
    periodReceipts.forEach((row) => {
      const farmer = String(row.farmerName || row.partyName || "Customer");
      const current = farmerSales.get(farmer) || { sales: 0, collection: 0, outstanding: 0 };
      current.collection += money(row.amount);
      farmerSales.set(farmer, current);
    });

    const purchaseGroups = new Map<
      string,
      { date: string; products: string[]; qty: number; value: number; received: boolean }
    >();
    purchases.filter((row) => dated(row.date)).forEach((row) => {
      const key = String(row.invoiceNo || "");
      const current = purchaseGroups.get(key) || {
        date: String(row.date || ""),
        products: [],
        qty: 0,
        value: 0,
        received: isStorePurchaseReceived(key),
      };
      if (row.product) current.products.push(String(row.product));
      current.qty += money(row.quantity);
      current.value += money(row.total);
      purchaseGroups.set(key, current);
    });

    const stockRows = buildInventoryRows(
      storeId,
      getFinalCompanyStoreSales().filter((row) => row.storeId === storeId),
    ).flatMap((product) =>
      product.packSizes.map((pack) => ({
        product: product.productName,
        size: pack.packSize,
        batch: pack.batchNo,
        quantity: pack.availableStock,
        value: pack.stockValue,
      })),
    );

    const periodReturns = returns.filter((row) => dated(row.date) && row.status !== "Rejected");
    const periodPurchaseReturns = purchaseReturns.filter((row) => dated(row.date));
    const periodExpenses = expenses.filter((row) => dated(row.date));
    const periodInvoiceNos = new Set(
      periodSales
        .map((row) => String(row.invoiceNo || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const linkedReturns = returns.filter((row) => {
      if (row.status === "Rejected") return false;
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      return dated(row.date) || periodInvoiceNos.has(invoiceNo);
    });
    const linkedReturnNos = new Set(
      linkedReturns
        .map((row) => String(row.returnNo || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const linkedRefunds = readRows(`nature-biotic-store-refunds-v2:${storeId}`).filter(
      (row) =>
        dated(row.date) ||
        linkedReturnNos.has(String(row.referenceNo || "").trim().toLowerCase()),
    );
    linkedRefunds.forEach((row) => {
      const day = formatDate(String(row.date || "")) || "Undated";
      collectionByDate.set(day, (collectionByDate.get(day) || 0) - money(row.amount));
    });
    const settled = settleLinkedFarmerAccounts({
      invoices: periodSales,
      receipts: periodReceipts,
      returns: linkedReturns,
      refunds: linkedRefunds,
      linkInvoices: sales,
      linkReturns: returns,
    });
    const creditNotes = readRows(`nature-biotic-store-credit-notes-v3:${storeId}`);
    const currentSettled = settleLinkedFarmerAccounts({
      invoices: sales,
      receipts,
      returns: [...returns, ...creditNotes].filter((row) => row.status !== "Rejected"),
      refunds: readRows(`nature-biotic-store-refunds-v2:${storeId}`),
      linkInvoices: sales,
      linkReturns: [...returns, ...creditNotes],
    });
    const currentByFarmer = new Map(
      currentSettled.farmers.map((row) => [row.farmerName.trim().toLowerCase(), row]),
    );
    const listedFarmers = new Set<string>();
    const farmerRows = settled.farmers.map((row) => {
      listedFarmers.add(row.farmerName.trim().toLowerCase());
      const current = currentByFarmer.get(row.farmerName.trim().toLowerCase());
      return [
        row.farmerName,
        formatCurrency(row.sales),
        formatCurrency(row.collection),
        formatCurrency(current?.outstanding || 0),
      ];
    });
    currentSettled.farmers.forEach((row) => {
      const key = row.farmerName.trim().toLowerCase();
      if (listedFarmers.has(key) || row.outstanding <= 0) return;
      farmerRows.push([
        row.farmerName,
        formatCurrency(0),
        formatCurrency(0),
        formatCurrency(row.outstanding),
      ]);
    });

    return {
      salesValue: settled.sales,
      invoiceCount: periodSales.length,
      quantitySold,
      collection: settled.collection,
      outstanding: currentSettled.outstanding,
      purchaseValue: Array.from(purchaseGroups.values()).reduce(
        (sum, row) => sum + row.value,
        0,
      ),
      stockValue: stockRows.reduce((sum, row) => sum + money(row.value), 0),
      stockQty: stockRows.reduce((sum, row) => sum + money(row.quantity), 0),
      expenseTotal: periodExpenses.reduce((sum, row) => sum + money(row.amount), 0),
      directSales,
      executiveSales,
      salesTrend: Array.from(salesByDate.entries()).map(([label, value]) => ({ label, value })),
      collectionTrend: Array.from(collectionByDate.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      outstandingTrend: Array.from(outstandingByDate.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      salesCompare: Array.from(salesByDate.keys()).map((label) => ({
        label,
        sales: salesByDate.get(label) || 0,
        collection: collectionByDate.get(label) || 0,
      })),
      productChart: Array.from(productSales.entries()).map(([label, value]) => ({
        label,
        value: value.value,
      })),
      stockChart: stockRows
        .filter((row) => money(row.value) > 0 || money(row.quantity) > 0)
        .map((row) => ({
          label: `${row.product} ${row.size}`.trim(),
          value: money(row.value),
        })),
      farmerChart: Array.from(farmerSales.entries()).map(([label, value]) => ({
        label,
        value: value.sales,
      })),
      farmerCount: farmers.length,
      activeFarmers: farmers.filter((farmer) => farmer.status === "Active").length,
      salesRows: periodSales.map((row) => [
        String(row.invoiceNo || "-"),
        formatDate(String(row.date || "")),
        String(row.partyName || "-"),
        String(row.through || "Direct"),
        formatCurrency(money(row.amount)),
      ]),
      productRows: Array.from(productSales.entries()).map(([name, value]) => [
        name,
        String(value.qty),
        formatCurrency(value.value),
      ]),
      collectionRows: periodReceipts.map((row) => [
        String(row.receiptNo || "-"),
        formatDate(String(row.date || "")),
        String(row.farmerName || row.partyName || "-"),
        formatCurrency(money(row.amount)),
      ]),
      outstandingRows: currentSettled.farmers
        .filter((row) => row.outstanding > 0)
        .map((row) => [row.farmerName, formatCurrency(row.outstanding)]),
      purchaseRows: Array.from(purchaseGroups.entries()).map(([invoiceNo, row]) => [
        invoiceNo,
        formatDate(row.date),
        row.products.join(", ") || "-",
        String(row.qty),
        formatCurrency(row.value),
        row.received ? "Received" : "Pending",
      ]),
      stockRows: stockRows.map((row) => [
        row.product,
        row.size || "-",
        row.batch || "-",
        String(row.quantity),
        formatCurrency(row.value),
      ]),
      salesReturnRows: periodReturns.map((row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        return [
          String(row.returnNo || "-"),
          formatDate(String(row.date || "")),
          String(row.partyName || "-"),
          items.map((item: any) => item.product || item.productName || item.name).filter(Boolean).join(", ") || "-",
          String(items.reduce((sum: number, item: any) => sum + money(item.quantity), 0)),
          formatCurrency(money(row.total)),
        ];
      }),
      purchaseReturnRows: periodPurchaseReturns.map((row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        return [
          String(row.returnNo || "-"),
          formatDate(String(row.date || "")),
          items.map((item: any) => item.product || item.productName).filter(Boolean).join(", ") || "-",
          String(items.reduce((sum: number, item: any) => sum + money(item.quantity), 0)),
          formatCurrency(money(row.total)),
          String(row.status || "-"),
        ];
      }),
      expenseRows: periodExpenses.map((row) => [
        formatDate(String(row.date || "")),
        String(row.category || "-"),
        formatCurrency(money(row.amount)),
      ]),
      farmerRows,
    };
  }, [storeId, filter, customFrom, customTo, version, user?.name]);

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Reports
          </h1>
          <p className="mt-1 text-slate-500">Store performance from saved transactions.</p>
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
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Sales</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(report.salesValue)}</p>
          <p className="mt-1 text-xs text-slate-500">{report.invoiceCount} invoices · {report.quantitySold} qty</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Collection</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(report.collection)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(report.outstanding)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">Current stock</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCurrency(report.stockValue)}</p>
          <p className="mt-1 text-xs text-slate-500">{report.stockQty} qty · current stock</p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-5">
          <TrendBars title="Sales trend" points={report.salesTrend} />
        </Card>
        <Card className="min-w-0 p-5">
          <TrendBars title="Collection trend" points={report.collectionTrend} />
        </Card>
        <Card className="min-w-0 p-5">
          <TrendBars title="Outstanding" points={report.outstandingTrend} />
        </Card>
        <Card className="min-w-0 p-5">
          <CategoryDonut
            title="Direct sales vs executive sales"
            points={[
              { label: "Direct", value: report.directSales },
              { label: "Executive", value: report.executiveSales },
            ]}
          />
        </Card>
        <Card className="min-w-0 p-5">
          <CategoryDonut title="Product-wise sales" points={report.productChart} />
        </Card>
        <Card className="min-w-0 p-5">
          <HorizontalBars title="Current stock" points={report.stockChart} />
          <p className="mt-2 text-xs text-slate-500">Current stock is not limited by the date filter.</p>
        </Card>
        <Card className="min-w-0 p-5 xl:col-span-2">
          <HorizontalBars title="Farmer sales" points={report.farmerChart} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ReportTable title="Sales" icon="receipt_long" headers={["Invoice", "Date", "Farmer", "Through", "Value"]} rows={report.salesRows} />
        <ReportTable title="Product-wise sales" icon="inventory_2" headers={["Product", "Quantity", "Value"]} rows={report.productRows} />
        <ReportTable title="Collection" icon="payments" headers={["Receipt", "Date", "Farmer", "Amount"]} rows={report.collectionRows} />
        <ReportTable title="Outstanding" icon="account_balance_wallet" headers={["Farmer", "Outstanding"]} rows={report.outstandingRows} />
        <ReportTable title="Purchases" icon="shopping_cart" headers={["Bill", "Date", "Products", "Qty", "Value", "Status"]} rows={report.purchaseRows} />
        <ReportTable title="Current stock" icon="inventory" headers={["Product", "Size", "Batch", "Quantity", "Stock value"]} rows={report.stockRows} />
        <ReportTable title="Sales returns" icon="undo" headers={["Return", "Date", "Farmer", "Product", "Qty", "Value"]} rows={report.salesReturnRows} />
        <ReportTable title="Purchase returns" icon="assignment_return" headers={["Return", "Date", "Product", "Qty", "Value", "Status"]} rows={report.purchaseReturnRows} />
        <ReportTable title="Expenses" icon="account_balance" headers={["Date", "Category", "Amount"]} rows={report.expenseRows} />
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
            <Icon name="groups" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Farmers</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div>
              <p className="text-xs text-slate-500">Farmers</p>
              <p className="text-xl font-bold text-slate-800">{report.farmerCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-bold text-slate-800">{report.activeFarmers}</p>
            </div>
          </div>
          {report.farmerRows.length === 0 ? (
            <p className="px-5 pb-8 text-center text-sm text-slate-500">
              No data available for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    {["Farmer", "Sales", "Collection", "Outstanding"].map((header) => (
                      <th key={header} className="px-4 py-3 text-left font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.farmerRows.map((row, index) => (
                    <tr key={`${row[0]}-${index}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-slate-700">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Expenses in this period: {formatCurrency(report.expenseTotal)}. Purchase value: {formatCurrency(report.purchaseValue)}.
      </p>
    </div>
  );
}

function FroReportView({
  storeId,
  name,
  staffId,
}: {
  storeId: string;
  name: string;
  staffId?: string;
}) {
  const froName = name.trim().toLowerCase();
  const [filter, setFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    const events = [
      "focus",
      "fro-sales-updated",
      "nature-biotic-store-receipts-updated",
      "nature-biotic-handover-updated",
      "nature-biotic-delivery-challan-updated",
      "nature-biotic-cash-received-updated",
      "nature-biotic-fro-stock-return-updated",
      "nature-biotic-expense-updated",
      "nature-biotic-fro-visits-updated",
      "nature-biotic-store-refunds-updated",
      "nature-biotic-store-sales-updated",
    ];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  const report = useMemo(() => {
    const dated = (value: unknown) =>
      matchesSimpleDate(String(value || ""), filter, customFrom, customTo);
    const ownedSales = readRows(`nature-biotic-store-sales-invoices-v2:${storeId}`).filter(
      (row) => froOwnsTransaction(row, name, staffId),
    );
    const sales = ownedSales.filter((row) => dated(row.date));
    const ownedCollections = readRows(`nature-biotic-store-receipts-v3:${storeId}`).filter(
      (row) => froOwnsTransaction(row, name, staffId),
    );
    const collections = ownedCollections.filter((row) => dated(row.date));
    const allReturns = readRows(`nature-biotic-store-sales-returns-v2:${storeId}`).filter(
      (row) =>
        sameName(row.executiveName, froName) ||
        sales.some(
          (invoice) =>
            String(invoice.invoiceNo || "").trim().toLowerCase() ===
            String(row.invoiceNo || "").trim().toLowerCase(),
        ) ||
        ownedSales.some(
          (invoice) =>
            String(invoice.invoiceNo || "").trim().toLowerCase() ===
            String(row.invoiceNo || "").trim().toLowerCase(),
        ),
    );
    const returns = allReturns.filter((row) => dated(row.date));
    const expenses = readRows("naturebiotic_shared_expenses").filter(
      (row) =>
        sameName(row.enteredBy, froName) &&
        !/^exp\d+$/.test(String(row.id || "")) &&
        dated(row.date),
    );
    const refunds = readRows(`nature-biotic-store-refunds-v2:${storeId}`).filter((row) => {
      const reference = String(row.referenceNo || "").trim().toLowerCase();
      return (
        sameName(row.executiveName, froName) ||
        allReturns.some(
          (item) => String(item.returnNo || "").trim().toLowerCase() === reference,
        )
      );
    });
    const stock = getFROStockByExecutive(storeId, name);
    const salesByDate = new Map<string, number>();
    const outstandingByDate = new Map<string, number>();
    const productSales = new Map<string, number>();
    const paid = new Map<string, number>();
    collections.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || row.billNo || "").trim().toLowerCase();
      if (!invoiceNo || invoiceNo === "-") return;
      paid.set(invoiceNo, (paid.get(invoiceNo) || 0) + Number(row.amount || 0));
    });
    let outstanding = 0;
    sales.forEach((row) => {
      const invoiceNo = String(row.invoiceNo || "").trim().toLowerCase();
      const amount = Number(row.amount || 0);
      const due = Math.max(amount - (paid.get(invoiceNo) || 0), 0);
      outstanding += due;
      const day = formatDate(String(row.date || "")) || "Undated";
      salesByDate.set(day, (salesByDate.get(day) || 0) + amount);
      outstandingByDate.set(day, (outstandingByDate.get(day) || 0) + due);
      const products = Array.isArray(row.products) ? row.products : [];
      products.forEach((product: any) => {
        const productName = String(
          product.product?.name || product.productName || product.name || "Product",
        );
        productSales.set(
          productName,
          (productSales.get(productName) || 0) +
            Number(product.rowTotal || product.total || product.amount || 0),
        );
      });
    });
    const collectionByDate = new Map<string, number>();
    collections.forEach((row) => {
      const day = formatDate(String(row.date || "")) || "Undated";
      collectionByDate.set(day, (collectionByDate.get(day) || 0) + Number(row.amount || 0));
    });
    refunds
      .filter((row) => {
        const reference = String(row.referenceNo || "").trim().toLowerCase();
        return (
          dated(row.date) ||
          allReturns.some(
            (item) => String(item.returnNo || "").trim().toLowerCase() === reference,
          )
        );
      })
      .forEach((row) => {
        const day = formatDate(String(row.date || "")) || "Undated";
        collectionByDate.set(
          day,
          (collectionByDate.get(day) || 0) - Number(row.amount || 0),
        );
      });
    const expenseCategories = new Map<string, number>();
    expenses.forEach((row) => {
      const category = String(row.category || "Other");
      expenseCategories.set(
        category,
        (expenseCategories.get(category) || 0) + Number(row.amount || 0),
      );
    });
    let visits = 0;
    const visitsByDate = new Map<string, number>();
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";
        if (!/visit/i.test(key)) continue;
        readRows(key).forEach((row) => {
          const owner = String(
            row.executiveName ?? row.froName ?? row.createdBy ?? row.userName ?? "",
          )
            .trim()
            .toLowerCase();
          const visitDate = row.date || row.visitDate;
          if (owner !== froName || !dated(visitDate)) return;
          visits += 1;
          const day = formatDate(String(visitDate || "")) || "Undated";
          visitsByDate.set(day, (visitsByDate.get(day) || 0) + 1);
        });
      }
    } catch {
      visits = 0;
    }
    const farmers = getStoredFarmers().filter(
      (farmer) =>
        farmer.storeId === storeId &&
        sameName(farmer.executiveName, froName) &&
        dated(farmer.joinedDate),
    );
    const handovers = readRows(`nature-biotic-fro-handovers-v1:${storeId}`).filter(
      (row) =>
        sameName(row.handedOverBy, froName) &&
        dated(row.date) &&
        String(row.status || "accepted").toLowerCase() === "accepted",
    );
    const deliveries = readRows(`nature-biotic-store-delivery-challans-v2:${storeId}`).filter(
      (row) =>
        sameName(row.executive, froName) &&
        dated(row.date) &&
        String(row.status || "").toLowerCase() === "accepted",
    );
    const stockReturns = readRows(
      `nature-biotic-fro-stock-return-requests-v1:${froName}`,
    ).filter((row) => dated(row.date));
    const qtyOf = (items: unknown) =>
      Array.isArray(items)
        ? items.reduce((sum, item) => sum + Number(item?.qty || item?.quantity || 0), 0)
        : 0;
    const salesTotal = sales.reduce(
      (sum, row) => sum + Math.max(0, Number(row.amount || 0)),
      0,
    );
    const account = settleLinkedFarmerAccounts({
      invoices: sales,
      receipts: collections,
      returns: returns.filter((row) => dated(row.date) || sales.some(
        (invoice) =>
          String(invoice.invoiceNo || "").trim().toLowerCase() ===
          String(row.invoiceNo || "").trim().toLowerCase(),
      )),
      refunds: refunds.filter((row) => {
        const reference = String(row.referenceNo || "").trim().toLowerCase();
        return (
          dated(row.date) ||
          allReturns.some(
            (item) => String(item.returnNo || "").trim().toLowerCase() === reference,
          )
        );
      }),
      linkInvoices: sales,
      linkReturns: allReturns,
    });
    const currentAccount = settleLinkedFarmerAccounts({
      invoices: ownedSales,
      receipts: ownedCollections,
      returns: allReturns,
      refunds,
      linkInvoices: ownedSales,
      linkReturns: allReturns,
    });
    return {
      sales,
      salesTotal,
      collection: account.collection,
      outstanding: currentAccount.outstanding,
      returns: returns.reduce((sum, row) => sum + Number(row.total || 0), 0),
      expenses: expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      stockValue: stock.reduce(
        (sum, row) => sum + Number(row.currentQty || 0) * Number(row.unitValue || 0),
        0,
      ),
      visits,
      farmers: farmers.length,
      handoverTotal: handovers.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      stockReceived: deliveries.reduce((sum, row) => sum + qtyOf(row.items), 0),
      stockReturned: stockReturns.reduce((sum, row) => sum + qtyOf(row.items), 0),
      salesTrend: Array.from(salesByDate.entries()).map(([label, value]) => ({ label, value })),
      collectionTrend: Array.from(collectionByDate.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      outstandingTrend: Array.from(outstandingByDate.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      visitTrend: Array.from(visitsByDate.entries()).map(([label, value]) => ({ label, value })),
      productChart: Array.from(productSales.entries()).map(([label, value]) => ({ label, value })),
      expenseChart: Array.from(expenseCategories.entries()).map(([label, value]) => ({
        label,
        value,
      })),
    };
  }, [storeId, froName, name, staffId, filter, customFrom, customTo, version]);

  const cards = [
    ["Sales", report.salesTotal],
    ["Collection", report.collection],
    ["Outstanding", report.outstanding],
    ["Sales Return", report.returns],
    ["Expenses", report.expenses],
    ["Hand stock (current)", report.stockValue],
    ["Cash handover", report.handoverTotal],
  ] as const;

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Your sales, collection, stock and expenses.</p>
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
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-4 sm:p-5">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{formatCurrency(value)}</p>
          </Card>
        ))}
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-medium text-slate-500">Visits</p>
          <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{report.visits}</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-medium text-slate-500">Farmers added</p>
          <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{report.farmers}</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-medium text-slate-500">Stock received</p>
          <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{report.stockReceived}</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-medium text-slate-500">Stock returned</p>
          <p className="mt-1 text-lg font-bold text-slate-800 sm:text-2xl">{report.stockReturned}</p>
        </Card>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-5">
          <TrendBars title="Sales trend" points={report.salesTrend} />
        </Card>
        <Card className="min-w-0 p-5">
          <TrendBars title="Collection trend" points={report.collectionTrend} />
        </Card>
        <Card className="min-w-0 p-5">
          <TrendBars title="Outstanding" points={report.outstandingTrend} />
        </Card>
        <Card className="min-w-0 p-5">
          <TrendBars title="Visits" points={report.visitTrend} format="count" />
        </Card>
        <Card className="min-w-0 p-5">
          <CategoryDonut title="Sales by product" points={report.productChart} />
        </Card>
        <Card className="min-w-0 p-5">
          <CategoryDonut title="Expense summary" points={report.expenseChart} />
        </Card>
        <Card className="min-w-0 p-5">
          <HorizontalBars
            title="Cash handover"
            points={
              report.handoverTotal > 0
                ? [{ label: "Handed over", value: report.handoverTotal }]
                : []
            }
          />
        </Card>
        <Card className="min-w-0 p-5">
          <HorizontalBars
            title="Stock received and returned"
            points={[
              { label: "Received", value: report.stockReceived },
              { label: "Returned", value: report.stockReturned },
            ]}
            format="count"
          />
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <Icon name="receipt_long" size={22} className="text-brand-600" />
          <h2 className="font-bold text-slate-800">My Sales</h2>
        </div>
        {report.sales.length === 0 ? (
          <EmptyState icon="receipt_long" title="No data available for this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Farmer</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.sales.map((row) => (
                  <tr key={String(row.id || row.invoiceNo)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.invoiceNo || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.date ? formatDate(String(row.date)) : "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.partyName || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {formatCurrency(Number(row.amount || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
