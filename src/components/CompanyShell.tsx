import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNav, type CompanyPage } from "@/context/NavContext";
import { Icon, Logo } from "@/components/ui";

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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-100 fixed inset-y-0 left-0 z-30">
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
          <aside className="absolute inset-y-0 left-0 w-64 bg-white animate-slide-in-right flex flex-col">
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

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center gap-4 px-4 sm:px-6 h-16">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-base"
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

            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              <button className="p-2.5 rounded-xl hover:bg-slate-100 transition-base relative">
                <Icon
                  name="notifications"
                  size={22}
                  className="text-slate-600"
                />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white" />
              </button>

              <button className="flex items-center gap-2.5 pl-2 sm:pl-3 sm:pr-1 py-1 rounded-xl hover:bg-slate-100 transition-base">
                <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(user?.name ?? "U").charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-700 leading-tight">
                    Administrator
                  </p>
                </div>
                <Icon
                  name="expand_more"
                  size={18}
                  className="text-slate-400 hidden sm:block"
                />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
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
