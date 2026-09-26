import { useMemo, useState } from "react";
import { getFarmersByStore } from "@/lib/data";
import { Icon } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/context/NavContext";

type FROVisitsProps = { storeId: string };

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function FROVisits({ storeId }: FROVisitsProps) {
  const { goStorePage } = useNav();
  const { user } = useAuth();
  const farmers = useMemo(() => {
    const froName = String(user?.name || "").trim().toLowerCase();

    return getFarmersByStore(storeId).filter((farmer: any) => {
      const through = String(farmer.through || "").trim().toLowerCase();
      const executiveName = String(farmer.executiveName || "").trim().toLowerCase();

      return (
        through === "executive" &&
        !!froName &&
        executiveName === froName
      );
    });
  }, [storeId, user?.name]);

  const [showVisitHistory, setShowVisitHistory] = useState(false);
  const [activeModule, setActiveModule] = useState<"farms" | "crops" | null>(null);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [date, setDate] = useState(today());
  const [farmerMode, setFarmerMode] = useState<"old" | "new">("old");
  const [farmerId, setFarmerId] = useState("");
  const [newFarmerName, setNewFarmerName] = useState("");
  const [newVillage, setNewVillage] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [refresh, setRefresh] = useState(0);

  const currentFroVisits = useMemo(() => {
    const key = `nature-biotic-fro-visits-v1:${storeId}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      return (Array.isArray(saved) ? saved : []).filter(
        (item: any) =>
          String(item.froId || "").toLowerCase() ===
            String(user?.id || "").toLowerCase() ||
          String(item.froName || "").trim().toLowerCase() ===
            String(user?.name || "").trim().toLowerCase(),
      );
    } catch {
      return [];
    }
  }, [storeId, user?.id, user?.name, refresh]);

  const farmerVisitRows = useMemo(() => {
    const grouped = new Map<string, any>();

    currentFroVisits.forEach((visit: any) => {
      const key =
        String(visit.farmerId || "").trim() ||
        `${String(visit.farmerName || "").trim().toLowerCase()}-${String(
          visit.phone || "",
        )}`;

      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          farmer: visit.farmerName || "-",
          village: visit.village || "-",
          phone: visit.phone || "-",
          count: 1,
          lastVisit: visit.date || "",
        });
      } else {
        existing.count += 1;
        if (String(visit.date || "") > String(existing.lastVisit || "")) {
          existing.lastVisit = visit.date;
          existing.village = visit.village || existing.village;
          existing.phone = visit.phone || existing.phone;
        }
      }
    });

    return Array.from(grouped.values())
      .sort((a, b) => String(b.lastVisit).localeCompare(String(a.lastVisit)))
      .map((item, index) => ({ ...item, sno: index + 1 }));
  }, [currentFroVisits]);

  const selectedFarmer = useMemo(
    () => farmers.find((item: any) => String(item.id) === farmerId),
    [farmers, farmerId],
  );

  // Farms/Crops show only the farmers assigned to the logged-in FRO.
  // Each farmer is shown once; land is the total of all their crops.
  const farmRows = useMemo(() => {
    return farmers.map((farmer: any) => {
      const crops =
        Array.isArray(farmer.crops) && farmer.crops.length
          ? farmer.crops
          : [
              {
                cropType: farmer.cropType || "",
                landSize: Number(farmer.landSize || 0),
              },
            ];

      const totalLand = crops.reduce(
        (sum: number, crop: any) => sum + Number(crop.landSize || 0),
        0,
      );

      return {
        id: farmer.id,
        farmerName: farmer.name || "-",
        phone: farmer.phone || "-",
        village: farmer.village || "-",
        farmAddress: farmer.farmAddress || "-",
        totalLand,
      };
    });
  }, [farmers]);

  const cropRows = useMemo(() => {
    return farmers.map((farmer: any) => {
      const crops =
        Array.isArray(farmer.crops) && farmer.crops.length
          ? farmer.crops
          : [
              {
                cropType: farmer.cropType || "",
                landSize: Number(farmer.landSize || 0),
              },
            ];

      const totalLand = crops.reduce(
        (sum: number, crop: any) => sum + Number(crop.landSize || 0),
        0,
      );

      return {
        id: farmer.id,
        farmerName: farmer.name || "-",
        phone: farmer.phone || "-",
        crops,
        totalLand,
      };
    });
  }, [farmers]);

  function resetVisitForm() {
    setDate(today());
    setFarmerMode("old");
    setFarmerId("");
    setNewFarmerName("");
    setNewVillage("");
    setNewPhone("");
  }

  function saveVisit() {
    if (!date) return;

    const farmerName =
      farmerMode === "old"
        ? String(selectedFarmer?.name || "").trim()
        : newFarmerName.trim();

    if (!farmerName) return;

    const visit = {
      id: `visit-${Date.now()}`,
      storeId,
      froId: user?.id || "",
      froName: user?.name || "",
      date,
      farmerId: farmerMode === "old" ? farmerId : "",
      farmerName,
      village:
        farmerMode === "old"
          ? selectedFarmer?.village || ""
          : newVillage.trim(),
      phone:
        farmerMode === "old"
          ? selectedFarmer?.phone || ""
          : newPhone.trim(),
      createdAt: new Date().toISOString(),
    };

    const key = `nature-biotic-fro-visits-v1:${storeId}`;

    try {
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(
        key,
        JSON.stringify([
          visit,
          ...(Array.isArray(current) ? current : []),
        ]),
      );
      window.dispatchEvent(new Event("nature-biotic-fro-visits-updated"));
    } catch {
      // Keep the form usable if browser storage is unavailable.
    }

    setShowVisitForm(false);
    resetVisitForm();
    setRefresh((value) => value + 1);
  }

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

  if (activeModule) {
    const isFarms = activeModule === "farms";
    const rows = isFarms ? farmRows : cropRows;

    return (
      <section className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModule(null)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Back"
          >
            <Icon name="arrow_back" size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-800">
              {isFarms ? "Farms" : "Crops"}
            </h1>
            <p className="text-xs text-slate-500">Details from Farmer Management</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[30%]" />
              <col className="w-[40%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500">
                <th className="px-1.5 py-3 text-center font-bold">S.No</th>
                <th className="px-1.5 py-3 text-left font-bold">Farmer Details</th>
                <th className="px-1.5 py-3 text-left font-bold">{isFarms ? "Farms" : "Crops"}</th>
                <th className="px-1.5 py-3 text-center font-bold">Land</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.length ? (
                rows.map((row: any, index: number) => (
                  <tr
                    key={row.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                  >
                    <td className="px-1.5 py-3 text-center align-top font-semibold text-slate-500">
                      {index + 1}
                    </td>

                    <td className="px-1.5 py-3 align-top">
                      <p className="break-words font-semibold leading-tight text-slate-800">
                        {row.farmerName}
                      </p>
                      <p className="mt-0.5 break-all text-[9px] text-slate-400">
                        {row.phone}
                      </p>
                    </td>

                    <td className="px-1.5 py-3 align-top text-slate-600">
                      {isFarms ? (
                        <div className="space-y-0.5 break-words leading-tight">
                          <p>{row.farmAddress}</p>
                          <p className="text-slate-400">{row.village}</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5 leading-tight">
                          {row.crops.map((crop: any, cropIndex: number) => (
                            <p key={`${row.id}-crop-${cropIndex}`} className="break-words font-semibold text-slate-700">
                              {crop.cropType || "-"}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-1.5 py-3 text-center align-top font-semibold text-slate-700">
                      {Number(row.totalLand || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })} acre
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">
                    No {isFarms ? "farm" : "crop"} details found for this FRO.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (showVisitForm && showVisitHistory) {
    return (
      <section className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowVisitForm(false);
              resetVisitForm();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Back to Visits"
          >
            <Icon name="arrow_back" size={20} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Add Visit</h1>
            <p className="text-xs text-slate-500">Record a farmer visit</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">FRO</p>
            <h2 className="text-base font-extrabold text-slate-800">Visit Details</h2>
          </div>

          <div className="space-y-4 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Farmer</span>
              <div className="mb-2 flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setFarmerMode("old")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${farmerMode === "old" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
                >
                  Existing Farmer
                </button>
                <button
                  type="button"
                  onClick={() => setFarmerMode("new")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${farmerMode === "new" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
                >
                  New Farmer
                </button>
              </div>

              {farmerMode === "old" ? (
                <select
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand-500"
                >
                  <option value="">Select farmer</option>
                  {farmers.map((farmer: any) => (
                    <option key={farmer.id} value={farmer.id}>
                      {farmer.name} - {farmer.village || "-"}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={newFarmerName}
                  onChange={(e) => setNewFarmerName(e.target.value)}
                  placeholder="Enter farmer name"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-brand-500"
                />
              )}
            </div>

            {farmerMode === "old" && selectedFarmer ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] text-slate-400">Village</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{selectedFarmer.village || "-"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] text-slate-400">Phone</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{selectedFarmer.phone || "-"}</p>
                </div>
              </div>
            ) : farmerMode === "new" ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newVillage}
                  onChange={(e) => setNewVillage(e.target.value)}
                  placeholder="Village"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-brand-500"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone number"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-brand-500"
                />
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => {
                setShowVisitForm(false);
                resetVisitForm();
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={saveVisit}
              disabled={!date || (farmerMode === "old" ? !farmerId : !newFarmerName.trim())}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Visit
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (showVisitHistory) {
    return (
      <section className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVisitHistory(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Back"
            >
              <Icon name="arrow_back" size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-slate-800">Visits</h1>
              <p className="text-xs text-slate-500">Visit history</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowVisitForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm"
          >
            <Icon name="add" size={17} />
            Add Visit
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="w-[14%] px-2 py-3 text-center font-bold">S.No</th>
                <th className="w-[66%] px-3 py-3 text-left font-bold">
                  Farmer Details
                </th>
                <th className="w-[20%] px-2 py-3 text-center font-bold">
                  Count
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {farmerVisitRows.length ? (
                farmerVisitRows.map((row) => (
                  <tr key={`${row.sno}-${row.farmer}-${row.phone}`}>
                    <td className="px-2 py-3 text-center font-medium text-slate-500">
                      {row.sno}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold leading-tight text-slate-800">
                        {row.farmer}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {row.village || "-"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {row.phone || "-"}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-center font-bold text-brand-700">
                      {row.count}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    No visits recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md lg:max-w-none px-3 pb-24 pt-3 sm:px-4 sm:pt-4">
      <div className="grid grid-cols-2 gap-3">
        {visitModules.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (item.label === "Visits") {
                setShowVisitHistory(true);
              } else if (item.label === "Farmers") {
                goStorePage("farmers");
              } else if (item.label === "Farms") {
                setActiveModule("farms");
              } else if (item.label === "Crops") {
                setActiveModule("crops");
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
                {item.label === "Visits" ? "View visit history" : "View & manage"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
