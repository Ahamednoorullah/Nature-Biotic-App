import { Icon } from "@/components/ui";
import type { CompanyPage } from "@/context/NavContext";

export type CompanyMobileHubSection = "sales" | "more";

type HubItem = {
  key: string;
  page: CompanyPage;
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

const SECTION_DATA: Record<CompanyMobileHubSection, SectionMeta> = {
  sales: {
    title: "Sales Hub",
    subtitle: "Invoices, returns, collections & credit notes",
    badge: "4 Modules",
    icon: "point_of_sale",
    items: [
      {
        key: "sales",
        page: "sales",
        label: "Sales Invoices",
        desc: "Create & view bills",
        icon: "receipt_long",
        colorClass: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "sales-return",
        page: "sales-return",
        label: "Sales Return",
        desc: "Store & party returns",
        icon: "assignment_return",
        colorClass: "bg-amber-50 text-amber-700",
      },
      {
        key: "receipts",
        page: "receipts",
        label: "Receipts",
        desc: "Collections & payments",
        icon: "receipt",
        colorClass: "bg-blue-50 text-blue-700",
      },
      {
        key: "credit-notes",
        page: "credit-notes",
        label: "Credit Notes",
        desc: "Issue & track credit",
        icon: "undo",
        colorClass: "bg-purple-50 text-purple-700",
      },
    ],
  },
  more: {
    title: "More Modules",
    subtitle: "Administration, staff, orders, expenses & reports",
    badge: "9 Modules",
    icon: "grid_view",
    items: [
      {
        key: "purchase-orders",
        page: "purchase-orders",
        label: "Purchase Orders",
        desc: "Store orders & approvals",
        icon: "shopping_cart_checkout",
        colorClass: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "staff-management",
        page: "staff-management",
        label: "Staff Management",
        desc: "Team & executives",
        icon: "badge",
        colorClass: "bg-teal-50 text-teal-700",
      },
      {
        key: "expenses",
        page: "expenses",
        label: "Expenses",
        desc: "Operational spending",
        icon: "receipt_long",
        colorClass: "bg-rose-50 text-rose-700",
      },
      {
        key: "credit-notes",
        page: "credit-notes",
        label: "Credit Notes",
        desc: "Customer credit notes",
        icon: "undo",
        colorClass: "bg-purple-50 text-purple-700",
      },
      {
        key: "receipts",
        page: "receipts",
        label: "Receipts",
        desc: "Payment collections",
        icon: "receipt",
        colorClass: "bg-blue-50 text-blue-700",
      },
      {
        key: "refund",
        page: "refund",
        label: "Refund",
        desc: "Store & party refunds",
        icon: "currency_exchange",
        colorClass: "bg-amber-50 text-amber-700",
      },
      {
        key: "sales-return",
        page: "sales-return",
        label: "Sales Return",
        desc: "Store return requests",
        icon: "assignment_return",
        colorClass: "bg-orange-50 text-orange-700",
      },
      {
        key: "reports",
        page: "reports",
        label: "Reports",
        desc: "Performance & analytics",
        icon: "bar_chart",
        colorClass: "bg-indigo-50 text-indigo-700",
      },
      {
        key: "settings",
        page: "settings",
        label: "Settings",
        desc: "Account & preferences",
        icon: "settings",
        colorClass: "bg-slate-100 text-slate-700",
      },
    ],
  },
};

export default function CompanyMobileHub({
  section,
  onNavigate,
}: {
  section: CompanyMobileHubSection;
  onNavigate: (page: CompanyPage) => void;
}) {
  const data = SECTION_DATA[section];

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={data.icon} size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  {data.title}
                </h1>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  {data.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{data.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Card Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {data.items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.page)}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-xs transition duration-150 active:scale-95 hover:border-brand-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${item.colorClass}`}
              >
                <Icon name={item.icon} size={20} />
              </div>
              <Icon
                name="arrow_forward"
                size={16}
                className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
              />
            </div>

            <div className="mt-3">
              <h3 className="text-xs font-bold text-slate-800 leading-tight">
                {item.label}
              </h3>
              <p className="mt-1 text-[10px] text-slate-400 font-medium line-clamp-1">
                {item.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
