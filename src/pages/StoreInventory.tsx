import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getProductsByStore, type Product } from "@/lib/data";
import { Card, Badge, Button, Input, Select, Icon } from "@/components/ui";
import { formatDate } from "@/lib/format";

type TabKey = "overview" | "executive" | "challans" | "returns";

type ChallanItem = {
  productId: string;
  productName: string;
  packSize: string;
  quantity: number;
  soldQty: number;
  returnedQty: number;
};

type Challan = {
  id: string;
  dcNo: string;
  date: string;
  executive: string;
  remarks?: string;
  items: ChallanItem[];
};

type ReturnRow = {
  id: string;
  returnNo: string;
  date: string;
  dcNo: string;
  executive: string;
  productName: string;
  packSize: string;
  quantity: number;
};

type FormRow = {
  productId: string;
  packSize: string;
  quantity: string;
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];

const initialChallans: Challan[] = [
  {
    id: "dc1",
    dcNo: "DC-1001",
    date: "2026-08-14",
    executive: "Ram Kumar",
    remarks: "Morning field stock",
    items: [
      {
        productId: "p0",
        productName: "Electra",
        packSize: "500 ml",
        quantity: 20,
        soldQty: 12,
        returnedQty: 3,
      },
      {
        productId: "p2",
        productName: "Astra",
        packSize: "100 ml",
        quantity: 10,
        soldQty: 6,
        returnedQty: 1,
      },
    ],
  },
  {
    id: "dc2",
    dcNo: "DC-1002",
    date: "2026-08-14",
    executive: "Ajith Kumar",
    remarks: "Field visit stock",
    items: [
      {
        productId: "p0",
        productName: "Electra",
        packSize: "500 ml",
        quantity: 15,
        soldQty: 8,
        returnedQty: 2,
      },
      {
        productId: "p1",
        productName: "Aalga",
        packSize: "250 ml",
        quantity: 12,
        soldQty: 7,
        returnedQty: 1,
      },
    ],
  },
  {
    id: "dc3",
    dcNo: "DC-1003",
    date: "2026-08-13",
    executive: "PeriyaSamy",
    remarks: "Route stock",
    items: [
      {
        productId: "p3",
        productName: "Alpha",
        packSize: "5 Kg",
        quantity: 8,
        soldQty: 3,
        returnedQty: 2,
      },
    ],
  },
];

const initialReturns: ReturnRow[] = [
  {
    id: "r1",
    returnNo: "RET-201",
    date: "2026-08-14",
    dcNo: "DC-1001",
    executive: "Ram Kumar",
    productName: "Electra",
    packSize: "500 ml",
    quantity: 3,
  },
  {
    id: "r2",
    returnNo: "RET-202",
    date: "2026-08-14",
    dcNo: "DC-1002",
    executive: "Ajith Kumar",
    productName: "Electra",
    packSize: "500 ml",
    quantity: 2,
  },
];

export default function StoreInventory({ storeId }: { storeId: string }) {
  const products = useMemo(() => getProductsByStore(storeId), [storeId]);

  const [tab, setTab] = useState<TabKey>("overview");
  const [challans, setChallans] = useState<Challan[]>(initialChallans);
  const [returns] = useState<ReturnRow[]>(initialReturns);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedExecutive, setSelectedExecutive] = useState<string | null>(
    null,
  );
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);

  const [executive, setExecutive] = useState("");
  const [challanDate, setChallanDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [formRows, setFormRows] = useState<FormRow[]>([
    { productId: "", packSize: "", quantity: "" },
  ]);

  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock < product.minStock,
  );
  const outOfStock = products.filter((product) => product.stock === 0);
  const totalStockQty = products.reduce(
    (sum, product) => sum + product.stock,
    0,
  );

  const executiveSummary = useMemo(() => {
    return executives.map((name) => {
      const rows = challans.filter((challan) => challan.executive === name);

      const totals = rows
        .flatMap((challan) => challan.items)
        .reduce(
          (sum, item) => ({
            issued: sum.issued + item.quantity,
            sold: sum.sold + item.soldQty,
            returned: sum.returned + item.returnedQty,
            hand:
              sum.hand +
              Math.max(0, item.quantity - item.soldQty - item.returnedQty),
          }),
          { issued: 0, sold: 0, returned: 0, hand: 0 },
        );

      return {
        name,
        challans: rows.length,
        ...totals,
      };
    });
  }, [challans]);

  const executiveHandStock = executiveSummary.reduce(
    (sum, item) => sum + item.hand,
    0,
  );

  const selectedExecutiveRows = useMemo(() => {
    if (!selectedExecutive) return [];

    return challans
      .filter((challan) => challan.executive === selectedExecutive)
      .flatMap((challan) =>
        challan.items.map((item) => ({
          ...item,
          dcNo: challan.dcNo,
          date: challan.date,
          handStock: Math.max(
            0,
            item.quantity - item.soldQty - item.returnedQty,
          ),
        })),
      );
  }, [challans, selectedExecutive]);

  function updateRow(index: number, key: keyof FormRow, value: string) {
    setFormRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);

    setFormRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              productId,
              packSize: product?.size ?? "",
            }
          : row,
      ),
    );
  }

  function addProductRow() {
    setFormRows((previous) => [
      ...previous,
      { productId: "", packSize: "", quantity: "" },
    ]);
  }

  function removeProductRow(index: number) {
    setFormRows((previous) =>
      previous.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  function resetCreateForm() {
    setExecutive("");
    setChallanDate(new Date().toISOString().slice(0, 10));
    setFormRows([{ productId: "", packSize: "", quantity: "" }]);
  }

  function closeCreate() {
    setShowCreate(false);
    resetCreateForm();
  }

  const createValid =
    executive !== "" &&
    challanDate !== "" &&
    formRows.length > 0 &&
    formRows.every((row) => row.productId !== "" && Number(row.quantity) > 0);

  function createDeliveryChallan() {
    if (!createValid) return;

    const items: ChallanItem[] = formRows.map((row) => {
      const product = products.find(
        (item) => item.id === row.productId,
      ) as Product;

      return {
        productId: product.id,
        productName: product.name,
        packSize: product.size,
        quantity: Number(row.quantity),
        soldQty: 0,
        returnedQty: 0,
      };
    });

    const nextNumber = `DC-${String(1000 + challans.length + 1)}`;

    const newChallan: Challan = {
      id: `dc-${Date.now()}`,
      dcNo: nextNumber,
      date: challanDate,
      executive,
      items,
    };

    setChallans((previous) => [newChallan, ...previous]);
    closeCreate();
    setTab("challans");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Stock Management
        </h1>
        <p className="mt-1 text-slate-500">
          Store stock, executive hand stock, delivery challans and returns.
        </p>
      </div>

      <Card className="mb-6 p-2">
        <div className="flex flex-wrap gap-2">
          <TabButton
            active={tab === "overview"}
            icon="inventory_2"
            onClick={() => setTab("overview")}
          >
            Stock Overview
          </TabButton>

          <TabButton
            active={tab === "executive"}
            icon="badge"
            onClick={() => setTab("executive")}
          >
            Executive Stock
          </TabButton>

          <TabButton
            active={tab === "challans"}
            icon="local_shipping"
            onClick={() => setTab("challans")}
          >
            Delivery Challans
          </TabButton>

          <TabButton
            active={tab === "returns"}
            icon="assignment_return"
            onClick={() => setTab("returns")}
          >
            Stock Returns
          </TabButton>
        </div>
      </Card>

      {tab === "overview" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniStat
              label="Total Products"
              value={String(products.length)}
              icon="inventory_2"
            />
            <MiniStat
              label="Total Store Stock"
              value={String(totalStockQty)}
              icon="warehouse"
            />
            <MiniStat
              label="Low Stock Products"
              value={String(lowStock.length)}
              icon="warning"
            />
            <MiniStat
              label="Out of Stock"
              value={String(outOfStock.length)}
              icon="error"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-800">Low Stock</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Products that currently have only a small quantity left.
                  </p>
                </div>
                <Badge color="amber">{lowStock.length}</Badge>
              </div>

              <div className="divide-y divide-slate-100">
                {lowStock.length === 0 ? (
                  <EmptyMessage text="No low stock products." />
                ) : (
                  lowStock.map((product) => (
                    <StockAlertRow
                      key={product.id}
                      product={product}
                      tone="amber"
                    />
                  ))
                )}
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-800">Out of Stock</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Products with zero stock currently available in the store.
                  </p>
                </div>
                <Badge color="red">{outOfStock.length}</Badge>
              </div>

              <div className="divide-y divide-slate-100">
                {outOfStock.length === 0 ? (
                  <EmptyMessage text="No out of stock products." />
                ) : (
                  outOfStock.map((product) => (
                    <StockAlertRow
                      key={product.id}
                      product={product}
                      tone="red"
                    />
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "executive" && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-800">Executive Hand Stock</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              See stock issued, sold, returned and currently available with each
              executive.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Executive</th>
                  <th className="px-5 py-3 text-center">Delivery Challans</th>
                  <th className="px-5 py-3 text-center">Issued Qty</th>
                  <th className="px-5 py-3 text-center">Sold Qty</th>
                  <th className="px-5 py-3 text-center">Returned Qty</th>
                  <th className="px-5 py-3 text-center">Hand Stock</th>
                  <th className="px-5 py-3 text-center">View</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {executiveSummary.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {row.name}
                    </td>
                    <td className="px-5 py-4 text-center">{row.challans}</td>
                    <td className="px-5 py-4 text-center font-semibold">
                      {row.issued}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-emerald-700">
                      {row.sold}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-blue-700">
                      {row.returned}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="rounded-lg bg-amber-50 px-3 py-1 font-bold text-amber-700">
                        {row.hand}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedExecutive(row.name)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
                      >
                        <Icon name="visibility" size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td
                    colSpan={5}
                    className="px-5 py-4 text-right font-bold text-slate-600"
                  >
                    Overall Executive Hand Stock
                  </td>
                  <td className="px-5 py-4 text-center text-base font-bold text-amber-700">
                    {executiveHandStock}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {tab === "challans" && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-800">Delivery Challans</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Product stock issued from the store to field executives.
              </p>
            </div>

            <Button onClick={() => setShowCreate(true)}>
              <Icon name="add" size={18} />
              Create Delivery Challan
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">DC No</th>
                  <th className="px-5 py-3 text-left">Issued To</th>
                  <th className="px-5 py-3 text-center">Products</th>
                  <th className="px-5 py-3 text-center">Issued Qty</th>
                  <th className="px-5 py-3 text-center">Sold</th>
                  <th className="px-5 py-3 text-center">Returned</th>
                  <th className="px-5 py-3 text-center">Hand Stock</th>
                  <th className="px-5 py-3 text-center">View</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {challans.map((challan) => {
                  const issued = challan.items.reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  );
                  const sold = challan.items.reduce(
                    (sum, item) => sum + item.soldQty,
                    0,
                  );
                  const returned = challan.items.reduce(
                    (sum, item) => sum + item.returnedQty,
                    0,
                  );

                  return (
                    <tr key={challan.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(challan.date)}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {challan.dcNo}
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {challan.executive}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {challan.items.length}
                      </td>
                      <td className="px-5 py-4 text-center font-semibold">
                        {issued}
                      </td>
                      <td className="px-5 py-4 text-center text-emerald-700">
                        {sold}
                      </td>
                      <td className="px-5 py-4 text-center text-blue-700">
                        {returned}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-amber-700">
                        {issued - sold - returned}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedChallan(challan)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                        >
                          <Icon name="visibility" size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "returns" && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-800">Stock Returns</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Unsold stock brought back to the store by executives.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Return No</th>
                  <th className="px-5 py-3 text-left">DC No</th>
                  <th className="px-5 py-3 text-left">Executive</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Pack Size</th>
                  <th className="px-5 py-3 text-center">Returned Qty</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {returns.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">{formatDate(row.date)}</td>
                    <td className="px-5 py-4 font-bold">{row.returnNo}</td>
                    <td className="px-5 py-4">{row.dcNo}</td>
                    <td className="px-5 py-4 font-semibold">{row.executive}</td>
                    <td className="px-5 py-4">{row.productName}</td>
                    <td className="px-5 py-4">{row.packSize}</td>
                    <td className="px-5 py-4 text-center font-bold text-blue-700">
                      {row.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[90vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <ModalHeader
                title="Create Delivery Challan"
                subtitle="Issue products from store stock to an executive."
                onClose={closeCreate}
              />

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="Issue To / Executive"
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
                    label="Date"
                    type="date"
                    value={challanDate}
                    onChange={setChallanDate}
                    required
                  />
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <h3 className="font-bold text-slate-800">Products</h3>
                      <p className="text-xs text-slate-500">
                        Select product and quantity to issue.
                      </p>
                    </div>

                    <Button variant="secondary" onClick={addProductRow}>
                      <Icon name="add" size={16} />
                      Add Product
                    </Button>
                  </div>

                  <div className="space-y-3 p-4">
                    {formRows.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                      >
                        <Select
                          label="Product"
                          value={row.productId}
                          onChange={(value) => selectProduct(index, value)}
                          placeholder="Select product"
                          options={products.map((product) => ({
                            value: product.id,
                            label: `${product.name} (Stock: ${product.stock})`,
                          }))}
                          required
                        />

                        <Input
                          label="Pack Size"
                          value={row.packSize}
                          onChange={() => {}}
                          placeholder="Auto"
                        />

                        <Input
                          label="Issue Quantity"
                          type="number"
                          value={row.quantity}
                          onChange={(value) =>
                            updateRow(index, "quantity", value)
                          }
                          placeholder="Qty"
                          required
                        />

                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={formRows.length === 1}
                            onClick={() => removeProductRow(index)}
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeCreate}>
                  Cancel
                </Button>

                <Button onClick={createDeliveryChallan} disabled={!createValid}>
                  <Icon name="save" size={18} />
                  Create Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedExecutive &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4">
            <div className="flex h-[70vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <ModalHeader
                title={`${selectedExecutive} — Stock Details`}
                subtitle="Product-wise delivery challan, sales, return and hand stock."
                onClose={() => setSelectedExecutive(null)}
              />

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="px-5 py-3 text-left">DC No</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Product</th>
                      <th className="px-5 py-3 text-left">Pack Size</th>
                      <th className="px-5 py-3 text-center">Issued</th>
                      <th className="px-5 py-3 text-center">Sold</th>
                      <th className="px-5 py-3 text-center">Returned</th>
                      <th className="px-5 py-3 text-center">Hand Stock</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedExecutiveRows.map((row, index) => (
                      <tr key={`${row.dcNo}-${row.productId}-${index}`}>
                        <td className="px-5 py-4 font-bold">{row.dcNo}</td>
                        <td className="px-5 py-4">{formatDate(row.date)}</td>
                        <td className="px-5 py-4 font-semibold">
                          {row.productName}
                        </td>
                        <td className="px-5 py-4">{row.packSize}</td>
                        <td className="px-5 py-4 text-center">
                          {row.quantity}
                        </td>
                        <td className="px-5 py-4 text-center text-emerald-700">
                          {row.soldQty}
                        </td>
                        <td className="px-5 py-4 text-center text-blue-700">
                          {row.returnedQty}
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-amber-700">
                          {row.handStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedChallan &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-[92vw] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <ModalHeader
                title={`Delivery Challan ${selectedChallan.dcNo}`}
                subtitle={`${selectedChallan.executive} · ${formatDate(selectedChallan.date)}`}
                onClose={() => setSelectedChallan(null)}
              />

              <div className="overflow-x-auto p-5">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Pack Size</th>
                      <th className="px-4 py-3 text-center">Issued</th>
                      <th className="px-4 py-3 text-center">Sold</th>
                      <th className="px-4 py-3 text-center">Returned</th>
                      <th className="px-4 py-3 text-center">Hand Stock</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedChallan.items.map((item) => (
                      <tr key={`${item.productId}-${item.packSize}`}>
                        <td className="px-4 py-3 font-semibold">
                          {item.productName}
                        </td>
                        <td className="px-4 py-3">{item.packSize}</td>
                        <td className="px-4 py-3 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.soldQty}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.returnedQty}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-amber-700">
                          {Math.max(
                            0,
                            item.quantity - item.soldQty - item.returnedQty,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function TabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon name={icon} size={18} />
      {children}
    </button>
  );
}

function MiniStat({
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

function StockAlertRow({
  product,
  tone,
}: {
  product: Product;
  tone: "amber" | "red";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-800">{product.name}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {product.size} · {product.productCategory}
        </p>
      </div>

      <div className="text-right">
        <p
          className={`text-lg font-bold ${
            tone === "red" ? "text-red-600" : "text-amber-600"
          }`}
        >
          {product.stock}
        </p>
        <p className="text-xs text-slate-400">Stock</p>
      </div>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-slate-400">{text}</div>
  );
}

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
      <div>
        <h2 className="font-bold text-slate-800">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
      >
        <Icon name="close" size={19} />
      </button>
    </div>
  );
}
