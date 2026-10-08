import { Icon } from "@/components/ui";
import type { StorePage } from "@/context/NavContext";

export type MobileHubSection = "purchases" | "stock" | "sales" | "attendance";

type HubItem = {
  key: string;
  page: StorePage;
  label: string;
  desc: string;
  icon: string;
  colorClass: string;
};

type SectionMeta = {
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  items: HubItem[];
};

const SECTION_DATA: Record<MobileHubSection, SectionMeta> = {
  sales: {
    title: "Sales",
    subtitle: "Invoices, quotations, farmers & collections",
    badge: "8 Tools",
    icon: "sell",
    items: [
      {
        key: "farmers",
        page: "farmers",
        label: "Farmer",
        desc: "Farmer directory & records",
        icon: "groups",
        colorClass: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "quotation",
        page: "quotation",
        label: "Quotation",
        desc: "Create & send price quotes",
        icon: "description",
        colorClass: "bg-sky-50 text-sky-700",
      },
      {
        key: "sales-invoice",
        page: "sales-invoice",
        label: "Sales Invoice",
        desc: "Create & print bills",
        icon: "receipt_long",
        colorClass: "bg-brand-50 text-brand-700",
      },
      {
        key: "sales-return",
        page: "sales-return",
        label: "Sales Return",
        desc: "Customer sales returns",
        icon: "assignment_return",
        colorClass: "bg-amber-50 text-amber-700",
      },
      {
        key: "credit-notes",
        page: "credit-notes",
        label: "Credit Note",
        desc: "Issue credit balance",
        icon: "request_quote",
        colorClass: "bg-purple-50 text-purple-700",
      },
      {
        key: "receipt",
        page: "receipt",
        label: "Receipt",
        desc: "Collection & receipts",
        icon: "receipt",
        colorClass: "bg-blue-50 text-blue-700",
      },
      {
        key: "refund",
        page: "refund",
        label: "Refund",
        desc: "Process customer refunds",
        icon: "currency_exchange",
        colorClass: "bg-rose-50 text-rose-700",
      },
      {
        key: "sales",
        page: "sales",
        label: "Sales Overview",
        desc: "Direct vs executive sales",
        icon: "point_of_sale",
        colorClass: "bg-teal-50 text-teal-700",
      },
    ],
  },
  purchases: {
    title: "Purchases",
    subtitle: "Orders, goods inward, returns & payments",
    badge: "6 Tools",
    icon: "shopping_cart",
    items: [
      {
        key: "purchase-order",
        page: "purchase-order",
        label: "Purchase Order",
        desc: "Raise orders to Nature Biotic",
        icon: "description",
        colorClass: "bg-blue-50 text-blue-700",
      },
      {
        key: "purchases",
        page: "purchases",
        label: "Purchase Bills",
        desc: "Inward invoices & stock",
        icon: "shopping_cart",
        colorClass: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "return-stock",
        page: "return-stock",
        label: "Purchase Return",
        desc: "Return goods to company",
        icon: "assignment_return",
        colorClass: "bg-amber-50 text-amber-700",
      },
      {
        key: "debit-notes",
        page: "debit-notes",
        label: "Debit Notes",
        desc: "Manage debit balances",
        icon: "request_quote",
        colorClass: "bg-purple-50 text-purple-700",
      },
      {
        key: "payments",
        page: "payments",
        label: "Payment",
        desc: "Record supplier payments",
        icon: "payments",
        colorClass: "bg-teal-50 text-teal-700",
      },
      {
        key: "expenses",
        page: "expenses",
        label: "Expenses",
        desc: "Store operational costs",
        icon: "receipt_long",
        colorClass: "bg-rose-50 text-rose-700",
      },
    ],
  },
  stock: {
    title: "Stock Management",
    subtitle: "Inventory balance, challans & stock audits",
    badge: "8 Tools",
    icon: "inventory_2",
    items: [
      {
        key: "stock-management",
        page: "stock-management",
        label: "Stock Overview",
        desc: "Current stock & valuation",
        icon: "inventory_2",
        colorClass: "bg-brand-50 text-brand-700",
      },
      {
        key: "delivery-challan",
        page: "delivery-challan",
        label: "Stock Delivery",
        desc: "Issue stock to FRO staff",
        icon: "local_shipping",
        colorClass: "bg-blue-50 text-blue-700",
      },
      {
        key: "return-challan",
        page: "return-challan",
        label: "Stock Return",
        desc: "Returns received from FRO",
        icon: "assignment_return",
        colorClass: "bg-amber-50 text-amber-700",
      },
      {
        key: "closing-stock",
        page: "closing-stock",
        label: "Closing Stock",
        desc: "Daily & monthly closing",
        icon: "calendar_month",
        colorClass: "bg-purple-50 text-purple-700",
      },
      {
        key: "physical-stock",
        page: "physical-stock",
        label: "Physical Stock",
        desc: "Physical inventory audit",
        icon: "fact_check",
        colorClass: "bg-teal-50 text-teal-700",
      },
      {
        key: "low-stock",
        page: "low-stock",
        label: "Low Stock Alert",
        desc: "Items below reorder level",
        icon: "warning",
        colorClass: "bg-rose-50 text-rose-700",
      },
      {
        key: "stock-adjustment",
        page: "stock-adjustment",
        label: "Stock Adjustment",
        desc: "Manual balance corrections",
        icon: "tune",
        colorClass: "bg-indigo-50 text-indigo-700",
      },
      {
        key: "add-stock",
        page: "add-stock",
        label: "Add Stock",
        desc: "Direct stock inward entry",
        icon: "add_box",
        colorClass: "bg-emerald-50 text-emerald-700",
      },
    ],
  },
  attendance: {
    title: "Staff Attendance",
    subtitle: "Track staff presence, time logging & records",
    badge: "4 Tools",
    icon: "badge",
    items: [
      {
        key: "daily-attendance",
        page: "attendance",
        label: "Daily Attendance",
        desc: "View & record attendance",
        icon: "badge",
        colorClass: "bg-brand-50 text-brand-700",
      },
      {
        key: "check-in-out",
        page: "attendance",
        label: "Check In / Out",
        desc: "Quick staff time logging",
        icon: "timer",
        colorClass: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "staff-records",
        page: "attendance",
        label: "Staff Records",
        desc: "Working duration & status",
        icon: "groups",
        colorClass: "bg-blue-50 text-blue-700",
      },
      {
        key: "attendance-history",
        page: "attendance",
        label: "Attendance History",
        desc: "Monthly attendance logs",
        icon: "history",
        colorClass: "bg-purple-50 text-purple-700",
      },
    ],
  },
};

export default function StoreMobileSectionHub({
  section,
  onNavigate,
}: {
  section: MobileHubSection;
  onNavigate: (page: StorePage) => void;
}) {
  const meta = SECTION_DATA[section] || SECTION_DATA.sales;

  return (
    <div className="animate-fade-in pb-8">
      {/* Header Banner */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {meta.title}
            </h1>
            <span className="rounded-full bg-brand-50 dark:bg-brand-950/70 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:text-brand-300">
              {meta.badge}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* 2-Column Grid of Feature Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
        {meta.items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.page)}
            className="group flex min-h-[124px] flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-left shadow-xs transition-all active:scale-[0.98] hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:p-4"
          >
            <div className="flex w-full items-start justify-between">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${item.colorClass}`}
              >
                <Icon name={item.icon} size={22} />
              </div>
              <div className="mt-1 text-slate-300 dark:text-slate-600 transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
                <Icon name="arrow_forward" size={16} />
              </div>
            </div>

            <div className="mt-3">
              <h3 className="text-sm font-bold leading-tight tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                {item.label}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-[11px] font-normal text-slate-400 dark:text-slate-400">
                {item.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
