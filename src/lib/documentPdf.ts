import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { openWhatsAppShare, shareableWhatsAppPhone } from "@/lib/whatsappShare";

/** A4 landscape width at 96dpi. The quotation columns were designed for this width. */
export const DOCUMENT_PDF_WIDTH_PX = 1122;

const PAGE_WIDTH_MM = 297;
const PAGE_HEIGHT_MM = 210;
const MARGIN_MM = 6;

export const documentPrintStyle = `
@media print {
  @page { size: A4 landscape; margin: 6mm; }
  body * { visibility: hidden !important; }
  .document-pdf-sheet,
  .document-pdf-sheet *,
  .quotation-pdf-sheet,
  .quotation-pdf-sheet * { visibility: visible !important; }
  .document-pdf-sheet,
  .quotation-pdf-sheet {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: ${DOCUMENT_PDF_WIDTH_PX}px !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #fff !important;
  }
  .document-pdf-sheet tr,
  .quotation-pdf-sheet tr,
  .document-pdf-sheet .doc-section,
  .quotation-pdf-sheet .doc-section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  [data-pdf-page-break] {
    page-break-before: always;
    break-before: page;
  }
  .fro-document-actions { display: none !important; }
}
`;

export function documentPdfFileName(documentNo: string) {
  const safe = String(documentNo || "Document")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-");
  return `${safe || "Document"}.pdf`;
}

function waitForImages(root: HTMLElement) {
  const images = [...root.querySelectorAll("img")];
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function pageStarts(
  canvasHeight: number,
  pagePx: number,
  boundaries: number[],
  forcedStarts: number[] = [],
) {
  const starts = [0];
  let start = 0;
  const points = [...boundaries]
    .filter((point) => point > 8 && point < canvasHeight - 8)
    .sort((a, b) => a - b);
  const forced = [...new Set(forcedStarts)]
    .filter((point) => point > 8 && point < canvasHeight - 8)
    .sort((a, b) => a - b);

  while (start < canvasHeight - 8) {
    const forcedNext = forced.find((point) => point > start + 8);
    const limit = start + pagePx;
    if (forcedNext && forcedNext <= limit + 1) {
      starts.push(forcedNext);
      start = forcedNext;
      continue;
    }
    if (start + pagePx >= canvasHeight - 8) break;
    let next = 0;
    for (const point of points) {
      if (point > start + 24 && point <= limit) next = point;
    }
    if (!next) next = Math.min(limit, canvasHeight);
    if (next <= start) break;
    starts.push(next);
    start = next;
  }

  return starts;
}

async function renderDocumentPdf(element: HTMLElement) {
  await waitForImages(element);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const contentWidth = PAGE_WIDTH_MM - MARGIN_MM * 2;
  const contentHeight = PAGE_HEIGHT_MM - MARGIN_MM * 2;
  const naturalHeight = (canvas.height / canvas.width) * contentWidth;
  const scale = canvas.width / Math.max(element.scrollWidth, 1);
  const rootTop = element.getBoundingClientRect().top;
  const forcedStarts = [...element.querySelectorAll("[data-pdf-page-break]")].map(
    (node) => ((node as HTMLElement).getBoundingClientRect().top - rootTop) * scale,
  );

  if (forcedStarts.length === 0 && naturalHeight <= contentHeight + 1) {
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      MARGIN_MM,
      MARGIN_MM,
      contentWidth,
      Math.min(naturalHeight, contentHeight),
    );
    return pdf;
  }

  const pagePx = (contentHeight / contentWidth) * canvas.width;
  const boundaries = [...element.querySelectorAll("[data-pdf-break]")].map(
    (node) => ((node as HTMLElement).getBoundingClientRect().bottom - rootTop) * scale,
  );
  const starts = pageStarts(canvas.height, pagePx, boundaries, forcedStarts);

  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : canvas.height;
    const sliceHeight = Math.max(1, Math.round(end - start));
    if (index > 0 && sliceHeight < 12) return;
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      Math.round(start),
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );
    const sliceMm = (sliceHeight / canvas.width) * contentWidth;
    if (index > 0) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL("image/png"),
      "PNG",
      MARGIN_MM,
      MARGIN_MM,
      contentWidth,
      Math.min(sliceMm, contentHeight),
    );
  });

  return pdf;
}

async function withSheet<T>(sheet: HTMLElement, action: () => Promise<T>) {
  const previousLeft = sheet.style.left;
  const previousZIndex = sheet.style.zIndex;
  sheet.style.left = "0px";
  sheet.style.zIndex = "-1";
  try {
    return await action();
  } finally {
    sheet.style.left = previousLeft;
    sheet.style.zIndex = previousZIndex;
  }
}

function savePdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** The PDF used for download, print, and the WhatsApp download step. */
export async function createDocumentPdfBlob(element: HTMLElement) {
  const pdf = await renderDocumentPdf(element);
  return pdf.output("blob");
}

export async function downloadDocumentPdf(element: HTMLElement, fileName: string) {
  const blob = await withSheet(element, () => createDocumentPdfBlob(element));
  savePdfBlob(blob, fileName);
}

export async function printDocumentPdf(element: HTMLElement | null) {
  if (!element) return;
  const blob = await withSheet(element, () => createDocumentPdfBlob(element));
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  document.body.appendChild(frame);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  window.setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}

export async function shareDocumentPdf(input: {
  sheet: HTMLElement | null;
  phone: string;
  fileName: string;
  message: string;
  lock?: { current: boolean };
}) {
  if (input.lock?.current) return;
  if (!shareableWhatsAppPhone(input.phone)) return;
  const sheet = input.sheet;
  if (!sheet) return;
  if (input.lock) input.lock.current = true;
  try {
    const blob = await withSheet(sheet, () => createDocumentPdfBlob(sheet));
    savePdfBlob(blob, input.fileName);
    openWhatsAppShare(input.phone, input.message, { stayOnPage: true });
  } catch {
    window.alert("The document PDF could not be created. Please try again.");
  } finally {
    if (input.lock) input.lock.current = false;
  }
}
