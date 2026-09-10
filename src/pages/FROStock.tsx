import { useEffect } from "react";
import { Card, Icon } from "@/components/ui";

const stockCards = [
  {
    label: "Total Stock",
    value: "150",
    icon: "inventory_2",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    label: "Stock Received",
    value: "150",
    icon: "outbox",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    label: "Stock Returned",
    value: "20",
    icon: "undo",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    label: "Hand Stock",
    value: "130",
    icon: "inventory",
    tone: "bg-purple-50 text-purple-700",
  },
];

export default function FROStock() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="px-3 pt-3 pb-24 sm:px-4 sm:pt-4 max-w-md mx-auto">
      {/* <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
          STOCK
        </p>
        <h1 className="mt-1 text-xl font-extrabold text-slate-800">My Stock</h1>
        <p className="mt-1 text-xs text-slate-500">
          Your current FRO stock summary
        </p>
      </div> */}

      <div className="grid grid-cols-2 gap-3">
        {stockCards.map((card) => (
          <Card
            key={card.label}
            className="group flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition active:scale-[0.98]"
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
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
