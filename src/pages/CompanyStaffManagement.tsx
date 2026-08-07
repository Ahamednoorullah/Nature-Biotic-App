import { Card, EmptyState, Button, Icon } from '@/components/ui';

export default function CompanyStaffManagement() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Staff Management</h1>
          <p className="text-slate-500 mt-1">Manage Nature Biotic company staff and roles.</p>
        </div>
        <Button>
          <Icon name="add" size={20} fill /> Add Staff
        </Button>
      </div>

      <Card className="p-0">
        <EmptyState
          icon="badge"
          title="No staff added yet"
          description="Add staff members to manage roles and access across Nature Biotic."
          action={
            <Button>
              <Icon name="add" size={20} fill /> Add Staff
            </Button>
          }
        />
      </Card>
    </div>
  );
}
