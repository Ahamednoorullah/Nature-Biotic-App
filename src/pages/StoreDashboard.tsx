import { useState, useMemo } from "react";
import { useEffect } from "react";
import {
  getStore,
  getFROTotalStockCount,
  products,
} from "@/lib/data";
import {
  Card,
  StatCard,
  EmptyState,
  Button,
  Select,
  Icon,
} from "@/components/ui";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { createPortal } from "react-dom";
import { getStorePurchasesFromCompanySales } from "@/lib/data";
import { getFROStockTxnsByExecutive, getFROStockByExecutive, isStorePurchaseReceived } from "@/lib/data";
import { getStoreOverviewStockValue } from "@/pages/StoreInventory";
import { useAuth } from "@/context/AuthContext";
import {
  buildStoreDashboard,
  inPeriod,
  type ChannelSummary,
  type DashboardDetail,
  type DateFilter,
} from "@/lib/storeDashboardMetrics";

const filterTabs: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

type ExecKey = string;
type ExecDetailType =
  | "sales"
  | "collection"
  | "cash"
  | "outstanding"
  | "stocks";

type DirectDetailType = "sales" | "collection" | "outstanding" | "stocks";

type DirectDetailSelection = DirectDetailType | null;

type ExecDetailSelection = {
  execKey: ExecKey;
  execName: string;
  type: ExecDetailType;
} | null;

type ExecSummary = {
  sales: number;
  collection: number;
  collectionInHand: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  visits: number;
  bestArea: string;
  topProduct: string;
};


type FROHandover = {
  id: string;
  date: string;
  amount: number;
  method: string;
  handedOverBy: string;
  remarks?: string;
  status?: "pending" | "accepted";
  acceptedAt?: string;
  acceptedBy?: string;
};

const FRO_HANDOVER_STORAGE_PREFIX = "nature-biotic-fro-handovers-v1";

type AggregatedStockRow = {
  productId: string;
  productName: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  unitValue: number;
  qty: number;
};

export default function StoreDashboard({ storeId }: { storeId: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  function loadPendingHandovers() {
    try {
      const raw = localStorage.getItem(
        `${FRO_HANDOVER_STORAGE_PREFIX}:${storeId}`,
      );
      const all: FROHandover[] = raw ? JSON.parse(raw) : [];
      setPendingHandovers(
        all.filter((handover) => handover.status === "pending"),
      );
    } catch {
      setPendingHandovers([]);
    }
  }

  useEffect(() => {
    loadPendingHandovers();

    const refresh = () => loadPendingHandovers();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-handover-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("nature-biotic-handover-updated", refresh);
    };
  }, [storeId]);
  const store = getStore(storeId);
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [pendingHandovers, setPendingHandovers] = useState<FROHandover[]>([]);
  const [showPendingHandovers, setShowPendingHandovers] = useState(false);
  const [execDetail, setExecDetail] = useState<ExecDetailSelection>(null);
  const [directDetail, setDirectDetail] = useState<DirectDetailSelection>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    const events = [
      "nature-biotic-store-inventory-updated",
      "nature-biotic-store-receipts-updated",
      "nature-biotic-fro-visits-updated",
      "nature-biotic-handover-updated",
      "fro-sales-updated",
      "farmer-purchases-updated",
      "fro-stock-txns-updated",
      "store-purchase-orders-updated",
      "company-store-sales-updated",
      "nature-biotic-store-purchase-status-updated",
      "fro-stock-updated",
      "fro-accepted-deliveries-updated",
      "nature-biotic-store-stock-return-updated",
      "nature-biotic-fro-stock-return-updated",
      "focus",
    ];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  const dashboard = useMemo(
    () => buildStoreDashboard(storeId, dateFilter),
    [storeId, dateFilter, version],
  );
  const data = dashboard.overview;
  const directSales = dashboard.direct;
  const executives = dashboard.executives;
  const stockPurchases = useMemo(() => {
    const received = getStorePurchasesFromCompanySales(storeId)
      .filter((row) => isStorePurchaseReceived(row.invoiceNo))
      .filter((row) => inPeriod(row.date, dateFilter))
      .map((row) => {
        const quantity = Math.max(0, Number(row.quantity || 0));
        const rate = Number(row.unitPrice ?? row.rate ?? row.price ?? 0);
        const amount = rate > 0 ? quantity * rate : Number(row.total || 0);
        return { ...row, quantity, rate, total: amount };
      });

    return {
      rows: received.sort((a, b) => String(b.date).localeCompare(String(a.date))),
      totalValue: received.reduce((sum, row) => sum + Number(row.total || 0), 0),
      totalQty: received.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    };
  }, [storeId, dateFilter, version]);

  const currentStockValue = useMemo(
    () => getStoreOverviewStockValue(storeId),
    [storeId, version],
  );

    const execReceivedData = useMemo(() => {
    const result: Record<ExecKey, { qty: number; value: number }> = {} as any;

    executives.forEach((officer) => {
      const allTxns = getFROStockTxnsByExecutive(storeId, officer.name);
      const deliveryTxns = allTxns.filter(
        (t) => t.type === "Delivery" && inPeriod(t.date, dateFilter),
      );

      result[officer.id] = {
        qty: deliveryTxns.reduce((sum, t) => sum + t.qty, 0),
        value: deliveryTxns.reduce(
          (sum, t) => sum + t.qty * t.unitValue,
          0,
        ),
      };
    });

    return result;
  }, [storeId, dateFilter, executives]);

  const execStockData = useMemo(() => {
    const result: Record<
      ExecKey,
      {
        deliveryRows: AggregatedStockRow[];
        salesRows: AggregatedStockRow[];
        returnRows: AggregatedStockRow[];
        balanceRows: AggregatedStockRow[];
        deliveryTotalQty: number;
        deliveryTotalValue: number;
        salesTotalQty: number;
        salesTotalValue: number;
        returnTotalQty: number;
        returnTotalValue: number;
        balanceTotalQty: number;
        balanceTotalValue: number;
      }
    > = {} as any;

    executives.forEach((officer) => {
      const key = officer.id;
      const balanceRows = getFROStockByExecutive(storeId, officer.name).map(
        (row) => ({
          productId: row.productId,
          productName: row.productName,
          packSize: row.packSize,
          batchNo: row.batchNo,
          expiryDate: row.expiryDate,
          unitValue: Number(row.unitValue || 0),
          qty: Math.max(0, Number(row.currentQty || 0)),
        }),
      );
      const deliveryRows: AggregatedStockRow[] = [];
      const salesRows: AggregatedStockRow[] = [];
      const returnRows: AggregatedStockRow[] = [];

      result[key] = {
        deliveryRows,
        salesRows,
        returnRows,
        balanceRows,
        deliveryTotalQty: deliveryRows.reduce((s, r) => s + r.qty, 0),
        deliveryTotalValue: deliveryRows.reduce(
          (s, r) => s + r.qty * r.unitValue,
          0,
        ),
        salesTotalQty: salesRows.reduce((s, r) => s + r.qty, 0),
        salesTotalValue: salesRows.reduce((s, r) => s + r.qty * r.unitValue, 0),
        returnTotalQty: returnRows.reduce((s, r) => s + r.qty, 0),
        returnTotalValue: returnRows.reduce(
          (s, r) => s + r.qty * r.unitValue,
          0,
        ),
        balanceTotalQty: balanceRows.reduce((s, r) => s + r.qty, 0),
        balanceTotalValue: balanceRows.reduce(
          (s, r) => s + r.qty * r.unitValue,
          0,
        ),
      };
    });

    return result;
  }, [storeId, executives, version]);

  const pendingByExecutive = useMemo(() => {
    const map: Partial<Record<ExecKey, FROHandover[]>> = {};
    executives.forEach((officer) => {
      map[officer.id] = pendingHandovers.filter(
        (handover) =>
          handover.handedOverBy?.trim().toLowerCase() ===
          officer.name.trim().toLowerCase(),
      );
    });
    return map;
  }, [pendingHandovers, executives]);

  function acceptHandover(handoverId: string) {
    try {
      const storageKey = `${FRO_HANDOVER_STORAGE_PREFIX}:${storeId}`;
      const raw = localStorage.getItem(storageKey);
      const all: FROHandover[] = raw ? JSON.parse(raw) : [];

      const next = all.map((handover) => {
        if (handover.id !== handoverId || handover.status === "accepted") {
          return handover;
        }
        return {
          ...handover,
          status: "accepted" as const,
          acceptedAt: new Date().toISOString(),
          acceptedBy: user?.name || "Store Admin",
        };
      });

      localStorage.setItem(storageKey, JSON.stringify(next));
      setPendingHandovers(
        next.filter((handover) => handover.status === "pending"),
      );
      window.dispatchEvent(new Event("nature-biotic-handover-updated"));
    } catch {
      // Keep the current UI state if localStorage is unavailable.
    }
  }

  if (!store) return <EmptyState icon="error" title="Store not found" />;

  return (
    <div>
      {/* Sticky date filter */}
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

      {/* ROW 1 — Business Overview */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-10">
          Business Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
          <BusinessOverviewCard
            label="Sales"
            value={formatCurrency(data.sales)}
            icon="payments"
            color="brand"
            trend=""
          />
          <BusinessOverviewCard
            label="Collection"
            value={formatCurrency(data.collection)}
            icon="account_balance_wallet"
            color="blue"
            trend=""
          />
          <BusinessOverviewCard
            label="Outstanding"
            value={formatCurrency(data.outstanding)}
            icon="receipt_long"
            color="amber"
            trend=""
          />
          <BusinessOverviewCard
            label="Farmers"
            value={String(data.farmers)}
            icon="groups"
            color="purple"
            trend=""
          />
          <BusinessOverviewCard
            label="Farms"
            value={String(data.farms)}
            icon="agriculture"
            color="brand"
            trend=""
          />
          <BusinessOverviewCard
            label="Crops"
            value={String(data.crops)}
            icon="spa"
            color="blue"
            trend=""
          />
        </div>
      </div>

      {/* ROW 2 — Store Direct Sales */}
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Store Direct Sales
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Farmers who purchase directly from this store.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <DirectSalesCard
            label="Sales"
            value={formatCurrency(directSales.sales)}
            icon="payments"
            color="brand"
            onClick={() => setDirectDetail("sales")}
          />
          <DirectSalesCard
            label="Collection"
            value={formatCurrency(directSales.collection)}
            icon="account_balance_wallet"
            color="blue"
            onClick={() => setDirectDetail("collection")}
          />
          <DirectSalesCard
            label="Outstanding"
            value={formatCurrency(directSales.outstanding)}
            icon="receipt_long"
            color="amber"
            onClick={() => setDirectDetail("outstanding")}
          />
          <DirectSalesCard
            label="Farmers"
            value={String(directSales.farmers)}
            icon="groups"
            color="purple"
          />
          <DirectSalesCard
            label="Total Received"
            value={formatCurrency(stockPurchases.totalValue)}
            icon="local_shipping"
            color="brand"
            onClick={() => setDirectDetail("stocks")}
          />
          <DirectSalesCard
            label="Current Stocks"
            value={formatCurrency(currentStockValue)}
            icon="inventory_2"
            color="blue"
          />
        </div>
      </div>

      {directDetail &&
        createPortal(
          <DirectSalesDetailModal
            type={directDetail}
            dateFilter={dateFilter}
            summary={directSales}
            stockRows={stockPurchases.rows}
            stockTotalValue={stockPurchases.totalValue}
            storeName={store.name}
            onClose={() => setDirectDetail(null)}
          />,
          document.body,
        )}

      {/* ROW 3 — Executive Summary */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
          Executive Summary
        </h2>
        <div className="space-y-3">
          {executives.map((officer) => {
            const key = officer.id;
            const e = officer;
            const target = officer.target;
            const received = execReceivedData[key] || { qty: 0, value: 0 };
            const stock = execStockData[key];
            return (
              <Card key={key} className="p-4">
                <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${officer.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                    >
                      {initials(officer.name)}
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                        {officer.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-slate-400">
                          Field Executive
                        </p>
                        {(pendingByExecutive[key]?.length || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowPendingHandovers(true)}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending {pendingByExecutive[key]?.length}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ExecutiveTargetBadge
                      icon="payments"
                      label="Sales & Collection Target"
                      value={formatCurrency(target.sales)}
                      color="brand"
                    />
                    <ExecutiveTargetBadge
                      icon="groups"
                      label="Farmers Target"
                      value={String(target.farmers)}
                      color="blue"
                    />
                    <ExecutiveTargetBadge
                      icon="agriculture"
                      label="Farms Target"
                      value={String(target.farms)}
                      color="amber"
                    />
                    <ExecutiveTargetBadge
                      icon="receipt"
                      label="Visits Target"
                      value={String(target.visits)}
                      color="purple"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-8 gap-2">
                  <ExecField
                    icon="payments"
                    label="Sales"
                    value={formatCurrency(e.sales)}
                    color="text-brand-600"
                    onClick={() =>
                      setExecDetail({
                        execKey: key,
                        execName: officer.name,
                        type: "sales",
                      })
                    }
                  />
                  <ExecField
                    icon="account_balance_wallet"
                    label="Collection"
                    value={formatCurrency(e.collection)}
                    color="text-blue-600"
                    onClick={() =>
                      setExecDetail({
                        execKey: key,
                        execName: officer.name,
                        type: "collection",
                      })
                    }
                  />
                  <ExecField
                    icon="savings"
                    label="Cash in Hand"
                    value={formatCurrency(e.collectionInHand)}
                    color="text-emerald-600"
                    onClick={() =>
                      setExecDetail({
                        execKey: key,
                        execName: officer.name,
                        type: "cash",
                      })
                    }
                  />
                  <ExecField
                    icon="receipt_long"
                    label="Outstanding"
                    value={formatCurrency(e.outstanding)}
                    color="text-amber-600"
                    onClick={() =>
                      setExecDetail({
                        execKey: key,
                        execName: officer.name,
                        type: "outstanding",
                      })
                    }
                  />
                  <ExecField
                    icon="local_shipping"
                    label="Total Received"
                    value={String(received.qty)}
                    color="text-teal-600"
                  />
                  <ExecField
                    icon="groups"
                    label="Farmers"
                    value={String(e.farmers)}
                  />
                  {/* <ExecField
                    icon="agriculture"
                    label="Farms"
                    value={String(e.farms)}
                  /> */}
                  {/* <ExecField
                    icon="spa"
                    label="Crops"
                    value={String(e.crops)}
                  /> */}
                  <ExecField
                    icon="receipt"
                    label="Visits"
                    value={String(e.visits)}
                  />
                  <ExecField
                    icon="inventory_2"
                    label="Stocks in Hand"
                    value={formatCurrency(stock?.balanceTotalValue || 0)}
                    color="text-indigo-600"
                    onClick={() =>
                      setExecDetail({
                        execKey: key,
                        execName: officer.name,
                        type: "stocks",
                      })
                    }
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {showPendingHandovers &&
        createPortal(
          <PendingHandoverModal
            handovers={pendingHandovers}
            storeName={store.name}
            onAccept={acceptHandover}
            onClose={() => setShowPendingHandovers(false)}
          />,
          document.body,
        )}

      {execDetail &&
        createPortal(
          <ExecutiveDetailModal
            selection={execDetail}
            rows={
              executives.find((officer) => officer.id === execDetail.execKey)?.[
                execDetail.type === "sales"
                  ? "salesRows"
                  : execDetail.type === "collection"
                    ? "collectionRows"
                    : execDetail.type === "cash"
                      ? "cashRows"
                      : "outstandingRows"
              ] || []
            }
            stockData={
              execStockData[execDetail.execKey] || {
                deliveryRows: [],
                salesRows: [],
                returnRows: [],
                balanceRows: [],
                deliveryTotalQty: 0,
                deliveryTotalValue: 0,
                salesTotalQty: 0,
                salesTotalValue: 0,
                returnTotalQty: 0,
                returnTotalValue: 0,
                balanceTotalQty: 0,
                balanceTotalValue: 0,
              }
            }
            onClose={() => setExecDetail(null)}
          />,
          document.body,
        )}
    </div>
  );
}

function PendingHandoverModal({
  handovers,
  storeName,
  onAccept,
  onClose,
}: {
  handovers: FROHandover[];
  storeName: string;
  onAccept: (handoverId: string) => void;
  onClose: () => void;
}) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  function handleAccept(id: string) {
    setAcceptingId(id);
    onAccept(id);
    setAcceptingId(null);
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Icon name="pending_actions" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                Pending Cash Handover
              </h3>
              <p className="text-xs text-slate-500">{storeName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {handovers.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No pending handovers.
            </div>
          ) : (
            <div className="space-y-3">
              {handovers.map((handover) => (
                <div
                  key={handover.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-800">
                          {handover.handedOverBy}
                        </p>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Pending
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {handover.date} · {handover.method}
                      </div>
                      {handover.remarks && (
                        <p className="mt-1 text-xs text-slate-500">
                          {handover.remarks}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <p className="text-lg font-extrabold text-slate-800">
                        {formatCurrency(Number(handover.amount) || 0)}
                      </p>
                      <Button
                        onClick={() => handleAccept(handover.id)}
                        disabled={acceptingId === handover.id}
                      >
                        {acceptingId === handover.id
                          ? "Accepting..."
                          : "Accept"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function FROStockDetailModal({
  executiveName,
  storeId,
  onClose,
}: {
  executiveName: string;
  storeId: string;
  onClose: () => void;
}) {
  const stockCount = getFROTotalStockCount(executiveName, storeId);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Icon name="inventory_2" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Stock in Hand</h3>
              <p className="text-xs text-slate-500">{executiveName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">
            Total stock assigned
          </p>
          <p className="mt-2 text-4xl font-extrabold text-purple-700">
            {stockCount}
          </p>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function DirectSalesCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  color: "brand" | "blue" | "amber" | "purple";
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    brand: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card
      onClick={onClick}
      className={`p-4 transition-base hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? "cursor-pointer hover:ring-1 hover:ring-brand-200" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 whitespace-nowrap text-[14px] font-bold tracking-tight text-slate-800">
            {value}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
        >
          <Icon name={icon} size={18} />
        </div>
      </div>
    </Card>
  );
}

function DirectSalesDetailModal({
  type,
  dateFilter,
  summary,
  stockRows,
  stockTotalValue,
  storeName,
  onClose,
}: {
  type: DirectDetailType;
  dateFilter: DateFilter;
  summary: ChannelSummary;
  stockRows: ReturnType<typeof getStorePurchasesFromCompanySales>;
  stockTotalValue: number;
  storeName: string;
  onClose: () => void;
}) {
  const dateLabel: Record<DateFilter, string> = {
    today: "Today",
    weekly: "This Week",
    monthly: "This Month",
    quarterly: "This Quarter",
    yearly: "This Year",
  };

  // ---- STOCKS: real data from Company → Store purchases ----
  if (type === "stocks") {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
        <div className="flex h-[72vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Icon name="inventory_2" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  Store Stock Purchases
                </h3>
                <p className="text-xs text-slate-500">
                  {storeName} · {dateLabel[dateFilter]} · Purchased from Company
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
            >
              <Icon name="close" size={19} />
            </button>
          </div>

          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Purchase Value
              </span>
              <span className="text-lg font-extrabold text-slate-800">
                {formatCurrency(stockTotalValue)}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[820px] table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[6%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[12%] px-4 py-3 text-left">Date</th>
                  <th className="w-[16%] px-4 py-3 text-left">Invoice No</th>
                  <th className="w-[20%] px-4 py-3 text-left">Product</th>
                  <th className="w-[10%] px-4 py-3 text-center">Pack Size</th>
                  <th className="w-[10%] px-4 py-3 text-right">Qty</th>
                  <th className="w-[12%] px-4 py-3 text-right">Rate</th>
                  <th className="w-[14%] px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {stockRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No stock purchases from Company in this period.
                    </td>
                  </tr>
                ) : (
                  stockRows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate ? formatDate(row.date) : row.date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {row.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.product}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {row.packSize}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(row.rate)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {formatCurrency(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {stockRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td
                      colSpan={7}
                      className="px-4 py-3 text-right text-slate-600"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {formatCurrency(stockTotalValue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const titles: Record<Exclude<DirectDetailType, "stocks">, string> = {
    sales: "Direct Sales Details",
    collection: "Direct Collection Details",
    outstanding: "Direct Outstanding Details",
  };

  const icons: Record<Exclude<DirectDetailType, "stocks">, string> = {
    sales: "payments",
    collection: "account_balance_wallet",
    outstanding: "receipt_long",
  };

  const detailRows =
    type === "sales"
      ? summary.salesRows
      : type === "collection"
        ? summary.collectionRows
        : summary.outstandingRows;

  const totalValue =
    type === "sales"
      ? summary.sales
      : type === "collection"
        ? summary.collection
        : summary.outstanding;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[72vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icons[type]} size={20} />
            </div>

            <div>
              <h3 className="font-bold text-slate-800">{titles[type]}</h3>
              <p className="text-xs text-slate-500">
                {storeName} · {dateLabel[dateFilter]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </span>
            <span className="text-lg font-extrabold text-slate-800">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              {type === "sales" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[7%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[14%] px-4 py-3 text-left">Date</th>
                  <th className="w-[18%] px-4 py-3 text-left">Invoice No</th>
                  <th className="w-[25%] px-4 py-3 text-left">Farmer Name</th>
                  <th className="w-[16%] px-4 py-3 text-left">Sale Type</th>
                  <th className="w-[20%] px-4 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "collection" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[7%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[14%] px-4 py-3 text-left">Date</th>
                  <th className="w-[18%] px-4 py-3 text-left">Receipt No</th>
                  <th className="w-[25%] px-4 py-3 text-left">Farmer Name</th>
                  <th className="w-[16%] px-4 py-3 text-left">Method</th>
                  <th className="w-[20%] px-4 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "outstanding" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[7%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[14%] px-4 py-3 text-left">Date</th>
                  <th className="w-[18%] px-4 py-3 text-left">Invoice No</th>
                  <th className="w-[25%] px-4 py-3 text-left">Farmer Name</th>
                  <th className="w-[16%] px-4 py-3 text-center">Ageing</th>
                  <th className="w-[20%] px-4 py-3 text-right">Outstanding</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {detailRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No records in this period.
                  </td>
                </tr>
              ) : (
                detailRows.map((row, index) => (
                  <tr key={`${row.invoiceNo}-${row.receiptNo}-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 text-slate-600">{row.date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {type === "collection" ? row.receiptNo : row.invoiceNo}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.farmer}</td>
                    <td className={`px-4 py-3 text-slate-600 ${type === "outstanding" ? "text-center" : ""}`}>
                      {type === "sales" ? row.method : type === "collection" ? row.method : row.ageing}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${type === "outstanding" ? "text-amber-700" : "text-slate-800"}`}>
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td colSpan={5} className="px-4 py-3 text-right text-slate-600">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-slate-900">
                  {formatCurrency(totalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function BusinessOverviewCard({
  label,
  value,
  icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: string;
  color: "brand" | "blue" | "amber" | "purple";
  trend: string;
}) {
  const colors: Record<string, string> = {
    brand: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card className="p-4 transition-base hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[14px] font-bold tracking-tight text-slate-800">
            {value}
          </p>
        </div>

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}
        >
          <Icon name={icon} size={16} />
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold leading-tight text-emerald-600">
        {trend}
      </p>
    </Card>
  );
}

function ExecutiveDetailModal({
  selection,
  rows,
  stockData,
  onClose,
}: {
  selection: Exclude<ExecDetailSelection, null>;
  rows: DashboardDetail[];
  stockData: {
    deliveryRows: AggregatedStockRow[];
    salesRows: AggregatedStockRow[];
    returnRows: AggregatedStockRow[];
    balanceRows: AggregatedStockRow[];
    deliveryTotalQty: number;
    deliveryTotalValue: number;
    salesTotalQty: number;
    salesTotalValue: number;
    returnTotalQty: number;
    returnTotalValue: number;
    balanceTotalQty: number;
    balanceTotalValue: number;
  };
  onClose: () => void;
}) {
  const { execName, type } = selection;

  const titles: Record<ExecDetailType, string> = {
    sales: "Sales Details",
    collection: "Collection Details",
    cash: "Cash in Hand Details",
    outstanding: "Outstanding Details",
    stocks: "Stocks in Hand Details",
  };

  const icons: Record<ExecDetailType, string> = {
    sales: "payments",
    collection: "account_balance_wallet",
    cash: "savings",
    outstanding: "receipt_long",
    stocks: "inventory_2",
  };

    if (type === "stocks") {
    const activeRows = stockData.balanceRows;
    const activeQty = stockData.balanceTotalQty;
    const activeValue = stockData.balanceTotalValue;

    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
        <div className="flex h-[76vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <Icon name={icons[type]} size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  {execName} — Hand Stock
                </h3>
                <p className="text-xs text-slate-500">
                  Current stock balance with this executive
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
            >
              <Icon name="close" size={19} />
            </button>
          </div>

          

          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Qty
                </span>
                <span className="text-lg font-extrabold text-slate-800">
                  {activeQty}
                </span>
              </div>

              <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Value
                </span>
                <span className="text-lg font-extrabold text-indigo-700">
                  {formatCurrency(activeValue)}
                </span>
              </div>

              
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[6%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[22%] px-4 py-3 text-left">Product</th>
                  <th className="w-[12%] px-4 py-3 text-center">Pack Size</th>
                  <th className="w-[14%] px-4 py-3 text-left">Batch No</th>
                  <th className="w-[12%] px-4 py-3 text-center">Expiry</th>
                  <th className="w-[10%] px-4 py-3 text-right">Qty</th>
                  <th className="w-[12%] px-4 py-3 text-right">Unit Value</th>
                  <th className="w-[12%] px-4 py-3 text-right">Total Value</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {activeRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No stock in hand.
                    </td>
                  </tr>
                ) : (
                  activeRows.map((row, index) => (
                    <tr
                      key={`${row.productId}-${row.packSize}-${row.batchNo}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-center text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {row.productName}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {row.packSize}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.batchNo || "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {row.expiryDate || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {row.qty}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(row.unitValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {formatCurrency(row.qty * row.unitValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {activeRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right text-slate-600"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {activeQty}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-slate-900">
                      {formatCurrency(activeValue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[72vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icons[type]} size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                {execName} — {titles[type]}
              </h3>
              <p className="text-xs text-slate-500">
                Detailed activity for the selected executive
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              {type === "sales" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Invoice No</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "collection" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Receipt No</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "cash" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "outstanding" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-left">Village</th>
                  <th className="px-5 py-3 text-left">Phone No</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={type === "outstanding" ? 5 : type === "cash" ? 3 : 4}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No records in this period.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.invoiceNo}-${row.receiptNo}-${index}`} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{row.date}</td>
                    {type === "sales" && (
                      <td className="px-5 py-3 font-semibold text-slate-700">{row.invoiceNo}</td>
                    )}
                    {type === "collection" && (
                      <td className="px-5 py-3 font-semibold text-slate-700">{row.receiptNo}</td>
                    )}
                    <td className="px-5 py-3 text-slate-700">{row.farmer}</td>
                    {type === "outstanding" && (
                      <>
                        <td className="px-5 py-3 text-slate-600">{row.village || "-"}</td>
                        <td className="px-5 py-3 text-slate-600">{row.phone || "-"}</td>
                      </>
                    )}
                    <td className={`px-5 py-3 text-right font-bold ${type === "outstanding" ? "text-amber-700" : "text-slate-800"}`}>
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-10">
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td
                  colSpan={type === "outstanding" ? 4 : type === "cash" ? 2 : 3}
                  className="px-5 py-4 text-right text-sm font-bold text-slate-600"
                >
                  Total
                </td>

                <td className="px-5 py-4 text-right text-base font-bold tabular-nums text-amber-700">
                  {formatCurrency(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
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
    <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto max-w-full">
      {filterTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-base whitespace-nowrap ${
            value === tab.key
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ExecutiveTargetBadge({
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
  const tone: Record<string, string> = {
    brand: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };

  return (
    <div
      className={`min-w-[118px] rounded-lg border px-2.5 py-1.5 ${tone[color]}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={13} />
        <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">
          {label}
        </span>
      </div>

      <div className="mt-0.5">
        <span className="text-xs font-bold">{value}</span>
      </div>
    </div>
  );
}

function ExecField({
  icon,
  label,
  value,
  color = "text-slate-800",
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50/70 transition ${
        onClick
          ? "cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5"
          : "cursor-default"
      }`}
    >
      <Icon name={icon} size={15} className="text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
          {label}
        </p>
        <p className={`text-sm font-bold leading-tight ${color} truncate`}>
          {value}
        </p>
      </div>
    </button>
  );
}
