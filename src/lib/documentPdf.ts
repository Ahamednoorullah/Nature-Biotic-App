import { openWhatsAppShare, shareableWhatsAppPhone } from "@/lib/whatsappShare";

type PdfDocument = {
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  addPage: () => void;
  output: (type: "blob") => Blob;
};

type JsPdfConstructor = new (options: {
  orientation: "landscape";
  unit: "mm";
  format: "a4";
}) => PdfDocument;

type Html2Canvas = (
  element: HTMLElement,
  options: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

declare global {
  interface Window {
    html2canvas?: Html2Canvas;
    jspdf?: { jsPDF: JsPdfConstructor };
  }
}

let html2canvasPromise: Promise<Html2Canvas> | undefined;
let jsPdfPromise: Promise<JsPdfConstructor> | undefined;

function loadJsPdf(): Promise<JsPdfConstructor> {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise<JsPdfConstructor>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      script.onload = () => {
        if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error("jsPDF failed to load"));
      };
      script.onerror = () => reject(new Error("jsPDF failed to load"));
      document.head.appendChild(script);
    });
  }
  return jsPdfPromise;
}

function loadHtml2Canvas(): Promise<Html2Canvas> {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!html2canvasPromise) {
    html2canvasPromise = new Promise<Html2Canvas>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.onload = () => {
        if (window.html2canvas) resolve(window.html2canvas);
        else reject(new Error("html2canvas failed to load"));
      };
      script.onerror = () => reject(new Error("html2canvas failed to load"));
      document.head.appendChild(script);
    });
  }
  return html2canvasPromise;
}

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
  const html2canvas = await loadHtml2Canvas();
  const JsPDF = await loadJsPdf();
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

  const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
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

type TablePdf = {
  setFont: (font: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (red: number, green: number, blue: number) => void;
  text: (
    value: string,
    x: number,
    y: number,
    options?: { align?: "left" | "right" | "center" },
  ) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  addPage: () => void;
  save: (fileName: string) => void;
};

export async function downloadDataTablePdf(input: {
  fileName: string;
  heading: string;
  title: string;
  storeName: string;
  generatedOn: string;
  headers: string[];
  rows: string[][];
  aligns?: Array<"left" | "right" | "center">;
  total?: string[];
  emptyMessage?: string;
}) {
  const JsPDF = await loadJsPdf();
  const pdf = new JsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  }) as unknown as TablePdf;
  const margin = 8;
  const pageWidth = 297;
  const pageHeight = 210;
  const width = pageWidth - margin * 2;
  const weights = input.headers.map((header) => Math.max(header.length, 6));
  input.rows.forEach((row) => {
    row.forEach((cell, index) => {
      weights[index] = Math.max(weights[index] || 6, String(cell).length);
    });
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const columns = weights.map((value) => (value / weightTotal) * width);
  const bottom = pageHeight - 10;

  const paintHeader = () => {
    pdf.setTextColor(15, 23, 42);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(input.heading, margin, 12);
    pdf.setFontSize(11);
    pdf.text(input.title, margin, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(input.storeName, margin, 23);
    pdf.text(input.generatedOn, pageWidth - margin, 23, { align: "right" });
    return 30;
  };

  const paintColumns = (top: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    let x = margin;
    input.headers.forEach((header, index) => {
      const align = input.aligns?.[index] || "left";
      const textX =
        align === "right"
          ? x + columns[index] - 1
          : align === "center"
            ? x + columns[index] / 2
            : x + 1;
      pdf.text(header, textX, top, { align });
      x += columns[index];
    });
    pdf.line(margin, top + 2, pageWidth - margin, top + 2);
    return top + 7;
  };

  let y = paintColumns(paintHeader());
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);

  const writeRow = (cells: string[], bold = false) => {
    if (y > bottom) {
      pdf.addPage();
      y = paintColumns(paintHeader());
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
    }
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    let x = margin;
    cells.forEach((cell, index) => {
      const align = input.aligns?.[index] || "left";
      const textX =
        align === "right"
          ? x + columns[index] - 1
          : align === "center"
            ? x + columns[index] / 2
            : x + 1;
      const maxChars = Math.max(4, Math.floor(columns[index] / 1.7));
      const value = String(cell || "");
      const shown =
        value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
      pdf.text(shown, textX, y, { align });
      x += columns[index];
    });
    y += 5.5;
  };

  if (input.rows.length === 0) {
    writeRow([input.emptyMessage || "No products match your filters."]);
  } else {
    input.rows.forEach((row) => writeRow(row));
    if (input.total) {
      y += 1;
      pdf.line(margin, y - 4, pageWidth - margin, y - 4);
      writeRow(input.total, true);
    }
  }

  pdf.save(input.fileName);
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
