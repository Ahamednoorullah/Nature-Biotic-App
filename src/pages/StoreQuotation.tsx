import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { createPortal } from "react-dom"; 
import { products as allProducts, getFarmersByStore, getStorePurchasesFromCompanySales } from "@/lib/data";
import { formatDate } from "@/lib/format";


type ProductRow = {
  id: string;
  product: string;
  productName: string;
  pkgsize: string;
  qty: string;
  rate: string;
  taxPercent: number;
  sgstPercent: number;
  cgstPercent: number;
  igstPercent: number;
};

type Row = {
  roundOff: number;
  id: string;
  date: string;
  quotationNo: string;
  farmerId: string;
  farmer: string;
  phone: string;
  village: string;
  crop: string;
  acre: string;
  placeOfSupply: string;
  remarks: string;
  products: ProductRow[];
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  status: string;
};

export default function StoreQuotation({ storeId }: { storeId: string }) {
  const registeredFarmers = useMemo(
    () => getFarmersByStore(storeId),
    [storeId],
  );

  const storePurchaseRows = useMemo(
    () => (getStorePurchasesFromCompanySales(storeId) || []) as any[],
    [storeId],
  );

  const stockProducts = useMemo(() => {
    const unique = new Map<
      string,
      {
        key: string;
        productId: string;
        name: string;
        size: string;
        sellingPrice: number;
        taxPercentage: number;
        availableQty: number;
      }
    >();

    storePurchaseRows.forEach((row: any, index: number) => {
      const name = String(
        row.productName ??
          row.product ??
          allProducts.find((product) => product.id === row.productId)?.name ??
          "",
      ).trim();

      if (!name) return;

      const master = allProducts.find(
        (product) =>
          product.id === row.productId ||
          product.name.toLowerCase() === name.toLowerCase(),
      );

      const size = String(
        row.packSize ??
          row.pkgsize ??
          row.size ??
          master?.size ??
          "",
      ).trim();

      const qty = Number(row.quantity ?? row.qty ?? 0);
      if (qty <= 0) return;

      const sellingPrice = Number(
        row.sellingPrice ??
          row.price ??
          master?.sellingPrice ??
          0,
      );

      const taxPercentage = Number(
        row.taxPercent ??
          row.taxPercentage ??
          master?.taxPercentage ??
          0,
      );

      const key = `${master?.id ?? row.productId ?? name}-${size || "default"}`;

      const existing = unique.get(key);

      if (existing) {
        existing.availableQty += qty;
      } else {
        unique.set(key, {
          key,
          productId: String(master?.id ?? row.productId ?? `purchase-${index}`),
          name,
          size,
          sellingPrice,
          taxPercentage,
          availableQty: qty,
        });
      }
    });

    return Array.from(unique.values());
  }, [storePurchaseRows]);

  const storeProducts = stockProducts;

  const [selectedQuotation, setSelectedQuotation] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[]>([
    {
      id: "1",
      date: "17/08/2026",
      quotationNo: "QT-1001",
      farmerId: "",
      farmer: "Murugan",
      phone: "9876543210",
      village: "Rajapalayam",
      crop: "Cotton",
      acre: "4.5",
      placeOfSupply: "Tamil Nadu",
      remarks: "",
      products: [
        {
          id: "qt-1001-p1",
          product: "p0",
          productName: "Electra",
          pkgsize: "250 ml",
          qty: "10",
          rate: "820",
          taxPercent: 0,
          sgstPercent: 0,
          cgstPercent: 0,
          igstPercent: 0,
        },
      ],
      withoutTax: 8200,
      sgst: 0,
      cgst: 0,
      igst: 0,
      roundOff: 0,
      amount: 8200,
      status: "Open",
    },
    {
      id: "2",
      date: "16/08/2026",
      quotationNo: "QT-1000",
      farmerId: "",
      farmer: "Selvam",
      phone: "9876543211",
      village: "Seithur",
      crop: "",
      acre: "",
      placeOfSupply: "Tamil Nadu",
      remarks: "",
      products: [
        {
          id: "qt-1000-p1",
          product: "p1",
          productName: "Astra",
          pkgsize: "500 ml",
          qty: "10",
          rate: "560",
          taxPercent: 0,
          sgstPercent: 0,
          cgstPercent: 0,
          igstPercent: 0,
        },
      ],
      withoutTax: 5600,
      sgst: 0,
      cgst: 0,
      igst: 0,
      roundOff: 0,
      amount: 5600,
      status: "Converted",
    },
  ]);

  const [show, setShow] = useState(false);

  // Farmer details
  const [farmerId, setFarmerId] = useState("");
  const [farmer, setFarmer] = useState("");
  const [phone, setMobile] = useState("");
  const [village, setVillage] = useState("");
  const [crop, setCrop] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [acre, setAcre] = useState("");

  // Products added to quotation
  const [products, setProducts] = useState<ProductRow[]>([]);

  const emptyDraftProduct = (): ProductRow => ({
    id: String(Date.now()),
    product: "",
    productName: "",
    pkgsize: "",
    qty: "1",
    rate: "",
    taxPercent: 0,
    sgstPercent: 0,
    cgstPercent: 0,
    igstPercent: 0,
  });

  const [draftProduct, setDraftProduct] = useState<ProductRow>(
    emptyDraftProduct(),
  );

  const productNameOptions = useMemo(() => {
    const names = Array.from(
      new Set(storeProducts.map((item) => item.name)),
    );

    return names.map((name) => ({
      value: name,
      label: name,
    }));
  }, [storeProducts]);

  const sizeOptions = useMemo(() => {
    if (!draftProduct.product) return [];

    return storeProducts
      .filter((item) => item.name === draftProduct.product)
      .map((item) => ({
        value: item.size,
        label: item.size,
      }));
  }, [storeProducts, draftProduct.product]);

  const selectedStockVariant = useMemo(
    () =>
      storeProducts.find(
        (item) =>
          item.name === draftProduct.product &&
          item.size === draftProduct.pkgsize,
      ),
    [storeProducts, draftProduct.product, draftProduct.pkgsize],
  );

  // Remarks
  const [remarks, setRemarks] = useState("");

  // Tax

  const subtotal = useMemo(() => {
    return products.reduce((total, item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      return total + qty * rate;
    }, 0);
  }, [products]);

  const taxTotals = useMemo(() => {
    return products.reduce(
      (total, item) => {
        const base =
          (Number(item.qty) || 0) * (Number(item.rate) || 0);

        total.sgst +=
          (base * Number(item.sgstPercent || 0)) / 100;
        total.cgst +=
          (base * Number(item.cgstPercent || 0)) / 100;
        total.igst +=
          (base * Number(item.igstPercent || 0)) / 100;

        return total;
      },
      { sgst: 0, cgst: 0, igst: 0 },
    );
  }, [products]);

  const sgstAmount = taxTotals.sgst;
  const cgstAmount = taxTotals.cgst;
  const igstAmount = taxTotals.igst;

  const grandTotal = useMemo(
    () => subtotal + sgstAmount + cgstAmount + igstAmount,
    [subtotal, sgstAmount, cgstAmount, igstAmount],
  );

  const quotationTaxRates = useMemo(() => {
    const activeItems = products.filter(
      (item) =>
        item.product &&
        Number(item.qty) > 0 &&
        Number(item.rate) > 0,
    );

    const getCommon = (
      field: "sgstPercent" | "cgstPercent" | "igstPercent",
    ) => {
      const values = Array.from(
        new Set(activeItems.map((item) => Number(item[field] || 0))),
      );

      return values.length === 1 ? values[0] : null;
    };

    return {
      sgst: getCommon("sgstPercent"),
      cgst: getCommon("cgstPercent"),
      igst: getCommon("igstPercent"),
    };
  }, [products]);

  function applyFarmerDetails(id: string) {
    setFarmerId(id);

    const selectedFarmer = registeredFarmers.find(
      (item) => item.id === id,
    );

    if (!selectedFarmer) {
      setFarmer("");
      setMobile("");
      setVillage("");
      setCrop("");
      setAcre("");
      return;
    }

    setFarmer(selectedFarmer.name || "");
    setMobile(selectedFarmer.phone || "");
    setVillage(selectedFarmer.village || "");

    const farmerCrop =
      selectedFarmer.cropType ||
      selectedFarmer.crops?.[0]?.cropType ||
      "";
    setCrop(farmerCrop);

    const landSize =
      Number(selectedFarmer.landSize || 0) ||
      Number(selectedFarmer.crops?.[0]?.landSize || 0);
    setAcre(landSize > 0 ? String(landSize) : "");

    const supply =
      (selectedFarmer.state || "").toLowerCase() === "tamil nadu"
        ? "Tamil Nadu"
        : "Others";

    setPlaceOfSupply(supply);
    applyTaxForSupply(supply);
  }

  function getTaxSplit(supply: string, taxPercent: number) {
    if (!supply || taxPercent <= 0) {
      return {
        sgstPercent: 0,
        cgstPercent: 0,
        igstPercent: 0,
      };
    }

    if (supply === "Tamil Nadu") {
      return {
        sgstPercent: taxPercent / 2,
        cgstPercent: taxPercent / 2,
        igstPercent: 0,
      };
    }

    return {
      sgstPercent: 0,
      cgstPercent: 0,
      igstPercent: taxPercent,
    };
  }

  function applyTaxForSupply(supply: string) {
    setProducts((current) =>
      current.map((item) => {
        const split = getTaxSplit(
          supply,
          Number(item.taxPercent || 0),
        );

        return {
          ...item,
          ...split,
        };
      }),
    );


  }

  function openQuotation() {
    setShow(true);
  }

  function closeQuotation() {
    setShow(false);
  }

  function addProduct() {
    if (!draftProduct.product) {
      alert("Please select a product.");
      return;
    }

    if (!draftProduct.pkgsize) {
      alert("Please select a package size.");
      return;
    }

    if (!selectedStockVariant) {
      alert("Selected product size is not available in store stock.");
      return;
    }

    const qty = Number(draftProduct.qty || 0);
    if (qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const split = getTaxSplit(
      placeOfSupply,
      Number(selectedStockVariant.taxPercentage || 0),
    );

    const nextItem: ProductRow = {
      id: `${Date.now()}-${selectedStockVariant.key}`,
      product: selectedStockVariant.name,
      productName: selectedStockVariant.name,
      pkgsize: selectedStockVariant.size,
      qty: String(qty),
      rate: String(selectedStockVariant.sellingPrice || 0),
      taxPercent: Number(selectedStockVariant.taxPercentage || 0),
      ...split,
    };

    setProducts((prev) => [...prev, nextItem]);
    setDraftProduct(emptyDraftProduct());
  }

  function removeProduct(id: string) {
    setProducts((prev) => prev.filter((item) => item.id !== id));
  }

  function updateAddedProduct(
    id: string,
    field: "qty",
    value: string,
  ) {
    setProducts((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function resetForm() {
    setFarmerId("");
    setFarmer("");
    setMobile("");
    setVillage("");
    setCrop("");
    setRemarks("");
    setPlaceOfSupply("");
    setAcre("");
    setProducts([]);
    setDraftProduct(emptyDraftProduct());
  }

    const canSave =
    farmer.trim() !== "" &&
      phone.trim() !== "" &&
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

    if (!phone.trim()) {
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
      farmerId,
      farmer,
      phone,
      village,
      crop,
      acre,
      placeOfSupply,
      remarks,
      products: products.map((item) => ({ ...item })),
      withoutTax: subtotal,
      sgst: sgstAmount,
      cgst: cgstAmount,
      igst: igstAmount,
      roundOff: Math.round(grandTotal) - grandTotal,
      amount: grandTotal,
      status: "Open",
    };

    setRows((prev) => [newQuotation, ...prev]);

    resetForm();
    setShow(false);
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
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th rowSpan={2} className="w-[4%] border-r border-slate-200 px-2 py-2 text-center font-semibold">
                S.No
              </th>
              <th rowSpan={2} className="w-[8%] border-r border-slate-200 px-2 py-2 text-center font-semibold">
                Date
              </th>
              <th rowSpan={2} className="w-[10%] border-r border-slate-200 px-2 py-2 text-center font-semibold">
                Quotation No
              </th>
              <th rowSpan={2} className="w-[15%] border-r border-slate-200 px-2 py-2 text-center font-semibold">
                Farmer Details
              </th>
              <th rowSpan={2} className="w-[10%] border-r border-slate-200 px-2 py-2 text-center font-semibold">
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

              <th rowSpan={2} className="w-[11%] px-2 py-2 text-right font-semibold">
                Total
              </th>
            </tr>

            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="border-r border-slate-200 px-1 py-2 text-center">%</th>
              <th className="border-r border-slate-200 px-1 py-2 text-center">Amt</th>
              <th className="border-r border-slate-200 px-1 py-2 text-center">%</th>
              <th className="border-r border-slate-200 px-1 py-2 text-center">Amt</th>
              <th className="border-r border-slate-200 px-1 py-2 text-center">%</th>
              <th className="border-r border-slate-200 px-1 py-2 text-center">Amt</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, index) => (
              <tr
                key={r.id}
                onClick={() => setSelectedQuotation(r)}
                className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                title="Click to view quotation"
              >

                {/* S.NO */}
                <td className="border-r border-slate-100 px-2 py-3 text-center">
                  {index + 1}
                </td>

                {/* DATE */}
                <td className="border-r border-slate-100 px-2 py-3 text-center whitespace-nowrap">
                  {formatDate(r.date)}
                </td>

                {/* QUOTATION NO */}
                <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                  {r.quotationNo}
                </td>

                {/* FARMER DETAILS */}
                <td className="border-r border-slate-100 px-2 py-3 text-center">
                  <p className="font-semibold text-slate-800">
                    {r.farmer}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.village || "-"}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    {r.phone || "-"}
                  </p>
                </td>

                {/* WITHOUT TAX */}
                <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-700">
                  {formatCurrency(r.withoutTax)}
                </td>

                <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                  {(() => {
                    const values = Array.from(
                      new Set(
                        (r.products || [])
                          .filter((item) => Number(item.sgstPercent || 0) > 0)
                          .map((item) => Number(item.sgstPercent || 0)),
                      ),
                    );
                    return values.length === 0
                      ? "0.00"
                      : values.length === 1
                        ? values[0].toFixed(2)
                        : "Mix";
                  })()}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.sgst)}
                </td>

                <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                  {(() => {
                    const values = Array.from(
                      new Set(
                        (r.products || [])
                          .filter((item) => Number(item.cgstPercent || 0) > 0)
                          .map((item) => Number(item.cgstPercent || 0)),
                      ),
                    );
                    return values.length === 0
                      ? "0.00"
                      : values.length === 1
                        ? values[0].toFixed(2)
                        : "Mix";
                  })()}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.cgst)}
                </td>

                <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                  {(() => {
                    const values = Array.from(
                      new Set(
                        (r.products || [])
                          .filter((item) => Number(item.igstPercent || 0) > 0)
                          .map((item) => Number(item.igstPercent || 0)),
                      ),
                    );
                    return values.length === 0
                      ? "0.00"
                      : values.length === 1
                        ? values[0].toFixed(2)
                        : "Mix";
                  })()}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.igst)}
                </td>

                {/* TOTAL */}
                <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
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

                  <Select
                    label="Farmer"
                    value={farmerId}
                    onChange={applyFarmerDetails}
                    placeholder="Select registered farmer"
                    options={registeredFarmers.map((item) => ({
                      value: item.id,
                      label: `${item.name} - ${item.phone}`,
                    }))}
                  />

                  <Input
                    label="Mobile Number"
                    type="tel"
                    value={phone}
                    onChange={() => {}}
                    readOnly
                  />

                  <Input
                    label="Village"
                    value={village}
                    onChange={() => {}}
                    readOnly
                  />

                  {/* ROW 2 */}

                  <Input
                    label="Crop"
                    value={crop}
                    onChange={() => {}}
                    readOnly
                  />

                  <Select
                    label="Place of Supply"
                    value={placeOfSupply}
                    onChange={(value) => {
                      setPlaceOfSupply(value);
                      applyTaxForSupply(value);
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
                    onChange={() => {}}
                    readOnly
                  />
                </div>

                </div>

                {/* PRODUCTS */}
                <div>
                  <div className="mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                      Add Product
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Select products available in this store stock
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1.4fr)_180px_100px_140px_100px_150px] md:items-end">
                      <Select
                        label="Product"
                        value={draftProduct.product}
                        onChange={(value) => {
                          setDraftProduct((current) => ({
                            ...current,
                            product: value,
                            productName: value,
                            pkgsize: "",
                            rate: "",
                            taxPercent: 0,
                            sgstPercent: 0,
                            cgstPercent: 0,
                            igstPercent: 0,
                          }));
                        }}
                        placeholder={
                          productNameOptions.length
                            ? "Select product"
                            : "No stock products"
                        }
                        options={productNameOptions}
                      />

                      <Select
                        label="PKG Size"
                        value={draftProduct.pkgsize}
                        onChange={(value) => {
                          const variant = storeProducts.find(
                            (item) =>
                              item.name === draftProduct.product &&
                              item.size === value,
                          );

                          if (!variant) {
                            setDraftProduct((current) => ({
                              ...current,
                              pkgsize: value,
                            }));
                            return;
                          }

                          const split = getTaxSplit(
                            placeOfSupply,
                            Number(variant.taxPercentage || 0),
                          );

                          setDraftProduct((current) => ({
                            ...current,
                            pkgsize: variant.size,
                            rate: String(variant.sellingPrice || 0),
                            taxPercent: Number(
                              variant.taxPercentage || 0,
                            ),
                            ...split,
                          }));
                        }}
                        placeholder={
                          draftProduct.product
                            ? "Select size"
                            : "Select product first"
                        }
                        options={sizeOptions}
                      />

                      <Input
                        label="Qty"
                        type="number"
                        value={draftProduct.qty}
                        onChange={(value) =>
                          setDraftProduct((current) => ({
                            ...current,
                            qty: value,
                          }))
                        }
                      />

                      <Input
                        label="Price"
                        value={draftProduct.rate}
                        onChange={() => {}}
                        placeholder="Auto"
                        readOnly
                      />

                      <Input
                        label="GST %"
                        value={
                          draftProduct.taxPercent
                            ? draftProduct.taxPercent.toFixed(2)
                            : "0.00"
                        }
                        onChange={() => {}}
                        readOnly
                      />

                      <Button onClick={addProduct} className="h-10">
                        <Icon name="add" size={17} />
                        Add Product
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                          Added Products
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {products.length} item(s) added
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full table-fixed border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <th className="w-[5%] px-2 py-3 text-center">S.No</th>
                            <th className="w-[20%] px-3 py-3 text-left">Product</th>
                            <th className="w-[11%] px-2 py-3 text-center">PKG Size</th>
                            <th className="w-[9%] px-2 py-3 text-center">Qty</th>
                            <th className="w-[12%] px-2 py-3 text-right">Price</th>
                            <th className="w-[9%] px-2 py-3 text-center">GST %</th>
                            <th className="w-[12%] px-2 py-3 text-right">Without Tax</th>
                            <th className="w-[12%] px-2 py-3 text-right">Tax</th>
                            <th className="w-[12%] px-2 py-3 text-right">Total</th>
                            <th className="w-[5%] px-2 py-3 text-center"></th>
                          </tr>
                        </thead>

                        <tbody>
                          {products.length === 0 ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="px-4 py-10 text-center text-sm text-slate-400"
                              >
                                No products added yet.
                              </td>
                            </tr>
                          ) : (
                            products.map((item, index) => {
                              const withoutTax =
                                Number(item.qty || 0) *
                                Number(item.rate || 0);
                              const tax =
                                (withoutTax *
                                  Number(item.taxPercent || 0)) /
                                100;
                              const total = withoutTax + tax;

                              return (
                                <tr
                                  key={item.id}
                                  className="border-t border-slate-100"
                                >
                                  <td className="px-2 py-3 text-center">
                                    {index + 1}
                                  </td>
                                  <td className="px-3 py-3 font-semibold text-slate-800">
                                    {item.productName}
                                  </td>
                                  <td className="px-2 py-3 text-center text-slate-600">
                                    {item.pkgsize}
                                  </td>
                                  <td className="px-2 py-3">
                                    <Input
                                      type="number"
                                      value={item.qty}
                                      onChange={(value) =>
                                        updateAddedProduct(
                                          item.id,
                                          "qty",
                                          value,
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    {formatCurrency(
                                      Number(item.rate || 0),
                                    )}
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    {Number(
                                      item.taxPercent || 0,
                                    ).toFixed(2)}
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    {formatCurrency(withoutTax)}
                                  </td>
                                  <td className="px-2 py-3 text-right">
                                    {formatCurrency(tax)}
                                  </td>
                                  <td className="px-2 py-3 text-right font-bold text-slate-800">
                                    {formatCurrency(total)}
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeProduct(item.id)
                                      }
                                      className="text-red-400 hover:text-red-600"
                                    >
                                      <Icon name="delete" size={17} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
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
                        <div className="space-y-2 border-t border-slate-200 pt-3 pl-8">
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

      {selectedQuotation &&
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

                .quotation-print-area,
                .quotation-print-area * {
                  visibility: visible !important;
                }

                .quotation-print-area {
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

                .quotation-screen-only {
                  display: none !important;
                }

                .quotation-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }
              }
            `}</style>

            <div className="quotation-print-area flex h-[96vh] w-[98.5vw] max-w-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="quotation-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Quotation
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectedQuotation.quotationNo}
                  </h2>
                  <span className="mt-2 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {selectedQuotation.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedQuotation(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="quotation-scroll min-h-0 flex-1 overflow-y-auto p-3">
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
                            SAIRAM AGRI INPUTS
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                            Rajapalayam, Tamil Nadu
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Nature Biotic Store
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center px-4 py-3">
                      <div className="text-center">
                        <h3 className="text-2xl font-extrabold uppercase text-slate-900">
                          Quotation
                        </h3>
                        {/* <p className="mt-1 text-[10px] text-slate-500">
                          Farmer Product Quotation
                        </p> */}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Farmer Details
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedQuotation.farmer}
                      </p>
                      <p className="text-slate-600">
                        {selectedQuotation.village || "-"}
                      </p>
                      <p className="text-slate-600">
                        Contact: {selectedQuotation.phone || "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Farm Details
                      </p>
                      <p className="text-slate-600">
                        Crop:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedQuotation.crop || "-"}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Acre:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedQuotation.acre || "-"}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Place of Supply:{" "}
                        <span className="font-semibold text-slate-800">
                          {selectedQuotation.placeOfSupply || "-"}
                        </span>
                      </p>
                    </div>

                    <div className="px-3 py-2.5">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Quotation Details
                      </p>
                      <div className="grid grid-cols-[110px_1fr] gap-y-0.5">
                        <span className="text-slate-500">Quotation No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedQuotation.quotationNo}
                        </span>

                        <span className="text-slate-500">Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(selectedQuotation.date)}
                        </span>

                        <span className="text-slate-500">Status</span>
                        <span className="font-semibold text-slate-800">
                          {selectedQuotation.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
                          <th rowSpan={2} className="w-[4%] border-r border-slate-300 px-2 py-2 text-center">
                            S.No
                          </th>
                          <th rowSpan={2} className="w-[18%] border-r border-slate-300 px-2 py-2 text-left">
                            Product
                          </th>
                          <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-2 py-2 text-center">
                            Pkg Size
                          </th>
                          <th rowSpan={2} className="w-[5%] border-r border-slate-300 px-2 py-2 text-center">
                            Qty
                          </th>
                          <th rowSpan={2} className="w-[8%] border-r border-slate-300 px-2 py-2 text-right">
                            Rate
                          </th>
                          <th rowSpan={2} className="w-[10%] border-r border-slate-300 px-2 py-2 text-right">
                            Without Tax
                          </th>

                          <th colSpan={2} className="w-[10%] border-r border-slate-300 px-1 py-1.5 text-center">
                            SGST
                          </th>
                          <th colSpan={2} className="w-[10%] border-r border-slate-300 px-1 py-1.5 text-center">
                            CGST
                          </th>
                          <th colSpan={2} className="w-[10%] border-r border-slate-300 px-1 py-1.5 text-center">
                            IGST
                          </th>

                          <th rowSpan={2} className="w-[11%] px-2 py-2 text-right">
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
                        </tr>
                      </thead>

                      <tbody>
                        {(selectedQuotation.products || []).map(
                          (item, index) => {
                            const withoutTax =
                              Number(item.qty || 0) *
                              Number(item.rate || 0);

                            const sgstAmount =
                              (withoutTax *
                                Number(item.sgstPercent || 0)) /
                              100;
                            const cgstAmount =
                              (withoutTax *
                                Number(item.cgstPercent || 0)) /
                              100;
                            const igstAmount =
                              (withoutTax *
                                Number(item.igstPercent || 0)) /
                              100;

                            const lineTotal =
                              withoutTax +
                              sgstAmount +
                              cgstAmount +
                              igstAmount;

                            return (
                              <tr
                                key={item.id}
                                className="border-slate-300"
                              >
                                <td className="border-r border-slate-300 px-2 py-2 text-center">
                                  {index + 1}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 font-semibold text-slate-800">
                                  {item.productName || "-"}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-center">
                                  {item.pkgsize}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-center font-semibold">
                                  {item.qty}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatCurrency(Number(item.rate || 0))}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatCurrency(withoutTax)}
                                </td>

                                <td className="border-r border-slate-300 px-1 py-2 text-center">
                                  {Number(item.sgstPercent || 0).toFixed(2)}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatCurrency(sgstAmount)}
                                </td>

                                <td className="border-r border-slate-300 px-1 py-2 text-center">
                                  {Number(item.cgstPercent || 0).toFixed(2)}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatCurrency(cgstAmount)}
                                </td>

                                <td className="border-r border-slate-300 px-1 py-2 text-center">
                                  {Number(item.igstPercent || 0).toFixed(2)}
                                </td>
                                <td className="border-r border-slate-300 px-2 py-2 text-right">
                                  {formatCurrency(igstAmount)}
                                </td>

                                <td className="px-2 py-2 text-right font-bold text-slate-800">
                                  {formatCurrency(lineTotal)}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>

                      {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                        {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(0, MIN_ROWS - selectedQuotation.products.length);
                        const columnCount = 13;

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

                      <tfoot>
                        {(() => {
                          const items = selectedQuotation.products || [];

                          const totalQty = items.reduce(
                            (sum, item) => sum + Number(item.qty || 0),
                            0,
                          );

                          const totalWithoutTax = items.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.qty || 0) * Number(item.rate || 0),
                            0,
                          );

                          const totalSgst = items.reduce((sum, item) => {
                            const wt =
                              Number(item.qty || 0) * Number(item.rate || 0);
                            return (
                              sum + (wt * Number(item.sgstPercent || 0)) / 100
                            );
                          }, 0);

                          const totalCgst = items.reduce((sum, item) => {
                            const wt =
                              Number(item.qty || 0) * Number(item.rate || 0);
                            return (
                              sum + (wt * Number(item.cgstPercent || 0)) / 100
                            );
                          }, 0);

                          const totalIgst = items.reduce((sum, item) => {
                            const wt =
                              Number(item.qty || 0) * Number(item.rate || 0);
                            return (
                              sum + (wt * Number(item.igstPercent || 0)) / 100
                            );
                          }, 0);

                          const totalLine =
                            totalWithoutTax + totalSgst + totalCgst + totalIgst;

                          return (
                            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                              <td
                                colSpan={3}
                                className="border-r border-slate-300 px-2 py-2 text-center"
                              >
                                Total
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2 text-center">
                                {totalQty}
                              </td>
                              <td className="border-r border-slate-300 px-2 py-2" />
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(totalWithoutTax)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-2" />
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(totalSgst)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-2" />
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(totalCgst)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-2" />
                              <td className="border-r border-slate-300 px-2 py-2 text-right">
                                {formatCurrency(totalIgst)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {formatCurrency(totalLine)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {/* ROW 1: Amount in Words (left, bottom-aligned) + breakdown/Round Off/Grand Total (right) */}
                      <div className="grid grid-cols-[1fr_320px] border-t border-slate-300">
                        <div className="flex flex-col justify-end border-r border-slate-300 p-2.5">
                          <p className="text-[10px] font-semibold text-slate-700">
                            Amount in Words :{" "}
                            <span className="font-bold text-slate-900">
                              {numberToWords(selectedQuotation.amount)}
                            </span>
                          </p>
                        </div>

                        <div className="space-y-1 p-2.5 text-[11px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Without Tax</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(selectedQuotation.withoutTax)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">SGST</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(selectedQuotation.sgst)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">CGST</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(selectedQuotation.cgst)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">IGST</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(selectedQuotation.igst)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3 border-t border-slate-300 pt-1.5">
                            <span className="text-slate-500">Round Off</span>
                            <span className="font-semibold text-slate-500">
                              {formatCurrency(selectedQuotation.roundOff)}
                            </span>
                          </div>

                          <div className="border-t border-slate-300 pt-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-slate-800">Grand Total</span>
                              <span className="text-lg font-bold text-slate-900">
                                {formatCurrency(selectedQuotation.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                                            {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                      <div className="grid min-h-[110px] grid-cols-[1fr_320px] border-t border-slate-300">
                        <div className="flex flex-col justify-end border-r border-slate-300 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Notes
                          </p>

                          <p className="mt-1.5 text-xs text-slate-500">
                            Products issued from store stock for{" "}
                            {selectedQuotation.farmer || "field delivery"}.
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

              <div className="quotation-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedQuotation(null)}
                >
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Quotation
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}