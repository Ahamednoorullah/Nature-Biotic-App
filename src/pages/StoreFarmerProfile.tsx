import { useEffect, useRef, useState } from "react";
import { StoreInvoiceBillModal } from "@/components/StoreInvoiceBillModal";
import StoreAddFarmer from "@/pages/StoreAddFarmer";
import {
  getFarmerById,
  getPurchasesByFarmer,
  getPaymentsByFarmer,
  updateFarmer,
  farmerFromRefund,
  settleLinkedFarmerAccounts,
  cropTypes,
  soilTypes,
  waterSources,
  customerCategories,
  type Farmer,
} from "@/lib/data";
import { useNav } from "@/context/NavContext";
import { useAuth } from "@/context/AuthContext";
import { usesSupabaseData } from "@/lib/db/mode";
import { loadFarmers, loadFarmerActivity, type FarmerActivity } from "@/lib/db/farmers";
import { dbErrorMessage } from "@/lib/db/errors";
import {
  Card,
  Badge,
  Button,
  EmptyState,
  Icon,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { formatCurrency, formatDate, initials, parseBusinessDate } from "@/lib/format";

type Tab =
  | "overview"
  | "purchases"
  | "invoices"
  | "product-history"
  | "payments"
  | "documents";

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "invoices", label: "Invoices", icon: "receipt_long" },
  { key: "product-history", label: "Product History", icon: "inventory_2" },
  { key: "payments", label: "Payment Receipt", icon: "payments" },
];

const colorMap: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  teal: "from-teal-400 to-teal-600",
  red: "from-red-400 to-red-600",
  amber: "from-amber-400 to-amber-600",
  blue: "from-blue-400 to-blue-600",
  purple: "from-purple-400 to-purple-600",
};

export default function StoreFarmerProfile({
  storeId: _storeId,
  farmerId,
}: {
  storeId: string;
  farmerId: string;
}) {
  const { goStorePage } = useNav();
  const { user } = useAuth();
  const isFro = user?.role === "fro";
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const raw = sessionStorage.getItem("nature-biotic-farmer-profile-tab");
      if (!raw) return "overview";
      const saved = JSON.parse(raw) as { farmerId?: string; tab?: string };
      if (saved.farmerId === farmerId && saved.tab === "invoices") {
        sessionStorage.removeItem("nature-biotic-farmer-profile-tab");
        return "invoices";
      }
    } catch {
      // Keep the default overview tab.
    }
    return "overview";
  });
  const [openInvoice, setOpenInvoice] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loadedFarmer, setLoadedFarmer] = useState<Farmer | undefined>();
  const [activity, setActivity] = useState<FarmerActivity | null>(null);
  const [profileLoading, setProfileLoading] = useState(usesSupabaseData());
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    const refresh = () => setRefresh((value) => value + 1);
    const events = [
      "focus",
      "nature-biotic-store-refunds-updated",
      "nature-biotic-store-sales-updated",
      "nature-biotic-sales-invoices-updated",
      "nature-biotic-store-receipts-updated",
      "nature-biotic-store-inventory-updated",
    ];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  useEffect(() => {
    if (!usesSupabaseData()) return;
    let active = true;
    setProfileLoading(true);
    setProfileError("");
    Promise.all([loadFarmers(), loadFarmerActivity(_storeId, farmerId)])
      .then(([rows, ledger]) => {
        if (!active) return;
        setLoadedFarmer(rows.find((row) => row.id === farmerId && row.storeId === _storeId));
        setActivity(ledger);
      })
      .catch((error) => {
        if (!active) return;
        setProfileError(dbErrorMessage(error, "Could not load this farmer."));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [farmerId, _storeId, refresh]);
  const farmer = usesSupabaseData() ? loadedFarmer : getFarmerById(farmerId);

  if (profileLoading) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="person"
          title="Loading farmer"
          description="Reading this farmer's details and transactions."
        />
      </Card>
    );
  }

  if (profileError) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="error"
          title="Could not load farmer"
          description={profileError}
          action={
            <Button onClick={() => goStorePage("farmers")}>
              <Icon name="arrow_back" size={18} /> Back to Farmers
            </Button>
          }
        />
      </Card>
    );
  }

  if (!farmer) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="person_off"
          title="Farmer not found"
          description="This farmer profile may have been removed."
          action={
            <Button onClick={() => goStorePage("farmers")}>
              <Icon name="arrow_back" size={18} /> Back to Farmers
            </Button>
          }
        />
      </Card>
    );
  }

  if (editOpen) {
    return (
      <StoreAddFarmer
        storeId={farmer.storeId || _storeId}
        editFarmerId={farmerId}
        onCancel={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          setRefresh((value) => value + 1);
        }}
      />
    );
  }

  // Keep the existing Farmer Profile UI/format exactly as-is.
  // Only connect its data to the live Store Sales Invoice + Receipt records.
  const readStoreRows = <T,>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(`${key}:${_storeId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const farmerNameKey = String(farmer.name || "")
    .trim()
    .toLowerCase();
  const farmerIdText = String(farmerId || "").trim();
  const dbMode = usesSupabaseData() && activity;
  const paidByInvoice = new Map<string, number>();
  if (dbMode) {
    activity.receipts.forEach((receipt) => {
      if (receipt.status.toLowerCase() === "cancelled" || !receipt.invoiceNo) return;
      paidByInvoice.set(
        receipt.invoiceNo,
        (paidByInvoice.get(receipt.invoiceNo) || 0) + receipt.amount,
      );
    });
  }
  const invoicePaymentStatus = (invoiceNo: string, amount: number, status: string) => {
    if (!dbMode) return "";
    if (status.toLowerCase() === "cancelled") return "Cancelled";
    return (paidByInvoice.get(invoiceNo) || 0) + 0.009 >= Number(amount || 0)
      ? "Paid"
      : "Pending";
  };

  const liveInvoices = dbMode
    ? activity.invoices
    : readStoreRows<any>(
    "nature-biotic-store-sales-invoices-v2",
  ).filter((invoice: any) => {
    if (invoice.id === "store-sale-1") return false;
    if (String(invoice.invoiceNo || "").trim().toLowerCase() === "nb-inv-2001") {
      return false;
    }
    const invoiceFarmerId = String(
      invoice.farmerId || invoice.customerId || "",
    ).trim();
    const farmerIdText = String(farmerId || "").trim();
    const invoiceName = String(
      invoice.partyName || invoice.farmerName || invoice.customerName || "",
    )
      .trim()
      .toLowerCase();
    const sameId = Boolean(
      invoiceFarmerId && farmerIdText && invoiceFarmerId === farmerIdText,
    );
    const sameName = Boolean(
      !invoiceFarmerId && invoiceName && farmerNameKey && invoiceName === farmerNameKey,
    );
    return sameId || sameName;
  });

  const liveReceipts = dbMode
    ? activity.receipts.filter((receipt) => receipt.status.toLowerCase() !== "cancelled")
    : readStoreRows<any>(
    "nature-biotic-store-receipts-v3",
  ).filter((receipt: any) => {
    const receiptFarmerId = String(receipt.farmerId || "").trim();
    const idMatch = Boolean(receiptFarmerId) && receiptFarmerId === String(farmerId).trim();
    const nameMatch =
      !receiptFarmerId &&
      String(receipt.farmerName || "")
        .trim()
        .toLowerCase() === farmerNameKey;

    return idMatch || nameMatch;
  });

  const purchaseSource = dbMode
    ? liveInvoices.filter(
        (invoice: { status?: string }) =>
          String(invoice.status || "").toLowerCase() === "final",
      )
    : liveInvoices;
  const purchases = purchaseSource.flatMap((invoice: any) => {
          const products = Array.isArray(invoice.products)
            ? invoice.products
            : Array.isArray(invoice.items)
              ? invoice.items
              : [];

          if (products.length === 0) return [];

          return products.map((item: any, index: number) => {
            const quantity = Number(item.quantity ?? item.qty ?? 0);
            const packSize = String(
              item.pkgsize || item.packSize || item.product?.size || "",
            ).trim();
            const name = String(
              item.product?.name || item.productName || item.name || "",
            ).trim();
            const lineAmount = Number(item.rowTotal ?? item.lineTotal ?? item.total ?? 0);
            const amount =
              lineAmount > 0
                ? lineAmount
                : quantity * Number(item.sellingPrice ?? item.price ?? 0);
            return {
            id: `${invoice.id}-${index}`,
            invoiceNo: invoice.invoiceNo,
            date: invoice.date,
            product: packSize ? `${name} - ${packSize}` : name,
            quantity,
            amount,
            paymentStatus: invoicePaymentStatus(
              String(invoice.invoiceNo || ""),
              Number(invoice.amount || 0),
              String(invoice.status || ""),
            ) || (liveReceipts.some(
              (receipt: any) =>
                String(receipt.invoiceNo || "") ===
                String(invoice.invoiceNo || ""),
            )
              ? "Paid"
              : "Pending"),
            kind: "sale" as const,
            packSize,
            batchNo: String(item.batchNo || ""),
          };
          });
        });

  const invoices = liveInvoices.map((invoice: any) => {
    const products = Array.isArray(invoice.products) ? invoice.products : [];
    const productLabel = products.length
      ? products
          .map((item: any) =>
            String(item.product?.name || item.productName || item.product || "—"),
          )
          .join(", ")
      : "—";
    const quantity = products.reduce(
      (sum: number, item: any) => sum + Number(item.quantity ?? item.qty ?? 0),
      0,
    );
    const paidStatus = invoicePaymentStatus(
      String(invoice.invoiceNo || ""),
      Number(invoice.amount || 0),
      String(invoice.status || ""),
    );
    const paid = paidStatus
      ? paidStatus === "Paid"
      : liveReceipts.some(
      (receipt: any) =>
        String(receipt.invoiceNo || "") === String(invoice.invoiceNo || ""),
    );
    return {
      id: String(invoice.id || invoice.invoiceNo),
      invoiceNo: String(invoice.invoiceNo || ""),
      date: String(invoice.date || ""),
      product: productLabel,
      quantity,
      amount: Number(invoice.amount || 0),
      paymentStatus: paidStatus || (paid ? "Paid" : "Pending"),
    };
  });

  // Existing Payment Receipt tab keeps its old table UI and receives live receipts.
  const payments: ReturnType<typeof getPaymentsByFarmer> = liveReceipts.map(
    (receipt: any) => ({
      id: receipt.id,
      farmerId,
      receiptNo: receipt.receiptNo,
      date: receipt.date,
      method: receipt.method,
      note: receipt.remarks || "",
      amount: Number(receipt.amount || 0),
    }),
  ) as ReturnType<typeof getPaymentsByFarmer>;

  const salesReturns = dbMode
    ? activity.returns.filter((row) => row.status.toLowerCase() === "approved")
    : readStoreRows<any>("nature-biotic-store-sales-returns-v2");
  const farmerReturns = salesReturns.filter((row: any) => {
    const status = String(row.status || "").trim().toLowerCase();
    if (status === "draft") return false;
    const returnFarmerId = String(row.farmerId || "").trim();
    const returnName = String(row.partyName || row.farmerName || "")
      .trim()
      .toLowerCase();
    if (returnFarmerId && farmerIdText) return returnFarmerId === farmerIdText;
    return Boolean(returnName && farmerNameKey && returnName === farmerNameKey);
  });
  const returnHistory = farmerReturns.flatMap((row: any) => {
    const items = Array.isArray(row.items) ? row.items : [];
    const seen = new Set<string>();
    return items.flatMap((item: any, index: number) => {
      const lineId = String(item.key || item.id || `${row.id}-${index}`);
      const historyId = `return:${row.id || row.returnNo}:${lineId}`;
      if (seen.has(historyId)) return [];
      seen.add(historyId);
      const packSize = String(item.packSize || item.pkgsize || item.product?.size || "").trim();
      const name = String(
        item.product?.name || item.productName || item.name || "",
      ).trim();
      const quantity = Number(item.quantity ?? item.qty ?? 0);
      const amount = Number(item.lineTotal ?? item.total ?? item.rowTotal ?? item.amount ?? 0);
      const status = String(row.status || "").trim() || "Recorded";
      return [
        {
          id: historyId,
          farmerId,
          invoiceNo: String(row.returnNo || row.id || ""),
          date: String(row.date || row.returnDate || ""),
          product: packSize ? `${name} - ${packSize}` : name,
          quantity,
          amount,
          paymentStatus: "Pending" as const,
          kind: "return" as const,
          packSize,
          batchNo: String(item.batchNo || ""),
          status,
          reason: String(item.reason || row.reason || ""),
        },
      ];
    });
  });
  const productHistory = [...purchases, ...returnHistory];
  const storedRefunds = dbMode
    ? activity.refunds
    : readStoreRows<any>("nature-biotic-store-refunds-v2");
  const allInvoices = dbMode
    ? activity.invoices
    : readStoreRows<any>("nature-biotic-store-sales-invoices-v2");
  const allReceipts = dbMode
    ? activity.receipts
    : readStoreRows<any>("nature-biotic-store-receipts-v3");
  const accountInvoices = dbMode
    ? allInvoices.filter((row) => String(row.status || "").toLowerCase() === "final")
    : allInvoices;
  const accountReceipts = dbMode
    ? allReceipts.filter((row) => String(row.status || "").toLowerCase() === "final")
    : allReceipts;
  const accountRefunds = dbMode
    ? storedRefunds.filter((row) => String(row.status || "").toLowerCase() === "final")
    : storedRefunds;
  const account = settleLinkedFarmerAccounts({
    invoices: accountInvoices,
    receipts: accountReceipts,
    returns: salesReturns,
    refunds: accountRefunds,
  }).farmers.find((row) => {
    if (row.farmerId && row.farmerId === String(farmerId)) return true;
    return !row.farmerId && row.farmerName.trim().toLowerCase() === farmerNameKey;
  }) || { sales: 0, collection: 0, outstanding: 0 };
  const farmerRefunds = dbMode
    ? activity.refunds
        .filter((refund) => refund.status.toLowerCase() !== "cancelled")
        .map((refund) => ({
          id: refund.id,
          farmerId,
          receiptNo: refund.refundNo || "Refund",
          date: refund.date,
          method: "Refund",
          note: `Reference ${refund.referenceNo || "-"}`,
          amount: refund.amount,
        }))
    : storedRefunds.flatMap((refund) => {
    const linked = farmerFromRefund(refund, salesReturns, allInvoices);
    const sameId = Boolean(linked.farmerId) && linked.farmerId === String(farmerId);
    const sameName =
      !linked.farmerId && linked.farmerName.trim().toLowerCase() === farmerNameKey;
    if (!sameId && !sameName) return [];
    return [
      {
        id: String(refund.id || refund.refundNo),
        farmerId,
        receiptNo: String(refund.refundNo || "Refund"),
        date: String(refund.date || ""),
        method: "Refund",
        note: `Sales return ${linked.returnNo || refund.referenceNo || "-"} · Invoice ${linked.invoiceNo || "-"}`,
        amount: Number(refund.amount || 0),
      },
    ];
  });
  const paymentHistory = [...payments, ...farmerRefunds];
  const totalSpent = account.sales;
  const totalPaid = account.collection;
  const outstandingBalance = account.outstanding;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => goStorePage("farmers")}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium text-sm mb-4 transition-base"
      >
        <Icon name="arrow_back" size={18} /> Back to Farmers
      </button>

      {/* Profile header */}
      <Card className="p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {farmer.profileImage ? (
            <img
              src={farmer.profileImage}
              alt={farmer.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 shrink-0 mx-auto sm:mx-0"
            />
          ) : (
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${colorMap[farmer.profileColor] ?? "from-slate-400 to-slate-600"} flex items-center justify-center text-white font-bold text-2xl shrink-0 mx-auto sm:mx-0`}
            >
              {initials(farmer.name)}
            </div>
          )}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {farmer.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Icon name="location_on" size={16} />
                {farmer.village}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="call" size={16} />
                {farmer.phone}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="calendar_month" size={16} />
                Since {formatDate(farmer.joinedDate)}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Icon name="edit" size={16} /> Edit Farmer
            </Button>
            <Badge color={farmer.status === "Active" ? "green" : "slate"}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "currentColor" }}
              />
              {farmer.status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div
        className={
          isFro
            ? "grid grid-cols-4 gap-2 mb-5"
            : "flex gap-2 mb-5 overflow-x-auto pb-1"
        }
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            title={isFro ? t.label : undefined}
            aria-label={isFro ? t.label : undefined}
            className={`flex items-center justify-center ${
              isFro
                ? "w-full h-11 rounded-xl px-2"
                : "gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap"
            } text-sm font-semibold transition-base ${
              tab === t.key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon name={t.icon} size={17} fill={tab === t.key} />
            {isFro ? (
              <span className="text-[8px] font-bold leading-none">
                {t.key === "product-history" ? "History" : t.label}
              </span>
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={tab} className="animate-fade-in">
        {tab === "overview" && (
          <OverviewTab
            farmer={farmer}
            purchases={purchases}
            payments={paymentHistory}
            totalSpent={totalSpent}
            totalPaid={totalPaid}
            outstandingBalance={outstandingBalance}
            isFro={isFro}
          />
        )}
        {tab === "purchases" && <PurchasesTab purchases={purchases} />}
        {tab === "invoices" && (
          <InvoicesTab
            invoices={invoices}
            onOpen={(invoiceNo) => {
              const match = liveInvoices.find(
                (invoice: { invoiceNo?: string }) =>
                  String(invoice.invoiceNo || "") === invoiceNo,
              );
              if (!match) return;
              if (isFro) {
                sessionStorage.setItem(
                  "nature-biotic-open-store-invoice",
                  JSON.stringify({
                    storeId: farmer.storeId,
                    invoiceNo,
                    from: "farmer-details",
                    farmerId,
                    tab: "invoices",
                  }),
                );
                goStorePage("sales-invoice");
                return;
              }
              setTab("invoices");
              setOpenInvoice(match);
            }}
          />
        )}
        {tab === "product-history" && (
          <ProductHistoryTab purchases={productHistory} isFro={isFro} />
        )}
        {tab === "payments" && <PaymentsTab payments={paymentHistory} />}
        {tab === "documents" && <DocumentsTab />}
      </div>
      {openInvoice && (
        <StoreInvoiceBillModal
          storeId={farmer.storeId || _storeId}
          sale={openInvoice}
          onClose={() => setOpenInvoice(null)}
        />
      )}
    </div>
  );
}

function OverviewTab({
  farmer,
  purchases,
  payments,
  totalSpent,
  totalPaid,
  outstandingBalance,
  isFro = false,
}: {
  farmer: ReturnType<typeof getFarmerById>;
  purchases: ReturnType<typeof getPurchasesByFarmer>;
  payments: ReturnType<typeof getPaymentsByFarmer>;
  totalSpent: number;
  totalPaid: number;
  outstandingBalance: number;
  isFro?: boolean;
}) {
  if (!farmer) return null;

  const totalLand =
    farmer.crops?.reduce((sum, crop) => sum + Number(crop.landSize || 0), 0) ??
    farmer.landSize;

  const cropNames = farmer.crops?.length
    ? farmer.crops.map((crop) => crop.cropType).join(", ")
    : farmer.cropType || "—";

  const infoItems = [
    {
      icon: "badge",
      label: "Customer Category",
      value: farmer.customerCategory,
    },
    {
      icon: "call",
      label: "Alternative Mobile",
      value: farmer.altMobile || "—",
    },
    { icon: "receipt_long", label: "GST Number", value: farmer.gst || "—" },
    { icon: "home", label: "Farmer Address", value: farmer.farmAddress || "—" },
    { icon: "location_on", label: "Village", value: farmer.village || "—" },
    { icon: "near_me", label: "Landmark", value: farmer.landmark || "—" },
    { icon: "location_city", label: "District", value: farmer.district || "—" },
    { icon: "public", label: "State", value: farmer.state || "—" },
    { icon: "mark_email_read", label: "Pincode", value: farmer.pincode || "—" },
    {
      icon: "crop_square",
      label: "Total Land",
      value: `${totalLand || 0} acres`,
    },
    { icon: "grass", label: "Crops", value: cropNames },
    {
      icon: "account_circle",
      label: farmer.through === "Executive" ? "Created By" : "Created Through",
      value:
        farmer.through === "Executive"
          ? `${farmer.executiveName || "FRO"} · FRO`
          : "Direct",
    },
    {
      icon: "calendar_month",
      label: "Customer Since",
      value: formatDate(farmer.joinedDate),
    },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Stats */}
      <div
        className={
          isFro
            ? "lg:col-span-1 grid grid-cols-3 gap-2"
            : "lg:col-span-1 space-y-4"
        }
      >
        <Card className={isFro ? "p-3 min-w-0" : "p-5"}>
          <p className="text-[10px] sm:text-sm text-slate-500 font-medium leading-tight">
            Total Purchase Value
          </p>
          <p
            className={
              isFro
                ? "text-sm sm:text-base font-bold text-slate-800 mt-1 truncate"
                : "text-2xl font-bold text-slate-800 mt-1"
            }
          >
            {formatCurrency(totalSpent)}
          </p>
        </Card>
        <Card className={isFro ? "p-3 min-w-0" : "p-5"}>
          <p className="text-[10px] sm:text-sm text-slate-500 font-medium leading-tight">
            Total Payments Made
          </p>
          <p
            className={
              isFro
                ? "text-sm sm:text-base font-bold text-brand-600 mt-1 truncate"
                : "text-2xl font-bold text-brand-600 mt-1"
            }
          >
            {formatCurrency(totalPaid)}
          </p>
        </Card>
        <Card className={isFro ? "p-3 min-w-0" : "p-5"}>
          <p className="text-[10px] sm:text-sm text-slate-500 font-medium leading-tight">
            Outstanding Balance
          </p>
          <p
            className={
              isFro
                ? `text-sm sm:text-base font-bold mt-1 truncate ${outstandingBalance > 0 ? "text-amber-600" : "text-brand-600"}`
                : `text-2xl font-bold mt-1 ${outstandingBalance > 0 ? "text-amber-600" : "text-brand-600"}`
            }
          >
            {outstandingBalance > 0
              ? formatCurrency(outstandingBalance)
              : "Clear"}
          </p>
        </Card>
      </div>

      {/* Info grid */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-4">Farmer Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon name={item.icon} size={18} className="text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PurchasesTab({
  purchases,
}: {
  purchases: ReturnType<typeof getPurchasesByFarmer>;
}) {
  if (purchases.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="shopping_cart"
          title="No purchases yet"
          description="This farmer hasn't made any purchases yet."
        />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">
                Invoice Number
              </th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Product</th>
              <th className="text-right font-semibold px-5 py-3.5">Quantity</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
              <th className="text-center font-semibold px-5 py-3.5">
                Payment Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-base">
                <td className="px-5 py-3.5 font-semibold text-brand-600">
                  {p.invoiceNo}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(p.date)}
                </td>
                <td className="px-5 py-3.5 font-semibold text-slate-700">
                  {p.product}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {p.quantity}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Badge color={p.paymentStatus === "Paid" ? "green" : "amber"}>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "currentColor" }}
                    />
                    {p.paymentStatus}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InvoicesTab({
  invoices,
  onOpen,
}: {
  invoices: {
    id: string;
    invoiceNo: string;
    date: string;
    product: string;
    quantity: number;
    amount: number;
    paymentStatus: string;
  }[];
  onOpen: (invoiceNo: string) => void;
}) {
  if (invoices.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="receipt_long"
          title="No invoices found."
          description="No invoices found."
        />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">S.No</th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Invoice No</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
              <th className="text-center font-semibold px-5 py-3.5">Payment</th>
              <th className="text-center font-semibold px-5 py-3.5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv, index) => (
              <tr
                key={inv.id}
                onClick={() => onOpen(inv.invoiceNo)}
                className="cursor-pointer hover:bg-slate-50/50 transition-base"
              >
                <td className="px-5 py-3.5 text-slate-500">{index + 1}</td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(inv.date)}
                </td>
                <td className="px-5 py-3.5 font-semibold text-brand-600">
                  {inv.invoiceNo}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                  {formatCurrency(inv.amount)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Badge color={inv.paymentStatus === "Paid" ? "green" : "amber"}>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "currentColor" }}
                    />
                    {inv.paymentStatus}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(inv.invoiceNo);
                    }}
                    className="font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PaymentsTab({
  payments,
}: {
  payments: ReturnType<typeof getPaymentsByFarmer>;
}) {
  if (payments.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="payments"
          title="No payments recorded"
          description="No payment history available for this farmer."
        />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed text-[10px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left font-semibold px-5 py-3.5">
                Receipt No.
              </th>
              <th className="text-left font-semibold px-5 py-3.5">Date</th>
              <th className="text-left font-semibold px-5 py-3.5">Method</th>
              <th className="text-left font-semibold px-5 py-3.5">Note</th>
              <th className="text-right font-semibold px-5 py-3.5">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition-base">
                <td className="px-5 py-3.5 font-semibold text-brand-600">
                  {p.receiptNo}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {formatDate(p.date)}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">
                    {p.method}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{p.note}</td>
                <td className="px-5 py-3.5 text-right font-bold text-brand-600">
                  {formatCurrency(p.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type PeriodFilter = "this-month" | "3-months" | "6-months";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "3-months", label: "Last 3 Months" },
  { value: "6-months", label: "Last 6 Months" },
];

function getPeriodStartDate(period: PeriodFilter): Date {
  const now = new Date();
  if (period === "this-month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === "3-months") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  // 6-months
  const d = new Date(now);
  d.setMonth(d.getMonth() - 6);
  return d;
}

function ProductHistoryTab({
  purchases,
  isFro = false,
}: {
  purchases: Array<
    ReturnType<typeof getPurchasesByFarmer>[number] & {
      kind?: "sale" | "return";
      packSize?: string;
      batchNo?: string;
      status?: string;
      reason?: string;
    }
  >;
  isFro?: boolean;
}) {
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodFilter>("3-months");

  const startDate = getPeriodStartDate(period);
  const periodPurchases = purchases.filter((p) => {
    const date = parseBusinessDate(p.date);
    return Boolean(date && date >= startDate);
  });

  const productOptions = Array.from(
    new Set(purchases.map((p) => p.product)),
  ).sort();

  const filteredPurchases =
    selectedProduct === "all"
      ? periodPurchases
      : periodPurchases.filter((p) => p.product === selectedProduct);

  if (purchases.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon="inventory_2"
          title="No products given yet"
          description="No products have been supplied to this farmer."
        />
      </Card>
    );
  }

  const groups = new Map<
    string,
    { product: string; quantity: number; times: number; lastDate: string; value: number }
  >();
  for (const row of filteredPurchases) {
    const current = groups.get(row.product) || {
      product: row.product,
      quantity: 0,
      times: 0,
      lastDate: "",
      value: 0,
    };
    const signed = row.kind === "return" ? -1 : 1;
    current.quantity += signed * Number(row.quantity || 0);
    current.value += signed * Number(row.amount || 0);
    if (row.kind !== "return") {
      current.times += 1;
      const currentTime = parseBusinessDate(current.lastDate)?.getTime() || 0;
      const nextTime = parseBusinessDate(row.date)?.getTime() || 0;
      if (!current.lastDate || nextTime >= currentTime) current.lastDate = row.date;
    }
    groups.set(row.product, current);
  }
  const rows = Array.from(groups.values()).sort((a, b) => {
    const aDate = parseBusinessDate(a.lastDate)?.getTime() || 0;
    const bDate = parseBusinessDate(b.lastDate)?.getTime() || 0;
    return bDate - aDate;
  });

  const periodLabel =
    periodOptions.find((p) => p.value === period)?.label ?? "";

  return (
    <Card className="overflow-hidden">
      {/* Filter bar */}
      <div className="px-3 py-3 border-b border-slate-100 bg-slate-50">
        <p className="mb-2 text-[10px] text-slate-500 font-medium">
          Product purchases — {periodLabel.toLowerCase()}
        </p>
        <div
          className={
            isFro
              ? "grid grid-cols-2 gap-2 w-full"
              : "flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
          }
        >
          <div className={isFro ? "min-w-0 w-full" : "w-full sm:w-44"}>
            <Select
              value={period}
              onChange={(v) => setPeriod(v as PeriodFilter)}
              options={periodOptions}
            />
          </div>
          <div className={isFro ? "min-w-0 w-full" : "w-full sm:w-56"}>
            <Select
              value={selectedProduct}
              onChange={setSelectedProduct}
              options={[
                { value: "all", label: "All Products" },
                ...productOptions.map((p) => ({ value: p, label: p })),
              ]}
            />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="No data found"
          description={
            selectedProduct === "all"
              ? `No products have been supplied ${periodLabel.toLowerCase()}.`
              : `"${selectedProduct}" has not been given ${periodLabel.toLowerCase()}.`
          }
        />
      ) : (
        <div className={isFro ? "w-full overflow-hidden" : "overflow-x-auto"}>
          <table
            className={
              isFro
                ? "w-full table-fixed text-[10px]"
                : "w-full text-sm min-w-[600px]"
            }
          >
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[9px] uppercase tracking-wide">
                <th className={isFro ? "text-left font-semibold px-2 py-2" : "text-left font-semibold px-4 py-3.5"}>Product</th>
                <th className={isFro ? "text-right font-semibold px-1 py-2" : "text-right font-semibold px-4 py-3.5"}>Total Qty</th>
                <th className={isFro ? "text-right font-semibold px-1 py-2" : "text-right font-semibold px-4 py-3.5"}>Times</th>
                <th className={isFro ? "text-left font-semibold px-1 py-2" : "text-left font-semibold px-4 py-3.5"}>Last Date</th>
                <th className={isFro ? "text-right font-semibold px-1 py-2" : "text-right font-semibold px-4 py-3.5"}>Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.product} className="hover:bg-slate-50/50 transition-base">
                  <td className={isFro ? "px-2 py-2 font-semibold text-slate-700 break-words leading-tight" : "px-4 py-3 font-semibold text-slate-700"}>
                    {row.product}
                  </td>
                  <td className={isFro ? "px-1 py-2 text-right text-slate-600" : "px-4 py-3 text-right text-slate-600"}>
                    {row.quantity}
                  </td>
                  <td className={isFro ? "px-1 py-2 text-right text-slate-600" : "px-4 py-3 text-right text-slate-600"}>
                    {row.times}
                  </td>
                  <td className={isFro ? "px-1 py-2 text-slate-600 whitespace-nowrap" : "px-4 py-3 text-slate-600"}>
                    {row.lastDate ? formatDate(row.lastDate) : "—"}
                  </td>
                  <td className={isFro ? "px-1 py-2 text-right font-semibold text-slate-800" : "px-4 py-3 text-right font-semibold text-slate-800"}>
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
      <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
        <Icon name={icon} size={18} className="text-brand-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-slate-700 break-words">
          {value}
        </p>
      </div>
    </div>
  );
}

function DocumentsTab() {
  const docs = [
    {
      name: "Land Document.pdf",
      type: "Land Records",
      date: "2023-01-15",
      icon: "description",
    },
    {
      name: "Aadhar Card.jpg",
      type: "Identity Proof",
      date: "2023-01-15",
      icon: "badge",
    },
    {
      name: "Bank Details.pdf",
      type: "Bank Account",
      date: "2023-02-20",
      icon: "account_balance",
    },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {docs.map((doc) => (
        <Card key={doc.name} className="p-5" hover>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Icon name={doc.icon} size={22} className="text-brand-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-700 truncate">
                {doc.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {doc.type} · {formatDate(doc.date)}
              </p>
            </div>
            <button className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-base">
              <Icon name="download" size={18} />
            </button>
          </div>
        </Card>
      ))}
      <Card className="p-5 border-2 border-dashed border-slate-200 hover:border-brand-400 transition-base cursor-pointer flex items-center justify-center min-h-[88px]">
        <div className="text-center">
          <Icon name="add_circle" size={28} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-500 mt-1">
            Upload Document
          </p>
        </div>
      </Card>
    </div>
  );
}
