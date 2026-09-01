import { useMemo, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { products as allProducts, getStore, getFarmersByStore, getStorePurchasesFromCompanySales, type Product } from "@/lib/data";
import { createPortal } from "react-dom";

type SaleType = "Direct" | "Executive";

type SaleRow = {
  id: string;
  date: string;
  invoiceNo: string;
  through: SaleType;
  partyName: string;
  farmerId?: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  products: AddedRow[];
};

type EntryForm = {
  productId: string;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
};

type AddedRow = {
  key: string;
  productId: string;
  product?: Product;
  pkgsize: string;
  batchNo: string;
  expiryDate: string;
  packSize: string;
  hsn: string;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  withoutTax: number;
  taxAmount: number;
  rowTotal: number;
};

const STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

const initialRows: SaleRow[] = [
  {
    id: "store-sale-1",
    date: "17/08/26",
    invoiceNo: "nb-inv-2001",
    through: "Direct",
    partyName: "Murugan",
    withoutTax: 2232,
    sgst: 133.92,
    cgst: 133.92,
    igst: 0,
    amount: 2499.84,
    products: [],
  },
];

function emptyEntry(): EntryForm {
  return {
    productId: "",
    pkgsize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    sellingPrice: 0,
    discount: 0,
  };
}

function formatDateInput(value: string) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(-2)}`;
}

export default function StoreSalesInvoice({ storeId }: { storeId: string }) {
  const storageKey = `${STORAGE_KEY}:${storeId}`;

  const [rows, setRows] = useState<SaleRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : initialRows;
    } catch {
      return initialRows;
    }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const store = getStore(storeId);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [invoiceNo, setInvoiceNo] = useState("");
  const [through, setThrough] = useState<SaleType>("Direct");
  const [partyName, setPartyName] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerVillage, setFarmerVillage] = useState("");
  const [farmerCrop, setFarmerCrop] = useState("");
  const [farmerAcre, setFarmerAcre] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");
  const [executiveName, setExecutiveName] = useState("");
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [added, setAdded] = useState<AddedRow[]>([]);

  const registeredFarmers = useMemo(() => getFarmersByStore(storeId), [storeId]);
  const storePurchaseRows = useMemo(
    () => (getStorePurchasesFromCompanySales(storeId) || []) as any[],
    [storeId],
  );

  const storeStockVariants = useMemo(() => {
    return storePurchaseRows
      .map((row: any, index: number) => {
        const master = allProducts.find(
          (p) =>
            p.id === row.productId ||
            p.name.toLowerCase() === String(row.productName ?? row.product ?? "").toLowerCase(),
        );
        const productId = String(master?.id ?? row.productId ?? `stock-${index}`);
        const name = String(row.productName ?? row.product ?? master?.name ?? "").trim();
        const size = String(row.packSize ?? row.pkgsize ?? row.size ?? master?.size ?? "").trim();
        const quantity = Number(row.quantity ?? row.qty ?? 0);
        return {
          key: `${productId}-${size}-${row.batchNo ?? ""}-${row.expiryDate ?? ""}-${index}`,
          productId,
          product: master,
          name,
          size,
          batchNo: String(row.batchNo ?? ""),
          expiryDate: String(row.expiryDate ?? ""),
          quantity,
          sellingPrice: Number(row.sellingPrice ?? row.rate ?? row.price ?? master?.sellingPrice ?? 0),
          taxPercentage: Number(row.taxPercent ?? row.taxPercentage ?? master?.taxPercentage ?? 0),
        };
      })
      .filter((item) => item.name && item.quantity > 0);
  }, [storePurchaseRows]);

  const storeProductChoices = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    storeStockVariants.forEach((item) => {
      const key = item.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { value: item.name, label: item.name });
    });
    return Array.from(seen.values());
  }, [storeStockVariants]);

  const selectedProductName =
    storeStockVariants.find((item) => item.productId === entry.productId)?.name || "";

  const selectedSizeVariants = useMemo(
    () => storeStockVariants.filter((item) => item.name === selectedProductName),
    [storeStockVariants, selectedProductName],
  );

  const entryProduct = allProducts.find((p) => p.id === entry.productId);

  const totals = useMemo(() => {
    const withoutTax = added.reduce((s, r) => s + r.withoutTax, 0);
    const totalTax = added.reduce((s, r) => s + r.taxAmount, 0);
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;
    const igst = 0;
    const grandTotal = withoutTax + totalTax;

    return {
      withoutTax: Math.round(withoutTax * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      igst,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [added]);

  function selectFarmer(id: string) {
    setFarmerId(id);
    const farmer = registeredFarmers.find((item) => item.id === id);
    if (!farmer) {
      setPartyName("");
      setFarmerPhone("");
      setFarmerVillage("");
      setFarmerCrop("");
      setFarmerAcre("");
      return;
    }

    setPartyName(farmer.name || "");
    setFarmerPhone(farmer.phone || "");
    setFarmerVillage(farmer.village || "");
    setFarmerCrop(farmer.cropType || farmer.crops?.[0]?.cropType || "");
    const acre = Number(farmer.landSize || 0) || Number(farmer.crops?.[0]?.landSize || 0);
    setFarmerAcre(acre > 0 ? String(acre) : "");
    setPlaceOfSupply(
      (farmer.state || "").toLowerCase() === "tamil nadu" ? "Tamil Nadu" : "Others",
    );
  }

  function selectProductName(productName: string) {
    const first = storeStockVariants.find((item) => item.name === productName);
    setEntry((prev) => ({
      ...prev,
      productId: first?.productId || "",
      pkgsize: "",
      batchNo: "",
      expiryDate: "",
      sellingPrice: 0,
    }));
  }

  function selectProductSize(size: string) {
    const variant = selectedSizeVariants.find((item) => item.size === size);
    setEntry((prev) => ({
      ...prev,
      productId: variant?.productId || prev.productId,
      pkgsize: size,
      batchNo: variant?.batchNo || "",
      expiryDate: variant?.expiryDate || "",
      sellingPrice: variant?.sellingPrice || 0,
    }));
  }

  function addProduct() {
    if (
      !entry.productId ||
      !entry.pkgsize ||
      !entry.batchNo ||
      !entry.expiryDate ||
      entry.quantity < 1
    ) {
      return;
    }

    const selectedStock = storeStockVariants.find(
      (item) =>
        item.productId === entry.productId &&
        item.size === entry.pkgsize &&
        item.batchNo === entry.batchNo &&
        item.expiryDate === entry.expiryDate,
    );
    const product = selectedStock?.product || allProducts.find((p) => p.id === entry.productId);
    if (!selectedStock || !product) return;
    if (entry.quantity > selectedStock.quantity) {
      window.alert(`Only ${selectedStock.quantity} available in store stock.`);
      return;
    }

    const gross = entry.quantity * entry.sellingPrice;
    const withoutTax = Math.max(0, gross - entry.discount);
    const taxPercent = selectedStock.taxPercentage || product.taxPercentage || 0;
    const taxAmount =
      Math.round(withoutTax * (taxPercent / 100) * 100) / 100;
    const rowTotal = Math.round((withoutTax + taxAmount) * 100) / 100;

    const row: AddedRow = {
      key: `${Date.now()}-${Math.random()}`,
      productId: entry.productId,
      product,
      pkgsize: entry.pkgsize,
      batchNo: entry.batchNo,
      expiryDate: entry.expiryDate,
      packSize: product.size,
      hsn: product.hsnCode || "",
      taxPercent,
      quantity: entry.quantity,
      sellingPrice: entry.sellingPrice,
      discount: entry.discount,
      withoutTax,
      taxAmount,
      rowTotal,
    };

    setAdded((prev) => [...prev, row]);
    setEntry(emptyEntry());
  }

  function removeAdded(key: string) {
    setAdded((prev) => prev.filter((r) => r.key !== key));
  }

  function resetForm() {
    setSaleDate(new Date().toISOString().split("T")[0]);
    setInvoiceNo("");
    setThrough("Direct");
    setPartyName("");
    setFarmerId("");
    setFarmerPhone("");
    setFarmerVillage("");
    setFarmerCrop("");
    setFarmerAcre("");
    setPlaceOfSupply("Tamil Nadu");
    setExecutiveName("");
    setEntry(emptyEntry());
    setAdded([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  function handleCreate() {
    if (!invoiceNo.trim() || !partyName.trim() || added.length === 0) return;
    if (through === "Executive" && !executiveName.trim()) return;

    const row: SaleRow = {
      id: `store-sale-${Date.now()}`,
      date: formatDateInput(saleDate),
      invoiceNo: invoiceNo.trim(),
      through,
      partyName: partyName.trim(),
      farmerId,
      farmerPhone,
      farmerVillage,
      farmerCrop,
      farmerAcre,
      placeOfSupply,
      executiveName: through === "Executive" ? executiveName : "",
      withoutTax: totals.withoutTax,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      amount: totals.grandTotal,
      products: added,
    };

    const next = [row, ...rows];
    setRows(next);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}

    setShowCreate(false);
    resetForm();
  }

  const canCreate =
    !!invoiceNo.trim() &&
    !!farmerId &&
    !!partyName.trim() &&
    added.length > 0 &&
    (through === "Direct" || !!executiveName.trim());

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Invoice</h1>
          <p className="mt-1 text-slate-500">
            Direct and executive sales invoices.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          <Icon name="add" size={18} />
          Create Sale
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th
                rowSpan={2}
                className="w-[6%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                S.No
              </th>
              <th
                rowSpan={2}
                className="w-[10%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Date
              </th>
              <th
                rowSpan={2}
                className="w-[14%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Invoice No
              </th>
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Through
              </th>
              <th
                rowSpan={2}
                className="w-[15%] border-r border-slate-200 px-2 py-3 text-center font-semibold"
              >
                Farmer Name
              </th>
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-2 py-3 text-right font-semibold"
              >
                Without Tax
              </th>
              <th
                colSpan={3}
                className="w-[21%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
              >
                Tax
              </th>
              <th
                rowSpan={2}
                className="w-[12%] px-2 py-3 text-right font-semibold"
              >
                Total
              </th>
            </tr>

            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th className="border-r border-slate-100 px-2 py-2 text-right font-semibold">
                SGST
              </th>
              <th className="border-r border-slate-100 px-2 py-2 text-right font-semibold">
                CGST
              </th>
              <th className="border-r border-slate-200 px-2 py-2 text-right font-semibold">
                IGST
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                onClick={() => setSelectedSale(r)}
                title="Click to view invoice"
                className={`cursor-pointer border-b border-slate-100 ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                } transition hover:bg-brand-50/30`}
              >
                <td className="px-2 py-3 text-center font-medium text-slate-500">
                  {i + 1}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-center text-slate-500">
                  {r.date}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                  {r.invoiceNo}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.through === "Direct"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {r.through}
                  </span>
                </td>
                <td className="truncate border-l border-slate-100 px-2 py-3 text-center text-slate-700">
                  {r.partyName}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-800">
                  {formatCurrency(r.withoutTax)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.sgst)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.cgst)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                  {formatCurrency(r.igst)}
                </td>
                <td className="border-l border-slate-100 px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                  {formatCurrency(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selectedSale &&
        createPortal(
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 6mm; }
                body * { visibility: hidden !important; }
                .store-invoice-print,
                .store-invoice-print * { visibility: visible !important; }
                .store-invoice-print {
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
                .store-invoice-screen-only { display: none !important; }
              }
            `}</style>

            <div className="store-invoice-print flex max-h-[94vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="store-invoice-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Tax Invoice
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedSale.invoiceNo}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
                    <div className="border-r border-slate-300 p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden bg-white">
                          <img
                            src="/logo_NB.webp"
                            alt="Nature Biotic"
                            className="max-h-14 max-w-full object-contain"
                          />
                        </div>
                        <div className="leading-tight">
                          <h3 className="text-base font-extrabold tracking-wide text-slate-900">
                            {store?.name || "SAIRAM AGRI INPUT"}
                          </h3>
                          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-700">
                            {store?.address || store?.location || "Rajapalayam, Tamil Nadu"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-600">
                            GSTIN: {store?.gst || "-"}
                          </p>
                          <p className="text-[10px] text-slate-600">
                            Contact: {store?.phone || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center p-3">
                      <div className="text-center">
                        <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                          TAX INVOICE
                        </h2>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Store to Farmer
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-300 text-[9px] leading-4">
                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Billing Address
                      </p>
                      <p className="font-bold text-slate-900">{selectedSale.partyName}</p>
                      <p className="mt-1 text-slate-600">{selectedSale.farmerVillage || "-"}</p>
                      <p className="text-slate-600">Contact: {selectedSale.farmerPhone || "-"}</p>
                      <p className="text-slate-600">
                        Crop / Acre: {[selectedSale.farmerCrop, selectedSale.farmerAcre ? `${selectedSale.farmerAcre} Acre` : ""].filter(Boolean).join(" / ") || "-"}
                      </p>
                    </div>

                    <div className="border-r border-slate-300 p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Delivery Address
                      </p>
                      <p className="font-bold text-slate-900">{selectedSale.partyName}</p>
                      <p className="mt-1 text-slate-600">{selectedSale.farmerVillage || "-"}</p>
                      <p className="mt-1 text-slate-600">
                        Place of Supply: {selectedSale.placeOfSupply || "Tamil Nadu"}
                      </p>
                    </div>

                    <div className="p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Invoice Details
                      </p>
                      <div className="grid grid-cols-[92px_1fr] gap-y-1">
                        <span className="text-slate-500">Invoice No</span>
                        <span className="font-semibold text-slate-800">{selectedSale.invoiceNo}</span>
                        <span className="text-slate-500">Invoice Date</span>
                        <span className="font-semibold text-slate-800">{selectedSale.date}</span>
                        <span className="text-slate-500">Through</span>
                        <span className="font-semibold text-slate-800">{selectedSale.through}</span>
                        {selectedSale.through === "Executive" && (
                          <>
                            <span className="text-slate-500">Executive</span>
                            <span className="font-semibold text-slate-800">
                              {selectedSale.executiveName || "-"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-[8.5px] xl:text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-700">
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">S.No</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Product</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">HSN Code</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">PKG Size</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Batch No</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Exp Date</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Qty</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Unit Price</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Before Discount</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Discount</th>
                          <th rowSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">Taxable (₹)</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">CGST</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">SGST (₹)</th>
                          <th colSpan={2} className="border-r border-slate-300 px-1 py-1.5 text-center">IGST (₹)</th>
                          <th rowSpan={2} className="px-1 py-1.5 text-center">Line Total</th>
                        </tr>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-600">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">%</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amt</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Rate %</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amount</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Rate %</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amount</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Rate %</th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.products.length > 0 ? (
                          selectedSale.products.map((item, index) => {
                            const beforeDiscount = Number(item.quantity || 0) * Number(item.sellingPrice || 0);
                            const discountAmount = Number(item.discount || 0);
                            const discountPercent = beforeDiscount > 0 ? (discountAmount / beforeDiscount) * 100 : 0;
                            const isTamilNadu = (selectedSale.placeOfSupply || "Tamil Nadu") === "Tamil Nadu";
                            const cgstRate = isTamilNadu ? Number(item.taxPercent || 0) / 2 : 0;
                            const sgstRate = isTamilNadu ? Number(item.taxPercent || 0) / 2 : 0;
                            const igstRate = !isTamilNadu ? Number(item.taxPercent || 0) : 0;
                            const cgstAmt = isTamilNadu ? Number(item.taxAmount || 0) / 2 : 0;
                            const sgstAmt = isTamilNadu ? Number(item.taxAmount || 0) / 2 : 0;
                            const igstAmt = !isTamilNadu ? Number(item.taxAmount || 0) : 0;

                            return (
                              <tr key={item.key} className="border-b border-slate-300">
                                <td className="border-r border-slate-300 px-1 py-1.5 text-center">{index + 1}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 font-semibold">{item.product?.name || "Product"}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.hsn || "-"}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.pkgsize || item.packSize || "-"}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.batchNo || "-"}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.expiryDate || "-"}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-center">{item.quantity}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(item.sellingPrice)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold">{formatCurrency(beforeDiscount)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{discountPercent.toFixed(2)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(discountAmount)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold">{formatCurrency(item.withoutTax)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{cgstRate.toFixed(2)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(cgstAmt)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{sgstRate.toFixed(2)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(sgstAmt)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{igstRate.toFixed(2)}</td>
                                <td className="border-r border-slate-300 px-1 py-1.5 text-right">{formatCurrency(igstAmt)}</td>
                                <td className="px-1 py-1.5 text-right font-bold">{formatCurrency(item.rowTotal)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={19} className="px-4 py-8 text-center text-slate-400">
                              Product-level details are not available for this old sample invoice.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                    <div className="border-r border-slate-300 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        This tax invoice is generated for goods supplied by {store?.name || "the store"} to the registered farmer shown above.
                      </p>
                    </div>

                    <div className="p-3 text-[10px]">
                      {(() => {
                        const beforeDiscount = selectedSale.products.reduce(
                          (sum, item) => sum + Number(item.quantity || 0) * Number(item.sellingPrice || 0), 0
                        );
                        const discount = selectedSale.products.reduce(
                          (sum, item) => sum + Number(item.discount || 0), 0
                        );
                        const exactTotal = Number(selectedSale.amount || 0);
                        const roundedTotal = Math.round(exactTotal);
                        const roundOff = roundedTotal - exactTotal;

                        return (
                          <div className="space-y-1.5">
                            {/* <SummaryRow label="Total Before Discount" value={formatCurrency(beforeDiscount)} />
                            <SummaryRow label="Discount" value={formatCurrency(discount)} />
                            <SummaryRow label="Taxable Total" value={formatCurrency(selectedSale.withoutTax)} />
                            <SummaryRow label="CGST" value={formatCurrency(selectedSale.cgst)} />
                            <SummaryRow label="SGST" value={formatCurrency(selectedSale.sgst)} />
                            <SummaryRow label="IGST" value={formatCurrency(selectedSale.igst)} /> */}
                            <SummaryRow label="Round Off" value={formatCurrency(roundOff)} />
                            <div className="mt-2 flex items-center justify-between border-t border-slate-300 pt-2">
                              <span className="font-bold text-slate-900">Total</span>
                              <span className="text-base font-extrabold text-slate-900">
                                {formatCurrency(roundedTotal)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-300 p-5">
                    <div className="w-56 text-center">
                      <div className="h-12 border-b border-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="store-invoice-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
                <Button variant="secondary" onClick={() => setSelectedSale(null)}>
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Print Invoice
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showCreate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Store Sale
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a new direct or executive sale.
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

              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Sale Information
                  </h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      label="Sale Date"
                      type="date"
                      value={saleDate}
                      onChange={setSaleDate}
                    />

                    <Input
                      label="Invoice Number"
                      value={invoiceNo}
                      onChange={setInvoiceNo}
                      placeholder="e.g. SAI-INV-0001"
                      required
                    />

                    <Select
                      label="Sale Type"
                      value={through}
                      onChange={(value) => setThrough(value as SaleType)}
                      options={[
                        { value: "Direct", label: "Direct" },
                        { value: "Executive", label: "Executive" },
                      ]}
                    />

                    <Select
                      label="Farmer Name"
                      value={farmerId}
                      onChange={selectFarmer}
                      placeholder="Select registered farmer"
                      options={registeredFarmers.map((farmer) => ({
                        value: farmer.id,
                        label: `${farmer.name} - ${farmer.phone}`,
                      }))}
                      required
                    />

                    <Input label="Mobile Number" value={farmerPhone} onChange={() => {}} readOnly />
                    <Input label="Village" value={farmerVillage} onChange={() => {}} readOnly />
                    <Input label="Crop" value={farmerCrop} onChange={() => {}} readOnly />
                    <Input label="Acre" value={farmerAcre} onChange={() => {}} readOnly />
                    <Input label="Place of Supply" value={placeOfSupply} onChange={() => {}} readOnly />

                    {through === "Executive" && (
                      <Select
                        label="Executive"
                        value={executiveName}
                        onChange={setExecutiveName}
                        placeholder="Select executive"
                        options={[
                          { value: "Ram Kumar", label: "Ram Kumar" },
                          { value: "Ajith Kumar", label: "Ajith Kumar" },
                          { value: "PeriyaSamy", label: "PeriyaSamy" },
                        ]}
                        required
                      />
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Add Product
                  </h4>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                      <Select
                        label="Select Product"
                        value={selectedProductName}
                        onChange={selectProductName}
                        placeholder="Choose store product"
                        options={storeProductChoices}
                      />

                      <Select
                        label="PKG Size"
                        value={entry.pkgsize}
                        onChange={selectProductSize}
                        placeholder={selectedProductName ? "Select available size" : "Select product first"}
                        options={Array.from(
                          new Map(
                            selectedSizeVariants.map((item) => [
                              item.size,
                              { value: item.size, label: item.size },
                            ]),
                          ).values(),
                        )}
                      />

                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={() => {}}
                        placeholder="Auto from stock"
                        readOnly
                      />

                      <Input
                        label="Expiry Date"
                        type="date"
                        value={entry.expiryDate}
                        onChange={() => {}}
                        readOnly
                      />

                      <Input
                        label="Quantity"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            quantity: Number(v) || 0,
                          }))
                        }
                      />

                      <Input
                        label="Selling Price"
                        type="number"
                        value={String(entry.sellingPrice)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            sellingPrice: Number(v) || 0,
                          }))
                        }
                      />

                      <Input
                        label="Discount"
                        type="number"
                        value={String(entry.discount)}
                        onChange={(v) =>
                          setEntry((prev) => ({
                            ...prev,
                            discount: Number(v) || 0,
                          }))
                        }
                      />

                      <Button
                        onClick={addProduct}
                        className="h-[50px] w-full px-3"
                      >
                        <Icon name="add" size={18} />
                        Add Product
                      </Button>
                    </div>

                    {entryProduct && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4 lg:grid-cols-6">
                        <DetailField
                          label="Product"
                          value={entryProduct.name}
                        />
                        <DetailField
                          label="Pack Size"
                          value={entryProduct.size}
                        />
                        <DetailField
                          label="HSN / SAC"
                          value={entryProduct.hsnCode}
                        />
                        <DetailField
                          label="MRP"
                          value={formatCurrency(entryProduct.mrp)}
                        />
                        <DetailField
                          label="Tax %"
                          value={`${entryProduct.taxPercentage}%`}
                        />
                        <DetailField
                          label="Selling Price"
                          value={formatCurrency(entry.sellingPrice)}
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Added Products
                    </h4>
                    <span className="text-xs font-semibold text-slate-400">
                      {added.length} item(s)
                    </span>
                  </div>

                  {added.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                      <Icon
                        name="inventory_2"
                        size={32}
                        className="mx-auto text-slate-300"
                      />
                      <p className="mt-2 text-sm text-slate-400">
                        No products added yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
                            <th className="w-[6%] px-2 py-3 text-center">
                              S.No
                            </th>
                            <th className="w-[15%] px-2 py-3 text-left">
                              Product
                            </th>
                            <th className="w-[11%] px-2 py-3 text-left">
                              Batch
                            </th>
                            <th className="w-[11%] px-2 py-3 text-center">
                              Expiry
                            </th>
                            <th className="w-[10%] px-2 py-3 text-center">
                              Size
                            </th>
                            <th className="w-[8%] px-2 py-3 text-right">
                              Qty
                            </th>
                            <th className="w-[11%] px-2 py-3 text-right">
                              Price
                            </th>
                            <th className="w-[10%] px-2 py-3 text-right">
                              Discount
                            </th>
                            <th className="w-[9%] px-2 py-3 text-right">
                              Tax
                            </th>
                            <th className="w-[9%] px-2 py-3 text-right">
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {added.map((r, i) => (
                            <tr
                              key={r.key}
                              
                            >
                              <td className="px-2 py-3 text-center">
                                {i + 1}
                              </td>
                              <td className="truncate px-2 py-3 font-semibold">
                                {r.product?.name}
                              </td>
                              <td className="px-2 py-3">{r.batchNo}</td>
                              <td className="px-2 py-3 text-center">
                                {r.expiryDate}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {r.packSize}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {r.quantity}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(r.sellingPrice)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(r.discount)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(r.taxAmount)}
                              </td>
                              <td className="px-2 py-3 text-right font-bold">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{formatCurrency(r.rowTotal)}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeAdded(r.key)}
                                    className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Icon name="delete" size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex justify-end">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h5 className="mb-3 text-sm font-bold text-slate-800">
                      Invoice Summary
                    </h5>

                    <div className="space-y-2 text-sm">
                      <SummaryRow
                        label="Without Tax"
                        value={formatCurrency(totals.withoutTax)}
                      />
                      <SummaryRow
                        label="SGST"
                        value={formatCurrency(totals.sgst)}
                      />
                      <SummaryRow
                        label="CGST"
                        value={formatCurrency(totals.cgst)}
                      />
                      <SummaryRow
                        label="IGST"
                        value={formatCurrency(totals.igst)}
                      />

                      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="font-bold text-slate-800">
                          Grand Total
                        </span>
                        <span className="text-lg font-bold text-brand-700">
                          {formatCurrency(totals.grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate}>
                  <Icon name="check_circle" size={18} />
                  Create Sale
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="truncate text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-700">
        {value}
      </span>
    </div>
  );
}
