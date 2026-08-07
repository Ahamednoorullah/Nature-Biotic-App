import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Input, Badge } from '@/components/ui';
import { Icon } from '@/components/ui';

export default function CompanySettings() {
  const { user } = useAuth();
  const [name, setName] = useState('Administrator');
  const [email, setEmail] = useState(user?.email ?? 'admin@naturebiotic.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [company, setCompany] = useState('Nature Biotic Pvt. Ltd.');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and company preferences.</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="person" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Profile Information</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={name} onChange={setName} icon="person" />
            <Input label="Email Address" value={email} onChange={setEmail} icon="mail" />
            <Input label="Phone Number" value={phone} onChange={setPhone} icon="call" />
            <Input label="Company Name" value={company} onChange={setCompany} icon="business" />
          </div>
          <div className="flex items-center gap-3 mt-5">
            <Button onClick={handleSave}>
              <Icon name="save" size={18} /> Save Changes
            </Button>
            {saved && (
              <Badge color="green">
                <Icon name="check_circle" size={14} fill /> Saved successfully
              </Badge>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="notifications" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Notification Preferences</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Low stock alerts', desc: 'Get notified when products run low', on: true },
              { label: 'Daily sales summary', desc: 'Receive a daily report of store sales', on: true },
              { label: 'Outstanding payment reminders', desc: 'Alerts for pending farmer payments', on: false },
              { label: 'Staff activity updates', desc: 'Notifications for staff changes', on: true },
            ].map((item) => (
              <Toggle key={item.label} label={item.label} desc={item.desc} defaultOn={item.on} />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="business" size={22} className="text-brand-600" />
            <h2 className="font-bold text-slate-800">Company Details</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="GST Number" value="29ABCDE1234F1Z5" onChange={() => {}} icon="receipt" />
            <Input label="Business Type" value="Agricultural Manufacturing" onChange={() => {}} icon="category" />
            <Input label="Headquarters" value="Bengaluru, Karnataka" onChange={() => {}} icon="location_on" />
            <Input label="Established" value="2018" onChange={() => {}} icon="event" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Toggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <button onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-base ${on ? 'bg-brand-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
