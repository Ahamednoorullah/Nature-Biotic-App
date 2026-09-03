import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getStoreApprovalRequests,
  updateStoreApprovalRequestStatus,
  getProductMaster,
  type Product,
  type StoreApprovalRequest,
  syncApprovedPurchaseOrderToSales,
  stores,
} from "@/lib/data";

type PurchaseOrderItem = {
  id?: string;
  key?: string;
  product?: { name?: string } | string;
  productName?: string;
  productId?: string;
  hsnCode?: string;
  pkgsize?: string;
  packSize?: string;
  batchNo: string;
  expiryDate: string;
  quantity?: number;
  qty?: number;
  price?: number;
  sellingPrice?: number;
  withoutTax?: number;
  taxPercent?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total?: number;
  rowTotal?: number;
};

type StoredPurchaseOrder = {
  id: string;
  poNo: string;
  date: string;
  totalProduct?: number;
  batchNo: string;
  expiryDate: string;
  withoutTax?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total: number;
  status?: "Pending" | "Approved";
  items?: PurchaseOrderItem[];
};

type PurchaseRequestRow = StoreApprovalRequest & {
  order?: StoredPurchaseOrder;
};

function readStorePurchaseOrders(storeId: string): StoredPurchaseOrder[] {
  try {
    const raw = localStorage.getItem(`naturebiotic:purchase-orders:${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function handleApprove(request: StoreApprovalRequest) {
  updateStoreApprovalRequestStatus(request.id, "Approved");

  if (request.type === "Purchase Order") {
    // fetch the actual PO items from store's saved PO record
    const poData = JSON.parse(
      localStorage.getItem(`naturebiotic:purchase-orders:${request.storeId}`) || "[]"
    );
    const po = poData.find((p: any) => p.poNo === request.referenceNo);

    if (po) {
      syncApprovedPurchaseOrderToSales(
        request.storeId,
        request.storeName,
        po.poNo,
        po.date,
        po.items,
        stores.find((s) => s.id === request.storeId)?.location || "",
        "Tamil Nadu", // or derive properly
      );
    }
  }
}


export default function CompanyPurchaseOrders() {
  const [requests, setRequests] = useState<StoreApprovalRequest[]>(() =>
    getStoreApprovalRequests().filter((row) => row.type === "Purchase Order"),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selected, setSelected] = useState<PurchaseRequestRow | null>(null);

  const productMaster = useMemo<Product[]>(() => getProductMaster(), []);

  function getPurchaseProductName(item: PurchaseOrderItem) {
    if (typeof item.product === "string" && item.product.trim()) {
      return item.product;
    }

    if (typeof item.product === "object" && item.product?.name?.trim()) {
      return item.product.name;
    }

    if (item.productName?.trim()) {
      return item.productName;
    }

    if (item.productId) {
      const masterProduct = productMaster.find(
        (product) => product.id === item.productId,
      );

      if (masterProduct?.name) {
        return masterProduct.name;
      }
    }

    return "-";
  }

  function getPurchaseProductHsn(item: PurchaseOrderItem) {
    if (item.hsnCode?.trim()) return item.hsnCode;

    if (item.productId) {
      return (
        productMaster.find((product) => product.id === item.productId)
          ?.hsnCode ?? "-"
      );
    }

    return "-";
  }

  const rows = useMemo<PurchaseRequestRow[]>(
    () =>
      requests.map((request) => {
        const order = readStorePurchaseOrders(request.storeId).find(
          (item) => item.poNo === request.referenceNo,
        );
        return { ...request, order };
      }),
    [requests],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        row.referenceNo.toLowerCase().includes(q) ||
        row.storeName.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  function refresh() {
    setRequests(
      getStoreApprovalRequests().filter((row) => row.type === "Purchase Order"),
    );
  }

  function approve(id: string) {
    updateStoreApprovalRequestStatus(id, "Approved");
    refresh();

    if (selected?.id === id) {
      setSelected((current) =>
        current ? { ...current, status: "Approved" } : current,
      );
    }
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

  const pendingCount = requests.filter(
    (row) => row.status === "Pending",
  ).length;

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          .po-print-area, .po-print-area * {
            visibility: visible;
          }
          .po-print-area {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .po-print-area table {
            font-size: 10px !important;
          }
          .po-print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Purchase Orders
          </h1>
          <p className="mt-1 text-slate-500">
            Purchase orders raised by stores for company approval.
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
            {pendingCount} Pending Approval
          </div>
        )}
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="max-w-md flex-1">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by PO no or store..."
              icon="search"
            />
          </div>

          <div className="w-full md:w-52">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Status"
              options={[
                { value: "Pending", label: "Pending" },
                { value: "Approved", label: "Approved" },
                { value: "Rejected", label: "Rejected" },
              ]}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="shopping_cart_checkout"
            title="No purchase orders found"
            description="Store purchase orders will appear here when they are raised."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <th rowSpan={2} className="w-[5%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  S.No
                </th>
                <th rowSpan={2} className="w-[9%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Date
                </th>
                <th rowSpan={2} className="w-[12%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  PO No
                </th>
                <th rowSpan={2} className="w-[9%] border-r border-slate-200 px-2 py-3 text-center font-semibold">
                  Total Product
                </th>
                <th rowSpan={2} className="w-[11%] border-r border-slate-200 px-2 py-3 text-right font-semibold">
                  Without Tax
                </th>

                <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold">
                  SGST
                </th>
                <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold">
                  CGST
                </th>
                <th colSpan={2} className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold">
                  IGST
                </th>

                <th rowSpan={2} className="w-[10%] border-r border-slate-200 px-2 py-3 text-right font-semibold">
                  Total
                </th>
                <th rowSpan={2} className="w-[8%] px-2 py-3 text-center font-semibold">
                  Status
                </th>
              </tr>

              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">%</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">Amt</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">%</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">Amt</th>
                <th className="border-r border-slate-100 px-1 py-2 text-center font-semibold">%</th>
                <th className="border-r border-slate-200 px-1 py-2 text-center font-semibold">Amt</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                  title="Click to view purchase order"
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {index + 1}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-600">
                    {formatDate(row.date)}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center font-bold text-slate-800">
                    {row.referenceNo}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.order?.items?.length ?? row.order?.totalProduct ?? "-"}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold text-slate-700">
                    {formatCurrency(row.order?.withoutTax ?? 0)}
                  </td>

                  <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                    {(row.order?.sgst ?? 0) > 0 && (row.order?.withoutTax ?? 0) > 0
                      ? `${(((row.order?.sgst ?? 0) / (row.order?.withoutTax ?? 1)) * 100).toFixed(2)}%`
                      : "0.00%"}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                    {formatCurrency(row.order?.sgst ?? 0)}
                  </td>

                  <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                    {(row.order?.cgst ?? 0) > 0 && (row.order?.withoutTax ?? 0) > 0
                      ? `${(((row.order?.cgst ?? 0) / (row.order?.withoutTax ?? 1)) * 100).toFixed(2)}%`
                      : "0.00%"}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                    {formatCurrency(row.order?.cgst ?? 0)}
                  </td>

                  <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                    {(row.order?.igst ?? 0) > 0 && (row.order?.withoutTax ?? 0) > 0
                      ? `${(((row.order?.igst ?? 0) / (row.order?.withoutTax ?? 1)) * 100).toFixed(2)}%`
                      : "0.00%"}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                    {formatCurrency(row.order?.igst ?? 0)}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(row.order?.total ?? row.amount)}
                  </td>

                  <td
                    className="px-2 py-3 text-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.status === "Pending" ? (
                      <button
                        type="button"
                        onClick={() => approve(row.id)}
                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                      >
                        Pending
                      </button>
                    ) : (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          row.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    )}
                  </td>
                </tr>

              ))}
            </tbody>
          </table>
        </Card>
      )}

            {selected &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[94vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl po-print-area">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 po-print-hide">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Purchase Order
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selected.referenceNo}
                  </h2>

                  <div className="mt-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        selected.status === "Approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : selected.status === "Rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="border-r border-slate-300 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>

                        <div>
                          <h3 className="text-base font-extrabold tracking-wide text-slate-900">
                            NATURE BIOTIC
                          </h3>
                          <p className="mt-1 text-[11px] leading-4 text-slate-600">
                            4/130/A1, Velavan Nagar, Velayudhampuram,
                            Rajapalayam, Tamil Nadu - 626102
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            GSTIN: 33AEZPV5328P1ZC
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center p-4">
                      <h3 className="text-2xl font-bold text-slate-900">
                        Purchase Order
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300 text-sm">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Ordered By
                      </p>

                      <p className="mt-2 font-bold text-slate-900">
                        {selected.storeName}
                      </p>

                      <p className="mt-1 text-slate-500">
                        Store Purchase Request
                      </p>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-[110px_1fr] gap-y-2">
                        <span className="text-slate-500">PO No</span>
                        <span className="font-semibold text-slate-800">
                          {selected.referenceNo}
                        </span>

                        <span className="text-slate-500">PO Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selected.date)}
                        </span>

                        <span className="text-slate-500">Store Name</span>
                        <span className="font-semibold text-slate-800">
                          {selected.storeName}
                        </span>

                        <span className="text-slate-500">Status</span>
                        <span className="font-semibold text-slate-800">
                          {selected.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selected.order?.items?.length ? (
                    <table className="w-full max-w-7xl table-fixed border-collapse text-[11px]">
                      <colgroup>
                        <col className="w-[4%]" />   {/* S.No */}
                        <col className="w-[24%]" />  {/* Product */}
                        <col className="w-[6%]" />   {/* HSN */}
                        <col className="w-[6%]" />   {/* Pkg Size */}
                        <col className="w-[4%]" />   {/* Qty */}
                        <col className="w-[7%]" />   {/* Price */}
                        <col className="w-[8%]" />   {/* Without Tax */}
                        <col className="w-[4%]" />   {/* SGST % */}
                        <col className="w-[7%]" />   {/* SGST Amt */}
                        <col className="w-[4%]" />   {/* CGST % */}
                        <col className="w-[7%]" />   {/* CGST Amt */}
                        <col className="w-[4%]" />   {/* IGST % */}
                        <col className="w-[7%]" />   {/* IGST Amt */}
                        <col className="w-[8%]" />   {/* Total */}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-center">
                            S.No
                          </th>
                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-left">
                            Product
                          </th>
                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-center">
                            HSN
                          </th>
                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-center">
                            Pkg Size
                          </th>

                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-right">
                            Qty
                          </th>
                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-right">
                            Price
                          </th>
                          <th rowSpan={2} className="border-r border-slate-300 px-2 py-2.5 text-right">
                            Without Tax
                          </th>

                          <th colSpan={2} className="border-r border-slate-300 px-1 py-2 text-center">
                            SGST
                          </th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-2 text-center">
                            CGST
                          </th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-2 text-center">
                            IGST
                          </th>

                          {/* FIX: was colSpan={2} — Total has no % / Amt sub-columns,
                              so it must be a single rowSpan cell like the other totals.
                              The old colSpan={2} added a 15th phantom column that the
                              <colgroup> (14 cols) couldn't account for — that phantom
                              column was the source of the extra blank space on the right
                              and the misalignment in tbody/filler/tfoot rows. */}
                          <th rowSpan={2} className="px-2 py-2.5 text-right">
                            Total
                          </th>
                        </tr>

                        <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selected.order.items.map((item, index) => (
                          <tr
                            key={item.id ?? item.key ?? index}
                            className="border-b border-slate-200"
                          >
                            <td className="border-r border-slate-300 px-2 py-3 text-center">
                              {index + 1}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-3 font-semibold text-slate-800">
                              {getPurchaseProductName(item)}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-3 text-center text-slate-600">
                              {getPurchaseProductHsn(item)}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-3 text-center">
                              {item.packSize || item.pkgsize || "-"}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-3 text-right">
                              {item.quantity ?? item.qty ?? 0}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-3 text-right">
                              {formatCurrency(
                                item.price ?? item.sellingPrice ?? 0,
                              )}
                            </td>

                            <td className="border-r border-slate-300 px-2 py-3 text-right">
                              {formatCurrency(item.withoutTax ?? 0)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-3 text-center">
                              {(item.sgst ?? 0) > 0 && (item.withoutTax ?? 0) > 0
                                ? `${(((item.sgst ?? 0) / (item.withoutTax ?? 1)) * 100).toFixed(2)}%`
                                : "0.00%"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-3 text-right">
                              {formatCurrency(item.sgst ?? 0)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-3 text-center">
                              {(item.cgst ?? 0) > 0 && (item.withoutTax ?? 0) > 0
                                ? `${(((item.cgst ?? 0) / (item.withoutTax ?? 1)) * 100).toFixed(2)}%`
                                : "0.00%"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-3 text-right">
                              {formatCurrency(item.cgst ?? 0)}
                            </td>

                            <td className="border-r border-slate-300 px-1 py-3 text-center">
                              {(item.igst ?? 0) > 0 && (item.withoutTax ?? 0) > 0
                                ? `${(((item.igst ?? 0) / (item.withoutTax ?? 1)) * 100).toFixed(2)}%`
                                : "0.00%"}
                            </td>
                            <td className="border-r border-slate-300 px-2 py-3 text-right">
                              {formatCurrency(item.igst ?? 0)}
                            </td>

                            <td className="px-2 py-3 text-right font-bold">
                              {formatCurrency(item.total ?? item.rowTotal ?? 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {(() => {
                        const MIN_ROWS = 6;
                        const fillerCount = Math.max(0, MIN_ROWS - selected.order.items.length);
                        const columnCount = 14;
                        return Array.from({ length: fillerCount }).map((_, i) => (
                          <tr key={`filler-${i}`}>
                            {Array.from({ length: columnCount }).map((_, colIdx) => (
                              <td
                                key={colIdx}
                                className={`px-1 py-1 h-6 ${
                                  colIdx < columnCount - 1 ? "border-r border-slate-300" : ""
                                }`}
                              >
                                &nbsp;
                              </td>
                            ))}
                          </tr>
                        ));
                      })()}

                    <tfoot>
                    {(() => {
                      const rows = selected?.order?.items ?? [];
                      const totalQty = rows.reduce((s, r) => s + Number(r.quantity || 0), 0);
                      const totalWithoutTax = rows.reduce((s, r) => s + Number(r.withoutTax || 0), 0);
                      const totalSgst = rows.reduce((s, r) => s + Number(r.sgst || 0), 0);
                      const totalCgst = rows.reduce((s, r) => s + Number(r.cgst || 0), 0);
                      const totalIgst = rows.reduce((s, r) => s + Number(r.igst || 0), 0);
                      const totalLine = rows.reduce((s, r) => s + Number(r.total || 0), 0);

                      return (
                        <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                          {/* cols 1-4: S.No, Product, HSN, Pkg Size */}
                          <td colSpan={4} className="border-r border-slate-300 p-2 text-center">
                            Total
                          </td>

                          {/* col 5: Qty */}
                          <td className="border-r border-slate-300 p-2 text-right">
                            {totalQty}
                          </td>

                          {/* col 6: Price - blank */}
                          <td className="border-r border-slate-300 p-2" />

                          {/* col 7: Without Tax */}
                          <td className="border-r border-slate-300 p-2 text-right">
                            {formatCurrency(totalWithoutTax)}
                          </td>

                          {/* col 8: SGST % - blank */}
                          <td className="border-r border-slate-300 p-2" />
                          {/* col 9: SGST Amt */}
                          <td className="border-r border-slate-300 p-2 text-right">
                            {formatCurrency(totalSgst)}
                          </td>

                          {/* col 10: CGST % - blank */}
                          <td className="border-r border-slate-300 p-2" />
                          {/* col 11: CGST Amt */}
                          <td className="border-r border-slate-300 p-2 text-right">
                            {formatCurrency(totalCgst)}
                          </td>

                          {/* col 12: IGST % - blank */}
                          <td className="border-r border-slate-300 p-2" />
                          {/* col 13: IGST Amt */}
                          <td className="border-r border-slate-300 p-2 text-right">
                            {formatCurrency(totalIgst)}
                          </td>

                          {/* col 14: Total */}
                          <td className="p-2 text-right">
                            {formatCurrency(totalLine)}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                    </table>
                  ) : (

                    <div className="p-8 text-center text-sm text-slate-400">
                      Product-level details are not available for this order.
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_330px] border-t border-slate-300">
                  <div className="border-r border-slate-300 p-2.5">
                      <p className="text-[12px] font-semibold text-slate-700">
                        Amount in Words :{" "}
                          <span className="font-bold text-slate-900">
                            {numberToWords(
                              selected.order?.total ?? selected.amount ?? 0,
                              )}
                          </span>
                      </p>
                  </div>

                  <div className="space-y-1 p-2.5 text-[11px]">
                    <SummaryLine
                      label="Round Off"
                      value={formatCurrency(
                        (selected.order?.total ?? selected.amount ?? 0) -
                          ((selected.order?.withoutTax ?? 0) +
                            (selected.order?.sgst ?? 0) +
                            (selected.order?.cgst ?? 0) +
                            (selected.order?.igst ?? 0))
                      )}
                      muted
                    />

                    <div className="flex items-center justify-between border-t border-slate-300 pt-1.5">
                      <span className="text-xs font-bold text-slate-900">
                        Grand Total
                      </span>
                      <span className="text-sm font-extrabold text-brand-700">
                        {formatCurrency(
                          selected.order?.total ?? selected.amount,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                  {/* NEW: separate Notes row below, full width, left-aligned */}
                  <div className="border-t border-slate-300 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Notes
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Purchase order raised by {selected.storeName} for Nature
                      Biotic approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 po-print-hide">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>

                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print PO
                </Button>

                {selected.status === "Pending" && (
                  <Button onClick={() => approve(selected.id)}>
                    <Icon name="check_circle" size={18} />
                    Approve Purchase Order
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SummaryLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={muted ? "text-slate-400" : "text-slate-500"}>{label}</span>
      <span className={muted ? "font-semibold text-slate-600" : "font-semibold text-slate-800"}>{value}</span>
    </div>
  );
}
