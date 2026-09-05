import { useEffect, useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  addStoreApprovalRequest,
  getStoreApprovalRequest,
  storeApprovalRequestsUpdatedEvent,
  stores,
  getStorePurchasesFromCompanySales,
} from "@/lib/data";
import { createPortal } from "react-dom";

type ReturnItem = {
  id: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  soldQuantity: number;
  quantity: number;
  price: number;
  reason: string;
  beforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
};

type PurchaseReturnRow = {
  id: string;
  returnNo: string;
  date: string;
  purchaseRef: string;
  supplier: string;
  placeOfReturn: string;
  beforeDiscount: number;
  discountAmount: number;
  taxableAmount: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  reason: string;
  status: "Pending" | "Approved";
  items: ReturnItem[];
};

type PurchaseInvoiceItem = {
  id: string;
  invoiceNo: string;
  date: string;
  product: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  price: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  taxPercent: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
};

const reasons = [
  "Damaged Product",
  "Leaking / Broken Pack",
  "Expired / Near Expiry",
  "Wrong Product",
  "Wrong Quantity",
  "Quality Issue",
  "Other",
].map((value) => ({ value, label: value }));

const initialRows: PurchaseReturnRow[] = [
  {
    id: "pr-1",
    returnNo: "PR-0001",
    date: "2026-08-18",
    purchaseRef: "NB-INV-2001",
    supplier: "Nature Biotic",
    placeOfReturn: "Rajapalayam",
    beforeDiscount: 2500,
    discountAmount: 0,
    taxableAmount: 2500,
    withoutTax: 2500,
    sgst: 150,
    cgst: 150,
    igst: 0,
    total: 2800,
    reason: "Damaged Product",
    status: "Pending",
    items: [
      {
        id: "pr-1-item-1",
        product: "Electra",
        packSize: "250 ml",
        batchNo: "BAT-001",
        expiryDate: "2027-06-30",
        soldQuantity: 10,
        quantity: 10,
        price: 250,
        reason: "Damaged Product",
        beforeDiscount: 2500,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 2500,
        withoutTax: 2500,
        sgst: 150,
        cgst: 150,
        igst: 0,
        total: 2800,
      },
    ],
  },
];

export default function StoreReturnStock({ storeId }: { storeId: string }) {
  const storageKey = `naturebiotic:purchase-returns:${storeId}`;
  const [rows, setRows] = useState<PurchaseReturnRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as PurchaseReturnRow[]) : initialRows;
    } catch {
      return initialRows;
    }
  });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReturn, setSelectedReturn] =
    useState<PurchaseReturnRow | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch (error) {
      console.error("Failed to persist store data:", error);
    }
  }, [rows, storageKey]);

  useEffect(() => {
    const syncStatuses = () =>
      setRows((current) =>
        current.map((row) => {
          const request = getStoreApprovalRequest(
            "Purchase Return",
            storeId,
            row.returnNo,
          );
          return request?.status === "Approved"
            ? { ...row, status: "Approved" }
            : row;
        }),
      );
    syncStatuses();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, syncStatuses);
    return () =>
      window.removeEventListener(
        storeApprovalRequestsUpdatedEvent,
        syncStatuses,
      );
  }, [storeId]);

  const [date, setDate] = useState("");
  const [returnNo, setReturnNo] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [product, setProduct] = useState("");
  const [packSize, setPackSize] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [added, setAdded] = useState<ReturnItem[]>([]);

  const purchaseInvoices = useMemo<PurchaseInvoiceItem[]>(() => {
    const sourceRows = (getStorePurchasesFromCompanySales(storeId) || []) as any[];

    return sourceRows.map((row: any, index: number) => {
      const quantity = Number(row.quantity ?? row.qty ?? 0);
      const price = Number(
        row.sellingPrice ??
          row.price ??
          (quantity
            ? Number(row.beforeDiscount ?? row.withoutTax ?? 0) / quantity
            : 0),
      );

      const beforeDiscount = Number(
        row.beforeDiscount ?? price * quantity,
      );

      const discountPercent = Number(
        row.discountPercent ?? row.discount ?? 0,
      );

      const discountAmount = Number(
        row.discountAmount ??
          (beforeDiscount * discountPercent) / 100,
      );

      const taxableAmount = Number(
        row.taxableAmount ??
          row.withoutTax ??
          Math.max(0, beforeDiscount - discountAmount),
      );

      const taxPercent = Number(row.taxPercent ?? row.taxPercentage ?? 0);

      return {
        id: String(row.id ?? `${row.invoiceNo}-${index}`),
        invoiceNo: String(row.invoiceNo ?? row.purchaseRef ?? ""),
        date: String(row.date ?? ""),
        product: String(row.productName ?? row.product ?? "-"),
        packSize: String(
          row.packSize ?? row.pkgsize ?? row.size ?? row.unit ?? "-",
        ),
        batchNo: String(
          row.batchNo ?? row.batchId ?? row.batchID ?? "-",
        ),
        expiryDate: String(
          row.expiryDate ?? row.expDate ?? row.expiry ?? "",
        ),
        quantity,
        price,
        discountPercent,
        discountAmount,
        taxableAmount,
        taxPercent,
        sgst: Number(row.sgst ?? 0),
        cgst: Number(row.cgst ?? 0),
        igst: Number(row.igst ?? 0),
        total: Number(row.total ?? taxableAmount + Number(row.sgst ?? 0) + Number(row.cgst ?? 0) + Number(row.igst ?? 0)),
      };
    });
  }, [storeId]);

  const invoiceOptions = useMemo(() => {
    const unique = new Map<string, PurchaseInvoiceItem>();

    purchaseInvoices.forEach((item) => {
      if (item.invoiceNo && !unique.has(item.invoiceNo)) {
        unique.set(item.invoiceNo, item);
      }
    });

    return Array.from(unique.values()).map((item) => ({
      value: item.invoiceNo,
      label: `${item.invoiceNo}${item.date ? ` - ${formatSimpleDate(item.date)}` : ""}`,
    }));
  }, [purchaseInvoices]);

  const selectedInvoiceItems = useMemo(
    () =>
      purchaseRef
        ? purchaseInvoices.filter((item) => item.invoiceNo === purchaseRef)
        : [],
    [purchaseInvoices, purchaseRef],
  );

  const selectedInvoiceItem = selectedInvoiceItems.find(
    (item) => item.id === product,
  );

  const selectedProduct = selectedInvoiceItem;
  const price = selectedProduct?.price ?? 0;

  const computed = useMemo(() => {
    const qty = Number(quantity) || 0;

    if (!selectedProduct || qty <= 0) {
      return {
        beforeDiscount: 0,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 0,
        withoutTax: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        total: 0,
      };
    }

    const soldQty = Math.max(1, Number(selectedProduct.quantity || 0));
    const perUnitBeforeDiscount =
      (selectedProduct.price * soldQty) / soldQty;

    const beforeDiscount = perUnitBeforeDiscount * qty;
    const discountPercent = Number(selectedProduct.discountPercent || 0);
    const discountAmount =
      (beforeDiscount * discountPercent) / 100;
    const taxableAmount = Math.max(
      0,
      beforeDiscount - discountAmount,
    );
    const withoutTax = taxableAmount;

    const originalTaxable = Number(selectedProduct.taxableAmount || 0);

    const sgstRate =
      selectedProduct.sgst > 0 && originalTaxable > 0
        ? selectedProduct.sgst / originalTaxable
        : 0;
    const cgstRate =
      selectedProduct.cgst > 0 && originalTaxable > 0
        ? selectedProduct.cgst / originalTaxable
        : 0;
    const igstRate =
      selectedProduct.igst > 0 && originalTaxable > 0
        ? selectedProduct.igst / originalTaxable
        : 0;

    const sgst = taxableAmount * sgstRate;
    const cgst = taxableAmount * cgstRate;
    const igst = taxableAmount * igstRate;
    const total = taxableAmount + sgst + cgst + igst;

    return {
      beforeDiscount,
      discountPercent,
      discountAmount,
      taxableAmount,
      withoutTax,
      sgst,
      cgst,
      igst,
      total,
    };
  }, [quantity, selectedProduct]);


  const totals = useMemo(
    () => ({
      beforeDiscount: added.reduce((sum, item) => sum + item.beforeDiscount, 0),
      discountAmount: added.reduce((sum, item) => sum + item.discountAmount, 0),
      taxableAmount: added.reduce((sum, item) => sum + item.taxableAmount, 0),
      withoutTax: added.reduce((sum, item) => sum + item.withoutTax, 0),
      sgst: added.reduce((sum, item) => sum + item.sgst, 0),
      cgst: added.reduce((sum, item) => sum + item.cgst, 0),
      igst: added.reduce((sum, item) => sum + item.igst, 0),
      total: added.reduce((sum, item) => sum + item.total, 0),
      quantity: added.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [added],
  );

  const canAdd =
    !!selectedProduct &&
    Number(quantity) > 0 &&
    Number(quantity) <= Number(selectedProduct.quantity || 0) &&
    !!reason &&
    price > 0;

  const canSave =
    date && returnNo.trim() && purchaseRef.trim() && added.length > 0;

  function addProduct() {
    if (!canAdd) return;

    const item: ReturnItem = {
      id: `${Date.now()}-${selectedProduct.id}`,
      product: selectedProduct.product,
      packSize: selectedProduct.packSize,
      batchNo: selectedProduct.batchNo,
      expiryDate: selectedProduct.expiryDate,
      soldQuantity: selectedProduct.quantity,
      quantity: Number(quantity),
      price,
      reason,
      beforeDiscount: computed.beforeDiscount,
      discountPercent: computed.discountPercent,
      discountAmount: computed.discountAmount,
      taxableAmount: computed.taxableAmount,
      withoutTax: computed.withoutTax,
      sgst: computed.sgst,
      cgst: computed.cgst,
      igst: computed.igst,
      total: computed.total,
    };

    setAdded((prev) => [...prev, item]);
    setProduct("");
    setQuantity("");
    setReason("");
  }

  function removeProduct(id: string) {
    setAdded((prev) => prev.filter((item) => item.id !== id));
  }

  function resetForm() {
    setDate("");
    setReturnNo("");
    setPurchaseRef("");
    setProduct("");
    setQuantity("");
    setReason("");
    setAdded([]);
  }

  function saveReturn() {
    if (!canSave) return;

    const summaryReason = Array.from(
      new Set(added.map((item) => item.reason)),
    ).join(", ");

    const row: PurchaseReturnRow = {
      id: `pr-${Date.now()}`,
      returnNo: returnNo.trim(),
      date,
      purchaseRef: purchaseRef.trim(),
      supplier: "Nature Biotic",
      placeOfReturn: "Rajapalayam",
      beforeDiscount: totals.beforeDiscount,
      discountAmount: totals.discountAmount,
      taxableAmount: totals.taxableAmount,
      withoutTax: totals.withoutTax,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      total: totals.total,
      reason: summaryReason,
      status: "Pending",
      items: added,
    };

    setRows((prev) => [row, ...prev]);
    const store = stores.find((item) => item.id === storeId);
    addStoreApprovalRequest({
      id: `purchase-return-${storeId}-${row.returnNo}`,
      type: "Purchase Return",
      storeId,
      storeName: store?.name ?? storeId,
      date: row.date,
      referenceNo: row.returnNo,
      amount: row.total,
    });
    resetForm();
    setShowCreate(false);
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Purchase Return
          </h1>
          <p className="mt-1 text-slate-500">
            Return purchased products to Nature Biotic for damage, expiry, wrong
            supply or other valid reasons.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Create Purchase Return
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Total Returns"
          value={String(rows.length)}
          icon="assignment_return"
        />
        <SummaryCard
          label="Returned Qty"
          value={String(
            rows.reduce(
              (sum, row) =>
                sum +
                row.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
              0,
            ),
          )}
          icon="inventory_2"
        />
        <SummaryCard
          label="Return Value"
          value={formatCurrency(rows.reduce((sum, row) => sum + row.total, 0))}
          icon="payments"
        />
        <SummaryCard
          label="Pending"
          value={String(rows.filter((row) => row.status === "Pending").length)}
          icon="pending"
        />
      </div>

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[95vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 px-7 py-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Purchase Return
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select the purchase reference and add one or more products
                    being returned to Nature Biotic.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowCreate(false);
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-7">
                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Input
                    label="Return Date"
                    type="date"
                    value={date}
                    onChange={setDate}
                    required
                  />

                  <Input
                    label="Return No"
                    value={returnNo}
                    onChange={setReturnNo}
                    placeholder="e.g. PR-0002"
                    required
                  />

                  <Select
                    label="Purchase Invoice / Ref"
                    value={purchaseRef}
                    onChange={(value) => {
                      setPurchaseRef(value);
                      setProduct("");
                      setQuantity("");
                      setReason("");
                      setAdded([]);
                    }}
                    placeholder="Select invoice"
                    options={invoiceOptions}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8">
                    <Select
                      label="Product"
                      value={product}
                      onChange={(value) => {
                        setProduct(value);
                        setQuantity("");
                        setReason("");
                      }}
                      placeholder={
                        purchaseRef
                          ? "Select invoice product"
                          : "Select invoice first"
                      }
                      options={selectedInvoiceItems.map((item) => ({
                        value: item.id,
                        label: `${item.product} - ${item.packSize}`,
                      }))}
                    />

                    <Input
                      label="Pack Size"
                      value={selectedProduct?.packSize || ""}
                      onChange={() => {}}
                      placeholder="Auto"
                      readOnly
                    />

                    <Input
                      label="Batch ID"
                      value={selectedProduct?.batchNo || ""}
                      onChange={() => {}}
                      placeholder="Auto"
                      readOnly
                    />

                    <Input
                      label="Expiry Date"
                      value={
                        selectedProduct?.expiryDate
                          ? formatSimpleDate(selectedProduct.expiryDate)
                          : ""
                      }
                      onChange={() => {}}
                      placeholder="Auto"
                      readOnly
                    />

                    <Input
                      label="Return Qty"
                      type="number"
                      value={quantity}
                      onChange={setQuantity}
                      placeholder="Qty"
                    />

                    <Input
                      label="Price"
                      value={price ? String(price) : ""}
                      onChange={() => {}}
                      placeholder="Auto"
                      readOnly
                    />

                    <Select
                      label="Reason"
                      value={reason}
                      onChange={setReason}
                      placeholder="Select reason"
                      options={reasons}
                    />

                    <div className="flex items-end">
                      <Button
                        onClick={addProduct}
                        disabled={!canAdd}
                        className="w-full"
                      >
                        <Icon name="add" size={17} />
                        Add
                      </Button>
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 md:grid-cols-4 xl:grid-cols-10">
                      <MiniInfo
                        label="Sold Qty"
                        value={String(selectedProduct.quantity)}
                      />
                      <MiniInfo
                        label="Batch ID"
                        value={selectedProduct.batchNo || "-"}
                      />
                      <MiniInfo
                        label="Expiry"
                        value={
                          selectedProduct.expiryDate
                            ? formatSimpleDate(selectedProduct.expiryDate)
                            : "-"
                        }
                      />
                      <MiniInfo
                        label="Before Discount"
                        value={formatCurrency(computed.beforeDiscount)}
                      />
                      <MiniInfo
                        label="Discount"
                        value={`${computed.discountPercent.toFixed(2)}% / ${formatCurrency(
                          computed.discountAmount,
                        )}`}
                      />
                      <MiniInfo
                        label="Taxable"
                        value={formatCurrency(computed.taxableAmount)}
                      />
                      <MiniInfo
                        label="SGST"
                        value={formatCurrency(computed.sgst)}
                      />
                      <MiniInfo
                        label="CGST"
                        value={formatCurrency(computed.cgst)}
                      />
                      <MiniInfo
                        label="IGST"
                        value={formatCurrency(computed.igst)}
                      />
                      <MiniInfo
                        label="Total"
                        value={formatCurrency(computed.total)}
                      />
                    </div>
                  )}
                </div>

                {added.length > 0 && (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                          <th className="w-[18%] px-3 py-3 text-left">
                            Product
                          </th>
                          <th className="w-[9%] px-2 py-3 text-center">
                            Size
                          </th>
                          <th className="w-[9%] px-2 py-3 text-center">
                            Batch ID
                          </th>
                          <th className="w-[10%] px-2 py-3 text-center">
                            Expiry
                          </th>
                          <th className="w-[7%] px-2 py-3 text-center">Qty</th>
                          <th className="w-[9%] px-2 py-3 text-right">Price</th>
                          <th className="w-[11%] px-2 py-3 text-right">
                            Before Discount
                          </th>
                          <th className="w-[7%] px-2 py-3 text-center">
                            Disc %
                          </th>
                          <th className="w-[9%] px-2 py-3 text-right">
                            Disc Amt
                          </th>
                          <th className="w-[10%] px-2 py-3 text-right">
                            Taxable
                          </th>
                          <th className="w-[7%] px-2 py-3 text-right">SGST</th>
                          <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                          <th className="w-[8%] px-2 py-3 text-right">IGST</th>
                          <th className="w-[11%] px-2 py-3 text-right">
                            Total
                          </th>
                          <th className="w-[15%] px-2 py-3 text-left">
                            Reason
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {added.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-3 font-semibold text-slate-800">
                              {item.product}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {item.packSize}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {item.batchNo || "-"}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {item.expiryDate
                                ? formatSimpleDate(item.expiryDate)
                                : "-"}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {item.quantity}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(
                                Number(
                                  item.beforeDiscount ??
                                    Number(item.price || 0) *
                                      Number(item.quantity || 0),
                                ),
                              )}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {Number(item.discountPercent ?? 0).toFixed(2)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(
                                Number(
                                  item.discountAmount ??
                                    (Number(
                                      item.beforeDiscount ??
                                        Number(item.price || 0) *
                                          Number(item.quantity || 0),
                                    ) *
                                      Number(item.discountPercent ?? 0)) /
                                      100,
                                ),
                              )}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(
                                Number(
                                  item.taxableAmount ?? item.withoutTax ?? 0,
                                ),
                              )}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(item.sgst)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(item.cgst)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(item.igst)}
                            </td>
                            <td className="px-2 py-3 text-right font-bold">
                              {formatCurrency(item.total)}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-slate-600">
                                  {item.reason}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeProduct(item.id)}
                                  className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Icon name="delete" size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {added.length > 0 && (
                  <div className="mt-5 ml-auto w-full max-w-md rounded-xl bg-slate-50 p-4 text-sm">
                    <TotalRow
                      label="Return Qty"
                      value={String(totals.quantity)}
                    />
                    <TotalRow
                      label="Total Before Discount"
                      value={formatCurrency(totals.beforeDiscount)}
                    />
                    <TotalRow
                      label="Discount"
                      value={formatCurrency(totals.discountAmount)}
                    />
                    <TotalRow
                      label="Taxable Total"
                      value={formatCurrency(totals.taxableAmount)}
                    />
                    <TotalRow
                      label="SGST"
                      value={formatCurrency(totals.sgst)}
                    />
                    <TotalRow
                      label="CGST"
                      value={formatCurrency(totals.cgst)}
                    />
                    <TotalRow
                      label="IGST"
                      value={formatCurrency(totals.igst)}
                    />
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <TotalRow
                        label="Grand Total"
                        value={formatCurrency(totals.total)}
                        bold
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetForm();
                    setShowCreate(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveReturn} disabled={!canSave}>
                  <Icon name="save" size={17} />
                  Save Purchase Return
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Card className="overflow-hidden p-0">
        <div className="w-full">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <th
                  rowSpan={2}
                  className="w-[5%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  S.No
                </th>
                <th
                  rowSpan={2}
                  className="w-[9%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Date
                </th>
                <th
                  rowSpan={2}
                  className="w-[11%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  PR Number
                </th>
                {/* <th
                  rowSpan={2}
                  className="w-[12%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Purchase Ref
                </th> */}
                <th
                  rowSpan={2}
                  className="w-[11%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Supplier
                </th>
                <th
                  rowSpan={2}
                  className="w-[9%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Discount
                </th>
                <th
                  rowSpan={2}
                  className="w-[10%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Taxable
                </th>
                <th
                  colSpan={3}
                  className="w-[18%] border-r border-slate-200 px-2 py-2 text-center"
                >
                  Tax
                </th>
                <th
                  rowSpan={2}
                  className="w-[9%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Total
                </th>
                <th
                  rowSpan={2}
                  className="w-[10%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Reason
                </th>
                <th rowSpan={2} className="w-[7%] px-2 py-3 text-center">
                  Status
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="border-r border-slate-200 px-1 py-2 text-center">
                  SGST
                </th>
                <th className="border-r border-slate-200 px-1 py-2 text-center">
                  CGST
                </th>
                <th className="border-r border-slate-200 px-1 py-2 text-center">
                  IGST
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedReturn(row)}
                  className="cursor-pointer transition hover:bg-brand-50/40"
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {index + 1}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {formatSimpleDate(row.date)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">
                    {row.returnNo}
                  </td>
                  {/* <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.purchaseRef}
                  </td> */}
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.supplier}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.discountAmount || 0)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.taxableAmount ?? row.withoutTax)}
                  </td>
                  <td className="border-r border-slate-100 px-1 py-3 text-right">
                    {formatCurrency(row.sgst)}
                  </td>
                  <td className="border-r border-slate-100 px-1 py-3 text-right">
                    {formatCurrency(row.cgst)}
                  </td>
                  <td className="border-r border-slate-100 px-1 py-3 text-right">
                    {formatCurrency(row.igst)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right font-bold">
                    {formatCurrency(row.total)}
                  </td>
                  <td className="truncate border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {row.reason}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        row.status === "Approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedReturn &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 6mm;
                }

                body * {
                  visibility: hidden !important;
                }

                .purchase-return-print-area,
                .purchase-return-print-area * {
                  visibility: visible !important;
                }

                .purchase-return-print-area {
                  position: absolute !important;
                  inset: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: white !important;
                }

                .purchase-return-screen-only {
                  display: none !important;
                }

                .purchase-return-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }

                .purchase-return-table {
                  width: 100% !important;
                  font-size: 8px !important;
                }

                .purchase-return-table th,
                .purchase-return-table td {
                  padding: 3px 4px !important;
                }
              }
            `}</style>

            <div className="purchase-return-print-area flex max-h-[94vh] w-[98vw] max-w-[1450px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="purchase-return-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Purchase Return
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectedReturn.returnNo}
                  </h2>

                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      selectedReturn.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectedReturn.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="purchase-return-scroll min-h-0 flex-1 overflow-y-auto p-3">
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
                            NATURE BIOTIC
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                            4/130/A1, Velavan Nagar, Velayudhampuram,
                            Rajapalayam, Tamil Nadu - 626102
                          </p>
                          <p className="text-[10px] text-slate-600">
                            GSTIN: 33AEZPV5328P1ZC
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Cell: 96008 44446
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center px-4 py-3">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Purchase Return
                        </h3>
                        {/* <p className="mt-1 text-[10px] text-slate-500">
                          Store to Nature Biotic
                        </p> */}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Returned By
                      </p>
                      <p className="font-bold text-slate-900">
                        {stores.find((store) => store.id === storeId)?.name ||
                          storeId}
                      </p>
                      <p className="text-slate-600">
                        {stores.find((store) => store.id === storeId)
                          ?.address ||
                          stores.find((store) => store.id === storeId)
                            ?.location ||
                          "-"}
                      </p>
                      <p className="text-slate-600">
                        GSTIN:{" "}
                        {stores.find((store) => store.id === storeId)?.gst ||
                          "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Supplier
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedReturn.supplier}
                      </p>
                      <p className="text-slate-600">
                        Rajapalayam, Tamil Nadu - 626108
                      </p>
                      <p className="text-slate-600">GSTIN: 33AEZPV5328P1ZC</p>
                    </div>

                    <div className="px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Return Details
                      </p>

                      <div className="grid grid-cols-[105px_1fr] gap-y-0.5">
                        <span className="text-slate-500">Return No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedReturn.returnNo}
                        </span>

                        <span className="text-slate-500">Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatSimpleDate(selectedReturn.date)}
                        </span>

                        {/* <span className="text-slate-500">Purchase Ref</span>
                        <span className="font-semibold text-slate-800">
                          {selectedReturn.purchaseRef}
                        </span> */}

                        <span className="text-slate-500">Status</span>
                        <span className="font-semibold text-slate-800">
                          {selectedReturn.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="purchase-return-table w-full table-fixed border-collapse text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                          <th
                            rowSpan={2}
                            className="w-[4%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[15%] border-r border-slate-300 px-2 py-2 text-left"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[7%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Size
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[8%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Batch ID
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[9%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Expiry Date
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[5%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Qty
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[8%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Price
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[9%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Before Discount
                          </th>
                          <th
                            colSpan={2}
                            className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Discount
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[9%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Taxable
                          </th>

                          <th
                            colSpan={2}
                            className="w-[10%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            SGST
                          </th>
                          <th
                            colSpan={2}
                            className="w-[10%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            className="w-[10%] border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            IGST
                          </th>

                          <th
                            rowSpan={2}
                            className="w-[10%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Line Total
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[12%] px-2 py-2 text-left"
                          >
                            Reason
                          </th>
                        </tr>

                        <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">
                            Amt
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedReturn.items.map((item, index) => {
                          const sgstRate =
                            item.sgst > 0 && item.withoutTax > 0
                              ? (item.sgst / item.withoutTax) * 100
                              : 0;
                          const cgstRate =
                            item.cgst > 0 && item.withoutTax > 0
                              ? (item.cgst / item.withoutTax) * 100
                              : 0;
                          const igstRate =
                            item.igst > 0 && item.withoutTax > 0
                              ? (item.igst / item.withoutTax) * 100
                              : 0;

                          return (
                            <tr
                              key={item.id}
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
                                  ? formatSimpleDate(item.expiryDate)
                                  : "-"}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center">
                                {item.quantity}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(item.price)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold">
                                {formatCurrency(
                                  Number(
                                    item.beforeDiscount ??
                                      Number(item.price || 0) *
                                        Number(item.quantity || 0),
                                  ),
                                )}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {Number(item.discountPercent ?? 0).toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(
                                  Number(
                                    item.discountAmount ??
                                      (Number(
                                        item.beforeDiscount ??
                                          Number(item.price || 0) *
                                            Number(item.quantity || 0),
                                      ) *
                                        Number(item.discountPercent ?? 0)) /
                                        100,
                                  ),
                                )}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold">
                                {formatCurrency(
                                  Number(
                                    item.taxableAmount ?? item.withoutTax ?? 0,
                                  ),
                                )}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {sgstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(item.sgst)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {cgstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(item.cgst)}
                              </td>

                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {igstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(item.igst)}
                              </td>

                              <td className="border-r border-slate-300 px-2 py-2 text-right font-bold text-slate-800">
                                {formatCurrency(item.total)}
                              </td>
                              <td className="px-2 py-2 text-slate-600">
                                {item.reason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                        {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(0, MIN_ROWS - selectedReturn.items.length);
                        const columnCount = 19;

                        return Array.from({ length: fillerCount }).map((_, i) => (
                          <tr key={`filler-${i}`}>
                            {Array.from({ length: columnCount }).map((_, colIdx) => (
                              <td
                                key={colIdx}
                                className={`px-1 py-1.5 ${
                                  colIdx < columnCount - 1 ? "border-r border-slate-300" : ""
                                }`}
                              >
                                &nbsp;
                              </td>
                            ))}
                          </tr>
                        ));
                      })()}

                      {/* ---- Bottom totals row ---- */}
                      <tfoot>
                        {(() => {
                          const items = selectedReturn.items;
                          const totalQty = items.reduce(
                            (s, r) => s + Number(r.quantity || 0), 0,
                          );
                          const totalBeforeDiscount = items.reduce(
                            (s, r) =>
                              s +
                              Number(
                                r.beforeDiscount ??
                                  Number(r.price || 0) * Number(r.quantity || 0),
                              ),
                            0,
                          );
                          const totalDiscountAmt = items.reduce(
                            (s, r) =>
                              s +
                              Number(
                                r.discountAmount ??
                                  (Number(
                                    r.beforeDiscount ??
                                      Number(r.price || 0) * Number(r.quantity || 0),
                                  ) *
                                    Number(r.discountPercent ?? 0)) /
                                    100,
                              ),
                            0,
                          );
                          const totalTaxable = items.reduce(
                            (s, r) =>
                              s + Number(r.taxableAmount ?? r.withoutTax ?? 0),
                            0,
                          );
                          const totalSgst = items.reduce(
                            (s, r) => s + Number(r.sgst || 0), 0,
                          );
                          const totalCgst = items.reduce(
                            (s, r) => s + Number(r.cgst || 0), 0,
                          );
                          const totalIgst = items.reduce(
                            (s, r) => s + Number(r.igst || 0), 0,
                          );
                          const totalLine = items.reduce(
                            (s, r) => s + Number(r.total || 0), 0,
                          );

                          return (
                            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                              <td colSpan={5} className="border-r border-slate-300 p-2 text-center">
                                Total
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {totalQty}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalBeforeDiscount)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalDiscountAmt)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalTaxable)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalSgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalCgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalIgst)}
                              </td>
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalLine)}
                              </td>
                              <td className="p-2" />
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                {/* ROW 1: Amount in Words (left) + Round Off / Grand Total (right) */}
                  <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-2.5 flex items-center">
                      {(() => {
                        const grandTotal = selectedReturn.items.reduce(
                          (sum, row) => sum + Number(row.total || 0),
                          0,
                        );

                        const roundedTotal = Math.round(grandTotal);

                        return (
                          <p className="text-[10px] font-semibold text-slate-700">
                            Amount in Words :{" "}
                            <span className="font-bold text-slate-900">
                              {numberToWords(roundedTotal)}
                            </span>
                          </p>
                        );
                      })()}
                    </div>

                    <div className="space-y-1 p-2.5 text-[11px]">
                      <Summary
                        label="Round Off"
                        value={formatCurrency(
                          selectedReturn.items.reduce(
                            (sum, row) => sum + Number(row.total || 0),
                            0,
                          ) -
                            selectedReturn.items.reduce(
                              (sum, row) =>
                                sum +
                                Number(row.withoutTax || 0) +
                                Number(row.sgst || 0) +
                                Number(row.cgst || 0) +
                                Number(row.igst || 0),
                              0,
                            ),
                        )}
                        muted
                      />

                      <div className="border-t border-slate-300 pt-1.5">
                      <Summary
                        label="Grand Total"
                        value={formatCurrency(
                          selectedReturn.items.reduce(
                            (sum, row) => sum + Number(row.total || 0),
                            0,
                          ),
                        )}
                        bold
                      />
                    </div>
                    </div>
                  </div>

                  {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                  <div className="grid min-h-[110px] grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="flex flex-col justify-end border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Purchase order raised by{" "}
                        {storeId || "this store"} to Nature Biotic.
                      </p>
                    </div>

                    <div className="flex items-end justify-center p-3">
                      <div className="w-full text-center">
                        <div className="border-b border-slate-300" />
                        <p className="mt-1.5 text-xs font-semibold text-slate-500">
                          Authorised Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                </div>                  
              </div>

              <div className="purchase-return-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedReturn(null)}
                >
                  Close
                </Button>

                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Purchase Return
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon name={icon} size={19} />
        </div>
      </div>
    </Card>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          bold ? "font-bold text-slate-800" : "font-semibold text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Summary({
  label,
  value,
  muted = false,
  bold = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-700"}>
        {label}
      </span>
      <span
        className={
          bold
            ? "font-bold text-slate-900"
            : muted
              ? "font-medium text-slate-600"
              : "font-semibold text-slate-800"
        }
      >
        {value}
      </span>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
  );
}

function formatSimpleDate(value: string) {
  if (!value) return "-";

  const [yyyy, mm, dd] = value.split("-");
  if (!yyyy || !mm || !dd) return value;

  return `${dd}/${mm}/${yyyy.slice(-2)}`;
}
