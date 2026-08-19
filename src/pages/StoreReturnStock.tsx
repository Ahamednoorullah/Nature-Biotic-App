import { useEffect, useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  addStoreApprovalRequest,
  getStoreApprovalRequest,
  storeApprovalRequestsUpdatedEvent,
  stores,
} from "@/lib/data";

type ReturnItem = {
  id: string;
  product: string;
  packSize: string;
  quantity: number;
  price: number;
  reason: string;
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
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  reason: string;
  status: "Pending" | "Approved";
  items: ReturnItem[];
};

const productMaster = [
  {
    value: "Electra",
    label: "Electra",
    price: 250,
    tax: 12,
    taxType: "Intrastate",
  },
  { value: "Aalga", label: "Aalga", price: 380, tax: 5, taxType: "Intrastate" },
  {
    value: "Astra",
    label: "Astra",
    price: 560,
    tax: 18,
    taxType: "Intrastate",
  },
  {
    value: "Rootra",
    label: "Rootra",
    price: 420,
    tax: 5,
    taxType: "Intrastate",
  },
];

const packSizes = [
  { value: "100 ml", label: "100 ml" },
  { value: "250 ml", label: "250 ml" },
  { value: "500 ml", label: "500 ml" },
  { value: "1 L", label: "1 L" },
  { value: "100 g", label: "100 g" },
  { value: "250 g", label: "250 g" },
  { value: "500 g", label: "500 g" },
  { value: "1 Kg", label: "1 Kg" },
];

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
        quantity: 10,
        price: 250,
        reason: "Damaged Product",
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

  const selectedProduct = productMaster.find((p) => p.value === product);
  const price = selectedProduct?.price ?? 0;

  const computed = useMemo(() => {
    const qty = Number(quantity) || 0;
    const withoutTax = qty * price;

    if (!selectedProduct || qty <= 0) {
      return { withoutTax: 0, sgst: 0, cgst: 0, igst: 0, total: 0 };
    }

    if (selectedProduct.taxType === "Intrastate") {
      const tax = withoutTax * (selectedProduct.tax / 100);
      return {
        withoutTax,
        sgst: tax / 2,
        cgst: tax / 2,
        igst: 0,
        total: withoutTax + tax,
      };
    }

    const igst = withoutTax * (selectedProduct.tax / 100);
    return {
      withoutTax,
      sgst: 0,
      cgst: 0,
      igst,
      total: withoutTax + igst,
    };
  }, [quantity, price, selectedProduct]);

  const totals = useMemo(
    () => ({
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
    product && packSize && Number(quantity) > 0 && reason && price > 0;

  const canSave =
    date && returnNo.trim() && purchaseRef.trim() && added.length > 0;

  function addProduct() {
    if (!canAdd) return;

    const item: ReturnItem = {
      id: `${Date.now()}-${product}-${packSize}`,
      product,
      packSize,
      quantity: Number(quantity),
      price,
      reason,
      withoutTax: computed.withoutTax,
      sgst: computed.sgst,
      cgst: computed.cgst,
      igst: computed.igst,
      total: computed.total,
    };

    setAdded((prev) => [...prev, item]);
    setProduct("");
    setPackSize("");
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
    setPackSize("");
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

      {showCreate && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
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

                <Input
                  label="Purchase Invoice / Ref"
                  value={purchaseRef}
                  onChange={setPurchaseRef}
                  placeholder="e.g. NB-INV-2001"
                  required
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <Select
                    label="Product"
                    value={product}
                    onChange={setProduct}
                    placeholder="Select product"
                    options={productMaster.map((p) => ({
                      value: p.value,
                      label: p.label,
                    }))}
                  />

                  <Select
                    label="Pack Size"
                    value={packSize}
                    onChange={setPackSize}
                    placeholder="Select size"
                    options={packSizes}
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
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 md:grid-cols-5">
                    <MiniInfo
                      label="Without Tax"
                      value={formatCurrency(computed.withoutTax)}
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
                        <th className="w-[18%] px-3 py-3 text-left">Product</th>
                        <th className="w-[11%] px-2 py-3 text-center">Size</th>
                        <th className="w-[8%] px-2 py-3 text-center">Qty</th>
                        <th className="w-[10%] px-2 py-3 text-right">Price</th>
                        <th className="w-[13%] px-2 py-3 text-right">
                          Without Tax
                        </th>
                        <th className="w-[8%] px-2 py-3 text-right">SGST</th>
                        <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                        <th className="w-[8%] px-2 py-3 text-right">IGST</th>
                        <th className="w-[11%] px-2 py-3 text-right">Total</th>
                        <th className="w-[15%] px-2 py-3 text-left">Reason</th>
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
                            {item.quantity}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {formatCurrency(item.withoutTax)}
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
                    label="Without Tax"
                    value={formatCurrency(totals.withoutTax)}
                  />
                  <TotalRow label="SGST" value={formatCurrency(totals.sgst)} />
                  <TotalRow label="CGST" value={formatCurrency(totals.cgst)} />
                  <TotalRow label="IGST" value={formatCurrency(totals.igst)} />
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
        </div>
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
                  Return No
                </th>
                <th
                  rowSpan={2}
                  className="w-[12%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Purchase Ref
                </th>
                <th
                  rowSpan={2}
                  className="w-[11%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Supplier
                </th>
                <th
                  rowSpan={2}
                  className="w-[10%] border-r border-slate-200 px-2 py-3 text-center"
                >
                  Without Tax
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
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
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
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.purchaseRef}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.supplier}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right">
                    {formatCurrency(row.withoutTax)}
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

      {selectedReturn && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[90vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Purchase Return Details
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedReturn.returnNo} · {selectedReturn.purchaseRef}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <DetailBox
                  label="Return Date"
                  value={formatSimpleDate(selectedReturn.date)}
                />
                <DetailBox label="Return No" value={selectedReturn.returnNo} />
                <DetailBox
                  label="Purchase Ref"
                  value={selectedReturn.purchaseRef}
                />
                <DetailBox label="Supplier" value={selectedReturn.supplier} />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                      <th className="w-[20%] px-3 py-3 text-left">Product</th>
                      <th className="w-[11%] px-2 py-3 text-center">Size</th>
                      <th className="w-[8%] px-2 py-3 text-center">Qty</th>
                      <th className="w-[10%] px-2 py-3 text-right">Price</th>
                      <th className="w-[12%] px-2 py-3 text-right">
                        Without Tax
                      </th>
                      <th className="w-[8%] px-2 py-3 text-right">SGST</th>
                      <th className="w-[8%] px-2 py-3 text-right">CGST</th>
                      <th className="w-[8%] px-2 py-3 text-right">IGST</th>
                      <th className="w-[10%] px-2 py-3 text-right">Total</th>
                      <th className="w-[15%] px-2 py-3 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReturn.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 font-semibold">
                          {item.product}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {item.packSize}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {formatCurrency(item.withoutTax)}
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
                        <td className="px-2 py-3 text-slate-600">
                          {item.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
              <Button
                variant="secondary"
                onClick={() => setSelectedReturn(null)}
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
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
