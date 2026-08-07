import { useState, type ReactNode } from 'react';
import { getStore } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import { useNav, type StorePage } from '@/context/NavContext';
import { Icon } from '@/components/ui';

type SubItem = { key: StorePage; label: string; icon: string };
type NavItem =
  | { type: 'link'; key: StorePage; label: string; icon: string }
  | { type: 'group'; key: 'purchases' | 'sales'; label: string; icon: string; children: SubItem[] };

const navItems: NavItem[] = [
  { type: 'link', key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { type: 'link', key: 'stock-management', label: 'Stock Management', icon: 'inventory_2' },
  {
    type: 'group',
    key: 'purchases',
    label: 'Purchases',
    icon: 'shopping_cart',
    children: [
      { key: 'debit-notes', label: 'Debit Notes', icon: 'request_quote' },
      { key: 'payments', label: 'Payments', icon: 'payments' },
      { key: 'expenses', label: 'Expenses', icon: 'receipt_long' },
    ],
  },
  {
    type: 'group',
    key: 'sales',
    label: 'Sales',
    icon: 'sell',
    children: [
      { key: 'credit-notes', label: 'Credit Notes', icon: 'request_quote' },
      { key: 'receipt', label: 'Receipt', icon: 'receipt' },
      { key: 'farmers', label: 'Farmers', icon: 'groups' },
    ],
  },
  { type: 'link', key: 'attendance', label: 'Attendance', icon: 'badge' },
  { type: 'link', key: 'reports', label: 'Reports', icon: 'bar_chart' },
];

const groupKeys = ['purchases', 'sales'] as const;

function activeGroupFor(page: StorePage): 'purchases' | 'sales' | null {
  for (const item of navItems) {
    if (item.type === 'group' && item.children.some((c) => c.key === page)) return item.key;
  }
  return null;
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-100 fixed inset-y-0 left-0 z-30">
        <SidebarContent store={store} active={active} onNavigate={goStorePage} onBack={() => backToCompany()} onSignOut={signOut} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white animate-slide-in-right flex flex-col">
            <SidebarContent store={store} active={active} onNavigate={(p) => { goStorePage(p); setMobileOpen(false); }} onBack={() => backToCompany()} onSignOut={signOut} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center gap-4 px-4 sm:px-6 h-16">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-base">
              <Icon name="menu" size={24} />
            </button>

            {/* Logo in navbar — mobile only */}
            <div className="lg:hidden">
              <img src="/logo.png" alt="Nature Biotic" className="h-8 w-auto object-contain" />
            </div>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <button onClick={() => backToCompany()} className="text-slate-400 hover:text-slate-600 font-medium transition-base hidden sm:block">
                Store
              </button>
              <Icon name="chevron_right" size={18} className="text-slate-300 hidden sm:block" />
              <span className="font-semibold text-slate-700 truncate">{store?.name ?? 'Store'}, {store?.location?.split(',')[0] ?? ''}</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              <button className="p-2.5 rounded-xl hover:bg-slate-100 transition-base relative">
                <Icon name="notifications" size={22} className="text-slate-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white" />
              </button>
              <button className="flex items-center gap-2.5 pl-2 sm:pl-3 sm:pr-1 py-1 rounded-xl hover:bg-slate-100 transition-base">
                <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(user?.name ?? 'U').charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-700 leading-tight">{user?.name ?? 'User'}</p>
                  <p className="text-xs text-slate-400">{user?.role ?? 'Administrator'}</p>
                </div>
                <Icon name="expand_more" size={18} className="text-slate-400 hidden sm:block" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div key={active} className="animate-fade-in">{children}</div>
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
  const [openGroup, setOpenGroup] = useState<'purchases' | 'sales' | null>(initialGroup);

  function toggleGroup(key: 'purchases' | 'sales') {
    setOpenGroup((cur) => (cur === key ? null : key));
  }

  return (
    <>
      <div className="border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-center px-5 h-16 relative">
          <img src="/logo.png" alt="Nature Biotic" className="h-12 w-auto object-contain" />
          {onClose && (
            <button onClick={onClose} className="absolute right-3 p-1.5 rounded-lg hover:bg-slate-100 lg:hidden">
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
          if (item.type === 'link') {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-base ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
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
                  isChildActive ? 'text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name={item.icon} size={22} fill={isChildActive} />
                <span className="flex-1 text-left">{item.label}</span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
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
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
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
