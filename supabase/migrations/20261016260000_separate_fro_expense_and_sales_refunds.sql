-- Separate FRO expense-advance refunds (fro_cash_refunds) from FRO→farmer
-- sales-return refunds (store_refunds). Historical rows stay intact.
--
-- fro_cash_refunds: unused expense advance returned to Store (refund_purpose).
-- store_refunds: farmer refund after sales return (refund_from + pending approval).

-- ---------------------------------------------------------------------------
-- 1) Expense-advance refunds: explicit purpose on fro_cash_refunds
-- ---------------------------------------------------------------------------
alter table public.fro_cash_refunds
  add column if not exists refund_purpose text;

update public.fro_cash_refunds
   set refund_purpose = 'expense_advance'
 where refund_purpose is null or trim(refund_purpose) = '';

alter table public.fro_cash_refunds
  alter column refund_purpose set default 'expense_advance';

alter table public.fro_cash_refunds
  alter column refund_purpose set not null;

alter table public.fro_cash_refunds drop constraint if exists fro_cash_refunds_refund_purpose_check;
alter table public.fro_cash_refunds
  add constraint fro_cash_refunds_refund_purpose_check
  check (refund_purpose in ('expense_advance'));

-- ---------------------------------------------------------------------------
-- 2) Farmer sales refunds: refund_from + pending/rejected statuses
-- ---------------------------------------------------------------------------
alter table public.store_refunds
  add column if not exists refund_from text;

alter table public.store_refunds
  add column if not exists decided_at timestamptz;

alter table public.store_refunds
  add column if not exists decided_by uuid;

-- Historical rows keep refund_from null so they do not retroactively hit FRO cash.
alter table public.store_refunds drop constraint if exists store_refunds_refund_from_check;
alter table public.store_refunds
  add constraint store_refunds_refund_from_check
  check (refund_from is null or refund_from in ('fro_cash', 'store_account'));

alter table public.store_refunds drop constraint if exists store_refunds_status_check;
alter table public.store_refunds
  add constraint store_refunds_status_check
  check (status in ('pending', 'final', 'rejected', 'cancelled'));

-- ---------------------------------------------------------------------------
-- 3) Notifications for FRO farmer (sales) refunds
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists store_refund_id uuid references public.store_refunds (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
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
    'fro_cash_refund_rejected',
    'fro_sales_refund_pending',
    'fro_sales_refund_accepted',
    'fro_sales_refund_rejected'
  ));

create unique index if not exists notifications_store_refund_event_uidx
  on public.notifications (store_refund_id, kind)
  where store_refund_id is not null;

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
        'fro_cash_refund_rejected',
        'fro_sales_refund_accepted',
        'fro_sales_refund_rejected'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Cash position: expense-advance refunds in cash_refunds;
--    accepted My-Account farmer refunds deduct cash_in_hand only (not Amount Refund).
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
  -- Expenses → Amount Refund (expense-advance returns only)
  coalesce((select sum(c.amount) from public.fro_cash_refunds c
            where c.fro_staff_id = st.id
              and c.method = 'cash'
              and c.status = 'accepted'
              and c.refund_from = 'fro_cash'
              and c.refund_purpose = 'expense_advance'), 0) as cash_refunds,
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
                and c.refund_from = 'fro_cash'
                and c.refund_purpose = 'expense_advance'), 0)
  -- Sales → Refund: My Account cash payout after Store acceptance only
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
              where d.fro_staff_id = st.id and d.status = 'accepted'), 0) as digital_in_account
from public.staff st
where public.nb_is_fro_designation(st.designation);

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
          and r.refund_purpose = 'expense_advance'
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

-- ---------------------------------------------------------------------------
-- 5) Remaining refundable counts pending + final (not rejected/cancelled)
-- ---------------------------------------------------------------------------
create or replace function public.nb_store_refund_source(p_source_type text, p_source_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sr public.sales_returns%rowtype;
  v_cn public.store_credit_notes%rowtype;
  v_used numeric;
  v_return_line_sum numeric;
begin
  if p_source_type = 'sales_return' then
    select * into v_sr from public.sales_returns where id = p_source_id;
    if not found then
      raise exception 'Sales return % not found', p_source_id;
    end if;
    select
      coalesce((select sum(refund_amount) from public.store_refunds
                where sales_return_id = v_sr.id and status in ('final', 'pending')), 0)
      + coalesce((select sum(cni.line_total) from public.store_credit_note_items cni
                  join public.store_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
                  join public.sales_return_items x on x.id = cni.sales_return_item_id
                  where x.return_id = v_sr.id), 0)
      into v_used;
    select coalesce(sum(line_total), 0) into v_return_line_sum
    from public.sales_return_items
    where return_id = v_sr.id;
    return jsonb_build_object(
      'store_id', v_sr.store_id,
      'farmer_id', v_sr.farmer_id,
      'sales_invoice_id', v_sr.sales_invoice_id,
      'reference_no', v_sr.return_no,
      'source_total', v_return_line_sum,
      'source_status', v_sr.status,
      'eligible', v_sr.status = 'approved',
      'remaining_refundable', case when v_sr.status = 'approved' then v_return_line_sum - v_used else 0 end,
      'channel', v_sr.channel,
      'fro_staff_id', v_sr.fro_staff_id,
      'party_name', v_sr.party_name,
      'farmer_phone', v_sr.farmer_phone,
      'farmer_village', v_sr.farmer_village
    );
  elsif p_source_type = 'store_credit_note' then
    select * into v_cn from public.store_credit_notes where id = p_source_id;
    if not found then
      raise exception 'Store credit note % not found', p_source_id;
    end if;
    select coalesce(sum(refund_amount), 0) into v_used
    from public.store_refunds
    where store_credit_note_id = v_cn.id and status in ('final', 'pending');
    return jsonb_build_object(
      'store_id', v_cn.store_id,
      'farmer_id', v_cn.farmer_id,
      'sales_invoice_id', v_cn.sales_invoice_id,
      'reference_no', coalesce(v_cn.credit_note_no, '-'),
      'source_total', v_cn.total_amount,
      'source_status', v_cn.status,
      'eligible', v_cn.status = 'issued',
      'remaining_refundable', case when v_cn.status = 'issued' then v_cn.total_amount - v_used else 0 end,
      'channel', v_cn.channel,
      'fro_staff_id', v_cn.fro_staff_id,
      'party_name', v_cn.party_name,
      'farmer_phone', v_cn.farmer_phone,
      'farmer_village', v_cn.farmer_village
    );
  end if;
  raise exception 'source_type must be sales_return or store_credit_note';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) create_store_refund: FRO → pending + refund_from; Store → final (legacy)
-- ---------------------------------------------------------------------------
drop function if exists public.create_store_refund(text, uuid, numeric, public.payment_method, text, text, date, text);

create or replace function public.create_store_refund(
  p_source_type text,
  p_source_id uuid,
  p_amount numeric,
  p_method public.payment_method default null,
  p_reason text default null,
  p_remarks text default null,
  p_refund_date date default null,
  p_place_of_supply text default null,
  p_refund_from text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src jsonb;
  v_store uuid;
  v_actor text;
  v_farmer uuid;
  v_invoice uuid;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_remaining numeric;
  v_out numeric;
  v_applied numeric;
  v_cash numeric;
  v_no text;
  v_id uuid;
  v_status text;
  v_from text;
  v_from_label text;
  v_name text;
  v_fro uuid;
  v_available numeric;
begin
  if p_source_type = 'sales_return' then
    perform 1 from public.sales_returns where id = p_source_id for update;
  elsif p_source_type = 'store_credit_note' then
    perform 1 from public.store_credit_notes where id = p_source_id for update;
  end if;

  v_src := public.nb_store_refund_source(p_source_type, p_source_id);
  v_store := (v_src ->> 'store_id')::uuid;
  v_actor := public.nb_store_actor(v_store, true);
  if v_actor = 'fro' and (v_src ->> 'fro_staff_id')::uuid is distinct from public.auth_staff_id() then
    raise exception 'Not authorized for this refund source' using errcode = '42501';
  end if;
  if not (v_src ->> 'eligible')::boolean then
    raise exception 'Refunds need an approved sales return or an issued store credit note';
  end if;

  v_remaining := (v_src ->> 'remaining_refundable')::numeric;
  if v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;
  if v_amount > v_remaining then
    raise exception 'Refund amount % exceeds the remaining refundable credit %', v_amount, v_remaining;
  end if;

  v_farmer := (v_src ->> 'farmer_id')::uuid;
  v_invoice := (v_src ->> 'sales_invoice_id')::uuid;
  if v_farmer is not null then
    perform 1 from public.farmers where id = v_farmer for update;
  elsif v_invoice is not null then
    perform 1 from public.sales_invoices where id = v_invoice for update;
  end if;

  v_out := greatest(public.nb_party_outstanding(v_store, v_farmer, v_invoice), 0);
  v_applied := least(v_amount, v_out);
  v_cash := greatest(v_amount - v_applied, 0);
  if v_cash > 0 and p_method is null then
    raise exception 'A payment method is required for the cash payout of %', v_cash;
  end if;

  if v_actor = 'fro' then
    v_from := lower(trim(coalesce(p_refund_from, '')));
    if v_from not in ('fro_cash', 'store_account') then
      raise exception 'Refund From must be fro_cash or store_account';
    end if;
    v_status := 'pending';
    v_fro := public.auth_staff_id();
    if v_from = 'fro_cash' and coalesce(p_method, 'cash') = 'cash' and v_cash > 0 then
      perform 1 from public.staff where id = v_fro for update;
      v_available := public.nb_fro_cash_available(v_fro);
      if v_cash > v_available then
        raise exception 'Refund cash payout % exceeds available FRO cash %', v_cash, v_available;
      end if;
    end if;
  else
    -- Store/company creates settle immediately (legacy). No FRO cash account tag.
    v_from := null;
    v_status := 'final';
  end if;

  v_no := public.nb_next_document_no('store_refund', v_store);
  insert into public.store_refunds (
    store_id, refund_no, refund_date, farmer_id, farmer_name, farmer_phone, farmer_village,
    sales_return_id, store_credit_note_id, reference_no, sales_invoice_id, return_amount,
    refund_amount, outstanding_before, applied_to_outstanding, method, reason, remarks,
    channel, fro_staff_id, place_of_supply, status, refund_from
  ) values (
    v_store, v_no, coalesce(p_refund_date, public.nb_today()), v_farmer, v_src ->> 'party_name',
    v_src ->> 'farmer_phone', v_src ->> 'farmer_village',
    case when p_source_type = 'sales_return' then p_source_id end,
    case when p_source_type = 'store_credit_note' then p_source_id end,
    v_src ->> 'reference_no', v_invoice, (v_src ->> 'source_total')::numeric,
    v_amount, v_out, v_applied, p_method, p_reason, p_remarks,
    (v_src ->> 'channel')::public.sales_channel,
    case when v_src ->> 'channel' = 'executive' then (v_src ->> 'fro_staff_id')::uuid end,
    p_place_of_supply,
    v_status,
    v_from
  )
  returning id into v_id;

  if v_status = 'pending' then
    select coalesce(nullif(trim(name), ''), 'FRO') into v_name
    from public.staff where id = public.auth_staff_id();
    v_from_label := case when v_from = 'store_account' then 'Store Account' else 'My Account (FRO Cash in Hand)' end;
    insert into public.notifications (store_id, kind, title, message, staff_id, store_refund_id)
    values (
      v_store,
      'fro_sales_refund_pending',
      'FRO farmer refund awaiting acceptance',
      v_name || ' submitted farmer refund ' || v_no || ' of ₹' || to_char(v_amount, 'FM999,999,990.00')
        || ' from ' || v_from_label || ' awaiting acceptance.',
      public.auth_staff_id(),
      v_id
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'id', v_id, 'refund_no', v_no, 'refund_amount', v_amount,
    'applied_to_outstanding', v_applied, 'cash_paid', v_cash,
    'outstanding_after', case when v_status = 'final' then v_out - v_applied else v_out end,
    'status', v_status,
    'refund_from', v_from
  );
end;
$$;

create or replace function public.decide_store_farmer_refund(p_refund_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.store_refunds%rowtype;
  v_kind text;
  v_title text;
  v_message text;
  v_available numeric;
  v_from text;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select * into v_row from public.store_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Store refund % not found', p_refund_id;
  end if;
  perform public.nb_require_store_admin(v_row.store_id);
  if v_row.status <> 'pending' then
    raise exception 'Only pending farmer refunds can be decided';
  end if;
  if v_row.fro_staff_id is null then
    raise exception 'Only FRO farmer refunds require this approval step';
  end if;

  v_from := coalesce(nullif(trim(v_row.refund_from), ''), 'fro_cash');

  if p_decision = 'accepted'
     and v_from = 'fro_cash'
     and v_row.method = 'cash'
     and coalesce(v_row.cash_paid, 0) > 0 then
    perform 1 from public.staff where id = v_row.fro_staff_id for update;
    v_available := public.nb_fro_cash_in_hand(v_row.fro_staff_id);
    if v_row.cash_paid > v_available then
      raise exception 'Accepting this refund would make FRO cash in hand negative';
    end if;
  end if;

  if p_decision = 'accepted' then
    update public.store_refunds
       set status = 'final',
           decided_at = now(),
           decided_by = auth.uid(),
           updated_at = now()
     where id = p_refund_id;
    v_kind := 'fro_sales_refund_accepted';
    v_title := 'Farmer refund accepted';
    v_message := 'Your farmer refund ' || v_row.refund_no || ' of ₹'
      || to_char(v_row.refund_amount, 'FM999,999,990.00') || ' was accepted.';
  else
    update public.store_refunds
       set status = 'rejected',
           decided_at = now(),
           decided_by = auth.uid(),
           updated_at = now()
     where id = p_refund_id;
    v_kind := 'fro_sales_refund_rejected';
    v_title := 'Farmer refund rejected';
    v_message := 'Your farmer refund ' || v_row.refund_no || ' of ₹'
      || to_char(v_row.refund_amount, 'FM999,999,990.00') || ' was rejected.';
  end if;

  insert into public.notifications (store_id, kind, title, message, staff_id, store_refund_id)
  values (v_row.store_id, v_kind, v_title, v_message, v_row.fro_staff_id, v_row.id)
  on conflict do nothing;
end;
$$;

-- Expense-advance create: stamp purpose explicitly
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

revoke all on function public.create_store_refund(text, uuid, numeric, public.payment_method, text, text, date, text, text) from public, anon;
grant execute on function public.create_store_refund(text, uuid, numeric, public.payment_method, text, text, date, text, text) to authenticated, service_role;
revoke all on function public.decide_store_farmer_refund(uuid, text) from public, anon;
grant execute on function public.decide_store_farmer_refund(uuid, text) to authenticated, service_role;
grant execute on function public.nb_fro_cash_available(uuid) to authenticated, service_role;
grant execute on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz, text) to authenticated, service_role;
