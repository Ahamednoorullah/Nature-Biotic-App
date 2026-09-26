import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { products as allProducts, getStore, type Product } from "@/lib/data";
import { createPortal } from "react-dom";
import { products as reduceFROStock } from "@/lib/data";


type SaleType = "Direct" | "Executive";

type ReturnItem = {
  rowTotal: number;
  taxAmount: number;
  key: string;
  productId: string;
  product?: Product;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  price: number;
  beforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  reason: string;
};

type SalesReturnRow = {
  id: string;
  date: string;
  returnNo: string;
  invoiceNo: string;
  through: SaleType;
  partyName: string;
  farmerPhone?: string;
  farmerVillage?: string;
  farmerCrop?: string;
  farmerAcre?: string;
  placeOfSupply?: string;
  executiveName: string;
  beforeDiscount: number;
  discountAmount: number;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  items: ReturnItem[];
};

const STORAGE_KEY = "nature-biotic-store-sales-returns-v2";

type StoredSaleProduct = {
  key: string;
  productId: string;
  product?: Product;
  pkgsize?: string;
  packSize?: string;
  batchNo: string;
  expiryDate: string;
  hsn?: string;
  taxPercent: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  withoutTax: number;
  taxAmount: number;
  rowTotal: number;
};

type StoredSaleInvoice = {
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
  products: StoredSaleProduct[];
};

const SALES_INVOICE_STORAGE_KEY = "nature-biotic-store-sales-invoices-v2";

const seedRows: SalesReturnRow[] = [];

type ReturnEntry = {
  sourceKey: string;
  productId: string;
  packSize: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  price: number;
  reason: string;
};

function emptyItem(): ReturnEntry {
  return {
    sourceKey: "",
    productId: "",
    packSize: "",
    batchNo: "",
    expiryDate: "",
    quantity: 1,
    price: 0,
    reason: "",
  };
}

function dateDisplay(value: string) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

export default function StoreSalesReturn({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage } = useNav();
  const isFRO = user?.role === "fro";
  const froName = user?.name?.trim() || "";
  const storageKey = `${STORAGE_KEY}:${storeId}`;

  const [rows, setRows] = useState<SalesReturnRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : seedRows;
    } catch {
      return seedRows;
    }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturnRow | null>(
    null,
  );
  const store = getStore(storeId);

  // FRO users can see and create returns only for invoices created by themselves.
  const visibleRows = useMemo(
    () =>
      isFRO
        ? rows.filter(
            (row) =>
              row.through === "Executive" &&
              row.executiveName?.trim().toLowerCase() === froName.toLowerCase(),
          )
        : rows,
    [rows, isFRO, froName],
  );

  const saleInvoices = useMemo<StoredSaleInvoice[]>(() => {
    try {
      const raw = localStorage.getItem(
        `${SALES_INVOICE_STORAGE_KEY}:${storeId}`,
      );
      const invoices: StoredSaleInvoice[] = raw ? JSON.parse(raw) : [];
      return isFRO
        ? invoices.filter(
            (invoice) =>
              invoice.through === "Executive" &&
              (invoice.executiveName || "").trim().toLowerCase() ===
                froName.toLowerCase(),
          )
        : invoices;
    } catch {
      return [];
    }
  }, [storeId, showCreate, isFRO, froName]);

  const invoiceOptions = useMemo(
    () =>
      saleInvoices.map((invoice) => ({
        value: invoice.invoiceNo,
        label: `${invoice.invoiceNo} - ${invoice.partyName}`,
      })),
    [saleInvoices],
  );

  const [invoiceNo, setInvoiceNo] = useState("");
  const selectedInvoice = useMemo(
    () => saleInvoices.find((invoice) => invoice.invoiceNo === invoiceNo),
    [saleInvoices, invoiceNo],
  );

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnNo, setReturnNo] = useState("");
  const [through, setThrough] = useState<SaleType>(
    isFRO ? "Executive" : "Direct",
  );
  const [partyName, setPartyName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerVillage, setFarmerVillage] = useState("");
  const [farmerCrop, setFarmerCrop] = useState("");
  const [farmerAcre, setFarmerAcre] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu");
  const [executiveName, setExecutiveName] = useState(isFRO ? froName : "");
  const [entry, setEntry] = useState(emptyItem());
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState("");

  const selectedInvoiceItem = selectedInvoice?.products.find(
    (item) => item.key === entry.sourceKey,
  );
  const selectedProduct =
    selectedInvoiceItem?.product ||
    allProducts.find((p) => p.id === selectedInvoiceItem?.productId);

  const totals = useMemo(
    () => ({
      beforeDiscount: items.reduce((sum, item) => sum + item.beforeDiscount, 0),
      discountAmount: items.reduce((sum, item) => sum + item.discountAmount, 0),
      withoutTax: items.reduce((sum, item) => sum + item.withoutTax, 0),
      sgst: items.reduce((sum, item) => sum + item.sgst, 0),
      cgst: items.reduce((sum, item) => sum + item.cgst, 0),
      igst: items.reduce((sum, item) => sum + item.igst, 0),
      total: items.reduce((sum, item) => sum + item.total, 0),
    }),
    [items],
  );

  function selectInvoice(value: string) {
    setInvoiceNo(value);
    const invoice = saleInvoices.find((item) => item.invoiceNo === value);

    if (!invoice) {
      setThrough("Direct");
      setPartyName("");
      setFarmerPhone("");
      setFarmerVillage("");
      setFarmerCrop("");
      setFarmerAcre("");
      setPlaceOfSupply("Tamil Nadu");
      setExecutiveName("");
      setEntry(emptyItem());
      setItems([]);
      return;
    }

    setThrough(invoice.through);
    setPartyName(invoice.partyName || "");
    setFarmerPhone(invoice.farmerPhone || "");
    setFarmerVillage(invoice.farmerVillage || "");
    setFarmerCrop(invoice.farmerCrop || "");
    setFarmerAcre(invoice.farmerAcre || "");
    setPlaceOfSupply(invoice.placeOfSupply || "Tamil Nadu");
    setExecutiveName(
      invoice.through === "Executive" ? invoice.executiveName || "" : "",
    );
    setEntry(emptyItem());
    setItems([]);
  }

  function selectInvoiceProduct(sourceKey: string) {
    const item = selectedInvoice?.products.find(
      (product) => product.key === sourceKey,
    );

    if (!item) {
      setEntry(emptyItem());
      return;
    }

    setEntry((prev) => ({
      ...prev,
      sourceKey,
      productId: item.productId,
      packSize: item.pkgsize || item.packSize || item.product?.size || "",
      batchNo: item.batchNo || "",
      expiryDate: item.expiryDate || "",
      quantity: 1,
      price: Number(item.sellingPrice || 0),
      reason: "",
    }));
  }

  function addItem() {
    const original = selectedInvoiceItem;
    const product = selectedProduct;

    if (
      !selectedInvoice ||
      !original ||
      !product ||
      !entry.packSize ||
      !entry.batchNo ||
      !entry.expiryDate ||
      !entry.reason ||
      entry.quantity < 1
    ) {
      return;
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

    const alreadyReturned = items
      .filter(
        (item) =>
          item.productId === original.productId &&
          item.batchNo === original.batchNo,
      )
      .reduce((sum, item) => sum + item.quantity, 0);

    const remainingQty = Number(original.quantity || 0) - alreadyReturned;
    if (entry.quantity > remainingQty) {
      window.alert(
        `Only ${remainingQty} quantity can be returned from this invoice line.`,
      );
      return;
    }

    const beforeDiscount =
      Number(entry.quantity || 0) * Number(original.sellingPrice || 0);

    const originalBeforeDiscount =
      Number(original.quantity || 0) * Number(original.sellingPrice || 0);

    const originalDiscountPercent =
      originalBeforeDiscount > 0
        ? (Number(original.discount || 0) / originalBeforeDiscount) * 100
        : 0;

    const discountAmount = (beforeDiscount * originalDiscountPercent) / 100;

    const withoutTax = Math.max(0, beforeDiscount - discountAmount);

    const taxPercent = Number(original.taxPercent || 0);
    const taxAmount = withoutTax * (taxPercent / 100);
    const intrastate =
      (selectedInvoice.placeOfSupply || "Tamil Nadu") === "Tamil Nadu";

    const sgst = intrastate ? taxAmount / 2 : 0;
    const cgst = intrastate ? taxAmount / 2 : 0;
    const igst = intrastate ? 0 : taxAmount;

    setItems((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        productId: original.productId,
        product,
        packSize: original.pkgsize || original.packSize || product.size || "",
        batchNo: original.batchNo || "",
        expiryDate: original.expiryDate || "",
        quantity: entry.quantity,
        price: Number(original.sellingPrice || 0),
        beforeDiscount,
        discountPercent: originalDiscountPercent,
        discountAmount,
        taxPercent,
        withoutTax,
        sgst,
        cgst,
        igst,
        total: withoutTax + taxAmount,
        taxAmount,
        rowTotal: withoutTax + taxAmount,
        reason: entry.reason,
      },
    ]);

    setEntry(emptyItem());
  }

  function resetForm() {
    setDate(new Date().toISOString().split("T")[0]);
    setReturnNo("");
    setInvoiceNo("");
    setThrough(isFRO ? "Executive" : "Direct");
    setPartyName("");
    setFarmerPhone("");
    setFarmerVillage("");
    setFarmerCrop("");
    setFarmerAcre("");
    setPlaceOfSupply("Tamil Nadu");
    setExecutiveName(isFRO ? froName : "");
    setEntry(emptyItem());
    setItems([]);
  }

  function closeForm() {
    setShowCreate(false);
    resetForm();
  }

  const canSave =
    date &&
    returnNo.trim() &&
    invoiceNo.trim() &&
    !!selectedInvoice &&
    partyName.trim() &&
    items.length > 0 &&
    (isFRO || through === "Direct" || executiveName.trim());

  function saveReturn() {
    if (!canSave) return;

    const next: SalesReturnRow = {
      id: `sr-${Date.now()}`,
      date,
      returnNo: returnNo.trim(),
      invoiceNo: invoiceNo.trim(),
      through: isFRO ? "Executive" : through,
      partyName: partyName.trim(),
      farmerPhone,
      farmerVillage,
      farmerCrop,
      farmerAcre,
      placeOfSupply,
      executiveName: isFRO
        ? froName
        : through === "Executive"
          ? executiveName.trim()
          : "-",
      beforeDiscount: totals.beforeDiscount,
      discountAmount: totals.discountAmount,
      withoutTax: totals.withoutTax,
      sgst: totals.sgst,
      cgst: totals.cgst,
      igst: totals.igst,
      total: totals.total,
      items,
    };

    const updated = [next, ...rows];
    setRows(updated);

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}

    closeForm();
  }

  function numberToWords(roundedTotal: any): import("react").ReactNode {
    throw new Error("Function not implemented.");
  }


  return (
    <div>
      {isFRO ? (
        !showCreate && !selectedReturn ? (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => goStorePage("sales")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label="Back"
              >
                <Icon name="arrow_back" size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-800">Sales Return</h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Direct and executive sales return records.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreate(true);
                setSelectedReturn(null);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm hover:bg-brand-700"
              aria-label="Create Sales Return"
            >
              <Icon name="add" size={20} />
            </button>
          </div>
        ) : null
      ) : (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Sales Return
            </h1>
            <p className="mt-1 text-slate-500">
              Direct and executive sales return records.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Icon name="add" size={18} />
            Create Sales Return
          </Button>
        </div>
      )}

      <Card className={`${isFRO ? "hidden" : "block"} overflow-hidden p-0`}>
        <table className="hidden w-full table-fixed border-collapse text-sm md:table">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <th
                rowSpan={2}
                className="w-[5%] border-r border-slate-200 px-2 py-3 text-center"
              >
                S.No
              </th>
              <th
                rowSpan={2}
                className="w-[9%] border-r border-slate-200 px-2 py-3 text-center"
              >
                Date
              </th>
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-2 py-3 text-center"
              >
                SR Number
              </th>
              {/* <th rowSpan={2} className="w-[12%] border-r border-slate-200 px-2 py-3 text-center">
                Invoice No
              </th> */}
              <th
                rowSpan={2}
                className="w-[10%] border-r border-slate-200 px-2 py-3 text-center"
              >
                Through
              </th>
              <th
                rowSpan={2}
                className="w-[14%] border-r border-slate-200 px-2 py-3 text-center"
              >
                Farmer Name
              </th>
              <th
                rowSpan={2}
                className="w-[11%] border-r border-slate-200 px-2 py-3 text-right"
              >
                Without Tax
              </th>
              <th
                colSpan={2}
                className="w-[12%] border-r border-slate-200 px-1 py-2 text-center"
              >
                SGST
              </th>
              <th
                colSpan={2}
                className="w-[12%] border-r border-slate-200 px-1 py-2 text-center"
              >
                CGST
              </th>
              <th
                colSpan={2}
                className="w-[12%] border-r border-slate-200 px-1 py-2 text-center"
              >
                IGST
              </th>
              <th rowSpan={2} className="w-[10%] px-2 py-3 text-right">
                Total
              </th>
            </tr>

            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="border-r border-slate-100 px-1 py-2 text-center">
                %
              </th>
              <th className="border-r border-slate-100 px-1 py-2 text-right">
                Amt
              </th>
              <th className="border-r border-slate-100 px-1 py-2 text-center">
                %
              </th>
              <th className="border-r border-slate-100 px-1 py-2 text-right">
                Amt
              </th>
              <th className="border-r border-slate-100 px-1 py-2 text-center">
                %
              </th>
              <th className="border-r border-slate-200 px-1 py-2 text-right">
                Amt
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => setSelectedReturn(row)}
                className="cursor-pointer transition hover:bg-brand-50/40"
                title="Click to view sales return details"
              >
                <td className="border-r border-slate-100 px-2 py-3 text-center">
                  {index + 1}
                </td>
                <td className="border-r border-slate-100 px-2 py-3 text-center">
                  {dateDisplay(row.date)}
                </td>
                <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold">
                  {row.returnNo}
                </td>
                {/*<td className="border-r border-slate-100 px-2 py-3 text-center">{row.invoiceNo}</td> */}
                <td className="border-r border-slate-100 px-2 py-3 text-center">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      row.through === "Direct"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {row.through === "Executive"
                      ? row.executiveName || "Executive"
                      : row.through}
                  </span>
                </td>
                <td className="truncate border-r border-slate-100 px-2 py-3 text-center">
                  {row.partyName}
                </td>
                <td className="border-r border-slate-100 px-2 py-3 text-right">
                  {formatCurrency(row.withoutTax)}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  {row.sgst > 0 && row.withoutTax > 0
                    ? `${((row.sgst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right">
                  {formatCurrency(row.sgst)}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  {row.cgst > 0 && row.withoutTax > 0
                    ? `${((row.cgst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right">
                  {formatCurrency(row.cgst)}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-center">
                  {row.igst > 0 && row.withoutTax > 0
                    ? `${((row.igst / row.withoutTax) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
                <td className="border-r border-slate-100 px-1 py-3 text-right">
                  {formatCurrency(row.igst)}
                </td>
                <td className="px-2 py-3 text-right font-bold">
                  {formatCurrency(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* FRO list: same compact table pattern as Quotation / Sales Invoice */}
      {isFRO ? (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500">
                  <th className="w-[12%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold">S.No</th>
                  <th className="w-[20%] border-r border-slate-200 px-1.5 py-2.5 text-center font-semibold">Date</th>
                  <th className="w-[48%] border-r border-slate-200 px-2 py-2.5 text-left font-semibold">Farmer Details</th>
                  <th className="w-[20%] px-2 py-2.5 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-10 text-center text-xs text-slate-400">No sales returns found.</td></tr>
                ) : visibleRows.map((row, index) => (
                  <tr key={row.id} onClick={() => setSelectedReturn(row)} className="cursor-pointer transition hover:bg-brand-50/40">
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="border-r border-slate-100 px-1.5 py-3 text-center align-top whitespace-nowrap text-slate-600">
                      {dateDisplay(row.date)}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-3 text-left align-top">
                      <p className="truncate font-semibold text-slate-800">{row.partyName || "-"}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.farmerVillage || "-"}</p>
                      <p className="mt-0.5 truncate text-[9px] text-slate-400">{row.farmerPhone || "-"}</p>
                    </td>
                    <td className="px-2 py-3 text-right align-top font-bold tabular-nums text-emerald-700">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-3 md:hidden">
          {visibleRows.length === 0 ? <Card className="p-6 text-center text-sm text-slate-500">No sales returns found.</Card> : visibleRows.map((row, index) => (
            <button key={row.id} type="button" onClick={() => setSelectedReturn(row)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Return #{index + 1}</p><p className="mt-1 text-base font-bold text-slate-800">{row.returnNo}</p><p className="mt-1 text-xs text-slate-500">{dateDisplay(row.date)}</p></div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{row.invoiceNo}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Farmer</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{row.partyName || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Farm</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{row.farmerCrop || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-400">Without Tax</p><p className="mt-1 text-sm font-semibold text-slate-700">{formatCurrency(row.withoutTax)}</p></div>
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[11px] text-emerald-600">Total</p><p className="mt-1 text-sm font-bold text-emerald-700">{formatCurrency(row.total)}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate &&
        createPortal(
          <div
            className={`fixed z-[10000] ${
              isFRO
                ? "inset-x-0 bottom-0 top-14 flex overflow-hidden bg-white"
                : "inset-0 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
            }`}
          >
            <div
              className={`flex flex-col overflow-hidden border-slate-200 bg-white ${
                isFRO
                  ? "h-full w-full border-0"
                  : "nb-modal-panel w-full max-w-7xl rounded-2xl border shadow-2xl"
              }`}
            >
              <div className={`flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 ${isFRO ? "" : "justify-between"}`}>
                {isFRO ? (
                  <>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                      aria-label="Back"
                    >
                      <Icon name="arrow_back" size={20} />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-slate-800">
                        Create Sales Return
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Create a direct or executive sales return.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        Create Sales Return
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Create a direct or executive sales return.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                      aria-label="Close"
                    >
                      <Icon name="close" size={20} />
                    </button>
                  </>
                )}
              </div>

              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-6">
                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Return Information
                  </h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    <Input
                      label="Return Date"
                      type="date"
                      value={date}
                      onChange={setDate}
                      required
                    />
                    <Input
                      label="Return No"
                      value={returnNo}
                      onChange={setReturnNo}
                      placeholder="e.g. SR-0002"
                      required
                    />
                    <Select
                      label="Invoice No"
                      value={invoiceNo}
                      onChange={selectInvoice}
                      placeholder="Select original invoice"
                      options={invoiceOptions}
                    />
                    <Input
                      label="Farmer Name"
                      value={partyName}
                      onChange={() => {}}
                      readOnly
                    />
                    <Input
                      label="Mobile Number"
                      value={farmerPhone}
                      onChange={() => {}}
                      readOnly
                    />
                    <Input
                      label="Village"
                      value={farmerVillage}
                      onChange={() => {}}
                      readOnly
                    />
                    {!isFRO && (
                      <Input
                        label="Through"
                        value={through}
                        onChange={() => {}}
                        readOnly
                      />
                    )}
                    {(through === "Executive" || isFRO) && (
                      <Input
                        label="Executive"
                        value={isFRO ? froName : executiveName}
                        onChange={() => {}}
                        readOnly
                      />
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Add Return Product
                  </h4>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-8">
                      <Select
                        label="Product"
                        value={entry.sourceKey}
                        onChange={selectInvoiceProduct}
                        placeholder={
                          selectedInvoice
                            ? "Select invoice product"
                            : "Select invoice first"
                        }
                        options={(selectedInvoice?.products || []).map(
                          (item) => ({
                            value: item.key,
                            label: `${item.product?.name || "Product"} (${item.pkgsize || item.packSize || ""})`,
                          }),
                        )}
                      />
                      <Input
                        label="Pack Size"
                        value={entry.packSize}
                        onChange={() => {}}
                        readOnly
                      />
                      <Input
                        label="Batch No"
                        value={entry.batchNo}
                        onChange={() => {}}
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
                        label="Return Qty"
                        type="number"
                        value={String(entry.quantity)}
                        onChange={(v) =>
                          setEntry((p) => ({ ...p, quantity: Number(v) || 0 }))
                        }
                      />
                      <Input
                        label="Price"
                        type="number"
                        value={String(entry.price)}
                        onChange={() => {}}
                        readOnly
                      />
                      <Select
                        label="Reason"
                        value={entry.reason}
                        onChange={(v) => setEntry((p) => ({ ...p, reason: v }))}
                        placeholder="Select reason"
                        options={[
                          {
                            value: "Damaged Product",
                            label: "Damaged Product",
                          },
                          { value: "Wrong Product", label: "Wrong Product" },
                          { value: "Quality Issue", label: "Quality Issue" },
                          {
                            value: "Expired / Near Expiry",
                            label: "Expired / Near Expiry",
                          },
                          { value: "Other", label: "Other" },
                        ]}
                      />
                      <Button onClick={addItem} className="h-[50px] w-full">
                        <Icon name="add" size={18} />
                        Add Product
                      </Button>
                    </div>

                    {selectedProduct && selectedInvoiceItem && (
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 md:grid-cols-4 lg:grid-cols-7">
                        <Detail label="Product" value={selectedProduct.name} />
                        <Detail
                          label="HSN / SAC"
                          value={selectedProduct.hsnCode}
                        />
                        <Detail label="Pack Size" value={entry.packSize} />
                        <Detail
                          label="Sold Qty"
                          value={String(selectedInvoiceItem.quantity)}
                        />
                        <Detail
                          label="Discount %"
                          value={`${
                            selectedInvoiceItem.quantity *
                              selectedInvoiceItem.sellingPrice >
                            0
                              ? (
                                  (Number(selectedInvoiceItem.discount || 0) /
                                    (selectedInvoiceItem.quantity *
                                      selectedInvoiceItem.sellingPrice)) *
                                  100
                                ).toFixed(2)
                              : "0.00"
                          }%`}
                        />
                        <Detail
                          label="Tax %"
                          value={`${selectedInvoiceItem.taxPercent || 0}%`}
                        />
                        <Detail
                          label="Selling Price"
                          value={formatCurrency(entry.price)}
                        />
                      </div>
                    )}
                  </div>
                </section>

                {items.length > 0 && (
                  <section>
                    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
                      <table className="min-w-[1100px] w-full table-auto text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-xs uppercase text-slate-500">
                            <th className="w-[6%] px-2 py-3 text-center">
                              S.No
                            </th>
                            <th className="w-[15%] px-2 py-3 text-left">
                              Product
                            </th>
                            <th className="px-2 py-3 text-center">Size</th>
                            <th className="px-2 py-3 text-center">Batch</th>
                            <th className="px-2 py-3 text-center">Expiry</th>
                            <th className="px-2 py-3 text-center">Qty</th>
                            <th className="px-2 py-3 text-right">Price</th>
                            <th className="px-2 py-3 text-right">
                              Before Disc
                            </th>
                            <th className="px-2 py-3 text-center">Disc %</th>
                            <th className="px-2 py-3 text-right">Disc Amt</th>
                            <th className="px-2 py-3 text-right">Taxable</th>
                            <th className="px-2 py-3 text-right">Tax</th>
                            <th className="px-2 py-3 text-right">Total</th>
                            <th className="w-[5%] px-2 py-3 text-center"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr
                              key={item.key}
                              className="border-b border-slate-100"
                            >
                              <td className="px-2 py-3 text-center">
                                {index + 1}
                              </td>
                              <td className="px-2 py-3 font-semibold">
                                {item.product?.name}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.packSize}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.batchNo}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.expiryDate}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.quantity}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(item.price)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(item.beforeDiscount)}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.discountPercent.toFixed(2)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(item.discountAmount)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(item.withoutTax)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(
                                  item.sgst + item.cgst + item.igst,
                                )}
                              </td>
                              <td className="px-2 py-3 text-right font-bold whitespace-nowrap">
                                <div className="flex min-w-[105px] items-center justify-end gap-3">
                                  <span>{formatCurrency(item.total)}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setItems((prev) =>
                                        prev.filter((x) => x.key !== item.key),
                                      )
                                    }
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                                    aria-label={`Delete ${item.product?.name || "product"}`}
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

                    <div className="space-y-3 md:hidden">
                      {items.map((item, index) => (
                        <div
                          key={item.key}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Product {index + 1}
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800">
                                {item.product?.name || "-"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) =>
                                  prev.filter((x) => x.key !== item.key),
                                )
                              }
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            >
                              <Icon name="delete" size={17} />
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <Info
                              label="Pack Size"
                              value={item.packSize || "-"}
                            />
                            <Info
                              label="Batch No"
                              value={item.batchNo || "-"}
                            />
                            <Info
                              label="Expiry"
                              value={item.expiryDate || "-"}
                            />
                            <Info label="Qty" value={String(item.quantity)} />
                            <Info
                              label="Price"
                              value={formatCurrency(item.price)}
                            />
                            <Info
                              label="Discount"
                              value={`${item.discountPercent.toFixed(2)}%`}
                            />
                            <Info
                              label="Taxable"
                              value={formatCurrency(item.withoutTax)}
                            />
                            <Info
                              label="Tax"
                              value={formatCurrency(
                                item.sgst + item.cgst + item.igst,
                              )}
                            />
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-xs font-semibold text-slate-500">
                              Reason
                            </span>
                            <span className="max-w-[65%] text-right text-xs font-semibold text-slate-700">
                              {item.reason}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">
                              Line Total
                            </span>
                            <span className="text-sm font-extrabold text-slate-800">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="flex justify-end">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
                    <Summary
                      label="Total Before Discount"
                      value={totals.beforeDiscount}
                    />
                    <Summary label="Discount" value={totals.discountAmount} />
                    <Summary label="Taxable Total" value={totals.withoutTax} />
                    <Summary label="SGST" value={totals.sgst} />
                    <Summary label="CGST" value={totals.cgst} />
                    <Summary label="IGST" value={totals.igst} />
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <Summary label="Grand Total" value={totals.total} bold />
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button onClick={saveReturn} disabled={!canSave}>
                  <Icon name="save" size={17} />
                  Create Sales Return
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedReturn &&
        createPortal(
          <div
            className={`fixed z-[10020] ${
              isFRO
                ? "inset-x-0 bottom-0 top-14 flex overflow-hidden bg-white"
                : "inset-0 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
            }`}
          >
            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 6mm; }

                body * { visibility: hidden !important; }

                .sales-return-print-area,
                .sales-return-print-area * { visibility: visible !important; }

                .sales-return-print-area {
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

                .sales-return-screen-only { display: none !important; }

                .po-print-hide { display: none !important; }
                .po-print-only { display: block !important; }
              }
            `}</style>

            {/* FRO mobile-friendly view: use a compact card layout like the quotation view.
                The formal invoice/print layout below remains unchanged for Store Admin. */}
            {isFRO && (
              <div
                className={`flex flex-col overflow-hidden bg-white ${
                  isFRO
                    ? "h-full w-full"
                    : "max-h-[94vh] w-[calc(100vw-1rem)] max-w-[560px] rounded-2xl shadow-2xl sm:w-[560px]"
                }`}
              >
                <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedReturn(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    aria-label="Back"
                  >
                    <Icon name="arrow_back" size={19} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                      Sales Return
                    </p>
                    <h2 className="mt-0.5 truncate text-lg font-bold text-slate-800">
                      {selectedReturn.returnNo}
                    </h2>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {dateDisplay(selectedReturn.date)}
                    </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    <section className="rounded-xl border border-slate-200 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Farmer Details</p>
                          <p className="mt-1.5 truncate text-xs font-bold text-slate-800">{selectedReturn.partyName || "-"}</p>
                          <p className="mt-0.5 truncate text-[10px] text-slate-500">{selectedReturn.farmerVillage || "-"}</p>
                          <p className="truncate text-[10px] text-slate-500">{selectedReturn.farmerPhone || "-"}</p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Farm Details</p>
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
                            <div><span className="text-slate-400">Crop</span><p className="truncate font-semibold text-slate-700">{selectedReturn.farmerCrop || "-"}</p></div>
                            <div><span className="text-slate-400">Acre</span><p className="truncate font-semibold text-slate-700">{selectedReturn.farmerAcre || "-"}</p></div>
                            <div className="col-span-2"><span className="text-slate-400">Place</span><p className="truncate font-semibold text-slate-700">{selectedReturn.placeOfSupply || "Tamil Nadu"}</p></div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Products</p><p className="mt-0.5 text-[10px] text-slate-500">{selectedReturn.items.length} item{selectedReturn.items.length === 1 ? "" : "s"}</p></div>
                        <p className="text-sm font-extrabold text-emerald-700">{formatCurrency(selectedReturn.total)}</p>
                      </div>
                      <table className="w-full table-fixed border-collapse text-xs">
                        <thead><tr className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-400"><th className="w-[12%] px-2 py-2 text-center font-bold">S.No</th><th className="w-[52%] px-2 py-2 text-left font-bold">Product</th><th className="w-[14%] px-2 py-2 text-center font-bold">Qty</th><th className="w-[22%] px-2 py-2 text-right font-bold">Value</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedReturn.items.map((item,index)=>(<tr key={item.key}><td className="px-2 py-2.5 text-center text-slate-500">{index+1}</td><td className="px-2 py-2.5"><p className="truncate font-semibold text-slate-800">{item.product?.name || "-"}</p><p className="truncate text-[10px] text-slate-500">{item.packSize || "-"}</p></td><td className="px-2 py-2.5 text-center font-medium text-slate-700">{item.quantity}</td><td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-800 whitespace-nowrap">{formatCurrency(item.total)}</td></tr>))}
                        </tbody>
                      </table>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Return Summary</p>
                      <div className="mt-2 space-y-1">
                        <Summary label="Without Tax" value={selectedReturn.withoutTax} />
                        <Summary label="Tax" value={selectedReturn.sgst + selectedReturn.cgst + selectedReturn.igst} />
                        <div className="mt-2 border-t border-slate-200 pt-2"><Summary label="Grand Total" value={selectedReturn.total} bold /></div>
                      </div>
                    </section>
                  </div>
                </div>
                <div className="border-t border-slate-200 bg-white p-3"><button type="button" onClick={() => setSelectedReturn(null)} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back</button></div>
              </div>
            )}

            <div
              className={`${isFRO ? "hidden" : "flex"} sales-return-print-area max-h-[94vh] w-[calc(100vw-1rem)] max-w-[1450px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:w-[98vw]`}
            >
              <div className="sales-return-screen-only flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Sales Return
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800 sm:text-xl">
                    {selectedReturn.returnNo}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Against Invoice: {selectedReturn.invoiceNo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReturn(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <div className="grid grid-cols-1 border-b border-slate-300 md:grid-cols-[1.2fr_.8fr]">
                    <div className="border-r border-slate-300 p-3 md:p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center">
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
                            {store?.address ||
                              store?.location ||
                              "Rajapalayam, Tamil Nadu"}
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
                          SALES RETURN
                        </h2>
                        {/* <p className="mt-1 text-[10px] text-slate-500">
                          Against Tax Invoice {selectedReturn.invoiceNo}
                        </p> */}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 border-b border-slate-300 text-[9px] leading-4 md:grid-cols-3">
                    <div className="border-b border-slate-300 p-3 last:border-b-0 md:border-b-0 md:border-r md:p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Farmer Details
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedReturn.partyName}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {selectedReturn.farmerVillage || "-"}
                      </p>
                      <p className="text-slate-600">
                        Contact: {selectedReturn.farmerPhone || "-"}
                      </p>
                      <p className="text-slate-600">
                        Crop / Acre:{" "}
                        {[
                          selectedReturn.farmerCrop,
                          selectedReturn.farmerAcre
                            ? `${selectedReturn.farmerAcre} Acre`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </p>
                    </div>

                    <div className="border-b border-slate-300 p-3 last:border-b-0 md:border-b-0 md:border-r md:p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Original Invoice
                      </p>
                      <p className="font-bold text-slate-900">
                        {selectedReturn.invoiceNo}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Through: {selectedReturn.through}
                      </p>
                      {selectedReturn.through === "Executive" && (
                        <p className="text-slate-600">
                          Executive: {selectedReturn.executiveName || "-"}
                        </p>
                      )}
                      <p className="text-slate-600">
                        Place of Supply:{" "}
                        {selectedReturn.placeOfSupply || "Tamil Nadu"}
                      </p>
                    </div>

                    <div className="p-3">
                      <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                        Return Details
                      </p>
                      <div className="grid grid-cols-[92px_1fr] gap-y-1">
                        <span className="text-slate-500">Return No</span>
                        <span className="font-semibold text-slate-800">
                          {selectedReturn.returnNo}
                        </span>
                        <span className="text-slate-500">Date</span>
                        <span className="font-semibold text-slate-800">
                          {dateDisplay(selectedReturn.date)}
                        </span>
                        {/* <span className="text-slate-500">Invoice No</span>
                        <span className="font-semibold text-slate-800">{selectedReturn.invoiceNo}</span> */}
                      </div>
                    </div>
                  </div>

                  <div className="hidden w-full overflow-x-auto md:block">
                    <table className="w-full border-collapse text-[8.5px] xl:text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-700">
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Product
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            HSN Code
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            PKG Size
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Batch No
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Exp Date
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Qty
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Unit Price
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Before Discount
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Discount
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Taxable (₹)
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            SGST
                          </th>
                          <th
                            colSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            IGST
                          </th>
                          <th
                            rowSpan={2}
                            className="border-r border-slate-300 px-1 py-1.5 text-center"
                          >
                            Reason
                          </th>
                          <th rowSpan={2} className="px-1 py-1.5 text-center">
                            Line Total
                          </th>
                        </tr>
                        <tr className="border-b border-slate-400 bg-slate-50 text-slate-600">
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amt
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amount
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amount
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Rate %
                          </th>
                          <th className="border-r border-slate-300 px-1 py-1 text-center">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedReturn.items.map((item, index) => {
                          const cgstRate =
                            item.cgst > 0 && item.withoutTax > 0
                              ? (item.cgst / item.withoutTax) * 100
                              : 0;
                          const sgstRate =
                            item.sgst > 0 && item.withoutTax > 0
                              ? (item.sgst / item.withoutTax) * 100
                              : 0;
                          const igstRate =
                            item.igst > 0 && item.withoutTax > 0
                              ? (item.igst / item.withoutTax) * 100
                              : 0;

                          return (
                            <tr key={item.key} className="border-slate-300">
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {index + 1}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 font-semibold">
                                {item.product?.name || "-"}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {item.product?.hsnCode || "-"}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {item.packSize}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {item.batchNo}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {item.expiryDate}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                {item.quantity}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {formatCurrency(item.price)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {formatCurrency(item.beforeDiscount)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {item.discountPercent.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {formatCurrency(item.discountAmount)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold">
                                {formatCurrency(item.withoutTax)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {cgstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {formatCurrency(item.cgst)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {sgstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {formatCurrency(item.sgst)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {igstRate.toFixed(2)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {formatCurrency(item.igst)}
                              </td>
                              <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                {item.reason}
                              </td>
                              <td className="px-1 py-1.5 text-right font-bold">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* NEW: filler empty rows to extend the column borders like the sample invoice */}
                      {(() => {
                        const MIN_ROWS = 10;
                        const fillerCount = Math.max(
                          0,
                          MIN_ROWS - selectedReturn.items.length,
                        );
                        const columnCount = 20;

                        return Array.from({ length: fillerCount }).map(
                          (_, i) => (
                            <tr key={`filler-${i}`}>
                              {Array.from({ length: columnCount }).map(
                                (_, colIdx) => (
                                  <td
                                    key={colIdx}
                                    className={`px-1 py-1.5 ${
                                      colIdx < columnCount - 1
                                        ? "border-r border-slate-300"
                                        : ""
                                    }`}
                                  >
                                    &nbsp;
                                  </td>
                                ),
                              )}
                            </tr>
                          ),
                        );
                      })()}

                      <tfoot>
                        {(() => {
                          const products = selectedReturn?.items || [];

                          const totalQty = products.reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0,
                          );

                          const totalBeforeDiscount = products.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.quantity || 0) *
                                Number(item.price || 0),
                            0,
                          );

                          const totalDiscount = products.reduce(
                            (sum, item) =>
                              sum + Number(item.discountAmount || 0),
                            0,
                          );

                          const totalTaxable = products.reduce(
                            (sum, item) => sum + Number(item.withoutTax || 0),
                            0,
                          );

                          const isTamilNadu =
                            (selectedReturn?.placeOfSupply || "Tamil Nadu") ===
                            "Tamil Nadu";

                          const totalCGST = isTamilNadu
                            ? products.reduce(
                                (sum, item) =>
                                  sum + Number(item.taxAmount || 0) / 2,
                                0,
                              )
                            : 0;

                          const totalSGST = isTamilNadu
                            ? products.reduce(
                                (sum, item) =>
                                  sum + Number(item.taxAmount || 0) / 2,
                                0,
                              )
                            : 0;

                          const totalIGST = !isTamilNadu
                            ? products.reduce(
                                (sum, item) =>
                                  sum + Number(item.taxAmount || 0),
                                0,
                              )
                            : 0;

                          const totalLine = products.reduce(
                            (sum, item) => sum + Number(item.rowTotal || 0),
                            0,
                          );

                          return (
                            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
                              {/* S.No + Product + HSN + PKG Size + Batch No + Exp Date */}
                              <td
                                colSpan={6}
                                className="border-r border-slate-300 px-1 py-2 text-center"
                              >
                                TOTAL
                              </td>

                              {/* Qty */}
                              <td className="border-r border-slate-300 px-1 py-2 text-center">
                                {totalQty}
                              </td>

                              {/* Unit Price */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                -
                              </td>

                              {/* Before Discount */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                {formatCurrency(totalBeforeDiscount)}
                              </td>

                              {/* Discount % */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                -
                              </td>

                              {/* Discount Amount */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                {formatCurrency(totalDiscount)}
                              </td>

                              {/* Taxable */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                {formatCurrency(totalTaxable)}
                              </td>

                              {/* CGST Rate */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                -
                              </td>

                              {/* CGST Amount */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                {formatCurrency(totalCGST)}
                              </td>

                              {/* SGST Rate */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                -
                              </td>

                              {/* SGST Amount */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                {formatCurrency(totalSGST)}
                              </td>

                              {/* IGST Rate */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                -
                              </td>

                              {/* IGST Amount */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                {formatCurrency(totalIGST)}
                              </td>

                              {/* Reason */}
                              <td className="border-r border-slate-300 px-1 py-2 text-right">
                                -
                              </td>

                              {/* Line Total */}
                              <td className="px-1 py-2 text-right font-extrabold">
                                {formatCurrency(totalLine)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {/* ROW 1: Amount in Words (left) + Round Off / Grand Total (right) */}
                  <div className="grid grid-cols-1 border-t border-slate-300 md:grid-cols-[1fr_300px]">
                    <div className="border-r border-slate-300 p-2.5 flex items-center">
                      {(() => {
                        const grandTotal = selectedReturn.items.length
                          ? selectedReturn.items.reduce(
                              (sum, row) => sum + Number(row.rowTotal || 0),
                              0,
                            )
                          : Number(selectedReturn.total || 0);
                        const roundedTotal = Math.round(grandTotal);

                        function numberToWords(
                          roundedTotal: number,
                        ): import("react").ReactNode {
                          const ones = [
                            "zero",
                            "one",
                            "two",
                            "three",
                            "four",
                            "five",
                            "six",
                            "seven",
                            "eight",
                            "nine",
                            "ten",
                            "eleven",
                            "twelve",
                            "thirteen",
                            "fourteen",
                            "fifteen",
                            "sixteen",
                            "seventeen",
                            "eighteen",
                            "nineteen",
                          ];
                          const tens = [
                            "",
                            "",
                            "twenty",
                            "thirty",
                            "forty",
                            "fifty",
                            "sixty",
                            "seventy",
                            "eighty",
                            "ninety",
                          ];

                          const convert = (value: number): string => {
                            if (value < 20) return ones[value];
                            if (value < 100) {
                              return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${ones[value % 10]}` : ""}`;
                            }
                            if (value < 1000) {
                              return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` ${convert(value % 100)}` : ""}`;
                            }
                            if (value < 1000000) {
                              return `${convert(Math.floor(value / 1000))} thousand${value % 1000 ? ` ${convert(value % 1000)}` : ""}`;
                            }
                            if (value < 1000000000) {
                              return `${convert(Math.floor(value / 1000000))} million${value % 1000000 ? ` ${convert(value % 1000000)}` : ""}`;
                            }
                            return `${convert(Math.floor(value / 1000000000))} billion${value % 1000000000 ? ` ${convert(value % 1000000000)}` : ""}`;
                          };

                          if (roundedTotal < 0)
                            return `minus ${convert(Math.abs(roundedTotal))}`;
                          return convert(roundedTotal);
                        }

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
                      <Summary
                        label="Round Off"
                        value={(() => {
                          const total = selectedReturn.items.length
                            ? selectedReturn.items.reduce(
                                (sum, row) => sum + Number(row.rowTotal || 0),
                                0,
                              )
                            : Number(selectedReturn.total || 0);
                          const taxableTotal = selectedReturn.items.length
                            ? selectedReturn.items.reduce(
                                (sum, row) =>
                                  sum +
                                  Number(row.withoutTax || 0) +
                                  Number(row.sgst || 0) +
                                  Number(row.cgst || 0) +
                                  Number(row.igst || 0),
                                0,
                              )
                            : Number(selectedReturn.withoutTax || 0) +
                              Number(selectedReturn.sgst || 0) +
                              Number(selectedReturn.cgst || 0) +
                              Number(selectedReturn.igst || 0);
                          return total - taxableTotal;
                        })()}
                        muted
                      />

                      <div className="border-t border-slate-300 pt-1.5">
                        <Summary
                          label="Grand Total"
                          value={
                            selectedReturn.items.length
                              ? selectedReturn.items.reduce(
                                  (sum, row) => sum + Number(row.rowTotal || 0),
                                  0,
                                )
                              : Number(selectedReturn.total || 0)
                          }
                          bold
                        />
                      </div>
                    </div>
                  </div>

                  {/* ROW 2: Notes (left) + Authorised Signatory (right) */}
                  <div className="grid min-h-[110px] grid-cols-[1fr_300px] border-t border-slate-300">
                    {/* NOTES */}
                    <div className="flex flex-col justify-end border-b border-slate-300 p-4 md:border-b-0 md:border-r">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>

                      {(() => {
                        const defaultNotes = `Purchase order raised by ${
                          selectedReturn?.placeOfSupply ?? "this store"
                        } to Nature Biotic.`;

                        return (
                          <>
                            {/* Screen - Editable Notes */}
                            <textarea
                              value={purchaseOrderNotes}
                              onChange={(e) =>
                                setPurchaseOrderNotes(e.target.value)
                              }
                              rows={2}
                              placeholder="Enter notes..."
                              className="po-print-hide mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 focus:border-brand-500 focus:outline-none"
                            />

                            {/* Print - Show edited notes */}
                            <p className="po-print-only mt-1.5 hidden whitespace-pre-line text-xs text-slate-500">
                              {purchaseOrderNotes || defaultNotes}
                            </p>
                          </>
                        );
                      })()}
                    </div>

                    {/* AUTHORISED SIGNATORY */}
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

              <div className="sales-return-screen-only flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedReturn(null)}
                >
                  Close
                </Button>
                {!isFRO && (
                  <Button onClick={() => window.print()}>
                    <Icon name="print" size={18} />
                    Print Sales Return
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
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
  value: number;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={muted ? "text-slate-400" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={
          muted
            ? "font-semibold text-slate-400"
            : bold
              ? "font-bold text-slate-800"
              : "font-semibold text-slate-700"
        }
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
