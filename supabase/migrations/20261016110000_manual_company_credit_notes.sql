-- Credit notes are manual GST documents. Approving a purchase return no longer
-- creates one. Issuing a credit note notifies that store once.

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
  v_count integer;
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

  if p_credit_note_id is null then
    select count(distinct cn.id), min(cn.id::text)::uuid, min(cn.status)
      into v_count, v_credit, v_status
    from public.company_credit_note_items cni
    join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
    join public.company_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
    where pri.return_id = v_ret.id;
    if v_count = 0 then
      raise exception 'Create a credit note for this return before refunding it';
    end if;
    if v_count > 1 then
      raise exception 'Choose the credit note for this refund';
    end if;
    p_credit_note_id := v_credit;
  end if;

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

  return public.create_company_refund(
    p_credit_note_id, p_amount, p_method, p_reason, p_remarks, p_refund_date
  );
end;
$$;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'staff_assignment',
    'cash_handover_pending',
    'cash_handover_accepted',
    'company_debit_note'
  ));

alter table public.notifications
  add column if not exists credit_note_id uuid references public.company_credit_notes (id) on delete cascade;

create unique index if not exists notifications_credit_note_event_uidx
  on public.notifications (credit_note_id, kind)
  where credit_note_id is not null;

create or replace function public.issue_company_credit_note(p_credit_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cn public.company_credit_notes%rowtype;
  v_no text;
begin
  perform public.nb_require_company_admin();
  select * into v_cn from public.company_credit_notes where id = p_credit_note_id for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  if v_cn.status <> 'draft' then
    raise exception 'Only draft credit notes can be issued';
  end if;
  if not exists (select 1 from public.company_credit_note_items where credit_note_id = p_credit_note_id) then
    raise exception 'A credit note needs at least one line';
  end if;
  if v_cn.total_amount <= 0 then
    raise exception 'Credit note total must be greater than zero';
  end if;
  if exists (
    select 1 from public.company_credit_note_items cni
    join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
    join public.purchase_returns pr on pr.id = pri.return_id
    where cni.credit_note_id = p_credit_note_id and (pr.status <> 'approved' or pr.store_id <> v_cn.store_id)
  ) then
    raise exception 'All linked returns must be approved returns of the same store';
  end if;

  v_no := public.nb_next_document_no('company_credit_note', null);
  update public.company_credit_notes
     set status = 'issued', credit_note_no = v_no, issued_at = now(), issued_by = auth.uid()
   where id = p_credit_note_id;

  insert into public.notifications (store_id, kind, title, message, credit_note_id)
  values (
    v_cn.store_id,
    'company_debit_note',
    'Company debit note available',
    'Debit note ' || v_no || ' for ₹' || to_char(v_cn.total_amount, 'FM999,999,990.00') || ' is available.',
    v_cn.id
  )
  on conflict do nothing;

  return jsonb_build_object('id', p_credit_note_id, 'credit_note_no', v_no, 'status', 'issued', 'total_amount', v_cn.total_amount);
end;
$$;

create or replace function public.create_issued_company_credit_note(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved jsonb;
begin
  v_saved := public.save_company_credit_note(null, p_header, p_lines);
  return public.issue_company_credit_note((v_saved ->> 'id')::uuid);
end;
$$;

grant execute on function public.create_issued_company_credit_note(jsonb, jsonb) to authenticated;
