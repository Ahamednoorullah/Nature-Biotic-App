import { useEffect } from "react";
import { useNav } from "@/context/NavContext";
import { Card, Icon } from "@/components/ui";

const salesCards = [
  {
    label: "Quotation",
    value: "12",
    icon: "request_quote",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    label: "Sales Invoice",
    value: "24",
    icon: "receipt_long",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    label: "Sales Return",
    value: "3",
    icon: "assignment_return",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    label: "Receipt",
    value: "18",
    icon: "receipt",
    tone: "bg-purple-50 text-purple-700",
  },
  {
    label: "Refund",
    value: "2",
    icon: "currency_exchange",
    tone: "bg-rose-50 text-rose-700",
  },
  {
    label: "Payment",
    value: "₹18,500",
    icon: "payments",
    tone: "bg-green-50 text-green-700",
  },
];

export default function FROSales() {
  const { goStorePage } = useNav();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="px-3 pt-3 pb-24 sm:px-4 sm:pt-4 max-w-md mx-auto">
      {/* <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
          SALES
        </p>
        <h1 className="mt-1 text-xl font-extrabold text-slate-800">My Sales</h1>
        <p className="mt-1 text-xs text-slate-500">
          Manage your sales activities
        </p>
      </div> */}

      <div className="grid grid-cols-2 gap-3">
        {salesCards.map((card) => (
          <Card
            key={card.label}
            onClick={() => {
              const pageMap: Record<string, Parameters<typeof goStorePage>[0]> =
                {
                  Quotation: "quotation",
                  "Sales Invoice": "sales-invoice",
                  "Sales Return": "sales-return",
                  Receipt: "receipt",
                  Refund: "refund",
                  Payment: "payments",
                };
              const page = pageMap[card.label];
              if (page) goStorePage(page);
            }}
            className="group flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition active:scale-[0.98]"
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}
              >
                <Icon name={card.icon} size={24} fill={false} />
              </span>
              <Icon
                name="chevron_right"
                size={18}
                className="text-slate-300 transition group-hover:text-brand-500"
              />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                {card.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                View &amp; manage
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
