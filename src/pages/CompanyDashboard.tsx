import { useState, useMemo } from "react";
import { stores as allStores } from "@/lib/data";
import { useNav } from "@/context/NavContext";
import { Card, StatCard, Button, Icon } from "@/components/ui";
import { formatCurrency, formatCompact, initials } from "@/lib/format";
import { createPortal } from "react-dom";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

const filterTabs: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

type SectionData = {
  receivable: number;
  revenue: number;
  outstanding: number;
  farmers: number;
  trends: {
    receivable: string;
    revenue: string;
    outstanding: string;
    farmers: string;
  };
};

type DashboardData = {
  actual: SectionData;
  market: SectionData;
  store: SectionData;
};

const dashboardData: Record<DateFilter, DashboardData> = {
  today: {
    actual: {
      receivable: 184000,
      revenue: 24500,
      outstanding: 18000,
      farmers: 685,
      trends: {
        receivable: "+4.2% vs yesterday",
        revenue: "+6.8% vs yesterday",
        outstanding: "-1.4% vs yesterday",
        farmers: "+2 new today",
      },
    },
    market: {
      receivable: 245000,
      revenue: 31800,
      outstanding: 28500,
      farmers: 142,
      trends: {
        receivable: "+5.1% vs yesterday",
        revenue: "+9.4% vs yesterday",
        outstanding: "-2.0% vs yesterday",
        farmers: "+1 new today",
      },
    },
    store: {
      receivable: 245000,
      revenue: 24500,
      outstanding: 18000,
      farmers: 142,
      trends: {
        receivable: "+4.2% vs yesterday",
        revenue: "+6.8% vs yesterday",
        outstanding: "-1.4% vs yesterday",
        farmers: "+2 new today",
      },
    },
  },
  weekly: {
    actual: {
      receivable: 412000,
      revenue: 168400,
      outstanding: 22500,
      farmers: 694,
      trends: {
        receivable: "+8.5% vs last week",
        revenue: "+12.3% vs last week",
        outstanding: "-3.2% vs last week",
        farmers: "+9 this week",
      },
    },
    market: {
      receivable: 548000,
      revenue: 214600,
      outstanding: 36500,
      farmers: 148,
      trends: {
        receivable: "+10.2% vs last week",
        revenue: "+14.1% vs last week",
        outstanding: "-4.5% vs last week",
        farmers: "+6 this week",
      },
    },
    store: {
      receivable: 412000,
      revenue: 168400,
      outstanding: 22500,
      farmers: 148,
      trends: {
        receivable: "+8.5% vs last week",
        revenue: "+12.3% vs last week",
        outstanding: "-3.2% vs last week",
        farmers: "+6 this week",
      },
    },
  },
  monthly: {
    actual: {
      receivable: 1640000,
      revenue: 612000,
      outstanding: 32000,
      farmers: 712,
      trends: {
        receivable: "+14.6% this month",
        revenue: "+18.2% this month",
        outstanding: "-5.1% this month",
        farmers: "+24 this month",
      },
    },
    market: {
      receivable: 2180000,
      revenue: 826000,
      outstanding: 48500,
      farmers: 156,
      trends: {
        receivable: "+16.8% this month",
        revenue: "+21.4% this month",
        outstanding: "-6.3% this month",
        farmers: "+12 this month",
      },
    },
    store: {
      receivable: 1640000,
      revenue: 485000,
      outstanding: 32000,
      farmers: 156,
      trends: {
        receivable: "+14.6% this month",
        revenue: "+18.2% this month",
        outstanding: "-5.1% this month",
        farmers: "+12 this month",
      },
    },
  },
  quarterly: {
    actual: {
      receivable: 1840000,
      revenue: 614000,
      outstanding: 54000,
      farmers: 685,
      trends: {
        receivable: "+14.6% this month",
        revenue: "+18.2% this month",
        outstanding: "-5.1% this month",
        farmers: "+24 this month",
      },
    },
    market: {
      receivable: 2280000,
      revenue: 886000,
      outstanding: 42500,
      farmers: 142,
      trends: {
        receivable: "+16.8% this month",
        revenue: "+21.4% this month",
        outstanding: "-6.3% this month",
        farmers: "+12 this month",
      },
    },
    store: {
      receivable: 2280000,
      revenue: 8865000,
      outstanding: 42000,
      farmers: 142,
      trends: {
        receivable: "+14.6% this month",
        revenue: "+18.2% this month",
        outstanding: "-5.1% this month",
        farmers: "+12 this month",
      },
    },
  },
  yearly: {
    actual: {
      receivable: 19840000,
      revenue: 7348000,
      outstanding: 84000,
      farmers: 871,
      trends: {
        receivable: "+22.4% this year",
        revenue: "+26.8% this year",
        outstanding: "-8.7% this year",
        farmers: "+186 this year",
      },
    },
    market: {
      receivable: 26420000,
      revenue: 9860000,
      outstanding: 128000,
      farmers: 920,
      trends: {
        receivable: "+28.1% this year",
        revenue: "+31.6% this year",
        outstanding: "-10.2% this year",
        farmers: "+94 this year",
      },
    },
    store: {
      receivable: 19840000,
      revenue: 4850000,
      outstanding: 84000,
      farmers: 920,
      trends: {
        receivable: "+22.4% this year",
        revenue: "+26.8% this year",
        outstanding: "-8.7% this year",
        farmers: "+94 this year",
      },
    },
  },
};

export default function CompanyDashboard() {
  const { goStore } = useNav();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const data = useMemo(() => dashboardData[dateFilter], [dateFilter]);
  const store = allStores[0];

  return (
    <div>
      {/* Sticky date filter bar — solid background, stays below header */}
      {/* <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 mb-10 bg-slate-50 border-b border-slate-200 shadow-sm">
        <div className="flex justify-end">
          <SegmentedDateFilter value={dateFilter} onChange={setDateFilter} />
        </div>
      </div> */}
      {createPortal(
        <div className="fixed top-[82px] right-8 z-[9999]">
          <SegmentedDateFilter value={dateFilter} onChange={setDateFilter} />
        </div>,
        document.body,
      )}

      <div className="h-[90px]" />
      {/* SECTION 1 — Actual Sales */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Actual Sales
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Nature Biotic direct and company sales overview
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 stagger">
          <StatCard
            label="Sales"
            value={formatCurrency(data.actual.receivable)}
            icon="account_balance_wallet"
            color="brand"
            trend={data.actual.trends.receivable}
            trendUp
          />
          <StatCard
            label="Collection"
            value={formatCurrency(data.actual.revenue)}
            icon="payments"
            color="blue"
            trend={data.actual.trends.revenue}
            trendUp
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(data.actual.outstanding)}
            icon="receipt_long"
            color="amber"
            trend={data.actual.trends.outstanding}
            trendUp
          />
          {/* <StatCard label="No of Farmers" value={String(data.actual.farmers)} icon="groups" color="brand" trend={data.actual.trends.farmers} trendUp /> */}
        </div>
      </section>

      {/* SECTION 2 — Market Sales */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Market Sales
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Combined sales overview from all stores
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
          <StatCard
            label="Sales"
            value={formatCurrency(data.market.receivable)}
            icon="account_balance_wallet"
            color="brand"
            trend={data.market.trends.receivable}
            trendUp
          />
          <StatCard
            label="Collection"
            value={formatCurrency(data.market.revenue)}
            icon="payments"
            color="blue"
            trend={data.market.trends.revenue}
            trendUp
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(data.market.outstanding)}
            icon="receipt_long"
            color="amber"
            trend={data.market.trends.outstanding}
            trendUp
          />
          <StatCard
            label="No of Farmers"
            value={String(data.market.farmers)}
            icon="groups"
            color="purple"
            trend={data.market.trends.farmers}
            trendUp
          />
        </div>
      </section>

      {/* SECTION 3 — Store Overview */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Store Overview
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Performance</p>
        </div>

        <Card className="p-5 sm:p-6 animate-fade-in">
          {/* Store details + KPI cards in one row on desktop */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-5">
            {/* Store details */}
            <div className="flex items-center gap-3 xl:w-[26%] shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                <span className="font-bold text-brand-700">
                  {initials(store.name)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                    Store 1
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight truncate">
                    {store.name}
                  </h3>
                </div>
                <button
                  onClick={() => goStore(store.id)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold transition-base hover:bg-brand-700"
                >
                  <Icon name="dashboard" size={16} /> Open Dashboard
                </button>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
              <StoreKpi
                icon="account_balance_wallet"
                label="Sales"
                value={formatCurrency(data.store.receivable)}
                color="brand"
              />
              <StoreKpi
                icon="payments"
                label="Collection"
                value={formatCurrency(data.store.revenue)}
                color="blue"
              />
              <StoreKpi
                icon="receipt_long"
                label="Outstanding"
                value={formatCurrency(data.store.outstanding)}
                color="amber"
              />
              <StoreKpi
                icon="groups"
                label="No of Farmers"
                value={String(data.store.farmers)}
                color="purple"
              />
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function SegmentedDateFilter({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (v: DateFilter) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto max-w-full">
      {filterTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-base whitespace-nowrap ${
            value === tab.key
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function StoreKpi({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: "brand" | "blue" | "amber" | "purple";
}) {
  const colors: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="rounded-xl bg-slate-50 p-3 transition-base hover:bg-slate-100/70 flex items-center gap-2.5">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}
      >
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800 tracking-tight leading-tight truncate">
          {value}
        </p>
        <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
          {label}
        </p>
      </div>
    </div>
  );
}
