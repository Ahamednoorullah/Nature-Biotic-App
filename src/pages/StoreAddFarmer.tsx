import { useRef, useState, useEffect } from "react";
import { useNav } from "@/context/NavContext";
import { useAuth } from "@/context/AuthContext";
import {
  addFarmer,
  cropTypes,
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
  soilType?: string;
  waterSource?: string;
};

type FarmDetail = {
  id: string;
  village: string;
  landmark: string;
  district: string;
  state: string;
  pincode: string;
  farmAddress: string;
  landSize: string;
  crops: CropDetail[];
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
  const { user } = useAuth();
  const isFRO = user?.role === "fro";
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [throughType, setThroughType] = useState<"Direct" | "Executive">(
    "Direct",
  );
  const [executiveName, setExecutiveName] = useState("");

  useEffect(() => {
    if (isFRO) {
      setThroughType("Executive");
      setExecutiveName(user?.name ?? "");
    }
  }, [isFRO, user?.name]);

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

  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Camera is not supported in this browser. Please use Choose File.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraOpen(true);

      requestAnimationFrame(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      });
    } catch {
      alert("Unable to access the camera. Please allow camera permission or use Choose File.");
    }
  }

  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const approxBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

    if (approxBytes > 1024 * 1024) {
      alert("Captured photo must be 1 MB or less. Please try again.");
      return;
    }

    setProfileImage(dataUrl);
    closeCamera();
  }

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const [cropType, setCropType] = useState("");
  const [cropLandSize, setCropLandSize] = useState("");
  const [crops, setCrops] = useState<CropDetail[]>([]);
  const [farms, setFarms] = useState<FarmDetail[]>([]);
  const [farmLandSize, setFarmLandSize] = useState("");

  const canAdsdrop = cropType && cropLandSize;

  function adsdrop() {
    if (!canAdsdrop) return;
    setCrops((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${cropType}`,
        cropType,
        landSize: cropLandSize,
        soilType: "",
        waterSource: "",
      },
    ]);
    setCropType("");
    setCropLandSize("");
  }

  function removeCrop(id: string) {
    setCrops((prev) => prev.filter((crop) => crop.id !== id));
  }

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  function buildCurrentFarm(): FarmDetail | null {
    if (!form.village || !form.district || !farmLandSize.trim() || crops.length === 0) {
      return null;
    }

    return {
      id: `farm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      village: form.village.trim(),
      landmark: form.landmark.trim(),
      district: form.district.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      farmAddress: "",
      landSize: farmLandSize.trim(),
      crops: crops.map((crop) => ({
        ...crop,
        landSize: String(crop.landSize || 0),
      })),
    };
  }

  function resetFarmDraft() {
    setForm((prev) => ({
      ...prev,
      village: "",
      landmark: "",
      district: "",
      state: "Tamil Nadu",
      pincode: "",
    }));
    setCropType("");
    setCropLandSize("");
    setFarmLandSize("");
    setCrops([]);
  }

  function addFarm() {
    const farm = buildCurrentFarm();
    if (!farm) return;
    setFarms((prev) => [...prev, farm]);
    resetFarmDraft();
  }

  function removeFarm(id: string) {
    setFarms((prev) => prev.filter((farm) => farm.id !== id));
  }

  function saveFarmerRecord() {
    const currentFarm = buildCurrentFarm();
    const allFarms = currentFarm ? [...farms, currentFarm] : farms;
    if (!isValid || allFarms.length === 0) return false;

    const firstFarm = allFarms[0];
    const allCrops = allFarms.flatMap((farm) => farm.crops);

    addFarmer({
      storeId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      altMobile: form.altMobile.trim(),
      email: form.email.trim(),
      aadhar: form.aadhar.trim(),
      gst: form.gst.trim(),
      village: firstFarm.village,
      landmark: firstFarm.landmark,
      district: firstFarm.district,
      state: firstFarm.state,
      pincode: firstFarm.pincode,
      farmAddress: firstFarm.farmAddress,
      farms: allFarms.map((farm) => ({
        ...farm,
        crops: farm.crops.map((crop) => ({
          ...crop,
          landSize: Number(crop.landSize || 0),
        })),
      })),
      customerCategory: form.customerCategory as
        | "Retail"
        | "Wholesale"
        | "Dealer",
      crops: allCrops.map((crop) => ({
        ...crop,
        landSize: Number(crop.landSize || 0),
      })),
      profileImage,
      through: isFRO ? "Executive" : throughType,
      executiveName: (isFRO
        ? user?.name
        : throughType === "Executive"
          ? executiveName
          : ""
      ).trim(),
      cropType3: undefined,
      cropType2: undefined,
    } as any);

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
      setFarms([]);
      setFarmLandSize("");
      setProfileImage("");
      setThroughType(isFRO ? "Executive" : "Direct");
      setExecutiveName(isFRO ? (user?.name ?? "") : "");
    }, 700);
  }

  const currentFarmReady =
    !!form.village &&
    !!form.district &&
    !!farmLandSize.trim() &&
    crops.length > 0;

  const isValid =
    !!form.name &&
    !!form.phone &&
    (farms.length > 0 || currentFarmReady);

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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon name="upload" size={16} />{" "}
                    {profileImage ? "Change Photo" : "Choose File"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openCamera}
                  >
                    <Icon name="photo_camera" size={16} /> Camera
                  </Button>
                </div>
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

            <Select
              label="Through"
              value={throughType}
              onChange={(v) => {
                if (isFRO) return;
                setThroughType(v as "Direct" | "Executive");
                if (v === "Direct") setExecutiveName("");
              }}
              options={[
                { value: "Direct", label: "Direct" },
                { value: "Executive", label: "Executive" },
              ]}
            />

            {throughType === "Executive" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Executive Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={isFRO ? (user?.name ?? "") : executiveName}
                  onChange={
                    isFRO ? undefined : (e) => setExecutiveName(e.target.value)
                  }
                  placeholder="Enter executive name"
                  autoComplete="off"
                  readOnly={isFRO}
                  className={`w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus ${isFRO ? "bg-slate-100 cursor-not-allowed" : "bg-white"}`}
                />
              </div>
            )}

          </div>
        </Card>

        {cameraOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="font-bold text-slate-800">Take Profile Photo</h3>
                  <p className="text-xs text-slate-500">Use the live camera to capture the farmer photo.</p>
                </div>
                <button type="button" onClick={closeCamera} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="bg-black">
                <video ref={cameraVideoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
              </div>
              <div className="flex justify-end gap-2 p-4">
                <Button type="button" variant="secondary" onClick={closeCamera}>Cancel</Button>
                <Button type="button" onClick={captureCameraPhoto}>
                  <Icon name="photo_camera" size={18} /> Capture Photo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* FARMS + CROP DETAILS */}
        <Card className="p-6">
          <SectionTitle
            icon="agriculture"
            title="Farm Details"
            description="A farmer can have multiple farms. Add each farm with its own crops."
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">Farm {farms.length + 1}</p>
                <p className="text-xs text-slate-500">Enter this farm location and add its crops below.</p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                {crops.length} crop{crops.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input label="Village" value={form.village} onChange={(v) => update("village", v)} placeholder="e.g. Rajapalayam" icon="location_on" required />
              <Input label="Landmark" value={form.landmark} onChange={(v) => update("landmark", v)} placeholder="e.g. Near Temple" icon="near_me" />
              <Input label="District" value={form.district} onChange={(v) => update("district", v)} placeholder="e.g. Virudhunagar" icon="location_city" required />
              <Input label="State" value={form.state} onChange={(v) => update("state", v)} placeholder="e.g. Tamil Nadu" icon="public" />
              <Input label="Pincode" value={form.pincode} onChange={(v) => update("pincode", v)} placeholder="e.g. 626117" icon="mark_email_read" />
              <Input label="Total Farm Land Size (Acres)" type="number" value={farmLandSize} onChange={setFarmLandSize} placeholder="e.g. 5" required />
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="mb-3">
                <p className="font-bold text-slate-800">Crop Details</p>
                <p className="text-xs text-slate-500">Add multiple crops for this farm.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Select label="Crop" value={cropType} onChange={setCropType} placeholder="Select crop" options={cropTypes.map((c) => ({ value: c, label: c }))} />
                <Input label="Crop Land Size (Acres)" type="number" value={cropLandSize} onChange={setCropLandSize} placeholder="e.g. 2.5" />
                <div className="flex items-end">
                  <Button type="button" onClick={adsdrop} disabled={!canAdsdrop} className="w-full">
                    <Icon name="add" size={22} /> Add Crop
                  </Button>
                </div>
              </div>

              {crops.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-700">Crops in Farm {farms.length + 1}</p>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{crops.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {crops.map((crop, index) => (
                      <div key={crop.id} className="flex items-center gap-3 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800">{crop.cropType}</p>
                          <p className="text-xs text-slate-500">{crop.landSize} Acres</p>
                        </div>
                        <button type="button" onClick={() => removeCrop(crop.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600" title="Remove crop">
                          <Icon name="delete" size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" variant="secondary" onClick={addFarm} disabled={!currentFarmReady}>
                <Icon name="add" size={20} /> Add Farm
              </Button>
            </div>
          </div>

          {farms.length > 0 && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">Added Farms</p>
                  <p className="text-xs text-slate-500">Each farm keeps its own location and crop details.</p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{farms.length} farm{farms.length === 1 ? "" : "s"}</span>
              </div>

              {farms.map((farm, farmIndex) => (
                <div key={farm.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-bold text-slate-800">Farm {farmIndex + 1}</p>
                      <p className="mt-1 text-sm text-slate-600">{farm.village}{farm.landmark ? ` · ${farm.landmark}` : ""}, {farm.district}</p>
                      <p className="text-xs text-slate-500">{farm.pincode ? `Pincode: ${farm.pincode} · ` : ""}{farm.landSize ? `${farm.landSize} Acres Total Farm Land` : ""}</p>
                    </div>
                    <button type="button" onClick={() => removeFarm(farm.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600" title="Remove farm">
                      <Icon name="delete" size={18} />
                    </button>
                  </div>
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Crop Details</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500">
                          <tr><th className="px-3 py-2 text-left">Crop</th><th className="px-3 py-2 text-left">Land</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {farm.crops.map((crop) => (
                            <tr key={crop.id}><td className="px-3 py-2 font-semibold">{crop.cropType}</td><td className="px-3 py-2">{crop.landSize} Acres</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
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
