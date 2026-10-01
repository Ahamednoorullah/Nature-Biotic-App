import { formatCurrency, numberToWords } from "@/lib/format";
import { getStore } from "@/lib/data";
import {
  blankProductSlots,
  documentConfig,
  type CommonDocumentData,
  type DocumentHeaderCell,
  type DocumentType,
} from "@/lib/documentModel";


/** Shared print/PDF bill for quotation, sales invoice, and sales return. */
export function CommonDocumentBill({
  data,
  notes = "",
  onNotesChange,
  documentMode = false,
  documentType,
  storeId,
  sale,
}: {
  data?: CommonDocumentData;
  notes?: string;
  onNotesChange?: (value: string) => void;
  documentMode?: boolean;
  documentType?: DocumentType;
  storeId?: string;
  sale?: StoreInvoiceSale;
}) {
  if (documentType === "salesInvoice" && storeId && sale) {
    return (
      <SalesInvoiceDocument
        storeId={storeId}
        sale={sale}
        notes={notes}
        onNotesChange={onNotesChange}
        documentMode={documentMode}
      />
    );
  }
  if (!data) return null;
  const kind: DocumentType =
    documentType && documentType !== "salesInvoice"
      ? documentType
      : data.heading === "Sales Return"
        ? "salesReturn"
        : "quotation";
  const sectionConfig = documentConfig[kind];
  const printedNotes = notes.trim() ? notes : data.defaultNotes;
  const maxProductRows = 7;
  const fillerCount = blankProductSlots(
    data.rows.length,
    documentMode ? "document" : "quotation-screen",
  );

  return (
    <div
      className={`quotation-desktop-detail w-full rounded-xl border border-slate-300 bg-white ${
        documentMode ? "document-compact overflow-visible" : "min-h-full overflow-hidden"
      } ${data.kind === "invoice" ? "document-invoice" : ""}`}
    >
      {documentMode && (
        <style>{`
          .document-compact tbody td,
          .document-compact tfoot td {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            line-height: 1.35 !important;
            vertical-align: middle !important;
          }
          .document-compact thead th {
            overflow: visible !important;
            white-space: normal !important;
            line-height: 1.35 !important;
            vertical-align: middle !important;
          }
          .document-compact .doc-section {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          .document-compact .doc-notes { min-height: 0 !important; }
          .document-compact tbody tr { height: 26px; }
          .document-compact tbody td { border-bottom: 1px solid #cbd5e1; }
          .document-invoice .doc-section { padding-top: 4px !important; padding-bottom: 4px !important; }
          .document-invoice tbody tr { height: 20px; }
          .document-invoice h3 { font-size: 16px !important; line-height: 1.15 !important; }
          .document-invoice table { font-size: 8.5px !important; }
          .document-invoice thead th {
            height: auto !important;
            white-space: normal !important;
            overflow-wrap: anywhere;
            font-size: 8px !important;
            font-weight: 700 !important;
            line-height: 1.15 !important;
            padding: 3px 2px !important;
            background: #f8fafc;
            vertical-align: middle !important;
          }
          .document-invoice td {
            padding-left: 2px !important;
            padding-right: 2px !important;
          }
        `}</style>
      )}
      <div className="grid grid-cols-[1.2fr_.8fr] border-b border-slate-300">
        <div className="doc-section border-r border-slate-300 px-6 py-3">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center">
              <img src="/logo_NB.webp" alt="Nature Biotic" className="max-h-14 max-w-full object-contain" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold tracking-wide text-slate-900">
                {data.issuer?.name || "SAIRAM AGRI INPUTS"}
              </h3>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                {data.issuer?.address || "Rajapalayam, Tamil Nadu"}
              </p>
              {data.issuer ? (
                <>
                  <p className="text-[10px] text-slate-600">GSTIN: {data.issuer.gstin || "-"}</p>
                  <p className="text-[10px] text-slate-600">Contact: {data.issuer.phone || "-"}</p>
                </>
              ) : (
                <p className="text-[10px] text-slate-600">Nature Biotic Store</p>
              )}
            </div>
          </div>
        </div>
        <div className="doc-section flex items-center justify-center px-4 py-3">
          <div className="text-center">
            <h3 className="text-2xl font-extrabold uppercase text-slate-900">{data.heading}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-slate-300 text-[10px] leading-5">
        <div className="doc-section border-r border-slate-300 px-3 py-2.5">
          <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
            {data.farmerTitle || "Farmer Details"}
          </p>
          <p className="font-bold text-slate-900">{data.farmerName}</p>
          <p className="text-slate-600">{data.village || "-"}</p>
          <p className="text-slate-600">Contact: {data.phone || "-"}</p>
        </div>
        <div className="doc-section border-r border-slate-300 px-3 py-2.5">
          <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{data.middleTitle}</p>
          {data.middleLines.map((line) => (
            <p key={line.label} className="text-slate-600">
              {line.label}:{" "}
              <span className="font-semibold text-slate-800">{line.value}</span>
            </p>
          ))}
        </div>
        <div className="doc-section px-3 py-2.5">
          <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{data.sideTitle}</p>
          <div className="grid grid-cols-[110px_1fr] gap-y-0.5">
            {data.sideLines.map((line) => (
              <span key={line.label} className="contents">
                <span className="text-slate-500">{line.label}</span>
                <span className="font-semibold text-slate-800">{line.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={documentMode ? "w-full" : "w-full overflow-hidden"}>
        <table
          className={
            documentMode
              ? "w-full table-fixed border-separate border-spacing-0 text-[9px] leading-[1.3]"
              : "w-full table-fixed border-collapse text-[10px]"
          }
        >
          <colgroup>
            {data.colWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          {documentMode ? (
            <DocumentPdfHead headers={data.headers} subHeaders={data.subHeaders} />
          ) : (
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50 uppercase tracking-wide text-slate-600">
              {data.headers.map((header) => (
                <th
                  key={header.text}
                  rowSpan={header.rowSpan}
                  colSpan={header.colSpan}
                  className={header.className}
                >
                  {header.text}
                </th>
              ))}
            </tr>
            {data.subHeaders.length > 0 && (
              <tr className="border-b border-slate-300 bg-slate-50 text-[10px] text-slate-500">
                {data.subHeaders.map((header, index) => (
                  <th key={`${header.text}-${index}`} className={header.className}>
                    {header.text}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          )}
          <tbody>
            {data.rows.map((row, index) => (
              <tr
                key={row.id}
                data-pdf-break=""
                {...(documentMode && index > 0 && index % maxProductRows === 0
                  ? { "data-pdf-page-break": "" }
                  : {})}
                className="border-slate-300"
              >
                {row.cells.map((item, cellIndex) => (
                  <td key={cellIndex} className={item.className}>
                    {item.text}
                  </td>
                ))}
              </tr>
            ))}
            {documentMode &&
              Array.from({ length: fillerCount }).map((_, index) => (
                <tr key={`slot-${index}`} data-pdf-break="">
                  {Array.from({ length: data.columnCount }).map((__, colIdx) => (
                    <td
                      key={colIdx}
                      className={colIdx < data.columnCount - 1 ? "border-r border-slate-300" : ""}
                    />
                  ))}
                </tr>
              ))}
          </tbody>
          {!documentMode &&
            Array.from({ length: fillerCount }).map((_, index) => (
              <tr key={`filler-${index}`} data-pdf-break="">
                {Array.from({ length: data.columnCount }).map((__, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-1 py-1.5 ${colIdx < data.columnCount - 1 ? "border-r border-slate-300" : ""}`}
                  >
                    &nbsp;
                  </td>
                ))}
              </tr>
            ))}
          <tfoot>
            <tr data-pdf-break="" className="border-t-2 border-slate-400 bg-slate-50 font-bold text-slate-900">
              {data.totalCells.map((item, index) => (
                <td key={index} colSpan={item.colSpan} className={item.className}>
                  {item.text}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div data-pdf-break="" className="grid grid-cols-[1fr_320px] border-t border-slate-300">
        <div className="doc-section flex flex-col justify-end border-r border-slate-300 p-2.5">
          <p className="text-[10px] font-semibold text-slate-700">
            Amount in Words :{" "}
            <span className="font-bold text-slate-900">{numberToWords(data.grandTotal)}</span>
          </p>
        </div>
        <div className="doc-section space-y-1 p-2.5 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Without Tax</span>
            <span className="font-semibold text-slate-700">{formatCurrency(data.withoutTax)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">SGST</span>
            <span className="font-semibold text-slate-700">{formatCurrency(data.sgst)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">CGST</span>
            <span className="font-semibold text-slate-700">{formatCurrency(data.cgst)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">IGST</span>
            <span className="font-semibold text-slate-700">{formatCurrency(data.igst)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-300 pt-1.5">
            <span className="text-slate-500">Round Off</span>
            <span className="font-semibold text-slate-500">{formatCurrency(data.roundOff)}</span>
          </div>
          <div className="border-t border-slate-300 pt-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(data.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        data-pdf-break=""
        className={`grid border-t border-slate-300 ${
          data.payment ? "grid-cols-1" : "grid-cols-[1fr_300px]"
        } ${documentMode ? "doc-notes" : "min-h-[110px]"}`}
      >
        <div className={`flex flex-col justify-end border-slate-300 p-3 ${data.payment ? "" : "border-r"}`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Notes</p>
          {documentMode ? (
            <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{printedNotes}</p>
          ) : (
            <>
              <textarea
                value={notes}
                onChange={(event) => onNotesChange?.(event.target.value)}
                rows={2}
                placeholder="Enter notes..."
                className="po-print-hide mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 focus:border-brand-500 focus:outline-none"
              />
              <p className="po-print-only mt-1.5 hidden whitespace-pre-line text-xs text-slate-500">{printedNotes}</p>
            </>
          )}
        </div>
        {!(sectionConfig.showPayment && data.payment) && (
          <div className="flex items-end justify-center p-3">
            <div className="w-full text-center">
              <div className="border-b border-slate-300" />
              <p className="mt-1.5 text-xs font-semibold text-slate-500">Authorised Signatory</p>
            </div>
          </div>
        )}
      </div>

      {sectionConfig.showPayment && data.payment && (
        <div data-pdf-break="" className="grid grid-cols-[1fr_108px_170px] border-t border-slate-300">
          <div className="doc-section border-r border-slate-300 p-2 text-[9px] leading-4 text-slate-600">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Payment Details</p>
            <p><span className="text-slate-500">Account Name: </span><span className="font-semibold text-slate-800">{data.payment.accountName}</span></p>
            <p><span className="text-slate-500">Account No: </span><span className="font-semibold text-slate-800">{data.payment.accountNo}</span></p>
            <p><span className="text-slate-500">IFSC Code: </span><span className="font-semibold text-slate-800">{data.payment.ifsc}</span></p>
            <p><span className="text-slate-500">Bank Name: </span><span className="font-semibold text-slate-800">{data.payment.bankName}</span></p>
            <p><span className="text-slate-500">Branch: </span><span className="font-semibold text-slate-800">{data.payment.branch}</span></p>
            <p><span className="text-slate-500">UPI ID: </span><span className="font-semibold text-slate-800">{data.payment.upiId}</span></p>
          </div>
          <div className="flex flex-col items-center justify-center border-r border-slate-300 p-1.5 text-center">
            {data.payment.qrUrl ? (
              <img
                src={data.payment.qrUrl}
                alt="Scan QR to pay"
                crossOrigin="anonymous"
                className="h-14 w-14 object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center border border-dashed border-slate-300 text-[8px] text-slate-400">QR</div>
            )}
            <p className="mt-1 text-[8px] font-bold uppercase tracking-wide text-slate-500">Scan QR to Pay</p>
            <p className="text-[10px] font-extrabold text-slate-900">{formatCurrency(data.payment.payable)}</p>
          </div>
          <div className="flex items-end justify-center p-2">
            <div className="w-full text-center">
              <div className="border-b border-slate-300" />
              <p className="mt-1.5 text-xs font-semibold text-slate-500">Authorised Signatory</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentPdfHeadCell({
  children,
  colSpan,
  sub = false,
  blank = false,
  open = false,
}: {
  children?: string;
  colSpan?: number;
  sub?: boolean;
  blank?: boolean;
  open?: boolean;
}) {
  return (
    <th
      colSpan={colSpan}
      className="border-r border-slate-300 bg-slate-50 px-1 text-center font-bold text-slate-800"
      style={{
        overflow: "visible",
        whiteSpace: "normal",
        lineHeight: 1.35,
        height: sub || blank ? 24 : 42,
        paddingTop: 4,
        paddingBottom: 4,
        verticalAlign: "middle",
        fontSize: sub ? 8.5 : 9.5,
        borderBottom: open ? "none" : "1px solid #cbd5e1",
      }}
    >
      {children || "\u00a0"}
    </th>
  );
}

function DocumentPdfHead({
  headers,
  subHeaders,
}: {
  headers: DocumentHeaderCell[];
  subHeaders: DocumentHeaderCell[];
}) {
  let subIndex = 0;
  return (
    <thead>
      <tr>
        {headers.map((header, index) => {
          const grouped = (header.colSpan || 1) > 1;
          return (
            <DocumentPdfHeadCell
              key={`head-${index}`}
              colSpan={header.colSpan}
              open={!grouped}
            >
              {header.text}
            </DocumentPdfHeadCell>
          );
        })}
      </tr>
      <tr>
        {headers.flatMap((header, index) => {
          const span = header.colSpan || 1;
          if (span > 1) {
            const cells = subHeaders.slice(subIndex, subIndex + span);
            subIndex += span;
            return cells.map((item, cellIndex) => (
              <DocumentPdfHeadCell key={`sub-${index}-${cellIndex}`} sub>
                {item.text}
              </DocumentPdfHeadCell>
            ));
          }
          return [<DocumentPdfHeadCell key={`blank-${index}`} blank />];
        })}
      </tr>
    </thead>
  );
}

export type StoreInvoiceSale = {
  notes?: string;
  invoiceNo: string;
  date: string;
  through: string;
  partyName: string;
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
  products: any[];
};


export function SalesInvoiceDocument({
  storeId,
  sale,
  notes,
  onNotesChange,
  documentMode = false,
}: {
  storeId: string;
  sale: StoreInvoiceSale;
  notes: string;
  onNotesChange?: (value: string) => void;
  documentMode?: boolean;
}) {
  const store = getStore(storeId);
  const storeAny = store as any;
  const paymentBank = {
    accountName:
      storeAny?.bankAccountName || storeAny?.accountName || store?.name || "-",
    accountNo: storeAny?.bankAccountNo || storeAny?.accountNo || "-",
    ifsc: storeAny?.bankIfsc || storeAny?.ifsc || "-",
    bankName: storeAny?.bankName || "-",
    branch: storeAny?.bankBranch || storeAny?.branch || "-",
    upiId: storeAny?.upiId || storeAny?.bankUpiId || "-",
  };

  function buildPaymentQrUrl(payableTotal: number, invoiceNo: string): string {
    const paymentUrl = new URL("upi://pay");
    paymentUrl.searchParams.set("pa", paymentBank.upiId);
    paymentUrl.searchParams.set("pn", paymentBank.accountName);
    paymentUrl.searchParams.set("am", payableTotal.toFixed(2));
    paymentUrl.searchParams.set("cu", "INR");
    paymentUrl.searchParams.set("tn", `Invoice ${invoiceNo}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(paymentUrl.toString())}`;
  }

  return (
    <div
      className={`rounded-xl border border-slate-300 bg-white ${
        documentMode ? "sales-invoice-document overflow-visible" : "overflow-hidden"
      }`}
    >
      {documentMode && (
        <style>{`
          .sales-invoice-document th,
          .sales-invoice-document td {
            overflow: visible;
            height: auto;
          }
          .sales-invoice-document td {
            border-bottom: 1px solid #cbd5e1;
          }
        `}</style>
      )}
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
                            TAX INVOICE
                          </h2>
                          {/* <p className="mt-1 text-[10px] text-slate-500">
                          Store to Farmer
                        </p> */}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 border-b border-slate-300 text-[9px] leading-4">
                      <div className="border-r border-slate-300 p-3">
                        <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                          Billing Address
                        </p>
                        <p className="font-bold text-slate-900">
                          {sale.partyName}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {sale.farmerVillage || "-"}
                        </p>
                        <p className="text-slate-600">
                          Contact: {sale.farmerPhone || "-"}
                        </p>
                        <p className="text-slate-600">
                          Crop / Acre:{" "}
                          {[
                            sale.farmerCrop,
                            sale.farmerAcre
                              ? `${sale.farmerAcre} Acre`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </p>
                      </div>

                      <div className="border-r border-slate-300 p-3">
                        <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                          Delivery Address
                        </p>
                        <p className="font-bold text-slate-900">
                          {sale.partyName}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {sale.farmerVillage || "-"}
                        </p>
                        <p className="mt-1 text-slate-600">
                          Place of Supply:{" "}
                          {sale.placeOfSupply || "Tamil Nadu"}
                        </p>
                      </div>

                      <div className="p-3">
                        <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
                          Invoice Details
                        </p>
                        <div className="grid grid-cols-[92px_1fr] gap-y-1">
                          <span className="text-slate-500">Invoice No</span>
                          <span className="font-semibold text-slate-800">
                            {sale.invoiceNo}
                          </span>
                          <span className="text-slate-500">Date</span>
                          <span className="font-semibold text-slate-800">
                            {sale.date}
                          </span>
                          <span className="text-slate-500">Through</span>
                          <span className="font-semibold text-slate-800">
                            {sale.through}
                          </span>
                          {sale.through === "Executive" && (
                            <>
                              <span className="text-slate-500">Executive</span>
                              <span className="font-semibold text-slate-800">
                                {sale.executiveName || "-"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={documentMode ? "w-full" : "w-full overflow-x-auto"}>
                      <table
                        className={
                          documentMode
                            ? "w-full table-fixed border-separate border-spacing-0 text-[9px] leading-[1.3]"
                            : "w-full border-collapse text-[8.5px] xl:text-[9px]"
                        }
                      >
                        {documentMode && (
                          <colgroup>
                            {[
                              "3.2%",
                              "8%",
                              "5.4%",
                              "5.2%",
                              "6%",
                              "6.2%",
                              "3.4%",
                              "6.2%",
                              "7%",
                              "3.6%",
                              "5.6%",
                              "6.4%",
                              "3.6%",
                              "5.6%",
                              "3.6%",
                              "5.6%",
                              "3.6%",
                              "5.6%",
                              "6.2%",
                            ].map((width, index) => (
                              <col key={index} style={{ width }} />
                            ))}
                          </colgroup>
                        )}
                        {documentMode ? (
                          <PdfInvoiceHead />
                        ) : (
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
                              SGST (₹)
                            </th>
                            <th
                              colSpan={2}
                              className="border-r border-slate-300 px-1 py-1.5 text-center"
                            >
                              IGST (₹)
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
                        )}
                        <tbody>
                          {sale.products.length > 0 ? (
                            sale.products.map((item, index) => {
                              const beforeDiscount =
                                Number(item.quantity || 0) *
                                Number(item.sellingPrice || 0);
                              const discountAmount = Number(item.discount || 0);
                              const discountPercent =
                                beforeDiscount > 0
                                  ? (discountAmount / beforeDiscount) * 100
                                  : 0;
                              const isTamilNadu =
                                (sale.placeOfSupply || "Tamil Nadu") ===
                                "Tamil Nadu";
                              const cgstRate = isTamilNadu
                                ? Number(item.taxPercent || 0) / 2
                                : 0;
                              const sgstRate = isTamilNadu
                                ? Number(item.taxPercent || 0) / 2
                                : 0;
                              const igstRate = !isTamilNadu
                                ? Number(item.taxPercent || 0)
                                : 0;
                              const cgstAmt = isTamilNadu
                                ? Number(item.taxAmount || 0) / 2
                                : 0;
                              const sgstAmt = isTamilNadu
                                ? Number(item.taxAmount || 0) / 2
                                : 0;
                              const igstAmt = !isTamilNadu
                                ? Number(item.taxAmount || 0)
                                : 0;

                              return (
                                <tr key={item.key} className="border-slate-300">
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                    {index + 1}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 font-semibold">
                                    {item.product?.name || "Product"}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                    {item.hsn || "-"}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                    {item.pkgsize || item.packSize || "-"}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                    {item.batchNo || "-"}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                    {item.expiryDate || "-"}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-center">
                                    {item.quantity}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {formatCurrency(item.sellingPrice)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold">
                                    {formatCurrency(beforeDiscount)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {discountPercent.toFixed(2)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {formatCurrency(discountAmount)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right font-semibold">
                                    {formatCurrency(item.withoutTax)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {cgstRate.toFixed(2)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {formatCurrency(cgstAmt)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {sgstRate.toFixed(2)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {formatCurrency(sgstAmt)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {igstRate.toFixed(2)}
                                  </td>
                                  <td className="border-r border-slate-300 px-1 py-1.5 text-right">
                                    {formatCurrency(igstAmt)}
                                  </td>
                                  <td className="px-1 py-1.5 text-right font-bold">
                                    {formatCurrency(item.rowTotal)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={19}
                                className="px-4 py-8 text-center text-slate-400"
                              >
                                Product-level details are not available for this
                                old sample invoice.
                              </td>
                            </tr>
                          )}
                          {(() => {
                            const fillerCount = blankProductSlots(
                              sale.products.length,
                              "invoice",
                            );
                            const columnCount = 19;

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
                        </tbody>

                        <tfoot>
                          {(() => {
                            const products = sale.products || [];

                            const totalQty = products.reduce(
                              (sum, item) => sum + Number(item.quantity || 0),
                              0,
                            );

                            const totalBeforeDiscount = products.reduce(
                              (sum, item) =>
                                sum +
                                Number(item.quantity || 0) *
                                  Number(item.sellingPrice || 0),
                              0,
                            );

                            const totalDiscount = products.reduce(
                              (sum, item) => sum + Number(item.discount || 0),
                              0,
                            );

                            const totalTaxable = products.reduce(
                              (sum, item) => sum + Number(item.withoutTax || 0),
                              0,
                            );

                            const isTamilNadu =
                              (sale.placeOfSupply || "Tamil Nadu") ===
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
                                {/* S.No + Product + HSN + PKG + Batch + Exp Date */}
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
                    <div className="grid grid-cols-[1fr_300px] border-t border-slate-300">
                      <div className="border-r border-slate-300 p-2.5 flex items-center">
                        {(() => {
                          const grandTotal = sale.products.length
                            ? sale.products.reduce(
                                (sum, row) => sum + Number(row.rowTotal || 0),
                                0,
                              )
                            : Number(sale.amount || 0);

                          const roundedTotal = Math.round(grandTotal);

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
                        <SummaryRow
                          label="Round Off"
                          value={formatCurrency(
                            (sale.products.length
                              ? sale.products.reduce(
                                  (sum, row) => sum + Number(row.rowTotal || 0),
                                  0,
                                )
                              : Number(sale.amount || 0)) -
                              (sale.products.length
                                ? sale.products.reduce(
                                    (sum, row) =>
                                      sum +
                                      Number(row.withoutTax || 0) +
                                      Number(row.sgst || 0) +
                                      Number(row.cgst || 0) +
                                      Number(row.igst || 0),
                                    0,
                                  )
                                : Number(sale.withoutTax || 0) +
                                  Number(sale.sgst || 0) +
                                  Number(sale.cgst || 0) +
                                  Number(sale.igst || 0)),
                          )}
                          muted
                        />

                        <div className="border-t border-slate-300 pt-1.5">
                          <SummaryRow
                            label="Grand Total"
                            value={formatCurrency(
                              sale.products.length
                                ? sale.products.reduce(
                                    (sum, row) =>
                                      sum + Number(row.rowTotal || 0),
                                    0,
                                  )
                                : Number(sale.amount || 0),
                            )}
                            bold
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Notes (left) + Authorised Signatory (right) */}
                    <div className="invoice-print-footer-block grid grid-cols-[1fr_300px] border-t border-slate-300">
                      <div className="border-r border-slate-300 min-w-0 p-2">
                        {/* NOTES */}
                        <div className="flex flex-col justify-end border-slate-300 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Notes
                          </p>

                          {(() => {
                            const defaultNotes = `Purchase return raised by ${
                              sale?.placeOfSupply ?? "this store"
                            } to Nature Biotic.`;

                            return documentMode ? (
                              <p className="mt-1.5 whitespace-pre-line text-xs text-slate-500">
                                {notes || defaultNotes}
                              </p>
                            ) : (
                              <>
                                <textarea
                                  value={notes}
                                  onChange={(e) =>
                                    onNotesChange?.(e.target.value)
                                  }
                                  rows={2}
                                  placeholder="Enter notes..."
                                  className="po-print-hide mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-600 focus:border-brand-500 focus:outline-none"
                                />
                                <p className="po-print-only mt-1.5 hidden whitespace-pre-line text-xs text-slate-500">
                                  {notes || defaultNotes}
                                </p>
                              </>
                            );
                          })()}
                        </div>

                        {(() => {
                          const exactTotal = sale.products.length
                            ? sale.products.reduce(
                                (sum, row) => sum + Number(row.rowTotal || 0),
                                0,
                              )
                            : Number(sale.amount || 0);
                          const payableTotal = Math.round(exactTotal);

                          return (
                            <div className="mt-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Payment Details
                              </p>

                              <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div className="text-[8.5px] leading-4 text-slate-600">
                                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                    <span className="whitespace-nowrap">
                                      <span className="text-slate-500">
                                        Account Name :{" "}
                                      </span>
                                      <span className="font-bold text-slate-800">
                                        {paymentBank.accountName}
                                      </span>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="whitespace-nowrap">
                                      <span className="text-slate-500">
                                        Account No :{" "}
                                      </span>
                                      <span className="font-semibold text-slate-800">
                                        {paymentBank.accountNo}
                                      </span>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="whitespace-nowrap">
                                      <span className="text-slate-500">
                                        IFSC Code :{" "}
                                      </span>
                                      <span className="font-semibold text-slate-800">
                                        {paymentBank.ifsc}
                                      </span>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="whitespace-nowrap">
                                      <span className="text-slate-500">
                                        Bank Name :{" "}
                                      </span>
                                      <span className="font-semibold text-slate-800">
                                        {paymentBank.bankName}
                                      </span>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="whitespace-nowrap">
                                      <span className="text-slate-500">
                                        Branch :{" "}
                                      </span>
                                      <span className="font-semibold text-slate-800">
                                        {paymentBank.branch}
                                      </span>
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="whitespace-nowrap">
                                      <span className="text-slate-500">
                                        UPI ID :{" "}
                                      </span>
                                      <span className="font-semibold text-slate-800">
                                        {paymentBank.upiId}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="rounded-lg border border-slate-300 bg-white p-1.5">
                                    <img
                                      src={buildPaymentQrUrl(
                                        payableTotal,
                                        sale.invoiceNo,
                                      )}
                                      alt={`UPI QR for ${formatCurrency(payableTotal)}`}
                                      crossOrigin="anonymous"
                                      className="h-[70px] w-[70px] object-contain"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">
                                      Scan QR to Pay
                                    </p>
                                    <p className="mt-0.5 text-xs font-extrabold text-slate-900">
                                      {formatCurrency(payableTotal)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-2 text-center flex flex-col justify-end">
                        <div className="h-12 border-b border-slate-300" />
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Authorised Signatory
                        </p>
                      </div>
                    </div>
                  </div>
  );
}


function PdfInvoiceHead() {
  return (
    <thead>
      <tr>
        <DocumentPdfHeadCell open>S.No</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Product</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>HSN Code</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>PKG Size</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Batch No</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Exp Date</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Qty</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Unit Price</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Before Discount</DocumentPdfHeadCell>
        <DocumentPdfHeadCell colSpan={2}>Discount</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Taxable (₹)</DocumentPdfHeadCell>
        <DocumentPdfHeadCell colSpan={2}>CGST (₹)</DocumentPdfHeadCell>
        <DocumentPdfHeadCell colSpan={2}>SGST (₹)</DocumentPdfHeadCell>
        <DocumentPdfHeadCell colSpan={2}>IGST (₹)</DocumentPdfHeadCell>
        <DocumentPdfHeadCell open>Line Total</DocumentPdfHeadCell>
      </tr>
      <tr>
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell sub>%</DocumentPdfHeadCell>
        <DocumentPdfHeadCell sub>Amt</DocumentPdfHeadCell>
        <DocumentPdfHeadCell blank />
        <DocumentPdfHeadCell sub>Rate %</DocumentPdfHeadCell>
        <DocumentPdfHeadCell sub>Amount</DocumentPdfHeadCell>
        <DocumentPdfHeadCell sub>Rate %</DocumentPdfHeadCell>
        <DocumentPdfHeadCell sub>Amount</DocumentPdfHeadCell>
        <DocumentPdfHeadCell sub>Rate %</DocumentPdfHeadCell>
        <DocumentPdfHeadCell sub>Amount</DocumentPdfHeadCell>
        <DocumentPdfHeadCell blank />
      </tr>
    </thead>
  );
}

export function SummaryRow({
  label,
  value,
  bold = false,
  muted = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          bold
            ? "font-bold text-slate-800"
            : muted
              ? "text-slate-400"
              : "text-slate-500"
        }
      >
        {label}
      </span>
      <span
        className={
          bold
            ? "font-bold tabular-nums text-slate-800"
            : muted
              ? "font-semibold tabular-nums text-slate-400"
              : "font-semibold tabular-nums text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}
