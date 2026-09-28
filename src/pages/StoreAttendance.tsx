import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Icon, Input, Select, Button, EmptyState } from "@/components/ui";
import { staff as staffSeed, getStore, type Staff } from "@/lib/data";
import { formatDate } from "@/lib/format";

type AttendanceStatus = "Present" | "Leave" | "Absent" | "Half Day";

type AttendanceRecord = {
  id: string;
  staffId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: AttendanceStatus;
  note: string;
};

const STORAGE_PREFIX = "nature-biotic-store-attendance-v1";

function isoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMinutes(time: string) {
  if (!time) return 0;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function workDuration(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return "-";
  const minutes = Math.max(0, getMinutes(checkOut) - getMinutes(checkIn));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function isLate(checkIn: string) {
  return !!checkIn && getMinutes(checkIn) > 9 * 60 + 45;
}

function createSeedAttendance(storeStaff: Staff[]): AttendanceRecord[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentDay = today.getDate();
  const records: AttendanceRecord[] = [];

  storeStaff.forEach((member, staffIndex) => {
    for (let day = 1; day <= currentDay; day += 1) {
      const date = new Date(year, month, day);
      const weekDay = date.getDay();

      // Sunday weekly off is not counted as leave/absent.
      if (weekDay === 0) continue;

      let status: AttendanceStatus = "Present";
      let checkIn = staffIndex % 2 === 0 ? "09:31" : "09:46";
      let checkOut = "18:05";
      let note = "";

      if ((day + staffIndex * 2) % 13 === 0) {
        status = "Leave";
        checkIn = "";
        checkOut = "";
        note = "Approved leave";
      } else if ((day + staffIndex * 3) % 17 === 0) {
        status = "Absent";
        checkIn = "";
        checkOut = "";
        note = "Absent";
      } else if ((day + staffIndex) % 11 === 0) {
        status = "Half Day";
        checkIn = "09:35";
        checkOut = "13:35";
        note = "Half day";
      } else {
        const minuteOffset = (day + staffIndex * 7) % 20;
        const base = 9 * 60 + 25 + minuteOffset;
        checkIn = `${String(Math.floor(base / 60)).padStart(2, "0")}:${String(
          base % 60,
        ).padStart(2, "0")}`;
        checkOut = staffIndex % 3 === 0 ? "18:12" : "18:02";
      }

      // Today's active staff can still be checked in without checkout.
      if (day === currentDay && status === "Present") {
        checkOut = "";
        note = "Currently checked in";
      }

      records.push({
        id: `${member.id}-${isoDate(date)}`,
        staffId: member.id,
        date: isoDate(date),
        checkIn,
        checkOut,
        status,
        note,
      });
    }
  });

  return records;
}

function statusClass(status: AttendanceStatus) {
  switch (status) {
    case "Present":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Leave":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Half Day":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-red-50 text-red-700 border-red-200";
  }
}

export default function StoreAttendance({ storeId }: { storeId: string }) {
  const store = getStore(storeId);
  const storeStaff = useMemo(
    () => staffSeed.filter((member) => member.storeId === storeId),
    [storeId],
  );

  const storageKey = `${STORAGE_PREFIX}:${storeId}`;
  const [records] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);

      const seeded = createSeedAttendance(
        staffSeed.filter((member) => member.storeId === storeId),
      );
      localStorage.setItem(storageKey, JSON.stringify(seeded));
      return seeded;
    } catch {
      return createSeedAttendance(
        staffSeed.filter((member) => member.storeId === storeId),
      );
    }
  });

  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [staffFilter, setStaffFilter] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const currentMonth = monthKey(new Date());

  const monthRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.date.startsWith(currentMonth) &&
          storeStaff.some((member) => member.id === record.staffId),
      ),
    [records, currentMonth, storeStaff],
  );

  const selectedDayRows = useMemo(() => {
    return storeStaff
      .filter(
        (member) => staffFilter === "all" || member.id === staffFilter,
      )
      .map((member) => ({
        member,
        record: records.find(
          (record) =>
            record.staffId === member.id &&
            record.date === selectedDate,
        ),
      }));
  }, [storeStaff, staffFilter, records, selectedDate]);

  function monthlyCount(staffId: string, status: AttendanceStatus) {
    return monthRecords.filter(
      (record) =>
        record.staffId === staffId && record.status === status,
    ).length;
  }

  function totalPresent(staffId: string) {
    return (
      monthlyCount(staffId, "Present") +
      monthlyCount(staffId, "Half Day")
    );
  }

  const todayRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.date === isoDate(new Date()) &&
          storeStaff.some((member) => member.id === record.staffId),
      ),
    [records, storeStaff],
  );

  const presentToday = todayRecords.filter(
    (record) =>
      record.status === "Present" || record.status === "Half Day",
  ).length;
  const leaveToday = todayRecords.filter(
    (record) => record.status === "Leave",
  ).length;
  const absentToday = todayRecords.filter(
    (record) => record.status === "Absent",
  ).length;

  const selectedStaffHistory = useMemo(() => {
    if (!selectedStaff) return [];
    return monthRecords
      .filter((record) => record.staffId === selectedStaff.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthRecords, selectedStaff]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Attendance
        </h1>
        <p className="mt-1 text-slate-500">
          View check-in, check-out, leave and monthly attendance for staff assigned
          to {store?.name || "this store"}.
        </p>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Icon name="groups" size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Assigned Staff
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {storeStaff.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon name="how_to_reg" size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Present Today
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {presentToday}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Icon name="event_busy" size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Leave Today
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {leaveToday}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <Icon name="person_off" size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Absent Today
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {absentToday}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="w-full lg:w-[210px]">
            <Input
              label="Attendance Date"
              type="date"
              value={selectedDate}
              onChange={setSelectedDate}
            />
          </div>

          <div className="w-full lg:w-[240px]">
            <Select
              label="Staff"
              value={staffFilter}
              onChange={setStaffFilter}
              placeholder="All Staff"
              options={storeStaff.map((member) => ({
                value: member.id,
                label: member.name,
              }))}
            />
          </div>

          {(staffFilter !== "all" ||
            selectedDate !== isoDate(new Date())) && (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedDate(isoDate(new Date()));
                setStaffFilter("all");
              }}
            >
              <Icon name="filter_alt_off" size={17} />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {storeStaff.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="badge"
            title="No staff assigned"
            description="Assign staff to this store from Company Staff Management."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-800">
                  Daily Attendance
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(selectedDate)} · Click a staff row to view this
                  month's full history.
                </p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                {currentMonth}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="w-[5%] px-3 py-3 text-center">S.No</th>
                  <th className="w-[20%] px-3 py-3 text-left">Staff</th>
                  <th className="w-[12%] px-3 py-3 text-left">Designation</th>
                  <th className="w-[10%] px-3 py-3 text-center">Check In</th>
                  <th className="w-[10%] px-3 py-3 text-center">Check Out</th>
                  <th className="w-[10%] px-3 py-3 text-center">Work Hours</th>
                  <th className="w-[10%] px-3 py-3 text-center">Status</th>
                  <th className="w-[8%] px-3 py-3 text-center">Present</th>
                  <th className="w-[7%] px-3 py-3 text-center">Leave</th>
                  <th className="w-[8%] px-3 py-3 text-center">Absent</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {selectedDayRows.map(({ member, record }, index) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelectedStaff(member)}
                    className="cursor-pointer transition hover:bg-brand-50/40"
                    title="Click to view attendance history"
                  >
                    <td className="px-3 py-3 text-center text-slate-500">
                      {index + 1}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {member.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {member.phone}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-slate-600">
                      {member.designation}
                    </td>

                    <td className="px-3 py-3 text-center">
                      {record?.checkIn ? (
                        <div>
                          <span className="font-semibold text-slate-700">
                            {record.checkIn}
                          </span>
                          {isLate(record.checkIn) && (
                            <p className="mt-0.5 text-[10px] font-semibold text-amber-600">
                              Late
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center font-semibold text-slate-700">
                      {record?.checkOut || "-"}
                    </td>

                    <td className="px-3 py-3 text-center text-slate-600">
                      {record
                        ? workDuration(record.checkIn, record.checkOut)
                        : "-"}
                    </td>

                    <td className="px-3 py-3 text-center">
                      {record ? (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(
                            record.status,
                          )}`}
                        >
                          {record.status}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                          No Record
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center font-bold text-emerald-700">
                      {totalPresent(member.id)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-amber-700">
                      {monthlyCount(member.id, "Leave")}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-red-600">
                      {monthlyCount(member.id, "Absent")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedStaff &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[90vh] w-[94vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Attendance History
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-800">
                    {selectedStaff.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStaff.designation} · {store?.name || "Store"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-xs font-semibold text-emerald-600">
                    Present
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-800">
                    {totalPresent(selectedStaff.id)}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-xs font-semibold text-amber-600">
                    Leave
                  </p>
                  <p className="mt-1 text-xl font-bold text-amber-800">
                    {monthlyCount(selectedStaff.id, "Leave")}
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <p className="text-xs font-semibold text-red-600">
                    Absent
                  </p>
                  <p className="mt-1 text-xl font-bold text-red-800">
                    {monthlyCount(selectedStaff.id, "Absent")}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-xs font-semibold text-blue-600">
                    Half Day
                  </p>
                  <p className="mt-1 text-xl font-bold text-blue-800">
                    {monthlyCount(selectedStaff.id, "Half Day")}
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-[15%] px-3 py-3 text-center">Date</th>
                      <th className="w-[15%] px-3 py-3 text-center">Check In</th>
                      <th className="w-[15%] px-3 py-3 text-center">Check Out</th>
                      <th className="w-[15%] px-3 py-3 text-center">Work Hours</th>
                      <th className="w-[15%] px-3 py-3 text-center">Status</th>
                      <th className="w-[25%] px-3 py-3 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedStaffHistory.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-center font-medium text-slate-700">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {record.checkIn || "-"}
                          {isLate(record.checkIn) && (
                            <span className="ml-1 text-[10px] font-semibold text-amber-600">
                              Late
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {record.checkOut || "-"}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-600">
                          {workDuration(record.checkIn, record.checkOut)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(
                              record.status,
                            )}`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {record.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
