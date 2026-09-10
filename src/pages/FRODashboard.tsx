import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getStore } from "@/lib/data";
import { Card, EmptyState, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

const filters: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

type Summary = {
  sales: number;
  collection: number;
  cash: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  visits: number;
  area: string;
  product: string;
};

const summaries: Record<string, Record<DateFilter, Summary>> = {
  "Ram Kumar": {
    today: {
      sales: 24500,
      collection: 21600,
      cash: 3400,
      outstanding: 2900,
      farmers: 42,
      farms: 31,
      crops: 8,
      visits: 18,
      area: "Rajapalayam",
      product: "Electra",
    },
    weekly: {
      sales: 168400,
      collection: 142800,
      cash: 22800,
      outstanding: 25600,
      farmers: 46,
      farms: 34,
      crops: 10,
      visits: 126,
      area: "Rajapalayam",
      product: "Electra",
    },
    monthly: {
      sales: 485000,
      collection: 412000,
      cash: 64500,
      outstanding: 73000,
      farmers: 52,
      farms: 38,
      crops: 12,
      visits: 542,
      area: "Rajapalayam",
      product: "Electra",
    },
    quarterly: {
      sales: 1425000,
      collection: 1186000,
      cash: 184200,
      outstanding: 239000,
      farmers: 58,
      farms: 42,
      crops: 14,
      visits: 1604,
      area: "Rajapalayam",
      product: "Electra",
    },
    yearly: {
      sales: 5820000,
      collection: 4740000,
      cash: 726000,
      outstanding: 1080000,
      farmers: 64,
      farms: 48,
      crops: 16,
      visits: 6580,
      area: "Rajapalayam",
      product: "Electra",
    },
  },
  "Ajith Kumar": {
    today: {
      sales: 19800,
      collection: 17200,
      cash: 2800,
      outstanding: 2600,
      farmers: 36,
      farms: 28,
      crops: 7,
      visits: 14,
      area: "Srivilliputhur",
      product: "Aalga",
    },
    weekly: {
      sales: 132600,
      collection: 110500,
      cash: 18600,
      outstanding: 22100,
      farmers: 39,
      farms: 30,
      crops: 9,
      visits: 98,
      area: "Srivilliputhur",
      product: "Aalga",
    },
    monthly: {
      sales: 392000,
      collection: 318000,
      cash: 52400,
      outstanding: 74000,
      farmers: 44,
      farms: 33,
      crops: 11,
      visits: 418,
      area: "Srivilliputhur",
      product: "Aalga",
    },
    quarterly: {
      sales: 1148000,
      collection: 942000,
      cash: 148600,
      outstanding: 206000,
      farmers: 49,
      farms: 36,
      crops: 13,
      visits: 1242,
      area: "Srivilliputhur",
      product: "Aalga",
    },
    yearly: {
      sales: 4680000,
      collection: 3820000,
      cash: 584000,
      outstanding: 860000,
      farmers: 54,
      farms: 41,
      crops: 15,
      visits: 5060,
      area: "Srivilliputhur",
      product: "Aalga",
    },
  },
  PeriyaSamy: {
    today: {
      sales: 17600,
      collection: 15400,
      cash: 2400,
      outstanding: 2200,
      farmers: 31,
      farms: 24,
      crops: 6,
      visits: 11,
      area: "Sivakasi",
      product: "Astra",
    },
    weekly: {
      sales: 118200,
      collection: 98600,
      cash: 16200,
      outstanding: 19600,
      farmers: 34,
      farms: 26,
      crops: 8,
      visits: 82,
      area: "Sivakasi",
      product: "Astra",
    },
    monthly: {
      sales: 348000,
      collection: 286000,
      cash: 46800,
      outstanding: 62000,
      farmers: 38,
      farms: 29,
      crops: 10,
      visits: 356,
      area: "Sivakasi",
      product: "Astra",
    },
    quarterly: {
      sales: 1024000,
      collection: 848000,
      cash: 132400,
      outstanding: 176000,
      farmers: 42,
      farms: 31,
      crops: 12,
      visits: 1068,
      area: "Sivakasi",
      product: "Astra",
    },
    yearly: {
      sales: 4180000,
      collection: 3420000,
      cash: 518000,
      outstanding: 760000,
      farmers: 47,
      farms: 35,
      crops: 14,
      visits: 4320,
      area: "Sivakasi",
      product: "Astra",
    },
  },
};

const colors = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
};

export default function FRODashboard({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const store = getStore(storeId);
  const summary = useMemo(
    () => summaries[user?.name || ""]?.[dateFilter],
    [user?.name, dateFilter],
  );

  if (!store || !user || user.role !== "fro" || !summary) {
    return <EmptyState icon="error" title="FRO profile not found" />;
  }

  const cards = [
    {
      label: "Sales",
      value: formatCurrency(summary.sales),
      icon: "payments",
      tone: colors.green,
    },
    {
      label: "Collection",
      value: formatCurrency(summary.collection),
      icon: "account_balance_wallet",
      tone: colors.blue,
    },
    {
      label: "Cash in Hand",
      value: formatCurrency(summary.cash),
      icon: "savings",
      tone: colors.green,
    },
    {
      label: "Outstanding",
      value: formatCurrency(summary.outstanding),
      icon: "receipt_long",
      tone: colors.amber,
    },
    {
      label: "Visits",
      value: String(summary.visits),
      icon: "event_available",
      tone: colors.purple,
    },
    {
      label: "Farmers",
      value: String(summary.farmers),
      icon: "groups",
      tone: colors.purple,
    },
    {
      label: "Farms",
      value: String(summary.farms),
      icon: "agriculture",
      tone: colors.green,
    },
    {
      label: "Crops",
      value: String(summary.crops),
      icon: "spa",
      tone: colors.blue,
    },
  ];
  return (
    <div className="px-3 pt-3 pb-24 sm:px-4 sm:pt-4 max-w-md mx-auto">
      <div className="mb-4 w-full overflow-x-auto scrollbar-hide">
        <div className="flex min-w-[320px] w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={`flex-1 min-w-0 whitespace-nowrap rounded-lg px-1.5 py-2.5 text-[10px] font-semibold transition ${
                dateFilter === filter.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
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
              <p className="w-full truncate text-[11px] font-semibold text-slate-600">
                {card.label}
              </p>

              <p className="mt-1 max-w-full truncate text-[16px] font-extrabold leading-tight text-slate-800">
                {card.value}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
