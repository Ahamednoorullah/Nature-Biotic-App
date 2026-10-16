-- One attendance row per staff member and workday.
-- A second check-in does not open another session, and check-out only closes an open one.

create or replace function public.check_in(
  p_staff_id uuid default null,
  p_status text default 'checked_in',
  p_note text default null,
  p_attendance_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := coalesce(p_staff_id, public.auth_staff_id());
  v_store uuid;
  v_id uuid;
begin
  if v_staff is null then
    raise exception 'This login is not linked to a staff record';
  end if;
  select store_id into v_store from public.staff where id = v_staff and status = 'active';
  if v_store is null then
    raise exception 'Staff member not found';
  end if;
  if public.is_fro() then
    if v_staff <> public.auth_staff_id() or v_store <> public.auth_store_id() then
      raise exception 'An FRO can only mark their own attendance' using errcode = '42501';
    end if;
  else
    perform public.nb_require_store_admin(v_store);
  end if;
  if p_status not in ('present', 'leave', 'absent', 'half_day', 'checked_in') then
    raise exception 'Invalid attendance status %', p_status;
  end if;

  insert into public.staff_attendance (store_id, staff_id, attendance_date, check_in_at, status, note)
  values (
    v_store, v_staff, coalesce(p_attendance_date, public.nb_today()),
    case when p_status in ('present', 'half_day', 'checked_in') then now() end,
    p_status, p_note
  )
  on conflict (staff_id, attendance_date) do update
    set status = excluded.status,
        note = coalesce(excluded.note, staff_attendance.note),
        check_in_at = coalesce(staff_attendance.check_in_at, excluded.check_in_at)
  where staff_attendance.check_in_at is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Already checked in for today';
  end if;
  return v_id;
end;
$$;

create or replace function public.check_out(p_staff_id uuid default null, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := coalesce(p_staff_id, public.auth_staff_id());
  v_store uuid;
  v_id uuid;
begin
  if v_staff is null then
    raise exception 'This login is not linked to a staff record';
  end if;
  select store_id into v_store from public.staff where id = v_staff and status = 'active';
  if v_store is null then
    raise exception 'Staff member not found';
  end if;
  if public.is_fro() then
    if v_staff <> public.auth_staff_id() or v_store <> public.auth_store_id() then
      raise exception 'An FRO can only mark their own attendance' using errcode = '42501';
    end if;
  else
    perform public.nb_require_store_admin(v_store);
  end if;

  update public.staff_attendance
     set check_out_at = now(), status = 'checked_out', note = coalesce(p_note, note)
   where staff_id = v_staff
     and store_id = v_store
     and attendance_date = public.nb_today()
     and check_in_at is not null
     and check_out_at is null
  returning id into v_id;
  if v_id is null then
    raise exception 'No open check-in found for today';
  end if;
  return v_id;
end;
$$;
