-- Cash handover notifications for the destination store and the submitting FRO.
-- Read state stays in notification_reads. Handovers have no document number.

alter table public.notifications drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('staff_assignment', 'cash_handover_pending', 'cash_handover_accepted'));

alter table public.notifications
  add column if not exists handover_id uuid references public.cash_handovers (id) on delete cascade;

create unique index if not exists notifications_handover_event_uidx
  on public.notifications (handover_id, kind)
  where handover_id is not null;

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
      and kind = 'cash_handover_accepted'
      and staff_id = public.auth_staff_id()
    )
  );

create or replace function public.create_cash_handover(
  p_amount numeric,
  p_method public.payment_method default 'cash',
  p_handover_date date default null,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_fro uuid := public.auth_staff_id();
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_available numeric;
  v_name text;
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can hand over cash' using errcode = '42501';
  end if;
  if p_method is distinct from 'cash' then
    raise exception 'Cash handover accepts cash only';
  end if;
  if v_amount <= 0 then
    raise exception 'Handover amount must be greater than zero';
  end if;

  perform 1 from public.staff where id = v_fro for update;
  select coalesce(nullif(trim(name), ''), 'FRO') into v_name
    from public.staff where id = v_fro;
  v_available := public.nb_fro_cash_in_hand(v_fro)
    - coalesce((
        select sum(h.amount) from public.cash_handovers h
        where h.fro_staff_id = v_fro and h.status = 'pending' and h.method = 'cash'
      ), 0);
  if v_amount > v_available then
    raise exception 'Handover amount % exceeds available cash %', v_amount, v_available;
  end if;

  insert into public.cash_handovers (store_id, fro_staff_id, handover_date, amount, method, remarks)
  values (public.auth_store_id(), v_fro, coalesce(p_handover_date, public.nb_today()), v_amount, 'cash', p_remarks)
  returning id into v_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, handover_id)
  values (
    public.auth_store_id(),
    'cash_handover_pending',
    'Cash handover awaiting acceptance',
    v_name || ' submitted a cash handover of ₹' || to_char(v_amount, 'FM999,999,990.00') || ' awaiting acceptance.',
    v_fro,
    v_id
  )
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function public.decide_cash_handover(p_handover_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cash_handovers%rowtype;
  v_available numeric;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select * into v_row from public.cash_handovers where id = p_handover_id for update;
  if not found then
    raise exception 'Handover % not found', p_handover_id;
  end if;
  perform public.nb_require_store_admin(v_row.store_id);
  if v_row.status <> 'pending' then
    raise exception 'Only pending handovers can be decided';
  end if;
  if p_decision = 'accepted' then
    if v_row.method is distinct from 'cash' then
      raise exception 'Only a cash handover can be accepted into cash';
    end if;
    perform 1 from public.staff where id = v_row.fro_staff_id for update;
    v_available := public.nb_fro_cash_in_hand(v_row.fro_staff_id);
    if v_row.amount > v_available then
      raise exception 'Accepting this handover would make cash in hand negative';
    end if;
  end if;
  update public.cash_handovers
     set status = p_decision, decided_at = now(), decided_by = auth.uid()
   where id = p_handover_id;

  if p_decision = 'accepted' then
    insert into public.notifications (store_id, kind, title, message, staff_id, handover_id)
    values (
      v_row.store_id,
      'cash_handover_accepted',
      'Cash handover accepted',
      'Your cash handover of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was accepted.',
      v_row.fro_staff_id,
      v_row.id
    )
    on conflict do nothing;
  end if;
end;
$$;
