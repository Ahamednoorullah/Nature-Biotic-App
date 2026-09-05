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
           <div className="company-po-print-area flex max-h-[94vh] w-[96vw] max-w-[1450px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">                                  
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

              <div className="company-po-print-area flex max-h-[94vh] w-[96vw] max-w-[1450px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="purchase-scroll min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="min-h-full w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
                    <div className="grid grid-cols-2 border-b border-slate-300 text-[10px] leading-5">
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
                                      Purchase Invoice
                                    </h3>
                                    {/* <p className="mt-1 text-[10px] text-slate-500">
                                      Nature Biotic to Store
                                    </p> */}
                                  </div>
                                </div>
                              </div>
              
                              <div className="grid grid-cols-2 border-b border-slate-300 text-[10px] leading-5">
                                <div className="border-r border-slate-300 px-3 py-2.5">
                                  <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                                    Supplier
                                  </p>
                                  <p className="font-bold text-slate-900">Nature Biotic</p>
                                  <p className="text-slate-600">Rajapalayam, Tamil Nadu</p>
                                  <p className="text-slate-600">
                                    GSTIN: 33AEZPV5328P1ZC
                                  </p>
                                </div>
              
                                {/* <div className="border-r border-slate-300 px-3 py-2.5">
                                  <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                                    Purchase Summary
                                  </p>
                                  <p className="text-slate-600">
                                    No. of Products:{" "}
                                    <span className="font-semibold text-slate-800">
                                      {selectedItems.length}
                                    </span>
                                  </p>
                                  <p className="text-slate-600">
                                    Total Quantity:{" "}
                                    <span className="font-semibold text-slate-800">
                                      {selectedInvoice.quantity}
                                    </span>
                                  </p>
                                  <p className="text-slate-600">
                                    Before Discount:{" "}
                                    <span className="font-semibold text-slate-800">
                                      {formatCurrency(selectedInvoice.beforeDiscount || 0)}
                                    </span>
                                  </p>
                                  <p className="text-slate-600">
                                    Discount:{" "}
                                    <span className="font-semibold text-slate-800">
                                      {formatCurrency(selectedInvoice.discount || 0)}
                                    </span>
                                  </p>
                                  <p className="text-slate-600">
                                    Invoice Value:{" "}
                                    <span className="font-semibold text-slate-800">
                                      {formatCurrency(selectedInvoice.total)}
                                    </span>
                                  </p>
                                </div> */}
              
                                <div className="px-3 py-2.5">
                                  <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                                    Invoice Details
                                  </p>
              
                                  <div className="grid grid-cols-[100px_1fr] gap-y-0.5">
                                    <span className="text-slate-500">Invoice No</span>
                                    <span className="font-semibold text-slate-800">
                                      {selected.referenceNo}
                                    </span>
              
                                    <span className="text-slate-500">Date</span>
                                    <span className="font-semibold text-slate-800">
                                      {formatDate(selected.date)}
                                    </span>
              
                                    <span className="text-slate-500">Status</span>
                                    <span className="font-semibold text-slate-800">
                                      {selected.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
              
                              <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[1400px] table-fixed border-collapse text-[9px]">
                                  <thead>
                                    <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                                      <th rowSpan={2} className="w-[4%] border-r border-slate-300 px-2 py-2 text-center">
                                        S.No
                                      </th>
                                      <th rowSpan={2} className="w-[12%] border-r border-slate-300 px-2 py-2 text-left">
                                        Product
                                      </th>
                                      <th rowSpan={2} className="w-[7%] border-r border-slate-300 px-2 py-2 text-center">
                                        Pkg Size
                                      </th>
                                      <th rowSpan={2} className="w-[7%] border-r border-slate-300 px-2 py-2 text-center">
                                        Batch ID
                                      </th>
                                      <th rowSpan={2} className="w-[7%] border-r border-slate-300 px-2 py-2 text-center">
                                        Expiry Date
                                      </th>
                                      <th rowSpan={2} className="w-[5%] border-r border-slate-300 px-2 py-2 text-center">
                                        Qty
                                      </th>
                                      <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-2 py-2 text-right">
                                        Unit Price
                                      </th>
                                      <th rowSpan={2} className="w-[10%] border-r border-slate-300 px-2 py-2 text-right">
                                        Before Discount
                                      </th>
              
                                      <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                                        Discount
                                      </th>
              
                                      <th rowSpan={2} className="w-[9%] border-r border-slate-300 px-2 py-2 text-right">
                                        Taxable
                                      </th>
              
                                      <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                                        SGST
                                      </th>
                                      <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                                        CGST
                                      </th>
                                      <th colSpan={2} className="w-[9%] border-r border-slate-300 px-1 py-1.5 text-center">
                                        IGST
                                      </th>
              
                                      <th rowSpan={2} className="w-[10%] px-2 py-2 text-right">
                                        Line Total
                                      </th>
                                    </tr>
              
                                    <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                                      <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                                      <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
              
                                      <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                                      <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
              
                                      <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                                      <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
              
                                      <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                                      <th className="border-r border-slate-300 px-1 py-1 text-right">Amt</th>
                                    </tr>
                                  </thead>
              
                                  <tbody>
                                    {(selected.order?.items ?? []).map((item: any, index: number) => {
                                      const unitPrice = Number(
                                        item.sellingPrice ??
                                          item.price ??
                                          (item.quantity
                                            ? Number(
                                                item.beforeDiscount ??
                                                  item.withoutTax ??
                                                  0,
                                              ) / Number(item.quantity)
                                            : 0),
                                      );
              
                                      const size =
                                        item.packSize ??
                                        item.pkgsize ??
                                        item.size ??
                                        item.unit ??
                                        "-";
              
                                      const beforeDiscount = Number(
                                        item.beforeDiscount ??
                                          unitPrice * Number(item.quantity || 0),
                                      );
              
                                      const discountPercent = Number(
                                        item.discountPercent ??
                                          item.discount ??
                                          0,
                                      );
              
                                      const discountAmount = Number(
                                        item.discountAmount ??
                                          (beforeDiscount * discountPercent) / 100,
                                      );
              
                                      const taxableAmount = Number(
                                        item.taxableAmount ??
                                          item.withoutTax ??
                                          beforeDiscount - discountAmount,
                                      );
              
                                      const taxPercent = Number(item.taxPercent || 0);
                                      const sgstRate =
                                        item.sgst > 0
                                          ? taxPercent
                                            ? taxPercent / 2
                                            : (item.sgst / item.withoutTax) * 100
                                          : 0;
                                      const cgstRate =
                                        item.cgst > 0
                                          ? taxPercent
                                            ? taxPercent / 2
                                            : (item.cgst / item.withoutTax) * 100
                                          : 0;
                                      const igstRate =
                                        item.igst > 0
                                          ? taxPercent ||
                                            (item.igst / item.withoutTax) * 100
                                          : 0;
              
                                      return (
                                        <tr
                                          key={item.id ?? `${item.invoiceNo}-${index}`}
                                        >
                                          <td className="border-r border-slate-300 px-2 py-2 text-center">
                                            {index + 1}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                                            {item.productName ?? item.product ?? "-"}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-center text-slate-600">
                                            {size}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-center">
                                            {item.batchNo}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-center">
                                            {item.expiryDate}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                                            {item.quantity}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-right text-slate-600">
                                            {formatCurrency(unitPrice)}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                                            {formatCurrency(beforeDiscount)}
                                          </td>
              
                                          <td className="border-r border-slate-300 px-1 py-2 text-center">
                                            {discountPercent.toFixed(2)}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-right">
                                            {formatCurrency(discountAmount)}
                                          </td>
              
                                          <td className="border-r border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                                            {formatCurrency(taxableAmount)}
                                          </td>
              
                                          <td className="border-r border-slate-300 px-1 py-2 text-center">
                                            {sgstRate.toFixed(2)}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-right">
                                            {formatCurrency(item.sgst || 0)}
                                          </td>
              
                                          <td className="border-r border-slate-300 px-1 py-2 text-center">
                                            {cgstRate.toFixed(2)}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-right">
                                            {formatCurrency(item.cgst || 0)}
                                          </td>
              
                                          <td className="border-r border-slate-300 px-1 py-2 text-center">
                                            {igstRate.toFixed(2)}
                                          </td>
                                          <td className="border-r border-slate-300 px-2 py-2 text-right">
                                            {formatCurrency(item.igst || 0)}
                                          </td>
              
                                          <td className="px-2 py-2 text-right font-bold text-slate-800">
                                            {formatCurrency(item.total)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
              
                                  {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                                      {(() => {
                                      const MIN_ROWS = 10;
                                      const fillerCount = Math.max(0, MIN_ROWS - (selected.order?.items?.length ?? 0));
                                      const columnCount = 18;
              
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
                                        const items = selected.order?.items ?? [];
              
                                        const totalQty = items.reduce(
                                          (s, r: any) => s + Number(r.quantity || 0), 0,
                                        );
              
                                        let totalBeforeDiscount = 0;
                                        let totalDiscountAmt = 0;
                                        let totalTaxable = 0;
                                        let totalSgst = 0;
                                        let totalCgst = 0;
                                        let totalIgst = 0;
                                        let totalLine = 0;
              
                                        items.forEach((r: any) => {
                                          const unitPrice = Number(
                                            r.sellingPrice ??
                                              r.price ??
                                              (r.quantity
                                                ? Number(r.beforeDiscount ?? r.withoutTax ?? 0) / Number(r.quantity)
                                                : 0),
                                          );
                                          const beforeDiscount = Number(
                                            r.beforeDiscount ?? unitPrice * Number(r.quantity || 0),
                                          );
                                          const discountPercent = Number(r.discountPercent ?? r.discount ?? 0);
                                          const discountAmount = Number(
                                            r.discountAmount ?? (beforeDiscount * discountPercent) / 100,
                                          );
                                          const taxableAmount = Number(
                                            r.taxableAmount ?? r.withoutTax ?? beforeDiscount - discountAmount,
                                          );
              
                                          totalBeforeDiscount += beforeDiscount;
                                          totalDiscountAmt += discountAmount;
                                          totalTaxable += taxableAmount;
                                          totalSgst += Number(r.sgst || 0);
                                          totalCgst += Number(r.cgst || 0);
                                          totalIgst += Number(r.igst || 0);
                                          totalLine += Number(r.total || 0);
                                        });
              
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
                                            <td className="p-2 text-right">
                                              {formatCurrency(totalLine)}
                                            </td>
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
                                      const grandTotal = (selected.order?.items ?? []).reduce(
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
                                      <SummaryLine
                                      label="Round Off"
                                      value={formatCurrency(
                                        (selected.order?.items ?? []).reduce(
                                          (sum, row) => sum + Number(row.total || 0),
                                          0,
                                        ) -
                                          (selected.order?.items ?? []).reduce(
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
                                    <SummaryLine
                                      label="Grand Total"
                                      value={formatCurrency(
                                        (selected.order?.items ?? []).reduce(
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
                                      {selected.storeName || "this store"} to Nature Biotic.
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
              
                          <div className="store-purchase-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                            {selected.status === "Pending" && (
                              <Button onClick={() => approve(selected.id)}>
                                <Icon name="check_circle" size={18} />
                                Approve
                              </Button>
                            )}
              
                            <Button variant="secondary" onClick={() => setSelected(null)}>
                              Close
                            </Button>
              
                            <Button onClick={() => window.print()}>
                              <Icon name="print" size={18} />
                              Print Invoice
                            </Button>
                          </div>
                        </div>               
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SummaryLine({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`${muted ? "text-slate-400" : "text-slate-500"} ${bold ? "font-bold" : ""}`}>
        {label}
      </span>
      <span className={`${muted ? "text-slate-600" : "text-slate-800"} ${bold ? "font-bold" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}
