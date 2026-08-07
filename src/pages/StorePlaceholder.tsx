import { Icon, Card } from '@/components/ui';

export default function StorePlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
        <p className="text-slate-500 mt-1">{description}</p>
      </div>
      <Card className="p-10">
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Icon name={icon} size={32} className="text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            This section is part of the Nature Biotic store module. Content will be available here soon.
          </p>
        </div>
      </Card>
    </div>
  );
}
