import { useRef, useState } from "react";
import { useNav } from "@/context/NavContext";
import {
  addFarmer,
  cropTypes,
  soilTypes,
  waterSources,
  customerCategories,
} from "@/lib/data";
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  SectionTitle,
  Icon,
} from "@/components/ui";

type CropDetail = {
  id: string;
  cropType: string;
  landSize: string;
  soilType: string;
  waterSource: string;
};

type FormState = {
  name: string;
  phone: string;
  altMobile: string;
  email: string;
  aadhar: string;
  gst: string;
  village: string;
  landmark: string;
  district: string;
  state: string;
  pincode: string;
  farmerAddress: string;
  customerCategory: string;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  altMobile: "",
  email: "",
  aadhar: "",
  gst: "",
  village: "",
  landmark: "",
  district: "",
  state: "Tamil Nadu",
  pincode: "",
  farmerAddress: "",
  customerCategory: "Retail",
};

export default function StoreAddFarmer({ storeId }: { storeId: string }) {
  const { goStorePage } = useNav();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleProfileUpload(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("Profile image must be 1 MB or less.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  const [cropType, setCropType] = useState("");
  const [cropLandSize, setCropLandSize] = useState("");
  const [soilType, setSoilType] = useState("");
  const [waterSource, setWaterSource] = useState("");
  const [crops, setCrops] = useState<CropDetail[]>([]);

  const canAddCrop = cropType && cropLandSize;

  function addCrop() {
    if (!canAddCrop) return;
    setCrops((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${cropType}`,
        cropType,
        landSize: cropLandSize,
        soilType,
        waterSource,
      },
    ]);
    setCropType("");
    setCropLandSize("");
    setSoilType("");
    setWaterSource("");
  }

  function removeCrop(id: string) {
    setCrops((prev) => prev.filter((crop) => crop.id !== id));
  }

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  function saveFarmerRecord() {
    if (!isValid) return false;

    addFarmer({
      storeId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      altMobile: form.altMobile.trim(),
      email: form.email.trim(),
      aadhar: form.aadhar.trim(),
      gst: form.gst.trim(),
      village: form.village.trim(),
      landmark: form.landmark.trim(),
      district: form.district.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      farmAddress: form.farmerAddress.trim(),
      customerCategory: form.customerCategory as
        | "Retail"
        | "Wholesale"
        | "Dealer",
      crops: crops.map((crop) => ({
        ...crop,
        landSize: Number(crop.landSize || 0),
      })),
      profileImage,
    });

    return true;
  }

  function handleSave() {
    if (!saveFarmerRecord()) return;

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      goStorePage("farmers");
    }, 700);
  }

  function handleSaveAndAdd() {
    if (!saveFarmerRecord()) return;

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm(emptyForm);
      setCrops([]);
      setProfileImage("");
    }, 700);
  }

  const isValid =
    form.name &&
    form.phone &&
    form.village &&
    form.district &&
    form.farmerAddress &&
    crops.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => goStorePage("farmers")}
          className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500"
        >
          <Icon name="arrow_back" size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Add New Farmer
          </h1>
          <p className="text-slate-500 mt-1">
            Register a new farmer or customer in the system.
          </p>
        </div>
      </div>

      {saved && (
        <div className="fixed top-20 right-6 z-50 animate-scale-in">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-elevated">
            <Icon name="check_circle" size={20} fill />
            <span className="text-sm font-semibold">
              Farmer saved successfully!
            </span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* GENERAL INFORMATION */}
        <Card className="p-6">
          <SectionTitle
            icon="person"
            title="General Information"
            description="Basic farmer identification and contact details."
          />
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Profile Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => handleProfileUpload(e.target.files?.[0])}
            />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center hover:border-brand-400 hover:bg-brand-50/30 transition-base"
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Farmer profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Icon
                      name="person_add"
                      size={28}
                      className="text-slate-400"
                    />
                    <p className="text-xs text-slate-400 mt-1">Upload</p>
                  </div>
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-slate-600">
                  {profileImage
                    ? "Profile photo selected"
                    : "Upload a profile photo"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PNG, JPG up to 1MB.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="upload" size={16} />{" "}
                  {profileImage ? "Change Photo" : "Choose File"}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Farmer Name"
              value={form.name}
              onChange={(v) => update("name", v)}
              placeholder="e.g. Murugan"
              icon="person"
              required
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={form.phone}
              onChange={(v) => update("phone", v)}
              placeholder="e.g. 9876543210"
              icon="call"
              required
            />
            <Input
              label="Alternative Mobile"
              type="tel"
              value={form.altMobile}
              onChange={(v) => update("altMobile", v)}
              placeholder="e.g. 9123456700"
              icon="call"
            />
            <Input
              label="Aadhar Number (Optional)"
              value={form.aadhar}
              onChange={(v) => update("aadhar", v)}
              placeholder="XXXX-XXXX-XXXX"
              icon="badge"
            />
            <Input
              label="GST Number (Optional)"
              value={form.gst}
              onChange={(v) => update("gst", v)}
              placeholder="33ABCDE1234F1Z5"
              icon="receipt_long"
            />
            
              <div className="sm:col-span-2">
                <Textarea
                  label="Farmer Address"
                  value={form.farmerAddress}
                  onChange={(v) => update("farmerAddress", v)}
                  placeholder="Enter full farmer address..."
                  rows={2}
                  required
                />
              </div>
            </div>
        </Card>

        {/* FARM DETAILS */}
        <Card className="p-6">
          <SectionTitle
            icon="agriculture"
            title="Farm Details"
            description="Farm location and address information."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Village"
              value={form.village}
              onChange={(v) => update("village", v)}
              placeholder="e.g. Rajapalayam"
              icon="location_on"
              required
            />
            <Input
              label="Landmark"
              value={form.landmark}
              onChange={(v) => update("landmark", v)}
              placeholder="e.g. Near Temple"
              icon="near_me"
            />
            <Input
              label="Land Size (Acres)"
              type="number"
              value={cropLandSize}
              onChange={setCropLandSize}
              placeholder="e.g. 2.5"
            />
            <Input
              label="District"
              value={form.district}
              onChange={(v) => update("district", v)}
              placeholder="e.g. Virudhunagar"
              icon="location_city"
              required
            />
            <Input
              label="State"
              value={form.state}
              onChange={(v) => update("state", v)}
              placeholder="e.g. Tamil Nadu"
              icon="public"
            />
            <Input
              label="Pincode"
              value={form.pincode}
              onChange={(v) => update("pincode", v)}
              placeholder="e.g. 626117"
              icon="mark_email_read"
            />
          </div>
        </Card>

        {/* CROP DETAILS */}
        <Card className="p-6">
          <SectionTitle
            icon="eco"
            title="Crop Details"
            description="Add one or multiple crops managed by this farmer."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Select
              label="Crop"
              value={cropType}
              onChange={setCropType}
              placeholder="Select crop"
              options={cropTypes.map((c) => ({ value: c, label: c }))}
            />
            
            <Select
              label="Soil Type"
              value={soilType}
              onChange={setSoilType}
              placeholder="Select soil type"
              options={soilTypes.map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Water Source"
              value={waterSource}
              onChange={setWaterSource}
              placeholder="Select water source"
              options={waterSources.map((w) => ({ value: w, label: w }))}
            />
            <div className="flex items-end translate-y-[-4px]">
              <Button
                type="button"
                onClick={addCrop}
                disabled={!canAddCrop}
                className="w-full"
              >
                <Icon name="add" size={25} /> Add Crop
              </Button>
            </div>
          </div>

          {crops.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-[8%] px-3 py-3 text-center">S.No</th>
                    <th className="w-[26%] px-3 py-3 text-left">Crop</th>
                    <th className="w-[20%] px-3 py-3 text-center">
                      Land (Acres)
                    </th>
                    <th className="w-[20%] px-3 py-3 text-left">Soil Type</th>
                    <th className="w-[20%] px-3 py-3 text-left">
                      Water Source
                    </th>
                    <th className="w-[6%] px-2 py-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crops.map((crop, index) => (
                    <tr key={crop.id}>
                      <td className="px-3 py-3 text-center text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        {crop.cropType}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700">
                        {crop.landSize}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {crop.soilType || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {crop.waterSource || "-"}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeCrop(crop.id)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Bottom actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6">
          <Button
            variant="secondary"
            onClick={() => goStorePage("farmers")}
            className="sm:mr-auto"
          >
            <Icon name="close" size={18} /> Cancel
          </Button>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              onClick={handleSaveAndAdd}
              disabled={!isValid}
            >
              <Icon name="add" size={18} /> Save & Add Another
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              <Icon name="save" size={18} /> Save Farmer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
