import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { createPortal } from "react-dom"; 
import { products as allProducts } from "@/lib/data";
import { formatDate } from "@/lib/format";


type ProductRow = {
  id: string;
  product: string;
  pkgsize: string;
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
      date: "17/08/2026",
      quotationNo: "QT-1001",
      farmer: "Murugan",
      village: "Rajapalayam",
      amount: 8200,
      status: "Open",
    },
    {
      id: "2",
      date: "16/08/2026",
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
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [acre, setAcre] = useState("");

  // Products
  const [products, setProducts] = useState<ProductRow[]>([
    {
      id: String(Date.now()),
      product: "",
      pkgsize: "",
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
        pkgsize: "",
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
    setPlaceOfSupply("");
    setAcre("");

    setProducts([
      {
        id: String(Date.now()),
        product: "",
        pkgsize: "",
        qty: "1",
        rate: "",
      },
    ]);
  }

    const canSave =
    farmer.trim() !== "" &&
    mobile.trim() !== "" &&
    products.some(
      (item) => item.product.trim() && Number(item.qty) > 0 && Number(item.rate) > 0,
    );

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
      date: new Date().toISOString().split("T")[0],
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
              <th className="px-5 py-3 border-b border text-left">Date</th>
              <th className="px-5 py-3 border-b border text-left">Quotation No</th>
              <th className="px-5 py-3 border-b border text-left">Farmer</th>
              <th className="px-5 py-3 border-b border text-left">Village</th>
              <th className="px-5 py-3 border-b border text-right">Amount</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">{formatDate(r.date)}</td>

                <td className="px-5 py-4 border-b border font-semibold text-slate-800">
                  {r.quotationNo}
                </td>

                <td className="px-5 py-4 border-b border">{r.farmer}</td>

                <td className="px-5 py-4 border-b border">{r.village}</td>

                <td className="px-5 py-4 border-b border text-right font-bold">
                  {formatCurrency(r.amount)}
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

                  <div className="grid gap-4 md:grid-cols-3">
                  {/* ROW 1 */}

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

                  {/* ROW 2 */}

                  <Input
                    label="Crop"
                    value={crop}
                    onChange={setCrop}
                  />

                  <Select
                    label="Place of Supply"
                    value={placeOfSupply}
                    onChange={(value) => {
                      setPlaceOfSupply(value);

                      if (value === "Tamil Nadu") {
                        setCgst("9");
                        setSgst("9");
                        setIgst("0");
                      } else {
                        setCgst("0");
                        setSgst("0");
                        setIgst("18");
                      }
                    }}
                    placeholder="Select Place of Supply"
                    options={[
                      {
                        value: "Tamil Nadu",
                        label: "Tamil Nadu",
                      },
                      {
                        value: "Others",
                        label: "Others",
                      },
                    ]}
                  />

                  <Input
                    label="Acre"
                    type="number"
                    value={acre}
                    onChange={setAcre}
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
                    <div className="grid gap-3 px-4 py-3 grid-cols-[minmax(180px,1fr)_200px_120px_140px_130px_50px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
                    <div>Product</div>
                    <div>PKG Size</div>
                    <div>Qty</div>
                    <div>Price</div>
                    <div className="text-right">Total Amount</div>
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
                            className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_200px_120px_140px_130px_50px] md:items-center">
                          
                            {/* PRODUCT */}
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                                Product
                              </label>

                              <Select
                                value={item.product}
                                onChange={(value) => {
                                const selectedProduct = allProducts.find(
                                  (p) => p.id === value
                                );

                                updateProduct(item.id, "product", value);

                                if (selectedProduct) {
                                  updateProduct(
                                    item.id,
                                    "pkgsize",
                                    selectedProduct.size || ""
                                  );

                                  updateProduct(
                                    item.id,
                                    "rate",
                                    String(selectedProduct.sellingPrice || 0)
                                  );
                                }
                              }}
                                placeholder="Select Product"
                                options={allProducts.map((p) => ({
                                  value: p.id,
                                  label: `${p.name} (${p.size})`,
                                }))}
                              />
                            </div>

                          {/* PKG SIZE */}
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-500 md:hidden">
                              PKG Size
                            </label>

                            <Select
                              value={item.pkgsize}
                              onChange={(value) =>
                                updateProduct(item.id, "pkgsize", value)
                              }
                              placeholder="Select size"
                              options={[
                                { value: "100ml", label: "100 ml" },
                                { value: "250ml", label: "250 ml" },
                                { value: "500ml", label: "500 ml" },
                                { value: "1l", label: "1 L" },
                                { value: "100g", label: "100 g" },
                                { value: "250g", label: "250 g" },
                                { value: "500g", label: "500 g" },
                                { value: "1kg", label: "1 Kg" },
                                { value: "5kg", label: "5 Kg" },
                                { value: "10kg", label: "10 Kg" },
                                { value: "25kg", label: "25 Kg" },
                              ]}
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
                      onChange={(e) => setRemarks(e.target.value)}
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

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="space-y-3 text-sm">
                        {/* SUBTOTAL */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            Subtotal
                          </span>

                          <span className="font-semibold text-slate-800">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>

                        {/* TOTAL TAX */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            Total Tax
                          </span>

                          <span className="font-semibold text-slate-800">
                            {formatCurrency(
                              cgstAmount + sgstAmount + igstAmount
                            )}
                          </span>
                        </div>

                        {/* TAX BREAKDOWN */}
                        <div className="space-y-2 border-t border-slate-200 pt-3 pl-4">
                          {/* SGST */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              SGST
                            </span>

                            <span className="text-xs font-medium text-slate-600">
                              {formatCurrency(sgstAmount)}
                            </span>
                          </div>

                          {/* CGST */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              CGST
                            </span>

                            <span className="text-xs font-medium text-slate-600">
                              {formatCurrency(cgstAmount)}
                            </span>
                          </div>

                          {/* IGST */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              IGST
                            </span>

                            <span className="text-xs font-medium text-slate-600">
                              {formatCurrency(igstAmount)}
                            </span>
                          </div>
                        </div>

                        {/* GRAND TOTAL */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-300 pt-4">
                          <span className="font-bold text-slate-800">
                            Grand Total
                          </span>

                          <span className="text-lg font-bold text-emerald-700">
                            {formatCurrency(grandTotal)}
                          </span>
                        </div>
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

              <Button
                onClick={save}
                disabled={!canSave}
              >
                Save Quotation
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}