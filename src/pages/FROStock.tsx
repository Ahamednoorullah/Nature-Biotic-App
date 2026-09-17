import { useEffect, useMemo, useState } from "react";
import { Card, Icon, Button } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

type AuthUser = {
  name?: string;
  storeId?: string;
};

// Keep this page independent of the optional auth hook so it also builds in
// deployments where that hook is not exposed through the @/hooks alias.
function usePageUser(): AuthUser | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;

    for (const key of ["user", "auth-user", "nature-biotic-user"]) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === "object") return parsed as AuthUser;
        }
      } catch {
        // Ignore malformed or unavailable local storage values.
      }
    }

    return null;
  }, []);
}

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
  dcNo: string;
  date: string;
  executive: string;
  customerName: string;
  address: string;
  contactNo: string;
  placeOfSupply: string;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  items: DeliveryItem[];
};

const STORAGE_PREFIX = "nature-biotic-store-delivery-challans-v2";

export default function FROStock() {
  const user = usePageUser();
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [selected, setSelected] = useState<DeliveryChallan | null>(null);
  const [showReceivedDetails, setShowReceivedDetails] = useState(false);

  const loadChallans = () => {
    try {
      // StoreDeliveryChallan saves all store delivery challans using this key.
      const storeId = user?.storeId || "default";
      const saved = localStorage.getItem(`${STORAGE_PREFIX}:${storeId}`);
      setChallans(saved ? JSON.parse(saved) : []);
    } catch {
      setChallans([]);
    }
  };

  useEffect(() => {
    loadChallans();

    const refresh = () => loadChallans();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-delivery-challan-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nature-biotic-delivery-challan-updated",
        refresh,
      );
    };
  }, [user?.storeId]);

  const froName = (user?.name || "").trim().toLowerCase();

  // A FRO sees only the delivery challans issued to that FRO.
  const myChallans = useMemo(
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

  const receivedItems = useMemo(
    () =>
      myChallans.flatMap((challan) =>
        challan.items.map((item, index) => ({
          id: `${challan.id}-${index}`,
          dcNo: challan.dcNo,
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

  const totalQty = receivedItems.reduce((sum, item) => sum + item.qty, 0);
  const totalValue = receivedItems.reduce((sum, item) => sum + item.value, 0);

  const stockCards = [
    {
      label: "Total Stock",
      value: totalQty.toLocaleString("en-IN"),
      icon: "inventory_2",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Stock Received",
      value: totalQty.toLocaleString("en-IN"),
      icon: "outbox",
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Stock Returned",
      value: "0",
      icon: "undo",
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Hand Stock",
      value: totalQty.toLocaleString("en-IN"),
      icon: "inventory",
      tone: "bg-purple-50 text-purple-700",
    },
  ];

  return (
    <div className="mx-auto max-w-md px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
      <div className="grid grid-cols-2 gap-3">
        {stockCards.map((card) => (
          <Card
            key={card.label}
            onClick={
              card.label === "Stock Received"
                ? () => setShowReceivedDetails(true)
                : undefined
            }
            className={`flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] ${
              card.label === "Stock Received"
                ? "cursor-pointer transition active:scale-[0.98] hover:bg-blue-50/30"
                : ""
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}
              >
                <Icon name={card.icon} size={24} fill={false} />
              </span>
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                {card.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {card.label === "Stock Received"
                  ? "Qty received"
                  : "Current quantity"}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {card.value}
              </p>
              {card.label === "Stock Received" && (
                <p className="mt-1 text-[10px] font-medium text-blue-500">
                  Tap to view details
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div>
            <h2 className="font-semibold text-slate-800">Stock Received</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Stock issued to you through Store Delivery Challans
            </p>
          </div>
          <span className="text-sm font-bold text-brand-700">
            {formatCurrency(totalValue)}
          </span>
        </div>

        {receivedItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No stock received yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {receivedItems.slice(0, 5).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() =>
                  setSelected(
                    myChallans.find((c) => c.dcNo === item.dcNo) || null,
                  )
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.product}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {item.packSize} • Qty {item.qty} • DC {item.dcNo}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatDate(item.date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(item.value)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    ₹{item.unitValue.toLocaleString("en-IN")} / unit
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {receivedItems.length > 5 && (
          <div className="border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-brand-700">
            Showing latest 5 received stock entries
          </div>
        )}
      </Card>

      {showReceivedDetails && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowReceivedDetails(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Stock Received
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">
                  Delivery Challan Details
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Stock issued to you by the Store
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
              {myChallans.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No stock has been received from the Store yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {myChallans.map((challan) => {
                    const challanQty = challan.items.reduce(
                      (sum, item) => sum + Number(item.qty || 0),
                      0,
                    );
                    const challanValue = challan.items.reduce(
                      (sum, item) =>
                        sum +
                        Number(item.qty || 0) * Number(item.unitValue || 0),
                      0,
                    );

                    return (
                      <div
                        key={challan.id}
                        className="overflow-hidden rounded-xl border border-slate-200"
                      >
                        <div className="bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                DC {challan.dcNo}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Date: {formatDate(challan.date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-400">
                                Total Value
                              </p>
                              <p className="text-sm font-bold text-brand-700">
                                {formatCurrency(challanValue)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-slate-400">Executive</p>
                              <p className="font-semibold text-slate-700">
                                {challan.executive}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Qty</p>
                              <p className="font-semibold text-slate-700">
                                {challanQty}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Farmer</p>
                              <p className="font-semibold text-slate-700">
                                {challan.customerName || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Place</p>
                              <p className="font-semibold text-slate-700">
                                {challan.placeOfSupply || "-"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {challan.items.map((item, index) => {
                            const qty = Number(item.qty || 0);
                            const unitValue = Number(item.unitValue || 0);
                            const value = qty * unitValue;

                            return (
                              <div
                                key={`${challan.id}-${index}`}
                                className="p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">
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

                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
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
                                    <p className="text-slate-400">Batch No</p>
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
                    );
                  })}
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
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Stock Received
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-slate-800">
                  DC {selected.dcNo}
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
                <div>
                  <p className="text-xs text-slate-400">Farmer</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {selected.customerName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Place</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {selected.placeOfSupply || "-"}
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
