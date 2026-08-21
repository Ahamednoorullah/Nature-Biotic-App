import { ReactNode, useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select, EmptyState } from "@/components/ui";
import { createPortal } from "react-dom";
import { formatCurrency, formatDate } from "@/lib/format";

type ReturnItem = {
  product: string;
  packSize: string;
  issuedQty: string;
  returnedQty: string;
  unitValue: string;
};

type ReturnChallan = {
  phone: string;
  village: string;
  farmer: ReactNode;
  id: string;
  rcNo: string;
  date: string;
  dcNo: string;
  executive: string;
  customerName: string;
  placeOfSupply: string;
  items: ReturnItem[];
};

const executives = ["Ram Kumar", "Ajith Kumar", "PeriyaSamy"];
const STORAGE_PREFIX = "nature-biotic-store-return-challans-v2";

function emptyItems(): ReturnItem[] {
  return [
    {
      product: "",
      packSize: "",
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

export default function StoreReturnChallan({
  storeId,
}: {
  storeId: string;
}) {
  const storageKey = `${STORAGE_PREFIX}:${storeId}`;

  const [rows, setRows] = useState<ReturnChallan[]>(() => {
    const saved = loadRows(storageKey);

    if (saved.length > 0) return saved;

    return [
      {
        id: "1",
        rcNo: "RC-001",
        date: "2026-08-18",
        dcNo: "DC-1001",
        executive: "Ram Kumar",
        customerName: "Murugan",
        phone: "9876543210",
        village: "Rajapalayam",
        farmer: "Murugan",
        placeOfSupply: "Tamil Nadu",
        items: [
          {
            product: "Electra",
            packSize: "250 ml",
            issuedQty: "10",
            returnedQty: "3",
            unitValue: "250",
          },
        ],
      },
    ];
  });

  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<ReturnChallan | null>(null);

  const [rcNo, setRcNo] = useState("");
  const [date, setDate] = useState("");
  const [dcNo, setDcNo] = useState("");
  const [executive, setExecutive] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [village, setVillage] = useState("");
  const [phone, setPhone] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [items, setItems] = useState<ReturnItem[]>(emptyItems());

  const canCreate =
    !!rcNo.trim() &&
    !!date &&
    !!dcNo.trim() &&
    !!executive &&
    items.every(
      (item) =>
        item.product.trim() &&
        item.packSize.trim() &&
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
        sum +
        Number(item.returnedQty || 0) *
          Number(item.unitValue || 0),
      0,
    );

    return { issuedQty, returnedQty, returnValue };
  }, [items]);

  function updateItem(
    index: number,
    key: keyof ReturnItem,
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  function resetForm() {
    setRcNo("");
    setDate("");
    setDcNo("");
    setExecutive("");
    setCustomerName("");
    setPlaceOfSupply("");
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
      dcNo: dcNo.trim(),
      executive,
      customerName: customerName.trim(),
      village: village.trim(),
      phone: phone.trim(),
      placeOfSupply: placeOfSupply.trim(),
      items,
      farmer: undefined
    };

    persist([row, ...rows]);
    closeForm();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Return Challan
          </h1>
          <p className="mt-1 text-slate-500">
            Record unsold products returned by executives against delivery challans.
          </p>
        </div>

        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={18} />
          Create Return Challan
        </Button>
      </div>

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
                className="w-[8%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                RC No
              </th>

              <th
                rowSpan={2}
                className="w-[8%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                DC No
              </th>

              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                Executive
              </th>

              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                Farmer Details
              </th>

              <th
                rowSpan={2}
                className="w-[7%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                Products
              </th>

              <th
                rowSpan={2}
                className="w-[8%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                Returned Qty
              </th>

              {/* WITHOUT TAX */}
              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                Without Tax
              </th>

              {/* TAX */}
              <th
                colSpan={3}
                className="w-[18%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold"
              >
                Tax
              </th>

              {/* TOTAL */}
              <th
                rowSpan={2}
                className="w-[9%] px-1.5 py-2.5 text-right font-semibold"
              >
                Total
              </th>
            </tr>

            {/* TAX SUB HEADINGS */}
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">

              <th className="w-[6%] border-r border-slate-100 px-1.5 py-2 text-center font-semibold">
                SGST
              </th>

              <th className="w-[6%] border-r border-slate-100 px-1.5 py-2 text-center font-semibold">
                CGST
              </th>

              <th className="w-[6%] border-r border-slate-200 px-1.5 py-2 text-center font-semibold">
                IGST
              </th>

            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const returnedQty = row.items.reduce(
                (sum, item) =>
                  sum + Number(item.returnedQty || 0),
                0
              );

              const withoutTax = row.items.reduce(
                (sum, item) =>
                  sum +
                  Number(item.returnedQty || 0) *
                    Number(item.unitValue || 0),
                0
              );

              // Tax values
              const sgst = 0;
              const cgst = 0;
              const igst = 0;

              const total =
                withoutTax +
                sgst +
                cgst +
                igst;

              return (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
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

                  {/* RC NO */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-center font-semibold">
                    {row.rcNo}
                  </td>

                  {/* DC NO */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-center">
                    {row.dcNo}
                  </td>

                  {/* EXECUTIVE */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-center">
                    {row.executive}
                  </td>

                  {/* FARMER DETAILS */}
                  <td className="border-r border-slate-200 px-2 py-3 text-center">
                    <p className="font-semibold text-slate-800 truncate">
                      {row.customerName || "-"}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {row.village || "-"}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400 truncate">
                      {row.phone || "-"}
                    </p>
                  </td>

                  {/* PRODUCTS */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-center">
                    {row.items.length}
                  </td>

                  {/* RETURNED QTY */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-center font-bold">
                    {returnedQty}
                  </td>

                  {/* WITHOUT TAX */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                    {formatCurrency(withoutTax)}
                  </td>

                  {/* SGST */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-right text-slate-600 whitespace-nowrap">
                    {formatCurrency(sgst)}
                  </td>

                  {/* CGST */}
                  <td className="border-r border-slate-100 px-1.5 py-3 text-right text-slate-600 whitespace-nowrap">
                    {formatCurrency(cgst)}
                  </td>

                  {/* IGST */}
                  <td className="border-r border-slate-200 px-1.5 py-3 text-right text-slate-600 whitespace-nowrap">
                    {formatCurrency(igst)}
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
                    value={dcNo}
                    onChange={setDcNo}
                    placeholder="e.g. DC-1001"
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
                    label="Place of Supply"
                    value={placeOfSupply}
                    onChange={setPlaceOfSupply}
                    placeholder="e.g. Tamil Nadu"
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
                            product: "",
                            packSize: "",
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
                          <th className="w-[6%] px-2 py-3 text-center">
                            S.No
                          </th>
                          <th className="w-[26%] px-2 py-3 text-left">
                            Product Name
                          </th>
                          <th className="w-[12%] px-2 py-3 text-center">
                            Pkg Size
                          </th>
                          <th className="w-[12%] px-2 py-3 text-center">
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
                                <Input
                                  value={item.product}
                                  onChange={(value) =>
                                    updateItem(
                                      index,
                                      "product",
                                      value,
                                    )
                                  }
                                  placeholder="Product"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  value={item.packSize}
                                  onChange={(value) =>
                                    updateItem(
                                      index,
                                      "packSize",
                                      value,
                                    )
                                  }
                                  placeholder="250 ml"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.issuedQty}
                                  onChange={(value) =>
                                    updateItem(
                                      index,
                                      "issuedQty",
                                      value,
                                    )
                                  }
                                  placeholder="Issued"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.returnedQty}
                                  onChange={(value) =>
                                    updateItem(
                                      index,
                                      "returnedQty",
                                      value,
                                    )
                                  }
                                  placeholder="Return"
                                />
                              </td>

                              <td className="px-2 py-3">
                                <Input
                                  type="number"
                                  value={item.unitValue}
                                  onChange={(value) =>
                                    updateItem(
                                      index,
                                      "unitValue",
                                      value,
                                    )
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
                                        (_, itemIndex) =>
                                          itemIndex !== index,
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

                  <div className="mt-4 ml-auto grid w-full max-w-lg grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4">
                    <div>
                      <p className="text-xs text-slate-400">
                        Issued Qty
                      </p>
                      <p className="mt-1 font-bold text-slate-800">
                        {totals.issuedQty}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Returned Qty
                      </p>
                      <p className="mt-1 font-bold text-slate-800">
                        {totals.returnedQty}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        Return Value
                      </p>
                      <p className="mt-1 font-bold text-brand-700">
                        {formatCurrency(totals.returnValue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={closeForm}
                >
                  Cancel
                </Button>

                <Button
                  onClick={createReturnChallan}
                  disabled={!canCreate}
                >
                  <Icon name="save" size={18} />
                  Create Return Challan
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    Return Challan
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selected.rcNo}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                <div className="rounded-xl border border-slate-300">
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="border-r border-slate-300 p-4">
                      <p className="text-sm font-bold text-slate-900">
                        SAIRAM AGRI INPUTS
                      </p>
                      <p className="text-xs text-slate-600">
                        Rajapalayam, Tamil Nadu
                      </p>
                    </div>

                    <div className="flex items-center justify-center p-4">
                      <h3 className="text-2xl font-bold text-slate-900">
                        Return Challan
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="border-r border-slate-300 p-3 text-sm">
                      <p>
                        <span className="inline-block w-28 font-medium">
                          R.C No
                        </span>
                        : {selected.rcNo}
                      </p>

                      <p className="mt-2">
                        <span className="inline-block w-28 font-medium">
                          R.C Date
                        </span>
                        : {formatDate(selected.date)}
                      </p>
                    </div>

                    <div className="p-3 text-sm">
                      <p>
                        <span className="inline-block w-32 font-medium">
                          Against D.C
                        </span>
                        : {selected.dcNo}
                      </p>

                      <p className="mt-2">
                        <span className="inline-block w-32 font-medium">
                          Executive
                        </span>
                        : {selected.executive}
                      </p>
                    </div>
                  </div>

                  <div className="border-b border-slate-300 p-3 text-sm">
                    <p>
                      <span className="inline-block w-32 font-medium">
                        Customer Name
                      </span>
                      : {selected.customerName || "-"}
                    </p>

                    <p className="mt-2">
                      <span className="inline-block w-32 font-medium">
                        Place of Supply
                      </span>
                      : {selected.placeOfSupply || "-"}
                    </p>
                  </div>

                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="w-[7%] border-r border-slate-300 px-2 py-3 text-center">
                          S.No
                        </th>
                        <th className="w-[28%] border-r border-slate-300 px-2 py-3 text-left">
                          Product Name
                        </th>
                        <th className="w-[12%] border-r border-slate-300 px-2 py-3 text-center">
                          Pkg Size
                        </th>
                        <th className="w-[13%] border-r border-slate-300 px-2 py-3 text-center">
                          Issued Qty
                        </th>
                        <th className="w-[13%] border-r border-slate-300 px-2 py-3 text-center">
                          Returned Qty
                        </th>
                        <th className="w-[13%] border-r border-slate-300 px-2 py-3 text-right">
                          Unit Value
                        </th>
                        <th className="w-[14%] px-2 py-3 text-right">
                          Return Value
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selected.items.map((item, index) => (
                        <tr
                          key={`${selected.id}-${index}`}
                          className="border-b border-slate-200"
                        >
                          <td className="border-r border-slate-300 px-2 py-4 text-center">
                            {index + 1}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-4 font-medium">
                            {item.product}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-4 text-center">
                            {item.packSize}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-4 text-center">
                            {item.issuedQty || "-"}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-4 text-center font-bold">
                            {item.returnedQty}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-4 text-right">
                            {formatCurrency(
                              Number(item.unitValue || 0),
                            )}
                          </td>
                          <td className="px-2 py-4 text-right font-bold">
                            {formatCurrency(
                              Number(item.returnedQty || 0) *
                                Number(item.unitValue || 0),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelected(null)}
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
