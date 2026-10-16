-- Separate farmer Cash in Hand from expense-advance balances.
-- cash_in_hand = farmer collections − handovers − approved farmer My-Account refunds.
-- expense_advance_balance = advances − accepted expenses − accepted expense-advance refunds.

-- ---------------------------------------------------------------------------
-- Position view (drop/recreate so new expense_advance_balance column can be added)
-- ---------------------------------------------------------------------------
drop view if exists public.fro_cash_position;

create view public.fro_cash_position
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
            where c.fro_staff_id = st.id
              and c.method = 'cash'
              and c.status = 'accepted'
              and c.refund_from = 'fro_cash'
              and c.refund_purpose = 'expense_advance'), 0) as cash_refunds,
  -- Farmer collection cash only (Dashboard → Cash in Hand)
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id
              and r.method = 'cash'
              and r.status = 'final'
              and r.collection_account = 'fro'), 0)
  - coalesce((select sum(h.amount) from public.cash_handovers h
              where h.fro_staff_id = st.id and h.status = 'accepted' and h.method = 'cash'), 0)
  - coalesce((select sum(sr.cash_paid) from public.store_refunds sr
              where sr.fro_staff_id = st.id
                and sr.status = 'final'
                and sr.method = 'cash'
                and sr.refund_from = 'fro_cash'
                and coalesce(sr.cash_paid, 0) > 0), 0) as cash_in_hand,
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
              where d.fro_staff_id = st.id and d.status = 'accepted'), 0) as digital_in_account,
  -- Expense-advance pool (Expenses page)
  coalesce((select sum(a.amount) from public.fro_cash_advances a
            where a.fro_staff_id = st.id and a.status = 'accepted' and a.method = 'cash'), 0)
  - coalesce((select sum(e.amount) from public.expenses e
              where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0)
  - coalesce((select sum(c.amount) from public.fro_cash_refunds c
              where c.fro_staff_id = st.id
                and c.method = 'cash'
                and c.status = 'accepted'
                and c.refund_from = 'fro_cash'
                and c.refund_purpose = 'expense_advance'), 0) as expense_advance_balance
from public.staff st
where public.nb_is_fro_designation(st.designation);

grant select on public.fro_cash_position to authenticated, service_role;

create or replace function public.nb_fro_cash_in_hand(p_fro uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select cash_in_hand from public.fro_cash_position where fro_staff_id = p_fro), 0);
$$;

create or replace function public.nb_fro_expense_advance_balance(p_fro uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select expense_advance_balance from public.fro_cash_position where fro_staff_id = p_fro),
    0
  );
$$;

-- Farmer collection available for Payment handovers + farmer My-Account refunds
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
        select sum(sr.cash_paid) from public.store_refunds sr
        where sr.fro_staff_id = p_fro
          and sr.status = 'pending'
          and sr.method = 'cash'
          and sr.refund_from = 'fro_cash'
          and coalesce(sr.cash_paid, 0) > 0
      ), 0);
$$;

-- Expense-advance available for FRO expenses + expense-advance refunds
create or replace function public.nb_fro_expense_advance_available(p_fro uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.nb_fro_expense_advance_balance(p_fro)
    - coalesce((
        select sum(e.amount) from public.expenses e
        where e.fro_staff_id = p_fro and e.scope = 'fro' and e.status = 'pending' and e.method = 'cash'
      ), 0)
    - coalesce((
        select sum(r.amount) from public.fro_cash_refunds r
        where r.fro_staff_id = p_fro
          and r.status = 'pending'
          and r.method = 'cash'
          and r.refund_from = 'fro_cash'
          and r.refund_purpose = 'expense_advance'
      ), 0);
$$;

-- Point expense creation at the expense-advance pool (preserve existing numbering).
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
      v_available := public.nb_fro_expense_advance_available(v_fro);
      if v_amount > v_available then
        raise exception 'Expense amount % exceeds available expense advance %', v_amount, v_available;
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
  v_available numeric;
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

  if p_decision = 'accepted' and v_row.method = 'cash' then
    perform 1 from public.staff where id = v_row.fro_staff_id for update;
    v_available := public.nb_fro_expense_advance_balance(v_row.fro_staff_id);
    if v_row.amount > v_available then
      raise exception 'Accepting this expense would make the expense advance balance negative';
    end if;
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

create or replace function public.create_fro_cash_refund(
  p_amount numeric,
  p_method public.payment_method default 'cash',
  p_remarks text default null,
  p_refunded_at timestamptz default null,
  p_refund_from text default 'fro_cash'
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
  v_from text := lower(trim(coalesce(p_refund_from, 'fro_cash')));
  v_from_label text;
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can record a cash refund to the store' using errcode = '42501';
  end if;
  if v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;
  if v_from not in ('fro_cash', 'store_account') then
    raise exception 'Refund From must be fro_cash or store_account';
  end if;

  perform 1 from public.staff where id = v_fro for update;
  select coalesce(nullif(trim(name), ''), 'FRO') into v_name from public.staff where id = v_fro;

  if v_from = 'fro_cash' and p_method = 'cash' then
    v_available := public.nb_fro_expense_advance_available(v_fro);
    if v_amount > v_available then
      raise exception 'Refund amount % exceeds available expense advance %', v_amount, v_available;
    end if;
  end if;

  v_no := public.nb_next_document_no('fro_cash_refund', null);
  v_from_label := case when v_from = 'store_account' then 'Store Account' else 'My Account (expense advance)' end;

  insert into public.fro_cash_refunds (
    store_id, fro_staff_id, settlement_id, refunded_at, amount, method, remarks,
    status, refund_no, refund_from, refund_purpose
  ) values (
    v_store, v_fro, public.nb_open_settlement_id(v_fro),
    coalesce(p_refunded_at, now()), v_amount, p_method, p_remarks,
    'pending', v_no, v_from, 'expense_advance'
  )
  returning id into v_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_refund_id)
  values (
    v_store,
    'fro_cash_refund_pending',
    'FRO expense advance refund awaiting acceptance',
    v_name || ' submitted expense advance refund ' || v_no || ' of ₹' || to_char(v_amount, 'FM999,999,990.00')
      || ' from ' || v_from_label || ' awaiting acceptance.',
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
  v_from text;
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

  v_from := coalesce(nullif(trim(v_row.refund_from), ''), 'fro_cash');

  if p_decision = 'accepted'
     and v_from = 'fro_cash'
     and v_row.method = 'cash' then
    perform 1 from public.staff where id = v_row.fro_staff_id for update;
    v_available := public.nb_fro_expense_advance_balance(v_row.fro_staff_id);
    if v_row.amount > v_available then
      raise exception 'Accepting this refund would make the expense advance balance negative';
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
    v_title := 'Expense advance refund accepted';
    v_message := 'Your expense advance refund ' || v_label || ' of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was accepted.';
  else
    v_kind := 'fro_cash_refund_rejected';
    v_title := 'Expense advance refund rejected';
    v_message := 'Your expense advance refund ' || v_label || ' of ₹' || to_char(v_row.amount, 'FM999,999,990.00') || ' was rejected.';
  end if;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_refund_id)
  values (v_row.store_id, v_kind, v_title, v_message, v_row.fro_staff_id, v_row.id)
  on conflict do nothing;
end;
$$;

-- Farmer sales refunds continue to use farmer Cash in Hand (nb_fro_cash_available / nb_fro_cash_in_hand)
-- via create_store_refund / decide_store_farmer_refund from the prior migration.

revoke all on function public.nb_fro_expense_advance_balance(uuid) from public, anon;
revoke all on function public.nb_fro_expense_advance_available(uuid) from public, anon;
grant execute on function public.nb_fro_expense_advance_balance(uuid) to authenticated, service_role;
grant execute on function public.nb_fro_expense_advance_available(uuid) to authenticated, service_role;
grant execute on function public.nb_fro_cash_available(uuid) to authenticated, service_role;
grant execute on function public.nb_fro_cash_in_hand(uuid) to authenticated, service_role;
grant execute on function public.create_expense(text, uuid, numeric, public.payment_method, date, text, text, uuid, text) to authenticated, service_role;
grant execute on function public.decide_fro_expense(uuid, text) to authenticated, service_role;
grant execute on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz, text) to authenticated, service_role;
grant execute on function public.decide_fro_cash_refund(uuid, text) to authenticated, service_role;
