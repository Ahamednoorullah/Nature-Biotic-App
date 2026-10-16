-- Payment destination on store receipts, cash-handover limits, and FRO digital settlements.
-- Existing cash receipts already attributed to an FRO stay on that FRO account.
-- Every other existing receipt stays on the store account. No amounts are rewritten.

alter table public.store_receipts
  add column if not exists collection_account text;

update public.store_receipts
   set collection_account = 'fro'
 where fro_staff_id is not null
   and method = 'cash'
   and collection_account is null;

update public.store_receipts
   set collection_account = 'store'
 where collection_account is null;

alter table public.store_receipts
  alter column collection_account set default 'store';

alter table public.store_receipts
  alter column collection_account set not null;

alter table public.store_receipts
  drop constraint if exists store_receipts_collection_account_check;

alter table public.store_receipts
  add constraint store_receipts_collection_account_check
  check (collection_account in ('store', 'fro'));

create table if not exists public.fro_digital_settlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid not null,
  settlement_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null,
  remarks text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check (method in ('upi'::public.payment_method, 'bank_transfer'::public.payment_method))
);

create index if not exists fro_digital_settlements_store_status_idx
  on public.fro_digital_settlements (store_id, status);
create index if not exists fro_digital_settlements_fro_idx
  on public.fro_digital_settlements (fro_staff_id);

drop trigger if exists trg_audit on public.fro_digital_settlements;
create trigger trg_audit
  before insert or update on public.fro_digital_settlements
  for each row execute function public.nb_audit_fields();

alter table public.fro_digital_settlements enable row level security;

drop policy if exists fro_digital_settlements_select on public.fro_digital_settlements;
create policy fro_digital_settlements_select on public.fro_digital_settlements
  for select to authenticated
  using (public.can_read_store_doc(store_id, fro_staff_id));

revoke all on public.fro_digital_settlements from anon;
grant select on public.fro_digital_settlements to authenticated;

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
            where a.fro_staff_id = st.id and a.status = 'accepted'), 0) as advances_accepted,
  coalesce((select sum(h.amount) from public.cash_handovers h
            where h.fro_staff_id = st.id and h.status = 'accepted'), 0) as handovers_accepted,
  coalesce((select sum(e.amount) from public.expenses e
            where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0) as cash_expenses,
  coalesce((select sum(c.amount) from public.fro_cash_refunds c
            where c.fro_staff_id = st.id), 0) as cash_refunds,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id
              and r.method = 'cash'
              and r.status = 'final'
              and r.collection_account = 'fro'), 0)
  + coalesce((select sum(a.amount) from public.fro_cash_advances a
              where a.fro_staff_id = st.id and a.status = 'accepted'), 0)
  - coalesce((select sum(h.amount) from public.cash_handovers h
              where h.fro_staff_id = st.id and h.status = 'accepted'), 0)
  - coalesce((select sum(e.amount) from public.expenses e
              where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0)
  - coalesce((select sum(c.amount) from public.fro_cash_refunds c
              where c.fro_staff_id = st.id), 0) as cash_in_hand,
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

create or replace function public.nb_fro_cash_in_hand(p_fro uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select cash_in_hand from public.fro_cash_position where fro_staff_id = p_fro), 0);
$$;

create or replace function public.nb_fro_digital_in_account(p_fro uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select digital_in_account from public.fro_cash_position where fro_staff_id = p_fro), 0);
$$;

revoke all on function public.nb_fro_cash_in_hand(uuid) from public, anon, authenticated;
revoke all on function public.nb_fro_digital_in_account(uuid) from public, anon, authenticated;

create or replace function public.create_store_receipt(p_header jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.sales_invoices%rowtype;
  v_actor text;
  v_amount numeric := round(coalesce((p_header ->> 'amount')::numeric, 0), 2);
  v_out numeric;
  v_no text;
  v_id uuid;
  v_account text := lower(trim(coalesce(p_header ->> 'collection_account', '')));
begin
  select * into v_inv from public.sales_invoices where id = (p_header ->> 'sales_invoice_id')::uuid;
  if not found or v_inv.status <> 'final' then
    raise exception 'Receipts can only be recorded against a final sales invoice';
  end if;
  v_actor := public.nb_store_actor(v_inv.store_id, true);
  if v_actor = 'fro' and v_inv.fro_staff_id is distinct from public.auth_staff_id() then
    raise exception 'Not authorized to collect on this invoice' using errcode = '42501';
  end if;
  if v_actor = 'fro' then
    if v_account not in ('store', 'fro') then
      raise exception 'Choose Store Account or My Account';
    end if;
  else
    if v_account = 'fro' then
      raise exception 'Only an FRO can collect into a personal account';
    end if;
    v_account := 'store';
  end if;

  if v_inv.farmer_id is not null then
    perform 1 from public.farmers where id = v_inv.farmer_id for update;
  else
    perform 1 from public.sales_invoices where id = v_inv.id for update;
  end if;
  v_out := public.nb_sales_invoice_outstanding(v_inv.id);
  if v_amount <= 0 then
    raise exception 'Receipt amount must be greater than zero';
  end if;
  if v_amount > v_out then
    raise exception 'Receipt amount % is more than the invoice outstanding %', v_amount, v_out;
  end if;

  v_no := public.nb_next_document_no('store_receipt', v_inv.store_id);
  insert into public.store_receipts (
    store_id, receipt_no, receipt_date, farmer_id, farmer_name, sales_invoice_id, method, amount,
    invoice_amount, balance_after, received_by, received_by_name, fro_staff_id, remarks, collection_account
  ) values (
    v_inv.store_id, v_no, coalesce((p_header ->> 'receipt_date')::date, public.nb_today()),
    v_inv.farmer_id, v_inv.party_name, v_inv.id, (p_header ->> 'method')::public.payment_method, v_amount,
    v_inv.total_amount, v_out - v_amount, auth.uid(), p_header ->> 'received_by_name',
    case when v_actor = 'fro' then public.auth_staff_id() end,
    p_header ->> 'remarks',
    v_account
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'receipt_no', v_no,
    'balance_after', v_out - v_amount,
    'collection_account', v_account
  );
end;
$$;

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
end;
$$;

create or replace function public.create_digital_settlement(
  p_amount numeric,
  p_method public.payment_method,
  p_settlement_date date default null,
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
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can settle a digital collection' using errcode = '42501';
  end if;
  if p_method not in ('upi', 'bank_transfer') then
    raise exception 'Digital settlement must be UPI or bank transfer';
  end if;
  if v_amount <= 0 then
    raise exception 'Settlement amount must be greater than zero';
  end if;

  perform 1 from public.staff where id = v_fro for update;
  v_available := public.nb_fro_digital_in_account(v_fro)
    - coalesce((
        select sum(d.amount) from public.fro_digital_settlements d
        where d.fro_staff_id = v_fro and d.status = 'pending'
      ), 0);
  if v_amount > v_available then
    raise exception 'Settlement amount % exceeds digital collection %', v_amount, v_available;
  end if;

  insert into public.fro_digital_settlements (
    store_id, fro_staff_id, settlement_date, amount, method, remarks
  ) values (
    public.auth_store_id(), v_fro, coalesce(p_settlement_date, public.nb_today()),
    v_amount, p_method, p_remarks
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.decide_digital_settlement(p_settlement_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fro_digital_settlements%rowtype;
  v_available numeric;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select * into v_row from public.fro_digital_settlements where id = p_settlement_id for update;
  if not found then
    raise exception 'Digital settlement % not found', p_settlement_id;
  end if;
  perform public.nb_require_store_admin(v_row.store_id);
  if v_row.status <> 'pending' then
    raise exception 'Only pending digital settlements can be decided';
  end if;
  if p_decision = 'accepted' then
    perform 1 from public.staff where id = v_row.fro_staff_id for update;
    v_available := public.nb_fro_digital_in_account(v_row.fro_staff_id);
    if v_row.amount > v_available then
      raise exception 'Accepting this settlement would make the digital balance negative';
    end if;
  end if;
  update public.fro_digital_settlements
     set status = p_decision, decided_at = now(), decided_by = auth.uid()
   where id = p_settlement_id;
end;
$$;

revoke all on function public.create_digital_settlement(numeric, public.payment_method, date, text) from public, anon;
grant execute on function public.create_digital_settlement(numeric, public.payment_method, date, text) to authenticated;
revoke all on function public.decide_digital_settlement(uuid, text) from public, anon;
grant execute on function public.decide_digital_settlement(uuid, text) to authenticated;
