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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        {/* <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            FRO Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-800">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {store.name} · {store.location}
          </p>
        </div> */}
        <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${dateFilter === filter.key ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {card.label}
                </p>
                <p className="mt-1 text-lg font-extrabold text-slate-800">
                  {card.value}
                </p>
              </div>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
              >
                <Icon name={card.icon} size={16} />
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Top Product
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Icon name="inventory_2" size={19} />
            </div>
            <div>
              <p className="font-bold text-slate-800">{summary.product}</p>
              <p className="text-xs text-slate-500">Best performing product</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Collection Balance
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-800">
            {formatCurrency(summary.cash)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Collection currently in hand
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Outstanding Balance
          </p>
          <p className="mt-2 text-2xl font-extrabold text-amber-700">
            {formatCurrency(summary.outstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Only {user.name}'s portfolio
          </p>
        </Card>
      </div> */}
    </div>
  );
}
