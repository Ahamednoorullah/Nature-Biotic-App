import { useNav } from '@/context/NavContext';
import ProductAddForm from '@/components/ProductAddForm';

export default function StoreAddProduct({ storeId: _storeId }: { storeId: string }) {
  const { goStorePage } = useNav();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => goStorePage('stock-management')}
          className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 22 }}>arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Add New Product</h1>
          <p className="text-slate-500 mt-1">Create a new product entry for your catalog.</p>
        </div>
      </div>
      <ProductAddForm onCancel={() => goStorePage('stock-management')} onSaved={() => goStorePage('stock-management')} />
    </div>
  );
}
