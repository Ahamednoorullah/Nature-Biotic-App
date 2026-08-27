import { useState } from "react";
import { stores as initialStores, type Store } from "@/lib/data";
import { useNav } from "@/context/NavContext";
import { Card, Button, Input, Modal, Icon } from "@/components/ui";
import { createPortal } from "react-dom";

export default function CompanyStores() {
  const { goStore } = useNav();
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deleteStore, setDeleteStore] = useState<Store | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", code: "", owner: "", phone: "", address: "",
    city: "", district: "", state: "", gst: "", openedDate: "",
  });
  const [form, setForm] = useState({
    name: "",
    code: "",
    owner: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    district: "",
    state: "",
    gst: "",
    outstandinglimit: "",
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
      location: `${form.city},${form.district}, ${form.state}`,
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
      district: "",
      state: "",
      gst: "",
      outstandinglimit: "",
      openedDate: "",
    });
    setShowAdd(false);
  }

  function openEdit(store: Store) {
    const location = (store.location || "").split(",").map((v) => v.trim());
    setEditForm({
      name: store.name || "",
      code: store.code || "",
      owner: store.owner || "",
      phone: store.phone || "",
      address: store.address || "",
      city: location[0] || "",
      district: location[1] || "",
      state: location.slice(2).join(", ") || "",
      gst: store.gst || "",
      openedDate: store.openedDate || "",
    });
    setEditingStore(store);
    setSelectedStore(null);
  }

  function updateEdit(key: keyof typeof editForm, value: string) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleUpdateStore() {
    if (!editingStore || !editForm.name.trim() || !editForm.phone.trim()) return;
    const updated: Store = {
      ...editingStore,
      name: editForm.name.trim(),
      code: editForm.code.trim() || editForm.name.slice(0, 3).toUpperCase(),
      owner: editForm.owner.trim(),
      manager: editForm.owner.trim(),
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
      location: [editForm.city, editForm.district, editForm.state]
        .map((v) => v.trim()).filter(Boolean).join(", "),
      gst: editForm.gst.trim(),
      openedDate: editForm.openedDate,
    };
    setStores((prev) => prev.map((s) => s.id === editingStore.id ? updated : s));
    setEditingStore(null);
  }

  function handleDeleteStore() {
    if (!deleteStore) return;
    setStores((prev) => prev.filter((s) => s.id !== deleteStore.id));
    if (selectedStore?.id === deleteStore.id) setSelectedStore(null);
    setDeleteStore(null);
  }

  const isEditValid = editForm.name.trim() && editForm.phone.trim();

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

      <div className="space-y-4">
        {stores.map((store, i) => (
          <Card
            key={store.id}
            className="p-5 animate-fade-in transition-base hover:shadow-elevated"
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
              {/* Left: store identity + actions */}
              <div className="flex min-w-0 items-start gap-3 self-start xl:w-[27%]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50">
                  <span className="font-bold text-brand-700">{store.code}</span>
                </div>

                <div className="min-w-0">
                  <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">
                    Store {i + 1}
                  </span>

                  <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-800">
                    {store.name}
                  </h3>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedStore(store)}
                    >
                      <Icon name="visibility" size={16} />
                      View
                    </Button>

                    <Button size="sm" onClick={() => goStore(store.id)}>
                      <Icon name="dashboard" size={16} />
                      Open
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right: store information */}
              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StoreDetailRow
                    icon="person"
                    label="Owner"
                    value={store.owner || "-"}
                  />
                  <StoreDetailRow
                    icon="call"
                    label="Phone"
                    value={store.phone || "-"}
                  />
                  <StoreDetailRow
                    icon="receipt_long"
                    label="GST No"
                    value={store.gst || "-"}
                  />
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      name="location_on"
                      size={15}
                      className="mt-0.5 shrink-0 text-slate-400"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Address
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-700">
                        {store.address || store.location || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedStore &&
    createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {selectedStore.name} - Store Details
            </h2>

            <p className="mt-0.5 text-sm text-slate-500">
              Store information and details.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedStore(null)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

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
              icon="location_on"
              label="Location"
              value={selectedStore.location || "-"}
            />
          </div>

          {/* Address + Outstanding Limit */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* Full Address - 2 columns */}
            <div className="xl:col-span-2 rounded-2xl border border-slate-200 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Full Address
              </p>

              <p className="text-sm leading-6 text-slate-700">
                {selectedStore.address || "-"}
              </p>
            </div>

            {/* Outstanding Limit - 1 column */}
            <StoreInfoBox
              icon="wallet"
              label="Outstanding Limit"
              value="₹5,00,000"
            />

          </div>
          </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">

          <Button
            variant="secondary"
            onClick={() => setDeleteStore(selectedStore)}
            className="text-red-600 hover:bg-red-50"
          >
            <Icon name="delete" size={18} />
            Delete
          </Button>

          <Button
            variant="secondary"
            onClick={() => openEdit(selectedStore)}
          >
            <Icon name="edit" size={18} />
            Edit
          </Button>

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

        </div>

      </div>
    </div>,
    document.body
  )}

      {editingStore &&
        createPortal(
          <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[88vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Edit Store</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Update store information.</p>
                </div>
                <button type="button" onClick={() => setEditingStore(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700">
                  <Icon name="close" size={19} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <Input label="Store Name" value={editForm.name} onChange={(v) => updateEdit("name", v)} icon="storefront" required />
                  <Input label="Store Code / Initial" value={editForm.code} onChange={(v) => updateEdit("code", v)} />
                  <Input label="Owner Name" value={editForm.owner} onChange={(v) => updateEdit("owner", v)} icon="person" />
                  <Input label="Mobile Number" value={editForm.phone} onChange={(v) => updateEdit("phone", v)} icon="call" required />
                  <Input label="GST Number" value={editForm.gst} onChange={(v) => updateEdit("gst", v)} icon="receipt_long" />
                  <Input label="Opening Date" type="date" value={editForm.openedDate} onChange={(v) => updateEdit("openedDate", v)} />
                  <Input label="City" value={editForm.city} onChange={(v) => updateEdit("city", v)} />
                  <Input label="District" value={editForm.district} onChange={(v) => updateEdit("district", v)} />
                  <Input label="State" value={editForm.state} onChange={(v) => updateEdit("state", v)} />
                  <div className="md:col-span-2 xl:col-span-3">
                    <Input label="Address" value={editForm.address} onChange={(v) => updateEdit("address", v)} icon="location_on" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setEditingStore(null)}>Cancel</Button>
                <Button onClick={handleUpdateStore} disabled={!isEditValid}>
                  <Icon name="save" size={18} /> Update Store
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {deleteStore &&
        createPortal(
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
            <div className="w-[94vw] max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <Icon name="delete" size={24} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Delete Store?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteStore.name}</span>?
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setDeleteStore(null)}>Cancel</Button>
                <Button onClick={handleDeleteStore} className="bg-red-600 hover:bg-red-700">
                  <Icon name="delete" size={18} /> Delete Store
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[88vh] w-[94vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Add New Store
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Enter the store information below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={19} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                    label="GST Number"
                    value={form.gst}
                    onChange={(v) => update("gst", v)}
                    placeholder="e.g. 33ABCDE1234F1Z5"
                    icon="receipt_long"
                  />
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(v) => update("city", v)}
                    placeholder="e.g. Rajapalayam"
                  />

                  <Input
                    label="District"
                    value={form.district}
                    onChange={(v) => update("district", v)}
                    placeholder="e.g. Virudhunagar"
                  />
                  <Input
                    label="State"
                    value={form.state}
                    onChange={(v) => update("state", v)}
                    placeholder="e.g. Tamil Nadu"
                  />
                  {/* Address spans two columns */}
                  <div className="md:col-span-1 xl:col-span-1">
                    <Input
                      label="Address"
                      value={form.address}
                      onChange={(v) => update("address", v)}
                      placeholder="Street address"
                      icon="location_on"
                    />
                  </div>

                  <div className="md:col-span-1 xl:col-span-1">
                    <Input
                      label="Outstanding Limit"
                      value={form.outstandinglimit}
                      onChange={(v) => update("outstandinglimit", v)}
                      placeholder="5,00,000"
                      icon="wallet"
                    />
                  </div>

                  {/* Opening Date occupies the remaining one column */}
                  <div className="xl:col-span-1">
                    <Input
                      label="Opening Date"
                      type="date"
                      value={form.openedDate}
                      onChange={(v) => update("openedDate", v)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!isValid}>
                  <Icon name="save" size={18} />
                  Save Store
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
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
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon name={icon} size={14} className="shrink-0 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>
      <p className="break-words text-sm font-semibold leading-5 text-slate-700">
        {value}
      </p>
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
