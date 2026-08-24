import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NavProvider, useNav } from "@/context/NavContext";
import { Spinner } from "@/components/ui";
import Login from "@/pages/Login";
import CompanyShell from "@/components/CompanyShell";
import CompanyDashboard from "@/pages/CompanyDashboard";
import CompanyProducts from "@/pages/CompanyProducts";
import CompanyStores from "@/pages/CompanyStores";
import CompanySales from "@/pages/CompanySales";
import CompanyPurchaseOrders from "@/pages/CompanyPurchaseOrders";
import CompanyStaffManagement from "@/pages/CompanyStaffManagement";
import CompanyCreditNotes from "@/pages/CompanyCreditNotes";
import CompanyReceipts from "@/pages/CompanyReceipts";
import CompanyReports from "@/pages/CompanyReports";
import StoreShell from "@/components/StoreShell";
import StoreDashboard from "@/pages/StoreDashboard";
import StoreInventory from "@/pages/StoreInventory";
import StoreFarmers from "@/pages/StoreFarmers";
import StoreReports from "@/pages/StoreReports";
import StoreAddProduct from "@/pages/StoreAddProduct";
import StoreAddFarmer from "@/pages/StoreAddFarmer";
import StoreFarmerProfile from "@/pages/StoreFarmerProfile";
import StoreInventoryDetail from "@/pages/StoreInventoryDetail";
import StoreAddStock from "@/pages/StoreAddStock";
import StoreStockAdjustment from "@/pages/StoreStockAdjustment";
import StoreLowStock from "@/pages/StoreLowStock";
import StorePlaceholder from "@/pages/StorePlaceholder";
import StorePurchases from "@/pages/StorePurchases";
import StoreDebitNotes from "@/pages/StoreDebitNotes";
import StorePayments from "@/pages/StorePayments";
import StoreExpenses from "@/pages/StoreExpenses";
import StoreSales from "@/pages/StoreSales";
import StoreQuotation from "@/pages/StoreQuotation";
import StoreSalesInvoice from "@/pages/StoreSalesInvoice";
import StoreDeliveryChallan from "@/pages/StoreDeliveryChallan";
import StoreReturnChallan from "@/pages/StoreReturnChallan";
import StoreReceipt from "@/pages/StoreReceipt";
import StoreRefund from "@/pages/StoreRefund";
import StorePurchaseReturn from "@/pages/StorePurchaseReturn";
import StorePurchaseOrder from "@/pages/StorePurchaseOrder";
import StoreSalesReturn from "@/pages/StoreSalesReturn";
import StoreCreditNotes from "@/pages/StoreCreditNotes";

function AppContent() {
  const { user, loading } = useAuth();
  const { route } = useNav();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner className="text-4xl text-brand-600" />
      </div>
    );
  }

  if (!user) return <Login />;

  // Company-level views
  if (route.view === "company") {
    return (
      <CompanyShell active={route.page}>
        {route.page === "dashboard" && <CompanyDashboard />}
        {route.page === "products" && <CompanyProducts />}
        {route.page === "stores" && <CompanyStores />}
        {route.page === "sales" && <CompanySales />}
        {route.page === "purchase-orders" && <CompanyPurchaseOrders />}
        {route.page === "staff-management" && <CompanyStaffManagement />}
        {route.page === "credit-notes" && <CompanyCreditNotes />}
        {route.page === "receipts" && <CompanyReceipts />}
        {route.page === "reports" && <CompanyReports />}
      </CompanyShell>
    );
  }

  // Store-level views
  return (
    <StoreShell storeId={route.storeId} active={route.page}>
      {route.page === "dashboard" && <StoreDashboard storeId={route.storeId} />}
      {route.page === "stock-management" && (
        <StoreInventory storeId={route.storeId} />
      )}
      {route.page === "purchase-order" && (
        <StorePurchaseOrder storeId={route.storeId} />
      )}
      {route.page === "purchases" && <StorePurchases storeId={route.storeId} />}
      {route.page === "debit-notes" && (
        <StoreDebitNotes storeId={route.storeId} />
      )}
      {route.page === "payments" && <StorePayments storeId={route.storeId} />}
      {route.page === "expenses" && <StoreExpenses storeId={route.storeId} />}
      {route.page === "return-stock" && (
        <StorePurchaseReturn storeId={route.storeId} />
      )}
      {route.page === "sales" && <StoreSales storeId={route.storeId} />}
      {route.page === "credit-notes" && (
        <StoreCreditNotes storeId={route.storeId} />
      )}
      {route.page === "farmers" && <StoreFarmers storeId={route.storeId} />}
      {route.page === "quotation" && <StoreQuotation storeId={route.storeId} />}
      {route.page === "delivery-challan" && (
        <StoreDeliveryChallan storeId={route.storeId} />
      )}
      {route.page === "return-challan" && (
        <StoreReturnChallan storeId={route.storeId} />
      )}
      {route.page === "sales-invoice" && (
        <StoreSalesInvoice storeId={route.storeId} />
      )}
      {route.page === "sales-return" && (
        <StoreSalesReturn storeId={route.storeId} />
      )}
      {route.page === "receipt" && <StoreReceipt storeId={route.storeId} />}
      {route.page === "refund" && <StoreRefund storeId={route.storeId} />}
      {route.page === "attendance" && (
        <StorePlaceholder
          title="Attendance"
          description="Staff attendance for this store."
          icon="badge"
        />
      )}
      {route.page === "reports" && <StoreReports storeId={route.storeId} />}
      {route.page === "add-product" && (
        <StoreAddProduct storeId={route.storeId} />
      )}
      {route.page === "add-farmer" && (
        <StoreAddFarmer storeId={route.storeId} />
      )}
      {route.page === "farmer-profile" && route.farmerId && (
        <StoreFarmerProfile storeId={route.storeId} farmerId={route.farmerId} />
      )}
      {route.page === "inventory-detail" && route.productId && (
        <StoreInventoryDetail
          storeId={route.storeId}
          productId={route.productId}
        />
      )}
      {route.page === "add-stock" && <StoreAddStock storeId={route.storeId} />}
      {route.page === "stock-adjustment" && (
        <StoreStockAdjustment storeId={route.storeId} />
      )}
      {route.page === "low-stock" && <StoreLowStock storeId={route.storeId} />}
    </StoreShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <NavProvider>
        <AppContent />
      </NavProvider>
    </AuthProvider>
  );
}

export default App;
