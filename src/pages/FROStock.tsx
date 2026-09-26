import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Icon, Button } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  addFROStock,
  getStoreAvailableQty,
  getFROStockByExecutive,
  persistDeliveryChallanAccepted,
} from "@/lib/data";
import { useAuth } from "@/context/AuthContext";

type DeliveryItem = {
  productId: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  qty: string;
  unitValue: string;
};

type DeliveryChallan = {
  id: string;
  sdNo: string;
  storeId?: string;
  date: string;
  executive: string;
  customerName?: string;
  address?: string;
  contactNo?: string;
  placeOfSupply?: string;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  status?: "pending" | "accepted";
  acceptedAt?: string;
  acceptedBy?: string;
  items: DeliveryItem[];
};

type ReturnRequestItem = {
  productId: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  unitValue: number;
};

type ReturnRequest = {
  id: string;
  rcNo: string;
  date: string;
  storeId: string;
  froName: string;
  reason: string;
  status: "pending" | "accepted";
  createdAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  items: ReturnRequestItem[];
};

const STORAGE_PREFIX = "nature-biotic-store-delivery-challans-v2";
const FRO_PENDING_PREFIX = "nature-biotic-fro-pending-deliveries-v1";
const FRO_RETURN_PREFIX = "nature-biotic-fro-stock-return-requests-v1";

export default function FROStock() {
  const { user } = useAuth();
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [selected, setSelected] = useState<DeliveryChallan | null>(null);
  const [activeStockView, setActiveStockView] = useState<
    | null
    | "total"
    | "received"
    | "returned"
    | "hand"
    | "pending"
    | "received-detail"
    | "total-detail"
    | "return-detail"
    | "return-form"
  >(null);
  const [showReceivedDetails, setShowReceivedDetails] = useState(false);
  const [showHandStockDetails, setShowHandStockDetails] = useState(false);
  const [showTotalStockDetails, setShowTotalStockDetails] = useState(false);
  const [selectedTotalProduct, setSelectedTotalProduct] = useState<
    string | null
  >(null);
  const [totalStockFilter, setTotalStockFilter] = useState<
    "today" | "monthly" | "custom"
  >("today");
  const [totalStockCustomDate, setTotalStockCustomDate] = useState("");
  const [receivedFilter, setReceivedFilter] = useState<
    "today" | "monthly" | "custom"
  >("today");
  const [receivesdustomDate, setReceivesdustomDate] = useState("");
  const [returnedFilter, setReturnedFilter] = useState<
    "today" | "monthly" | "custom"
  >("today");
  const [returnesdustomDate, setReturnesdustomDate] = useState("");
  const [showPendingDetails, setShowPendingDetails] = useState(false);
  const [showReturnedDetails, setShowReturnedDetails] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(
    null,
  );
  const [returnProductId, setReturnProductId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [stockVersion, setStockVersion] = useState(0);

  const loasdhallans = () => {
    try {
      const storeId = user?.storeId || "default";
      const scopedSaved = localStorage.getItem(`${STORAGE_PREFIX}:${storeId}`);
      const scoped: DeliveryChallan[] = scopedSaved
        ? JSON.parse(scopedSaved)
        : [];

      const froKey = String(user?.name || "")
        .trim()
        .toLowerCase();
      const inboxSaved = froKey
        ? localStorage.getItem(`${FRO_PENDING_PREFIX}:${froKey}`)
        : null;
      const inbox: DeliveryChallan[] = inboxSaved ? JSON.parse(inboxSaved) : [];

      // Also scan all Delivery Challan store keys. This makes the FRO receive
      // a delivery even if Store/FRO sessions resolve a different store key.
      const allStoreDeliveries: DeliveryChallan[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(`${STORAGE_PREFIX}:`)) continue;
        try {
          const rows = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(rows)) allStoreDeliveries.push(...rows);
        } catch {}
      }

      // The FRO inbox is the primary source for deliveries addressed to this
      // FRO. Store copies are also included so accepted status stays synced.
      const byId = new Map<string, DeliveryChallan>();
      for (const item of [...inbox, ...scoped, ...allStoreDeliveries]) {
        const key = String(item.id);
        const previous = byId.get(key);
        if (
          !previous ||
          item.status === "accepted" ||
          previous.status !== "accepted"
        ) {
          byId.set(key, item);
        }
      }
      setChallans(Array.from(byId.values()));
    } catch {
      setChallans([]);
    }

    try {
      const returnKey = `${FRO_RETURN_PREFIX}:${String(user?.name || "")
        .trim()
        .toLowerCase()}`;
      const savedReturns = returnKey.endsWith(":")
        ? []
        : JSON.parse(localStorage.getItem(returnKey) || "[]");
      setReturnRequests(Array.isArray(savedReturns) ? savedReturns : []);
    } catch {
      setReturnRequests([]);
    }
  };

  useEffect(() => {
    loasdhallans();

    const refresh = () => {
      loasdhallans();
      setStockVersion((version) => version + 1);
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-delivery-challan-updated", refresh);
    window.addEventListener("fro-stock-updated", refresh);
    window.addEventListener("nature-biotic-fro-stock-return-updated", refresh);

    // Keep the FRO screen in sync when Store creates a delivery challan
    // in the same browser/app session.
    const interval = window.setInterval(refresh, 1500);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nature-biotic-delivery-challan-updated",
        refresh,
      );
      window.removeEventListener("fro-stock-updated", refresh);
      window.removeEventListener(
        "nature-biotic-fro-stock-return-updated",
        refresh,
      );
      window.clearInterval(interval);
    };
  }, [user?.storeId, user?.name]);

  const froName = (user?.name || "").trim().toLowerCase();

  // A FRO sees only challans issued to that FRO.
  const myAllChallans = useMemo(
    () =>
      challans
        .filter(
          (challan) =>
            String(challan.executive || "")
              .trim()
              .toLowerCase() === froName,
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [challans, froName],
  );

  const pendingChallans = useMemo(
    () => myAllChallans.filter((challan) => challan.status !== "accepted"),
    [myAllChallans],
  );

  const myChallans = useMemo(
    () => myAllChallans.filter((challan) => challan.status === "accepted"),
    [myAllChallans],
  );

  function acceptChallan(challan: DeliveryChallan) {
    if (challan.status === "accepted") return;

    const storeId = challan.storeId || user?.storeId || "default";

    const invalidItem = challan.items.find((item) => {
      const qty = Number(item.qty || 0);
      if (qty <= 0) return false;
      const available = getStoreAvailableQty(
        storeId,
        item.productId,
        item.packSize,
        item.batchNo,
        item.product,
      );
      return qty > available;
    });

    if (invalidItem) {
      window.alert(
        `Store does not have enough stock to accept this delivery. Available: ${getStoreAvailableQty(
          storeId,
          invalidItem.productId,
          invalidItem.packSize,
          invalidItem.batchNo,
          invalidItem.product,
        )}`,
      );
      return;
    }

    addFROStock(
      storeId,
      challan.executive,
      challan.items.map((item) => ({
        productId: item.productId,
        productName: item.product,
        packSize: item.packSize,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        unitValue: Number(item.unitValue || 0),
        qty: Number(item.qty || 0),
      })),
      challan.date,
      challan.id,
    );

    const acceptedAt = new Date().toISOString();
    const acceptedBy = user?.name || challan.executive;
    const accepted: DeliveryChallan = {
      ...challan,
      storeId,
      status: "accepted",
      acceptedAt,
      acceptedBy,
    };

    const updated = challans.map((item) =>
      item.id === challan.id ? accepted : item,
    );
    setChallans(updated);
    persistDeliveryChallanAccepted(accepted);

    setShowPendingDetails(false);
    setSelected(accepted);
  }

  const acceptedReturns = useMemo(
    () => returnRequests.filter((item) => item.status === "accepted"),
    [returnRequests],
  );

  const pendingReturns = useMemo(
    () => returnRequests.filter((item) => item.status === "pending"),
    [returnRequests],
  );

  const returnedQty = acceptedReturns.reduce(
    (sum, request) =>
      sum +
      request.items.reduce(
        (itemSum, item) => itemSum + Number(item.qty || 0),
        0,
      ),
    0,
  );

  function resetReturnForm() {
    setReturnProductId("");
    setReturnQty("");
    setReturnReason("");
  }

  const nextStockReturnNo = useMemo(() => {
    const maxNo = returnRequests.reduce((max, request) => {
      const match = String(request.rcNo || "").match(/^SR-(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    return `SR-${String(maxNo + 1).padStart(4, "0")}`;
  }, [returnRequests]);

  function createReturnRequest() {
    const selectedStock = returnStockOptions.find(
      (item) =>
        `${item.product}|${item.packSize}|${item.batchNo}` === returnProductId,
    );
    const qty = Number(returnQty || 0);
    if (!selectedStock || qty <= 0 || qty > selectedStock.qty) return;

    const request: ReturnRequest = {
      id: `fro-return-${Date.now()}`,
      rcNo: nextStockReturnNo,
      date: new Date().toISOString().split("T")[0],
      storeId: user?.storeId || "default",
      froName: user?.name || "",
      reason: returnReason.trim() || "Stock return",
      status: "pending",
      createdAt: new Date().toISOString(),
      items: [
        {
          ...selectedStock,
          qty,
        },
      ],
    };

    const next = [request, ...returnRequests];
    setReturnRequests(next);
    try {
      const key = `${FRO_RETURN_PREFIX}:${String(user?.name || "")
        .trim()
        .toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("nature-biotic-fro-stock-return-updated"));
    } catch {}

    setShowReturnForm(false);
    setActiveStockView("returned");
    resetReturnForm();
  }

  const receivedItems = useMemo(
    () =>
      myChallans.flatMap((challan) =>
        challan.items.map((item, index) => ({
          id: `${challan.id}-${index}`,
          sdNo: challan.sdNo,
          date: challan.date,
          product: item.product,
          packSize: item.packSize,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          qty: Number(item.qty || 0),
          unitValue: Number(item.unitValue || 0),
          value: Number(item.qty || 0) * Number(item.unitValue || 0),
        })),
      ),
    [myChallans],
  );

  const returnStockOptions = useMemo(() => {
    const storeId = user?.storeId || "default";
    return getFROStockByExecutive(storeId, user?.name || "").map((item) => ({
      productId: String(item.productId || ""),
      product: String(item.productName || ""),
      packSize: String(item.packSize || ""),
      batchNo: String(item.batchNo || ""),
      expiryDate: String(item.expiryDate || ""),
      qty: Number(item.currentQty || 0),
      unitValue: Number(item.unitValue || 0),
    }));
  }, [user?.storeId, user?.name, stockVersion]);

  const acceptedReturnItems = useMemo(
    () =>
      acceptedReturns.flatMap((request) =>
        request.items.map((item) => ({
          product: item.product,
          packSize: item.packSize,
          batchNo: item.batchNo,
          date: request.date,
          qty: Number(item.qty || 0),
          value: Number(item.qty || 0) * Number(item.unitValue || 0),
        })),
      ),
    [acceptedReturns],
  );

  const handStockRows = useMemo(() => {
    const map = new Map<
      string,
      { product: string; packSize: string; qty: number; value: number }
    >();

    returnStockOptions.forEach((item) => {
      const key = `${item.product}|${item.packSize}`;
      const row = map.get(key) || {
        product: item.product,
        packSize: item.packSize,
        qty: 0,
        value: 0,
      };
      row.qty += Number(item.qty || 0);
      row.value += Number(item.qty || 0) * Number(item.unitValue || 0);
      map.set(key, row);
    });

    return Array.from(map.values())
      .filter((row) => row.qty > 0)
      .sort((a, b) =>
        `${a.product}${a.packSize}`.localeCompare(`${b.product}${b.packSize}`),
      );
  }, [returnStockOptions]);

  const handStockQty = handStockRows.reduce((sum, row) => sum + row.qty, 0);

  const toDateKey = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const todayKey = toDateKey(new Date());
  const monthKey = todayKey.slice(0, 7);

  const matchesDateFilter = (
    date: string,
    filter: "today" | "monthly" | "custom",
    customDate: string,
  ) => {
    const key = toDateKey(date);
    if (filter === "today") return key === todayKey;
    if (filter === "monthly") return key.startsWith(monthKey);
    return !!customDate && key === customDate;
  };

  const filteredReceivedItems = useMemo(
    () =>
      receivedItems.filter((item) =>
        matchesDateFilter(item.date, receivedFilter, receivesdustomDate),
      ),
    [receivedItems, receivedFilter, receivesdustomDate, todayKey, monthKey],
  );

  const filteredReturnedRequests = useMemo(
    () =>
      returnRequests.filter((request) =>
        matchesDateFilter(request.date, returnedFilter, returnesdustomDate),
      ),
    [returnRequests, returnedFilter, returnesdustomDate, todayKey, monthKey],
  );

  const totalStockProductRows = useMemo(() => {
    // Product list is limited to products currently present in Hand Stock,
    // but Total Stock quantity/value is the cumulative accepted quantity
    // received across all dates.
    const currentHandKeys = new Set(
      handStockRows.map((row) => `${row.product}|${row.packSize}`),
    );
    const map = new Map<
      string,
      { product: string; packSize: string; qty: number; value: number }
    >();

    receivedItems.forEach((item) => {
      const key = `${item.product}|${item.packSize}`;
      if (!currentHandKeys.has(key)) return;
      const row = map.get(key) || {
        product: item.product,
        packSize: item.packSize,
        qty: 0,
        value: 0,
      };
      row.qty += item.qty;
      row.value += item.value;
      map.set(key, row);
    });

    return Array.from(map.values()).sort((a, b) =>
      `${a.product}${a.packSize}`.localeCompare(`${b.product}${b.packSize}`),
    );
  }, [receivedItems, handStockRows]);

  const filteredTotalStockMovements = useMemo(
    () =>
      receivedItems.filter((item) =>
        matchesDateFilter(item.date, totalStockFilter, totalStockCustomDate),
      ),
    [receivedItems, totalStockFilter, totalStockCustomDate, todayKey, monthKey],
  );

  const selectedTotalProductRows = useMemo(() => {
    if (!selectedTotalProduct) return [];
    return filteredTotalStockMovements
      .filter(
        (item) => `${item.product}|${item.packSize}` === selectedTotalProduct,
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [filteredTotalStockMovements, selectedTotalProduct]);

  const stockCards = [
    {
      label: "Total Stock",
      value: "",
      icon: "inventory_2",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Stock Received",
      value: "",
      icon: "outbox",
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Stock Returned",
      value: "",
      icon: "undo",
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Hand Stock",
      value: handStockQty.toLocaleString("en-IN"),
      icon: "inventory",
      tone: "bg-purple-50 text-purple-700",
    },
  ];

  const closeStockView = () => {
    setActiveStockView(null);
    setSelected(null);
    setSelectedTotalProduct(null);
    setSelectedReturn(null);
    setShowReturnForm(false);
    resetReturnForm();
  };

  const stockViewHeader = (
    title: string,
    subtitle?: string,
    tone: string = "text-brand-600",
  ) => (
    <div className="mb-4 flex items-center gap-3">
      <button
        type="button"
        onClick={closeStockView}
        aria-label="Back"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95"
      >
        <Icon name="arrow_back" size={20} />
      </button>
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${tone}`}>
          FRO STOCK
        </p>
        <h1 className="truncate text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );

  if (activeStockView) {
    if (activeStockView === "received-detail" && selected) {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
          {stockViewHeader(`SD No : ${selected.sdNo}`, formatDate(selected.date), "text-blue-600")}
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div>
                <p className="text-slate-400">Date</p>
                <p className="mt-1 font-semibold text-slate-800">{formatDate(selected.date)}</p>
              </div>
              <div>
                <p className="text-slate-400">Status</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {selected.status === "accepted" ? "Accepted" : "Pending"}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[28px_1fr_48px_78px] items-center gap-2 bg-slate-50 px-2.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span>S.No</span>
                <span>Product-Size</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Value</span>
              </div>
              <div className="divide-y divide-slate-100">
                {selected.items.map((item, index) => {
                  const qty = Number(item.qty || 0);
                  const value = qty * Number(item.unitValue || 0);
                  return (
                    <div
                      key={`${selected.id}-${index}`}
                      className="grid grid-cols-[28px_1fr_48px_78px] items-center gap-2 px-2.5 py-3"
                    >
                      <span className="text-[11px] text-slate-400">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{item.product}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.packSize || "-"}</p>
                      </div>
                      <span className="text-right text-xs font-bold text-slate-800">{qty}</span>
                      <span className="text-right text-xs font-bold text-slate-800">{formatCurrency(value)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-3">
                <span className="text-xs font-semibold text-slate-600">Total</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(
                    selected.items.reduce(
                      (sum, item) => sum + Number(item.qty || 0) * Number(item.unitValue || 0),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeStockView === "total-detail" && selectedTotalProduct) {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
          {stockViewHeader(
            selectedTotalProduct.split("|")[0],
            selectedTotalProduct.split("|")[1] || "-",
            "text-emerald-600",
          )}
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[28px_1fr_52px_82px] items-center gap-2 bg-slate-50 px-2.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span>S.No</span>
                <span>Date</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Value</span>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedTotalProductRows.length === 0 ? (
                  <div className="px-3 py-10 text-center text-xs text-slate-500">
                    No stock movement for this filter.
                  </div>
                ) : (
                  selectedTotalProductRows.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="grid grid-cols-[28px_1fr_52px_82px] items-center gap-2 px-2.5 py-3"
                    >
                      <span className="text-[11px] text-slate-400">{index + 1}</span>
                      <span className="text-xs font-medium text-slate-700">{formatDate(item.date)}</span>
                      <span className="text-right text-xs font-bold text-slate-800">{item.qty}</span>
                      <span className="text-right text-xs font-bold text-slate-800">{formatCurrency(item.value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeStockView === "return-detail" && selectedReturn) {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
          {stockViewHeader(selectedReturn.rcNo, formatDate(selectedReturn.date), "text-amber-600")}
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">Date</p>
                  <p className="mt-1 font-semibold text-slate-800">{formatDate(selectedReturn.date)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Status</p>
                  <p className="mt-1 font-semibold capitalize text-slate-800">{selectedReturn.status}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400">Reason</p>
                  <p className="mt-1 font-semibold text-slate-800">{selectedReturn.reason}</p>
                </div>
              </div>
            </div>
            {selectedReturn.items.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.product}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.packSize || "-"}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-800">
                    {formatCurrency(Number(item.qty || 0) * Number(item.unitValue || 0))}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-slate-400">Qty</p><p className="mt-0.5 font-semibold">{item.qty}</p></div>
                  <div><p className="text-slate-400">Batch</p><p className="mt-0.5 font-semibold truncate">{item.batchNo || "-"}</p></div>
                  <div><p className="text-slate-400">Expiry</p><p className="mt-0.5 font-semibold">{item.expiryDate ? formatDate(item.expiryDate) : "-"}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeStockView === "return-form") {
      const selectedReturnStock = returnStockOptions.find(
        (item) =>
          `${item.product}|${item.packSize}|${item.batchNo}` === returnProductId,
      );
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
          {stockViewHeader("Return Stock", "Send stock return request to the Store", "text-amber-600")}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Stock Return No</label>
              <input
                value={nextStockReturnNo}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Product / Size / Batch</label>
              <select
                value={returnProductId}
                onChange={(e) => setReturnProductId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">Select stock</option>
                {returnStockOptions.map((item) => {
                  const value = `${item.product}|${item.packSize}|${item.batchNo}`;
                  return (
                    <option key={value} value={value}>
                      {item.product} • {item.packSize} • {item.batchNo || "-"} • Available {item.qty}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Return Quantity</label>
              <input
                type="number"
                min="1"
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                placeholder="Enter quantity"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Reason</label>
              <input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                placeholder="e.g. Unsold stock"
              />
            </div>
            <div className="flex gap-3 border-t border-slate-200 pt-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  resetReturnForm();
                  setActiveStockView("returned");
                }}
              >
                Close
              </Button>
              <Button
                className="w-full"
                disabled={
                  !returnProductId ||
                  Number(returnQty || 0) <= 0 ||
                  Number(returnQty || 0) > (selectedReturnStock?.qty || 0)
                }
                onClick={() => {
                  createReturnRequest();
                  setActiveStockView("returned");
                }}
              >
                Send Return
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (activeStockView === "pending") {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4">
          {stockViewHeader("Pending Stock Received", "Stock waiting for your acceptance", "text-orange-600")}
          <div className="space-y-3">
            {pendingChallans.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-500">
                No pending stock deliveries.
              </Card>
            ) : (
              pendingChallans.map((challan) => {
                const qty = challan.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
                const value = challan.items.reduce(
                  (sum, item) => sum + Number(item.qty || 0) * Number(item.unitValue || 0),
                  0,
                );
                return (
                  <Card key={challan.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">SD No : {challan.sdNo}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(challan.date)} • Qty {qty}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(value)}</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {challan.items.map((item, index) => (
                        <div key={`${challan.id}-${index}`} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">{item.product}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.packSize || "-"} • Qty {item.qty || 0} • Batch {item.batchNo || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Button className="mt-4 w-full" onClick={() => acceptChallan(challan)}>
                      Accept Stock
                    </Button>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      );
    }

    if (activeStockView === "hand") {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4">
          {stockViewHeader("Hand Stock", "Current stock in your hand", "text-purple-600")}
          <Card className="overflow-hidden p-0">
            {handStockRows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">No hand stock available.</div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_54px_82px] items-center gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <span>Product-Size</span><span className="text-right">Qty</span><span className="text-right">Value</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {handStockRows.map((row) => (
                    <div key={`${row.product}|${row.packSize}`} className="grid grid-cols-[1fr_54px_82px] items-center gap-2 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{row.product}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.packSize || "-"}</p>
                      </div>
                      <span className="text-right text-xs font-bold text-slate-800">{row.qty}</span>
                      <span className="text-right text-xs font-bold text-slate-800">{formatCurrency(row.value)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-3">
                  <span className="text-xs font-semibold text-slate-600">Total</span>
                  <span className="text-sm font-bold text-slate-900">{handStockQty}</span>
                </div>
              </>
            )}
          </Card>
        </div>
      );
    }

    if (activeStockView === "returned") {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={closeStockView}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95"
              >
                <Icon name="arrow_back" size={20} />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  FRO STOCK
                </p>
                <h1 className="truncate text-xl font-bold text-slate-800">Stock Returned</h1>
                <p className="mt-0.5 text-xs text-slate-500">Return history</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Return Stock"
              onClick={() => {
                resetReturnForm();
                setActiveStockView("return-form");
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm active:scale-95"
            >
              <Icon name="add" size={19} />
            </button>
          </div>
          <div className="mb-3 flex items-center justify-end gap-1">
            {(["today", "monthly", "custom"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setReturnedFilter(filter)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${
                  returnedFilter === filter ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {filter === "today" ? "Today" : filter === "monthly" ? "Monthly" : "Custom"}
              </button>
            ))}
            {returnedFilter === "custom" && (
              <input
                type="date"
                value={returnesdustomDate}
                onChange={(e) => setReturnesdustomDate(e.target.value)}
                className="w-[112px] rounded-md border border-slate-200 px-1.5 py-1.5 text-[10px]"
              />
            )}
          </div>
          <Card className="overflow-hidden p-0">
            {filteredReturnedRequests.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">No stock return details yet.</div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <span>Date</span><span>SR No</span><span className="text-right">Value</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredReturnedRequests
                    .slice()
                    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                    .map((request) => {
                      const value = request.items.reduce(
                        (sum, item) => sum + Number(item.qty || 0) * Number(item.unitValue || 0),
                        0,
                      );
                      return (
                        <button
                          type="button"
                          key={request.id}
                          onClick={() => {
                            setSelectedReturn(request);
                            setActiveStockView("return-detail");
                          }}
                          className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-3 text-left active:bg-slate-50"
                        >
                          <span className="text-xs font-medium text-slate-700">{formatDate(request.date)}</span>
                          <span className="truncate text-xs font-semibold text-slate-800">{request.rcNo}</span>
                          <span className="text-right text-xs font-bold text-slate-800">{formatCurrency(value)}</span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </Card>
        </div>
      );
    }

    if (activeStockView === "total") {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4">
          {stockViewHeader("Total Stock", "Product wise stock", "text-emerald-600")}
          <div className="mb-3 flex w-full overflow-hidden rounded-lg bg-slate-100 p-1">
            {[
              ["today", "Today"],
              ["monthly", "Monthly"],
              ["custom", "Custom"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTotalStockFilter(value as "today" | "monthly" | "custom")}
                className={`flex-1 rounded-md px-2 py-2 text-[11px] font-semibold ${
                  totalStockFilter === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {totalStockFilter === "custom" && (
            <input
              type="date"
              value={totalStockCustomDate}
              onChange={(e) => setTotalStockCustomDate(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
            />
          )}
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-[28px_1fr_52px_82px] items-center gap-2 bg-slate-50 px-2.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>S.No</span><span>Product-Size</span><span className="text-right">Qty</span><span className="text-right">Value</span>
            </div>
            <div className="divide-y divide-slate-100">
              {totalStockProductRows.length === 0 ? (
                <div className="px-3 py-10 text-center text-xs text-slate-500">No total stock available.</div>
              ) : (
                totalStockProductRows.map((row, index) => (
                  <button
                    type="button"
                    key={`${row.product}|${row.packSize}`}
                    onClick={() => {
                      setSelectedTotalProduct(`${row.product}|${row.packSize}`);
                      setActiveStockView("total-detail");
                    }}
                    className="grid w-full grid-cols-[28px_1fr_52px_82px] items-center gap-2 px-2.5 py-3 text-left active:bg-slate-50"
                  >
                    <span className="text-[11px] text-slate-400">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800">{row.product}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">{row.packSize || "-"}</span>
                    </span>
                    <span className="text-right text-xs font-bold text-slate-800">{row.qty}</span>
                    <span className="text-right text-xs font-bold text-slate-800">{formatCurrency(row.value)}</span>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      );
    }

    if (activeStockView === "received") {
      return (
        <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4">
          {stockViewHeader("Stock Received", "Delivery challan details", "text-blue-600")}
          <div className="mb-3 flex items-center justify-end gap-1">
            {(["today", "monthly", "custom"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setReceivedFilter(filter)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${
                  receivedFilter === filter ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {filter === "today" ? "Today" : filter === "monthly" ? "Monthly" : "Custom"}
              </button>
            ))}
            {receivedFilter === "custom" && (
              <input
                type="date"
                value={receivesdustomDate}
                onChange={(e) => setReceivesdustomDate(e.target.value)}
                className="w-[112px] rounded-md border border-slate-200 px-1.5 py-1.5 text-[10px]"
              />
            )}
          </div>
          <Card className="overflow-hidden p-0">
            {filteredReceivedItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">No stock received for this filter.</div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <span>Date</span><span>SD No</span><span className="text-right">Value</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.from(new Map(filteredReceivedItems.map((item) => [item.sdNo, item])).keys()).map((sdNo) => {
                    const challan = myChallans.find((c) => c.sdNo === sdNo);
                    if (!challan) return null;
                    const challanValue = challan.items.reduce(
                      (sum, item) => sum + Number(item.qty || 0) * Number(item.unitValue || 0),
                      0,
                    );
                    return (
                      <button
                        type="button"
                        key={challan.id}
                        onClick={() => {
                          setSelected(challan);
                          setActiveStockView("received-detail");
                        }}
                        className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-3 text-left active:bg-slate-50"
                      >
                        <span className="text-xs font-medium text-slate-700">{formatDate(challan.date)}</span>
                        <span className="truncate text-xs font-semibold text-slate-800">{challan.sdNo}</span>
                        <span className="text-right text-xs font-bold text-slate-800">{formatCurrency(challanValue)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stockCards.map((card) => (
          <Card
            key={card.label}
            onClick={
              card.label === "Total Stock"
                ? () => setActiveStockView("total")
                : card.label === "Stock Received"
                  ? () => setActiveStockView("received")
                  : card.label === "Stock Returned"
                    ? () => setActiveStockView("returned")
                    : card.label === "Hand Stock"
                      ? () => setActiveStockView("hand")
                      : undefined
            }
            className={`flex h-[128px] min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] ${
              "cursor-pointer transition active:scale-[0.98] " +
              (card.label === "Stock Received"
                ? "hover:bg-blue-50/30"
                : card.label === "Stock Returned"
                  ? "hover:bg-amber-50/30"
                  : card.label === "Hand Stock"
                    ? "hover:bg-purple-50/30"
                    : "hover:bg-emerald-50/30")
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}
              >
                <Icon name={card.icon} size={24} fill={false} />
              </span>
              {card.label === "Stock Received" &&
                pendingChallans.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveStockView("pending");
                    }}
                    className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600 ring-1 ring-orange-200 active:scale-95"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    {pendingChallans.length} Pending
                  </button>
                )}
              {card.label === "Stock Returned" && pendingReturns.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStockView("returned");
                  }}
                  className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600 ring-1 ring-orange-200 active:scale-95"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  {pendingReturns.length} Pending
                </button>
              )}
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                {card.label}
              </p>
              {card.label === "Hand Stock" && (
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {card.value}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800">
              Pending Stock Received
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Stock waiting for your acceptance
            </p>
          </div>
          {pendingChallans.length > 0 && (
            <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-600 ring-1 ring-orange-200">
              {pendingChallans.length} Pending
            </span>
          )}
        </div>

        {pendingChallans.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No pending stock received.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingChallans.slice(0, 5).map((challan) => {
              const qty = challan.items.reduce(
                (sum, item) => sum + Number(item.qty || 0),
                0,
              );
              const value = challan.items.reduce(
                (sum, item) =>
                  sum + Number(item.qty || 0) * Number(item.unitValue || 0),
                0,
              );
              return (
                <button
                  type="button"
                  key={challan.id}
                  onClick={() => setShowPendingDetails(true)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-orange-50/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      SD No : {challan.sdNo}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {formatDate(challan.date)} • Qty {qty}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {formatCurrency(value)}
                    </p>
                    <p className="text-[10px] font-semibold text-orange-600">
                      Pending • Tap to accept
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {showPendingDetails && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowPendingDetails(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                  Pending Delivery
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">
                  Stock Acceptance
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Accept stock sent to you by the Store
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingDetails(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {pendingChallans.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No pending stock deliveries.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingChallans.map((challan) => {
                    const qty = challan.items.reduce(
                      (sum, item) => sum + Number(item.qty || 0),
                      0,
                    );
                    const value = challan.items.reduce(
                      (sum, item) =>
                        sum +
                        Number(item.qty || 0) * Number(item.unitValue || 0),
                      0,
                    );
                    return (
                      <div
                        key={challan.id}
                        className="rounded-xl border border-orange-200 bg-orange-50/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800">
                              SD No : {challan.sdNo}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(challan.date)} • {qty} Qty
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-slate-800">
                            {formatCurrency(value)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {challan.items.map((item, index) => (
                            <div
                              key={`${challan.id}-${index}`}
                              className="rounded-lg bg-white p-3"
                            >
                              <p className="text-sm font-semibold text-slate-800">
                                {item.product}
                              </p>
                              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500">
                                <span>Size: {item.packSize || "-"}</span>
                                <span>Qty: {item.qty || 0}</span>
                                <span>Batch: {item.batchNo || "-"}</span>
                                <span>
                                  Expiry:{" "}
                                  {item.expiryDate
                                    ? formatDate(item.expiryDate)
                                    : "-"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          className="mt-4 w-full"
                          onClick={() => acceptChallan(challan)}
                        >
                          Accept Stock
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReturnedDetails &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowReturnedDetails(false);
            }}
          >
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Stock Returned
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">
                    Return History
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Return stock to the Store
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReturnedDetails(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <Button
                  className="mb-4 w-full"
                  onClick={() => {
                    resetReturnForm();
                    setShowReturnForm(true);
                  }}
                >
                  <Icon name="add" size={18} />
                  Return Stock
                </Button>

                <div className="mb-3 flex items-center justify-end gap-1">
                  {(["today", "monthly", "custom"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReturnedFilter(filter)}
                      className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${returnedFilter === filter ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {filter === "today"
                        ? "Today"
                        : filter === "monthly"
                          ? "Monthly"
                          : "Custom"}
                    </button>
                  ))}
                  {returnedFilter === "custom" && (
                    <input
                      type="date"
                      value={returnesdustomDate}
                      onChange={(e) => setReturnesdustomDate(e.target.value)}
                      className="w-[112px] rounded-md border border-slate-200 px-1.5 py-1.5 text-[10px]"
                    />
                  )}
                </div>

                {filteredReturnedRequests.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    No stock return details yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-[1fr_1.1fr_auto] items-center gap-3 bg-slate-50 px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-4">
                      <span>Date</span>
                      <span>SR No</span>
                      <span className="text-right">Value</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {filteredReturnedRequests
                        .slice()
                        .sort((a, b) =>
                          String(b.date).localeCompare(String(a.date)),
                        )
                        .map((request) => {
                          const value = request.items.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.qty || 0) *
                                Number(item.unitValue || 0),
                            0,
                          );

                          return (
                            <button
                              type="button"
                              key={request.id}
                              onClick={() => setSelectedReturn(request)}
                              className="grid w-full grid-cols-[1fr_1.1fr_auto] items-center gap-3 px-3 py-3 text-left transition active:bg-slate-50 hover:bg-slate-50 sm:px-4"
                            >
                              <span className="text-xs font-medium text-slate-700">
                                {formatDate(request.date)}
                              </span>
                              <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                                {request.rcNo}
                              </span>
                              <span className="text-right text-xs font-bold text-slate-800">
                                {formatCurrency(value)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showReturnForm &&
        createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Return Stock
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">
                    Create Return Request
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnForm(false);
                    resetReturnForm();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Stock Return No
                  </label>
                  <input
                    value={nextStockReturnNo}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Auto generated
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Product / Size / Batch
                  </label>
                  <select
                    value={returnProductId}
                    onChange={(e) => setReturnProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-500"
                  >
                    <option value="">Select stock</option>
                    {returnStockOptions.map((item) => {
                      const value = `${item.product}|${item.packSize}|${item.batchNo}`;
                      return (
                        <option key={value} value={value}>
                          {item.product} • {item.packSize} •{" "}
                          {item.batchNo || "-"} • Available {item.qty}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Return Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    placeholder="Enter quantity"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Reason
                  </label>
                  <input
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    placeholder="e.g. Unsold stock"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setShowReturnForm(false);
                    resetReturnForm();
                  }}
                >
                  Close
                </Button>
                <Button
                  className="w-full"
                  disabled={
                    !returnProductId ||
                    Number(returnQty || 0) <= 0 ||
                    Number(returnQty || 0) >
                      (returnStockOptions.find(
                        (item) =>
                          `${item.product}|${item.packSize}|${item.batchNo}` ===
                          returnProductId,
                      )?.qty || 0)
                  }
                  onClick={createReturnRequest}
                >
                  Send Return
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedReturn &&
        createPortal(
          <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-900/45 p-3">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Return Details
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">
                    {selectedReturn.rcNo}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-slate-400">Date</p>
                    <p className="mt-1 font-semibold">
                      {formatDate(selectedReturn.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Status</p>
                    <p className="mt-1 font-semibold">
                      {selectedReturn.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Reason</p>
                    <p className="mt-1 font-semibold">
                      {selectedReturn.reason}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Store</p>
                    <p className="mt-1 font-semibold">
                      {selectedReturn.storeId}
                    </p>
                  </div>
                </div>
                {selectedReturn.items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <p className="font-semibold text-slate-800">
                      {item.product}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <span>Size: {item.packSize || "-"}</span>
                      <span>Qty: {item.qty}</span>
                      <span>Batch: {item.batchNo || "-"}</span>
                      <span>
                        Expiry:{" "}
                        {item.expiryDate ? formatDate(item.expiryDate) : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showHandStockDetails && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowHandStockDetails(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                  Hand Stock
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">
                  Current Stock
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHandStockDetails(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {handStockRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No hand stock available.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1fr_54px_88px] items-center gap-2 bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-[1fr_64px_100px] sm:px-4">
                    <span>Product</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Value</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {handStockRows.map((row) => (
                      <div
                        key={`${row.product}|${row.packSize}`}
                        className="grid grid-cols-[1fr_54px_88px] items-center gap-2 px-3 py-3 sm:grid-cols-[1fr_64px_100px] sm:px-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {row.product}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {row.packSize || "-"}
                          </p>
                        </div>
                        <span className="text-right text-xs font-bold text-slate-800">
                          {row.qty}
                        </span>
                        <span className="text-right text-xs font-bold text-slate-800">
                          {formatCurrency(row.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setShowHandStockDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTotalStockDetails && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowTotalStockDetails(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Total Stock
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">
                  Product Wise Stock
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Products currently in FRO hand stock
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTotalStockDetails(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mb-3 flex w-full overflow-hidden rounded-lg bg-slate-100 p-1">
                {[
                  ["today", "Today"],
                  ["monthly", "Monthly"],
                  ["custom", "Custom"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setTotalStockFilter(
                        value as "today" | "monthly" | "custom",
                      )
                    }
                    className={`flex-1 rounded-md px-2 py-2 text-[11px] font-semibold ${totalStockFilter === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {totalStockFilter === "custom" && (
                <input
                  type="date"
                  value={totalStockCustomDate}
                  onChange={(e) => setTotalStockCustomDate(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500"
                />
              )}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[28px_1fr_52px_82px] items-center gap-2 bg-slate-50 px-2.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-[34px_1fr_60px_92px] sm:px-3">
                  <span>S.No</span>
                  <span>Product-Size</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Value</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {totalStockProductRows.length === 0 ? (
                    <div className="px-3 py-10 text-center text-xs text-slate-500">
                      No total stock available.
                    </div>
                  ) : (
                    totalStockProductRows.map((row, index) => (
                      <button
                        type="button"
                        key={`${row.product}|${row.packSize}`}
                        onClick={() =>
                          setSelectedTotalProduct(
                            `${row.product}|${row.packSize}`,
                          )
                        }
                        className="grid w-full grid-cols-[28px_1fr_52px_82px] items-center gap-2 px-2.5 py-3 text-left hover:bg-slate-50 active:bg-slate-100 sm:grid-cols-[34px_1fr_60px_92px] sm:px-3"
                      >
                        <span className="text-[11px] text-slate-400">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-800">
                            {row.product}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {row.packSize || "-"}
                          </span>
                        </span>
                        <span className="text-right text-xs font-bold text-slate-800">
                          {row.qty}
                        </span>
                        <span className="text-right text-xs font-bold text-slate-800">
                          {formatCurrency(row.value)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setShowTotalStockDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedTotalProduct && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedTotalProduct(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Stock Details
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-slate-800">
                  {selectedTotalProduct.split("|")[0]}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedTotalProduct.split("|")[1] || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTotalProduct(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[28px_1fr_52px_82px] items-center gap-2 bg-slate-50 px-2.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-[34px_1fr_60px_92px] sm:px-3">
                  <span>S.No</span>
                  <span>Date</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Value</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedTotalProductRows.length === 0 ? (
                    <div className="px-3 py-10 text-center text-xs text-slate-500">
                      No stock movement for this filter.
                    </div>
                  ) : (
                    selectedTotalProductRows.map((item, index) => (
                      <div
                        key={`${item.id}-${index}`}
                        className="grid grid-cols-[28px_1fr_52px_82px] items-center gap-2 px-2.5 py-3 sm:grid-cols-[34px_1fr_60px_92px] sm:px-3"
                      >
                        <span className="text-[11px] text-slate-400">
                          {index + 1}
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          {formatDate(item.date)}
                        </span>
                        <span className="text-right text-xs font-bold text-slate-800">
                          {item.qty}
                        </span>
                        <span className="text-right text-xs font-bold text-slate-800">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setSelectedTotalProduct(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceivedDetails && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowReceivedDetails(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Stock Received
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">
                  Delivery Challan Details
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Stock delivered to you by the Store
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceivedDetails(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-end gap-1">
                {(["today", "monthly", "custom"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setReceivedFilter(filter)}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${receivedFilter === filter ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {filter === "today"
                      ? "Today"
                      : filter === "monthly"
                        ? "Monthly"
                        : "Custom"}
                  </button>
                ))}
                {receivedFilter === "custom" && (
                  <input
                    type="date"
                    value={receivesdustomDate}
                    onChange={(e) => setReceivesdustomDate(e.target.value)}
                    className="w-[112px] rounded-md border border-slate-200 px-1.5 py-1.5 text-[10px]"
                  />
                )}
              </div>

              {filteredReceivedItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No stock received for this filter.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1fr_1.1fr_auto] items-center gap-3 bg-slate-50 px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-4">
                    <span>Date</span>
                    <span>SR No</span>
                    <span className="text-right">Value</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {Array.from(
                      new Map(
                        filteredReceivedItems.map((item) => [item.sdNo, item]),
                      ).keys(),
                    ).map((sdNo) => {
                      const challan = myChallans.find((c) => c.sdNo === sdNo);
                      if (!challan) return null;
                      const challanValue = challan.items.reduce(
                        (sum, item) =>
                          sum +
                          Number(item.qty || 0) * Number(item.unitValue || 0),
                        0,
                      );

                      return (
                        <button
                          type="button"
                          key={challan.id}
                          onClick={() => setSelected(challan)}
                          className="grid w-full grid-cols-[1fr_1.1fr_auto] items-center gap-3 px-3 py-3 text-left transition active:bg-slate-50 sm:px-4"
                        >
                          <span className="text-xs font-medium text-slate-700">
                            {formatDate(challan.date)}
                          </span>
                          <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                            {challan.sdNo}
                          </span>
                          <span className="text-right text-xs font-bold text-slate-800">
                            {formatCurrency(challanValue)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:justify-end sm:px-5">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setShowReceivedDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Stock Received
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-slate-800">
                  SD No : {selected.sdNo}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {formatDate(selected.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Executive</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {selected.executive}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {selected.items.map((item, index) => {
                  const qty = Number(item.qty || 0);
                  const unitValue = Number(item.unitValue || 0);
                  const value = qty * unitValue;

                  return (
                    <div
                      key={`${selected.id}-${index}`}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            {item.product}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Pack Size: {item.packSize || "-"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-800">
                          {formatCurrency(value)}
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-slate-400">Quantity</p>
                          <p className="mt-0.5 font-semibold text-slate-700">
                            {qty}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Unit Value</p>
                          <p className="mt-0.5 font-semibold text-slate-700">
                            {formatCurrency(unitValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Batch</p>
                          <p className="mt-0.5 font-semibold text-slate-700">
                            {item.batchNo || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Expiry</p>
                          <p className="mt-0.5 font-semibold text-slate-700">
                            {item.expiryDate
                              ? formatDate(item.expiryDate)
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
