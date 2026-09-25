import { ReactNode, useEffect, useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select, EmptyState } from "@/components/ui";
import { createPortal } from "react-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import { products as allProducts, reduceFROStock } from "@/lib/data";

type ReturnItem = {
  product: string;
  productId: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  issuedQty: string;
  returnedQty: string;
  unitValue: string;
  taxPercent?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
};

type ReturnChallan = {
  productId: string;
  phone: string;
  village: string;
  farmer: ReactNode;
  id: string;
  rcNo: string;
  date: string;
  sdNo: string;
  executive: string;
  customerName: string;
  placeOfSupply: string;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  items: ReturnItem[];
};

type FROReturnRequestItem = {
  productId: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  unitValue: number;
};

type FROReturnRequest = {
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
  items: FROReturnRequestItem[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];
const STORAGE_PREFIX = "nature-biotic-store-return-challans-v2";
const FRO_RETURN_PREFIX = "nature-biotic-fro-stock-return-requests-v1";
const STORE_RETURN_RECEIVED_PREFIX =
  "nature-biotic-store-stock-return-received-v1";

function emptyItems(): ReturnItem[] {
  return [
    {
      productId: "",
      product: "",
      packSize: "",
      batchNo: "",
      expiryDate: "",
      issuedQty: "",
      returnedQty: "",
      unitValue: "",
    },
  ];
}

function loadRows(storageKey: string): ReturnChallan[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function StoreReturnChallan({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [rows, setRows] = useState<ReturnChallan[]>(() => {
    const saved = loadRows(storageKey);

    if (saved.length > 0) return saved;

    return [
      {
        id: "1",
        productId: "",
        rcNo: "RC-001",
        date: "2026-08-18",
        sdNo: "sd-1001",
        executive: "Ram Kumar",
        customerName: "Murugan",
        phone: "9876543210",
        village: "Rajapalayam",
        farmer: "Murugan",
        placeOfSupply: "Tamil Nadu",
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: 0,
        items: [
          {
            productId: "",
            product: "Electra",
            packSize: "250 ml",
            batchNo: "ELE010826",
            expiryDate: "2027-08-31",
            issuedQty: "10",
            returnedQty: "3",
            unitValue: "250",
          },
        ],
      },
    ];
  });

  const [showAdd, setShowAdd] = useState(false);
  const [selectesdhallan, setSelectesdhallan] = useState<ReturnChallan | null>(
    null,
  );
  const [froReturns, setFroReturns] = useState<FROReturnRequest[]>([]);
  const [selectedFroReturn, setSelectedFroReturn] =
    useState<FROReturnRequest | null>(null);

  const [rcNo, setRcNo] = useState("");
  const [date, setDate] = useState("");
  const [sdNo, setsdNo] = useState("");
  const [executive, setExecutive] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [village, setVillage] = useState("");
  const [phone, setPhone] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [cgstPercent, setCgstPercent] = useState(0); // ✅ ADD
  const [sgstPercent, setSgstPercent] = useState(0); // ✅ ADD
  const [igstPercent, setIgstPercent] = useState(0); // ✅ ADD
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState("");
  const [items, setItems] = useState<ReturnItem[]>(emptyItems());

  const loadFROReturns = () => {
    try {
      const found: FROReturnRequest[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(`${FRO_RETURN_PREFIX}:`)) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(parsed)) {
            found.push(
              ...parsed.filter(
                (item: FROReturnRequest) => item?.storeId === storeId,
              ),
            );
          }
        } catch {}
      }

      const unique = Array.from(
        new Map(found.map((item) => [item.id, item])).values(),
      ).sort((a, b) => String(b.date).localeCompare(String(a.date)));

      setFroReturns(unique);
    } catch {
      setFroReturns([]);
    }
  };

  useEffect(() => {
    loadFROReturns();
    const refresh = () => loadFROReturns();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("nature-biotic-fro-stock-return-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nature-biotic-fro-stock-return-updated",
        refresh,
      );
    };
  }, [storeId]);

  const pendingFROReturns = useMemo(
    () => froReturns.filter((item) => item.status === "pending"),
    [froReturns],
  );

  function getReturnTaxForItem(item: FROReturnRequestItem) {
    const product = (allProducts as any[]).find(
      (p: any) =>
        String(p.id || "") === String(item.productId || "") ||
        String(p.name || "").trim().toLowerCase() ===
          String(item.product || "").trim().toLowerCase(),
    );

    const totalTax = Number(product?.taxPercentage ?? product?.taxPercent ?? 0);
    const taxType = String(product?.taxType ?? "").toLowerCase();

    const explicitCgst = Number(
      product?.cgstPercent ?? product?.cgst ?? 0,
    );
    const explicitSgst = Number(
      product?.sgstPercent ?? product?.sgst ?? 0,
    );
    const explicitIgst = Number(
      product?.igstPercent ?? product?.igst ?? 0,
    );

    if (explicitCgst || explicitSgst || explicitIgst) {
      return {
        taxPercent:
          explicitCgst + explicitSgst + explicitIgst || totalTax,
        cgstPercent: explicitCgst,
        sgstPercent: explicitSgst,
        igstPercent: explicitIgst,
      };
    }

    if (taxType.includes("interstate") || taxType.includes("igst")) {
      return {
        taxPercent: totalTax,
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: totalTax,
      };
    }

    const half = totalTax / 2;
    return {
      taxPercent: totalTax,
      cgstPercent: half,
      sgstPercent: half,
      igstPercent: 0,
    };
  }

  function getItemTaxAmount(item: ReturnItem) {
    const base = Number(item.returnedQty || 0) * Number(item.unitValue || 0);
    const cgst = Number(item.cgstPercent ?? 0);
    const sgst = Number(item.sgstPercent ?? 0);
    const igst = Number(item.igstPercent ?? 0);

    if (cgst || sgst || igst) {
      return (base * (cgst + sgst + igst)) / 100;
    }

    return (base * Number(item.taxPercent ?? 0)) / 100;
  }

  function acceptFROReturn(request: FROReturnRequest) {
    if (request.status === "accepted") return;

    // Resolve the request against the FRO's actual current hand stock.
    // Older return requests may have an empty productId because the old
    // FRO return form was built from historical challans.
    let currentStock: any[] = [];
    try {
      const raw = localStorage.getItem(
        `nature-biotic-fro-stock-v1:${storeId}`,
      );
      const parsed = raw ? JSON.parse(raw) : [];
      currentStock = Array.isArray(parsed) ? parsed : [];
    } catch {
      currentStock = [];
    }

    const resolvedItems = request.items.map((item) => {
      const productName = String(item.product || "").trim().toLowerCase();
      const requestedProductId = String(item.productId || "");

      const stockRow = currentStock.find(
        (row: any) =>
          String(row.executiveName || "").trim().toLowerCase() ===
            String(request.froName || "").trim().toLowerCase() &&
          String(row.packSize || "") === String(item.packSize || "") &&
          String(row.batchNo || "") === String(item.batchNo || "") &&
          (
            (requestedProductId &&
              String(row.productId || "") === requestedProductId) ||
            (!requestedProductId &&
              String(row.productName || "").trim().toLowerCase() ===
                productName)
          ) &&
          Number(row.currentQty || 0) > 0,
      );

      return {
        ...item,
        productId: String(stockRow?.productId || item.productId || ""),
        availableQty: Number(stockRow?.currentQty || 0),
      };
    });

    const invalid = resolvedItems.find(
      (item) =>
        !item.productId ||
        Number(item.qty || 0) <= 0 ||
        Number(item.qty || 0) > Number(item.availableQty || 0),
    );

    if (invalid) {
      window.alert(
        `Return quantity is greater than the FRO current Hand Stock. Available: ${Number(
          invalid.availableQty || 0,
        )}`,
      );
      loadFROReturns();
      setSelectedFroReturn(null);
      return;
    }

    const acceptedAt = new Date().toISOString();
    const acceptedBy = "Store";

    // Remove the returned quantity from the FRO's hand stock only after
    // Store accepts the return. Use the resolved productId so legacy
    // requests with an empty productId also work.
    reduceFROStock(
      storeId,
      request.froName,
      resolvedItems.map((item) => ({
        productId: item.productId,
        packSize: item.packSize,
        batchNo: item.batchNo,
        qty: Number(item.qty || 0),
      })),
      request.date,
      "Return",
    );

    const accepted: FROReturnRequest = {
      ...request,
      items: resolvedItems.map(({ availableQty, ...item }) => item),
      status: "accepted",
      acceptedAt,
      acceptedBy,
    };

    const nextRequests = froReturns.map((item) =>
      item.id === request.id ? accepted : item,
    );
    setFroReturns(nextRequests);

    // Keep an explicit store-side return ledger. Store stock/inventory can
    // consume this ledger without modifying the original FRO return request.
    try {
      const ledgerKey = `${STORE_RETURN_RECEIVED_PREFIX}:${storeId}`;
      const ledger = JSON.parse(localStorage.getItem(ledgerKey) || "[]");
      localStorage.setItem(
        ledgerKey,
        JSON.stringify([
          {
            ...accepted,
            source: "FRO",
            receivedBy: "Store",
          },
          ...ledger.filter((item: FROReturnRequest) => item.id !== request.id),
        ]),
      );

      // Update the FRO request source so the same return cannot be accepted twice.
      const froKey = String(request.froName || "")
        .trim()
        .toLowerCase();
      if (froKey) {
        const requestKey = `${FRO_RETURN_PREFIX}:${froKey}`;
        const saved = JSON.parse(localStorage.getItem(requestKey) || "[]");
        if (Array.isArray(saved)) {
          localStorage.setItem(
            requestKey,
            JSON.stringify(
              saved.map((item: FROReturnRequest) =>
                item.id === request.id ? accepted : item,
              ),
            ),
          );
        }
      }

      window.dispatchEvent(new Event("nature-biotic-fro-stock-return-updated"));
      window.dispatchEvent(
        new Event("nature-biotic-store-stock-return-updated"),
      );
    } catch {}

    const storeRow: ReturnChallan = {
      id: `fro-return-store-${request.id}`,
      productId: request.items[0]?.productId || "",
      rcNo: request.rcNo,
      date: request.date,
      sdNo: "",
      executive: request.froName,
      customerName: request.froName,
      village: "",
      phone: "",
      farmer: request.froName,
      placeOfSupply: "Tamil Nadu",
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      items: request.items.map((item) => {
        const tax = getReturnTaxForItem(item);
        return {
          productId: item.productId,
          product: item.product,
          packSize: item.packSize,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          issuedQty: String(item.qty),
          returnedQty: String(item.qty),
          unitValue: String(item.unitValue),
          taxPercent: tax.taxPercent,
          cgstPercent: tax.cgstPercent,
          sgstPercent: tax.sgstPercent,
          igstPercent: tax.igstPercent,
        };
      }),
    };

    // Show the accepted FRO return in the Store Return Challan list.
    if (
      !rows.some((row) => row.id === storeRow.id || row.rcNo === storeRow.rcNo)
    ) {
      persist([storeRow, ...rows]);
    }

    setSelectedFroReturn(null);
  }

  const canCreate =
    !!rcNo.trim() &&
    !!date &&
    !!sdNo.trim() &&
    !!executive &&
    items.every(
      (item) =>
        item.product.trim() &&
        item.packSize.trim() &&
        item.batchNo.trim() &&
        item.expiryDate &&
        Number(item.returnedQty) > 0 &&
        Number(item.unitValue) >= 0,
    );

  const totals = useMemo(() => {
    const issuedQty = items.reduce(
      (sum, item) => sum + Number(item.issuedQty || 0),
      0,
    );
    const returnedQty = items.reduce(
      (sum, item) => sum + Number(item.returnedQty || 0),
      0,
    );
    const returnValue = items.reduce(
      (sum, item) =>
        sum + Number(item.returnedQty || 0) * Number(item.unitValue || 0),
      0,
    );

    const cgstAmount = (returnValue * cgstPercent) / 100;
    const sgstAmount = (returnValue * sgstPercent) / 100;
    const igstAmount = (returnValue * igstPercent) / 100;

    return {
      issuedQty,
      returnedQty,
      returnValue,
      cgstAmount,
      sgstAmount,
      igstAmount,
      grandTotal: returnValue + cgstAmount + sgstAmount + igstAmount,
    };
  }, [items, cgstPercent, sgstPercent, igstPercent]);

  function updateItem(index: number, key: keyof ReturnItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  function resetForm() {
    setRcNo("");
    setDate("");
    setsdNo("");
    setExecutive("");
    setCustomerName("");
    setVillage("");
    setPhone("");
    setPlaceOfSupply("");
    setCgstPercent(0); // ✅ ADD
    setSgstPercent(0); // ✅ ADD
    setIgstPercent(0); // ✅ ADD
    setItems(emptyItems());
  }

  function closeForm() {
    setShowAdd(false);
    resetForm();
  }

  function persist(next: ReturnChallan[]) {
    setRows(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }

  function createReturnChallan() {
    if (!canCreate) return;

    const row: ReturnChallan = {
      id: String(Date.now()),
      rcNo: rcNo.trim(),
      date,
      sdNo: sdNo.trim(),
      executive,
      customerName: customerName.trim(),
      village: village.trim(),
      phone: phone.trim(),
      placeOfSupply: placeOfSupply.trim(),
      cgstPercent, // ✅ ADD
      sgstPercent, // ✅ ADD
      igstPercent, // ✅ ADD
      items,
      farmer: undefined,
      productId: "",
    };

    reduceFROStock(
      storeId,
      executive,
      items.map((item) => ({
        productId: item.productId,
        packSize: item.packSize,
        batchNo: item.batchNo,
        qty: Number(item.returnedQty || 0),
      })),
      date, // ✅ ADD
      "Return", // ✅ ADD
    );

    persist([row, ...rows]);
    closeForm();
  }

  function numberToWords(num: number): string {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];

    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    function convert(n: number): string {
      if (n < 20) return ones[n];
      if (n < 100) {
        return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      }
      if (n < 1000) {
        return (
          ones[Math.floor(n / 100)] +
          " Hundred" +
          (n % 100 ? " " + convert(n % 100) : "")
        );
      }
      if (n < 100000) {
        return (
          convert(Math.floor(n / 1000)) +
          " Thousand" +
          (n % 1000 ? " " + convert(n % 1000) : "")
        );
      }
      if (n < 10000000) {
        return (
          convert(Math.floor(n / 100000)) +
          " Lakh" +
          (n % 100000 ? " " + convert(n % 100000) : "")
        );
      }

      return (
        convert(Math.floor(n / 10000000)) +
        " Crore" +
        (n % 10000000 ? " " + convert(n % 10000000) : "")
      );
    }

    const rounded = Math.round(Number(num) || 0);

    if (rounded === 0) return "Zero Rupees Only";

    return `${convert(rounded)} Rupees Only`;
  }
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Return</h1>
          <p className="mt-1 text-slate-500">
            Record unsold products returned by executives against delivery
            challans.
          </p>
        </div>
      </div>

      {pendingFROReturns.length > 0 && (
        <Card className="mb-5 overflow-hidden border-orange-200 p-0">
          <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50/60 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                FRO Stock Return — Pending
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Returns waiting for Store acceptance
              </p>
            </div>
            <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">
              {pendingFROReturns.length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingFROReturns.map((request) => {
              const qty = request.items.reduce(
                (sum, item) => sum + Number(item.qty || 0),
                0,
              );
              const value = request.items.reduce(
                (sum, item) =>
                  sum + Number(item.qty || 0) * Number(item.unitValue || 0),
                0,
              );

              return (
                <button
                  type="button"
                  key={request.id}
                  onClick={() => setSelectedFroReturn(request)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-orange-50/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {String(request.rcNo || "").replace(/^RC/i, "SR")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {request.froName} • {formatDate(request.date)} • Qty {qty}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-800">
                    {formatCurrency(value)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="assignment_return"
            title="No return challans"
            description="Create a return challan for unsold stock returned by an executive."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              {/* MAIN HEADER */}
              <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th
                  rowSpan={2}
                  className="w-[5%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  S.No
                </th>
                <th
                  rowSpan={2}
                  className="w-[7%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  Date
                </th>
                <th
                  rowSpan={2}
                  className="w-[12%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  SR No
                </th>
                <th
                  rowSpan={2}
                  className="w-[14%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  Executive
                </th>
                <th
                  rowSpan={2}
                  className="w-[11%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  Returned Qty
                </th>
                <th
                  rowSpan={2}
                  className="w-[13%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  Without Tax
                </th>
                <th
                  rowSpan={2}
                  className="w-[13%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
                >
                  Tax
                </th>
                <th
                  rowSpan={2}
                  className="w-[13%] px-1.5 py-2.5 text-right font-semibold"
                >
                  Total
                </th>{" "}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => {
                const returnedQty = row.items.reduce(
                  (sum, item) => sum + Number(item.returnedQty || 0),
                  0,
                );

                const withoutTax = row.items.reduce(
                  (sum, item) =>
                    sum +
                    Number(item.returnedQty || 0) * Number(item.unitValue || 0),
                  0,
                );

                // Tax values: accepted FRO returns keep product-level GST.
                const itemTax = row.items.reduce(
                  (sum, item) => sum + getItemTaxAmount(item),
                  0,
                );
                const fallbackSgst =
                  (withoutTax * Number(row.sgstPercent || 0)) / 100;
                const fallbackCgst =
                  (withoutTax * Number(row.cgstPercent || 0)) / 100;
                const fallbackIgst =
                  (withoutTax * Number(row.igstPercent || 0)) / 100;
                const taxTotal =
                  itemTax > 0
                    ? itemTax
                    : fallbackSgst + fallbackCgst + fallbackIgst;

                const total = withoutTax + taxTotal;

                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectesdhallan(row)}
                    className="cursor-pointer transition hover:bg-brand-50/40"
                    title="Click to view return challan"
                  >
                    {/* S.NO */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center">
                      {index + 1}
                    </td>

                    {/* DATE */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>

                    {/* SR NO */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center font-semibold">
                      {String(row.rcNo || "").replace(/^RC/i, "SR")}
                    </td>

                    {/* EXECUTIVE */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center">
                      {row.executive || "-"}
                    </td>

                    {/* RETURNED QTY */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center font-bold">
                      {returnedQty}
                    </td>

                    {/* WITHOUT TAX */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                      {formatCurrency(withoutTax)}
                    </td>

                    {/* TAX */}
                    <td className="border-r border-slate-100 px-1.5 py-3 text-right text-slate-600 whitespace-nowrap">
                      {formatCurrency(taxTotal)}
                    </td>

                    {/* TOTAL */}
                    <td className="px-1.5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {selectedFroReturn &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedFroReturn(null);
            }}
          >
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                    FRO Stock Return
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">
                    {selectedFroReturn.rcNo}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedFroReturn.froName} •{" "}
                    {formatDate(selectedFroReturn.date)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFroReturn(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-3">
                  {selectedFroReturn.items.map((item, index) => (
                    <div
                      key={`${selectedFroReturn.id}-${index}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {item.product}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Size: {item.packSize || "-"} • Batch:{" "}
                            {item.batchNo || "-"}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-800">
                          Qty {item.qty}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400">Expiry</p>
                          <p className="mt-0.5 font-semibold text-slate-700">
                            {item.expiryDate
                              ? formatDate(item.expiryDate)
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Value</p>
                          <p className="mt-0.5 font-semibold text-slate-700">
                            {formatCurrency(
                              Number(item.qty || 0) *
                                Number(item.unitValue || 0),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
                  <span className="font-semibold">Reason:</span>{" "}
                  {selectedFroReturn.reason}
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setSelectedFroReturn(null)}
                >
                  Close
                </Button>
                <Button
                  className="w-full"
                  onClick={() => acceptFROReturn(selectedFroReturn)}
                >
                  Accept Return
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Return Challan
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Record unsold products returned against a delivery challan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="R.C No"
                    value={rcNo}
                    onChange={setRcNo}
                    placeholder="e.g. RC-002"
                    required
                  />

                  <Input
                    label="R.C Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />

                  <Input
                    label="Against D.C No"
                    value={sdNo}
                    onChange={setsdNo}
                    placeholder="e.g. sd-1001"
                    required
                  />

                  <Select
                    label="Executive"
                    value={executive}
                    onChange={setExecutive}
                    placeholder="Select executive"
                    options={executives.map((name) => ({
                      value: name,
                      label: name,
                    }))}
                    required
                  />

                  <Input
                    label="Customer Name"
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="Optional customer / route"
                  />

                  <Input
                    label="Village"
                    value={village}
                    onChange={setVillage}
                    placeholder="e.g. Rajapalayam"
                  />

                  <Input
                    label="Phone Number"
                    type="tel"
                    value={phone}
                    onChange={setPhone}
                    placeholder="e.g. 9876543210"
                  />

                  <Select
                    label="Place of Supply"
                    value={placeOfSupply}
                    onChange={(value) => {
                      setPlaceOfSupply(value);
                      if (value === "Tamil Nadu") {
                        setCgstPercent(9);
                        setSgstPercent(9);
                        setIgstPercent(0);
                      } else {
                        setCgstPercent(0);
                        setSgstPercent(0);
                        setIgstPercent(18);
                      }
                    }}
                    placeholder="Select Place of Supply"
                    options={[
                      { value: "Tamil Nadu", label: "Tamil Nadu" },
                      { value: "Others", label: "Others" },
                    ]}
                  />
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Returned Product Details
                    </h4>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        setItems((prev) => [
                          ...prev,
                          {
                            productId: "",
                            product: "",
                            packSize: "",
                            batchNo: "",
                            expiryDate: "",
                            issuedQty: "",
                            returnedQty: "",
                            unitValue: "",
                          },
                        ])
                      }
                    >
                      <Icon name="add" size={16} />
                      Add Product
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                          <th className="w-[6%] px-2 py-3 text-center">S.No</th>
                          <th className="w-[18%] px-2 py-3 text-left">
                            Product Name
                          </th>
                          <th className="w-[9%] px-2 py-3 text-center">
                            Pkg Size
                          </th>
                          <th className="w-[11%] px-2 py-3 text-center">
                            Batch ID
                          </th>
                          <th className="w-[11%] px-2 py-3 text-center">
                            Expiry Date
                          </th>
                          <th className="w-[10%] px-2 py-3 text-center">
                            Issued Qty
                          </th>
                          <th className="w-[13%] px-2 py-3 text-center">
                            Returned Qty
                          </th>
                          <th className="w-[14%] px-2 py-3 text-right">
                            Unit Value
                          </th>
                          <th className="w-[12%] px-2 py-3 text-right">
                            Return Value
                          </th>
                          <th className="w-[5%] px-2 py-3" />
                        </tr>
                      </thead>

                      <tbody>
                        {items.map((item, index) => {
                          const returnValue =
                            Number(item.returnedQty || 0) *
                            Number(item.unitValue || 0);

                          return (
                            <tr
                              key={index}
                              className="border-t border-slate-100"
                            >
                              <td className="px-2 py-3 text-center">
                                {index + 1}
                              </td>

                              <td className="px-2 py-3">
                                <Select
                                  value={item.productId}
                                  onChange={(value) => {
                                    const selectedProduct = allProducts.find(
                                      (p) => p.id === value,
                                    );
                                    updateItem(index, "productId", value);
                                    if (selectedProduct) {
                                      const source = selectedProduct as any;

                                      updateItem(
                                        index,
                                        "product",
                                        selectedProduct.name,
                                      );
                                      updateItem(
                                        index,
                                        "packSize",
                                        selectedProduct.size || "",
                                      );
                                      updateItem(
                                        index,
                                        "batchNo",
                                        String(
                                          source.batchNo ??
                                            source.batchId ??
                                            source.batchID ??
                                            "",
                                        ),
                                      );
                                      updateItem(
                                        index,
                                        "expiryDate",
                                        String(
                                          source.expiryDate ??
                                            source.expDate ??
                                            source.expiry ??
                                            "",
                                        ),
                                      );
                                      updateItem(
                                        index,
                                        "unitValue",
                                        String(
                                          selectedProduct.sellingPrice || 0,
                                        ),
                                      );
                                    }
                                  }}
                                  placeholder="Select Product"
                                  options={allProducts.map((p) => ({
                                    value: p.id,
                                    label: `${p.name} (${p.size})`,
                                  }))}
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Select
                                  value={item.packSize}
                                  onChange={(value) =>
                                    updateItem(index, "packSize", value)
                                  }
                                  placeholder="Select size"
                                  options={[
                                    { value: "100ml", label: "100 ml" },
                                    { value: "250ml", label: "250 ml" },
                                    { value: "500ml", label: "500 ml" },
                                    { value: "1l", label: "1 L" },
                                    { value: "100g", label: "100 g" },
                                    { value: "250g", label: "250 g" },
                                    { value: "500g", label: "500 g" },
                                    { value: "1kg", label: "1 Kg" },
                                    { value: "5kg", label: "5 Kg" },
                                    { value: "10kg", label: "10 Kg" },
                                    { value: "25kg", label: "25 Kg" },
                                  ]}
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  value={item.batchNo}
                                  onChange={(value) =>
                                    updateItem(index, "batchNo", value)
                                  }
                                  placeholder="Batch ID"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="date"
                                  value={item.expiryDate}
                                  onChange={(value) =>
                                    updateItem(index, "expiryDate", value)
                                  }
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.issuedQty}
                                  onChange={(value) =>
                                    updateItem(index, "issuedQty", value)
                                  }
                                  placeholder="Issued"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.returnedQty}
                                  onChange={(value) =>
                                    updateItem(index, "returnedQty", value)
                                  }
                                  placeholder="Return"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.unitValue}
                                  onChange={(value) =>
                                    updateItem(index, "unitValue", value)
                                  }
                                  placeholder="₹"
                                />
                              </td>

                              <td className="px-2 py-3 text-right font-bold">
                                {formatCurrency(returnValue)}
                              </td>

                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={items.length === 1}
                                  onClick={() =>
                                    setItems((prev) =>
                                      prev.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 ml-auto w-full max-w-lg rounded-xl bg-slate-50 p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-slate-400">Issued Qty</p>
                        <p className="mt-1 font-bold text-slate-800">
                          {totals.issuedQty}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Returned Qty</p>
                        <p className="mt-1 font-bold text-slate-800">
                          {totals.returnedQty}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Without Tax</p>
                        <p className="mt-1 font-bold text-slate-700">
                          {formatCurrency(totals.returnValue)}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-2 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">SGST</span>
                        <span className="text-slate-600">
                          {formatCurrency(totals.sgstAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">CGST</span>
                        <span className="text-slate-600">
                          {formatCurrency(totals.cgstAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">IGST</span>
                        <span className="text-slate-600">
                          {formatCurrency(totals.igstAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                      <span className="font-bold text-slate-800">
                        Grand Total
                      </span>
                      <span className="font-bold text-brand-700">
                        {formatCurrency(totals.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>

                <Button onClick={createReturnChallan} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Return Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectesdhallan &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              @media print {

                @page {
                  size: A4 landscape;
                  margin: 6mm 5mm 5mm 5mm !important;
                }

                body * {
                  visibility: hidden !important;
                }

                .return-challan-print-area,
                .return-challan-print-area * {
                  visibility: visible !important;
                }

                /* Backdrop */
                .return-challan-backdrop {
                  position: static !important;
                  display: block !important;
                  background: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                }

                /* ================================
                  MAIN PRINT AREA
                  ================================ */
                .return-challan-print-area {
                  position: static !important;

                  /*
                  * A4 printable width = around 287mm.
                  * Since we are zooming to 82%,
                  * increase actual width so final visual width
                  * still fills the page correctly.
                  */
                  width: 350mm !important;
                  max-width: none !important;

                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;

                  overflow: visible !important;

                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: white !important;

                  margin: 0 !important;
                  padding: 0 !important;

                  /*
                  * WHOLE CONTENT ZOOM OUT
                  * This is the main change.
                  */
                  zoom: 0.82 !important;

                  /*
                  * Do NOT use transform.
                  * It can cause top clipping.
                  */
                  transform: none !important;
                  transform-origin: top left !important;
                }

                /* ================================
                  REMOVE EXTRA TABLE HEIGHT
                  ================================ */

                .return-challan-print-area table {
                  height: auto !important;
                  min-height: 0 !important;
                }

                .return-challan-print-area tbody {
                  height: auto !important;
                  min-height: 0 !important;
                }

                .return-challan-print-area tbody tr {
                  height: auto !important;
                  min-height: 0 !important;
                }

                .return-challan-print-area tbody td {
                  height: auto !important;
                  min-height: 0 !important;
                }

                /* ================================
                  FLEX HEIGHT FIX
                  ================================ */

                .return-challan-print-area .flex-1 {
                  flex: none !important;
                }

                .return-challan-print-area .h-full {
                  height: auto !important;
                }

                .return-challan-print-area .min-h-full {
                  min-height: 0 !important;
                }

                .return-challan-print-area [class*="min-h-"] {
                  min-height: 0 !important;
                }

                /* ================================
                  SCROLL CONTAINER
                  ================================ */

                .return-challan-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  max-height: none !important;
                  height: auto !important;
                }

                /* ================================
                  TEXT
                  ================================ */

                .return-challan-print-area h1,
                .return-challan-print-area h2,
                .return-challan-print-area h3,
                .return-challan-print-area p {
                  overflow: visible !important;
                }

                .return-challan-print-area h1 {
                  line-height: 1.4 !important;
                  padding-top: 2px !important;
                }

                /* ================================
                  TABLE PAGE BREAK
                  ================================ */

                .return-challan-print-area table,
                .return-challan-print-area tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }

                /* ================================
                  SCREEN ONLY
                  ================================ */

                .return-challan-screen-only {
                  display: none !important;
                }
              }
            `}</style>

            <div className="return-challan-print-area flex max-h-[94vh] w-[98vw] max-w-[1450px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="return-challan-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Stock Return
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectesdhallan.rcNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectesdhallan(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="return-challan-scroll min-h-0 flex-1 overflow-y-auto p-3">
                <div className="min-h-full w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 px-6 py-3">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>

                        <div>
                          <h3 className="text-lg font-extrabold tracking-wide text-slate-900">
                            SAIRAM AGRI INPUTS
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                            Rajapalayam, Tamil Nadu
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Nature Biotic Store
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center px-4 py-3">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Stock Return
                        </h3>
                        {/* <p className="mt-1 text-[10px] text-slate-500">
                          Executive Unsold Stock Return
                        </p> */}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Return Details
                      </p>
                      <p className="text-slate-600">
                        SR No:{" "}
                        <span className="font-semibold text-slate-800">
                          {String(selectesdhallan.rcNo || "").replace(
                            /^RC/i,
                            "SR",
                          )}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Executive:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectesdhallan.executive || "-"}
                        </span>
                      </p>
                    </div>

                    <div className="px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Challan Details
                      </p>
                      <div className="grid grid-cols-[95px_1fr] gap-y-0.5">
                        <span className="text-slate-500">Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selectesdhallan.date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                          <th className="w-[5%] border-r border-slate-300 px-2 py-2 text-center">
                            S.No
                          </th>
                          <th className="w-[16%] border-r border-slate-300 px-2 py-2 text-left">
                            Product
                          </th>
                          <th className="w-[9%] border-r border-slate-300 px-2 py-2 text-center">
                            Pkg Size
                          </th>
                          <th className="w-[11%] border-r border-slate-300 px-2 py-2 text-center">
                            Batch ID
                          </th>
                          <th className="w-[11%] border-r border-slate-300 px-2 py-2 text-center">
                            Expiry Date
                          </th>
                          <th className="w-[9%] border-r border-slate-300 px-2 py-2 text-center">
                            Issued Qty
                          </th>
                          <th className="w-[10%] border-r border-slate-300 px-2 py-2 text-center">
                            Returned Qty
                          </th>
                          <th className="w-[11%] border-r border-slate-300 px-2 py-2 text-right">
                            Unit Value
                          </th>
                          <th className="w-[14%] px-2 py-2 text-right">
                            Return Value
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectesdhallan.items.map((item, index) => (
                          <tr
                            key={`${selectesdhallan.id}-${index}`}
                            className="border-slate-300"
                          >
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {index + 1}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                              {item.product}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.packSize}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.batchNo || "-"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.expiryDate
                                ? formatDate(item.expiryDate)
                                : "-"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center">
                              {item.issuedQty || "-"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-center font-bold">
                              {item.returnedQty}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(Number(item.unitValue || 0))}
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-slate-800">
                              {formatCurrency(
                                Number(item.returnedQty || 0) *
                                  Number(item.unitValue || 0),
                              )}
                            </td>
                          </tr>
                        ))}

                        {/* Filler rows extend the column borders to the minimum table height. */}
                        {(() => {
                          const MIN_ROWS = 10;
                          const fillerCount = Math.max(
                            0,
                            MIN_ROWS - selectesdhallan.items.length,
                          );
                          const columnCount = 9;

                          return Array.from({ length: fillerCount }).map(
                            (_, i) => (
                              <tr key={`filler-${i}`}>
                                {Array.from({ length: columnCount }).map(
                                  (_, colIdx) => (
                                    <td
                                      key={colIdx}
                                      className={`px-1 py-1.5 ${
                                        colIdx < columnCount - 1
                                          ? "border-r border-slate-300"
                                          : ""
                                      }`}
                                    >
                                      &nbsp;
                                    </td>
                                  ),
                                )}
                              </tr>
                            ),
                          );
                        })()}
                      </tbody>

                      <tfoot>
                        {(() => {
                          const items = selectesdhallan.items;
                          const totalIssuedQty = items.reduce(
                            (sum, item) => sum + Number(item.issuedQty || 0),
                            0,
                          );
                          const totalReturnedQty = items.reduce(
                            (sum, item) => sum + Number(item.returnedQty || 0),
                            0,
                          );
                          const totalReturnValue = items.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.returnedQty || 0) *
                                Number(item.unitValue || 0),
                            0,
                          );

                          return (
                            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                              <td
                                colSpan={5}
                                className="border-r border-slate-300 px-2 py-2 text-center"
                              >
                                Total
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center">
                                {totalIssuedQty}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center">
                                {totalReturnedQty}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2" />
                              <td className="px-2 py-2 text-right">
                                {formatCurrency(totalReturnValue)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {(() => {
                    const withoutTax = selectesdhallan.items.reduce(
                      (sum: number, item: ReturnItem) =>
                        sum +
                        Number(item.returnedQty || 0) *
                          Number(item.unitValue || 0),
                      0,
                    );
                    const itemTaxAmount = selectesdhallan.items.reduce(
                      (sum: number, item: ReturnItem) =>
                        sum + getItemTaxAmount(item),
                      0,
                    );
                    const fallbackSgst =
                      (withoutTax *
                        Number(selectesdhallan.sgstPercent || 0)) /
                      100;
                    const fallbackCgst =
                      (withoutTax *
                        Number(selectesdhallan.cgstPercent || 0)) /
                      100;
                    const fallbackIgst =
                      (withoutTax *
                        Number(selectesdhallan.igstPercent || 0)) /
                      100;
                    const taxAmount =
                      itemTaxAmount > 0
                        ? itemTaxAmount
                        : fallbackSgst + fallbackCgst + fallbackIgst;
                    const grandTotal = withoutTax + taxAmount;
                    const roundedTotal = Math.round(grandTotal);
                    const roundOff = roundedTotal - grandTotal;

                    return (
                      <>
                        {/* ROW 1: Amount in Words (left, bottom-aligned) + breakdown/Round Off/Grand Total (right) */}
                        <div className="grid grid-cols-[1fr_320px] border-t border-slate-300">
                          <div className="flex flex-col justify-end border-r border-slate-300 p-2.5">
                            <p className="text-[10px] font-semibold text-slate-700">
                              Amount in Words :{" "}
                              <span className="font-bold text-slate-900">
                                {numberToWords(roundedTotal)}
                              </span>
                            </p>
                          </div>

                          <div className="space-y-1 p-2.5 text-[11px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500">
                                Without Tax
                              </span>
                              <span className="font-semibold text-slate-700">
                                {formatCurrency(withoutTax)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500">Tax</span>
                              <span className="font-semibold text-slate-700">
                                {formatCurrency(taxAmount)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-slate-300 pt-1.5">
                              <span className="text-slate-500">Round Off</span>
                              <span className="font-semibold text-slate-500">
                                {formatCurrency(roundOff)}
                              </span>
                            </div>

                            <div className="border-t border-slate-300 pt-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-bold text-slate-800">
                                  Grand Total
                                </span>
                                <span className="text-lg font-bold text-slate-900">
                                  {formatCurrency(roundedTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                        <div className="grid min-h-[110px] grid-cols-[1fr_300px] border-t border-slate-300">
                          {/* NOTES */}
                          <div className="flex flex-col justify-end border-r border-slate-300 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                              Notes
                            </p>

                            {(() => {
                              const defaultNotes = `Purchase order raised by ${
                                selectesdhallan?.customerName ?? "this store"
                              } to Nature Biotic.`;

                              return (
                                <>
                                  {/* Screen - Editable Notes */}
                                  <textarea
                                    value={purchaseOrderNotes}
                                    onChange={(e) =>
                                      setPurchaseOrderNotes(e.target.value)
                                    }
                                    rows={2}
                                    placeholder="Enter notes..."
                                    className="po-print-hide mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 focus:border-brand-500 focus:outline-none"
                                  />

                                  {/* Print - Show edited notes */}
                                  <p className="po-print-only mt-1.5 hidden whitespace-pre-line text-xs text-slate-500">
                                    {purchaseOrderNotes || defaultNotes}
                                  </p>
                                </>
                              );
                            })()}
                          </div>

                          {/* AUTHORISED SIGNATORY */}
                          <div className="flex items-end justify-center p-3">
                            <div className="w-full text-center">
                              <div className="border-b border-slate-300" />
                              <p className="mt-1.5 text-xs font-semibold text-slate-500">
                                Authorised Signatory
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="return-challan-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectesdhallan(null)}
                >
                  Close
                </Button>

                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Return Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
