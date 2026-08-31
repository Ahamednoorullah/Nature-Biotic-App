import { useEffect, useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import {
  addStoreApprovalRequest,
  getStoreApprovalRequest,
  storeApprovalRequestsUpdatedEvent,
  stores,
  getProductMaster,
  productMasterUpdatedEvent,
  type Product,
} from "@/lib/data";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/format";

type AddedProduct = {
  amount: any;
  taxableAmount: any;
  discountAmount: number;
  sellingPrice: number;
  id: string;
  productId?: string;
  product: string;
  hsnCode?: string;
  unit?: string;
  packSize: string;
  quantity: number;
  price: number;
  taxPercent?: number;
  taxType?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
};

type PurchaseOrderRow = {
  id: string;
  poNo: string;
  date: string;
  totalProduct: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  status: "Pending" | "Approved";
  items: AddedProduct[];
};

const initialRows: PurchaseOrderRow[] = [
  {
    id: "po1",
    poNo: "SAI-PO-0001",
    date: "2026-08-18",
    totalProduct: 20,
    withoutTax: 5000,
    sgst: 20,
    cgst: 20,
    igst: 0,
    total: 5040,
    status: "Pending",
    items: [],
  },
  {
    id: "po2",
    poNo: "SAI-PO-0002",
    date: "2026-08-19",
    totalProduct: 50,
    withoutTax: 8000,
    sgst: 0,
    cgst: 0,
    igst: 460,
    total: 8460,
    status: "Approved",
    items: [],
  },
];

export default function StorePurchaseOrder({ storeId }: { storeId: string }) {
  const storageKey = `naturebiotic:purchase-orders:${storeId}`;
  const [rows, setRows] = useState<PurchaseOrderRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as PurchaseOrderRow[]) : initialRows;
    } catch {
      return initialRows;
    }
  });
  const [productMaster, setProductMaster] = useState<Product[]>(() =>
    getProductMaster(),
  );
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState("");
  const [poNo, setPoNo] = useState("");
  const [product, setProduct] = useState("");
  const [packSize, setPackSize] = useState("");
  const [quantity, setQuantity] = useState("");
  const [added, setAdded] = useState<AddedProduct[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRow | null>(
    null,
  );

  useEffect(() => {
    const syncProductMaster = () => {
      setProductMaster(getProductMaster());
    };

    syncProductMaster();
    window.addEventListener(productMasterUpdatedEvent, syncProductMaster);
    window.addEventListener("focus", syncProductMaster);

    return () => {
      window.removeEventListener(productMasterUpdatedEvent, syncProductMaster);
      window.removeEventListener("focus", syncProductMaster);
    };
  }, []);

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
            "Purchase Order",
            storeId,
            row.poNo,
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

  const selectedProduct = productMaster.find((p) => p.id === product);
  const price = selectedProduct?.sellingPrice ?? 0;
  const currentStore = stores.find((item) => item.id === storeId);

  const isTamilNaduStore = useMemo(() => {
    const locationText =
      `${currentStore?.location ?? ""} ${currentStore?.address ?? ""}`.toLowerCase();

    return (
      locationText.includes("tamil nadu") ||
      locationText.includes("rajapalayam") ||
      locationText.includes("tenkasi") ||
      locationText.includes("virudhunagar")
    );
  }, [currentStore]);

  const productChoices = useMemo(() => {
    const byName = new Map<string, Product>();

    productMaster
      .filter((item) => item.status === "Active")
      .forEach((item) => {
        if (!byName.has(item.name)) byName.set(item.name, item);
      });

    return Array.from(byName.values());
  }, [productMaster]);

  const selectedProductVariants = useMemo(() => {
    if (!selectedProduct) return [];

    return productMaster.filter(
      (item) =>
        item.name === selectedProduct.name &&
        item.unit === selectedProduct.unit &&
        item.status === "Active",
    );
  }, [productMaster, selectedProduct]);

  const availablePackSizes = selectedProductVariants.map(
    (variant) => variant.size,
  );

  const computed = useMemo(() => {
    const qty = Number(quantity) || 0;
    const withoutTax = qty * price;

    if (!selectedProduct || qty <= 0) {
      return {
        withoutTax: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        total: 0,
      };
    }

    const taxPercent = Number(selectedProduct.taxPercentage || 0);
    const totalTax = Math.round(withoutTax * (taxPercent / 100) * 100) / 100;

    if (isTamilNaduStore) {
      const halfTax = Math.round((totalTax / 2) * 100) / 100;

      return {
        withoutTax,
        sgst: halfTax,
        cgst: totalTax - halfTax,
        igst: 0,
        total: withoutTax + totalTax,
      };
    }

    return {
      withoutTax,
      sgst: 0,
      cgst: 0,
      igst: totalTax,
      total: withoutTax + totalTax,
    };
  }, [quantity, price, selectedProduct, isTamilNaduStore]);

  const totals = useMemo(
    () => ({
      totalProduct: added.reduce((sum, item) => sum + item.quantity, 0),
      withoutTax: added.reduce((sum, item) => sum + item.withoutTax, 0),
      sgst: added.reduce((sum, item) => sum + item.sgst, 0),
      cgst: added.reduce((sum, item) => sum + item.cgst, 0),
      igst: added.reduce((sum, item) => sum + item.igst, 0),
      total: added.reduce((sum, item) => sum + item.total, 0),
    }),
    [added],
  );

  const canAdd =
    !!selectedProduct && !!packSize && Number(quantity) > 0 && price > 0;
  const canSave = date && poNo.trim() && added.length > 0;

  function changeProduct(value: string) {
    const baseProduct = productMaster.find((item) => item.id === value);

    setProduct(baseProduct?.id ?? "");
    setPackSize(baseProduct?.size ?? "");
  }

  function changePackSize(value: string) {
    if (!selectedProduct) {
      setPackSize(value);
      return;
    }

    const variant = productMaster.find(
      (item) =>
        item.name === selectedProduct.name &&
        item.unit === selectedProduct.unit &&
        item.size === value &&
        item.status === "Active",
    );

    if (variant) setProduct(variant.id);
    setPackSize(value);
  }

  function addProduct() {
    if (!canAdd || !selectedProduct) return;

    setAdded((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${selectedProduct.id}-${packSize}`,
        productId: selectedProduct.id,
        product: selectedProduct.name,
        hsnCode: selectedProduct.hsnCode,
        unit: selectedProduct.unit,
        packSize: selectedProduct.size || packSize,
        quantity: Number(quantity),
        price: selectedProduct.sellingPrice,
        sellingPrice: selectedProduct.sellingPrice,
        taxPercent: selectedProduct.taxPercentage,
        taxType: isTamilNaduStore ? "Intrastate" : "Interstate",
        withoutTax: computed.withoutTax,
        sgst: computed.sgst,
        cgst: computed.cgst,
        igst: computed.igst,
        total: computed.total,
        amount: computed.total,
        taxableAmount: computed.withoutTax,
        discountAmount: 0,
      },
    ]);

    setProduct("");
    setPackSize("");
    setQuantity("");
  }

  function removeProduct(id: string) {
    setAdded((prev) => prev.filter((item) => item.id !== id));
  }

  function resetForm() {
    setDate("");
    setPoNo("");
    setProduct("");
    setPackSize("");
    setQuantity("");
    setAdded([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function saveOrder() {
    if (!canSave) return;
    const newRow: PurchaseOrderRow = {
      id: `po-${Date.now()}`,
      poNo: poNo.trim(),
      date,
      totalProduct: totals.totalProduct,
      withoutTax: totals.withoutTax,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      total: totals.total,
      status: "Pending",
      items: added,
    };
    setRows((prev) => [newRow, ...prev]);
    const store = stores.find((item) => item.id === storeId);
    addStoreApprovalRequest({
      id: `purchase-order-${storeId}-${newRow.poNo}`,
      type: "Purchase Order",
      storeId,
      storeName: store?.name ?? storeId,
      date: newRow.date,
      referenceNo: newRow.poNo,
      amount: newRow.total,
    });
    resetForm();
    setShowCreate(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Purchase Order
          </h1>
          <p className="mt-1 text-slate-500">
            Create and track purchase orders raised by this store.
          </p>
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Icon name="add" size={18} />
          Create PO
        </Button>
      </div>

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Purchase Order
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add one or multiple products to this purchase order.
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

              <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-6">
                <div className="p-6">
                  <div className="mb-5 grid gap-4 md:grid-cols-2">
                    <Input
                      label="Date"
                      type="date"
                      value={date}
                      onChange={setDate}
                      required
                    />
                    <Input
                      label="PO No"
                      value={poNo}
                      onChange={setPoNo}
                      placeholder="e.g. SAI-PO-0003"
                      required
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Select
                        label="Product"
                        value={product}
                        onChange={changeProduct}
                        placeholder={
                          productMaster.length
                            ? "Select product"
                            : "No products in Product Management"
                        }
                        options={productChoices.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))}
                      />
                      <Select
                        label="Pack Size"
                        value={packSize}
                        onChange={changePackSize}
                        placeholder={
                          selectedProduct
                            ? `Select ${selectedProduct.unit} size`
                            : "Select product first"
                        }
                        options={availablePackSizes.map((size) => ({
                          value: size,
                          label: `${size} (${selectedProduct?.unit ?? ""})`,
                        }))}
                      />
                      <Input
                        label="Qty"
                        type="number"
                        value={quantity}
                        onChange={setQuantity}
                        placeholder="Enter qty"
                      />
                      <Input
                        label="Price"
                        value={price ? String(price) : ""}
                        onChange={() => {}}
                        placeholder="Auto"
                        readOnly
                      />
                      <div className="flex items-end">
                        <Button
                          onClick={addProduct}
                          disabled={!canAdd}
                          className="w-full"
                        >
                          <Icon name="add" size={17} />
                          Add Product
                        </Button>
                      </div>
                    </div>

                    {selectedProduct && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm md:grid-cols-4 xl:grid-cols-8">
                        <MiniInfo
                          label="HSN Code"
                          value={selectedProduct.hsnCode || "-"}
                        />
                        <MiniInfo
                          label="Unit"
                          value={selectedProduct.unit || "-"}
                        />
                        <MiniInfo
                          label="GST %"
                          value={`${selectedProduct.taxPercentage}%`}
                        />
                        <MiniInfo
                          label="GST Applied"
                          value={
                            isTamilNaduStore
                              ? `SGST ${selectedProduct.taxPercentage / 2}% + CGST ${selectedProduct.taxPercentage / 2}%`
                              : `IGST ${selectedProduct.taxPercentage}%`
                          }
                        />
                        <MiniInfo
                          label="Without Tax"
                          value={formatMoney(computed.withoutTax)}
                        />
                        <MiniInfo
                          label="SGST"
                          value={formatMoney(computed.sgst)}
                        />
                        <MiniInfo
                          label="CGST"
                          value={formatMoney(computed.cgst)}
                        />
                        <MiniInfo
                          label="IGST"
                          value={formatMoney(computed.igst)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {added.length > 0 && (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                          <th className="w-[15%] px-3 py-3 text-left">
                            Product
                          </th>
                          <th className="w-[9%] px-2 py-3 text-center">HSN</th>
                          <th className="w-[10%] px-3 py-3 text-left">
                            Pack Size
                          </th>
                          <th className="w-[8%] px-2 py-3 text-center">Qty</th>
                          <th className="w-[10%] px-2 py-3 text-right">
                            Price
                          </th>
                          <th className="w-[12%] px-2 py-3 text-right">
                            Without Tax
                          </th>
                          <th className="w-[9%] px-2 py-3 text-right">SGST</th>
                          <th className="w-[9%] px-2 py-3 text-right">CGST</th>
                          <th className="w-[9%] px-2 py-3 text-right">IGST</th>
                          <th className="w-[11%] px-2 py-3 text-right">
                            Total
                          </th>
                          <th className="w-[6%] px-2 py-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {added.map((item) => (
                          <tr key={item.id}>
                            <td className="truncate px-3 py-3 font-semibold text-slate-700">
                              {item.product}
                            </td>
                            <td className="px-2 py-3 text-center text-slate-600">
                              {item.hsnCode || "-"}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              {item.packSize}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {item.quantity}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatMoney(item.price)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatMoney(item.withoutTax)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatMoney(item.sgst)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatMoney(item.cgst)}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatMoney(item.igst)}
                            </td>
                            <td className="px-2 py-3 text-right font-bold">
                              {formatMoney(item.total)}
                            </td>
                            <td className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeProduct(item.id)}
                                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Icon name="delete" size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {added.length > 0 && (
                  <div className="mt-4 ml-auto w-full max-w-md rounded-xl bg-slate-50 p-4 text-sm">
                    <Summary
                      label="Total Product"
                      value={String(totals.totalProduct)}
                    />
                    <Summary
                      label="Without Tax"
                      value={formatMoney(totals.withoutTax)}
                    />
                    <Summary label="SGST" value={formatMoney(totals.sgst)} />
                    <Summary label="CGST" value={formatMoney(totals.cgst)} />
                    <Summary label="IGST" value={formatMoney(totals.igst)} />
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <Summary
                        label="Total"
                        value={formatMoney(totals.total)}
                        bold
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={saveOrder} disabled={!canSave}>
                  <Icon name="save" size={17} />
                  Save Purchase Order
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
              <th
                rowSpan={2}
                className="w-[5%] border-r border-slate-300 px-2 py-2 text-center"
              >
                S.No
              </th>
              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-300 px-2 py-2 text-center"
              >
                Date
              </th>
              <th
                rowSpan={2}
                className="w-[12%] border-r border-slate-300 px-2 py-2 text-center"
              >
                PO No
              </th>
              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-300 px-2 py-2 text-center"
              >
                Total Product
              </th>
              
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-300 px-2 py-2 text-center"
              >
                Without Tax
              </th>

              <th
                colSpan={2}
                className="w-[12%] border-r border-slate-300 px-1 py-2 text-center"
              >
                SGST
              </th>
              <th
                colSpan={2}
                className="w-[12%] border-r border-slate-300 px-1 py-2 text-center"
              >
                CGST
              </th>
              <th
                colSpan={2}
                className="w-[12%] border-r border-slate-300 px-1 py-2 text-center"
              >
                IGST
              </th>

              <th
                rowSpan={2}
                className="w-[10%] border-r border-slate-300 px-2 py-2 text-center"
              >
                Total
              </th>
              <th rowSpan={2} className="w-[8%] px-2 py-2 text-center">
                Status
              </th>
            </tr>

            <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
              <th className="border-r border-slate-300 px-1 py-1.5 text-center">
                %
              </th>
              <th className="border-r border-slate-300 px-1 py-1.5 text-center">
                Amt
              </th>
              <th className="border-r border-slate-300 px-1 py-1.5 text-center">
                %
              </th>
              <th className="border-r border-slate-300 px-1 py-1.5 text-center">
                Amt
              </th>
              <th className="border-r border-slate-300 px-1 py-1.5 text-center">
                %
              </th>
              <th className="border-r border-slate-300 px-1 py-1.5 text-center">
                Amt
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => setSelectedOrder(row)}
                className="cursor-pointer border-b border-slate-200 transition hover:bg-brand-50/50"
              >
                <td className="border-r border-slate-200 px-2 py-3 text-center">
                  {index + 1}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-center">
                  {formatDate(row.date)}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  {row.poNo}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-center">
                  {row.totalProduct}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-right">
                  {formatMoney(row.withoutTax)}
                </td>
                <td className="border-r border-slate-200 px-1 py-3 text-center text-slate-600">
                  {row.sgst > 0 && row.withoutTax > 0
                    ? `${((row.sgst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-right">
                  {formatMoney(row.sgst)}
                </td>

                <td className="border-r border-slate-200 px-1 py-3 text-center text-slate-600">
                  {row.cgst > 0 && row.withoutTax > 0
                    ? `${((row.cgst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-right">
                  {formatMoney(row.cgst)}
                </td>

                <td className="border-r border-slate-200 px-1 py-3 text-center text-slate-600">
                  {row.igst > 0 && row.withoutTax > 0
                    ? `${((row.igst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-right">
                  {formatMoney(row.igst)}
                </td>
                <td className="border-r border-slate-200 px-2 py-3 text-right font-bold">
                  {formatMoney(row.total)}
                </td>
                <td className="px-2 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "Approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selectedOrder &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 6mm;
                }

                body * {
                  visibility: hidden !important;
                }

                .store-po-print-area,
                .store-po-print-area * {
                  visibility: visible !important;
                }

                .store-po-print-area {
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

                .store-po-screen-only {
                  display: none !important;
                }

                .store-po-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }

                .store-po-table {
                  width: 100% !important;
                  font-size: 7.5px !important;
                }

                .store-po-table th,
                .store-po-table td {
                  padding: 3px 4px !important;
                }
              }
            `}</style>

            <div className="store-po-print-area flex max-h-[94vh] w-[98vw] max-w-[1450px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="store-po-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Purchase Order
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedOrder.poNo}
                  </h2>
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      selectedOrder.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="store-po-scroll min-h-0 flex-1 overflow-y-auto p-3">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 p-4">
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

                    <div className="flex items-center justify-center p-4">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Purchase Order
                        </h3>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Store to Nature Biotic
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Ordered By
                      </p>
                      <p className="font-bold text-slate-900">
                        {currentStore?.name || storeId}
                      </p>
                      <p className="text-slate-600">
                        {currentStore?.address || currentStore?.location || "-"}
                      </p>
                      <p className="text-slate-600">
                        GSTIN: {currentStore?.gst || "-"}
                      </p>
                      <p className="text-slate-600">
                        Contact: {currentStore?.phone || "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Supplier
                      </p>
                      <p className="font-bold text-slate-900">Nature Biotic</p>
                      <p className="text-slate-600">
                        Rajapalayam, Tamil Nadu - 626102
                      </p>
                      <p className="text-slate-600">GSTIN: 33AEZPV5328P1ZC</p>
                    </div>

                    <div className="p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Purchase Order Details
                      </p>

                      <div className="grid grid-cols-[90px_1fr] gap-y-0.5">
                        <span className="text-slate-500">PO No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedOrder.poNo}
                        </span>

                        <span className="text-slate-500">PO Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selectedOrder.date)}
                        </span>

                        <span className="text-slate-500">Store</span>
                        <span className="font-semibold text-slate-800">
                          {currentStore?.name || storeId}
                        </span>

                        <span className="text-slate-500">Status</span>
                        <span className="font-semibold text-slate-800">
                          {selectedOrder.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="store-po-table w-full table-fixed border-collapse text-[9px]">
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
                            className="w-[12%] border-r border-slate-300 px-2 py-2 text-left"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[5%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            HSN
                          </th>
                          <th
                            rowSpan={2}
                            className="w-[6%] border-r border-slate-300 px-2 py-2 text-center"
                          >
                            Pkg Size
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
                            className="w-[10%] border-r border-slate-300 px-2 py-2 text-right"
                          >
                            Without Tax
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
                            className="w-[10%] px-2 py-2 text-right"
                          >
                            Line Total
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
                        </tr>
                      </thead>

                      <tbody>
                        {selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, index) => {
                            const itemTaxPercent = Number(item.taxPercent || 0);
                            const sgstRate =
                              item.sgst > 0 ? itemTaxPercent / 2 : 0;
                            const cgstRate =
                              item.cgst > 0 ? itemTaxPercent / 2 : 0;
                            const igstRate = item.igst > 0 ? itemTaxPercent : 0;

                            return (
                              <tr
                                key={item.id}
                                className="border-b border-slate-300"
                              >
                                <td className="border-r border-slate-300 px-2 py-2 text-center">
                                  {index + 1}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                                  {item.product}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-center">
                                  {item.hsnCode || "-"}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-center">
                                  {item.packSize}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-center">
                                  {item.quantity}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatMoney(item.price)}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold">
                                  {formatMoney(item.withoutTax)}
                                </td>

                                <td className="border-r border-slate-300 px-1 py-2 text-center">
                                  {sgstRate.toFixed(2)}%
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatMoney(item.sgst)}
                                </td>

                                <td className="border-r border-slate-300 px-1 py-2 text-center">
                                  {cgstRate.toFixed(2)}%
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatMoney(item.cgst)}
                                </td>

                                <td className="border-r border-slate-300 px-1 py-2 text-center">
                                  {igstRate.toFixed(2)}%
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatMoney(item.igst)}
                                </td>

                                <td className="px-2 py-2 text-right font-bold text-slate-900">
                                  {formatMoney(item.total)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={12}
                              className="px-4 py-10 text-center text-slate-400"
                            >
                              Product details are not available for this order.
                            </td>
                          </tr>
                        )}
                      </tbody>
                       <tfoot>
                        {(() => {
                          const rows = selectedOrder?.items ?? [];
                          const totalQty = rows.reduce(
                            (s, r) => s + Number(r.quantity || 0), 0,
                          );
                          const totalWithoutTax = rows.reduce(
                            (s, r) => s + Number(r.withoutTax || 0), 0,
                          );
                          const totalSgst = rows.reduce(
                            (s, r) => s + Number(r.sgst || 0), 0,
                          );
                          const totalCgst = rows.reduce(
                            (s, r) => s + Number(r.cgst || 0), 0,
                          );
                          const totalIgst = rows.reduce(
                            (s, r) => s + Number(r.igst || 0), 0,
                          );
                          const totalLine = rows.reduce(
                            (s, r) => s + Number(r.total || 0), 0,
                          );

                          return (
                            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                              <td colSpan={4} className="border-r border-slate-300 p-2 text-center">
                                Total
                              </td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {totalQty}
                              </td>
                              <td className="border-r border-slate-300 p-2" />
                              <td className="border-r border-slate-300 p-2 text-right">
                                {formatCurrency(totalWithoutTax)}
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
                              <td className="p-2 text-right">
                                {formatCurrency(totalLine)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  <div className="grid min-h-[180px] grid-cols-[1fr_320px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Purchase order raised by{" "}
                        {currentStore?.name || "this store"} to Nature Biotic.
                      </p>
                    </div>

                    <div className="p-4 text-sm">
                      {/* <Summary
                        label="Without Tax"
                        value={formatMoney(selectedOrder.withoutTax)}
                      />
                      <Summary
                        label="SGST"
                        value={formatMoney(selectedOrder.sgst)}
                      />
                      <Summary
                        label="CGST"
                        value={formatMoney(selectedOrder.cgst)}
                      />
                      <Summary
                        label="IGST"
                        value={formatMoney(selectedOrder.igst)}
                      /> */}

                       <Summary
                        label="Round Off"
                        value={formatCurrency(selectedOrder.total - (selectedOrder.withoutTax + selectedOrder.sgst + selectedOrder.cgst + selectedOrder.igst))}
                        muted
                      />

                      <div className="mt-3 border-t border-slate-300 pt-3">
                        <Summary
                          label="Grand Total"
                          value={formatMoney(selectedOrder.total)}
                          bold
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-[100px] justify-end border-t border-slate-300 px-6 py-4">
                    <div className="mt-auto w-56 text-center">
                      <div className="border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="store-po-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedOrder(null)}
                >
                  Close
                </Button>

                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print PO
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
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

function Summary({
  label,
  value,
  bold = false,
  muted = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          bold
            ? "font-bold text-slate-800"
            : muted
              ? "font-semibold text-slate-400"
              : "font-semibold text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function formatMoney(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
