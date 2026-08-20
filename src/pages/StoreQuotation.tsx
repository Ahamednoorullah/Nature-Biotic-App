import { useMemo, useState } from "react";
import { Card, Button, Icon, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { createPortal } from "react-dom"; 


type ProductRow = {
  id: string;
  product: string;
  qty: string;
  rate: string;
};

type Row = {
  id: string;
  date: string;
  quotationNo: string;
  farmer: string;
  village: string;
  amount: number;
  status: string;
};

export default function StoreQuotation({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<Row[]>([
    {
      id: "1",
      date: "17 Aug 2026",
      quotationNo: "QT-1001",
      farmer: "Murugan",
      village: "Rajapalayam",
      amount: 8200,
      status: "Open",
    },
    {
      id: "2",
      date: "16 Aug 2026",
      quotationNo: "QT-1000",
      farmer: "Selvam",
      village: "Seithur",
      amount: 5600,
      status: "Converted",
    },
  ]);

  const [show, setShow] = useState(false);

  // Farmer details
  const [farmer, setFarmer] = useState("");
  const [mobile, setMobile] = useState("");
  const [village, setVillage] = useState("");
  const [crop, setCrop] = useState("");

  // Products
  const [products, setProducts] = useState<ProductRow[]>([
    {
      id: String(Date.now()),
      product: "",
      qty: "1",
      rate: "",
    },
  ]);

  // Remarks
  const [remarks, setRemarks] = useState("");

  // Tax
  const [cgst, setCgst] = useState("0");
  const [sgst, setSgst] = useState("0");
  const [igst, setIgst] = useState("0");

  const subtotal = useMemo(() => {
    return products.reduce((total, item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;

      return total + qty * rate;
    }, 0);
  }, [products]);

  const cgstAmount = useMemo(() => {
    return (subtotal * (Number(cgst) || 0)) / 100;
  }, [subtotal, cgst]);

  const sgstAmount = useMemo(() => {
    return (subtotal * (Number(sgst) || 0)) / 100;
  }, [subtotal, sgst]);

  const igstAmount = useMemo(() => {
    return (subtotal * (Number(igst) || 0)) / 100;
  }, [subtotal, igst]);

  const grandTotal = useMemo(() => {
    return subtotal + cgstAmount + sgstAmount + igstAmount;
  }, [subtotal, cgstAmount, sgstAmount, igstAmount]);

  function openQuotation() {
    setShow(true);
  }

  function closeQuotation() {
    setShow(false);
  }

  function addProduct() {
    setProducts((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        product: "",
        qty: "1",
        rate: "",
      },
    ]);
  }

  function removeProduct(id: string) {
    setProducts((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }

  function updateProduct(
    id: string,
    field: keyof ProductRow,
    value: string
  ) {
    setProducts((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function resetForm() {
    setFarmer("");
    setMobile("");
    setVillage("");
    setCrop("");
    setRemarks("");
    setCgst("0");
    setSgst("0");
    setIgst("0");

    setProducts([
      {
        id: String(Date.now()),
        product: "",
        qty: "1",
        rate: "",
      },
    ]);
  }

  function save() {
    const hasValidProduct = products.some(
      (item) =>
        item.product.trim() &&
        Number(item.qty) > 0 &&
        Number(item.rate) > 0
    );

    if (!farmer.trim()) {
      alert("Please enter farmer name.");
      return;
    }

    if (!mobile.trim()) {
      alert("Please enter mobile number.");
      return;
    }

    if (!hasValidProduct) {
      alert("Please add at least one product.");
      return;
    }

    const newQuotation: Row = {
      id: String(Date.now()),
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      quotationNo: `QT-${1001 + rows.length}`,
      farmer,
      village,
      amount: grandTotal,
      status: "Open",
    };

    setRows((prev) => [newQuotation, ...prev]);

    resetForm();
    setShow(false);
  }

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Quotation
          </h1>

          <p className="mt-1 text-slate-500">
            Create and manage farmer quotations.
          </p>
        </div>

        <Button onClick={openQuotation}>
          <Icon name="add" size={18} />
          New Quotation
        </Button>
      </div>

      {/* QUOTATION TABLE */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Quotation No</th>
              <th className="px-5 py-3 text-left">Farmer</th>
              <th className="px-5 py-3 text-left">Village</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">{r.date}</td>

                <td className="px-5 py-4 font-semibold text-slate-800">
                  {r.quotationNo}
                </td>

                <td className="px-5 py-4">{r.farmer}</td>

                <td className="px-5 py-4">{r.village}</td>

                <td className="px-5 py-4 text-right font-bold">
                  {formatCurrency(r.amount)}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.status === "Converted"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* =========================
          NEW QUOTATION POPUP
         ========================= */}
      {show &&
      createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Create Quotation
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Create a quotation for farmer
                </p>
              </div>

              <button
                type="button"
                onClick={closeQuotation}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-6">
                {/* FARMER DETAILS */}
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
                    Farmer Details
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Input
                      label="Farmer Name"
                      value={farmer}
                      onChange={setFarmer}
                    />

                    <Input
                      label="Mobile Number"
                      type="tel"
                      value={mobile}
                      onChange={setMobile}
                    />

                    <Input
                      label="Village"
                      value={village}
                      onChange={setVillage}
                    />

                    <Input
                      label="Crop"
                      value={crop}
                      onChange={setCrop}
                    />
                  </div>
                </div>

                {/* PRODUCTS */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                        Products
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Add products for this quotation
                      </p>
                    </div>

                    <Button onClick={addProduct}>
                      <Icon name="add" size={16} />
                      Add Product
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    {/* PRODUCT HEADER */}
                    <div className="hidden grid-cols-[1fr_120px_150px_150px_50px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
                      <div>Product</div>
                      <div>Qty</div>
                      <div>Rate</div>
                      <div className="text-right">Amount</div>
                      <div></div>
                    </div>

                    {/* PRODUCT ROWS */}
                    <div className="divide-y divide-slate-200">
                      {products.map((item, index) => {
                        const amount =
                          (Number(item.qty) || 0) *
                          (Number(item.rate) || 0);

                        return (
                          <div
                            key={item.id}
                            className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_120px_150px_150px_50px] md:items-center"
                          >
                            {/* PRODUCT */}
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                                Product
                              </label>

                              <Input
                                value={item.product}
                                onChange={(value) =>
                                  updateProduct(
                                    item.id,
                                    "product",
                                    value
                                  )
                                }
                              />
                            </div>

                            {/* QTY */}
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                                Qty
                              </label>

                              <Input
                                type="number"
                                value={item.qty}
                                onChange={(value) =>
                                  updateProduct(
                                    item.id,
                                    "qty",
                                    value
                                  )
                                }
                              />
                            </div>

                            {/* RATE */}
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                                Rate
                              </label>

                              <Input
                                type="number"
                                value={item.rate}
                                onChange={(value) =>
                                  updateProduct(
                                    item.id,
                                    "rate",
                                    value
                                  )
                                }
                              />
                            </div>

                            {/* AMOUNT */}
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                                Amount
                              </label>

                              <div className="flex h-10 items-center justify-end rounded-lg bg-slate-50 px-3 font-bold text-slate-800">
                                {formatCurrency(amount)}
                              </div>
                            </div>

                            {/* DELETE */}
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  removeProduct(item.id)
                                }
                                disabled={products.length === 1}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                title="Remove product"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* BOTTOM SECTION */}
                <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                  {/* REMARKS */}
                  <div>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
                      Remarks
                    </h3>

                    <textarea
                      value={remarks}
                      onChange={(e) =>
                        setRemarks(e.target.value)
                      }
                      placeholder="Enter any additional remarks..."
                      rows={7}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  {/* SUMMARY */}
                  <div>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
                      Quotation Summary
                    </h3>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      {/* SUBTOTAL */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <span className="text-sm text-slate-500">
                          Subtotal
                        </span>

                        <span className="font-semibold text-slate-800">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>

                      {/* CGST */}
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">
                            CGST
                          </span>

                          <div className="w-20">
                            <Input
                              type="number"
                              value={cgst}
                              onChange={setCgst}
                            />
                          </div>

                          <span className="text-sm text-slate-400">
                            %
                          </span>
                        </div>

                        <span className="font-medium text-slate-700">
                          {formatCurrency(cgstAmount)}
                        </span>
                      </div>

                      {/* SGST */}
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">
                            SGST
                          </span>

                          <div className="w-20">
                            <Input
                              type="number"
                              value={sgst}
                              onChange={setSgst}
                            />
                          </div>

                          <span className="text-sm text-slate-400">
                            %
                          </span>
                        </div>

                        <span className="font-medium text-slate-700">
                          {formatCurrency(sgstAmount)}
                        </span>
                      </div>

                      {/* IGST */}
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">
                            IGST
                          </span>

                          <div className="w-20">
                            <Input
                              type="number"
                              value={igst}
                              onChange={setIgst}
                            />
                          </div>

                          <span className="text-sm text-slate-400">
                            %
                          </span>
                        </div>

                        <span className="font-medium text-slate-700">
                          {formatCurrency(igstAmount)}
                        </span>
                      </div>

                      {/* GRAND TOTAL */}
                      <div className="mt-5 flex items-center justify-between border-t border-slate-300 pt-4">
                        <span className="text-base font-bold text-slate-800">
                          Grand Total
                        </span>

                        <span className="text-xl font-bold text-emerald-700">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeQuotation}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <Button onClick={save}>
                Save Quotation
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}