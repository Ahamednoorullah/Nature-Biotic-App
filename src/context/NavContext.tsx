import { createContext, useContext, useState, type ReactNode } from 'react';

export type CompanyPage =
  | 'dashboard'
  | 'products'
  | 'stores'
  | 'sales'
  | 'staff-management'
  | 'credit-notes'
  | 'receipts'
  | 'reports';
export type StorePage =
  | 'dashboard'
  | 'purchases'
  | 'debit-notes'
  | 'return-stock'
  | 'payments'
  | 'expenses'
  | 'stock-management'
  | 'sales'
  | 'farmers'
  | 'quotation'
  | 'delivery-challan'
  | 'return-challan'
  | 'sales-invoice'
  | 'credit-notes'
  | 'receipt'
  | 'refund'
  | 'attendance'
  | 'reports'
  | 'add-product'
  | 'add-farmer'
  | 'farmer-profile'
  | 'inventory-detail'
  | 'add-stock'
  | 'stock-adjustment'
  | 'low-stock';

type Route =
  | { view: 'company'; page: CompanyPage }
  | { view: 'store'; storeId: string; page: StorePage; farmerId?: string; productId?: string };

type NavContextValue = {
  route: Route;
  goCompany: (page: CompanyPage) => void;
  goStore: (storeId: string, page?: StorePage) => void;
  goStorePage: (page: StorePage) => void;
  goFarmerProfile: (farmerId: string) => void;
  goProductDetail: (productId: string) => void;
  backToCompany: (page?: CompanyPage) => void;
};

const NavContext = createContext<NavContextValue | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ view: 'company', page: 'dashboard' });

  const goCompany = (page: CompanyPage) => setRoute({ view: 'company', page });
  const goStore = (storeId: string, page: StorePage = 'dashboard') =>
    setRoute({ view: 'store', storeId, page });
  const goStorePage = (page: StorePage) => {
    setRoute((prev) =>
      prev.view === 'store' ? { ...prev, page, farmerId: undefined, productId: undefined } : prev
    );
  };
  const goFarmerProfile = (farmerId: string) => {
    setRoute((prev) =>
      prev.view === 'store' ? { ...prev, page: 'farmer-profile', farmerId } : prev
    );
  };
  const goProductDetail = (productId: string) => {
    setRoute((prev) =>
      prev.view === 'store' ? { ...prev, page: 'inventory-detail', productId } : prev
    );
  };
  const backToCompany = (page: CompanyPage = 'dashboard') =>
    setRoute({ view: 'company', page });

  return (
    <NavContext.Provider value={{ route, goCompany, goStore, goStorePage, goFarmerProfile, goProductDetail, backToCompany }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
