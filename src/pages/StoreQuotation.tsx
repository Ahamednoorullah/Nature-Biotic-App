import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import {
  formatCurrency,
  matchesSimpleDate,
  type SimpleDateFilter,
} from "@/lib/format";
import { createPortal } from "react-dom";
import { QuotationBill } from "@/components/QuotationBill";
import {
  products as allProducts,
  getFarmersByStore,
  getStore,
} from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";
import {
  FroDocumentActions,
} from "@/components/FroDocumentActions";
import {
  documentShareMessage,
  detailedShareMessage,
  farmerContactText,
  openWhatsAppShare,
} from "@/lib/whatsappShare";
import {
  DOCUMENT_PDF_WIDTH_PX,
  documentPdfFileName,
  documentPrintStyle,
  printDocumentPdf,
  shareDocumentPdf,
} from "@/lib/documentPdf";

type ProductRow = {
  id: string;
  product: string;
  productName: string;
  pkgsize: string;
  batchNo?: string;
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
  executiveName?: string;
  createdByStaffId?: string;
  through?: string;
  withoutTax: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
  status: string;
};

export default function StoreQuotation({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { goStorePage } = useNav();
  const isFRO = user?.role === "fro";

  const quotationStorageKey = `nature-biotic-quotations-${storeId}`;

  const storeFarmers = useMemo(() => getFarmersByStore(storeId), [storeId]);
  const registeredFarmers = useMemo(() => {
    const farmers = storeFarmers;

    if (!isFRO || !user?.name) {
      return farmers;
    }

    const loggedInName = user.name.trim().toLowerCase();

    return farmers.filter(
      (farmer) =>
        farmer.through === "Executive" &&
        String(farmer.executiveName || "")
          .trim()
          .toLowerCase() === loggedInName,
    );
  }, [storeFarmers, isFRO, user?.name]);

  const storeProducts = useMemo(() => {
    const unique = new Map<
      string,
      {
        key: string;
        productId: string;
        name: string;
        size: string;
        sellingPrice: number;
        taxPercentage: number;
      }
    >();
    allProducts
      .filter((product) => product.status !== "Inactive")
      .forEach((product) => {
        const name = String(product.name || "").trim();
        const size = String(product.size || "").trim();
        if (!name || !size) return;
        const key = `${name.toLowerCase()}|${size.toLowerCase()}`;
        if (unique.has(key)) return;
        unique.set(key, {
          key,
          productId: product.id,
          name,
          size,
          sellingPrice: Number(product.sellingPrice || 0),
          taxPercentage: Number(product.taxPercentage || 0),
        });
      });
    return Array.from(unique.values());
  }, []);

  const [selectedQuotation, setSelectedQuotation] = useState<Row | null>(null);
  const [dateFilter, setDateFilter] = useState<SimpleDateFilter>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  function withoutSampleQuotations(list: Row[]) {
    return list.filter(
      (row) =>
        !(
          (row.id === "1" && row.quotationNo === "QT-1001") ||
          (row.id === "2" && row.quotationNo === "QT-1000")
        ),
    );
  }

  // Keep quotations shared between FRO and Store views for the same store.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(quotationStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      const next = withoutSampleQuotations(parsed);
      setRows(next);
      if (next.length !== parsed.length) {
        window.localStorage.setItem(quotationStorageKey, JSON.stringify(next));
      }
    } catch {
      // Keep the existing in-memory quotations if localStorage is unavailable.
    }
  }, [storeId]);

  useEffect(() => {
    if (!isFRO) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== quotationStorageKey || !event.newValue) return;

      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          setRows(withoutSampleQuotations(parsed));
        }
      } catch {
        // Ignore malformed external storage updates.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isFRO, quotationStorageKey]);

  const visibleRows = useMemo(() => {
    if (!isFRO || !user?.name) {
      return rows;
    }

    const loggedInName = user.name.trim().toLowerCase();

    return rows.filter(
      (row) =>
        String(row.executiveName || "")
          .trim()
          .toLowerCase() === loggedInName &&
        String(row.createdByStaffId || "") === String(user.staffId ?? user.id),
    );
  }, [rows, isFRO, user?.name, user?.staffId, user?.id]);

  const quotationDateOptions: { value: SimpleDateFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom Date" },
  ];

  const listedRows = useMemo(
    () =>
      visibleRows.filter((row) =>
        matchesSimpleDate(row.date, dateFilter, customFrom, customTo),
      ),
    [visibleRows, dateFilter, customFrom, customTo],
  );

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
    batchNo: "",
    qty: "1",
    rate: "",
    taxPercent: 0,
    sgstPercent: 0,
    cgstPercent: 0,
    igstPercent: 0,
  });

  const [draftProduct, setDraftProduct] =
    useState<ProductRow>(emptyDraftProduct());

  const productNameOptions = useMemo(() => {
    const names = Array.from(new Set(storeProducts.map((item) => item.name)));

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

  function chooseQuotationProduct(value: string) {
    setDraftProduct((current) => ({
      ...current,
      product: value,
      productName: value,
      pkgsize: "",
      batchNo: "",
      rate: "",
      taxPercent: 0,
      sgstPercent: 0,
      cgstPercent: 0,
      igstPercent: 0,
    }));
  }

  function chooseQuotationSize(value: string) {
    const variant = storeProducts.find(
      (item) => item.name === draftProduct.product && item.size === value,
    );
    const split = getTaxSplit(
      placeOfSupply,
      Number(variant?.taxPercentage || 0),
    );
    setDraftProduct((current) => ({
      ...current,
      pkgsize: variant?.size || value,
      batchNo: "",
      rate: variant ? String(variant.sellingPrice || 0) : current.rate,
      taxPercent: Number(variant?.taxPercentage || 0),
      ...split,
    }));
  }

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
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState("");
  const quotationBillRef = useRef<HTMLDivElement>(null);
  const sharingQuotation = useRef(false);

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
        const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);

        total.sgst += (base * Number(item.sgstPercent || 0)) / 100;
        total.cgst += (base * Number(item.cgstPercent || 0)) / 100;
        total.igst += (base * Number(item.igstPercent || 0)) / 100;

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
      (item) => item.product && Number(item.qty) > 0 && Number(item.rate) > 0,
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

    const selectedFarmer = registeredFarmers.find((item) => item.id === id);

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
      selectedFarmer.cropType || selectedFarmer.crops?.[0]?.cropType || "";
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
        const split = getTaxSplit(supply, Number(item.taxPercent || 0));

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
      alert("Select a product and package size from the company catalog.");
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

  function updateAddedProduct(id: string, field: "qty", value: string) {
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
      (item) =>
        item.product.trim() && Number(item.qty) > 0 && Number(item.rate) > 0,
    );

  function save() {
    const hasValidProduct = products.some(
      (item) =>
        item.product.trim() && Number(item.qty) > 0 && Number(item.rate) > 0,
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
      through: isFRO ? "Executive" : "Direct",
      executiveName: isFRO ? user?.name : undefined,
      createdByStaffId: isFRO ? (user?.staffId ?? user?.id) : undefined,
    };

    setRows((prev) => {
      const next = [newQuotation, ...prev];
      try {
        window.localStorage.setItem(quotationStorageKey, JSON.stringify(next));
      } catch {
        // Keep the in-memory update if localStorage is unavailable.
      }
      return next;
    });

    resetForm();
    setShow(false);
  }

  function getThroughLabel(row: Row): string {
    if (row.through === "Direct") return "Direct";
    if (row.through === "Executive") {
      return row.executiveName || "Executive";
    }

    // Backward compatibility for older quotations created before `through`
    // was stored explicitly.
    return row.executiveName || "Direct";
  }

  function taxRateLabel(
    products: ProductRow[] | undefined,
    field: "sgstPercent" | "cgstPercent" | "igstPercent",
  ): string {
    const values = Array.from(
      new Set(
        (products || [])
          .filter((item) => Number(item[field] || 0) > 0)
          .map((item) => Number(item[field] || 0)),
      ),
    );

    if (values.length === 0) return "0.00";
    if (values.length === 1) return values[0].toFixed(2);
    return "Mix";
  }

  if (isFRO && selectedQuotation) {
    const quotation = selectedQuotation;
    const contact = farmerContactText(
      storeFarmers.find((row) => row.id === quotation.farmerId),
      {
        name: quotation.farmer,
        village: quotation.village,
        phone: quotation.phone,
      },
    );
    const storeName = getStore(storeId)?.name || "Nature Biotic";
    const billQuotation = {
      ...quotation,
      farmer: contact.name,
      village: contact.village,
      phone: contact.phone,
    };

    async function shareOnWhatsApp() {
      await shareDocumentPdf({
        sheet: quotationBillRef.current,
        phone: contact.phone,
        fileName: documentPdfFileName(quotation.quotationNo),
        message: detailedShareMessage({
          farmerName: contact.name,
          intro: "Please find your quotation details.",
          numberLabel: "Quotation No",
          number: quotation.quotationNo,
          date: formatDate(quotation.date),
          lines: (quotation.products || []).map((item) => {
            const qty = Number(item.qty || 0);
            const rate = Number(item.rate || 0);
            const base = qty * rate;
            const tax =
              (base *
                (Number(item.sgstPercent || 0) +
                  Number(item.cgstPercent || 0) +
                  Number(item.igstPercent || 0))) /
              100;
            return {
              name: item.productName,
              packSize: item.pkgsize,
              qty: item.qty,
              rate: formatCurrency(rate),
              amount: formatCurrency(base + tax),
            };
          }),
          lineAmountLabel: "Amount",
          totalLabel: (quotation.products || []).length > 1 ? "Grand Total" : "Total",
          total: formatCurrency(quotation.amount),
          storeName,
        }),
        lock: sharingQuotation,
      });
    }

    return (
      <div className="min-h-full bg-slate-50">
        <style>{documentPrintStyle}</style>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedQuotation(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back to quotations"
            >
              <Icon name="arrow_back" size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-800">Quotation</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {quotation.quotationNo} · {formatDate(quotation.date)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="min-w-0 p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Farmer Details
              </p>
              <p className="mt-1.5 text-sm font-extrabold text-slate-800">
                {contact.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{contact.village}</p>
              <p className="mt-0.5 text-xs text-slate-500">{contact.phone}</p>
            </Card>

            <Card className="min-w-0 p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Farm Details
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-400">Crop</span>
                  <p className="font-semibold text-slate-700">{quotation.crop || "-"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Acre</span>
                  <p className="font-semibold text-slate-700">{quotation.acre || "-"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Place</span>
                  <p className="font-semibold text-slate-700">{quotation.placeOfSupply || "-"}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Products</p>
                <p className="mt-0.5 text-xs text-slate-500">{quotation.products?.length || 0} item(s)</p>
              </div>
              <p className="text-sm font-extrabold text-brand-700">{formatCurrency(quotation.amount)}</p>
            </div>
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse text-[11px] sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500">
                    <th className="w-[12%] px-2 py-2.5 text-center font-semibold">S.No</th>
                    <th className="w-[50%] px-2 py-2.5 text-left font-semibold">Product</th>
                    <th className="w-[15%] px-1 py-2.5 text-center font-semibold">Qty</th>
                    <th className="w-[23%] px-2 py-2.5 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(quotation.products || []).map((item, index) => {
                    const withoutTax = Number(item.qty || 0) * Number(item.rate || 0);
                    const tax = (withoutTax * Number(item.taxPercent || 0)) / 100;
                    return (
                      <tr key={item.id}>
                        <td className="px-2 py-3 text-center text-slate-500">{index + 1}</td>
                        <td className="min-w-0 px-2 py-3">
                          <p className="break-words font-semibold leading-4 text-slate-800">{item.productName || item.product || "-"}</p>
                          <p className="mt-0.5 break-words text-[10px] text-slate-500">{item.pkgsize || "-"}</p>
                        </td>
                        <td className="px-1 py-3 text-center font-medium text-slate-700">{item.qty ?? "-"}</td>
                        <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">{formatCurrency(withoutTax + tax)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Quotation Summary</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Without Tax</span><span className="font-semibold text-slate-700">{formatCurrency(quotation.withoutTax)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">SGST</span><span className="font-semibold text-slate-700">{formatCurrency(quotation.sgst)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">CGST</span><span className="font-semibold text-slate-700">{formatCurrency(quotation.cgst)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">IGST</span><span className="font-semibold text-slate-700">{formatCurrency(quotation.igst)}</span></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2"><span className="font-bold text-slate-800">Grand Total</span><span className="text-base font-extrabold text-brand-700">{formatCurrency(quotation.amount)}</span></div>
            </div>
          </Card>
        </div>
        <FroDocumentActions
          onWhatsApp={() => {
            void shareOnWhatsApp();
          }}
          onPrint={() => {
            void printDocumentPdf(quotationBillRef.current);
          }}
          onClose={() => setSelectedQuotation(null)}
        />
        {createPortal(
          <div
            ref={quotationBillRef}
            className="quotation-pdf-sheet"
            aria-hidden="true"
            style={{
              position: "fixed",
              left: -2400,
              top: 0,
              width: DOCUMENT_PDF_WIDTH_PX,
              background: "#fff",
              pointerEvents: "none",
            }}
          >
            <QuotationBill
              quotation={billQuotation}
              notes={quotation.remarks || ""}
              documentMode
            />
          </div>,
          document.body,
        )}
      </div>
    );
  }

  const quotationFormView = (
    <div
      className={
        isFRO
          ? "min-h-full w-full bg-slate-50"
          : "fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      }
    >
      <div
        className={
          isFRO
            ? "flex min-h-full w-full flex-col bg-white"
            : "nb-modal-panel flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        }
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {isFRO && (
              <button
                type="button"
                onClick={closeQuotation}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                aria-label="Back to quotations"
              >
                <Icon name="arrow_back" size={19} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Create Quotation
              </h2>

              <p className="mt-0.5 text-sm text-slate-500">
                Create a quotation for farmer
              </p>
            </div>
          </div>

          {!isFRO && (
            <button
              type="button"
              onClick={closeQuotation}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          )}
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

                <Input label="Crop" value={crop} onChange={() => {}} readOnly />

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
                  Select products from the company product catalog
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1.4fr)_180px_100px_140px_100px_150px] md:items-end">
                  <Select
                    label="Product"
                    value={draftProduct.product}
                    onChange={chooseQuotationProduct}
                    placeholder={
                      productNameOptions.length
                        ? "Select product"
                        : "No company products"
                    }
                    options={productNameOptions}
                  />

                  <Select
                    label="PKG Size"
                    value={draftProduct.pkgsize}
                    onChange={chooseQuotationSize}
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

                <div className="quotation-mobile-products md:hidden space-y-2.5">
                  {products.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      No products added yet.
                    </div>
                  ) : (
                    products.map((item, index) => {
                      const withoutTax =
                        Number(item.qty || 0) * Number(item.rate || 0);
                      const tax =
                        (withoutTax * Number(item.taxPercent || 0)) / 100;
                      const total = withoutTax + tax;

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Product {index + 1}
                              </p>
                              <p className="mt-0.5 truncate text-sm font-extrabold text-slate-800">
                                {item.productName || item.product}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {item.pkgsize || "-"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProduct(item.id)}
                              className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove ${item.productName || item.product}`}
                            >
                              <Icon name="delete" size={18} />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[10px] text-slate-400">Qty</p>
                              <Input
                                type="number"
                                value={item.qty}
                                onChange={(value) =>
                                  updateAddedProduct(item.id, "qty", value)
                                }
                              />
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[10px] text-slate-400">
                                Price
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-700">
                                {formatCurrency(Number(item.rate || 0))}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[10px] text-slate-400">GST</p>
                              <p className="mt-1 text-sm font-semibold text-slate-700">
                                {Number(item.taxPercent || 0).toFixed(2)}%
                              </p>
                            </div>
                            <div className="rounded-lg bg-brand-50 px-3 py-2">
                              <p className="text-[10px] text-brand-600">
                                Total
                              </p>
                              <p className="mt-1 text-sm font-extrabold text-brand-700">
                                {formatCurrency(total)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                            <span className="text-slate-400">Without Tax</span>
                            <span className="font-semibold text-slate-600">
                              {formatCurrency(withoutTax)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Tax</span>
                            <span className="font-semibold text-slate-600">
                              {formatCurrency(tax)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="quotation-desktop-products hidden md:block overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="w-[5%] px-2 py-3 text-center">S.No</th>
                        <th className="w-[20%] px-3 py-3 text-left">Product</th>
                        <th className="w-[11%] px-2 py-3 text-center">
                          PKG Size
                        </th>
                        <th className="w-[9%] px-2 py-3 text-center">Qty</th>
                        <th className="w-[12%] px-2 py-3 text-right">Price</th>
                        <th className="w-[9%] px-2 py-3 text-center">GST %</th>
                        <th className="w-[12%] px-2 py-3 text-right">
                          Without Tax
                        </th>
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
                            Number(item.qty || 0) * Number(item.rate || 0);
                          const tax =
                            (withoutTax * Number(item.taxPercent || 0)) / 100;
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
                                    updateAddedProduct(item.id, "qty", value)
                                  }
                                />
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatCurrency(Number(item.rate || 0))}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {Number(item.taxPercent || 0).toFixed(2)}
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
                                  onClick={() => removeProduct(item.id)}
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

            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
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

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
                  Quotation Summary
                </h3>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Tax</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(cgstAmount + sgstAmount + igstAmount)}
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-slate-200 pt-3 pl-8">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">SGST</span>
                        <span className="text-xs font-medium text-slate-600">
                          {formatCurrency(sgstAmount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">CGST</span>
                        <span className="text-xs font-medium text-slate-600">
                          {formatCurrency(cgstAmount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">IGST</span>
                        <span className="text-xs font-medium text-slate-600">
                          {formatCurrency(igstAmount)}
                        </span>
                      </div>
                    </div>

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

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={closeQuotation}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <Button onClick={save} disabled={!canSave}>
            Save Quotation
          </Button>
        </div>
      </div>
    </div>
  );

  // FRO quotation details are opened as an in-page view (not a popup).

  // FRO quotation details are opened as an in-page view (not a popup).
  if (isFRO && selectedQuotation) {
    const quotation = selectedQuotation;

    return (
      <div className="min-h-full bg-slate-50">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedQuotation(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back to quotations"
            >
              <Icon name="arrow_back" size={19} />
            </button>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-800">Quotation</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {quotation.quotationNo} · {formatDate(quotation.date)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Farmer + farm details */}
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="min-w-0 p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Farmer Details
              </p>
              <p className="mt-1.5 text-sm font-extrabold text-slate-800">
                {quotation.farmer || "-"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {quotation.village || "-"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {quotation.phone || "-"}
              </p>
            </Card>

            <Card className="min-w-0 p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Farm Details
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-400">Crop</span>
                  <p className="font-semibold text-slate-700">
                    {quotation.crop || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Acre</span>
                  <p className="font-semibold text-slate-700">
                    {quotation.acre || "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Place</span>
                  <p className="font-semibold text-slate-700">
                    {quotation.placeOfSupply || "-"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Products - no horizontal scroll */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Products
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {quotation.products?.length || 0} item(s)
                </p>
              </div>
              <p className="text-sm font-extrabold text-brand-700">
                {formatCurrency(quotation.amount)}
              </p>
            </div>

            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse text-[11px] sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500">
                    <th className="w-[12%] px-2 py-2.5 text-center font-semibold">
                      S.No
                    </th>
                    <th className="w-[50%] px-2 py-2.5 text-left font-semibold">
                      Product
                    </th>
                    <th className="w-[15%] px-1 py-2.5 text-center font-semibold">
                      Qty
                    </th>
                    <th className="w-[23%] px-2 py-2.5 text-right font-semibold">
                      Value
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {(quotation.products || []).map((item, index) => {
                    const withoutTax =
                      Number(item.qty || 0) * Number(item.rate || 0);
                    const tax =
                      (withoutTax * Number(item.taxPercent || 0)) / 100;

                    return (
                      <tr key={item.id}>
                        <td className="px-2 py-3 text-center text-slate-500">
                          {index + 1}
                        </td>
                        <td className="min-w-0 px-2 py-3">
                          <p className="break-words font-semibold leading-4 text-slate-800">
                            {item.productName || item.product || "-"}
                          </p>
                          <p className="mt-0.5 break-words text-[10px] text-slate-500">
                            {item.pkgsize || "-"}
                          </p>
                        </td>
                        <td className="px-1 py-3 text-center font-medium text-slate-700">
                          {item.qty ?? "-"}
                        </td>
                        <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                          {formatCurrency(withoutTax + tax)}
                        </td>
                      </tr>
                    );
                  })}

                  {(!quotation.products || quotation.products.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-xs text-slate-400"
                      >
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Quotation Summary
            </p>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Without Tax</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(quotation.withoutTax)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">SGST</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(quotation.sgst)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">CGST</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(quotation.cgst)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">IGST</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(quotation.igst)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-800">Grand Total</span>
                <span className="text-base font-extrabold text-brand-700">
                  {formatCurrency(quotation.amount)}
                </span>
              </div>
            </div>
          </Card>
        </div>
        <FroDocumentActions
          onWhatsApp={() => {
            const farmer = getFarmersByStore(storeId).find(
              (row) => row.id === quotation.farmerId,
            );
            const sent = openWhatsAppShare(
              farmer?.phone || quotation.phone || "",
              documentShareMessage({
                kind: "Quotation",
                farmerName: farmer?.name || quotation.farmer || "Farmer",
                numberLabel: "Quotation No",
                number: quotation.quotationNo,
                date: formatDate(quotation.date),
                amount: formatCurrency(quotation.amount),
              }),
            );
            if (sent) window.setTimeout(() => window.print(), 400);
          }}
          onPrint={() => window.print()}
          onClose={() => setSelectedQuotation(null)}
        />
      </div>
    );
  }

  // FRO create quotation stays inside the existing page shell so the default app header is untouched.
  if (isFRO && show) {
    return quotationFormView;
  }

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {isFRO && (
            <button
              type="button"
              onClick={() => goStorePage("sales")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Back"
            >
              <Icon name="arrow_back" size={19} />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800">Quotation</h1>
            {!isFRO && (
              <p className="mt-1 text-slate-500">
                Create and manage farmer quotations.
              </p>
            )}
          </div>
        </div>

        {isFRO ? (
          <button
            type="button"
            onClick={() => setShow(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm transition hover:bg-brand-700"
            aria-label="New Quotation"
            title="New Quotation"
          >
            <Icon name="add" size={19} />
          </button>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <div className="w-full sm:w-44">
              <Select
                label="Date Filter"
                value={dateFilter}
                onChange={(value) => setDateFilter(value as SimpleDateFilter)}
                options={quotationDateOptions}
              />
            </div>
            {dateFilter === "custom" && (
              <>
                <div className="w-full sm:w-40">
                  <Input
                    label="From Date"
                    type="date"
                    value={customFrom}
                    onChange={setCustomFrom}
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Input
                    label="To Date"
                    type="date"
                    value={customTo}
                    onChange={setCustomTo}
                  />
                </div>
              </>
            )}
            <Button onClick={openQuotation}>
              <Icon name="add" size={18} />
              New Quotation
            </Button>
          </div>
        )}
      </div>

      {/* QUOTATION TABLE / MOBILE LIST */}
      {isFRO ? (
        <Card className="overflow-hidden p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[11px] sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-[9px] sm:text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-[11%] border-r border-slate-200 px-1 py-2.5 text-center font-semibold">
                    S.No
                  </th>
                  <th className="w-[18%] border-r border-slate-200 px-1 py-2.5 text-center font-semibold">
                    Date
                  </th>
                  <th className="w-[49%] border-r border-slate-200 px-2 py-2.5 text-left font-semibold">
                    Farmer
                  </th>
                  <th className="w-[22%] px-1.5 py-2.5 text-right font-semibold">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-10 text-center text-xs text-slate-400"
                    >
                      No quotations found.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r, index) => {
                    const contact = farmerContactText(
                      storeFarmers.find((farmer) => farmer.id === r.farmerId),
                      { name: r.farmer, village: r.village, phone: r.phone },
                    );
                    return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedQuotation(r)}
                      className="cursor-pointer transition hover:bg-brand-50/40"
                    >
                      <td className="border-r border-slate-100 px-1 py-2.5 text-center font-medium text-slate-500">
                        {index + 1}
                      </td>
                      <td className="border-r border-slate-100 px-1 py-2.5 text-center whitespace-nowrap text-slate-600">
                        {formatDate(r.date)}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-2.5 text-left min-w-0">
                        <p className="font-semibold text-slate-800 break-words leading-4">
                          {contact.name}
                        </p>
                        <p className="mt-0.5 text-[9px] sm:text-xs text-slate-500 break-words leading-3.5">
                          {contact.village}
                        </p>
                        <p className="mt-0.5 text-[9px] sm:text-xs text-slate-400 break-all leading-3.5">
                          {contact.phone}
                        </p>
                      </td>
                      <td className="px-1.5 py-2.5 text-right font-bold tabular-nums text-brand-700 whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <>
          {/* QUOTATION TABLE / MOBILE LIST */}
          <Card className="overflow-hidden p-0">
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] table-fixed border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th
                      rowSpan={2}
                      className="w-[4%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                    >
                      S.No
                    </th>
                    <th
                      rowSpan={2}
                      className="w-[8%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                    >
                      Date
                    </th>
                    <th
                      rowSpan={2}
                      className="w-[10%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                    >
                      Quotation No
                    </th>
                    <th
                      rowSpan={2}
                      className="w-[15%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                    >
                      Farmer Details
                    </th>
                    <th
                      rowSpan={2}
                      className="w-[9%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                    >
                      Through
                    </th>
                    <th
                      rowSpan={2}
                      className="w-[10%] border-r border-slate-200 px-2 py-2 text-center font-semibold"
                    >
                      Without Tax
                    </th>
                    <th
                      colSpan={2}
                      className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold"
                    >
                      SGST
                    </th>
                    <th
                      colSpan={2}
                      className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold"
                    >
                      CGST
                    </th>
                    <th
                      colSpan={2}
                      className="w-[12%] border-r border-slate-200 px-1 py-2 text-center font-semibold"
                    >
                      IGST
                    </th>
                    <th
                      rowSpan={2}
                      className="w-[11%] px-2 py-2 text-right font-semibold"
                    >
                      Total
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="border-r border-slate-200 px-1 py-2 text-center">
                      %
                    </th>
                    <th className="border-r border-slate-200 px-1 py-2 text-center">
                      Amt
                    </th>
                    <th className="border-r border-slate-200 px-1 py-2 text-center">
                      %
                    </th>
                    <th className="border-r border-slate-200 px-1 py-2 text-center">
                      Amt
                    </th>
                    <th className="border-r border-slate-200 px-1 py-2 text-center">
                      %
                    </th>
                    <th className="border-r border-slate-200 px-1 py-2 text-center">
                      Amt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-12 text-center text-sm text-slate-400"
                      >
                        No quotations found.
                      </td>
                    </tr>
                  ) : (
                    listedRows.map((r, index) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedQuotation(r)}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40"
                        title="Click to view quotation"
                      >
                        <td className="border-r border-slate-100 px-2 py-3 text-center">
                          {index + 1}
                        </td>
                        <td className="border-r border-slate-100 px-2 py-3 text-center whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>
                        <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-800">
                          {r.quotationNo}
                        </td>
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
                        <td className="border-r border-slate-100 px-2 py-3 text-center font-semibold text-slate-700">
                          {getThroughLabel(r)}
                        </td>
                        <td className="border-r border-slate-100 px-2 py-3 text-right font-semibold tabular-nums text-slate-700">
                          {formatCurrency(r.withoutTax)}
                        </td>
                        <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                          {taxRateLabel(r.products, "sgstPercent")}
                        </td>
                        <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                          {formatCurrency(r.sgst)}
                        </td>
                        <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                          {taxRateLabel(r.products, "cgstPercent")}
                        </td>
                        <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                          {formatCurrency(r.cgst)}
                        </td>
                        <td className="border-r border-slate-100 px-1 py-3 text-center tabular-nums text-slate-600">
                          {taxRateLabel(r.products, "igstPercent")}
                        </td>
                        <td className="border-r border-slate-100 px-1 py-3 text-right tabular-nums text-slate-600">
                          {formatCurrency(r.igst)}
                        </td>
                        <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-800">
                          {formatCurrency(r.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="divide-y divide-slate-100 md:hidden">
              {listedRows.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-400">
                  No quotations found.
                </div>
              ) : (
                listedRows.map((r, index) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedQuotation(r)}
                    className="block w-full p-4 text-left transition active:bg-brand-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          #{index + 1} · {formatDate(r.date)}
                        </p>
                        <p className="mt-1 truncate text-sm font-extrabold text-slate-800">
                          {r.quotationNo}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-extrabold text-brand-700">
                        {formatCurrency(r.amount)}
                      </p>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-bold text-slate-800">
                        {r.farmer}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {r.village || "-"} · {r.phone || "-"}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-slate-100 px-3 py-2">
                        <p className="text-slate-400">Through</p>
                        <p className="mt-0.5 font-semibold text-slate-700">
                          {getThroughLabel(r)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 px-3 py-2">
                        <p className="text-slate-400">Without Tax</p>
                        <p className="mt-0.5 font-semibold text-slate-700">
                          {formatCurrency(r.withoutTax)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 px-3 py-2">
                        <p className="text-slate-400">Total Tax</p>
                        <p className="mt-0.5 font-semibold text-slate-700">
                          {formatCurrency(r.sgst + r.cgst + r.igst)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        SGST {taxRateLabel(r.products, "sgstPercent")}% · CGST{" "}
                        {taxRateLabel(r.products, "cgstPercent")}% · IGST{" "}
                        {taxRateLabel(r.products, "igstPercent")}%
                      </span>
                      <Icon name="chevron_right" size={17} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {/* =========================
          NEW QUOTATION POPUP
         ========================= */}
      {show &&
        createPortal(
          <div
            className={
              isFRO
                ? "fixed inset-x-0 top-[60px] bottom-[60px] z-[10000] flex min-h-0 w-full flex-col bg-white"
                : "fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            }
          >
            <div
              className={
                isFRO
                  ? "w-full overflow-y-auto bg-white"
                  : "nb-modal-panel flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              }
            >
              {/* MODAL HEADER */}
              <div className="flex min-h-[68px] items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  {isFRO && (
                    <button
                      type="button"
                      onClick={closeQuotation}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                      aria-label="Back to quotations"
                    >
                      <Icon name="arrow_back" size={19} />
                    </button>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Create Quotation
                    </h2>

                    <p className="mt-0.5 text-sm text-slate-500">
                      Create a quotation for farmer
                    </p>
                  </div>
                </div>

                {!isFRO && (
                  <button
                    type="button"
                    onClick={closeQuotation}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* MODAL BODY */}
              <div className={isFRO ? "overflow-visible" : "flex-1 overflow-y-auto"}>
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
                        Select products from the company product catalog
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1.4fr)_180px_100px_140px_100px_150px] md:items-end">
                        <Select
                          label="Product"
                          value={draftProduct.product}
                          onChange={chooseQuotationProduct}
                          placeholder={
                            productNameOptions.length
                              ? "Select product"
                              : "No company products"
                          }
                          options={productNameOptions}
                        />

                        <Select
                          label="PKG Size"
                          value={draftProduct.pkgsize}
                          onChange={chooseQuotationSize}
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

                      {/* Mobile added-products cards */}
                      <div className="quotation-mobile-products md:hidden space-y-2.5">
                        {products.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                            No products added yet.
                          </div>
                        ) : (
                          products.map((item, index) => {
                            const withoutTax =
                              Number(item.qty || 0) * Number(item.rate || 0);
                            const tax =
                              (withoutTax * Number(item.taxPercent || 0)) / 100;
                            const total = withoutTax + tax;

                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                      Product {index + 1}
                                    </p>
                                    <p className="mt-0.5 truncate text-sm font-extrabold text-slate-800">
                                      {item.productName || item.product}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {item.pkgsize || "-"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeProduct(item.id)}
                                    className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                                    aria-label={`Remove ${item.productName || item.product}`}
                                  >
                                    <Icon name="delete" size={18} />
                                  </button>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] text-slate-400">
                                      Qty
                                    </p>
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
                                  </div>
                                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] text-slate-400">
                                      Price
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                      {formatCurrency(Number(item.rate || 0))}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] text-slate-400">
                                      GST
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                      {Number(item.taxPercent || 0).toFixed(2)}%
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-brand-50 px-3 py-2">
                                    <p className="text-[10px] text-brand-600">
                                      Total
                                    </p>
                                    <p className="mt-1 text-sm font-extrabold text-brand-700">
                                      {formatCurrency(total)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                                  <span className="text-slate-400">
                                    Without Tax
                                  </span>
                                  <span className="font-semibold text-slate-600">
                                    {formatCurrency(withoutTax)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400">Tax</span>
                                  <span className="font-semibold text-slate-600">
                                    {formatCurrency(tax)}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="quotation-desktop-products hidden md:block overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full table-fixed border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                              <th className="w-[5%] px-2 py-3 text-center">
                                S.No
                              </th>
                              <th className="w-[20%] px-3 py-3 text-left">
                                Product
                              </th>
                              <th className="w-[11%] px-2 py-3 text-center">
                                PKG Size
                              </th>
                              <th className="w-[9%] px-2 py-3 text-center">
                                Qty
                              </th>
                              <th className="w-[12%] px-2 py-3 text-right">
                                Price
                              </th>
                              <th className="w-[9%] px-2 py-3 text-center">
                                GST %
                              </th>
                              <th className="w-[12%] px-2 py-3 text-right">
                                Without Tax
                              </th>
                              <th className="w-[12%] px-2 py-3 text-right">
                                Tax
                              </th>
                              <th className="w-[12%] px-2 py-3 text-right">
                                Total
                              </th>
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
                                  (withoutTax * Number(item.taxPercent || 0)) /
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
                                      {formatCurrency(Number(item.rate || 0))}
                                    </td>
                                    <td className="px-2 py-3 text-center">
                                      {Number(item.taxPercent || 0).toFixed(2)}
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
                                        onClick={() => removeProduct(item.id)}
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
                            <span className="text-slate-500">Subtotal</span>

                            <span className="font-semibold text-slate-800">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>

                          {/* TOTAL TAX */}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Total Tax</span>

                            <span className="font-semibold text-slate-800">
                              {formatCurrency(
                                cgstAmount + sgstAmount + igstAmount,
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
              <div className={isFRO ? "sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] sm:px-6" : "flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4"}>
                <button
                  type="button"
                  onClick={closeQuotation}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <Button onClick={save} disabled={!canSave}>
                  Save Quotation
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {!isFRO && selectedQuotation &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
            <style>{`
              /* Default: desktop uses the full quotation document; mobile uses cards. */
              .quotation-mobile-detail {
                display: none;
              }

              .quotation-desktop-detail {
                display: block;
              }

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

                .quotation-mobile-detail {
                  display: none !important;
                }

                .quotation-desktop-detail {
                  display: block !important;
                }

                .quotation-scroll {
                  overflow: visible !important;
                  padding: 0 !important;
                }
              }

              @media (max-width: 767px) {
                .quotation-mobile-detail,
                .quotation-mobile-products {
                  display: block;
                }

                .quotation-desktop-detail,
                .quotation-desktop-products {
                  display: none;
                }

                .quotation-scroll {
                  padding: 0.75rem !important;
                }
              }

              @media print {
                .quotation-mobile-detail,
                .quotation-mobile-products {
                  display: none !important;
                }

                .quotation-desktop-detail,
                .quotation-desktop-products {
                  display: block !important;
                }
              }
            `}</style>

            <div className="quotation-print-area nb-print-panel flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="quotation-screen-only flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Quotation
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-800">
                    {selectedQuotation.quotationNo}
                  </h2>
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
                {/* Mobile quotation detail */}
                <div className="quotation-mobile-detail space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                        <img
                          src="/logo_NB.webp"
                          alt="Nature Biotic"
                          className="max-h-12 max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-extrabold leading-5 text-slate-900">
                          SAIRAM AGRI INPUTS
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          Rajapalayam, Tamil Nadu
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Nature Biotic Store
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-lg font-extrabold uppercase text-slate-900">
                        Quotation
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700">
                          {selectedQuotation.quotationNo}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                          {formatDate(selectedQuotation.date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Farmer Details
                      </p>
                      <p className="mt-1.5 truncate text-xs font-extrabold text-slate-900">
                        {selectedQuotation.farmer}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {selectedQuotation.village || "-"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {selectedQuotation.phone || "-"}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Farm Details
                      </p>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
                        <div>
                          <span className="text-slate-400">Crop</span>
                          <p className="truncate font-semibold text-slate-700">
                            {selectedQuotation.crop || "-"}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Acre</span>
                          <p className="truncate font-semibold text-slate-700">
                            {selectedQuotation.acre || "-"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">Place</span>
                          <p className="truncate font-semibold text-slate-700">
                            {selectedQuotation.placeOfSupply || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Products
                      </p>
                      <span className="text-sm font-extrabold text-brand-700">
                        {formatCurrency(selectedQuotation.amount)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-400">
                            <th className="w-[12%] px-2 py-2 text-center font-bold">
                              S.No
                            </th>
                            <th className="w-[50%] px-2 py-2 text-left font-bold">
                              Product
                            </th>
                            <th className="w-[16%] px-2 py-2 text-center font-bold">
                              Qty
                            </th>
                            <th className="w-[22%] px-2 py-2 text-right font-bold">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(selectedQuotation.products || []).map(
                            (item, index) => {
                              const withoutTax =
                                Number(item.qty || 0) * Number(item.rate || 0);
                              const tax =
                                (withoutTax * Number(item.taxPercent || 0)) /
                                100;
                              return (
                                <tr key={item.id}>
                                  <td className="px-2 py-2.5 text-center text-slate-500">
                                    {index + 1}
                                  </td>
                                  <td className="px-2 py-2.5 text-left">
                                    <p className="truncate font-semibold text-slate-800">
                                      {item.productName || item.product || "-"}
                                    </p>
                                    <p className="truncate text-[10px] text-slate-500">
                                      {item.pkgsize || "-"}
                                    </p>
                                  </td>
                                  <td className="px-2 py-2.5 text-center font-medium text-slate-700">
                                    {item.qty ?? "-"}
                                  </td>
                                  <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-800 whitespace-nowrap">
                                    {formatCurrency(withoutTax + tax)}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Quotation Summary
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Without Tax</span>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(selectedQuotation.withoutTax)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">SGST</span>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(selectedQuotation.sgst)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">CGST</span>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(selectedQuotation.cgst)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">IGST</span>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(selectedQuotation.igst)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2">
                        <span className="font-bold text-slate-800">
                          Grand Total
                        </span>
                        <span className="text-base font-extrabold text-brand-700">
                          {formatCurrency(selectedQuotation.amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(selectedQuotation.remarks || purchaseOrderNotes) && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>
                      <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-slate-600">
                        {purchaseOrderNotes.trim() || selectedQuotation.remarks}
                      </p>
                    </div>
                  )}
                </div>

                <QuotationBill
                  quotation={selectedQuotation}
                  notes={purchaseOrderNotes}
                  onNotesChange={setPurchaseOrderNotes}
                />
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
