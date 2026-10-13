import { useState } from "react";
import {
  getStores,
  replaceStoreRegistry,
  getCompanyStoreOutstanding,
  parseOutstandingLimitInput,
  resolveStoreOutstandingLimit,
  resolveStoreOutstandingLimitAction,
  getOutstandingLimitStatus,
  DEFAULT_STORE_OUTSTANDING_LIMIT,
  type Store,
} from "@/lib/data";
import { getAuthAdapter } from "@/lib/auth/localAuth";
import { createStore, deleteStore as removeStore, storeAdminEmails, updateStore } from "@/lib/db/stores";
import { dbErrorMessage } from "@/lib/db/errors";
import { usesSupabaseData } from "@/lib/db/mode";
import { useNav } from "@/context/NavContext";
import { Card, Button, Input, Select, Badge, Icon } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { createPortal } from "react-dom";

export default function CompanyStores() {
  const { goStore } = useNav();
  const [stores, setStores] = useState<Store[]>(() => [...getStores()]);
  const [accountNotice, setAccountNotice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [canReassignLogin, setCanReassignLogin] = useState(false);
  const [canResendLogin, setCanResendLogin] = useState(false);
  const [invitedStoreEmails, setInvitedStoreEmails] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deleteStore, setDeleteStore] = useState<Store | null>(null);
  const [deleteAdmins, setDeleteAdmins] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editForm, setEditForm] = useState({
  name: "", code: "", owner: "", phone: "", address: "",
  city: "", district: "", state: "", gst: "", openedDate: "",
  outstandinglimit: "",
  outstandingLimitAction: "warn" as "warn" | "block",
  bankAccountName: "", bankAccountNo: "", bankIfsc: "",
  bankName: "", bankBranch: "", bankUpiId: "",
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
  outstandingLimitAction: "warn",
  openedDate: "",
  bankAccountName: "",
  bankAccountNo: "",
  bankIfsc: "",
  bankName: "",
  bankBranch: "",
  bankUpiId: "",
});

  function update(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  function openStoreDetails(store: Store) {
    setInviteEmail("");
    setInviteError("");
    setInviteNotice("");
    setCanReassignLogin(false);
    setCanResendLogin(false);
    setSelectedStore(store);
  }

  async function inviteStoreAdmin(action: { reassign?: boolean; resend?: boolean } = {}) {
    if (!selectedStore || inviteBusy) return;
    const reassign = action.reassign === true;
    const resend = action.resend === true;
    const email = inviteEmail.trim().toLowerCase();
    setInviteError("");
    setInviteNotice("");
    setCanReassignLogin(false);
    setCanResendLogin(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    if (selectedStore.status !== "Active") {
      setInviteError("An inactive store cannot have a login.");
      return;
    }
    if (!reassign && !resend && invitedStoreEmails[selectedStore.id] === email) {
      setInviteError("An invitation was already sent to this email.");
      return;
    }
    const fullName = selectedStore.owner.trim() || selectedStore.name.trim();
    if (!fullName) {
      setInviteError("Enter the store administrator's name.");
      return;
    }
    setInviteBusy(true);
    const created = await getAuthAdapter().createAccount({
      name: fullName,
      email,
      role: "store_admin",
      subjectType: "store",
      subjectId: selectedStore.id,
      storeId: selectedStore.id,
      reassign,
      resend,
    });
    setInviteBusy(false);
    if (!created.account) {
      setCanReassignLogin(created.canReassign === true);
      setCanResendLogin(created.canResend === true);
      setInviteError(created.error || "The store login could not be created.");
      return;
    }
    setInvitedStoreEmails((current) => ({
      ...current,
      [selectedStore.id]: email,
    }));
    setInviteEmail("");
    setInviteNotice(
      created.passwordSetupResent
        ? `Password setup email sent again to ${email}. Open that email, set a password, then sign in. The store assignment was not changed.`
        : created.reassigned
        ? `${email} now administers this store. After the next sign-in, that account can no longer open the previous store.`
        : created.linkedExisting
          ? `${email} already had a login that was not assigned to a store. It is now the administrator for this store and can sign in with the current password.`
          : `Store login invited for ${email}. A password setup email was sent. They set the password from that email, then sign in.`,
    );
  }

  async function handleSave() {
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.alert("Enter a valid email address.");
      return;
    }
    const newStore: Store = {
  id: `s-${Date.now()}`,
  code: form.code || form.name.slice(0, 3).toUpperCase(),
  name: form.name,
  owner: form.owner,
  manager: form.owner,
  location: `${form.city},${form.district}, ${form.state}`,
  address: form.address,
  gst: form.gst,
  phone: form.phone,
  email,
  status: "Active",
  todaySales: 0,
  monthlySales: 0,
  totalProfit: 0,
  outstanding: 0,
  outstandingLimit:
    parseOutstandingLimitInput(form.outstandinglimit) ??
    DEFAULT_STORE_OUTSTANDING_LIMIT,
  outstandingLimitAction:
    form.outstandingLimitAction === "block" ? "block" : "warn",
  activeCustomers: 0,
  inventoryValue: 0,
  openedDate: form.openedDate || new Date().toISOString().split("T")[0],
  bankAccountName: form.bankAccountName,
  bankAccountNo: form.bankAccountNo,
  bankIfsc: form.bankIfsc,
  bankName: form.bankName,
  bankBranch: form.bankBranch,
  bankUpiId: form.bankUpiId,
} as Store;

    if (usesSupabaseData()) {
      try {
        const id = await createStore(newStore);
        const created = await getAuthAdapter().createAccount({
          name: form.owner.trim() || form.name.trim(),
          email,
          role: "store_admin",
          subjectType: "store",
          subjectId: id,
          storeId: id,
        });
        setStores(getStores());
        setAccountNotice(
          created.account
            ? `Store account created for ${email}. A password setup email was sent. They set the password from that email, then sign in here.`
            : `Store saved. Login was not created: ${created.error || "The store login could not be created."}`,
        );
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
          outstandingLimitAction: "warn",
          openedDate: "",
          bankAccountName: "",
          bankAccountNo: "",
          bankIfsc: "",
          bankName: "",
          bankBranch: "",
          bankUpiId: "",
        });
        setShowAdd(false);
      } catch (error) {
        window.alert(dbErrorMessage(error, "Could not save the store."));
      }
      return;
    }

    const created = await getAuthAdapter().createAccount({
      name: form.owner.trim() || form.name.trim(),
      email,
      role: "store_admin",
      subjectType: "store",
      subjectId: newStore.id,
      storeId: newStore.id,
    });
    if (!created.account) {
      window.alert(created.error || "Could not create the store account.");
      return;
    }
    newStore.accountId = created.account.id;

    const nextStores = [...stores, newStore];
    replaceStoreRegistry(nextStores);
    setStores(nextStores);
    setAccountNotice(
      `Store account created for ${email}. They can set a password the first time they sign in.`,
    );
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
  outstandingLimitAction: "warn",
  openedDate: "",
  bankAccountName: "",
  bankAccountNo: "",
  bankIfsc: "",
  bankName: "",
  bankBranch: "",
  bankUpiId: "",
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
    outstandinglimit:
      typeof store.outstandingLimit === "number"
        ? String(store.outstandingLimit)
        : "",
    outstandingLimitAction: resolveStoreOutstandingLimitAction(store),
    bankAccountName: (store as any).bankAccountName || "",
    bankAccountNo: (store as any).bankAccountNo || "",
    bankIfsc: (store as any).bankIfsc || "",
    bankName: (store as any).bankName || "",
    bankBranch: (store as any).bankBranch || "",
    bankUpiId: (store as any).bankUpiId || "",
  });
  setEditingStore(store);
  setSelectedStore(null);
}

  function updateEdit(key: keyof typeof editForm, value: string) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpdateStore() {
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
    outstandingLimit:
      parseOutstandingLimitInput(editForm.outstandinglimit) ??
      editingStore.outstandingLimit,
    outstandingLimitAction: editForm.outstandingLimitAction,
    bankAccountName: editForm.bankAccountName.trim(),
    bankAccountNo: editForm.bankAccountNo.trim(),
    bankIfsc: editForm.bankIfsc.trim(),
    bankName: editForm.bankName.trim(),
    bankBranch: editForm.bankBranch.trim(),
    bankUpiId: editForm.bankUpiId.trim(),
  } as Store;
  if (usesSupabaseData()) {
    try {
      await updateStore(updated);
      setStores(getStores());
      setEditingStore(null);
    } catch (error) {
      window.alert(dbErrorMessage(error, "Could not update the store."));
    }
    return;
  }
  setStores((prev) => {
    const next = prev.map((s) => (s.id === editingStore.id ? updated : s));
    replaceStoreRegistry(next);
    return next;
  });
  setEditingStore(null);
}

  async function askDeleteStore(store: Store) {
    setDeleteError("");
    setDeleteAdmins([]);
    setDeleteStore(store);
    if (!usesSupabaseData()) return;
    try {
      setDeleteAdmins(await storeAdminEmails(store.id));
    } catch (error) {
      setDeleteError(dbErrorMessage(error, "Could not check this store's logins."));
    }
  }

  async function handleDeleteStore() {
    if (!deleteStore || deleteBusy) return;
    if (usesSupabaseData()) {
      setDeleteBusy(true);
      setDeleteError("");
      try {
        const removedName = deleteStore.name;
        const removedCode = deleteStore.code;
        await removeStore(deleteStore.id);
        setStores(getStores());
        if (selectedStore?.id === deleteStore.id) setSelectedStore(null);
        setDeleteStore(null);
        setAccountNotice(
          `${removedName} (${removedCode}) was deleted. Its exclusive store admin login was removed.`,
        );
      } catch (error) {
        setDeleteError(dbErrorMessage(error, "Could not delete the store."));
      } finally {
        setDeleteBusy(false);
      }
      return;
    }
    if (deleteStore.accountId) {
      void getAuthAdapter().disableAccount(deleteStore.accountId);
    }
    setStores((prev) => {
      const next = prev.filter((s) => s.id !== deleteStore.id);
      replaceStoreRegistry(next);
      return next;
    });
    if (selectedStore?.id === deleteStore.id) setSelectedStore(null);
    setDeleteStore(null);
  }

  const isEditValid = editForm.name.trim() && editForm.phone.trim();
  const isValid =
    form.name.trim() &&
    form.phone.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

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
          {accountNotice && (
            <p className="mt-2 text-sm font-medium text-brand-700">{accountNotice}</p>
          )}
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
                  {getOutstandingLimitStatus(
                    getCompanyStoreOutstanding(store.id),
                    resolveStoreOutstandingLimit(store),
                  ) === "exceeded" ? (
                    <StoreLimitBadge store={store} />
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openStoreDetails(store)}
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="nb-modal-panel flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

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
        <div className="min-h-0 flex-1 overflow-y-auto p-6">

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

            <StoreLimitDetails store={selectedStore} />

          </div>

          {/* Bank Details */}
          <div className="mt-5">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
              Bank Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              <StoreInfoBox
                icon="badge"
                label="Account Name"
                value={(selectedStore as any).bankAccountName || "-"}
              />

              <StoreInfoBox
                icon="account_balance"
                label="Account No"
                value={(selectedStore as any).bankAccountNo || "-"}
              />

              <StoreInfoBox
                icon="pin"
                label="IFSC Code"
                value={(selectedStore as any).bankIfsc || "-"}
              />

              <StoreInfoBox
                icon="account_balance"
                label="Bank Name"
                value={(selectedStore as any).bankName || "-"}
              />

              <StoreInfoBox
                icon="location_on"
                label="Branch"
                value={(selectedStore as any).bankBranch || "-"}
              />

              <StoreInfoBox
                icon="qr_code"
                label="UPI ID"
                value={(selectedStore as any).bankUpiId || "-"}
              />
            </div>
          </div>

          {usesSupabaseData() && (
            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Create Store Login
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Invite a store administrator for this store. They set a password from the email, then sign in.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  className="min-w-0 flex-1"
                  label="Store Admin email"
                  type="email"
                  value={inviteEmail}
                  onChange={(value) => {
                    setInviteEmail(value);
                    setInviteError("");
                    setCanReassignLogin(false);
                    setCanResendLogin(false);
                  }}
                  placeholder="name@company.com"
                  icon="mail"
                  required
                />
                <Button onClick={() => void inviteStoreAdmin({})} disabled={inviteBusy}>
                  <Icon name="person_add" size={18} />
                  {inviteBusy ? "Sending invitation..." : "Invite Store Admin"}
                </Button>
              </div>
              {inviteError && (
                <p className="mt-2 text-sm font-medium text-red-600">{inviteError}</p>
              )}
              {canReassignLogin && (
                <Button
                  variant="secondary"
                  onClick={() => void inviteStoreAdmin({ reassign: true })}
                  disabled={inviteBusy}
                >
                  Move this login to this store
                </Button>
              )}
              {canResendLogin && (
                <Button
                  variant="secondary"
                  onClick={() => void inviteStoreAdmin({ resend: true })}
                  disabled={inviteBusy}
                >
                  Resend password setup email
                </Button>
              )}
              {inviteNotice && (
                <p className="mt-2 text-sm font-medium text-brand-700">{inviteNotice}</p>
              )}
            </div>
          )}
          </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">

          <Button
            variant="secondary"
            onClick={() => selectedStore && void askDeleteStore(selectedStore)}
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
                  <Input
                    label="Outstanding Limit"
                    value={editForm.outstandinglimit}
                    onChange={(v) => updateEdit("outstandinglimit", v)}
                    placeholder="5,00,000"
                    icon="wallet"
                  />
                  <Select
                    label="When limit is reached"
                    value={editForm.outstandingLimitAction}
                    onChange={(v) =>
                      updateEdit(
                        "outstandingLimitAction",
                        v === "block" ? "block" : "warn",
                      )
                    }
                    options={[
                      { value: "warn", label: "Warn (allow the sale)" },
                      { value: "block", label: "Block the sale" },
                    ]}
                  />
                                    <Input label="City" value={editForm.city} onChange={(v) => updateEdit("city", v)} />
                  <Input label="District" value={editForm.district} onChange={(v) => updateEdit("district", v)} />
                  <Input label="State" value={editForm.state} onChange={(v) => updateEdit("state", v)} />
                  <div className="md:col-span-2 xl:col-span-3">
                    <Input label="Address" value={editForm.address} onChange={(v) => updateEdit("address", v)} icon="location_on" />
                  </div>
                </div>

                {/* Bank Details Section */}
                <div className="mt-7">
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Bank Details
                  </h4>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <Input
                      label="Account Name"
                      value={editForm.bankAccountName}
                      onChange={(v) => updateEdit("bankAccountName", v)}
                      placeholder="e.g. Sairam Agri Inputs"
                      icon="badge"
                    />
                    <Input
                      label="Account No"
                      value={editForm.bankAccountNo}
                      onChange={(v) => updateEdit("bankAccountNo", v)}
                      placeholder="e.g. 50200106535019"
                      icon="account_balance"
                    />
                    <Input
                      label="IFSC Code"
                      value={editForm.bankIfsc}
                      onChange={(v) => updateEdit("bankIfsc", v)}
                      placeholder="e.g. HDFC0000775"
                      icon="pin"
                    />
                    <Input
                      label="Bank Name"
                      value={editForm.bankName}
                      onChange={(v) => updateEdit("bankName", v)}
                      placeholder="e.g. HDFC Bank"
                      icon="account_balance"
                    />
                    <Input
                      label="Branch"
                      value={editForm.bankBranch}
                      onChange={(v) => updateEdit("bankBranch", v)}
                      placeholder="e.g. Rajapalayam"
                      icon="location_on"
                    />
                    <Input
                      label="UPI ID"
                      value={editForm.bankUpiId}
                      onChange={(v) => updateEdit("bankUpiId", v)}
                      placeholder="e.g. sujiyaso22-1@okhdfcbank"
                      icon="qr_code"
                    />
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
                  Permanently delete{" "}
                  <span className="font-semibold text-slate-700">{deleteStore.name}</span>
                  {" "}({deleteStore.code})?
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Linked store admin:{" "}
                  <span className="font-semibold text-slate-700">
                    {deleteAdmins.length > 0 ? deleteAdmins.join(", ") : "none"}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This removes only that store and a store admin login used only by it. Stores with sales, stock, or other records are not deleted.
                </p>
                {deleteError && (
                  <p className="mt-3 text-sm font-medium text-red-600">{deleteError}</p>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={() => setDeleteStore(null)} disabled={deleteBusy}>Cancel</Button>
                <Button onClick={() => void handleDeleteStore()} disabled={deleteBusy} className="bg-red-600 hover:bg-red-700">
                  <Icon name="delete" size={18} /> {deleteBusy ? "Deleting..." : "Delete Store"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex h-[90vh] max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
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
                    required
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
                    <Select
                      label="When limit is reached"
                      value={form.outstandingLimitAction}
                      onChange={(v) => update("outstandingLimitAction", v)}
                      options={[
                        { value: "warn", label: "Warn (allow the sale)" },
                        { value: "block", label: "Block the sale" },
                      ]}
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

                {/* Bank Details Section */}
                <div className="mt-7">
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">
                    Bank Details
                  </h4>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <Input
                      label="Account Name"
                      value={form.bankAccountName}
                      onChange={(v) => update("bankAccountName", v)}
                      placeholder="e.g. Sairam Agri Inputs"
                      icon="badge"
                    />
                    <Input
                      label="Account No"
                      value={form.bankAccountNo}
                      onChange={(v) => update("bankAccountNo", v)}
                      placeholder="e.g. 50200106535019"
                      icon="account_balance"
                    />
                    <Input
                      label="IFSC Code"
                      value={form.bankIfsc}
                      onChange={(v) => update("bankIfsc", v)}
                      placeholder="e.g. HDFC0000775"
                      icon="pin"
                    />
                    <Input
                      label="Bank Name"
                      value={form.bankName}
                      onChange={(v) => update("bankName", v)}
                      placeholder="e.g. HDFC Bank"
                      icon="account_balance"
                    />
                    <Input
                      label="Branch"
                      value={form.bankBranch}
                      onChange={(v) => update("bankBranch", v)}
                      placeholder="e.g. Rajapalayam"
                      icon="location_on"
                    />
                    <Input
                      label="UPI ID"
                      value={form.bankUpiId}
                      onChange={(v) => update("bankUpiId", v)}
                      placeholder="e.g. sujiyaso22-1@okhdfcbank"
                      icon="qr_code"
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

function storeLimitView(store: Store) {
  const limit = resolveStoreOutstandingLimit(store);
  const outstanding = getCompanyStoreOutstanding(store.id);
  const status = getOutstandingLimitStatus(outstanding, limit);
  const action = resolveStoreOutstandingLimitAction(store);
  const label =
    status === "exceeded"
      ? action === "block"
        ? "Limit exceeded — sales blocked"
        : "Limit reached or exceeded"
      : status === "approaching"
        ? "Approaching outstanding limit"
        : "Within outstanding limit";
  const color: "green" | "amber" | "red" =
    status === "exceeded" ? "red" : status === "approaching" ? "amber" : "green";
  return { limit, outstanding, status, action, label, color };
}

function StoreLimitBadge({ store }: { store: Store }) {
  const view = storeLimitView(store);
  if (view.status !== "exceeded") return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Badge color="red">
        {view.outstanding > view.limit
          ? "Outstanding limit exceeded"
          : "Outstanding limit reached"}
      </Badge>
    </div>
  );
}

function StoreLimitDetails({ store }: { store: Store }) {
  const view = storeLimitView(store);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name="wallet" size={18} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Outstanding Limit
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {formatCurrency(view.limit)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Current outstanding {formatCurrency(view.outstanding)}
      </p>
      {view.status === "exceeded" ? (
        <div className="mt-2">
          <Badge color="red">
            {view.outstanding > view.limit
              ? "Outstanding limit exceeded"
              : "Outstanding limit reached for this store."}
          </Badge>
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-400">
        Policy: {view.action === "block" ? "Block sales at limit" : "Warn at limit"}
      </p>
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


