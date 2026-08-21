import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input, Select, EmptyState, Icon } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getStoreApprovalRequests,
  updateStoreApprovalRequestStatus,
  type StoreApprovalRequest,
} from "@/lib/data";

type PurchaseOrderItem = {
  id?: string;
  key?: string;
  product?: { name?: string };
  productName?: string;
  productId?: string;
  pkgsize?: string;
  packSize?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  sellingPrice?: number;
  withoutTax?: number;
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

export default function CompanyPurchaseOrders() {
  const [requests, setRequests] = useState<StoreApprovalRequest[]>(() =>
    getStoreApprovalRequests().filter((row) => row.type === "Purchase Order"),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<PurchaseRequestRow | null>(null);

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

  const pendingCount = requests.filter((row) => row.status === "Pending").length;

  return (
    <div>
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
              <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                <th className="w-[6%] border-r border-slate-200 px-2 py-3 text-center">
                  S.No
                </th>
                <th className="w-[11%] border-r border-slate-200 px-2 py-3 text-center">
                  Date
                </th>
                <th className="w-[15%] border-r border-slate-200 px-2 py-3 text-center">
                  PO No
                </th>
                <th className="w-[22%] border-r border-slate-200 px-2 py-3 text-center">
                  Store Name
                </th>
                <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-center">
                  Products
                </th>
                <th className="w-[14%] border-r border-slate-200 px-2 py-3 text-right">
                  Amount
                </th>
                <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-center">
                  Status
                </th>
                <th className="w-[10%] px-2 py-3 text-center">
                  Action
                </th>
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
                  <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                    {row.referenceNo}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center text-slate-700">
                    {row.storeName}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {row.order?.items?.length ?? row.order?.totalProduct ?? "-"}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-right font-bold">
                    {formatCurrency(row.order?.total ?? row.amount)}
                  </td>
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.status === "Approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.status === "Rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td
                    className="px-2 py-3 text-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.status === "Pending" ? (
                      <Button size="sm" onClick={() => approve(row.id)}>
                        Approve
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">
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
            <div className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Store Purchase Order
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selected.referenceNo}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selected.storeName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Info label="PO No" value={selected.referenceNo} />
                  <Info label="Date" value={formatDate(selected.date)} />
                  <Info label="Store Name" value={selected.storeName} />
                  <Info label="Status" value={selected.status} />
                  <Info
                    label="Products"
                    value={String(
                      selected.order?.items?.length ??
                        selected.order?.totalProduct ??
                        0,
                    )}
                  />
                  <Info
                    label="Without Tax"
                    value={formatCurrency(selected.order?.withoutTax ?? 0)}
                  />
                  <Info
                    label="Tax"
                    value={formatCurrency(
                      (selected.order?.sgst ?? 0) +
                        (selected.order?.cgst ?? 0) +
                        (selected.order?.igst ?? 0),
                    )}
                  />
                  <Info
                    label="Grand Total"
                    value={formatCurrency(
                      selected.order?.total ?? selected.amount,
                    )}
                  />
                </div>

                {selected.order?.items?.length ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                          <th className="w-[7%] px-2 py-3 text-center">S.No</th>
                          <th className="w-[25%] px-3 py-3 text-left">Product</th>
                          <th className="w-[14%] px-2 py-3 text-center">Pack Size</th>
                          <th className="w-[12%] px-2 py-3 text-right">Qty</th>
                          <th className="w-[14%] px-2 py-3 text-right">Price</th>
                          <th className="w-[14%] px-2 py-3 text-right">Without Tax</th>
                          <th className="w-[14%] px-2 py-3 text-right">Total</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {selected.order.items.map((item, index) => (
                          <tr key={item.id ?? item.key ?? index}>
                            <td className="px-2 py-3 text-center text-slate-500">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 font-semibold text-slate-800">
                              {item.product?.name ||
                                item.productName ||
                                item.productId ||
                                "-"}
                            </td>
                            <td className="px-2 py-3 text-center text-slate-600">
                              {item.packSize || item.pkgsize || "-"}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {item.quantity ?? item.qty ?? 0}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(
                                item.price ?? item.sellingPrice ?? 0,
                              )}
                            </td>
                            <td className="px-2 py-3 text-right">
                              {formatCurrency(item.withoutTax ?? 0)}
                            </td>
                            <td className="px-2 py-3 text-right font-bold">
                              {formatCurrency(
                                item.total ?? item.rowTotal ?? 0,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                    Product-level details are not available for this older order.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-800">{value}</p>
    </div>
  );
}
