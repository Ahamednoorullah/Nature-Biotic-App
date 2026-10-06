import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getStore } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav, type StorePage } from "@/context/NavContext";
import { Icon, Input } from "@/components/ui";
import { changeAccountPassword } from "@/lib/auth/localAuth";
import { getStoreNotifications } from "@/lib/storeNotifications";
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
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const [passwordMessage, setPasswordMessage] = useState("");
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
    if (!user?.id) return;
    const result = await changeAccountPassword(
      user.id,
      currentPassword,
      nextPassword,
    );
    setPasswordMessage(result.error || "Password updated.");
    if (!result.error) {
      setCurrentPassword("");
      setNextPassword("");
    }
  }

  return (
    <div
      className={`flex min-h-screen overflow-x-clip ${
        resolvedTheme === "dark" ? "nb-store-dark bg-slate-950" : "bg-slate-50"
      }`}
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-100 bg-white lg:flex">
        <SidebarContent
          store={store}
          active={active}
          onNavigate={goStorePage}
          onBack={() => backToCompany()}
          showBack={!isStoreUser}
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
              store={store}
              active={active}
              onNavigate={(p) => {
                goStorePage(p);
                setMobileOpen(false);
              }}
              onBack={() => backToCompany()}
              showBack={!isStoreUser}
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

            <div className="flex items-center gap-2 text-sm min-w-0">
              {!isStoreUser && (
                <>
                  <button
                    onClick={() => backToCompany()}
                    className="text-slate-400 hover:text-slate-600 font-medium transition-base hidden sm:block"
                  >
                    Store
                  </button>
                  <Icon
                    name="chevron_right"
                    size={18}
                    className="text-slate-300 hidden sm:block"
                  />
                </>
              )}

              <span className="font-semibold text-slate-700 truncate">
                {store?.name ?? "Store"}, {store?.location?.split(",")[0] ?? ""}
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

              {openMenu === "notifications" && (
                <div className="absolute right-0 top-12 z-[80] max-h-[min(24rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                <div className="absolute right-0 top-12 z-[80] max-h-[min(32rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="text-sm font-bold text-slate-800">Settings</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Appearance
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["light", "Light"],
                        ["dark", "Dark"],
                        ["system", "System"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => chooseTheme(value)}
                        className={`rounded-xl px-2 py-2 text-xs font-semibold ${
                          settings.theme === value
                            ? "bg-brand-50 text-brand-700"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Notifications
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({ ...settings, sound: !settings.sound })
                    }
                    className="mt-2 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700"
                  >
                    Notification sound
                    <span>{settings.sound ? "On" : "Off"}</span>
                  </button>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Account
                  </p>
                  <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-sm font-bold text-slate-800">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <p className="text-xs text-slate-400">{roleLabel}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Input
                      label="Current password"
                      type="password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                    />
                    <Input
                      label="New password"
                      type="password"
                      value={nextPassword}
                      onChange={setNextPassword}
                    />
                    {passwordMessage && (
                      <p className="text-xs font-medium text-slate-600">
                        {passwordMessage}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void submitPassword()}
                      className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Change password
                    </button>
                  </div>
                </div>
              )}

              {openMenu === "profile" && (
                <div className="absolute right-0 top-12 z-[80] w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500">{roleLabel}</p>
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
      <div className="border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-center px-5 h-16 relative">
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
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {showBack && (
          <button
            onClick={onBack}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-base mb-2"
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
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
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
                    ? "text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon name={item.icon} size={22} fill={isChildActive} />
                <span className="flex-1 text-left">{item.label}</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="mt-1 ml-3 pl-4 border-l border-slate-100 space-y-0.5">
                  {item.children.map((child) => {
                    const isActive = active === child.key;
                    return (
                      <button
                        key={child.key}
                        onClick={() => onNavigate(child.key)}
                        className={`w-full flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-sm font-medium transition-base ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50"
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
