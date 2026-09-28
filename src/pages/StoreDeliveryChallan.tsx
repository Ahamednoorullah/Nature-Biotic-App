import { useEffect, useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { createPortal } from "react-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getProductsByStore,
  getStorePurchasesFromCompanySales,
  getStoreAvailableQty,
} from "@/lib/data";

type Item = {
  productId: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  qty: string;
  unitValue: string;
  taxPercent: number;
};
type Challan = {
  id: string;
  sdNo: string;
  date: string;
  executive: string;
  status?: "pending" | "accepted";
  storeId?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  items: Item[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

function emptyItems(): Item[] {
  return [
    {
      productId: "",
      product: "",
      packSize: "",
      batchNo: "",
      expiryDate: "",
      qty: "",
      unitValue: "",
      taxPercent: 0,
    },
  ];
}

const STORAGE_PREFIX = "nature-biotic-store-delivery-challans-v2";
const FRO_PENDING_PREFIX = "nature-biotic-fro-pending-deliveries-v1";

export default function StoreDeliveryChallan({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [challans, setChallans] = useState<Challan[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}

    return [];
  });

  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Challan | null>(null);
  const [sdNo, setsdNo] = useState("");
  const [executive, setExecutive] = useState("");
  const [date, setDate] = useState("");
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState("");
  const [items, setItems] = useState<Item[]>(emptyItems());
  const [froFilter, setFroFilter] = useState("all");

  const [inventoryVersion, setInventoryVersion] = useState(0);

  function isChallanAccepted(challan: Challan): boolean {
    // IMPORTANT: the Store table must depend on this delivery's own status.
    // Do not infer acceptance from total quantity in the accepted ledger,
    // because an older accepted delivery of the same product/batch can make
    // a newly-created pending delivery look accepted.
    return challan.status === "accepted";
  }

  const pendingChallans = useMemo(
    () => challans.filter((challan) => !isChallanAccepted(challan)),
    [challans, storeId, inventoryVersion],
  );

  const acceptedChallans = useMemo(
    () => challans.filter((challan) => isChallanAccepted(challan)),
    [challans, storeId, inventoryVersion],
  );

  const froFilterOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        acceptedChallans
          .map((challan) => String(challan.executive || "").trim())
          .filter(Boolean),
      ),
    );
    return names.map((name) => ({ value: name, label: name }));
  }, [acceptedChallans]);

  const visibleChallans = useMemo(() => {
    if (froFilter === "all") return acceptedChallans;
    return acceptedChallans.filter(
      (challan) => challan.executive === froFilter,
    );
  }, [acceptedChallans, froFilter]);

  useEffect(() => {
    const loadChallans = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setChallans(parsed);
        }
      } catch {}
      setInventoryVersion((v) => v + 1);
    };

    loadChallans();
    window.addEventListener("company-store-sales-updated", loadChallans);
    window.addEventListener("fro-accepted-deliveries-updated", loadChallans);
    window.addEventListener(
      "nature-biotic-delivery-challan-updated",
      loadChallans,
    );
    window.addEventListener(
      "nature-biotic-store-inventory-updated",
      loadChallans,
    );
    window.addEventListener("focus", loadChallans);
    return () => {
      window.removeEventListener("company-store-sales-updated", loadChallans);
      window.removeEventListener(
        "fro-accepted-deliveries-updated",
        loadChallans,
      );
      window.removeEventListener(
        "nature-biotic-delivery-challan-updated",
        loadChallans,
      );
      window.removeEventListener(
        "nature-biotic-store-inventory-updated",
        loadChallans,
      );
      window.removeEventListener("focus", loadChallans);
    };
  }, [storeId, storageKey]);

  // Only stock that actually exists in this store's purchase records is shown.
  // Batch / expiry / price are read from those purchase records and are not
  // manually entered by the user.
  const storeProducts = useMemo(() => {
    const products = getProductsByStore(storeId);
    const purchases = getStorePurchasesFromCompanySales(storeId);
    const productByName = new Map(
      products.map((product: any) => [
        String(product.name).trim().toLowerCase(),
        product,
      ]),
    );
    const groups = new Map<string, any>();

    purchases.forEach((purchase: any) => {
      const productName = String(purchase.product ?? "").trim();
      if (!productName) return;

      const product =
        (purchase.productId
          ? products.find(
              (p: any) => String(p.id) === String(purchase.productId),
            )
          : undefined) ?? productByName.get(productName.toLowerCase());
      if (!product) return;

      const productId = String(product.id);
      const packSize = String(
        purchase.packSize ??
          purchase.pkgsize ??
          purchase.size ??
          product.size ??
          "",
      ).trim();
      if (!packSize) return;

      const batchNo =
        String(purchase.batchNo ?? purchase.batchId ?? "").trim() || "-";
      const expiryDate =
        String(
          purchase.expiryDate ?? purchase.expDate ?? purchase.expiry ?? "",
        ).trim() || "-";
      const purchasedQty = Math.max(
        0,
        Number(purchase.quantity ?? purchase.qty ?? 0),
      );
      if (purchasedQty <= 0) return;

      const unitValue = Number(
        purchase.unitPrice ??
          purchase.rate ??
          purchase.price ??
          product.sellingPrice ??
          0,
      );
      const key = [
        productId,
        packSize.toLowerCase(),
        batchNo.toLowerCase(),
        expiryDate,
      ].join("::");
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += purchasedQty;
        existing.unitValue = existing.unitValue || unitValue;
      } else {
        groups.set(key, {
          productId,
          productName: String(product.name || productName),
          productType: String(
            product.productType ?? product.productCategory ?? "-",
          ),
          packSize,
          batchNo,
          expiryDate,
          quantity: purchasedQty,
          unitValue,
          taxPercent: Number(
            purchase.taxPercent ??
              product.taxPercentage ??
              product.taxPercent ??
              0,
          ),
        });
      }
    });

    const byProduct = new Map<string, any>();
    groups.forEach((variant) => {
      const availableQty = getStoreAvailableQty(
        storeId,
        variant.productId,
        variant.packSize,
        variant.batchNo,
        variant.productName,
      );
      if (availableQty <= 0) return;

      const product = byProduct.get(variant.productId) ?? {
        id: variant.productId,
        name: variant.productName,
        productType: variant.productType,
        variants: [],
      };
      product.variants.push({
        ...variant,
        availableQty,
      });
      byProduct.set(variant.productId, product);
    });

    return Array.from(byProduct.values());
  }, [storeId, inventoryVersion]);

  function getProductVariants(productId: string) {
    return storeProducts.find((p: any) => p.id === productId)?.variants ?? [];
  }

  function applyVariant(i: number, variant: any) {
    if (!variant) return;
    setItems((prev) =>
      prev.map((item, index) =>
        index === i
          ? {
              ...item,
              productId: variant.productId,
              product: variant.productName,
              packSize: variant.packSize,
              batchNo: variant.batchNo,
              expiryDate: variant.expiryDate,
              unitValue: String(variant.unitValue || 0),
              taxPercent: Number(variant.taxPercent || 0),
              qty:
                item.qty && Number(item.qty) <= variant.availableQty
                  ? item.qty
                  : "",
            }
          : item,
      ),
    );
  }

  function selectProduct(i: number, productId: string) {
    const product = storeProducts.find((p: any) => p.id === productId);
    const firstVariant = product?.variants?.[0];
    if (firstVariant) applyVariant(i, firstVariant);
    else {
      setItems((prev) =>
        prev.map((item, index) =>
          index === i
            ? {
                ...item,
                productId,
                product: product?.name || "",
                packSize: "",
                batchNo: "",
                expiryDate: "",
                qty: "",
                unitValue: "",
                taxPercent: 0,
              }
            : item,
        ),
      );
    }
  }

  function selectPackSize(i: number, packSize: string) {
    const item = items[i];
    const variant = getProductVariants(item.productId).find(
      (v: any) => v.packSize === packSize,
    );
    if (variant) applyVariant(i, variant);
  }

  function selectBatch(i: number, batchNo: string) {
    const item = items[i];
    const variant = getProductVariants(item.productId).find(
      (v: any) => v.packSize === item.packSize && v.batchNo === batchNo,
    );
    if (variant) applyVariant(i, variant);
  }

  const canCreate =
    !!sdNo.trim() &&
    !!executive &&
    !!date &&
    items.every(
      (item) =>
        item.product &&
        item.packSize &&
        item.batchNo.trim() &&
        item.expiryDate &&
        Number(item.qty) > 0 &&
        Number(item.unitValue) >= 0,
    );

  const totals = useMemo(() => {
    const approxValue = items.reduce(
      (sum, item) => sum + Number(item.qty || 0) * Number(item.unitValue || 0),
      0,
    );
    const taxAmount = items.reduce((sum, item) => {
      const lineValue = Number(item.qty || 0) * Number(item.unitValue || 0);
      const lineTax = (lineValue * Number(item.taxPercent || 0)) / 100;
      return sum + lineTax;
    }, 0);

    return {
      totalQty: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
      approxValue,
      taxAmount,
      grandTotal: approxValue + taxAmount,
    };
  }, [items]);

  function updateItem(i: number, key: keyof Item, value: string) {
    setItems((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)),
    );
  }

  function resetForm() {
    setsdNo("");
    setExecutive("");
    setDate("");
    setItems(emptyItems());
  }

  function closeForm() {
    setShowAdd(false);
    resetForm();
  }

  function getNextSdNo() {
    const maxNo = challans.reduce((max, challan) => {
      const match = String(challan.sdNo || "").match(/SD-(\d+)/i);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);

    return `SD-${String(maxNo + 1).padStart(4, "0")}`;
  }

  function openCreateForm() {
    setsdNo(getNextSdNo());
    setExecutive("");
    setDate(new Date().toISOString().split("T")[0]);
    setItems(emptyItems());
    setShowAdd(true);
  }

  function createChallan() {
    if (!canCreate) return;

    const next: Challan = {
      id: String(Date.now()),
      sdNo: sdNo.trim(),
      date,
      executive,
      storeId,
      status: "pending",
      items: items.map((item) => ({ ...item })),
    };

    const updated = [next, ...challans];
    setChallans(updated);
    try {
      // Store copy
      localStorage.setItem(storageKey, JSON.stringify(updated));

      // Separate FRO inbox copy. This makes the pending delivery available
      // to the selected FRO even when the FRO session resolves a different
      // store/default id.
      const pendingKey = `${FRO_PENDING_PREFIX}:${String(executive).trim().toLowerCase()}`;
      const existingPending = JSON.parse(
        localStorage.getItem(pendingKey) || "[]",
      );
      localStorage.setItem(
        pendingKey,
        JSON.stringify([next, ...existingPending]),
      );

      window.dispatchEvent(new Event("nature-biotic-delivery-challan-updated"));
    } catch {}
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Delivery</h1>
          <p className="mt-1 text-slate-500">
            Issue products from store stock to field executives.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Icon name="add" size={18} /> Create Stock Delivery
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            {/* First Header Row */}
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th
                rowSpan={2}
                className="w-[5%] border-r border-slate-200 px-2 py-2.5 text-center"
              >
                S.No
              </th>

              <th
                rowSpan={2}
                className="w-[8%] border-r border-slate-200 px-2 py-2.5 text-center"
              >
                Date
              </th>

              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-200 px-2 py-2.5 text-center"
              >
                SD No
              </th>

              <th
                rowSpan={2}
                className="w-[8%] border-r border-slate-200 px-2 py-2.5 text-center"
              >
                Executive
              </th>

              <th
                rowSpan={2}
                className="w-[7%] border-r border-slate-200 px-2 py-2.5 text-center"
              >
                Products
              </th>

              <th
                rowSpan={2}
                className="w-[6%] border-r border-slate-200 px-2 py-2.5 text-center"
              >
                Qty
              </th>

              {/* Without Tax */}
              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-200 px-2 py-2.5 text-center font-semibold"
              >
                Without Tax
              </th>

              {/* Tax */}
              <th
                rowSpan={2}
                className="w-[10%] border-r border-slate-200 px-2 py-2.5 text-center font-semibold"
              >
                Tax
              </th>

              {/* Total */}
              <th
                rowSpan={2}
                className="w-[10%] px-2 py-2.5 text-right font-semibold"
              >
                Total Value
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {visibleChallans.map((c, index) => {
              const totalQty = c.items.reduce(
                (s, x) => s + Number(x.qty || 0),
                0,
              );
              const withoutTax = c.items.reduce(
                (s, x) => s + Number(x.qty || 0) * Number(x.unitValue || 0),
                0,
              );

              const tax = c.items.reduce((sum, item) => {
                const lineValue =
                  Number(item.qty || 0) * Number(item.unitValue || 0);
                return sum + (lineValue * Number(item.taxPercent || 0)) / 100;
              }, 0);
              const totalValue = withoutTax + tax;

              return (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {index + 1}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {formatDate(c.date)}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">
                    {c.sdNo}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {c.executive}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {c.items.length}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center font-bold">
                    {totalQty}
                  </td>

                  {/* WITHOUT TAX */}
                  <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold text-slate-700">
                    {formatCurrency(withoutTax)}
                  </td>
                  {/* TAX */}
                  <td className="border-r border-slate-100 px-2 py-3 text-right text-slate-600">
                    {formatCurrency(tax)}
                  </td>

                  {/* TOTAL VALUE */}
                  <td className="px-2 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(totalValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {/* Create Stock Delivery — popup, same shell as Credit Note / Sales / Quotation */}
      {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="nb-modal-panel flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {/* Fixed header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Stock Delivery
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Issue products from store stock to a field executive.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="S.D No"
                    value={sdNo}
                    onChange={() => {}}
                    readOnly
                  />
                  <Input
                    label="S.D Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />
                  <Select
                    label="Executive"
                    value={executive}
                    onChange={setExecutive}
                    placeholder="Select executive"
                    options={executives.map((x) => ({ value: x, label: x }))}
                    required
                  />
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Product Details
                    </h4>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setItems((p) => [
                          ...p,
                          {
                            productId: "",
                            product: "",
                            packSize: "",
                            batchNo: "",
                            expiryDate: "",
                            qty: "",
                            unitValue: "",
                            taxPercent: 0,
                          },
                        ])
                      }
                    >
                      <Icon name="add" size={16} /> Add Product
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                          <th className="w-[6%] px-2 py-3 text-center">S.No</th>
                          <th className="w-[20%] px-2 py-3 text-left">
                            Product Name
                          </th>
                          <th className="w-[10%] px-2 py-3 text-center">
                            Pkg Size
                          </th>
                          <th className="w-[12%] px-2 py-3 text-center">
                            Batch ID
                          </th>
                          <th className="w-[12%] px-2 py-3 text-center">
                            Expiry Date
                          </th>
                          <th className="w-[9%] px-2 py-3 text-center">
                            Quantity
                          </th>
                          <th className="w-[12%] px-2 py-3 text-right">
                            Unit Value
                          </th>
                          <th className="w-[14%] px-2 py-3 text-right">
                            Approx Sale Value
                          </th>
                          <th className="w-[5%] px-2 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => {
                          const approx =
                            Number(item.qty || 0) * Number(item.unitValue || 0);
                          return (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-2 py-3 text-center">{i + 1}</td>
                              <td className="px-2 py-3">
                                <Select
                                  value={item.productId}
                                  onChange={(value) => selectProduct(i, value)}
                                  placeholder="Select product"
                                  options={storeProducts.map(
                                    (product: any) => ({
                                      value: product.id,
                                      label: product.name,
                                    }),
                                  )}
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Select
                                  value={item.packSize}
                                  onChange={(value) => selectPackSize(i, value)}
                                  placeholder="Select size"
                                  options={Array.from(
                                    new Set<string>(
                                      getProductVariants(item.productId)
                                        .map((v: any) =>
                                          String(v.packSize ?? ""),
                                        )
                                        .filter((size: string) =>
                                          Boolean(size),
                                        ),
                                    ),
                                  ).map((size: string) => ({
                                    value: size,
                                    label: size,
                                  }))}
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Select
                                  value={item.batchNo}
                                  onChange={(value) => selectBatch(i, value)}
                                  placeholder="Select batch"
                                  options={getProductVariants(item.productId)
                                    .filter(
                                      (v: any) =>
                                        String(v.packSize ?? "") ===
                                        item.packSize,
                                    )
                                    .map((v: any) => {
                                      const batch = String(v.batchNo ?? "");
                                      return { value: batch, label: batch };
                                    })}
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  value={item.expiryDate}
                                  onChange={() => {}}
                                  readOnly
                                  placeholder="Auto"
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.qty}
                                  onChange={(v) => {
                                    const maxQty =
                                      getProductVariants(item.productId).find(
                                        (variant: any) =>
                                          variant.packSize === item.packSize &&
                                          variant.batchNo === item.batchNo,
                                      )?.availableQty ?? 0;
                                    const nextQty = Math.max(0, Number(v || 0));
                                    updateItem(
                                      i,
                                      "qty",
                                      String(Math.min(nextQty, maxQty)),
                                    );
                                  }}
                                  placeholder="Qty"
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  value={item.unitValue}
                                  onChange={() => {}}
                                  readOnly
                                  placeholder="₹"
                                />
                              </td>
                              <td className="px-2 py-3 text-right font-bold">
                                {formatCurrency(approx)}
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={items.length === 1}
                                  onClick={() =>
                                    setItems((p) =>
                                      p.filter((_, idx) => idx !== i),
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

                  <div className="mt-4 ml-auto w-full max-w-md rounded-xl bg-slate-50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Quantity</span>
                      <span className="font-bold text-slate-800">
                        {totals.totalQty}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Without Tax</span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(totals.approxValue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tax</span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(totals.taxAmount)}
                      </span>
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

              {/* Fixed footer */}
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={createChallan} disabled={!canCreate}>
                  <Icon name="save" size={18} />
                  Create Stock Delivery
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selected &&
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

    .delivery-challan-print-area,
    .delivery-challan-print-area * {
      visibility: visible !important;
    }

    /* Backdrop */
    .purchase-modal-backdrop {
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
    .delivery-challan-print-area {
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

    .delivery-challan-print-area table {
      height: auto !important;
      min-height: 0 !important;
    }

    .delivery-challan-print-area tbody {
      height: auto !important;
      min-height: 0 !important;
    }

    .delivery-challan-print-area tbody tr {
      height: auto !important;
      min-height: 0 !important;
    }

    .delivery-challan-print-area tbody td {
      height: auto !important;
      min-height: 0 !important;
    }

    /* ================================
       FLEX HEIGHT FIX
       ================================ */

    .delivery-challan-print-area .flex-1 {
      flex: none !important;
    }

    .delivery-challan-print-area .h-full {
      height: auto !important;
    }

    .delivery-challan-print-area .min-h-full {
      min-height: 0 !important;
    }

    .delivery-challan-print-area [class*="min-h-"] {
      min-height: 0 !important;
    }

    /* ================================
       SCROLL CONTAINER
       ================================ */

    .delivery-challan-scroll {
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
      max-height: none !important;
      height: auto !important;
    }

    /* ================================
       TEXT
       ================================ */

    .delivery-challan-print-area h1,
    .delivery-challan-print-area h2,
    .delivery-challan-print-area h3,
    .delivery-challan-print-area p {
      overflow: visible !important;
    }

    .delivery-challan-print-area h1 {
      line-height: 1.4 !important;
      padding-top: 2px !important;
    }

    /* ================================
       TABLE PAGE BREAK
       ================================ */

    .delivery-challan-print-area table,
    .delivery-challan-print-area tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* ================================
       SCREEN ONLY
       ================================ */

    .delivery-challan-screen-only {
      display: none !important;
    }
  }
`}</style>

            <div className="delivery-challan-print-area nb-print-panel flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="delivery-challan-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Stock Delivery
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selected.sdNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="delivery-challan-scroll min-h-0 flex-1 overflow-y-auto p-3">
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
                          Stock Delivery
                        </h3>
                        {/* <p className="mt-1 text-[10px] text-slate-500">
                          Store Stock Issue to Executive
                        </p> */}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Dispatch Details
                      </p>
                      <p className="text-slate-600">
                        Executive:{" "}
                        <span className="font-semibold text-slate-800">
                          {selected.executive}
                        </span>
                      </p>
                    </div>

                    <div className="px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Stock Delivery Details
                      </p>
                      <div className="grid grid-cols-[95px_1fr] gap-y-0.5">
                        <span className="text-slate-500">S.D No</span>
                        <span className="font-semibold text-slate-800">
                          {selected.sdNo}
                        </span>
                        <span className="text-slate-500">Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selected.date)}
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
                          <th className="w-[18%] border-r border-slate-300 px-2 py-2 text-left">
                            Product
                          </th>
                          <th className="w-[9%] border-r border-slate-300 px-2 py-2 text-center">
                            Pkg Size
                          </th>
                          <th className="w-[12%] border-r border-slate-300 px-2 py-2 text-center">
                            Batch ID
                          </th>
                          <th className="w-[12%] border-r border-slate-300 px-2 py-2 text-center">
                            Expiry Date
                          </th>
                          <th className="w-[8%] border-r border-slate-300 px-2 py-2 text-center">
                            Qty
                          </th>
                          <th className="w-[12%] border-r border-slate-300 px-2 py-2 text-right">
                            Unit Value
                          </th>
                          <th className="w-[16%] px-2 py-2 text-right">
                            Approx Sale Value
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selected.items.map((item, index) => (
                          <tr
                            key={`${item.productId}-${index}`}
                            className="border-b border-slate-300"
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
                            <td className="border-r border-slate-300 px-2 py-2 text-center font-semibold">
                              {item.qty}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-2 text-right">
                              {formatCurrency(Number(item.unitValue || 0))}
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-slate-800">
                              {formatCurrency(
                                Number(item.qty || 0) *
                                  Number(item.unitValue || 0),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                      {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(
                          0,
                          MIN_ROWS - selected.items.length,
                        );
                        const columnCount = 8;

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

                      {/* ---- Bottom totals row ---- */}
                      <tfoot>
                        {(() => {
                          const items = selected.items;

                          const totalQty = items.reduce(
                            (sum, item) => sum + Number(item.qty || 0),
                            0,
                          );

                          const totalValue = items.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.qty || 0) *
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
                                {totalQty}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2" />
                              <td className="px-2 py-2 text-right">
                                {formatCurrency(totalValue)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {(() => {
                    const withoutTax = selected.items.reduce(
                      (sum: number, item: { qty: any; unitValue: any }) =>
                        sum +
                        Number(item.qty || 0) * Number(item.unitValue || 0),
                      0,
                    );
                    const tax = selected.items.reduce((sum, item) => {
                      const lineValue =
                        Number(item.qty || 0) * Number(item.unitValue || 0);
                      return (
                        sum + (lineValue * Number(item.taxPercent || 0)) / 100
                      );
                    }, 0);
                    const grandTotal = withoutTax + tax;
                    const roundedTotal = Math.round(grandTotal);
                    const roundOff = roundedTotal - grandTotal;

                    return (
                      <>
                        {/* ROW 1: Amount in Words (left) + Full breakdown / Round Off / Grand Total (right) */}
                        <div className="grid grid-cols-[1fr_320px] border-t border-slate-300">
                          <div className="flex flex-col justify-end flex items-left border-r border-slate-300 p-2.5">
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
                                {formatCurrency(tax)}
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
                              const defaultNotes = `Delivery challan issued by this store to ${selected?.executive ?? "the field executive"}.`;

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

              <div className="delivery-challan-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Stock Delivery
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
