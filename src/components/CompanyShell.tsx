import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNav, type CompanyPage } from "@/context/NavContext";
import { Icon } from "@/components/ui";
import {
  getStoreApprovalRequests,
  storeApprovalRequestsUpdatedEvent,
  type StoreApprovalRequest,
} from "@/lib/data";
import { formatDate } from "@/lib/format";

const navItems: { key: CompanyPage; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "products", label: "Product Management", icon: "inventory_2" },
  { key: "stores", label: "Store Management", icon: "storefront" },

  { key: "staff-management", label: "Staff Management", icon: "badge" },
  {
    key: "purchase-orders",
    label: "Purchase Orders",
    icon: "shopping_cart_checkout",
  },
  { key: "sales", label: "Sales ", icon: "point_of_sale" },
  { key: "sales-return", label: "Sales Return", icon: "assignment_return" },
  { key: "expenses", label: "Expenses ", icon: "receipt_long" },
  { key: "credit-notes", label: "Credit Notes", icon: "undo" },
  { key: "receipts", label: "Receipts", icon: "receipt" },
  { key: "reports", label: "Reports", icon: "bar_chart" },
];

export default function CompanyShell({
  children,
  active,
}: {
  children: ReactNode;
  active: CompanyPage;
}) {
  const { user, signOut } = useAuth();
  const { goCompany } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<"profile" | "notifications" | null>(
    null,
  );
  const [pendingApprovals, setPendingApprovals] = useState<
    StoreApprovalRequest[]
  >([]);

  useEffect(() => {
    const refresh = () =>
      setPendingApprovals(
        getStoreApprovalRequests().filter(
          (request) =>
            (request.type === "Purchase Order" ||
              request.type === "Purchase Return") &&
            request.status === "Pending",
        ),
      );
    refresh();
    window.addEventListener(storeApprovalRequestsUpdatedEvent, refresh);
    window.addEventListener("store-purchase-orders-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(storeApprovalRequestsUpdatedEvent, refresh);
      window.removeEventListener("store-purchase-orders-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-header-menu]")) return;
      setOpenMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openMenu]);

  return (
    <div className="flex min-h-screen overflow-x-clip bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-100 bg-white lg:flex">
        <SidebarContent
          active={active}
          onNavigate={(p) => goCompany(p)}
          onSignOut={signOut}
        />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(16rem,86vw)] flex-col bg-white animate-slide-in-right">
            <SidebarContent
              active={active}
              onNavigate={(p) => {
                goCompany(p);
                setMobileOpen(false);
              }}
              onSignOut={signOut}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2.5 transition-base hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" size={24} />
            </button>

            {/* Logo in navbar — mobile only */}
            <div className="lg:hidden">
              <img
                src="/logo.png"
                alt="Nature Biotic"
                className="h-8 w-auto object-contain"
              />
            </div>

            <div
              data-header-menu
              className="relative z-[10000] ml-auto flex items-center gap-1 sm:gap-2"
            >
              <button
                type="button"
                aria-label="Notifications"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "notifications" ? null : "notifications",
                  )
                }
                className="relative rounded-xl p-2.5 transition-base hover:bg-slate-100"
              >
                <Icon
                  name="notifications"
                  size={22}
                  className="text-slate-600"
                />
                {pendingApprovals.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {pendingApprovals.length > 9
                      ? "9+"
                      : pendingApprovals.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-label="Settings"
                onClick={() => {
                  setOpenMenu(null);
                  goCompany("settings");
                }}
                className={`rounded-xl p-2.5 transition-base hover:bg-slate-100 ${
                  active === "settings" ? "bg-brand-50 text-brand-700" : ""
                }`}
              >
                <Icon
                  name="settings"
                  size={22}
                  className={
                    active === "settings" ? "text-brand-700" : "text-slate-600"
                  }
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "profile" ? null : "profile",
                  )
                }
                className="flex items-center gap-2.5 rounded-xl py-1 pl-2 transition-base hover:bg-slate-100 sm:pl-3 sm:pr-1"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {(user?.name ?? "U").charAt(0)}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-700">
                    {user?.name || "Administrator"}
                  </p>
                </div>
                <Icon
                  name="expand_more"
                  size={18}
                  className="hidden text-slate-400 sm:block"
                />
              </button>

              {openMenu === "notifications" && (
                <div className="absolute right-0 top-12 z-[10001] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">
                      Notifications
                    </p>
                    <p className="text-xs text-slate-500">
                      {pendingApprovals.length} pending
                    </p>
                  </div>
                  {pendingApprovals.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">
                      No pending notifications.
                    </p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {pendingApprovals.map((request) => (
                        <button
                          key={request.id}
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            goCompany(
                              request.type === "Purchase Return"
                                ? "sales-return"
                                : "purchase-orders",
                            );
                          }}
                          className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                            {request.type === "Purchase Return"
                              ? "Sales Return Request"
                              : "Purchase Order"}
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {request.referenceNo}
                          </p>
                          <p className="text-xs text-slate-500">
                            {request.storeName}
                            {request.date
                              ? ` · ${formatDate(request.date)}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            {request.type === "Purchase Return"
                              ? "Pending Approval"
                              : "Pending Acceptance"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {openMenu === "profile" && (
                <div className="absolute right-0 top-12 z-[10001] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">
                      {user?.name || "Administrator"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user?.roleLabel || "Company Administrator"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon name="logout" size={18} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-6 lg:p-8">
          <div key={active} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  active,
  onNavigate,
  onSignOut,
  onClose,
}: {
  active: CompanyPage;
  onNavigate: (p: CompanyPage) => void;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-center px-5 h-16 border-b border-slate-100 shrink-0 relative">
        <img
          src="/logo.png"
          alt="Nature Biotic"
          className="h-12 w-auto object-contain"
        />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 p-1.5 rounded-lg hover:bg-slate-100 lg:hidden"
          >
            <Icon name="close" size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-base ${
              active === item.key
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon name={item.icon} size={22} fill={active === item.key} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100 shrink-0">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-base"
        >
          <Icon name="logout" size={22} />
          Sign Out
        </button>
      </div>
    </>
  );
}
