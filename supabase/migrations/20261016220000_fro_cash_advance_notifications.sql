-- Store → FRO cash advances (Cash Received): pending/accepted notifications.
-- Accept remains idempotent on fro_cash_advances.status = pending.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'staff_assignment',
    'cash_handover_pending',
    'cash_handover_accepted',
    'company_debit_note',
    'fro_stock_return_pending',
    'fro_stock_return_accepted',
    'fro_stock_return_rejected',
    'fro_cash_advance_pending',
    'fro_cash_advance_accepted'
  ));

alter table public.notifications
  add column if not exists cash_advance_id uuid references public.fro_cash_advances (id) on delete cascade;

create unique index if not exists notifications_cash_advance_event_uidx
  on public.notifications (cash_advance_id, kind)
  where cash_advance_id is not null;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_company_admin()
    or (
      public.is_store_admin()
      and store_id = public.auth_store_id()
    )
    or (
      public.is_fro()
      and store_id = public.auth_store_id()
      and staff_id = public.auth_staff_id()
      and kind in (
        'cash_handover_accepted',
        'fro_stock_return_accepted',
        'fro_stock_return_rejected',
        'fro_cash_advance_pending'
      )
    )
  );

create or replace function public.create_cash_advance(
  p_fro_staff_id uuid,
  p_amount numeric,
  p_method public.payment_method default 'cash',
  p_advance_date date default null,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_id uuid;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_fro_name text;
begin
  select store_id, coalesce(nullif(trim(name), ''), 'FRO')
    into v_store, v_fro_name
    from public.staff
   where id = p_fro_staff_id and public.nb_is_fro_designation(designation);
  if v_store is null then
    raise exception 'FRO % not found', p_fro_staff_id;
  end if;
  perform public.nb_require_store_admin(v_store);
  if v_amount <= 0 then
    raise exception 'Cash advance amount must be greater than zero';
  end if;

  insert into public.fro_cash_advances (
    store_id, fro_staff_id, advance_date, amount, method, remarks, received_from, settlement_id
  ) values (
    v_store, p_fro_staff_id, coalesce(p_advance_date, public.nb_today()), v_amount, p_method,
    p_remarks, 'Store', public.nb_open_settlement_id(p_fro_staff_id)
  )
  returning id into v_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_advance_id)
  values (
    v_store,
    'fro_cash_advance_pending',
    'Cash request pending acceptance',
    'Store sent ₹' || to_char(v_amount, 'FM999,999,990.00') || ' to ' || v_fro_name || ' awaiting acceptance.',
    p_fro_staff_id,
    v_id
  )
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function public.accept_cash_advance(p_advance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fro_cash_advances%rowtype;
  v_fro_name text;
begin
  select * into v_row from public.fro_cash_advances where id = p_advance_id for update;
  if not found then
    raise exception 'Cash advance % not found', p_advance_id;
  end if;
  if not (public.is_fro() and public.auth_staff_id() = v_row.fro_staff_id) then
    raise exception 'Only the receiving FRO can accept this cash' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This cash advance has already been accepted';
  end if;

  update public.fro_cash_advances
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = auth.uid(),
         settlement_id = coalesce(settlement_id, public.nb_open_settlement_id(v_row.fro_staff_id))
   where id = p_advance_id;

  select coalesce(nullif(trim(name), ''), 'FRO') into v_fro_name
    from public.staff where id = v_row.fro_staff_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_advance_id)
  values (
    v_row.store_id,
    'fro_cash_advance_accepted',
    'Cash request accepted',
    v_fro_name || ' accepted ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' from Store.',
    v_row.fro_staff_id,
    v_row.id
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.create_cash_advance(uuid, numeric, public.payment_method, date, text) from public, anon;
revoke all on function public.accept_cash_advance(uuid) from public, anon;
grant execute on function public.create_cash_advance(uuid, numeric, public.payment_method, date, text) to authenticated, service_role;
grant execute on function public.accept_cash_advance(uuid) to authenticated, service_role;
