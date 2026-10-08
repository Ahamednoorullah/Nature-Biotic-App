import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getStore } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav, type StorePage } from "@/context/NavContext";
import { Icon, Input } from "@/components/ui";
import { changeAccountPassword } from "@/lib/auth/localAuth";
import { getStoreNotifications } from "@/lib/storeNotifications";
import StoreMobileSectionHub from "./StoreMobileSectionHub";
import {
  readNotificationReads,
  readStoreUserSettings,
  resolveStoreTheme,
  saveNotificationReads,
  saveStoreUserSettings,
  type StoreThemeChoice,
  type StoreUserSettings,
} from "@/lib/storeSettings";

type SubItem = { key: StorePage; label: string; icon: string };
type NavItem =
  | { type: "link"; key: StorePage; label: string; icon: string }
  | {
      type: "group";
      key: "purchases" | "stock-management" | "sales";
      label: string;
      icon: string;
      children: SubItem[];
    };

const navItems: NavItem[] = [
  { type: "link", key: "dashboard", label: "Dashboard", icon: "dashboard" },
  {
    type: "group",
    key: "purchases",
    label: "Purchases",
    icon: "shopping_cart",
    children: [
      { key: "purchase-order", label: "Purchase Order", icon: "description" },
      { key: "purchases", label: "Purchase Bills", icon: "shopping_cart" },
      {
        key: "return-stock",
        label: "Purchase Return",
        icon: "assignment_return",
      },
      { key: "debit-notes", label: "Debit Notes", icon: "request_quote" },
      { key: "payments", label: "Payment", icon: "payments" },
      { key: "expenses", label: "Expenses", icon: "receipt_long" },
    ],
  },
  {
    type: "group",
    key: "stock-management",
    label: "Stock Management",
    icon: "inventory_2",
    children: [
      {
        key: "stock-management",
        label: "Stock Overview",
        icon: "inventory_2",
      },
      {
        key: "delivery-challan",
        label: "Stock Delivery",
        icon: "local_shipping",
      },
      {
        key: "return-challan",
        label: "Stock Return",
        icon: "assignment_return",
      },
      {
        key: "closing-stock",
        label: "Closing Stock",
        icon: "calendar_month",
      },
      {
        key: "physical-stock",
        label: "Physical Stock",
        icon: "fact_check",
      },
    ],
  },
  {
    type: "group",
    key: "sales",
    label: "Sales",
    icon: "sell",
    children: [
      { key: "farmers", label: "Farmer", icon: "groups" },
      { key: "quotation", label: "Quotation", icon: "description" },

      { key: "sales-invoice", label: "Sales Invoice", icon: "receipt_long" },
      { key: "sales-return", label: "Sales Return", icon: "assignment_return" },
      { key: "credit-notes", label: "Credit Note", icon: "request_quote" },
      { key: "receipt", label: "Receipt", icon: "receipt" },
      { key: "refund", label: "Refund", icon: "currency_exchange" },
    ],
  },
  { type: "link", key: "attendance", label: "Attendance", icon: "badge" },
  { type: "link", key: "reports", label: "Reports", icon: "bar_chart" },
];

const salesSubpages = new Set<StorePage>([
  "sales",
  "farmers",
  "quotation",
  "sales-invoice",
  "sales-return",
  "credit-notes",
  "receipt",
  "refund",
  "add-farmer",
  "farmer-profile",
]);

const purchasesSubpages = new Set<StorePage>([
  "purchases",
  "purchase-order",
  "return-stock",
  "debit-notes",
  "payments",
  "expenses",
]);

const stockSubpages = new Set<StorePage>([
  "stock-management",
  "delivery-challan",
  "return-challan",
  "closing-stock",
  "physical-stock",
  "low-stock",
  "stock-adjustment",
  "add-stock",
  "inventory-detail",
]);

const attendanceSubpages = new Set<StorePage>(["attendance"]);

function formatPageTitle(page: StorePage): string {
  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    purchases: "Purchase Bills",
    "purchase-order": "Purchase Order",
    "return-stock": "Purchase Return",
    "debit-notes": "Debit Notes",
    payments: "Payments",
    expenses: "Expenses",
    "stock-management": "Stock Overview",
    "delivery-challan": "Stock Delivery",
    "return-challan": "Stock Return",
    "closing-stock": "Closing Stock",
    "physical-stock": "Physical Stock",
    "low-stock": "Low Stock Alert",
    "stock-adjustment": "Stock Adjustment",
    "add-stock": "Add Stock",
    "inventory-detail": "Inventory Detail",
    sales: "Sales Overview",
    farmers: "Farmers",
    "add-farmer": "Add Farmer",
    "farmer-profile": "Farmer Profile",
    quotation: "Quotation",
    "sales-invoice": "Sales Invoice",
    "sales-return": "Sales Return",
    "credit-notes": "Credit Notes",
    receipt: "Receipt",
    refund: "Refund",
    attendance: "Attendance",
    reports: "Reports",
  };
  return titles[page] || page.replace(/-/g, " ");
}

const bottomTabs = [
  { id: "home" as const, label: "Home", icon: "home" },
  { id: "purchases" as const, label: "Purchase", icon: "shopping_cart" },
  { id: "stock" as const, label: "Stock", icon: "inventory_2" },
  { id: "sales" as const, label: "Sales", icon: "point_of_sale" },
  { id: "attendance" as const, label: "Attendance", icon: "badge" },
];

const groupKeys = ["purchases", "stock-management", "sales"] as const;

function activeGroupFor(
  page: StorePage,
): "purchases" | "stock-management" | "sales" | null {
  if (page === "purchases") return "purchases";
  if (page === "stock-management") return "stock-management";
  if (page === "sales") return "sales";
  for (const item of navItems) {
    if (item.type === "group" && item.children.some((c) => c.key === page))
      return item.key;
  }
  return null;
}

function playNotificationSound() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
  oscillator.onended = () => void context.close();
}

export default function StoreShell({
  storeId,
  active,
  children,
}: {
  storeId: string;
  active: StorePage;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const { goStorePage, backToCompany } = useNav();
  const store = getStore(storeId);
  const [mobileSectionHub, setMobileSectionHub] = useState<
    "sales" | "purchases" | "stock" | "attendance" | null
  >(null);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeBottomTab = useMemo(() => {
    if (mobileSectionHub === "sales") return "sales";
    if (mobileSectionHub === "purchases") return "purchases";
    if (mobileSectionHub === "stock") return "stock";
    if (mobileSectionHub === "attendance") return "attendance";

    if (active === "dashboard") return "home";
    if (salesSubpages.has(active)) return "sales";
    if (purchasesSubpages.has(active)) return "purchases";
    if (stockSubpages.has(active)) return "stock";
    if (attendanceSubpages.has(active)) return "attendance";
    return null;
  }, [mobileSectionHub, active]);

  useEffect(() => {
    setTabletDrawerOpen(false);
    if (active === "dashboard") {
      setMobileSectionHub(null);
    }
  }, [active]);

  const [openMenu, setOpenMenu] = useState<
    "profile" | "notifications" | "settings" | null
  >(null);
  const [noticeVersion, setNoticeVersion] = useState(0);
  const [settings, setSettings] = useState<StoreUserSettings>(() =>
    readStoreUserSettings(user?.id || ""),
  );
  const [reads, setReads] = useState<string[]>(() =>
    readNotificationReads(user?.id || "", storeId),
  );
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settingsView, setSettingsView] = useState<"main" | "change-password">(
    "main",
  );
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const previousUnread = useRef<number | null>(null);
  const isStoreUser = user?.role === "store_admin";
  const roleLabel =
    user?.roleLabel ||
    (user?.role === "store_admin"
      ? "Store Administrator"
      : "Company Administrator");
  const displayName = user?.name || store?.name || "Store Admin";

  const notifications = useMemo(
    () => getStoreNotifications(storeId),
    [storeId, noticeVersion],
  );
  const readIds = useMemo(() => new Set(reads), [reads]);
  const unreadNotifications = notifications.filter(
    (item) => !readIds.has(item.id),
  );
  const unreadCount = unreadNotifications.length;
  const resolvedTheme =
    settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : resolveStoreTheme(settings.theme);

  useEffect(() => {
    setSettings(readStoreUserSettings(user?.id || ""));
    setReads(readNotificationReads(user?.id || "", storeId));
  }, [user?.id, storeId]);

  useEffect(() => {
    const refresh = () => setNoticeVersion((current) => current + 1);
    const events = [
      "store-approval-requests-updated",
      "store-purchase-orders-updated",
      "company-store-sales-updated",
      "company-credit-note-sync-updated",
      "nature-biotic-store-purchase-status-updated",
      "nature-biotic-company-receipts-updated",
      "nature-biotic-company-refunds-updated",
      "nature-biotic-fro-stock-return-updated",
      "nature-biotic-store-inventory-updated",
      "nature-biotic-handover-updated",
      "nature-biotic-delivery-challan-updated",
      "focus",
    ];
    events.forEach((event) => window.addEventListener(event, refresh));
    window.addEventListener("storage", refresh);
    return () => {
      events.forEach((event) => window.removeEventListener(event, refresh));
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [settings.theme]);

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
    if (
      previousUnread.current !== null &&
      unreadCount > previousUnread.current &&
      settings.sound
    ) {
      playNotificationSound();
    }
    previousUnread.current = unreadCount;
  }, [unreadCount, settings.sound]);

  function updateSettings(next: StoreUserSettings) {
    setSettings(next);
    if (user?.id) saveStoreUserSettings(user.id, next);
  }

  function chooseTheme(theme: StoreThemeChoice) {
    updateSettings({ ...settings, theme });
  }

  function markNotificationRead(id: string) {
    if (!user?.id) return;
    setReads((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      saveNotificationReads(user.id, storeId, next);
      return next;
    });
  }

  async function submitPassword() {
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!nextPassword.trim()) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (nextPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordError("Confirm password does not match new password.");
      return;
    }

    if (!user?.id) {
      setPasswordError("User session not found. Please log in again.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const result = await changeAccountPassword(
        user.id,
        currentPassword,
        nextPassword,
      );
      if (result.error) {
        setPasswordError(result.error);
      } else {
        setPasswordMessage("Password updated successfully!");
        setCurrentPassword("");
        setNextPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setSettingsView("main");
          setPasswordMessage("");
        }, 1800);
      }
    } catch {
      setPasswordError("Failed to update password. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("nb-dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle(
      "nb-store-dark",
      resolvedTheme === "dark",
    );
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  return (
    <div
      className={`flex min-h-screen overflow-x-clip ${
        resolvedTheme === "dark"
          ? "nb-dark dark nb-store-dark bg-slate-950 text-slate-100"
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
          store={store}
          active={active}
          onNavigate={(p) => {
            setMobileSectionHub(null);
            goStorePage(p);
          }}
          onBack={() => backToCompany()}
          showBack={!isStoreUser}
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
              store={store}
              active={active}
              onNavigate={(p) => {
                setTabletDrawerOpen(false);
                setMobileSectionHub(null);
                goStorePage(p);
              }}
              onBack={() => {
                setTabletDrawerOpen(false);
                backToCompany();
              }}
              showBack={!isStoreUser}
              onSignOut={signOut}
              onClose={() => setTabletDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

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
                  {store?.name ?? "Store Portal"}
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate leading-none mt-0.5">
                  {store?.location?.split(",")[0] || "Store"}
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
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "settings" ? null : "settings",
                  )
                }
                className="rounded-xl p-2 text-slate-600 transition active:scale-95 hover:bg-slate-100"
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
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </button>
            </div>
          </div>

          {/* TABLET & DESKTOP HEADER — hidden sm:flex (>= 600px) */}
          <div className="hidden h-16 items-center gap-3 px-4 sm:flex sm:px-6">
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
            <div className={`items-center lg:hidden ${sidebarCollapsed ? "lg:flex" : ""}`}>
              <img
                src="/logo.png"
                alt="Nature Biotic"
                className="h-8 w-auto object-contain"
              />
            </div>

            <div className="flex items-center gap-2 text-sm min-w-0">
              {!isStoreUser && (
                <>
                  <button
                    onClick={() => backToCompany()}
                    className="text-slate-400 hover:text-slate-600 font-medium transition-base hidden md:block"
                  >
                    Store
                  </button>
                  <Icon
                    name="chevron_right"
                    size={18}
                    className="text-slate-300 hidden md:block"
                  />
                </>
              )}

              <span className="font-semibold text-slate-700 truncate">
                {store?.name ?? "Store"}, {store?.location?.split(",")[0] ?? ""}
              </span>
            </div>

            <div
              data-header-menu
              className="relative z-[10000] ml-auto flex items-center gap-2"
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
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "settings" ? null : "settings",
                  )
                }
                className="rounded-xl p-2.5 transition-base hover:bg-slate-100"
              >
                <Icon name="settings" size={22} className="text-slate-600" />
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
                  {displayName.charAt(0)}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-700">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-400">{roleLabel}</p>
                </div>
                <Icon
                  name="expand_more"
                  size={18}
                  className="hidden text-slate-400 sm:block"
                />
              </button>
            </div>
          </div>

          {/* SHARED DROPDOWN MENUS (Notifications, Settings, Profile) */}
          <div data-header-menu className="relative">
            {openMenu === "notifications" && (
              <div className="absolute right-2 sm:right-6 top-1 z-[80] max-h-[min(24rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">
                    Notifications
                  </p>
                  <p className="text-xs text-slate-500">
                    {unreadCount} unread
                  </p>
                </div>
                {unreadNotifications.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">
                    No new notifications
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {unreadNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-notification-id={item.id}
                        onClick={() => {
                          markNotificationRead(item.id);
                          setOpenMenu(null);
                          setMobileSectionHub(null);
                          goStorePage(item.page);
                        }}
                        className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${
                          readIds.has(item.id) ? "" : "bg-brand-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon
                            name={item.icon}
                            size={18}
                            className="mt-0.5 text-brand-700"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.description}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {item.timeLabel}
                              {item.status ? ` · ${item.status}` : ""}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {openMenu === "settings" && (
              <div className="absolute right-2 sm:right-6 top-1 z-[80] max-h-[min(36rem,calc(100vh-5rem))] w-[min(23rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl">
                {settingsView === "main" ? (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Icon
                          name="settings"
                          size={20}
                          className="text-brand-600 dark:text-brand-400"
                        />
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          Store Settings
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenMenu(null)}
                        className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>

                    {/* Section: Profile */}
                    <p className="mt-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Profile
                    </p>
                    <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-100 dark:border-slate-800">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {user?.email}
                        </p>
                        <span className="inline-block mt-0.5 rounded-md bg-brand-50 dark:bg-brand-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                          {roleLabel}
                        </span>
                      </div>
                    </div>

                    {/* Section: Change Password */}
                    <div className="mt-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordError("");
                          setPasswordMessage("");
                          setCurrentPassword("");
                          setNextPassword("");
                          setConfirmPassword("");
                          setSettingsView("change-password");
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 text-left transition hover:border-brand-500 dark:hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800 group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-400">
                            <Icon name="lock" size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                              Change Password
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Update your store account password
                            </p>
                          </div>
                        </div>
                        <Icon
                          name="chevron_right"
                          size={18}
                          className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
                        />
                      </button>
                    </div>

                    {/* Section: Notifications */}
                    <p className="mt-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Notifications
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({ ...settings, sound: !settings.sound })
                      }
                      className="mt-2 flex w-full items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          name="volume_up"
                          size={18}
                          className="text-slate-500 dark:text-slate-400"
                        />
                        <span>Notification sound</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          settings.sound
                            ? "bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-400"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {settings.sound ? "On" : "Off"}
                      </span>
                    </button>

                    {/* Section: Appearance / Theme */}
                    <p className="mt-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Appearance (Theme)
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(
                        [
                          ["light", "Light", "light_mode"],
                          ["dark", "Dark", "dark_mode"],
                          ["system", "System", "settings_brightness"],
                        ] as const
                      ).map(([value, label, iconName]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => chooseTheme(value)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 text-xs font-semibold transition border ${
                            settings.theme === value
                              ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-600"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <Icon name={iconName} size={18} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsView("main");
                        setPasswordError("");
                        setPasswordMessage("");
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-400 mb-3"
                    >
                      <Icon name="arrow_back" size={16} />
                      <span>Back to Settings</span>
                    </button>

                    <div className="flex items-center gap-2.5 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-400">
                        <Icon name="lock" size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          Change Password
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Update your store account password
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Input
                        label="Current Password"
                        type="password"
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        required
                      />
                      <Input
                        label="New Password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={nextPassword}
                        onChange={setNextPassword}
                        required
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        required
                      />

                      {passwordError && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/50 text-xs font-semibold text-red-600 dark:text-red-300">
                          <Icon name="error" size={16} />
                          <span>{passwordError}</span>
                        </div>
                      )}

                      {passwordMessage && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/50 text-xs font-semibold text-brand-700 dark:text-brand-300">
                          <Icon name="check_circle" size={16} fill />
                          <span>{passwordMessage}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsView("main");
                            setPasswordError("");
                            setPasswordMessage("");
                          }}
                          className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingPassword}
                          onClick={() => void submitPassword()}
                          className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700 py-2.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
                        >
                          {isUpdatingPassword
                            ? "Updating..."
                            : "Update Password"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {openMenu === "profile" && (
              <div className="absolute right-2 sm:right-6 top-1 z-[80] w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                {/* Profile Header */}
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-xs">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      <span className="inline-block mt-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  {/* Reports item */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setMobileSectionHub(null);
                      goStorePage("reports");
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <Icon name="bar_chart" size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Reports</p>
                        <p className="text-[10px] text-slate-400">Store analytics & summaries</p>
                      </div>
                    </div>
                    <Icon name="chevron_right" size={16} className="text-slate-400" />
                  </button>

                  {/* Settings item */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu("settings");
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon name="settings" size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Settings</p>
                        <p className="text-[10px] text-slate-400">Preferences & password</p>
                      </div>
                    </div>
                    <Icon name="chevron_right" size={16} className="text-slate-400" />
                  </button>

                  {!isStoreUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        backToCompany();
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-700"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <Icon name="business" size={17} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Company Portal</p>
                          <p className="text-[10px] text-slate-400">Switch back to company</p>
                        </div>
                      </div>
                      <Icon name="chevron_right" size={16} className="text-slate-400" />
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/60"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/70 text-red-600 dark:text-red-400">
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
          {/* Mobile Section Hub (only on mobile screens < 600px when user selects a section tab) */}
          {mobileSectionHub ? (
            <>
              <div className="sm:hidden">
                <StoreMobileSectionHub
                  section={mobileSectionHub}
                  onNavigate={(page) => {
                    setMobileSectionHub(null);
                    goStorePage(page);
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
                      if (activeBottomTab === "sales") setMobileSectionHub("sales");
                      else if (activeBottomTab === "purchases") setMobileSectionHub("purchases");
                      else if (activeBottomTab === "stock") setMobileSectionHub("stock");
                      else if (activeBottomTab === "attendance") setMobileSectionHub("attendance");
                      else {
                        setMobileSectionHub(null);
                        goStorePage("dashboard");
                      }
                    }}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 transition active:scale-95 hover:text-brand-700"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon name="arrow_back" size={16} />
                    </div>
                    <span>
                      Back to {
                        activeBottomTab === "sales" ? "Sales" :
                        activeBottomTab === "purchases" ? "Purchase" :
                        activeBottomTab === "stock" ? "Stock" :
                        activeBottomTab === "attendance" ? "Attendance" : "Home"
                      }
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
          className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.6rem,env(safe-area-inset-bottom,0.6rem))] pt-1.5"
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
                      goStorePage("dashboard");
                    } else {
                      setMobileSectionHub(tab.id);
                    }
                  }}
                  className={`group flex flex-col items-center justify-center py-1 px-1 transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "text-brand-700 dark:text-emerald-400 font-semibold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-normal"
                  }`}
                >
                  <div
                    className={`flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-emerald-950/70 dark:text-emerald-300 scale-105 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                    }`}
                  >
                    <Icon
                      name={tab.icon}
                      size={22}
                      className={isActive ? "text-brand-700 dark:text-emerald-400 font-bold" : "text-slate-500 dark:text-slate-400"}
                    />
                  </div>
                  <span
                    className={`mt-0.5 text-[10px] leading-tight tracking-tight truncate max-w-full ${
                      isActive
                        ? "font-bold text-brand-700 dark:text-emerald-400"
                        : "font-medium text-slate-500 dark:text-slate-400"
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
  store,
  active,
  onNavigate,
  onBack,
  showBack,
  onSignOut,
  onClose,
}: {
  store: ReturnType<typeof getStore>;
  active: StorePage;
  onNavigate: (p: StorePage) => void;
  onBack: () => void;
  showBack: boolean;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  const initialGroup = activeGroupFor(active);
  const [openGroup, setOpenGroup] = useState<
    "purchases" | "stock-management" | "sales" | null
  >(initialGroup);

  function toggleGroup(key: "purchases" | "stock-management" | "sales") {
    setOpenGroup((cur) => (cur === key ? null : key));
  }

  return (
    <>
      <div className="border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-center px-5 h-16 relative">
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
            >
              <Icon name="close" size={20} />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {showBack && (
          <button
            onClick={onBack}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-base mb-2"
          >
            <Icon name="arrow_back" size={20} />
            Back to Stores
          </button>
        )}

        {navItems.map((item) => {
          if (item.type === "link") {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-base ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800/60 font-bold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon name={item.icon} size={22} fill={isActive} />
                {item.label}
              </button>
            );
          }

          const isOpen = openGroup === item.key;
          const isChildActive = item.children.some((c) => c.key === active);
          return (
            <div key={item.key}>
              <button
                onClick={() => toggleGroup(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-base ${
                  isChildActive
                    ? "text-brand-700 dark:text-emerald-300 font-bold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon name={item.icon} size={22} fill={isChildActive} />
                <span className="flex-1 text-left">{item.label}</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className={`text-slate-400 dark:text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="mt-1 ml-3 pl-4 border-l border-slate-100 dark:border-slate-800 space-y-0.5">
                  {item.children.map((child) => {
                    const isActive = active === child.key;
                    return (
                      <button
                        key={child.key}
                        onClick={() => onNavigate(child.key)}
                        className={`w-full flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-sm font-medium transition-base ${
                          isActive
                            ? "bg-brand-50 text-brand-700 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800/40 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        }`}
                      >
                        <Icon name={child.icon} size={18} fill={isActive} />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 transition-base"
        >
          <Icon name="logout" size={22} />
          Sign Out
        </button>
      </div>
    </>
  );
}
