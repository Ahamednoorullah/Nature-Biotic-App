-- FRO cash refunds: persist refund source account (FRO cash vs Store account).
-- Only accepted fro_cash refunds reduce fro_cash_position.cash_in_hand.
-- Store-account refunds stay pending until Store accepts but never hit FRO cash.

alter table public.fro_cash_refunds
  add column if not exists refund_from text;

update public.fro_cash_refunds
   set refund_from = 'fro_cash'
 where refund_from is null or trim(refund_from) = '';

alter table public.fro_cash_refunds
  alter column refund_from set default 'fro_cash';

alter table public.fro_cash_refunds
  alter column refund_from set not null;

alter table public.fro_cash_refunds drop constraint if exists fro_cash_refunds_refund_from_check;
alter table public.fro_cash_refunds
  add constraint fro_cash_refunds_refund_from_check
  check (refund_from in ('fro_cash', 'store_account'));

-- Cash position: accepted FRO-cash refunds only
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
            where c.fro_staff_id = st.id
              and c.method = 'cash'
              and c.status = 'accepted'
              and c.refund_from = 'fro_cash'), 0) as cash_refunds,
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
              where c.fro_staff_id = st.id
                and c.method = 'cash'
                and c.status = 'accepted'
                and c.refund_from = 'fro_cash'), 0) as cash_in_hand,
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

-- Pending reserves only apply to FRO-cash refunds
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
        where r.fro_staff_id = p_fro
          and r.status = 'pending'
          and r.method = 'cash'
          and r.refund_from = 'fro_cash'
      ), 0);
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
    v_available := public.nb_fro_cash_available(v_fro);
    if v_amount > v_available then
      raise exception 'Refund amount % exceeds available cash %', v_amount, v_available;
    end if;
  end if;

  v_no := public.nb_next_document_no('fro_cash_refund', null);
  v_from_label := case when v_from = 'store_account' then 'Store Account' else 'My Account (FRO Cash in Hand)' end;

  insert into public.fro_cash_refunds (
    store_id, fro_staff_id, settlement_id, refunded_at, amount, method, remarks, status, refund_no, refund_from
  ) values (
    v_store, v_fro, public.nb_open_settlement_id(v_fro),
    coalesce(p_refunded_at, now()), v_amount, p_method, p_remarks, 'pending', v_no, v_from
  )
  returning id into v_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_refund_id)
  values (
    v_store,
    'fro_cash_refund_pending',
    'FRO cash refund awaiting acceptance',
    v_name || ' submitted cash refund ' || v_no || ' of ₹' || to_char(v_amount, 'FM999,999,990.00')
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

-- Drop old 4-arg overload if present so clients bind the new signature.
drop function if exists public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz);

revoke all on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz, text) from public, anon;
grant execute on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz, text) to authenticated, service_role;
grant execute on function public.decide_fro_cash_refund(uuid, text) to authenticated, service_role;
grant execute on function public.nb_fro_cash_available(uuid) to authenticated, service_role;
