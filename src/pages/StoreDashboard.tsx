import { useState, useMemo } from "react";
import { useEffect } from "react";
import { getStore } from "@/lib/data";
import {
  Card,
  StatCard,
  EmptyState,
  Button,
  Select,
  Icon,
} from "@/components/ui";
import { formatCurrency, initials } from "@/lib/format";
import { createPortal } from "react-dom";

type DateFilter = "today" | "weekly" | "monthly" | "quarterly" | "yearly";

const filterTabs: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

type ExecKey = "ram" | "ajith" | "periya";
type ExecDetailType = "sales" | "collection" | "cash" | "outstanding";

type DirectDetailType = "sales" | "collection" | "outstanding";

type DirectDetailSelection = DirectDetailType | null;

type ExecDetailSelection = {
  execKey: ExecKey;
  type: ExecDetailType;
} | null;

type ExecSummary = {
  sales: number;
  collection: number;
  collectionInHand: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  visits: number;
  bestArea: string;
  topProduct: string;
};

const execNames: Record<ExecKey, string> = {
  ram: "Ram Kumar",
  ajith: "Ajith Kumar",
  periya: "PeriyaSamy",
};

const execColors: Record<ExecKey, string> = {
  ram: "from-emerald-400 to-emerald-600",
  ajith: "from-blue-400 to-blue-600",
  periya: "from-amber-400 to-amber-600",
};

type ExecTarget = {
  sales: number;
  farmers: number;
  farms: number;
  visits: number;
};

const execTargets: Record<ExecKey, Record<DateFilter, ExecTarget>> = {
  ram: {
    today: { sales: 30000, farmers: 50, farms: 35, visits: 10 },
    weekly: { sales: 200000, farmers: 55, farms: 40, visits: 20 },
    monthly: { sales: 600000, farmers: 65, farms: 45, visits: 40 },
    quarterly: { sales: 1800000, farmers: 75, farms: 55, visits: 120 },
    yearly: { sales: 7200000, farmers: 90, farms: 70, visits: 250 },
  },
  ajith: {
    today: { sales: 30000, farmers: 50, farms: 35, visits: 10 },
    weekly: { sales: 200000, farmers: 55, farms: 40, visits: 20 },
    monthly: { sales: 600000, farmers: 65, farms: 45, visits: 40 },
    quarterly: { sales: 1800000, farmers: 75, farms: 55, visits: 120 },
    yearly: { sales: 7200000, farmers: 90, farms: 70, visits: 250 },
  },
  periya: {
    today: { sales: 30000, farmers: 50, farms: 35, visits: 10 },
    weekly: { sales: 200000, farmers: 55, farms: 40, visits: 20 },
    monthly: { sales: 600000, farmers: 65, farms: 45, visits: 40 },
    quarterly: { sales: 1800000, farmers: 75, farms: 55, visits: 120 },
    yearly: { sales: 7200000, farmers: 90, farms: 70, visits: 250 },
  },
};

const execDetailData: Record<
  ExecKey,
  {
    sales: {
      date: string;
      invoiceNo: string;
      farmer: string;
      amount: number;
    }[];
    collection: {
      date: string;
      receiptNo: string;
      farmer: string;
      amount: number;
    }[];
    cash: { date: string; farmer: string; amount: number }[];
    outstanding: {
      date: string;
      farmer: string;

      village: string;
      phone: string;
      amount: number;
    }[];
  }
> = {
  ram: {
    sales: [
      {
        date: "10 Aug 2026",
        invoiceNo: "INV-RK-1042",
        farmer: "Murugan",
        amount: 6200,
      },
      {
        date: "10 Aug 2026",
        invoiceNo: "INV-RK-1041",
        farmer: "Selvam",
        amount: 4800,
      },
      {
        date: "09 Aug 2026",
        invoiceNo: "INV-RK-1038",
        farmer: "Kannan",
        amount: 7500,
      },
      {
        date: "09 Aug 2026",
        invoiceNo: "INV-RK-1036",
        farmer: "Raja",
        amount: 6000,
      },
    ],
    collection: [
      {
        date: "10 Aug 2026",
        receiptNo: "RCPT-RK-521",
        farmer: "Murugan",
        amount: 5200,
      },
      {
        date: "10 Aug 2026",
        receiptNo: "RCPT-RK-520",
        farmer: "Selvam",
        amount: 4300,
      },
      {
        date: "09 Aug 2026",
        receiptNo: "RCPT-RK-516",
        farmer: "Kannan",
        amount: 6900,
      },
      {
        date: "09 Aug 2026",
        receiptNo: "RCPT-RK-514",
        farmer: "Raja",
        amount: 5200,
      },
    ],
    cash: [
      { date: "10 Aug 2026", farmer: "Murugan", amount: 1200 },
      { date: "10 Aug 2026", farmer: "Selvam", amount: 800 },
      { date: "09 Aug 2026", farmer: "Kannan", amount: 900 },
      { date: "09 Aug 2026", farmer: "Raja", amount: 500 },
    ],
    outstanding: [
      {
        date: "10 Aug 2026",
        farmer: "Murugan",

        village: "Seithur",
        phone: "98765 43210",
        amount: 900,
      },
      {
        date: "09 Aug 2026",
        farmer: "Selvam",

        village: "Chatrapatti",
        phone: "98765 43211",
        amount: 700,
      },
      {
        date: "08 Aug 2026",
        farmer: "Kannan",

        village: "Watrap",
        phone: "98765 43212",
        amount: 800,
      },
      {
        date: "08 Aug 2026",
        farmer: "Raja",

        village: "Rajapalayam",
        phone: "98765 43213",
        amount: 500,
      },
    ],
  },
  ajith: {
    sales: [
      {
        date: "10 Aug 2026",
        invoiceNo: "INV-AK-842",
        farmer: "Arun",
        amount: 5400,
      },
      {
        date: "10 Aug 2026",
        invoiceNo: "INV-AK-840",
        farmer: "Bala",
        amount: 4600,
      },
      {
        date: "09 Aug 2026",
        invoiceNo: "INV-AK-836",
        farmer: "Suresh",
        amount: 5100,
      },
      {
        date: "09 Aug 2026",
        invoiceNo: "INV-AK-833",
        farmer: "Muthu",
        amount: 4700,
      },
    ],
    collection: [
      {
        date: "10 Aug 2026",
        receiptNo: "RCPT-AK-421",
        farmer: "Arun",
        amount: 4700,
      },
      {
        date: "10 Aug 2026",
        receiptNo: "RCPT-AK-419",
        farmer: "Bala",
        amount: 3900,
      },
      {
        date: "09 Aug 2026",
        receiptNo: "RCPT-AK-416",
        farmer: "Suresh",
        amount: 4500,
      },
      {
        date: "09 Aug 2026",
        receiptNo: "RCPT-AK-413",
        farmer: "Muthu",
        amount: 4100,
      },
    ],
    cash: [
      { date: "10 Aug 2026", farmer: "Arun", amount: 900 },
      { date: "10 Aug 2026", farmer: "Bala", amount: 700 },
      { date: "09 Aug 2026", farmer: "Suresh", amount: 650 },
      { date: "09 Aug 2026", farmer: "Muthu", amount: 550 },
    ],
    outstanding: [
      {
        date: "10 Aug 2026",
        farmer: "Arun",

        village: "Srivilliputhur",
        phone: "98765 43220",
        amount: 700,
      },
      {
        date: "09 Aug 2026",
        farmer: "Bala",

        village: "Mamsapuram",
        phone: "98765 43221",
        amount: 600,
      },
      {
        date: "08 Aug 2026",
        farmer: "Suresh",

        village: "Koonampatti",
        phone: "98765 43222",
        amount: 800,
      },
      {
        date: "08 Aug 2026",
        farmer: "Muthu",

        village: "Vathirairuppu",
        phone: "98765 43223",
        amount: 500,
      },
    ],
  },
  periya: {
    sales: [
      {
        date: "10 Aug 2026",
        invoiceNo: "INV-PS-742",
        farmer: "Velu",
        amount: 4900,
      },
      {
        date: "10 Aug 2026",
        invoiceNo: "INV-PS-740",
        farmer: "Ganesan",
        amount: 4200,
      },
      {
        date: "09 Aug 2026",
        invoiceNo: "INV-PS-736",
        farmer: "Ramesh",
        amount: 4500,
      },
      {
        date: "09 Aug 2026",
        invoiceNo: "INV-PS-733",
        farmer: "Saravanan",
        amount: 4000,
      },
    ],
    collection: [
      {
        date: "10 Aug 2026",
        receiptNo: "RCPT-PS-321",
        farmer: "Velu",
        amount: 4300,
      },
      {
        date: "10 Aug 2026",
        receiptNo: "RCPT-PS-319",
        farmer: "Ganesan",
        amount: 3700,
      },
      {
        date: "09 Aug 2026",
        receiptNo: "RCPT-PS-316",
        farmer: "Ramesh",
        amount: 3900,
      },
      {
        date: "09 Aug 2026",
        receiptNo: "RCPT-PS-313",
        farmer: "Saravanan",
        amount: 3500,
      },
    ],
    cash: [
      { date: "10 Aug 2026", farmer: "Velu", amount: 700 },
      { date: "10 Aug 2026", farmer: "Ganesan", amount: 600 },
      { date: "09 Aug 2026", farmer: "Ramesh", amount: 600 },
      { date: "09 Aug 2026", farmer: "Saravanan", amount: 500 },
    ],
    outstanding: [
      {
        date: "10 Aug 2026",
        farmer: "Velu",

        village: "Sivakasi",
        phone: "98765 43230",
        amount: 600,
      },
      {
        date: "09 Aug 2026",
        farmer: "Ganesan",

        village: "Thiruthangal",
        phone: "98765 43231",
        amount: 500,
      },
      {
        date: "08 Aug 2026",
        farmer: "Ramesh",

        village: "Sattur",
        phone: "98765 43232",
        amount: 600,
      },
      {
        date: "08 Aug 2026",
        farmer: "Saravanan",

        village: "Vembakottai",
        phone: "98765 43233",
        amount: 500,
      },
    ],
  },
};

const execData: Record<ExecKey, Record<DateFilter, ExecSummary>> = {
  ram: {
    today: {
      sales: 24500,
      collection: 21600,
      collectionInHand: 3400,
      outstanding: 2900,
      farmers: 42,
      farms: 31,
      crops: 8,
      visits: 18,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    weekly: {
      sales: 168400,
      collection: 142800,
      collectionInHand: 22800,
      outstanding: 25600,
      farmers: 46,
      farms: 34,
      crops: 10,
      visits: 126,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    monthly: {
      sales: 485000,
      collection: 412000,
      collectionInHand: 64500,
      outstanding: 73000,
      farmers: 52,
      farms: 38,
      crops: 12,
      visits: 542,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    quarterly: {
      sales: 1425000,
      collection: 1186000,
      collectionInHand: 184200,
      outstanding: 239000,
      farmers: 58,
      farms: 42,
      crops: 14,
      visits: 1604,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
    yearly: {
      sales: 5820000,
      collection: 4740000,
      collectionInHand: 726000,
      outstanding: 1080000,
      farmers: 64,
      farms: 48,
      crops: 16,
      visits: 6580,
      bestArea: "Rajapalayam",
      topProduct: "Electra",
    },
  },
  ajith: {
    today: {
      sales: 19800,
      collection: 17200,
      collectionInHand: 2800,
      outstanding: 2600,
      farmers: 36,
      farms: 28,
      crops: 7,
      visits: 14,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    weekly: {
      sales: 132600,
      collection: 110500,
      collectionInHand: 18600,
      outstanding: 22100,
      farmers: 39,
      farms: 30,
      crops: 9,
      visits: 98,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    monthly: {
      sales: 392000,
      collection: 318000,
      collectionInHand: 52400,
      outstanding: 74000,
      farmers: 44,
      farms: 33,
      crops: 11,
      visits: 418,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    quarterly: {
      sales: 1148000,
      collection: 942000,
      collectionInHand: 148600,
      outstanding: 206000,
      farmers: 49,
      farms: 36,
      crops: 13,
      visits: 1242,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
    yearly: {
      sales: 4680000,
      collection: 3820000,
      collectionInHand: 584000,
      outstanding: 860000,
      farmers: 54,
      farms: 41,
      crops: 15,
      visits: 5060,
      bestArea: "Srivilliputhur",
      topProduct: "Aalga",
    },
  },
  periya: {
    today: {
      sales: 17600,
      collection: 15400,
      collectionInHand: 2400,
      outstanding: 2200,
      farmers: 31,
      farms: 24,
      crops: 6,
      visits: 11,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    weekly: {
      sales: 118200,
      collection: 98600,
      collectionInHand: 16200,
      outstanding: 19600,
      farmers: 34,
      farms: 26,
      crops: 8,
      visits: 82,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    monthly: {
      sales: 348000,
      collection: 286000,
      collectionInHand: 46800,
      outstanding: 62000,
      farmers: 38,
      farms: 29,
      crops: 10,
      visits: 356,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    quarterly: {
      sales: 1024000,
      collection: 848000,
      collectionInHand: 132400,
      outstanding: 176000,
      farmers: 42,
      farms: 31,
      crops: 12,
      visits: 1068,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
    yearly: {
      sales: 4180000,
      collection: 3420000,
      collectionInHand: 518000,
      outstanding: 760000,
      farmers: 47,
      farms: 35,
      crops: 14,
      visits: 4320,
      bestArea: "Sivakasi",
      topProduct: "Astra",
    },
  },
};

type KpiData = {
  sales: number;
  collection: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
  trends: {
    sales: string;
    collection: string;
    outstanding: string;
    farmers: string;
    farms: string;
    crops: string;
  };
};

const kpiData: Record<DateFilter, KpiData> = {
  today: {
    sales: 61900,
    collection: 54200,
    outstanding: 7700,
    farmers: 142,
    farms: 96,
    crops: 38,
    trends: {
      sales: "+6.8% vs yesterday",
      collection: "+4.2% vs yesterday",
      outstanding: "-1.4% vs yesterday",
      farmers: "+2 new today",
      farms: "+1 new today",
      crops: "38 active crops",
    },
  },
  weekly: {
    sales: 419200,
    collection: 351900,
    outstanding: 67300,
    farmers: 148,
    farms: 101,
    crops: 42,
    trends: {
      sales: "+12.3% vs last week",
      collection: "+9.1% vs last week",
      outstanding: "-3.2% vs last week",
      farmers: "+9 this week",
      farms: "+5 this week",
      crops: "+4 this week",
    },
  },
  monthly: {
    sales: 1225000,
    collection: 1016000,
    outstanding: 209000,
    farmers: 156,
    farms: 108,
    crops: 47,
    trends: {
      sales: "+18.2% this month",
      collection: "+14.6% this month",
      outstanding: "-5.1% this month",
      farmers: "+24 this month",
      farms: "+12 this month",
      crops: "+9 this month",
    },
  },
  quarterly: {
    sales: 3597000,
    collection: 2976000,
    outstanding: 621000,
    farmers: 166,
    farms: 117,
    crops: 52,
    trends: {
      sales: "+22.4% this quarter",
      collection: "+18.9% this quarter",
      outstanding: "-7.8% this quarter",
      farmers: "+38 this quarter",
      farms: "+21 this quarter",
      crops: "+14 this quarter",
    },
  },
  yearly: {
    sales: 14680000,
    collection: 11980000,
    outstanding: 2700000,
    farmers: 184,
    farms: 132,
    crops: 58,
    trends: {
      sales: "+24.6% this year",
      collection: "+21.3% this year",
      outstanding: "-9.2% this year",
      farmers: "+72 this year",
      farms: "+48 this year",
      crops: "+22 this year",
    },
  },
};

type DirectSalesSummary = {
  sales: number;
  collection: number;
  outstanding: number;
  farmers: number;
  farms: number;
  crops: number;
};

const directSalesData: Record<DateFilter, DirectSalesSummary> = {
  today: {
    sales: 18600,
    collection: 15200,
    outstanding: 3400,
    farmers: 18,
    farms: 12,
    crops: 7,
  },
  weekly: {
    sales: 124800,
    collection: 103600,
    outstanding: 21200,
    farmers: 42,
    farms: 31,
    crops: 12,
  },
  monthly: {
    sales: 368000,
    collection: 301500,
    outstanding: 66500,
    farmers: 68,
    farms: 49,
    crops: 18,
  },
  quarterly: {
    sales: 1085000,
    collection: 886000,
    outstanding: 199000,
    farmers: 96,
    farms: 72,
    crops: 24,
  },
  yearly: {
    sales: 4320000,
    collection: 3520000,
    outstanding: 800000,
    farmers: 138,
    farms: 104,
    crops: 32,
  },
};

export default function StoreDashboard({ storeId }: { storeId: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const store = getStore(storeId);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [execDetail, setExecDetail] = useState<ExecDetailSelection>(null);
  const [directDetail, setDirectDetail] =
    useState<DirectDetailSelection>(null);

  const data = useMemo(() => kpiData[dateFilter], [dateFilter]);
  const directSales = useMemo(() => directSalesData[dateFilter], [dateFilter]);


  if (!store) return <EmptyState icon="error" title="Store not found" />;

  return (
    <div>
      {/* Sticky date filter */}
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

      {/* ROW 1 — Business Overview */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-10">
          Business Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
          <BusinessOverviewCard
            label="Sales"
            value={formatCurrency(data.sales)}
            icon="payments"
            color="brand"
            trend={data.trends.sales}
          />
          <BusinessOverviewCard
            label="Collection"
            value={formatCurrency(data.collection)}
            icon="account_balance_wallet"
            color="blue"
            trend={data.trends.collection}
          />
          <BusinessOverviewCard
            label="Outstanding"
            value={formatCurrency(data.outstanding)}
            icon="receipt_long"
            color="amber"
            trend={data.trends.outstanding}
          />
          <BusinessOverviewCard
            label="Farmers"
            value={String(data.farmers)}
            icon="groups"
            color="purple"
            trend={data.trends.farmers}
          />
          <BusinessOverviewCard
            label="Farms"
            value={String(data.farms)}
            icon="agriculture"
            color="brand"
            trend={data.trends.farms}
          />
          <BusinessOverviewCard
            label="Crops"
            value={String(data.crops)}
            icon="spa"
            color="blue"
            trend={data.trends.crops}
          />
        </div>
      </div>

      {/* ROW 2 — Store Direct Sales */}
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Store Direct Sales
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Farmers who purchase directly from this store.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <DirectSalesCard
            label="Sales"
            value={formatCurrency(directSales.sales)}
            icon="payments"
            color="brand"
            onClick={() => setDirectDetail("sales")}
          />
          <DirectSalesCard
            label="Collection"
            value={formatCurrency(directSales.collection)}
            icon="account_balance_wallet"
            color="blue"
            onClick={() => setDirectDetail("collection")}
          />
          <DirectSalesCard
            label="Outstanding"
            value={formatCurrency(directSales.outstanding)}
            icon="receipt_long"
            color="amber"
            onClick={() => setDirectDetail("outstanding")}
          />
          <DirectSalesCard
            label="Farmers"
            value={String(directSales.farmers)}
            icon="groups"
            color="purple"
          />
          <DirectSalesCard
            label="Farms"
            value={String(directSales.farms)}
            icon="agriculture"
            color="brand"
          />
          <DirectSalesCard
            label="Crops"
            value={String(directSales.crops)}
            icon="spa"
            color="blue"
          />
        </div>
      </div>

      {directDetail &&
        createPortal(
          <DirectSalesDetailModal
            type={directDetail}
            dateFilter={dateFilter}
            summary={directSales}
            storeName={store.name}
            onClose={() => setDirectDetail(null)}
          />,
          document.body,
        )}

      {/* ROW 3 — Executive Summary */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
          Executive Summary
        </h2>
        <div className="space-y-3">
          {(Object.keys(execNames) as ExecKey[]).map((key) => {
            const e = execData[key][dateFilter];
            const target = execTargets[key][dateFilter];
            return (
              <Card key={key} className="p-4">
                <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${execColors[key]} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                    >
                      {initials(execNames[key])}
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                        {execNames[key]}
                      </h3>
                      <p className="text-xs text-slate-400">Field Executive</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ExecutiveTargetBadge
                      icon="payments"
                      label="Sales Target"
                      value={formatCurrency(target.sales)}
                      color="brand"
                    />
                    <ExecutiveTargetBadge
                      icon="groups"
                      label="Farmers Target"
                      value={String(target.farmers)}
                      color="blue"
                    />
                    <ExecutiveTargetBadge
                      icon="agriculture"
                      label="Farms Target"
                      value={String(target.farms)}
                      color="amber"
                    />
                    <ExecutiveTargetBadge
                      icon="receipt"
                      label="Visits Target"
                      value={String(target.visits)}
                      color="purple"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-8 gap-2">
                  <ExecField
                    icon="payments"
                    label="Sales"
                    value={formatCurrency(e.sales)}
                    color="text-brand-600"
                    onClick={() =>
                      setExecDetail({ execKey: key, type: "sales" })
                    }
                  />
                  <ExecField
                    icon="account_balance_wallet"
                    label="Collection"
                    value={formatCurrency(e.collection)}
                    color="text-blue-600"
                    onClick={() =>
                      setExecDetail({ execKey: key, type: "collection" })
                    }
                  />
                  <ExecField
                    icon="savings"
                    label="Cash in Hand"
                    value={formatCurrency(e.collectionInHand)}
                    color="text-emerald-600"
                    onClick={() =>
                      setExecDetail({ execKey: key, type: "cash" })
                    }
                  />
                  <ExecField
                    icon="receipt_long"
                    label="Outstanding"
                    value={formatCurrency(e.outstanding)}
                    color="text-amber-600"
                    onClick={() =>
                      setExecDetail({ execKey: key, type: "outstanding" })
                    }
                  />
                  <ExecField
                    icon="groups"
                    label="Farmers"
                    value={String(e.farmers)}
                  />
                  <ExecField
                    icon="agriculture"
                    label="Farms"
                    value={String(e.farms)}
                  />
                  <ExecField icon="spa" label="Crops" value={String(e.crops)} />
                  <ExecField
                    icon="receipt"
                    label="Visits"
                    value={String(e.visits)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {execDetail &&
        createPortal(
          <ExecutiveDetailModal
            selection={execDetail}
            onClose={() => setExecDetail(null)}
          />,
          document.body,
        )}


    </div>
  );
}

function DirectSalesCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  color: "brand" | "blue" | "amber" | "purple";
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    brand: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card
      onClick={onClick}
      className={`p-4 transition-base hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? "cursor-pointer hover:ring-1 hover:ring-brand-200" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 whitespace-nowrap text-[14px] font-bold tracking-tight text-slate-800">
            {value}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
        >
          <Icon name={icon} size={18} />
        </div>
      </div>
    </Card>
  );
}


function DirectSalesDetailModal({
  type,
  dateFilter,
  summary,
  storeName,
  onClose,
}: {
  type: DirectDetailType;
  dateFilter: DateFilter;
  summary: DirectSalesSummary;
  storeName: string;
  onClose: () => void;
}) {
  const dateLabel: Record<DateFilter, string> = {
    today: "Today",
    weekly: "This Week",
    monthly: "This Month",
    quarterly: "This Quarter",
    yearly: "This Year",
  };

  const titles: Record<DirectDetailType, string> = {
    sales: "Direct Sales Details",
    collection: "Direct Collection Details",
    outstanding: "Direct Outstanding Details",
  };

  const icons: Record<DirectDetailType, string> = {
    sales: "payments",
    collection: "account_balance_wallet",
    outstanding: "receipt_long",
  };

  const totalValue =
    type === "sales"
      ? summary.sales
      : type === "collection"
        ? summary.collection
        : summary.outstanding;

  const splitAmount = (total: number, ratios: number[]) => {
    let used = 0;

    return ratios.map((ratio, index) => {
      if (index === ratios.length - 1) return Math.max(0, total - used);

      const amount = Math.round(total * ratio);
      used += amount;
      return amount;
    });
  };

  const farmers = ["Murugan", "Selvam", "Kannan", "Raja"];
  const saleAmounts = splitAmount(summary.sales, [0.34, 0.28, 0.22, 0.16]);
  const collectionAmounts = splitAmount(summary.collection, [
    0.36, 0.27, 0.21, 0.16,
  ]);
  const outstandingAmounts = splitAmount(summary.outstanding, [
    0.38, 0.27, 0.2, 0.15,
  ]);

  const displayDates =
    dateFilter === "today"
      ? ["24 Aug 2026", "24 Aug 2026", "24 Aug 2026", "24 Aug 2026"]
      : ["24 Aug 2026", "22 Aug 2026", "20 Aug 2026", "18 Aug 2026"];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[72vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icons[type]} size={20} />
            </div>

            <div>
              <h3 className="font-bold text-slate-800">{titles[type]}</h3>
              <p className="text-xs text-slate-500">
                {storeName} · {dateLabel[dateFilter]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </span>
            <span className="text-lg font-extrabold text-slate-800">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              {type === "sales" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[7%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[14%] px-4 py-3 text-left">Date</th>
                  <th className="w-[18%] px-4 py-3 text-left">Invoice No</th>
                  <th className="w-[25%] px-4 py-3 text-left">Farmer Name</th>
                  <th className="w-[16%] px-4 py-3 text-left">Sale Type</th>
                  <th className="w-[20%] px-4 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "collection" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[7%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[14%] px-4 py-3 text-left">Date</th>
                  <th className="w-[18%] px-4 py-3 text-left">Receipt No</th>
                  <th className="w-[25%] px-4 py-3 text-left">Farmer Name</th>
                  <th className="w-[16%] px-4 py-3 text-left">Method</th>
                  <th className="w-[20%] px-4 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "outstanding" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[7%] px-4 py-3 text-center">S.No</th>
                  <th className="w-[14%] px-4 py-3 text-left">Date</th>
                  <th className="w-[18%] px-4 py-3 text-left">Invoice No</th>
                  <th className="w-[25%] px-4 py-3 text-left">Farmer Name</th>
                  <th className="w-[16%] px-4 py-3 text-center">Ageing</th>
                  <th className="w-[20%] px-4 py-3 text-right">Outstanding</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {farmers.map((farmer, index) => {
                if (type === "sales") {
                  return (
                    <tr key={`direct-sale-${index}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {displayDates[index]}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {`SAI-INV-${String(1201 + index).padStart(4, "0")}`}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{farmer}</td>
                      <td className="px-4 py-3 text-slate-600">Direct</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {formatCurrency(saleAmounts[index])}
                      </td>
                    </tr>
                  );
                }

                if (type === "collection") {
                  const methods = ["Cash", "UPI", "Cash", "Bank"];

                  return (
                    <tr key={`direct-collection-${index}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {displayDates[index]}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {`SAI-RCP-${String(501 + index).padStart(4, "0")}`}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{farmer}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {methods[index]}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {formatCurrency(collectionAmounts[index])}
                      </td>
                    </tr>
                  );
                }

                const ageing = ["0-30 Days", "0-30 Days", "31-60 Days", "61-90 Days"];

                return (
                  <tr key={`direct-outstanding-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {displayDates[index]}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {`SAI-INV-${String(1181 + index).padStart(4, "0")}`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{farmer}</td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {ageing[index]}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">
                      {formatCurrency(outstandingAmounts[index])}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td colSpan={5} className="px-4 py-3 text-right text-slate-600">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-slate-900">
                  {formatCurrency(totalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function BusinessOverviewCard({
  label,
  value,
  icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: string;
  color: "brand" | "blue" | "amber" | "purple";
  trend: string;
}) {
  const colors: Record<string, string> = {
    brand: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card className="p-4 transition-base hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[14px] font-bold tracking-tight text-slate-800">
            {value}
          </p>
        </div>

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}
        >
          <Icon name={icon} size={16} />
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold leading-tight text-emerald-600">
        {trend}
      </p>
    </Card>
  );
}

function ExecutiveDetailModal({
  selection,
  onClose,
}: {
  selection: Exclude<ExecDetailSelection, null>;
  onClose: () => void;
}) {
  const { execKey, type } = selection;
  const rows = execDetailData[execKey][type];
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  const titles: Record<ExecDetailType, string> = {
    sales: "Sales Details",
    collection: "Collection Details",
    cash: "Cash in Hand Details",
    outstanding: "Outstanding Details",
  };

  const icons: Record<ExecDetailType, string> = {
    sales: "payments",
    collection: "account_balance_wallet",
    cash: "savings",
    outstanding: "receipt_long",
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[72vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icons[type]} size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                {execNames[execKey]} — {titles[type]}
              </h3>
              <p className="text-xs text-slate-500">
                Detailed activity for the selected executive
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              {type === "sales" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Invoice No</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "collection" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Receipt No</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "cash" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}

              {type === "outstanding" && (
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Farmer Name</th>

                  <th className="px-5 py-3 text-left">Village</th>
                  <th className="px-5 py-3 text-left">Phone No</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {type === "sales" &&
                (rows as typeof execDetailData.ram.sales).map((row) => (
                  <tr key={row.invoiceNo} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{row.date}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">
                      {row.invoiceNo}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.farmer}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}

              {type === "collection" &&
                (rows as typeof execDetailData.ram.collection).map((row) => (
                  <tr key={row.receiptNo} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{row.date}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">
                      {row.receiptNo}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.farmer}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}

              {type === "cash" &&
                (rows as typeof execDetailData.ram.cash).map((row, index) => (
                  <tr
                    key={`${row.farmer}-${index}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-slate-600">{row.date}</td>
                    <td className="px-5 py-3 text-slate-700">{row.farmer}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}

              {type === "outstanding" &&
                (rows as typeof execDetailData.ram.outstanding).map(
                  (row, index) => (
                    <tr
                      key={`${row.farmer}-${index}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 text-slate-600">{row.date}</td>
                      <td className="px-5 py-3 text-slate-700">{row.farmer}</td>

                      <td className="px-5 py-3 text-slate-600">
                        {row.village}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{row.phone}</td>
                      <td className="px-5 py-3 text-right font-bold text-amber-700">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ),
                )}
            </tbody>

            <tfoot className="sticky bottom-0 z-10">
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td
                  colSpan={type === "outstanding" ? 4 : type === "cash" ? 2 : 3}
                  className="px-5 py-4 text-right text-sm font-bold text-slate-600"
                >
                  Total
                </td>

                <td className="px-5 py-4 text-right text-base font-bold tabular-nums text-amber-700">
                  {formatCurrency(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
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
    <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto max-w-full">
      {filterTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-base whitespace-nowrap ${
            value === tab.key
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ExecutiveTargetBadge({
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
  const tone: Record<string, string> = {
    brand: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };

  return (
    <div
      className={`min-w-[118px] rounded-lg border px-2.5 py-1.5 ${tone[color]}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon name={icon} size={13} />
        <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">
          {label}
        </span>
      </div>

      <div className="mt-0.5">
        <span className="text-xs font-bold">{value}</span>
      </div>
    </div>
  );
}

function ExecField({
  icon,
  label,
  value,
  color = "text-slate-800",
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50/70 transition ${
        onClick
          ? "cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5"
          : "cursor-default"
      }`}
    >
      <Icon name={icon} size={15} className="text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">
          {label}
        </p>
        <p className={`text-sm font-bold leading-tight ${color} truncate`}>
          {value}
        </p>
      </div>
    </button>
  );
}
