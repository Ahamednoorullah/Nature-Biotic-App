-- FRO expense and cash-refund approval by Store Admin.
-- Pending rows reserve availability but do not change fro_cash_position until accepted.
-- Existing expenses stay accepted; existing refunds are backfilled as accepted.

-- ---------------------------------------------------------------------------
-- Schema: expenses status + refund status
-- ---------------------------------------------------------------------------
alter table public.expenses drop constraint if exists expenses_status_check;
alter table public.expenses
  add constraint expenses_status_check
  check (status in ('pending', 'accepted', 'rejected', 'cancelled'));

alter table public.fro_cash_refunds
  add column if not exists status text not null default 'accepted',
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references auth.users (id) on delete set null,
  add column if not exists refund_no text;

alter table public.fro_cash_refunds drop constraint if exists fro_cash_refunds_status_check;
alter table public.fro_cash_refunds
  add constraint fro_cash_refunds_status_check
  check (status in ('pending', 'accepted', 'rejected'));

update public.fro_cash_refunds
   set status = 'accepted'
 where status is distinct from 'accepted'
   and status is distinct from 'pending'
   and status is distinct from 'rejected';

-- Backfill refund numbers for rows that never had one (stable, unique).
update public.fro_cash_refunds r
   set refund_no = 'REF-' || upper(substr(replace(r.id::text, '-', ''), 1, 8))
 where refund_no is null or trim(refund_no) = '';

create unique index if not exists fro_cash_refunds_refund_no_uidx
  on public.fro_cash_refunds (refund_no)
  where refund_no is not null;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
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
    'fro_cash_advance_accepted',
    'fro_expense_pending',
    'fro_expense_accepted',
    'fro_expense_rejected',
    'fro_cash_refund_pending',
    'fro_cash_refund_accepted',
    'fro_cash_refund_rejected'
  ));

alter table public.notifications
  add column if not exists expense_id uuid references public.expenses (id) on delete cascade,
  add column if not exists cash_refund_id uuid references public.fro_cash_refunds (id) on delete cascade;

create unique index if not exists notifications_expense_event_uidx
  on public.notifications (expense_id, kind)
  where expense_id is not null;

create unique index if not exists notifications_cash_refund_event_uidx
  on public.notifications (cash_refund_id, kind)
  where cash_refund_id is not null;

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
        'fro_cash_advance_pending',
        'fro_expense_accepted',
        'fro_expense_rejected',
        'fro_cash_refund_accepted',
        'fro_cash_refund_rejected'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Cash position: accepted refunds only (expenses already required accepted)
-- ---------------------------------------------------------------------------
create or replace view public.fro_cash_position
with (security_invoker = true) as
select
  st.id as fro_staff_id,
  st.store_id,
  st.name as fro_name,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id
              and r.method = 'cash'
              and r.status = 'final'
              and r.collection_account = 'fro'), 0) as cash_receipts,
  coalesce((select sum(a.amount) from public.fro_cash_advances a
            where a.fro_staff_id = st.id and a.status = 'accepted' and a.method = 'cash'), 0) as advances_accepted,
  coalesce((select sum(h.amount) from public.cash_handovers h
            where h.fro_staff_id = st.id and h.status = 'accepted' and h.method = 'cash'), 0) as handovers_accepted,
  coalesce((select sum(e.amount) from public.expenses e
            where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0) as cash_expenses,
  coalesce((select sum(c.amount) from public.fro_cash_refunds c
            where c.fro_staff_id = st.id and c.method = 'cash' and c.status = 'accepted'), 0) as cash_refunds,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id
              and r.method = 'cash'
              and r.status = 'final'
              and r.collection_account = 'fro'), 0)
  + coalesce((select sum(a.amount) from public.fro_cash_advances a
              where a.fro_staff_id = st.id and a.status = 'accepted' and a.method = 'cash'), 0)
  - coalesce((select sum(h.amount) from public.cash_handovers h
              where h.fro_staff_id = st.id and h.status = 'accepted' and h.method = 'cash'), 0)
  - coalesce((select sum(e.amount) from public.expenses e
              where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0)
  - coalesce((select sum(c.amount) from public.fro_cash_refunds c
              where c.fro_staff_id = st.id and c.method = 'cash' and c.status = 'accepted'), 0) as cash_in_hand,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id
              and r.status = 'final'
              and r.collection_account = 'fro'
              and r.method <> 'cash'), 0) as digital_receipts,
  coalesce((select sum(d.amount) from public.fro_digital_settlements d
            where d.fro_staff_id = st.id and d.status = 'accepted'), 0) as digital_settled,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id
              and r.status = 'final'
              and r.collection_account = 'fro'
              and r.method <> 'cash'), 0)
  - coalesce((select sum(d.amount) from public.fro_digital_settlements d
              where d.fro_staff_id = st.id and d.status = 'accepted'), 0) as digital_in_account
from public.staff st
where public.nb_is_fro_designation(st.designation);

-- Available cash after reserving pending cash commitments (handovers, expenses, refunds).
create or replace function public.nb_fro_cash_available(p_fro uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.nb_fro_cash_in_hand(p_fro)
    - coalesce((
        select sum(h.amount) from public.cash_handovers h
        where h.fro_staff_id = p_fro and h.status = 'pending' and h.method = 'cash'
      ), 0)
    - coalesce((
        select sum(e.amount) from public.expenses e
        where e.fro_staff_id = p_fro and e.scope = 'fro' and e.status = 'pending' and e.method = 'cash'
      ), 0)
    - coalesce((
        select sum(r.amount) from public.fro_cash_refunds r
        where r.fro_staff_id = p_fro and r.status = 'pending' and r.method = 'cash'
      ), 0);
$$;

revoke all on function public.nb_fro_cash_available(uuid) from public, anon;
grant execute on function public.nb_fro_cash_available(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_expense: FRO rows start pending + notify Store once
-- ---------------------------------------------------------------------------
create or replace function public.create_expense(
  p_scope text,
  p_category_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_expense_date date default null,
  p_description text default null,
  p_entered_by_name text default null,
  p_store_id uuid default null,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_fro uuid;
  v_settlement uuid;
  v_no text;
  v_id uuid;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_status text := 'accepted';
  v_fro_name text;
  v_available numeric;
begin
  if v_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if p_scope = 'company' then
    perform public.nb_require_company_admin();
    v_no := public.nb_next_document_no('company_expense', null);
  elsif p_scope = 'store' then
    v_store := coalesce(p_store_id, public.auth_store_id());
    perform public.nb_require_store_admin(v_store);
    v_no := public.nb_next_document_no('store_expense', v_store);
  elsif p_scope = 'fro' then
    if not public.is_fro() then
      raise exception 'Only an FRO can record FRO expenses' using errcode = '42501';
    end if;
    v_store := public.auth_store_id();
    v_fro := public.auth_staff_id();
    v_settlement := public.nb_open_settlement_id(v_fro);
    v_no := public.nb_next_document_no('store_expense', v_store);
    v_status := 'pending';
    select coalesce(nullif(trim(name), ''), 'FRO') into v_fro_name from public.staff where id = v_fro;
    perform 1 from public.staff where id = v_fro for update;
    if p_method = 'cash' then
      v_available := public.nb_fro_cash_available(v_fro);
      if v_amount > v_available then
        raise exception 'Expense amount % exceeds available cash %', v_amount, v_available;
      end if;
    end if;
  else
    raise exception 'scope must be company, store or fro';
  end if;

  insert into public.expenses (
    scope, store_id, fro_staff_id, expense_no, expense_date, category_id, description, amount, method,
    entered_by_name, settlement_id, receipt_path, status
  ) values (
    p_scope, v_store, v_fro, v_no, coalesce(p_expense_date, public.nb_today()), p_category_id, p_description,
    v_amount, p_method, p_entered_by_name, v_settlement, p_receipt_path, v_status
  )
  returning id into v_id;

  if p_scope = 'fro' then
    insert into public.notifications (store_id, kind, title, message, staff_id, expense_id)
    values (
      v_store,
      'fro_expense_pending',
      'FRO expense awaiting acceptance',
      v_fro_name || ' submitted expense ' || v_no || ' of ₹' || to_char(v_amount, 'FM999,999,990.00') || ' awaiting acceptance.',
      v_fro,
      v_id
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object('id', v_id, 'expense_no', v_no, 'status', v_status);
end;
$$;

create or replace function public.decide_fro_expense(p_expense_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.expenses%rowtype;
  v_kind text;
  v_title text;
  v_message text;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select * into v_row from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense % not found', p_expense_id;
  end if;
  if v_row.scope is distinct from 'fro' then
    raise exception 'Only FRO expenses can be decided here';
  end if;
  perform public.nb_require_store_admin(v_row.store_id);
  if v_row.status <> 'pending' then
    raise exception 'Only pending FRO expenses can be decided';
  end if;

  update public.expenses
     set status = p_decision,
         updated_at = now()
   where id = p_expense_id;

  if p_decision = 'accepted' then
    v_kind := 'fro_expense_accepted';
    v_title := 'Expense accepted';
    v_message := 'Your expense ' || v_row.expense_no || ' of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was accepted.';
  else
    v_kind := 'fro_expense_rejected';
    v_title := 'Expense rejected';
    v_message := 'Your expense ' || v_row.expense_no || ' of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was rejected.';
  end if;

  insert into public.notifications (store_id, kind, title, message, staff_id, expense_id)
  values (v_row.store_id, v_kind, v_title, v_message, v_row.fro_staff_id, v_row.id)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cash refund: pending until Store accepts
-- ---------------------------------------------------------------------------
create or replace function public.create_fro_cash_refund(
  p_amount numeric,
  p_method public.payment_method default 'cash',
  p_remarks text default null,
  p_refunded_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_fro uuid := public.auth_staff_id();
  v_store uuid := public.auth_store_id();
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_available numeric;
  v_name text;
  v_no text;
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can record a cash refund to the store' using errcode = '42501';
  end if;
  if v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  perform 1 from public.staff where id = v_fro for update;
  select coalesce(nullif(trim(name), ''), 'FRO') into v_name from public.staff where id = v_fro;

  if p_method = 'cash' then
    v_available := public.nb_fro_cash_available(v_fro);
    if v_amount > v_available then
      raise exception 'Refund amount % exceeds available cash %', v_amount, v_available;
    end if;
  end if;

  v_no := 'REF-' || to_char(public.nb_today(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.fro_cash_refunds (
    store_id, fro_staff_id, settlement_id, refunded_at, amount, method, remarks, status, refund_no
  ) values (
    v_store, v_fro, public.nb_open_settlement_id(v_fro),
    coalesce(p_refunded_at, now()), v_amount, p_method, p_remarks, 'pending', v_no
  )
  returning id into v_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_refund_id)
  values (
    v_store,
    'fro_cash_refund_pending',
    'FRO cash refund awaiting acceptance',
    v_name || ' submitted cash refund ' || v_no || ' of ₹' || to_char(v_amount, 'FM999,999,990.00') || ' awaiting acceptance.',
    v_fro,
    v_id
  )
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function public.decide_fro_cash_refund(p_refund_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fro_cash_refunds%rowtype;
  v_kind text;
  v_title text;
  v_message text;
  v_available numeric;
  v_label text;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select * into v_row from public.fro_cash_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Cash refund % not found', p_refund_id;
  end if;
  perform public.nb_require_store_admin(v_row.store_id);
  if v_row.status <> 'pending' then
    raise exception 'Only pending cash refunds can be decided';
  end if;

  if p_decision = 'accepted' and v_row.method = 'cash' then
    perform 1 from public.staff where id = v_row.fro_staff_id for update;
    v_available := public.nb_fro_cash_in_hand(v_row.fro_staff_id);
    if v_row.amount > v_available then
      raise exception 'Accepting this refund would make cash in hand negative';
    end if;
  end if;

  update public.fro_cash_refunds
     set status = p_decision,
         decided_at = now(),
         decided_by = auth.uid(),
         updated_at = now()
   where id = p_refund_id;

  v_label := coalesce(nullif(trim(v_row.refund_no), ''), 'refund');
  if p_decision = 'accepted' then
    v_kind := 'fro_cash_refund_accepted';
    v_title := 'Cash refund accepted';
    v_message := 'Your cash refund ' || v_label || ' of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was accepted.';
  else
    v_kind := 'fro_cash_refund_rejected';
    v_title := 'Cash refund rejected';
    v_message := 'Your cash refund ' || v_label || ' of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was rejected.';
  end if;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_refund_id)
  values (v_row.store_id, v_kind, v_title, v_message, v_row.fro_staff_id, v_row.id)
  on conflict do nothing;
end;
$$;

revoke all on function public.decide_fro_expense(uuid, text) from public, anon;
revoke all on function public.decide_fro_cash_refund(uuid, text) from public, anon;
grant execute on function public.decide_fro_expense(uuid, text) to authenticated, service_role;
grant execute on function public.decide_fro_cash_refund(uuid, text) to authenticated, service_role;
grant execute on function public.create_expense(text, uuid, numeric, public.payment_method, date, text, text, uuid, text) to authenticated, service_role;
grant execute on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz) to authenticated, service_role;

-- Keep handover availability aligned with pending expense/refund reservations.
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
  v_available := public.nb_fro_cash_available(v_fro);
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
