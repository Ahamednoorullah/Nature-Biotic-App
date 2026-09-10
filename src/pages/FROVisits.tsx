import { Icon } from "@/components/ui";
import { useNav } from "@/context/NavContext";

type FROVisitsProps = { storeId: string };

const visitModules = [
  { label: "Visits", icon: "event_available" },
  { label: "Farmers", icon: "groups" },
  { label: "Farms", icon: "agriculture" },
  { label: "Crops", icon: "grass" },
  { label: "Pests", icon: "bug_report" },
  { label: "Disease", icon: "coronavirus" },
  { label: "Nutrients", icon: "eco" },
  { label: "Others", icon: "more_horiz" },
];

export default function FROVisits({ storeId }: FROVisitsProps) {
  const { goStorePage } = useNav();

  return (
    <section className="px-3 pt-3 pb-24 sm:px-4 sm:pt-4 max-w-md mx-auto">
      {/* <div className="px-1 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
          FRO
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Visits
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your field visit activities
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-[10px] font-bold text-brand-700">
            {storeId}
          </span>
        </div>
      </div> */}

      <div className="grid grid-cols-2 gap-3">
        {visitModules.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (item.label === "Farmers") {
                goStorePage("farmers");
              }
            }}
            className="group flex min-h-[128px] flex-col items-start justify-between rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition active:scale-[0.98]"
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon name={item.icon} size={24} fill={index === 0} />
              </span>
              <Icon
                name="chevron_right"
                size={18}
                className="text-slate-300 transition group-hover:text-brand-500"
              />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                {item.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                View &amp; manage
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
