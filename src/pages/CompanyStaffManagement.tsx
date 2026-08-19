import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { staff as staffSeed, stores, Staff } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

type StaffForm = {
  name: string;
  phone: string;
  alternativePhone: string;
  email: string;
  dob: string;
  bloodGroup: string;
  joinedDate: string;
  address: string;
  proofIdName: string;
  profileImageName: string;
  designation: string;
  storeId: string;
  level: string;
  targetSales: string;
  targetFarmers: string;
  targetFarms: string;
  targetVisits: string;
};

const emptyForm: StaffForm = {
  name: "",
  phone: "",
  alternativePhone: "",
  email: "",
  dob: "",
  bloodGroup: "",
  joinedDate: "",
  address: "",
  proofIdName: "",
  profileImageName: "",
  designation: "",
  storeId: "",
  level: "",
  targetSales: "",
  targetFarmers: "",
  targetFarms: "",
  targetVisits: "",
};

const designationOptions = [
  "Field Executive",
  "Sales Executive",
  "Store Manager",
  "Accountant",
  "Inventory Clerk",
  "Cashier",
  "HR",
  "Designer",
];
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function calculateAge(dob: string) {
  if (!dob) return 0;
  const b = new Date(`${dob}T00:00:00`),
    t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return Math.max(a, 0);
}

export default function CompanyStaffManagement() {
  const [staffList, setStaffList] = useState<Staff[]>(staffSeed);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const age = useMemo(() => calculateAge(form.dob), [form.dob]);

  function update<K extends keyof StaffForm>(key: K, value: StaffForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }
  function closeAdd() {
    setShowAdd(false);
    setEditingStaff(null);
    setForm(emptyForm);
  }
  function storeName(id: string) {
    return stores.find((s) => s.id === id)?.name ?? "-";
  }
  function storeLocation(id: string) {
    return stores.find((s) => s.id === id)?.location ?? "-";
  }

  function openEdit(member: Staff) {
    setEditingStaff(member);
    setSelectedStaff(null);
    setForm({
      name: member.name,
      phone: member.phone,
      alternativePhone: member.alternativePhone,
      email: member.email,
      dob: member.dob,
      bloodGroup: member.bloodGroup,
      joinedDate: member.joinedDate,
      address: member.address,
      proofIdName: member.proofIdName,
      profileImageName: member.profileImageName,
      designation: member.designation,
      storeId: member.storeId,
      level: String(member.level),
      targetSales: String(member.targetSales),
      targetFarmers: String(member.targetFarmers),
      targetFarms: String(member.targetFarms),
      targetVisits: String(member.targetVisits),
    });
    setShowAdd(true);
  }

  const missingRequiredFields = [
    !form.name.trim() && "Name",
    !form.phone.trim() && "Phone Number",
    !form.email.trim() && "Email ID",
    !form.dob && "DOB",
    !form.bloodGroup && "Blood Group",
    !form.joinedDate && "Date of Joining",
    !form.designation && "Designation",
    !form.storeId && "Assign Store",
    !form.level && "Level",
    !form.targetSales.trim() && "Sales Target",
    !form.targetFarmers.trim() && "Farmers Target",
    !form.targetFarms.trim() && "Farms Target",
    !form.targetVisits.trim() && "Visits Target",
  ].filter(Boolean) as string[];

  const isValid = missingRequiredFields.length === 0;

  function handleSave() {
    if (!isValid) {
      window.alert(`Please fill: ${missingRequiredFields.join(", ")}`);
      return;
    }
    const member: Staff = {
      id: editingStaff?.id ?? `st-${Date.now()}`,
      storeId: form.storeId,
      name: form.name,
      phone: form.phone,
      alternativePhone: form.alternativePhone,
      email: form.email,
      dob: form.dob,
      age,
      bloodGroup: form.bloodGroup,
      joinedDate: form.joinedDate,
      address: form.address,
      proofIdName: form.proofIdName,
      profileImageName: form.profileImageName,
      designation: form.designation,
      level: Number(form.level) as 1 | 2 | 3 | 4,
      targetSales: Number(form.targetSales) || 0,
      targetFarmers: Number(form.targetFarmers) || 0,
      targetFarms: Number(form.targetFarms) || 0,
      targetVisits: Number(form.targetVisits) || 0,
      role: form.designation,
      status: editingStaff?.status ?? "Active",
    };
    setStaffList((p) =>
      editingStaff
        ? p.map((x) => (x.id === editingStaff.id ? member : x))
        : [...p, member],
    );
    closeAdd();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Staff Management
          </h1>
          <p className="mt-1 text-slate-500">
            Manage staff, store assignments, levels and targets.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingStaff(null);
            setForm(emptyForm);
            setShowAdd(true);
          }}
        >
          <Icon name="add" size={20} fill /> Add Staff
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                {[
                  "S.No",
                  "Profile",
                  "Staff Name",
                  "Phone",
                  "Designation",
                  "Assigned Store",
                  "Location",
                  "Level",
                  "DOJ",
                  "View",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold border-r border">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.map((m, i) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 border-r border">{i + 1}</td>
                  <td className="px-3 py-3 border-r border">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 font-bold border-r border text-brand-700">
                      {m.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold border-r border">{m.name}</td>
                  <td className="px-3 py-3 border-r border">{m.phone}</td>
                  <td className="px-3 py-3 border-r border">{m.designation}</td>
                  <td className="px-3 py-3 border-r border">{storeName(m.storeId)}</td>
                  <td className="px-3 py-3 border-r border">{storeLocation(m.storeId)}</td>
                  <td className="px-3 py-3 border-r border">{m.level}</td>
                  <td className="px-3 py-3 border-r border">{m.joinedDate}</td>
                  <td className="px-3 py-3 border-r border">
                    <button
                      onClick={() => setSelectedStaff(m)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                    >
                      <Icon name="visibility" size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[95vw] max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold">
                    {editingStaff ? "Edit Staff" : "Add Staff"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {editingStaff
                      ? "Update staff information and save changes."
                      : "Enter personal, employment and target details."}
                  </p>
                </div>
                <button onClick={closeAdd}>
                  <Icon name="close" size={19} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase text-slate-500">
                    Personal Information
                  </h3>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <Input
                      label="Name"
                      value={form.name}
                      onChange={(v) => update("name", v)}
                      required
                    />
                    <Input
                      label="Phone Number"
                      value={form.phone}
                      onChange={(v) => update("phone", v)}
                      required
                    />
                    <Input
                      label="Alternative Number"
                      value={form.alternativePhone}
                      onChange={(v) => update("alternativePhone", v)}
                    />
                    <Input
                      label="Email ID"
                      type="email"
                      value={form.email}
                      onChange={(v) => update("email", v)}
                      required
                    />
                    <Input
                      label="DOB"
                      type="date"
                      value={form.dob}
                      onChange={(v) => update("dob", v)}
                      required
                    />
                    <Input
                      label="Age"
                      value={age ? String(age) : ""}
                      onChange={() => {}}
                      placeholder="Auto calculated"
                    />
                    <Select
                      label="Blood Group"
                      value={form.bloodGroup}
                      placeholder="Select Blood Group"
                      onChange={(v) => update("bloodGroup", v)}
                      options={bloodGroups.map((x) => ({ value: x, label: x }))}
                      required
                    />
                    <Input
                      label="Date of Joining"
                      type="date"
                      value={form.joinedDate}
                      onChange={(v) => update("joinedDate", v)}
                      required
                    />
                    <div className="md:col-span-2 xl:col-span-4">
                      <Input
                        label="Address"
                        value={form.address}
                        onChange={(v) => update("address", v)}
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase text-slate-500">
                    Documents & Profile
                  </h3>
                  <div className="grid gap-5 md:grid-cols-2">
                    <UploadField
                      label="Proof ID"
                      accept=".pdf,.jpg,.jpeg,.png"
                      fileName={form.proofIdName}
                      onFile={(n) => update("proofIdName", n)}
                    />
                    <UploadField
                      label="Profile Image"
                      accept="image/*"
                      fileName={form.profileImageName}
                      onFile={(n) => update("profileImageName", n)}
                    />
                  </div>
                </section>

                <section className="border-t pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase text-slate-500">
                    Employment Information
                  </h3>
                  <div className="grid gap-5 md:grid-cols-3">
                    <Select
                      label="Designation"
                      value={form.designation}
                      placeholder="Select Designation"
                      onChange={(v) => update("designation", v)}
                      options={designationOptions.map((x) => ({
                        value: x,
                        label: x,
                      }))}
                      required
                    />
                    <Select
                      label="Assign Store"
                      value={form.storeId}
                      placeholder="Select Store"
                      onChange={(v) => update("storeId", v)}
                      options={stores.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      required
                    />
                    <Select
                      label="Level"
                      value={form.level}
                      placeholder="Select Level"
                      onChange={(v) => update("level", v)}
                      options={["1", "2", "3", "4"].map((x) => ({
                        value: x,
                        label: `Level ${x}`,
                      }))}
                      required
                    />
                  </div>
                </section>

                <section className="border-t pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase text-slate-500">
                    Targets
                  </h3>
                  <div className="grid gap-5 md:grid-cols-4">
                    <Input
                      label="Sales Target"
                      type="number"
                      value={form.targetSales}
                      onChange={(v) => update("targetSales", v)}
                      required
                    />
                    <Input
                      label="Farmers Target"
                      type="number"
                      value={form.targetFarmers}
                      onChange={(v) => update("targetFarmers", v)}
                      required
                    />
                    <Input
                      label="Farms Target"
                      type="number"
                      value={form.targetFarms}
                      onChange={(v) => update("targetFarms", v)}
                      required
                    />
                    <Input
                      label="Visits Target"
                      type="number"
                      value={form.targetVisits}
                      onChange={(v) => update("targetVisits", v)}
                      required
                    />
                  </div>
                </section>
              </div>
              <div className="flex justify-end gap-3 border-t bg-slate-50 px-6 py-4">
                <Button variant="secondary" onClick={closeAdd}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Icon name="save" size={18} />{" "}
                  {editingStaff ? "Update Staff" : "Save Staff"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedStaff &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4">
            <div className="w-[92vw] max-w-4xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold">{selectedStaff.name}</h2>
                  <p className="text-sm text-slate-500">
                    {selectedStaff.designation} ·{" "}
                    {storeName(selectedStaff.storeId)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => openEdit(selectedStaff)}>
                    <Icon name="edit" size={16} /> Edit
                  </Button>
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                  >
                    <Icon name="close" size={19} />
                  </button>
                </div>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Phone" value={selectedStaff.phone} />
                <Info
                  label="Alternative No"
                  value={selectedStaff.alternativePhone || "-"}
                />
                <Info label="Email" value={selectedStaff.email} />
                <Info label="DOB" value={selectedStaff.dob} />
                <Info label="Age" value={String(selectedStaff.age)} />
                <Info label="Blood Group" value={selectedStaff.bloodGroup} />
                <Info
                  label="Date of Joining"
                  value={selectedStaff.joinedDate}
                />
                <Info label="Level" value={`Level ${selectedStaff.level}`} />
                <Info
                  label="Sales Target"
                  value={formatCurrency(selectedStaff.targetSales)}
                />
                <Info
                  label="Farmers Target"
                  value={String(selectedStaff.targetFarmers)}
                />
                <Info
                  label="Farms Target"
                  value={String(selectedStaff.targetFarms)}
                />
                <Info
                  label="Visits Target"
                  value={String(selectedStaff.targetVisits)}
                />
                <Info
                  label="Proof ID"
                  value={selectedStaff.proofIdName || "-"}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Info label="Address" value={selectedStaff.address || "-"} />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function UploadField({
  label,
  accept,
  fileName,
  onFile,
}: {
  label: string;
  accept: string;
  fileName: string;
  onFile: (n: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <div className="cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
        <p className="text-sm font-semibold">{fileName || `Upload ${label}`}</p>
        <p className="text-xs text-slate-400">Click to choose file</p>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0]?.name ?? "")}
        />
      </div>
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
