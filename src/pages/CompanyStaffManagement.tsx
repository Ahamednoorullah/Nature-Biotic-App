import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Icon, Input, Select } from "@/components/ui";
import { staff as staffSeed, stores, type Staff } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

type StaffWithProfile = Staff & {
  familyRelation?: string;
  profileImage?: string;
};

type StaffForm = {
  name: string;
  phone: string;
  alternativePhone: string;
  familyRelation: string;
  profileImage: string;
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
  familyRelation: "",
  profileImage: "",
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

const familyRelations = [
  "Mother",
  "Father",
  "Brother",
  "Sister",
  "Guardian",
  "Other",
];

function calculateAge(dob: string) {
  if (!dob) return 0;

  const birthDate = new Date(`${dob}T00:00:00`);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const month = today.getMonth() - birthDate.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return Math.max(age, 0);
}

export default function CompanyStaffManagement() {
  const [staffList, setStaffList] = useState<StaffWithProfile[]>(
    staffSeed as StaffWithProfile[],
  );
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithProfile | null>(
    null,
  );
  const [editingStaff, setEditingStaff] = useState<StaffWithProfile | null>(
    null,
  );
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const age = useMemo(() => calculateAge(form.dob), [form.dob]);
  const profileImageRef = useRef<HTMLInputElement | null>(null);

  function update<K extends keyof StaffForm>(key: K, value: StaffForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function storeName(id: string) {
    return stores.find((store) => store.id === id)?.name ?? "-";
  }

  function storeLocation(id: string) {
    return stores.find((store) => store.id === id)?.location ?? "-";
  }

  function handleProfileImage(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please select a valid image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      window.alert("Profile image must be 2 MB or less.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      setForm((prev) => ({
        ...prev,
        profileImage: result,
        profileImageName: file.name,
      }));
    };

    reader.readAsDataURL(file);
  }

  function openCreate() {
    setEditingStaff(null);
    setSelectedStaff(null);
    setForm(emptyForm);
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    setEditingStaff(null);
    setForm(emptyForm);
  }

  function openEdit(member: StaffWithProfile) {
    setEditingStaff(member);
    setSelectedStaff(null);

    setForm({
      name: member.name,
      phone: member.phone,
      alternativePhone: member.alternativePhone ?? "",
      familyRelation: member.familyRelation ?? "",
      profileImage: member.profileImage ?? "",
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

    const member: StaffWithProfile = {
      id: editingStaff?.id ?? `st-${Date.now()}`,
      storeId: form.storeId,
      name: form.name,
      phone: form.phone,
      alternativePhone: form.alternativePhone,
      familyRelation: form.familyRelation,
      profileImage: form.profileImage,
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

    setStaffList((prev) =>
      editingStaff
        ? prev.map((item) => (item.id === editingStaff.id ? member : item))
        : [...prev, member],
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

        <Button onClick={openCreate}>
          <Icon name="add" size={20} fill />
          Add Staff
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-[12px] xl:text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 xl:text-xs">
                <th className="w-[4%] border-r border-slate-200 px-2 py-3 text-center">
                  S.No
                </th>
                <th className="w-[7%] border-r border-slate-200 px-2 py-3 text-center">
                  Profile
                </th>
                <th className="w-[15%] border-r border-slate-200 px-2 py-3 text-left">
                  Staff Name
                </th>
                <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-left">
                  Phone
                </th>
                <th className="w-[12%] border-r border-slate-200 px-2 py-3 text-left">
                  Designation
                </th>
                <th className="w-[14%] border-r border-slate-200 px-2 py-3 text-left">
                  Assigned Store
                </th>
                <th className="w-[10%] border-r border-slate-200 px-2 py-3 text-left">
                  Location
                </th>
                <th className="w-[3%] border-r border-slate-200 px-2 py-3 text-center">
                  Level
                </th>
                <th className="w-[8%] px-2 py-3 text-center">DOJ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {staffList.map((member, index) => (
                <tr
                  key={member.id}
                  onClick={() => setSelectedStaff(member)}
                  title="Click to view staff details"
                  className="cursor-pointer transition hover:bg-brand-50/40"
                >
                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {index + 1}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    <div className="flex justify-center">
                      {member.profileImage ? (
                        <img
                          src={member.profileImage}
                          alt={member.name}
                          className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="truncate border-r border-slate-100 px-2 py-3 font-semibold">
                    {member.name}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3">
                    {member.phone}
                  </td>

                  <td className="truncate border-r border-slate-100 px-2 py-3">
                    {member.designation}
                  </td>

                  <td className="truncate border-r border-slate-100 px-2 py-3">
                    {storeName(member.storeId)}
                  </td>

                  <td className="truncate border-r border-slate-100 px-2 py-3">
                    {storeLocation(member.storeId)}
                  </td>

                  <td className="border-r border-slate-100 px-2 py-3 text-center">
                    {member.level}
                  </td>

                  <td className="px-2 py-3 text-center text-[11px]">
                    {member.joinedDate}
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

                <button
                  type="button"
                  onClick={closeAdd}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white"
                >
                  <Icon name="close" size={19} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase text-slate-500">
                    Personal Information
                  </h3>

                  <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                    <input
                      ref={profileImageRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(event) =>
                        handleProfileImage(event.target.files?.[0])
                      }
                    />

                    <button
                      type="button"
                      onClick={() => profileImageRef.current?.click()}
                      className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white"
                    >
                      {form.profileImage ? (
                        <img
                          src={form.profileImage}
                          alt="Staff preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon
                          name="add_a_photo"
                          size={30}
                          className="text-slate-400"
                        />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700">
                        Profile Image
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {form.profileImageName || "JPG, PNG or WEBP up to 2MB"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => profileImageRef.current?.click()}
                        >
                          <Icon name="upload" size={16} />
                          {form.profileImage ? "Change Image" : "Choose Image"}
                        </Button>

                        {form.profileImage && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                profileImage: "",
                                profileImageName: "",
                              }))
                            }
                          >
                            <Icon name="delete" size={16} />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <Input
                      label="Name"
                      value={form.name}
                      onChange={(value) => update("name", value)}
                      required
                    />

                    <Input
                      label="Phone Number"
                      value={form.phone}
                      onChange={(value) => update("phone", value)}
                      required
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Family Contact
                      </label>

                      <div className="grid grid-cols-[1fr_145px] gap-2">
                        <Input
                          value={form.alternativePhone}
                          onChange={(value) =>
                            update("alternativePhone", value)
                          }
                          placeholder="Family number"
                        />

                        <Select
                          value={form.familyRelation}
                          onChange={(value) => update("familyRelation", value)}
                          placeholder="Relation"
                          options={familyRelations.map((relation) => ({
                            value: relation,
                            label: relation,
                          }))}
                        />
                      </div>
                    </div>

                    <Input
                      label="Email ID"
                      type="email"
                      value={form.email}
                      onChange={(value) => update("email", value)}
                      required
                    />

                    <Input
                      label="DOB"
                      type="date"
                      value={form.dob}
                      onChange={(value) => update("dob", value)}
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
                      onChange={(value) => update("bloodGroup", value)}
                      options={bloodGroups.map((group) => ({
                        value: group,
                        label: group,
                      }))}
                      required
                    />

                    <Input
                      label="Date of Joining"
                      type="date"
                      value={form.joinedDate}
                      onChange={(value) => update("joinedDate", value)}
                      required
                    />

                    <div className="md:col-span-2 xl:col-span-4">
                      <Input
                        label="Address"
                        value={form.address}
                        onChange={(value) => update("address", value)}
                      />
                    </div>
                  </div>
                </section>

                <section className="border-t pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase text-slate-500">
                    Documents
                  </h3>

                  <div className="grid gap-5 md:grid-cols-2">
                    <UploadField
                      label="Proof ID"
                      accept=".pdf,.jpg,.jpeg,.png"
                      fileName={form.proofIdName}
                      onFile={(name) => update("proofIdName", name)}
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
                      onChange={(value) => update("designation", value)}
                      options={designationOptions.map((designation) => ({
                        value: designation,
                        label: designation,
                      }))}
                      required
                    />

                    <Select
                      label="Assign Store"
                      value={form.storeId}
                      placeholder="Select Store"
                      onChange={(value) => update("storeId", value)}
                      options={stores.map((store) => ({
                        value: store.id,
                        label: store.name,
                      }))}
                      required
                    />

                    <Select
                      label="Level"
                      value={form.level}
                      placeholder="Select Level"
                      onChange={(value) => update("level", value)}
                      options={["1", "2", "3", "4"].map((level) => ({
                        value: level,
                        label: `Level ${level}`,
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
                      onChange={(value) => update("targetSales", value)}
                      required
                    />

                    <Input
                      label="Farmers Target"
                      type="number"
                      value={form.targetFarmers}
                      onChange={(value) => update("targetFarmers", value)}
                      required
                    />

                    <Input
                      label="Farms Target"
                      type="number"
                      value={form.targetFarms}
                      onChange={(value) => update("targetFarms", value)}
                      required
                    />

                    <Input
                      label="Visits Target"
                      type="number"
                      value={form.targetVisits}
                      onChange={(value) => update("targetVisits", value)}
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
                  <Icon name="save" size={18} />
                  {editingStaff ? "Update Staff" : "Save Staff"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedStaff &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center gap-4">
                  {selectedStaff.profileImage ? (
                    <img
                      src={selectedStaff.profileImage}
                      alt={selectedStaff.name}
                      className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-700">
                      {selectedStaff.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                      Staff Profile
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-800">
                      {selectedStaff.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedStaff.designation} ·{" "}
                      {storeName(selectedStaff.storeId)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={() => openEdit(selectedStaff)}>
                    <Icon name="edit" size={16} />
                    Edit Staff
                  </Button>

                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Info label="Phone" value={selectedStaff.phone} />

                    <Info
                      label="Family Contact"
                      value={
                        selectedStaff.alternativePhone
                          ? `${selectedStaff.alternativePhone}${
                              selectedStaff.familyRelation
                                ? ` (${selectedStaff.familyRelation})`
                                : ""
                            }`
                          : "-"
                      }
                    />

                    <Info label="Email" value={selectedStaff.email} />

                    <Info
                      label="Blood Group"
                      value={selectedStaff.bloodGroup}
                    />

                    <Info label="DOB" value={selectedStaff.dob} />

                    <Info label="Age" value={String(selectedStaff.age)} />

                    <Info
                      label="Date of Joining"
                      value={selectedStaff.joinedDate}
                    />

                    <Info
                      label="Address"
                      value={selectedStaff.address || "-"}
                    />
                  </div>
                </section>

                <section className="mt-6 border-t border-slate-200 pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Employment Information
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Info
                      label="Designation"
                      value={selectedStaff.designation}
                    />

                    <Info
                      label="Assigned Store"
                      value={storeName(selectedStaff.storeId)}
                    />

                    <Info
                      label="Location"
                      value={storeLocation(selectedStaff.storeId)}
                    />

                    <Info
                      label="Level"
                      value={`Level ${selectedStaff.level}`}
                    />
                  </div>
                </section>

                <section className="mt-6 border-t border-slate-200 pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Targets
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  </div>
                </section>

                <section className="mt-6 border-t border-slate-200 pt-6">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Documents
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Info
                      label="Proof ID"
                      value={selectedStaff.proofIdName || "-"}
                    />

                    <Info
                      label="Profile Image"
                      value={selectedStaff.profileImageName || "-"}
                    />
                  </div>
                </section>
              </div>

              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedStaff(null)}
                >
                  Close
                </Button>
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
  onFile: (name: string) => void;
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
          onChange={(event) => onFile(event.target.files?.[0]?.name ?? "")}
        />
      </div>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}
