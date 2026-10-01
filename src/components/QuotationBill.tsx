import { CommonDocumentBill } from "@/components/CommonDocumentBill";
import { quotationToDocument, type QuotationDocumentInput } from "@/lib/documentModel";

export type QuotationBillProduct = NonNullable<QuotationDocumentInput["products"]>[number];
export type QuotationBillData = QuotationDocumentInput;

/** Store quotation view. Renders the shared document bill. */
export function QuotationBill({
  quotation,
  notes = "",
  onNotesChange,
  documentMode = false,
}: {
  quotation: QuotationBillData;
  notes?: string;
  onNotesChange?: (value: string) => void;
  documentMode?: boolean;
}) {
  return (
    <CommonDocumentBill
      documentType="quotation"
      data={quotationToDocument(quotation, notes)}
      notes={notes}
      onNotesChange={onNotesChange}
      documentMode={documentMode}
    />
  );
}
