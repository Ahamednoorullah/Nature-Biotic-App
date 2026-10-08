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
import {
  readNotificationReads,
  saveNotificationReads,
  readCompanyUserSettings,
  resolveStoreTheme,
  type StoreUserSettings,
} from "@/lib/storeSettings";
import CompanyMobileHub, {
  type CompanyMobileHubSection,
} from "@/components/CompanyMobileHub";

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
  { key: "refund", label: "Refund", icon: "currency_exchange" },
  { key: "reports", label: "Reports", icon: "bar_chart" },
];

type BottomTabId = "home" | "products" | "stores" | "sales" | "more";

const bottomTabs: { id: BottomTabId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "products", label: "Products", icon: "inventory_2" },
  { id: "stores", label: "Stores", icon: "storefront" },
  { id: "sales", label: "Sales", icon: "point_of_sale" },
  { id: "more", label: "More", icon: "grid_view" },
];

function formatPageTitle(page: CompanyPage): string {
  switch (page) {
    case "dashboard":
      return "Dashboard";
    case "products":
      return "Products";
    case "stores":
      return "Stores";
    case "sales":
      return "Sales Invoices";
    case "sales-return":
      return "Sales Return";
    case "expenses":
      return "Expenses";
    case "purchase-orders":
      return "Purchase Orders";
    case "staff-management":
      return "Staff Management";
    case "credit-notes":
      return "Credit Notes";
    case "receipts":
      return "Receipts";
    case "refund":
      return "Refund";
    case "reports":
      return "Reports";
    case "settings":
      return "Settings";
    default:
      return page;
  }
}

export default function CompanyShell({
  children,
  active,
}: {
  children: ReactNode;
  active: CompanyPage;
}) {
  const { user, signOut } = useAuth();
  const { goCompany } = useNav();
  const [mobileSectionHub, setMobileSectionHub] =
    useState<CompanyMobileHubSection | null>(null);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<"profile" | "notifications" | null>(
    null,
  );

  const [settings, setSettings] = useState<StoreUserSettings>(() =>
    readCompanyUserSettings(user?.id),
  );
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setSettings(readCompanyUserSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const onThemeUpdate = () => {
      setSettings(readCompanyUserSettings(user?.id));
    };
    window.addEventListener("nature-biotic-company-theme-updated", onThemeUpdate);
    window.addEventListener("storage", onThemeUpdate);
    return () => {
      window.removeEventListener(
        "nature-biotic-company-theme-updated",
        onThemeUpdate,
      );
      window.removeEventListener("storage", onThemeUpdate);
    };
  }, [user?.id]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [settings.theme]);

  const resolvedTheme =
    settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : resolveStoreTheme(settings.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("nb-dark", resolvedTheme === "dark");
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);
  const [pendingApprovals, setPendingApprovals] = useState<
    StoreApprovalRequest[]
  >([]);
  const [reads, setReads] = useState<string[]>([]);

  // Reset mobile hub when navigating away to distinct pages
  useEffect(() => {
    if (active === "dashboard" || active === "products" || active === "stores") {
      setMobileSectionHub(null);
    }
    setTabletDrawerOpen(false);
  }, [active]);

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

  useEffect(() => {
    if (!user?.id) return;
    setReads(readNotificationReads(user.id, "company"));
  }, [user?.id]);

  const unreadApprovals = pendingApprovals.filter(
    (request) => !reads.includes(request.id),
  );
  const unreadCount = unreadApprovals.length;

  function markNotificationRead(id: string) {
    if (!user?.id) return;
    setReads((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      saveNotificationReads(user.id, "company", next);
      return next;
    });
  }

  // Determine active bottom tab for mobile
  const activeBottomTab: BottomTabId = mobileSectionHub
    ? mobileSectionHub === "sales"
      ? "sales"
      : "more"
    : active === "dashboard"
      ? "home"
      : active === "products"
        ? "products"
        : active === "stores"
          ? "stores"
          : active === "sales" ||
              active === "sales-return" ||
              active === "receipts" ||
              active === "credit-notes"
            ? "sales"
            : "more";

  return (
    <div
      className={`flex min-h-screen overflow-x-clip ${
        resolvedTheme === "dark"
          ? "nb-dark dark bg-slate-950 text-slate-100"
          : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* TABLET LANDSCAPE & DESKTOP DOCKED SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex-col border-r border-slate-100 bg-white ${
          sidebarCollapsed ? "hidden xl:flex" : "hidden lg:flex"
        } xl:flex w-64`}
      >
        <SidebarContent
          active={active}
          onNavigate={(p) => {
            setMobileSectionHub(null);
            goCompany(p);
          }}
          onSignOut={signOut}
        />
      </aside>

      {/* TABLET DRAWER (600px to 1023px, sm: to lg:) */}
      {tabletDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setTabletDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,82vw)] flex-col bg-white shadow-2xl animate-slide-in-right">
            <SidebarContent
              active={active}
              onNavigate={(p) => {
                setTabletDrawerOpen(false);
                setMobileSectionHub(null);
                goCompany(p);
              }}
              onSignOut={signOut}
              onClose={() => setTabletDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ${
          sidebarCollapsed ? "lg:ml-0 xl:ml-64" : "lg:ml-64 xl:ml-64"
        } ml-0`}
      >
        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
          {/* MOBILE HEADER — compact app-style header, sm:hidden (< 600px) */}
          <div className="flex h-14 items-center justify-between px-3.5 sm:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.png"
                alt="Nature Biotic"
                className="h-7 w-auto object-contain shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  Nature Biotic
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate leading-none mt-0.5">
                  Admin Portal
                </p>
              </div>
            </div>

            <div
              data-header-menu
              className="relative z-[10000] ml-auto flex items-center gap-1.5 shrink-0"
            >
              <button
                type="button"
                aria-label="Notifications"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "notifications" ? null : "notifications",
                  )
                }
                className="relative rounded-xl p-2 text-slate-600 transition active:scale-95 hover:bg-slate-100"
              >
                <Icon name="notifications" size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand-600 px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-label="Settings"
                onClick={() => {
                  setOpenMenu(null);
                  setMobileSectionHub(null);
                  goCompany("settings");
                }}
                className={`rounded-xl p-2 transition active:scale-95 hover:bg-slate-100 ${
                  active === "settings" && !mobileSectionHub
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600"
                }`}
              >
                <Icon name="settings" size={20} />
              </button>

              <button
                type="button"
                aria-label="Profile menu"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "profile" ? null : "profile",
                  )
                }
                className="flex items-center transition active:scale-95"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white ring-2 ring-brand-100">
                  {(user?.name ?? "A").charAt(0).toUpperCase()}
                </div>
              </button>
            </div>
          </div>

          {/* TABLET & DESKTOP HEADER — hidden sm:flex (>= 600px) */}
          <div className="hidden h-16 items-center gap-3 px-4 sm:flex sm:gap-4 sm:px-6">
            {/* Tablet Menu Drawer Toggle (600px to 1023px, lg:hidden) */}
            <button
              type="button"
              onClick={() => setTabletDrawerOpen(true)}
              className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
              title="Open menu"
            >
              <Icon name="menu" size={24} />
            </button>

            {/* Tablet Landscape Collapse Toggle (1024px to 1279px, lg:block xl:hidden) */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 lg:block xl:hidden"
              aria-label="Toggle sidebar"
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <Icon name={sidebarCollapsed ? "menu" : "menu_open"} size={22} />
            </button>

            {/* Tablet Logo (visible when docked sidebar is hidden) */}
            <div
              className={`items-center lg:hidden ${
                sidebarCollapsed ? "lg:flex" : ""
              }`}
            >
              <img
                src="/logo.png"
                alt="Nature Biotic"
                className="h-8 w-auto object-contain"
              />
            </div>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-slate-700 truncate">
                Nature Biotic Admin Portal
              </span>
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
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-label="Settings"
                onClick={() => {
                  setOpenMenu(null);
                  setMobileSectionHub(null);
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
                  {(user?.name ?? "A").charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-700">
                    {user?.name || "Administrator"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {user?.roleLabel || "Company Administrator"}
                  </p>
                </div>
                <Icon
                  name="expand_more"
                  size={18}
                  className="hidden text-slate-400 sm:block"
                />
              </button>
            </div>
          </div>

          {/* SHARED DROPDOWN MENUS (Notifications, Profile) */}
          <div data-header-menu className="relative">
            {openMenu === "notifications" && (
              <div className="absolute right-2 sm:right-6 top-1 z-[80] max-h-[min(24rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">
                    Notifications
                  </p>
                  <p className="text-xs text-slate-500">{unreadCount} unread</p>
                </div>
                {unreadApprovals.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">
                    No pending notifications.
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {unreadApprovals.map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        data-notification-id={request.id}
                        onClick={() => {
                          markNotificationRead(request.id);
                          setOpenMenu(null);
                          setMobileSectionHub(null);
                          goCompany(
                            request.type === "Purchase Return"
                              ? "sales-return"
                              : "purchase-orders",
                          );
                        }}
                        className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${
                          reads.includes(request.id) ? "" : "bg-brand-50/40"
                        }`}
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
                          {request.date ? ` · ${formatDate(request.date)}` : ""}
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
              <div className="absolute right-2 sm:right-6 top-1 z-[80] w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {(user?.name ?? "A").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {user?.name || "Administrator"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user?.email || "admin@naturebiotic.com"}
                      </p>
                      <span className="mt-1 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                        {user?.roleLabel || "Company Administrator"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setMobileSectionHub(null);
                      goCompany("reports");
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                        <Icon name="bar_chart" size={17} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Reports</p>
                        <p className="text-[10px] text-slate-400">
                          Company analytics & summaries
                        </p>
                      </div>
                    </div>
                    <Icon
                      name="chevron_right"
                      size={16}
                      className="text-slate-400"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setMobileSectionHub(null);
                      goCompany("settings");
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Icon name="settings" size={17} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Settings</p>
                        <p className="text-[10px] text-slate-400">
                          Preferences & company details
                        </p>
                      </div>
                    </div>
                    <Icon
                      name="chevron_right"
                      size={16}
                      className="text-slate-400"
                    />
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <Icon name="logout" size={17} />
                    </div>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-3 pb-28 sm:p-6 sm:pb-8 lg:p-8 lg:pb-8">
          {/* Mobile Section Hub (Sales or More on < 600px mobile screens) */}
          {mobileSectionHub ? (
            <>
              <div className="sm:hidden">
                <CompanyMobileHub
                  section={mobileSectionHub}
                  onNavigate={(page) => {
                    setMobileSectionHub(null);
                    goCompany(page);
                  }}
                />
              </div>
              <div className="hidden sm:block">
                <div key={active} className="animate-fade-in">
                  {children}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Inner page back bar for mobile (when not on dashboard, < 600px) */}
              {active !== "dashboard" && (
                <div className="mb-3.5 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-xs sm:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        active === "sales" ||
                        active === "sales-return" ||
                        active === "receipts" ||
                        active === "credit-notes"
                      ) {
                        setMobileSectionHub("sales");
                      } else if (
                        active === "purchase-orders" ||
                        active === "staff-management" ||
                        active === "expenses" ||
                        active === "refund" ||
                        active === "reports" ||
                        active === "settings"
                      ) {
                        setMobileSectionHub("more");
                      } else {
                        setMobileSectionHub(null);
                        goCompany("dashboard");
                      }
                    }}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 transition active:scale-95 hover:text-brand-700"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon name="arrow_back" size={16} />
                    </div>
                    <span>
                      Back to{" "}
                      {active === "sales" ||
                      active === "sales-return" ||
                      active === "receipts" ||
                      active === "credit-notes"
                        ? "Sales"
                        : active === "purchase-orders" ||
                            active === "staff-management" ||
                            active === "expenses" ||
                            active === "refund" ||
                            active === "reports" ||
                            active === "settings"
                          ? "More"
                          : "Home"}
                    </span>
                  </button>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 capitalize">
                    {formatPageTitle(active)}
                  </span>
                </div>
              )}
              <div key={active} className="animate-fade-in">
                {children}
              </div>
            </>
          )}
        </main>

        {/* MOBILE BOTTOM NAVIGATION — sm:hidden (< 600px only) */}
        <nav
          aria-label="Mobile Navigation"
          className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.6rem,env(safe-area-inset-bottom,0.6rem))] pt-1.5"
        >
          <div className="grid grid-cols-5 items-center px-1">
            {bottomTabs.map((tab) => {
              const isActive = activeBottomTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id === "home") {
                      setMobileSectionHub(null);
                      goCompany("dashboard");
                    } else if (tab.id === "products") {
                      setMobileSectionHub(null);
                      goCompany("products");
                    } else if (tab.id === "stores") {
                      setMobileSectionHub(null);
                      goCompany("stores");
                    } else if (tab.id === "sales") {
                      setMobileSectionHub("sales");
                    } else if (tab.id === "more") {
                      setMobileSectionHub("more");
                    }
                  }}
                  className={`group flex flex-col items-center justify-center py-1 px-1 transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "text-brand-700 font-semibold"
                      : "text-slate-500 hover:text-slate-800 font-normal"
                  }`}
                >
                  <div
                    className={`flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-brand-50 text-brand-700 scale-105 shadow-xs"
                        : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    <Icon
                      name={tab.icon}
                      size={22}
                      className={
                        isActive ? "text-brand-700 font-bold" : "text-slate-500"
                      }
                    />
                  </div>
                  <span
                    className={`mt-0.5 text-[10px] leading-tight tracking-tight truncate max-w-full ${
                      isActive
                        ? "font-bold text-brand-700"
                        : "font-medium text-slate-500"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
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
      <div className="flex items-center justify-center px-5 h-16 border-b border-slate-100 dark:border-slate-800 shrink-0 relative">
        <div className="rounded-xl bg-white/95 px-3 py-1 shadow-xs inline-flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Nature Biotic"
            className="h-10 w-auto object-contain"
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 lg:hidden"
            aria-label="Close menu"
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
