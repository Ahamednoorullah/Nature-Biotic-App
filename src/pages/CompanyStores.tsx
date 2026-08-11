import { useState } from "react";
import { stores as initialStores, type Store } from "@/lib/data";
import { useNav } from "@/context/NavContext";
import { Card, Button, Input, Modal, Icon } from "@/components/ui";

export default function CompanyStores() {
  const { goStore } = useNav();
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    owner: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    gst: "",
    openedDate: "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  function handleSave() {
    const newStore: Store = {
      id: `s${stores.length + 1}`,
      code: form.code || form.name.slice(0, 3).toUpperCase(),
      name: form.name,
      owner: form.owner,
      manager: form.owner,
      location: `${form.city}, ${form.state}`,
      address: form.address,
      gst: form.gst,
      phone: form.phone,
      status: "Active",
      todaySales: 0,
      monthlySales: 0,
      totalProfit: 0,
      outstanding: 0,
      activeCustomers: 0,
      inventoryValue: 0,
      openedDate: form.openedDate || new Date().toISOString().split("T")[0],
    };
    setStores([...stores, newStore]);
    setForm({
      name: "",
      code: "",
      owner: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      gst: "",
      openedDate: "",
    });
    setShowAdd(false);
  }

  const isValid = form.name && form.phone;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Stores
          </h1>
          <p className="text-slate-500 mt-1">
            Manage Nature Biotic retail stores.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Icon name="add" size={20} fill /> Add Store
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {stores.map((store, i) => (
          <Card
            key={store.id}
            className="flex h-full flex-col p-5 animate-fade-in transition-base hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50">
                  <span className="font-bold text-brand-700">{store.code}</span>
                </div>

                <div className="min-w-0">
                  <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">
                    Store {i + 1}
                  </span>
                  <h3 className="mt-1 truncate text-lg font-bold tracking-tight text-slate-800">
                    {store.name}
                  </h3>
                </div>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  store.status === "Active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {store.status}
              </span>
            </div>

            <div className="space-y-3">
              <StoreDetailRow
                icon="person"
                label="Owner Name"
                value={store.owner || "-"}
              />
              <StoreDetailRow
                icon="location_on"
                label="Address"
                value={store.address || store.location || "-"}
              />
              <StoreDetailRow
                icon="receipt_long"
                label="GST Number"
                value={store.gst || "-"}
              />
              <StoreDetailRow
                icon="call"
                label="Phone Number"
                value={store.phone || "-"}
              />
            </div>

            <div className="mt-auto flex gap-2 pt-5">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setSelectedStore(store)}
              >
                <Icon name="visibility" size={17} />
                View
              </Button>

              <Button className="flex-1" onClick={() => goStore(store.id)}>
                <Icon name="dashboard" size={17} />
                Dashboard
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(selectedStore)}
        onClose={() => setSelectedStore(null)}
        title={
          selectedStore
            ? `${selectedStore.name} - Store Details`
            : "Store Details"
        }
        footer={
          selectedStore ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setSelectedStore(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  const storeId = selectedStore.id;
                  setSelectedStore(null);
                  goStore(storeId);
                }}
              >
                <Icon name="dashboard" size={18} />
                Open Dashboard
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedStore && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-bold text-brand-700">
                {selectedStore.code}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {selectedStore.name}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Icon name="location_on" size={16} />
                  {selectedStore.location || "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StoreInfoBox
                icon="person"
                label="Owner Name"
                value={selectedStore.owner || "-"}
              />
              <StoreInfoBox
                icon="call"
                label="Phone Number"
                value={selectedStore.phone || "-"}
              />
              <StoreInfoBox
                icon="receipt_long"
                label="GST Number"
                value={selectedStore.gst || "-"}
              />
              <StoreInfoBox
                icon="badge"
                label="Store Code"
                value={selectedStore.code || "-"}
              />
              <StoreInfoBox
                icon="calendar_month"
                label="Opening Date"
                value={selectedStore.openedDate || "-"}
              />
              <StoreInfoBox
                icon="toggle_on"
                label="Status"
                value={selectedStore.status || "-"}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Full Address
              </p>
              <p className="text-sm leading-6 text-slate-700">
                {selectedStore.address || "-"}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New Store"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save Store
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Store Name"
              value={form.name}
              onChange={(v) => update("name", v)}
              placeholder="e.g. Sairam Agri Input"
              icon="storefront"
              required
            />
            <Input
              label="Store Code / Initial"
              value={form.code}
              onChange={(v) => update("code", v)}
              placeholder="e.g. SAI"
            />
          </div>
          <Input
            label="Owner Name"
            value={form.owner}
            onChange={(v) => update("owner", v)}
            placeholder="e.g. Sairam"
            icon="person"
          />
          <Input
            label="Mobile Number"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="e.g. 9876543210"
            icon="call"
            required
          />
          <Input
            label="Email Address"
            value={form.email}
            onChange={(v) => update("email", v)}
            placeholder="e.g. store@naturebiotic.in"
            icon="mail"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(v) => update("address", v)}
            placeholder="Street address"
            icon="location_on"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="City"
              value={form.city}
              onChange={(v) => update("city", v)}
              placeholder="e.g. Rajapalayam"
            />
            <Input
              label="State"
              value={form.state}
              onChange={(v) => update("state", v)}
              placeholder="e.g. Tamil Nadu"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="GST Number"
              value={form.gst}
              onChange={(v) => update("gst", v)}
              placeholder="e.g. 33ABCDE1234F1Z5"
              icon="receipt_long"
            />
            <Input
              label="Opening Date"
              type="date"
              value={form.openedDate}
              onChange={(v) => update("openedDate", v)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StoreDetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500">
        <Icon name={icon} size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-semibold text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function StoreInfoBox({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icon} size={18} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}
