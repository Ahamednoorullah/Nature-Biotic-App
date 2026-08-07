import { useState } from 'react';
import { useNav } from '@/context/NavContext';
import { cropTypes, soilTypes, waterSources, paymentMethods, customerCategories, type CustomerCategory } from '@/lib/data';
import { Card, Button, Input, Select, Textarea, SectionTitle, Icon } from '@/components/ui';

type FormState = {
  name: string;
  phone: string;
  altMobile: string;
  email: string;
  aadhar: string;
  gst: string;
  village: string;
  taluk: string;
  district: string;
  state: string;
  pincode: string;
  farmAddress: string;
  landSize: string;
  cropType: string;
  soilType: string;
  waterSource: string;
  paymentMethod: string;
  creditLimit: string;
  outstanding: string;
  customerCategory: string;
  remarks: string;
  internalNotes: string;
};

const emptyForm: FormState = {
  name: '', phone: '', altMobile: '', email: '', aadhar: '', gst: '',
  village: '', taluk: '', district: '', state: 'Tamil Nadu', pincode: '',
  farmAddress: '', landSize: '', cropType: '', soilType: '', waterSource: '',
  paymentMethod: '', creditLimit: '', outstanding: '0', customerCategory: 'Retail',
  remarks: '', internalNotes: '',
};

export default function StoreAddFarmer({ storeId: _storeId }: { storeId: string }) {
  const { goStorePage } = useNav();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm({ ...form, [key]: value });
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => { setSaved(false); goStorePage('farmers'); }, 1200);
  }

  function handleSaveAndAdd() {
    setSaved(true);
    setTimeout(() => { setSaved(false); setForm(emptyForm); }, 1200);
  }

  const isValid = form.name && form.phone && form.village && form.district;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => goStorePage('farmers')} className="p-2 rounded-xl hover:bg-slate-100 transition-base text-slate-500">
          <Icon name="arrow_back" size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Add New Farmer</h1>
          <p className="text-slate-500 mt-1">Register a new farmer or customer in the system.</p>
        </div>
      </div>

      {saved && (
        <div className="fixed top-20 right-6 z-50 animate-scale-in">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-elevated">
            <Icon name="check_circle" size={20} fill />
            <span className="text-sm font-semibold">Farmer saved successfully!</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* GENERAL INFORMATION */}
        <Card className="p-6">
          <SectionTitle icon="person" title="General Information" description="Basic farmer identification and contact details." />
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center hover:border-brand-400 hover:bg-brand-50/30 transition-base cursor-pointer">
                <div className="text-center">
                  <Icon name="person_add" size={28} className="text-slate-400" />
                  <p className="text-xs text-slate-400 mt-1">Upload</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Upload a profile photo</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 1MB.</p>
                <Button variant="secondary" size="sm" className="mt-3">
                  <Icon name="upload" size={16} /> Choose File
                </Button>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Farmer Name" value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Murugan" icon="person" required />
            <Input label="Mobile Number" type="tel" value={form.phone} onChange={(v) => update('phone', v)} placeholder="e.g. 9876543210" icon="call" required />
            <Input label="Alternative Mobile" type="tel" value={form.altMobile} onChange={(v) => update('altMobile', v)} placeholder="e.g. 9123456700" icon="call" />
            <Input label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} placeholder="e.g. murugan.farm@gmail.com" icon="mail" />
            <Input label="Aadhar Number (Optional)" value={form.aadhar} onChange={(v) => update('aadhar', v)} placeholder="XXXX-XXXX-XXXX" icon="badge" />
            <Input label="GST Number (Optional)" value={form.gst} onChange={(v) => update('gst', v)} placeholder="33ABCDE1234F1Z5" icon="receipt_long" />
          </div>
        </Card>

        {/* FARM DETAILS */}
        <Card className="p-6">
          <SectionTitle icon="agriculture" title="Farm Details" description="Farm location, land, and crop information." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Village" value={form.village} onChange={(v) => update('village', v)} placeholder="e.g. Rajapalayam" icon="location_on" required />
            <Input label="Taluk" value={form.taluk} onChange={(v) => update('taluk', v)} placeholder="e.g. Rajapalayam" icon="map" />
            <Input label="District" value={form.district} onChange={(v) => update('district', v)} placeholder="e.g. Virudhunagar" icon="location_city" required />
            <Input label="State" value={form.state} onChange={(v) => update('state', v)} placeholder="e.g. Tamil Nadu" icon="public" />
            <Input label="Pincode" value={form.pincode} onChange={(v) => update('pincode', v)} placeholder="e.g. 626117" icon="mark_email_read" />
            <Input label="Land Size (Acres)" type="number" value={form.landSize} onChange={(v) => update('landSize', v)} placeholder="e.g. 4.5" icon="crop_square" />
            <Select label="Crop Type" value={form.cropType} onChange={(v) => update('cropType', v)} placeholder="Select crop"
              options={cropTypes.map((c) => ({ value: c, label: c }))} />
            <Select label="Soil Type" value={form.soilType} onChange={(v) => update('soilType', v)} placeholder="Select soil type"
              options={soilTypes.map((s) => ({ value: s, label: s }))} />
            <Select label="Water Source" value={form.waterSource} onChange={(v) => update('waterSource', v)} placeholder="Select water source"
              options={waterSources.map((w) => ({ value: w, label: w }))} />
          </div>
          <div className="mt-4">
            <Textarea label="Farm Address" value={form.farmAddress} onChange={(v) => update('farmAddress', v)} placeholder="Enter full farm address..." rows={2} />
          </div>
        </Card>

        {/* BUSINESS DETAILS */}
        <Card className="p-6">
          <SectionTitle icon="business_center" title="Business Details" description="Payment preferences and credit configuration." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Preferred Payment Method" value={form.paymentMethod} onChange={(v) => update('paymentMethod', v)} placeholder="Select payment method"
              options={paymentMethods.map((p) => ({ value: p, label: p }))} />
            <Input label="Credit Limit" type="number" value={form.creditLimit} onChange={(v) => update('creditLimit', v)} placeholder="e.g. 15000" icon="currency_rupee" />
            <Input label="Outstanding Amount" type="number" value={form.outstanding} onChange={(v) => update('outstanding', v)} placeholder="0" icon="payments" />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Category</label>
              <div className="flex gap-2">
                {customerCategories.map((cat) => (
                  <button key={cat} onClick={() => update('customerCategory', cat)}
                    className={`flex-1 px-3 py-3 rounded-xl text-sm font-semibold transition-base border ${
                      form.customerCategory === cat
                        ? 'bg-brand-50 text-brand-700 border-brand-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* NOTES */}
        <Card className="p-6">
          <SectionTitle icon="notes" title="Notes" description="Internal remarks and observations." />
          <div className="space-y-4">
            <Textarea label="Remarks" value={form.remarks} onChange={(v) => update('remarks', v)} placeholder="Public remarks visible to staff..." rows={2} />
            <Textarea label="Internal Notes" value={form.internalNotes} onChange={(v) => update('internalNotes', v)} placeholder="Private internal notes..." rows={2} />
          </div>
        </Card>

        {/* Bottom actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-6">
          <Button variant="secondary" onClick={() => goStorePage('farmers')} className="sm:mr-auto">
            <Icon name="close" size={18} /> Cancel
          </Button>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" onClick={handleSaveAndAdd} disabled={!isValid}>
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
