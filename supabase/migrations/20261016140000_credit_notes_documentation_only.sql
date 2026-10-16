-- Company credit notes and the store debit notes that mirror them are GST
-- documents. Issuing or accepting one must not settle a purchase return.
-- Refunds stay on the approved purchase return. Historical refunds keep the
-- credit note they were recorded against.

alter table public.company_refunds
  alter column company_credit_note_id drop not null;

alter table public.company_refunds
  add column if not exists purchase_return_id uuid references public.purchase_returns (id) on delete restrict;

alter table public.company_refunds
  drop constraint if exists company_refunds_source_check;

alter table public.company_refunds
  add constraint company_refunds_source_check
  check (company_credit_note_id is not null or purchase_return_id is not null);

create index if not exists company_refunds_return_idx
  on public.company_refunds (purchase_return_id);

create or replace function public.create_company_refund(
  p_credit_note_id uuid,
  p_amount numeric,
  p_method public.payment_method default null,
  p_reason text default null,
  p_remarks text default null,
  p_refund_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Company credit notes are GST documents and cannot be refunded. Record the refund against the approved purchase return';
end;
$$;

create or replace function public.preview_company_refund(p_credit_note_id uuid, p_amount numeric default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cn public.company_credit_notes%rowtype;
begin
  select * into v_cn from public.company_credit_notes where id = p_credit_note_id;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  if not public.can_read_company_doc(v_cn.store_id) then
    raise exception 'Not authorized for this credit note' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'credit_note_id', v_cn.id,
    'credit_note_no', v_cn.credit_note_no,
    'credit_note_status', v_cn.status,
    'credit_total', v_cn.total_amount,
    'refunded_total', 0,
    'remaining_refundable', 0,
    'outstanding_before', greatest(public.nb_store_outstanding(v_cn.store_id), 0),
    'refund_amount', 0,
    'applied_to_outstanding', 0,
    'cash_paid', 0,
    'outstanding_after', greatest(public.nb_store_outstanding(v_cn.store_id), 0),
    'method_required', false,
    'valid', false
  );
end;
$$;

create or replace function public.create_company_refund_for_return(
  p_return_id uuid,
  p_amount numeric,
  p_method public.payment_method default null,
  p_reason text default null,
  p_remarks text default null,
  p_refund_date date default null,
  p_credit_note_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.purchase_returns%rowtype;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_refunded numeric;
  v_remaining numeric;
  v_out numeric;
  v_applied numeric;
  v_no text;
  v_id uuid;
begin
  perform public.nb_require_company_admin();
  select * into v_ret from public.purchase_returns where id = p_return_id for update;
  if not found then
    raise exception 'Purchase return % not found', p_return_id;
  end if;
  if v_ret.status = 'pending' then
    raise exception 'A pending purchase return cannot be refunded';
  end if;
  if v_ret.status = 'rejected' then
    raise exception 'A rejected purchase return cannot be refunded';
  end if;
  if v_ret.status <> 'approved' then
    raise exception 'Only an approved purchase return can be refunded';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('return-refund|' || v_ret.id::text, 0));

  select coalesce(sum(f.refund_amount), 0) into v_refunded
  from public.company_refunds f
  where f.status = 'final'
    and (
      f.purchase_return_id = v_ret.id
      or exists (
        select 1
        from public.company_credit_note_items cni
        join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
        where cni.credit_note_id = f.company_credit_note_id
          and pri.return_id = v_ret.id
      )
    );

  v_remaining := round(v_ret.total_amount - v_refunded, 2);
  if v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;
  if v_amount > v_remaining then
    raise exception 'Refund amount % exceeds the remaining return value %', v_amount, v_remaining;
  end if;

  perform 1 from public.stores where id = v_ret.store_id for update;
  v_out := greatest(public.nb_store_outstanding(v_ret.store_id), 0);
  v_applied := least(v_amount, v_out);
  if v_amount > v_applied and p_method is null then
    raise exception 'A payment method is required for the cash payout of %', v_amount - v_applied;
  end if;

  v_no := public.nb_next_document_no('company_refund', null);
  insert into public.company_refunds (
    refund_no, refund_date, store_id, company_credit_note_id, purchase_return_id,
    refund_amount, outstanding_before, applied_to_outstanding, method, reason, remarks
  ) values (
    v_no,
    coalesce(p_refund_date, public.nb_today()),
    v_ret.store_id,
    null,
    v_ret.id,
    v_amount,
    v_out,
    v_applied,
    p_method,
    p_reason,
    p_remarks
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'refund_no', v_no,
    'refund_amount', v_amount,
    'applied_to_outstanding', v_applied,
    'cash_paid', v_amount - v_applied,
    'outstanding_after', v_out - v_applied
  );
end;
$$;

create or replace view public.company_return_refund_sources
with (security_invoker = true) as
select
  pr.id as purchase_return_id,
  pr.store_id,
  s.code as store_code,
  s.name as store_name,
  pr.return_no,
  pr.return_date,
  ci.invoice_no,
  pr.total_amount as return_amount,
  pr.reason,
  pr.status as return_status,
  note.id as credit_note_id,
  note.credit_note_no,
  note.status as credit_note_status,
  coalesce(paid.refunded_total, 0) as refunded_total,
  greatest(pr.total_amount - coalesce(paid.refunded_total, 0), 0) as remaining_refundable,
  coalesce(pos.outstanding, 0) as outstanding
from public.purchase_returns pr
join public.stores s on s.id = pr.store_id
join public.company_invoices ci on ci.id = pr.company_invoice_id
left join lateral (
  select cn.id, cn.credit_note_no, cn.status
  from public.company_credit_note_items cni
  join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
  join public.company_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
  where pri.return_id = pr.id
  order by cn.credit_note_date desc, cn.created_at desc
  limit 1
) note on true
left join lateral (
  select coalesce(sum(f.refund_amount), 0) as refunded_total
  from public.company_refunds f
  where f.status = 'final'
    and (
      f.purchase_return_id = pr.id
      or exists (
        select 1
        from public.company_credit_note_items cni
        join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
        where cni.credit_note_id = f.company_credit_note_id
          and pri.return_id = pr.id
      )
    )
) paid on true
left join public.company_store_positions pos on pos.store_id = pr.store_id
where pr.status = 'approved';

create or replace view public.company_credit_note_balances
with (security_invoker = true) as
select
  cn.id as company_credit_note_id,
  cn.store_id,
  cn.credit_note_no,
  cn.credit_note_date,
  cn.status,
  cn.total_amount as credit_total,
  coalesce(f.refunded_total, 0) as refunded_total,
  coalesce(f.applied_total, 0) as applied_total,
  coalesce(f.cash_paid_total, 0) as cash_paid_total,
  0::numeric as remaining_refundable,
  case
    when coalesce(f.refunded_total, 0) = 0 then 'not_refunded'
    when coalesce(f.refunded_total, 0) < cn.total_amount then 'partially_refunded'
    else 'fully_refunded'
  end as refund_state
from public.company_credit_notes cn
left join (
  select company_credit_note_id,
         sum(refund_amount) as refunded_total,
         sum(applied_to_outstanding) as applied_total,
         sum(cash_paid) as cash_paid_total
  from public.company_refunds
  where status = 'final'
  group by company_credit_note_id
) f on f.company_credit_note_id = cn.id;
