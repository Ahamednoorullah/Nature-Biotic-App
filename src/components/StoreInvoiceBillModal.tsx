import { useEffect, useRef, useState } from "react";
import { printDocumentPdf } from "@/lib/documentPdf";
import { createPortal } from "react-dom";
import { Button, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  CommonDocumentBill,
  SummaryRow,
  type StoreInvoiceSale,
} from "@/components/CommonDocumentBill";

export function StoreInvoiceBillModal({
  storeId,
  sale,
  onClose,
}: {
  storeId: string;
  sale: StoreInvoiceSale;
  onClose: () => void;
}) {
  const [invoiceNotes, setInvoiceNotes] = useState(sale.notes || "");
  const invoicePrintRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setInvoiceNotes(sale.notes || "");
  }, [sale]);

  const invoicePrintSheet = (
    <div
      ref={invoicePrintRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: -2400,
        top: 0,
        width: 1122,
        background: "#fff",
        pointerEvents: "none",
      }}
    >
      <CommonDocumentBill
                    documentType="salesInvoice"
        storeId={storeId}
        sale={sale}
        notes={invoiceNotes}
        documentMode
      />
    </div>
  );

  return (
    <>
      {invoicePrintSheet}
      {createPortal(
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <style>{`
              @media print {

                @page {
                  size: A4 landscape;
                  margin: 5mm;
                }

                html,
                body {
                  width: 100% !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                }

                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                body * {
                  visibility: hidden !important;
                }

                .store-invoice-print,
                .store-invoice-print * {
                  visibility: visible !important;
                }

                .store-invoice-print {
                  position: relative !important;

                  /* Actual resize instead of transform */
                  zoom: 0.82 !important;

                  width: 121.95% !important;
                  max-width: none !important;

                  height: auto !important;
                  max-height: none !important;

                  margin: 0 !important;
                  padding: 0 !important;

                  left: 0 !important;
                  top: 0 !important;

                  overflow: visible !important;

                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background: #fff !important;

                  /* IMPORTANT */
                  transform: none !important;
                  transform-origin: initial !important;
                }

                .store-invoice-screen-only,
                .store-invoice-print-hide,
                .store-purchase-screen-only {
                  display: none !important;
                }

                .store-invoice-print-only {
                  display: block !important;
                }

                .store-invoice-desktop-view {
                  display: block !important;
                }

                .store-invoice-mobile-view {
                  display: none !important;
                }

                .store-invoice-print table {
                  page-break-inside: auto !important;
                }

                .store-invoice-print tr {
                  page-break-inside: avoid !important;
                  page-break-after: auto !important;
                }

                .store-invoice-print-footer-block {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `}</style>

            <div className="store-invoice-print flex max-h-[94vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="store-invoice-screen-only flex items-center justify-between border-b border-slate-200 px-6 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Tax Invoice
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {sale.invoiceNo}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="store-invoice-mobile-view md:hidden">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                            Tax Invoice
                          </p>
                          <p className="mt-1 text-lg font-extrabold text-slate-900">
                            {sale.invoiceNo}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                          {sale.through}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <DetailField label="Date" value={sale.date} />
                        <DetailField
                          label="Executive"
                          value={sale.executiveName || "-"}
                        />
                        <DetailField
                          label="Farmer"
                          value={sale.partyName}
                        />
                        <DetailField
                          label="Phone"
                          value={sale.farmerPhone || "-"}
                        />
                        <DetailField
                          label="Village"
                          value={sale.farmerVillage || "-"}
                        />
                        <DetailField
                          label="Place of Supply"
                          value={sale.placeOfSupply || "Tamil Nadu"}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Farmer Details
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <DetailField
                          label="Name"
                          value={sale.partyName}
                        />
                        <DetailField
                          label="Contact"
                          value={sale.farmerPhone || "-"}
                        />
                        <DetailField
                          label="Village"
                          value={sale.farmerVillage || "-"}
                        />
                        <DetailField
                          label="Crop"
                          value={sale.farmerCrop || "-"}
                        />
                        <DetailField
                          label="Acre"
                          value={sale.farmerAcre || "-"}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Products
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {sale.products.length} item(s)
                        </span>
                      </div>

                      {sale.products.length ? (
                        <div className="space-y-3">
                          {sale.products.map((item, index) => (
                            <div
                              key={item.key}
                              className="rounded-lg bg-slate-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold text-slate-400">
                                    Product {index + 1}
                                  </p>
                                  <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                                    {item.product?.name || "Product"}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-extrabold text-slate-900">
                                  {formatCurrency(item.rowTotal)}
                                </p>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                                <DetailField
                                  label="Pkg Size"
                                  value={item.pkgsize || item.packSize || "-"}
                                />
                                <DetailField
                                  label="Batch No"
                                  value={item.batchNo || "-"}
                                />
                                <DetailField
                                  label="Expiry"
                                  value={item.expiryDate || "-"}
                                />
                                <DetailField
                                  label="Qty"
                                  value={String(item.quantity)}
                                />
                                <DetailField
                                  label="Unit Price"
                                  value={formatCurrency(item.sellingPrice)}
                                />
                                <DetailField
                                  label="Discount"
                                  value={formatCurrency(item.discount)}
                                />
                                <DetailField
                                  label="Tax"
                                  value={formatCurrency(item.taxAmount)}
                                />
                                <DetailField
                                  label="Taxable"
                                  value={formatCurrency(item.withoutTax)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-6 text-center text-xs text-slate-400">
                          No product details available.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-2 text-sm">
                        <SummaryRow
                          label="Without Tax"
                          value={formatCurrency(sale.withoutTax)}
                        />
                        <SummaryRow
                          label="SGST"
                          value={formatCurrency(sale.sgst)}
                        />
                        <SummaryRow
                          label="CGST"
                          value={formatCurrency(sale.cgst)}
                        />
                        <SummaryRow
                          label="IGST"
                          value={formatCurrency(sale.igst)}
                        />
                        <div className="border-t border-slate-200 pt-3">
                          <SummaryRow
                            label="Grand Total"
                            value={formatCurrency(sale.amount)}
                            bold
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="store-invoice-desktop-view hidden md:block">
                  <CommonDocumentBill
                    documentType="salesInvoice"
                    storeId={storeId}
                    sale={sale}
                    notes={invoiceNotes}
                    onNotesChange={setInvoiceNotes}
                  />
                </div>
              </div>
              <div className="store-invoice-screen-only flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-3">
                <Button
                  variant="secondary"
                  onClick={() => onClose()}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
                <Button
                  onClick={() => { void printDocumentPdf(invoicePrintRef.current); }}
                  className="w-full sm:w-auto"
                >
                  <Icon name="print" size={18} />
                  Print Invoice
                </Button>
              </div>
            </div>
          </div>,
    document.body,
      )}
    </>
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


