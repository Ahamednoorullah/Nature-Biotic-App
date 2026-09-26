import { useState, type ReactNode } from "react";
import { getStore, staff } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav, type StorePage } from "@/context/NavContext";
import { Icon } from "@/components/ui";

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountView, setAccountView] = useState<"profile" | "store" | "settings" | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("nature-biotic-fro-theme") === "dark";
    } catch {
      return false;
    }
  });

  const currentStaff =
    staff.find(
      (item) =>
        String(item.id) === String((user as any).staffId ?? (user as any).id) ||
        item.name.trim().toLowerCase() === user.name.trim().toLowerCase(),
    ) ?? null;

  const setTheme = (next: boolean) => {
    setDarkMode(next);
    try {
      localStorage.setItem("nature-biotic-fro-theme", next ? "dark" : "light");
    } catch {}
  };

  const isSalesActive =
    active === "sales" ||
    active === "quotation" ||
    active === "sales-invoice" ||
    active === "sales-return" ||
    active === "credit-notes" ||
    active === "receipt" ||
    active === "refund" ||
    active === "payments" ||
    active === "delivery-challan" ||
    active === "return-challan";

  const moreItems: { key: StorePage; label: string; icon: string }[] = [
    {
      key: "delivery-challan",
      label: "Delivery Challan",
      icon: "local_shipping",
    },
    {
      key: "return-challan",
      label: "Return Challan",
      icon: "assignment_return",
    },
    { key: "quotation", label: "Quotation", icon: "request_quote" },
    { key: "sales-invoice", label: "Sales Invoice", icon: "receipt_long" },
    { key: "sales-return", label: "Sales Return", icon: "assignment_return" },
    { key: "credit-notes", label: "Credit Notes", icon: "request_quote" },
    { key: "receipt", label: "Receipt", icon: "receipt" },
    { key: "refund", label: "Refund", icon: "currency_exchange" },
    { key: "attendance", label: "Attendance", icon: "badge" },
    { key: "reports", label: "Reports", icon: "bar_chart" },
  ];

  const go = (page: StorePage) => {
    setMoreOpen(false);
    onNavigate(page);
  };

  return (
    <div className={`flex h-[100dvh] overflow-x-clip ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50"}`}>
      <aside className={`hidden lg:flex w-64 shrink-0 flex-col border-r ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-white"}`}>
        <FRODesktopNav active={active} onNavigate={onNavigate} onSignOut={onSignOut} />
      </aside>

      <div className={`relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden ${darkMode ? "bg-slate-950" : "bg-slate-50"}`}>
        <header className={`z-30 shrink-0 border-b backdrop-blur-md ${darkMode ? "border-slate-800 bg-slate-900/95" : "border-slate-100 bg-white/95"}`}>
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
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="rounded-xl p-2 text-slate-500 lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="relative rounded-xl p-2 text-slate-500"
              aria-label="Notifications"
            >
              <Icon name="notifications" size={22} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white" />
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm"
              aria-label="Open account menu"
            >
              {user.name.charAt(0)}
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-8 lg:py-6 lg:pb-8">
          <div key={active} className="animate-fade-in">
            {children}
          </div>
        </main>

        {profileOpen && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close account menu"
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
              onClick={() => setProfileOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-[28px] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)] lg:bottom-auto lg:top-1/2 lg:max-h-[min(82vh,720px)] lg:-translate-y-1/2 lg:rounded-3xl">
              <div className="px-5 pt-4 pb-3 border-b border-slate-100">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-800 truncate">{user.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">FRO</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {store?.name ?? "Store"} · {store?.location?.split(",")[0] ?? ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <Icon name="close" size={21} />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setAccountView("profile");
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left"
                >
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Icon name="person" size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-slate-800">My Profile</span>
                    <span className="block text-[11px] text-slate-400">View your FRO profile</span>
                  </span>
                  <Icon name="chevron_right" size={18} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setAccountView("store");
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left"
                >
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Icon name="store" size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-slate-800">My Store</span>
                    <span className="block text-[11px] text-slate-400">
                      {store?.name ?? "Store"} · {store?.location?.split(",")[0] ?? ""}
                    </span>
                  </span>
                  <Icon name="chevron_right" size={18} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setAccountView("settings");
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left"
                >
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Icon name="settings" size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-slate-800">Settings</span>
                    <span className="block text-[11px] text-slate-400">App preferences</span>
                  </span>
                  <Icon name="chevron_right" size={18} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left"
                >
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <Icon name="logout" size={20} />
                  </span>
                  <span className="flex-1 text-sm font-bold text-red-600">Sign Out</span>
                  <Icon name="chevron_right" size={18} className="text-red-300" />
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <h2 className="text-lg font-extrabold text-slate-800">
                    {accountView === "profile"
                      ? "My Profile"
                      : accountView === "store"
                        ? "My Store"
                        : "Settings"}
                  </h2>
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

                {accountView === "store" && (
                  <div className="space-y-3">
                    {[
                      ["Store Name", store?.name],
                      ["Owner", store?.owner],
                      ["Manager", store?.manager],
                      ["Location", store?.location],
                      ["Address", store?.address],
                      ["Phone", store?.phone],
                      ["GST", store?.gst],
                      ["Status", store?.status],
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

                {accountView === "settings" && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <Icon name={darkMode ? "dark_mode" : "light_mode"} size={21} />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">Theme</p>
                        <p className="text-[11px] text-slate-400">
                          Choose light or dark mode
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTheme(!darkMode)}
                        className={`relative h-7 w-12 rounded-full transition ${
                          darkMode ? "bg-brand-600" : "bg-slate-300"
                        }`}
                        aria-label="Toggle theme"
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                            darkMode ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-3 flex justify-between text-xs font-semibold text-slate-500">
                      <span>Light</span>
                      <span>{darkMode ? "Dark" : "Light"} selected</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {notificationsOpen && (
          <div className="fixed inset-0 z-[60]">
            <button
              type="button"
              aria-label="Close notifications"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setNotificationsOpen(false)}
            />
            <div className="absolute left-0 right-0 top-0 mx-auto w-full max-w-lg rounded-b-[28px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] lg:top-1/2 lg:max-h-[min(82vh,640px)] lg:-translate-y-1/2 lg:overflow-y-auto lg:rounded-3xl">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                      FRO
                    </p>
                    <h2 className="text-lg font-extrabold text-slate-800">
                      Notifications
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <Icon name="close" size={21} />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                    <Icon name="payments" size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Cash Handover</p>
                    <p className="text-[11px] text-slate-500">
                      Check pending cash handover updates.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                    <Icon name="inventory_2" size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Stock Update</p>
                    <p className="text-[11px] text-slate-500">
                      Check your latest stock and handover updates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {moreOpen && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 mx-auto max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-3xl">
              <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-slate-100">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                      FRO Menu
                    </p>
                    <h2 className="text-lg font-extrabold text-slate-800">
                      More
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="p-2 rounded-xl hover:bg-slate-100"
                  >
                    <Icon name="close" size={22} />
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 gap-2">
                {moreItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => go(item.key)}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      active === item.key
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                      <Icon name={item.icon} size={19} />
                    </span>
                    <span className="text-xs font-semibold leading-4">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="px-4 pb-5 pt-1">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
                >
                  <Icon name="logout" size={19} />
                  Sign Out
                </button>
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
              active={active === "stock-management"}
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
    { key: "payments", label: "Payments", icon: "payments" },
    { key: "farmers", label: "Farmers", icon: "groups" },
    { key: "quotation", label: "Quotation", icon: "request_quote" },
    { key: "sales-invoice", label: "Sales Invoice", icon: "receipt_long" },
    { key: "delivery-challan", label: "Delivery Challan", icon: "local_shipping" },
    { key: "return-challan", label: "Return Challan", icon: "assignment_return" },
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
              ["quotation", "sales-invoice", "sales-return", "credit-notes", "receipt", "refund"].includes(active));
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
