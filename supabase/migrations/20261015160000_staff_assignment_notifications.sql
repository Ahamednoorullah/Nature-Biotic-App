/*
# Staff assignment notifications

The app derives most notifications from current documents. A staff assignment
is a one-time event, so it is stored here and shown with the existing
notification bell. Read state stays in notification_reads, one row per user.
*/

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  kind text not null check (kind = 'staff_assignment'),
  title text not null,
  message text not null,
  staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notifications_store_created_idx
  on public.notifications (store_id, created_at desc);

alter table public.notifications enable row level security;

revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_company_admin()
    or (
      public.is_store_admin()
      and store_id = public.auth_store_id()
    )
  );

create or replace function public.nb_notify_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_company_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.store_id is not distinct from old.store_id then
    return new;
  end if;
  insert into public.notifications (store_id, kind, title, message, staff_id)
  values (
    new.store_id,
    'staff_assignment',
    'New Staff Assigned',
    trim(new.name) || ' has been assigned to your store by Company Admin.',
    new.id
  );
  return new;
end;
$$;

revoke all on function public.nb_notify_staff_assignment() from public, anon, authenticated;

create trigger trg_staff_assignment_notification
  after insert or update of store_id on public.staff
  for each row
  execute function public.nb_notify_staff_assignment();
