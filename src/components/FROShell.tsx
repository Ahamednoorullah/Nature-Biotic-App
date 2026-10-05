import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getStore, staff } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav, type StorePage } from "@/context/NavContext";
import { Icon, Input } from "@/components/ui";
import { changeAccountPassword } from "@/lib/auth/localAuth";
import { getFroNotifications } from "@/lib/storeNotifications";
import {
  readNotificationReads,
  readStoreUserSettings,
  resolveStoreTheme,
  saveNotificationReads,
  saveStoreUserSettings,
  type StoreThemeChoice,
  type StoreUserSettings,
} from "@/lib/storeSettings";

export default function FROShell({
  storeId,
  active,
  children,
}: {
  storeId: string;
  active: StorePage;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const { goStorePage } = useNav();
  const store = getStore(storeId);
  if (!user) return null;
  return (
    <FROMobileShell
      store={store}
      active={active}
      user={user}
      onNavigate={goStorePage}
      onSignOut={signOut}
    >
      {children}
    </FROMobileShell>
  );
}

function FROMobileShell({
  store,
  active,
  user,
  onNavigate,
  onSignOut,
  children,
}: {
  store: ReturnType<typeof getStore>;
  active: StorePage;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  onNavigate: (p: StorePage) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [openMenu, setOpenMenu] = useState<
    "profile" | "notifications" | "settings" | null
  >(null);
  const [accountView, setAccountView] = useState<"profile" | null>(null);
  const [noticeVersion, setNoticeVersion] = useState(0);
  const [settings, setSettings] = useState<StoreUserSettings>(() =>
    readStoreUserSettings(user.id),
  );
  const [reads, setReads] = useState<string[]>(() =>
    readNotificationReads(user.id, store?.id || ""),
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

  const currentStaff =
    staff.find(
      (item) =>
        String(item.id) === String((user as any).staffId ?? (user as any).id) ||
        item.name.trim().toLowerCase() === user.name.trim().toLowerCase(),
    ) ?? null;

  const notifications = useMemo(
    () =>
      getFroNotifications(
        store?.id || "",
        user.name,
        String((user as { staffId?: string }).staffId || user.id || ""),
      ),
    [store?.id, user.name, user.id, noticeVersion],
  );
  const readIds = useMemo(() => new Set(reads), [reads]);
  const unreadNotifications = notifications.filter((item) => !readIds.has(item.id));
  const unreadCount = unreadNotifications.length;
  const resolvedTheme =
    settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : resolveStoreTheme(settings.theme);

  useEffect(() => {
    const userId = user.id;
    const storeId = store?.id || "";
    const savedKey = `nature-biotic-store-user-settings-v1:${userId}`;
    let next = readStoreUserSettings(userId);
    try {
      if (
        !localStorage.getItem(savedKey) &&
        localStorage.getItem("nature-biotic-fro-theme") === "dark"
      ) {
        next = { ...next, theme: "dark" };
        saveStoreUserSettings(userId, next);
      }
    } catch {
      // Existing settings still apply.
    }
    setSettings(next);
    setReads(readNotificationReads(userId, storeId));
  }, [user.id, store?.id]);

  useEffect(() => {
    const refresh = () => setNoticeVersion((current) => current + 1);
    const events = [
      "store-approval-requests-updated",
      "company-store-sales-updated",
      "nature-biotic-store-inventory-updated",
      "nature-biotic-fro-stock-return-updated",
      "nature-biotic-handover-updated",
      "nature-biotic-cash-received-updated",
      "nature-biotic-expense-updated",
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

  function updateSettings(next: StoreUserSettings) {
    setSettings(next);
    saveStoreUserSettings(user.id, next);
  }

  function chooseTheme(theme: StoreThemeChoice) {
    updateSettings({ ...settings, theme });
  }

  function markNotificationRead(id: string) {
    setReads((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      saveNotificationReads(user.id, store?.id || "", next);
      return next;
    });
  }

  async function submitPassword() {
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

  const isSalesActive = [
    "sales",
    "quotation",
    "sales-invoice",
    "sales-return",
    "credit-notes",
    "receipt",
    "refund",
  ].includes(active);
  const isStockActive = [
    "stock-management",
    "delivery-challan",
    "return-challan",
  ].includes(active);

  useEffect(() => {
    if (
      previousUnread.current !== null &&
      unreadCount > previousUnread.current &&
      settings.sound
    ) {
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
    previousUnread.current = unreadCount;
  }, [unreadCount, settings.sound]);

  const go = (page: StorePage) => {
    setOpenMenu(null);
    onNavigate(page);
  };

  return (
    <div className={`flex h-[100dvh] overflow-x-clip ${resolvedTheme === "dark" ? "nb-store-dark bg-slate-950" : "bg-slate-50"}`}>
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-100 bg-white">
        <FRODesktopNav active={active} onNavigate={onNavigate} onSignOut={onSignOut} />
      </aside>

      <div className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <header className="z-30 shrink-0 border-b border-slate-100 bg-white/95 backdrop-blur-md">
          <div className="flex h-[68px] items-center gap-3 px-3 sm:px-4 lg:px-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/logo.png"
                alt="Nature Biotic"
                className="h-9 w-auto object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                FRO
              </p>
              <p className="text-sm font-bold text-slate-800 truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {store?.name ?? "Store"} ·{" "}
                {store?.location?.split(",")[0] ?? ""}
              </p>
            </div>
            <div data-header-menu className="relative z-[80] flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "notifications" ? null : "notifications",
                  )
                }
                className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <Icon name="notifications" size={22} />
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
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <Icon name="settings" size={22} />
              </button>
              <button
                type="button"
                aria-label="Open account menu"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "profile" ? null : "profile",
                  )
                }
                className="flex items-center gap-2 rounded-xl py-1 pl-1 hover:bg-slate-100 sm:pl-2 sm:pr-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {user.name.charAt(0)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight text-slate-700">
                    {user.name}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {currentStaff?.designation || "FRO"}
                  </span>
                </span>
                <Icon name="expand_more" size={18} className="hidden text-slate-400 sm:block" />
              </button>

              {openMenu === "notifications" && (
                <div className="absolute right-0 top-12 z-[80] max-h-[min(24rem,calc(100vh-5.5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">Notifications</p>
                    <p className="text-xs text-slate-500">{unreadCount} unread</p>
                  </div>
                  {unreadNotifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">No new notifications</p>
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
                            onNavigate(item.page);
                          }}
                          className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${
                            readIds.has(item.id) ? "" : "bg-brand-50/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon name={item.icon} size={18} className="mt-0.5 text-brand-700" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-800">{item.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
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
                <div className="absolute right-0 top-12 z-[80] max-h-[min(32rem,calc(100vh-5.5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="text-sm font-bold text-slate-800">Settings</p>
                  <button
                    type="button"
                    onClick={() => go("reports")}
                    className="mt-3 flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 lg:hidden"
                  >
                    <Icon name="bar_chart" size={18} />
                    Reports
                  </button>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Appearance</p>
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
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Notifications</p>
                  <button
                    type="button"
                    onClick={() => updateSettings({ ...settings, sound: !settings.sound })}
                    className="mt-2 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700"
                  >
                    Notification sound
                    <span>{settings.sound ? "On" : "Off"}</span>
                  </button>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Account</p>
                  <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-sm font-bold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{currentStaff?.email || user.email}</p>
                    <p className="text-xs text-slate-400">{currentStaff?.designation || "FRO"}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Input label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} />
                    <Input label="New password" type="password" value={nextPassword} onChange={setNextPassword} />
                    {passwordMessage && (
                      <p className="text-xs font-medium text-slate-600">{passwordMessage}</p>
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
                    <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{currentStaff?.designation || "FRO"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setAccountView("profile");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Icon name="person" size={18} />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onSignOut();
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

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-8 lg:py-6 lg:pb-8">
          <div key={active} className="animate-fade-in">
            {children}
          </div>
        </main>

        {accountView && (
          <div className="fixed inset-0 z-[60]">
            <button
              type="button"
              aria-label="Close account details"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setAccountView(null)}
            />
            <div className="absolute bottom-0 left-0 right-0 mx-auto max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-3xl">
              <div className="sticky top-0 z-10 bg-white px-5 pt-4 pb-3 border-b border-slate-100">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountView(null)}
                    className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label="Back"
                  >
                    <Icon name="arrow_back" size={21} />
                  </button>
                  <h2 className="text-lg font-extrabold text-slate-800">Profile</h2>
                  <button
                    type="button"
                    onClick={() => setAccountView(null)}
                    className="ml-auto p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <Icon name="close" size={21} />
                  </button>
                </div>
              </div>

              <div className="p-4">
                {accountView === "profile" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
                      <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg">
                        {user.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 truncate">
                          {currentStaff?.name || user.name}
                        </p>
                        <p className="text-xs font-semibold text-brand-700">
                          {currentStaff?.designation || "FRO"}
                        </p>
                      </div>
                    </div>

                    {[
                      ["Name", currentStaff?.name || user.name],
                      ["Role", currentStaff?.designation || "FRO"],
                      ["Mobile", currentStaff?.phone || (user as any).phone || (user as any).mobile || "-"],
                      ["Alternative Mobile", currentStaff?.alternativePhone || "-"],
                      ["Email", currentStaff?.email || (user as any).email || "-"],
                      ["Joined Date", currentStaff?.joinedDate || "-"],
                      ["Address", currentStaff?.address || "-"],
                      ["Status", currentStaff?.status || "-"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800 break-words">
                          {String(value || "-")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md lg:hidden">
          <div className="grid grid-cols-5 gap-1">
            <MobileNavButton
              active={active === "dashboard"}
              icon="home"
              label="Home"
              onClick={() => go("dashboard")}
            />
            <MobileNavButton
              active={isStockActive}
              icon="inventory_2"
              label="Stock"
              onClick={() => go("stock-management")}
            />
            <MobileNavButton
              active={isSalesActive}
              icon="sell"
              label="Sales"
              onClick={() => go("sales")}
            />
            <MobileNavButton
              active={active === "attendance" || active === "farmers"}
              icon="event_available"
              label="Visits"
              onClick={() => go("attendance")}
            />
            <MobileNavButton
              active={active === "expenses"}
              icon="receipt_long"
              label="Expenses"
              onClick={() => go("expenses")}
            />
          </div>
        </nav>
      </div>
    </div>
  );
}

function MobileNavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition ${
        active
          ? "text-brand-700 bg-brand-50"
          : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <Icon name={icon} size={22} fill={active} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function FRODesktopNav({
  active,
  onNavigate,
  onSignOut,
}: {
  active: StorePage;
  onNavigate: (p: StorePage) => void;
  onSignOut: () => void;
}) {
  const items: { key: StorePage; label: string; icon: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "stock-management", label: "Stock", icon: "inventory_2" },
    { key: "sales", label: "Sales", icon: "sell" },
    { key: "attendance", label: "Visits", icon: "event_available" },
    { key: "expenses", label: "Expenses", icon: "receipt_long" },
    { key: "reports", label: "Reports", icon: "bar_chart" },
  ];

  return (
    <>
      <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-slate-100 px-5">
        <img src="/logo.png" alt="Nature Biotic" className="h-12 w-auto object-contain" />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive =
            active === item.key ||
            (item.key === "sales" &&
              [
                "quotation",
                "sales-invoice",
                "sales-return",
                "credit-notes",
                "receipt",
                "refund",
              ].includes(active)) ||
            (item.key === "stock-management" &&
              ["delivery-challan", "return-challan"].includes(active)) ||
            (item.key === "attendance" &&
              ["farmers", "add-farmer", "farmer-profile"].includes(active));
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-base ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon name={item.icon} size={22} fill={isActive} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-slate-100 px-3 py-4">
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-base hover:bg-red-50 hover:text-red-600"
        >
          <Icon name="logout" size={22} />
          Sign Out
        </button>
      </div>
    </>
  );
}
