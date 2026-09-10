import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Input, Badge } from '@/components/ui';
import { Icon } from '@/components/ui';

type AdminDetails = {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  dob: string;
  dateOfJoining: string;
  address: string;
};

type BankDetails = {
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  location: string;
  upiId: string;
};

const ADMIN_STORAGE_KEY = "nature_biotic_admin_details";
const BANK_STORAGE_KEY = "nature_biotic_admin_bank_details";

const defaultAdminDetails: AdminDetails = {
  name: "Administrator",
  email: "admin@naturebiotic.com",
  phone: "+91 98765 43210",
  employeeId: "",
  dob: "",
  dateOfJoining: "",
  address: "",
};

const defaultBankDetails: BankDetails = {
  accountName: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  location: "",
  upiId: "",
};

export default function CompanySettings() {
  const { user } = useAuth();

  // ---------- Profile Information (unchanged) ----------
  const [name, setName] = useState('Administrator');
  const [email, setEmail] = useState(user?.email ?? 'admin@naturebiotic.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [company, setCompany] = useState('Nature Biotic Pvt. Ltd.');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ---------- Admin & Bank Details (fixed) ----------
  const [adminDetails, setAdminDetails] = useState<AdminDetails>(defaultAdminDetails);
  const [bankDetails, setBankDetails] = useState<BankDetails>(defaultBankDetails);
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  // Load saved admin/bank details from localStorage on mount
  useEffect(() => {
    try {
      const savedAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
      const savedBank = localStorage.getItem(BANK_STORAGE_KEY);

      if (savedAdmin) {
        setAdminDetails({ ...defaultAdminDetails, ...JSON.parse(savedAdmin) });
      }
      if (savedBank) {
        setBankDetails({ ...defaultBankDetails, ...JSON.parse(savedBank) });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const updateAdmin = (field: keyof AdminDetails, value: string) => {
    setAdminDetails((prev) => ({ ...prev, [field]: value }));
  };

  const updateBank = (field: keyof BankDetails, value: string) => {
    setBankDetails((prev) => ({ ...prev, [field]: value }));
  };

  const saveAdminDetails = () => {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminDetails));
      setEditingAdmin(false);
      setAdminSaved(true);
      setTimeout(() => setAdminSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save admin details:", error);
    }
  };

  const saveBankDetails = () => {
    try {
      localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(bankDetails));
      setEditingBank(false);
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save bank details:", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account, admin, bank and company preferences.</p>
      </div>

      <div className="space-y-6">
        {/* ================= PROFILE INFORMATION ================= */}
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

        {/* ================= ADMIN DETAILS ================= */}
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Icon name="person" size={22} className="text-brand-600" />
              <div>
                <h2 className="font-bold text-slate-800">Admin Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">Administrator profile information</p>
              </div>
            </div>

            {!editingAdmin && (
              <Button variant="secondary" onClick={() => setEditingAdmin(true)}>
                <Icon name="edit" size={17} />
                Edit
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={adminDetails.name}
              onChange={(value) => updateAdmin("name", value)}
              icon="person"
              readOnly={!editingAdmin}
            />
            <Input
              label="Email ID"
              value={adminDetails.email}
              onChange={(value) => updateAdmin("email", value)}
              icon="mail"
              readOnly={!editingAdmin}
            />
            <Input
              label="Phone Number"
              value={adminDetails.phone}
              onChange={(value) => updateAdmin("phone", value)}
              icon="call"
              readOnly={!editingAdmin}
            />
            <Input
              label="Employee ID"
              value={adminDetails.employeeId}
              onChange={(value) => updateAdmin("employeeId", value)}
              icon="badge"
              readOnly={!editingAdmin}
              placeholder="Enter employee ID"
            />
            <Input
              label="D.O.B"
              type="date"
              value={adminDetails.dob}
              onChange={(value) => updateAdmin("dob", value)}
              icon="calendar_month"
              readOnly={!editingAdmin}
            />
            <Input
              label="Date of Joining"
              type="date"
              value={adminDetails.dateOfJoining}
              onChange={(value) => updateAdmin("dateOfJoining", value)}
              icon="event"
              readOnly={!editingAdmin}
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                value={adminDetails.address}
                onChange={(value) => updateAdmin("address", value)}
                icon="location_on"
                readOnly={!editingAdmin}
                placeholder="Enter address"
              />
            </div>
          </div>

          {editingAdmin && (
            <div className="flex items-center gap-3 mt-6">
              <Button onClick={saveAdminDetails}>
                <Icon name="save" size={18} />
                Save Changes
              </Button>
              <Button variant="secondary" onClick={() => setEditingAdmin(false)}>
                Cancel
              </Button>
              {adminSaved && (
                <Badge color="green">
                  <Icon name="check_circle" size={14} fill />
                  Saved successfully
                </Badge>
              )}
            </div>
          )}

          {!editingAdmin && adminSaved && (
            <div className="mt-5">
              <Badge color="green">
                <Icon name="check_circle" size={14} fill /> Saved successfully
              </Badge>
            </div>
          )}
        </Card>

        {/* ================= BANK DETAILS ================= */}
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Icon name="account_balance" size={22} className="text-brand-600" />
              <div>
                <h2 className="font-bold text-slate-800">Bank Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">Administrator bank and payment information</p>
              </div>
            </div>

            {!editingBank && (
              <Button variant="secondary" onClick={() => setEditingBank(true)}>
                <Icon name="edit" size={17} />
                Edit
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Account Name"
              value={bankDetails.accountName}
              onChange={(value) => updateBank("accountName", value)}
              icon="person"
              readOnly={!editingBank}
              placeholder="Enter account name"
            />
            <Input
              label="Account Number"
              value={bankDetails.accountNumber}
              onChange={(value) => updateBank("accountNumber", value)}
              icon="account_balance"
              readOnly={!editingBank}
              placeholder="Enter account number"
            />
            <Input
              label="IFSC Code"
              value={bankDetails.ifscCode}
              onChange={(value) => updateBank("ifscCode", value.toUpperCase())}
              icon="code"
              readOnly={!editingBank}
              placeholder="Enter IFSC code"
            />
            <Input
              label="Bank Name"
              value={bankDetails.bankName}
              onChange={(value) => updateBank("bankName", value)}
              icon="account_balance"
              readOnly={!editingBank}
              placeholder="Enter bank name"
            />
            <Input
              label="Location"
              value={bankDetails.location}
              onChange={(value) => updateBank("location", value)}
              icon="location_on"
              readOnly={!editingBank}
              placeholder="Enter bank location"
            />
            <Input
              label="UPI ID"
              value={bankDetails.upiId}
              onChange={(value) => updateBank("upiId", value)}
              icon="payments"
              readOnly={!editingBank}
              placeholder="Enter UPI ID"
            />
          </div>

          {editingBank && (
            <div className="flex items-center gap-3 mt-6">
              <Button onClick={saveBankDetails}>
                <Icon name="save" size={18} />
                Save Changes
              </Button>
              <Button variant="secondary" onClick={() => setEditingBank(false)}>
                Cancel
              </Button>
              {bankSaved && (
                <Badge color="green">
                  <Icon name="check_circle" size={14} fill />
                  Saved successfully
                </Badge>
              )}
            </div>
          )}

          {!editingBank && bankSaved && (
            <div className="mt-5">
              <Badge color="green">
                <Icon name="check_circle" size={14} fill />
                Saved successfully
              </Badge>
            </div>
          )}
        </Card>

        {/* ================= NOTIFICATION PREFERENCES ================= */}
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

        {/* ================= COMPANY DETAILS ================= */}
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
    <div className="flex items-center justify-between gap-4 w-full py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 truncate">{label}</p>
        <p className="text-xs text-slate-500 truncate">{desc}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-base ${on ? 'bg-brand-600' : 'bg-slate-200'}`}
      >
        <span
          className={`absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}