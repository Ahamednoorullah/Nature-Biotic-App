import type { Product } from '@/lib/data';
import { Card, Badge, Button, Icon, SectionTitle } from '@/components/ui';
import { formatCurrency, initials } from '@/lib/format';

const colorMap: Record<string, string> = {
  emerald: 'from-emerald-400 to-emerald-600',
  teal: 'from-teal-400 to-teal-600',
  red: 'from-red-400 to-red-600',
  amber: 'from-amber-400 to-amber-600',
  blue: 'from-blue-400 to-blue-600',
  purple: 'from-purple-400 to-purple-600',
};

export default function CompanyProductDetail({
  product,
  onBack,
}: {
  product: Product;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500">
          <span className="material-symbols-rounded" style={{ fontSize: 22 }}>arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{product.name}</h1>
          <p className="text-slate-500 mt-1">Product master details</p>
        </div>
      </div>

      {/* Identity card */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${colorMap[product.imageColor] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-xl shrink-0`}>
            {initials(product.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-slate-800">{product.name}</h2>
              <Badge color="blue">{product.productType}</Badge>
            </div>
            <p className="text-sm text-slate-500">{product.manufacturer}</p>
            <p className="text-sm text-slate-400 mt-0.5">{product.vendor}</p>
          </div>
          <Button variant="secondary" size="sm">
            <Icon name="edit" size={16} /> Edit
          </Button>
        </div>
      </Card>

      {/* Pricing & tax */}
      <Card className="p-6 mb-6">
        <SectionTitle icon="payments" title="Pricing & Tax" description="Pricing and tax configuration for this product." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DetailField label="Selling Price" value={formatCurrency(product.sellingPrice)} />
          <DetailField label="MRP" value={formatCurrency(product.mrp)} />
          <DetailField label="Purchase Price" value={formatCurrency(product.purchasePrice)} />
          <DetailField label="Tax Percentage" value={`${product.taxPercentage}%`} />
          <DetailField label="Tax Type" value={product.taxType} />
          <DetailField label="SGST" value={`${product.sgst}%`} />
          <DetailField label="CGST" value={`${product.cgst}%`} />
          <DetailField label="IGST" value={`${product.igst}%`} />
        </div>
      </Card>

      {/* Product details */}
      <Card className="p-6 mb-6">
        <SectionTitle icon="inventory_2" title="Product Details" description="Unit, size, and identification codes." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DetailField label="Unit Type" value={product.unit} />
          <DetailField label="Pack Size" value={product.size} />
          <DetailField label="HSN / SAC Code" value={product.hsnCode} />
          <DetailField label="Status" value={product.status} />
        </div>
      </Card>

      {/* Additional info */}
      <Card className="p-6">
        <SectionTitle icon="description" title="Additional Information" description="Description, usage, safety, and storage." />
        <div className="space-y-4">
          <InfoBlock label="Product Description" value={product.description} />
          <InfoBlock label="Usage Instructions" value={product.usageInstructions} />
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoBlock label="Safety Information" value={product.safetyInfo} />
            <InfoBlock label="Storage Instructions" value={product.storageInfo} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-1.5">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-sm text-slate-600 leading-relaxed">{value}</p>
    </div>
  );
}
