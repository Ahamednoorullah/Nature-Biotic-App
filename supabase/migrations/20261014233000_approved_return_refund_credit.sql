-- Link an approved purchase return to one company credit note, then refund that note.
-- A second credit is not created when a non-cancelled credit already covers the return.
-- Outstanding is reduced only by create_company_refund, which applies outstanding first.

create or replace function public.nb_ensure_return_credit(p_return_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.purchase_returns%rowtype;
  v_count integer;
  v_status text;
  v_id uuid;
  v_no text;
begin
  perform pg_advisory_xact_lock(hashtextextended('return-credit|' || p_return_id::text, 0));
  select * into v_ret from public.purchase_returns where id = p_return_id for update;
  if not found then
    raise exception 'Purchase return % not found', p_return_id;
  end if;
  if v_ret.status <> 'approved' then
    raise exception 'Only an approved purchase return can be credited';
  end if;

  select count(distinct cn.id), min(cn.status), min(cn.id::text)::uuid
    into v_count, v_status, v_id
  from public.company_credit_note_items cni
  join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
  join public.company_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
  where pri.return_id = p_return_id;

  if v_count > 1 then
    raise exception 'This return already has more than one credit note';
  end if;
  if v_count = 1 then
    if v_status <> 'accepted' then
      raise exception 'The debit note for this return must be accepted before it can be refunded';
    end if;
    return v_id;
  end if;

  if not exists (select 1 from public.purchase_return_items where return_id = p_return_id) then
    raise exception 'This purchase return has no lines to credit';
  end if;

  insert into public.company_credit_notes (store_id, credit_note_date, reason, notes)
  values (
    v_ret.store_id,
    v_ret.return_date,
    coalesce(nullif(trim(v_ret.reason), ''), 'Purchase return'),
    'Credit for purchase return ' || v_ret.return_no
  )
  returning id into v_id;

  insert into public.company_credit_note_items (
    credit_note_id, line_no, line_type, purchase_return_item_id, variant_id, batch_id,
    product_name, pack_size, hsn_code, batch_no, expiry_date, quantity, unit_price,
    discount_percent, discount_amount, taxable_amount, tax_percent, sgst_amount,
    cgst_amount, igst_amount, tax_amount, line_total, reason
  )
  select
    v_id, pri.line_no, 'return', pri.id, pri.variant_id, pri.batch_id,
    pri.product_name, pri.pack_size, pri.hsn_code, pri.batch_no, pri.expiry_date,
    pri.quantity, pri.unit_price, pri.discount_percent, pri.discount_amount,
    pri.taxable_amount, pri.tax_percent, pri.sgst_amount, pri.cgst_amount,
    pri.igst_amount, pri.tax_amount, pri.line_total, pri.reason
  from public.purchase_return_items pri
  where pri.return_id = p_return_id
  order by pri.line_no;

  perform public.nb_apply_totals(
    'company_credit_notes', 'company_credit_note_items', 'credit_note_id', v_id, 0
  );
  v_no := public.nb_next_document_no('company_credit_note', null);
  update public.company_credit_notes
     set credit_note_no = v_no,
         status = 'accepted',
         issued_at = now(),
         issued_by = auth.uid(),
         accepted_at = now(),
         accepted_by = auth.uid()
   where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.nb_ensure_return_credit(uuid) from public, anon, authenticated;

create or replace function public.decide_purchase_return(p_return_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.purchase_returns%rowtype;
  v_item record;
begin
  perform public.nb_require_company_admin();
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  select * into v_ret from public.purchase_returns where id = p_return_id for update;
  if not found then
    raise exception 'Purchase return % not found', p_return_id;
  end if;
  if v_ret.status <> 'pending' then
    raise exception 'Only pending returns can be decided';
  end if;

  if p_decision = 'approved' then
    for v_item in select * from public.purchase_return_items where return_id = p_return_id order by line_no loop
      perform public.nb_post_stock(
        'store', v_ret.store_id, null, v_item.variant_id, v_item.batch_id, -v_item.quantity,
        'purchase_return_out', 'purchase_return_items', p_return_id, v_item.id,
        public.nb_today(), v_item.unit_price, false, p_return_id
      );
    end loop;
  end if;

  update public.purchase_returns
     set status = p_decision,
         decided_at = now(),
         decided_by = auth.uid(),
         decision_note = coalesce(p_note, decision_note)
   where id = p_return_id;

  if p_decision = 'approved' then
    perform public.nb_ensure_return_credit(p_return_id);
  end if;
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
  v_credit uuid;
  v_status text;
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

  if p_credit_note_id is not null then
    select cn.status into v_status
    from public.company_credit_notes cn
    where cn.id = p_credit_note_id
      and cn.store_id = v_ret.store_id
      and exists (
        select 1
        from public.company_credit_note_items cni
        join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
        where cni.credit_note_id = cn.id and pri.return_id = v_ret.id
      )
    for update;
    if not found then
      raise exception 'That credit note is not linked to this purchase return';
    end if;
    if v_status <> 'accepted' then
      raise exception 'Refunds can only be created after the store accepts the debit note';
    end if;
    v_credit := p_credit_note_id;
  else
    v_credit := public.nb_ensure_return_credit(p_return_id);
  end if;

  return public.create_company_refund(
    v_credit, p_amount, p_method, p_reason, p_remarks, p_refund_date
  );
end;
$$;

revoke all on function public.create_company_refund_for_return(uuid, numeric, public.payment_method, text, text, date, uuid) from public, anon;
grant execute on function public.create_company_refund_for_return(uuid, numeric, public.payment_method, text, text, date, uuid) to authenticated;

create or replace view public.company_return_refund_sources
with (security_invoker = true) as
with linked as (
  select distinct pri.return_id, cni.credit_note_id
  from public.purchase_return_items pri
  join public.company_credit_note_items cni on cni.purchase_return_item_id = pri.id
  join public.company_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
)
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
  cn.id as credit_note_id,
  cn.credit_note_no,
  cn.status as credit_note_status,
  coalesce(b.refunded_total, 0) as refunded_total,
  case
    when cn.id is null then pr.total_amount
    when cn.status = 'accepted' then coalesce(b.remaining_refundable, 0)
    else 0
  end as remaining_refundable,
  coalesce(pos.outstanding, 0) as outstanding
from public.purchase_returns pr
join public.stores s on s.id = pr.store_id
join public.company_invoices ci on ci.id = pr.company_invoice_id
left join linked l on l.return_id = pr.id
left join public.company_credit_notes cn on cn.id = l.credit_note_id
left join public.company_credit_note_balances b on b.company_credit_note_id = cn.id
left join public.company_store_positions pos on pos.store_id = pr.store_id
where pr.status = 'approved';

grant select on public.company_return_refund_sources to authenticated;
