import { useState, type ReactNode } from "react";
import { getStore, staff } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useNav, type StorePage } from "@/context/NavContext";
import { Icon } from "@/components/ui";

type SubItem = { key: StorePage; label: string; icon: string };
type NavItem =
  | { type: "link"; key: StorePage; label: string; icon: string }
  | {
      type: "group";
      key: "purchases" | "sales";
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
      { key: "purchases", label: "Purchase", icon: "shopping_cart" },
      { key: "debit-notes", label: "Debit Notes", icon: "request_quote" },
      { key: "return-stock", label: "Return Stock", icon: "assignment_return" },
      { key: "payments", label: "Payment", icon: "payments" },
      { key: "expenses", label: "Expenses", icon: "receipt_long" },
    ],
  },
  {
    type: "link",
    key: "stock-management",
    label: "Stock Management",
    icon: "inventory_2",
  },
  {
    type: "group",
    key: "sales",
    label: "Sales",
    icon: "sell",
    children: [
      { key: "farmers", label: "Farmer", icon: "groups" },
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
      { key: "credit-notes", label: "Credit Note", icon: "request_quote" },
      {
        key: "receipt-refund" as StorePage,
        label: "Receipt & Refund",
        icon: "receipt",
      },
    ],
  },
  { type: "link", key: "attendance", label: "Attendance", icon: "badge" },
  { type: "link", key: "reports", label: "Reports", icon: "bar_chart" },
];

const groupKeys = ["purchases", "sales"] as const;

function activeGroupFor(page: StorePage): "purchases" | "sales" | null {
  if (page === "purchases") return "purchases";
  if (page === "sales") return "sales";
  for (const item of navItems) {
    if (item.type === "group" && item.children.some((c) => c.key === page))
      return item.key;
  }
  return null;
}

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
    <div className={`h-[100dvh] flex justify-center overflow-hidden ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50"}`}>
      <div className={`w-full h-[100dvh] relative overflow-hidden flex flex-col sm:max-w-[520px] sm:shadow-[0_0_40px_rgba(15,23,42,0.08)] ${darkMode ? "bg-slate-950" : "bg-slate-50"}`}>
        <header className={`shrink-0 z-30 backdrop-blur-md border-b ${darkMode ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-100"}`}>
          <div className="h-[68px] px-4 flex items-center gap-3">
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
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 rounded-xl text-slate-500"
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

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 pb-24">
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
            <div className="absolute left-0 right-0 bottom-0 mx-auto w-full sm:max-w-[520px] rounded-t-[28px] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)]">
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
            <div className="absolute left-0 right-0 bottom-0 mx-auto w-full sm:max-w-[520px] rounded-t-[28px] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)] max-h-[82vh] overflow-y-auto">
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
            <div className="absolute left-0 right-0 top-0 mx-auto w-full sm:max-w-[520px] rounded-b-[28px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
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
            <div className="absolute left-0 right-0 bottom-0 mx-auto w-full sm:max-w-[520px] rounded-t-[28px] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)] max-h-[78vh] overflow-y-auto">
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

        <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full sm:max-w-[520px] border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
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

function SidebarContent({
  store,
  active,
  onNavigate,
  onBack,
  onSignOut,
  onClose,
}: {
  store: ReturnType<typeof getStore>;
  active: StorePage;
  onNavigate: (p: StorePage) => void;
  onBack: () => void;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  const initialGroup = activeGroupFor(active);
  const [openGroup, setOpenGroup] = useState<"purchases" | "sales" | null>(
    initialGroup,
  );

  function toggleGroup(key: "purchases" | "sales") {
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
        <button
          onClick={onBack}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-base mb-2"
        >
          <Icon name="arrow_back" size={20} />
          Back to Stores
        </button>

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
                onClick={() => {
                  toggleGroup(item.key);
                  onNavigate(item.key as StorePage);
                }}
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
