import { Button, Icon } from "@/components/ui";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M20.5 3.5A11 11 0 0 0 2.1 17.8L1 23l5.3-1.1A11 11 0 0 0 20.5 3.5zM12 20.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.3a.5.5 0 0 0 0-.5c0-.1-.5-1.2-.7-1.6s-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.8 4.3 4.3 0 0 0 .9 2.3 9.8 9.8 0 0 0 3.7 3.3 12 12 0 0 0 1.2.4 2.9 2.9 0 0 0 1.3.1 2.2 2.2 0 0 0 1.4-1 1.8 1.8 0 0 0 .1-1c-.1-.1-.2-.2-.4-.3z" />
    </svg>
  );
}

export function FroDocumentActions({
  onWhatsApp,
  onPrint,
  onClose,
}: {
  onWhatsApp: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fro-document-actions flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onWhatsApp} className="w-full sm:w-auto">
        <WhatsAppIcon />
        WhatsApp
      </Button>
      <Button variant="secondary" onClick={onPrint} className="w-full sm:w-auto">
        <Icon name="print" size={18} />
        Print
      </Button>
      <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
        Close
      </Button>
    </div>
  );
}

export const froDocumentPrintStyle = `
@media print {
  body * { visibility: hidden !important; }
  .fro-document-print, .fro-document-print * { visibility: visible !important; }
  .fro-document-print {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    background: #fff !important;
  }
  .fro-document-actions { display: none !important; }
}
`;
