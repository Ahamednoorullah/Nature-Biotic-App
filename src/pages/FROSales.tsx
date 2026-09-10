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
];

export default function FROSales() {
  const { goStorePage } = useNav();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="px-3 pt-3 pb-24 sm:px-4 sm:pt-4 max-w-md mx-auto">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
          SALES
        </p>
        <h1 className="mt-1 text-xl font-extrabold text-slate-800">My Sales</h1>
        <p className="mt-1 text-xs text-slate-500">
          Manage your sales activities
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {salesCards.map((card, index) => (
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
                };
              const page = pageMap[card.label];
              if (page) goStorePage(page);
            }}
            className={`h-[142px] cursor-pointer rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.98] hover:shadow-md ${
              index === salesCards.length - 1 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span
                className={`mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.tone}`}
              >
                <Icon name={card.icon} size={21} />
              </span>

              <p className="w-full truncate text-[11px] font-semibold text-slate-600">
                {card.label}
              </p>

              <p className="mt-1 text-[20px] font-extrabold leading-tight text-slate-800">
                {card.value}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
