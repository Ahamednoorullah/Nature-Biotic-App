/*
# Nature Biotic ERP/CRM — 05 Business RPCs (server functions)

Every document write, status change, stock movement and money movement goes
through these SECURITY DEFINER functions. Each function checks the caller's role
and store, validates the current status, and does all writes in one transaction.

Line payloads (p_lines) are JSON arrays. Recognised keys per line:
  variant_id, batch_id, batch_no, expiry_date, manufacture_date, quantity,
  unit_price, discount_percent, discount_amount, taxable_amount, tax_percent,
  sgst_amount, cgst_amount, igst_amount, tax_amount, line_total, reason,
  line_type, source_item_id, product_name, unit_value
Missing amounts are calculated from quantity, price, discount and the product's tax.

Key rules implemented here:
- Company stock is not maintained; company invoices add store stock only when the
  store marks the whole invoice received.
- Purchase returns reserve stock while pending; company approval reduces store stock.
- Sales returns: pending -> approved (stock posted) or rejected (no stock).
- Company credit notes: draft -> issued -> accepted (store, accept only). No stock.
- Store credit notes: draft -> issued (-> cancelled). No stock.
- Refunds: manual, partial allowed, applied to outstanding first, rest paid out,
  outstanding never below zero; cancellation restores credit and outstanding.
- Quotation -> sales invoice conversion happens at most once.
- Store outstanding limit: 'warn' saves and returns a warning; 'block' refuses.
*/

-- ===========================================================================
-- Accounts (auth users are created by Supabase Auth / an Edge Function;
-- these functions link an existing auth user to a profile)
-- ===========================================================================
create or replace function public.link_store_user(p_user_id uuid, p_store_id uuid, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  perform public.nb_require_company_admin();
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'Auth user % not found', p_user_id;
  end if;
  insert into public.profiles (id, email, full_name, role, subject_type, store_id)
  values (p_user_id, v_email, coalesce(nullif(trim(p_full_name), ''), v_email), 'store_admin', 'store', p_store_id);
  return p_user_id;
end;
$$;

create or replace function public.link_fro_user(p_user_id uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_staff public.staff%rowtype;
begin
  select * into v_staff from public.staff where id = p_staff_id;
  if not found then
    raise exception 'Staff member % not found', p_staff_id;
  end if;
  if not (public.is_company_admin() or (public.is_store_admin() and public.auth_store_id() = v_staff.store_id)) then
    raise exception 'Not authorized to create a login for this staff member' using errcode = '42501';
  end if;
  if not public.nb_is_fro_designation(v_staff.designation) then
    raise exception 'Only FRO-designation staff can have a login';
  end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'Auth user % not found', p_user_id;
  end if;
  insert into public.profiles (id, email, full_name, role, subject_type, store_id, staff_id)
  values (p_user_id, v_email, v_staff.name, 'fro', 'staff', v_staff.store_id, v_staff.id);
  return p_user_id;
end;
$$;

create or replace function public.set_profile_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_status not in ('active', 'disabled') then
    raise exception 'Status must be active or disabled';
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Profile % not found', p_user_id;
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status';
  end if;
  if not (
    public.is_company_admin()
    or (public.is_store_admin() and v_profile.role = 'fro' and v_profile.store_id = public.auth_store_id())
  ) then
    raise exception 'Not authorized to change this account status' using errcode = '42501';
  end if;
  update public.profiles set status = p_status where id = p_user_id;
end;
$$;

-- ===========================================================================
-- Numbering / limits (read helpers for the UI)
-- ===========================================================================
create or replace function public.peek_document_no(p_doc_type text, p_store_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_doc_type in ('company_invoice', 'company_credit_note', 'company_receipt', 'company_refund', 'company_expense') then
    perform public.nb_require_company_admin();
    return public.nb_peek_document_no(p_doc_type, null);
  end if;
  perform public.nb_store_actor(coalesce(p_store_id, public.auth_store_id()), true);
  return public.nb_peek_document_no(p_doc_type, coalesce(p_store_id, public.auth_store_id()));
end;
$$;

create or replace function public.check_store_outstanding_limit(p_store_id uuid, p_amount numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_read_company_doc(p_store_id) then
    raise exception 'Not authorized for this store' using errcode = '42501';
  end if;
  return public.nb_outstanding_limit_check(p_store_id, p_amount);
end;
$$;

-- ===========================================================================
-- Purchase orders
-- ===========================================================================
create or replace function public.submit_purchase_order(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := coalesce((p_header ->> 'store_id')::uuid, public.auth_store_id());
  v_id uuid;
  v_no text;
  r public.nb_line_input;
  v_info public.nb_variant_snapshot;
  v_line smallint := 0;
  v_total numeric;
  v_warning jsonb;
begin
  perform public.nb_require_store_admin(v_store);
  v_no := public.nb_next_document_no('purchase_order', v_store);

  insert into public.purchase_orders (store_id, po_no, po_date, notes)
  values (v_store, v_no, coalesce((p_header ->> 'po_date')::date, public.nb_today()), p_header ->> 'notes')
  returning id into v_id;

  for r in select * from public.nb_parse_lines(p_lines) loop
    r := public.nb_normalize_line(r, true);
    v_info := public.nb_variant_info(r.variant_id);
    v_line := v_line + 1;
    insert into public.purchase_order_items (
      po_id, line_no, variant_id, product_name, pack_size, hsn_code, unit, quantity, unit_price,
      discount_percent, discount_amount, taxable_amount, tax_percent, sgst_amount, cgst_amount,
      igst_amount, tax_amount, line_total
    ) values (
      v_id, v_line, r.variant_id, v_info.product_name, v_info.pack_size, v_info.hsn_code, v_info.unit,
      r.quantity, r.unit_price, r.discount_percent, r.discount_amount, r.taxable_amount, r.tax_percent,
      r.sgst_amount, r.cgst_amount, r.igst_amount, r.tax_amount, r.line_total
    );
  end loop;

  v_total := public.nb_apply_totals('purchase_orders', 'purchase_order_items', 'po_id', v_id, (p_header ->> 'round_off')::numeric);
  update public.purchase_orders
     set total_quantity = (select coalesce(sum(quantity), 0) from public.purchase_order_items where po_id = v_id)
   where id = v_id;

  v_warning := public.nb_enforce_outstanding_limit(v_store, v_total);

  return jsonb_build_object('id', v_id, 'po_no', v_no, 'total_amount', v_total, 'limit_warning', v_warning);
end;
$$;

create or replace function public.decide_purchase_order(p_po_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.nb_require_company_admin();
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select status into v_status from public.purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order % not found', p_po_id;
  end if;
  if v_status <> 'pending' then
    raise exception 'Only pending purchase orders can be decided';
  end if;
  update public.purchase_orders
     set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = p_note
   where id = p_po_id;
end;
$$;

-- ===========================================================================
-- Company invoices (manual NB-INV number allowed; must match the pattern)
-- ===========================================================================
create or replace function public.save_company_invoice(
  p_invoice_id uuid,
  p_header jsonb,
  p_lines jsonb,
  p_finalize boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_invoice_id;
  v_store uuid := (p_header ->> 'store_id')::uuid;
  v_po uuid := (p_header ->> 'purchase_order_id')::uuid;
  v_status text;
  v_manual_no text := nullif(upper(trim(coalesce(p_header ->> 'invoice_no', ''))), '');
  v_no text;
  r public.nb_line_input;
  v_info public.nb_variant_snapshot;
  v_batch uuid;
  v_batch_no text;
  v_expiry date;
  v_line smallint := 0;
  v_total numeric;
  v_warning jsonb;
begin
  perform public.nb_require_company_admin();
  if v_store is null then
    raise exception 'store_id is required';
  end if;
  if v_po is not null and not exists (
    select 1 from public.purchase_orders where id = v_po and store_id = v_store and status = 'accepted'
  ) then
    raise exception 'The linked purchase order must be an accepted order of the same store';
  end if;

  if v_id is null then
    insert into public.company_invoices (
      store_id, invoice_date, purchase_order_id, place_of_supply, store_location, shipping_address, notes
    ) values (
      v_store,
      coalesce((p_header ->> 'invoice_date')::date, public.nb_today()),
      v_po,
      p_header ->> 'place_of_supply',
      p_header ->> 'store_location',
      p_header ->> 'shipping_address',
      p_header ->> 'notes'
    )
    returning id into v_id;
  else
    select status into v_status from public.company_invoices where id = v_id for update;
    if not found then
      raise exception 'Company invoice % not found', v_id;
    end if;
    if v_status <> 'draft' then
      raise exception 'Only draft invoices can be edited';
    end if;
    update public.company_invoices
       set store_id = v_store,
           invoice_date = coalesce((p_header ->> 'invoice_date')::date, invoice_date),
           purchase_order_id = v_po,
           place_of_supply = p_header ->> 'place_of_supply',
           store_location = p_header ->> 'store_location',
           shipping_address = p_header ->> 'shipping_address',
           notes = p_header ->> 'notes'
     where id = v_id;
    delete from public.company_invoice_items where invoice_id = v_id;
  end if;

  for r in select * from public.nb_parse_lines(p_lines) loop
    r := public.nb_normalize_line(r, true);
    v_info := public.nb_variant_info(r.variant_id);
    v_batch := public.nb_resolve_batch(r.variant_id, r.batch_id, r.batch_no, r.expiry_date, r.manufacture_date, true);
    if v_batch is null then
      raise exception 'Batch number is required on every company invoice line';
    end if;
    select batch_no, expiry_date into v_batch_no, v_expiry from public.product_batches where id = v_batch;
    v_line := v_line + 1;
    insert into public.company_invoice_items (
      invoice_id, line_no, variant_id, batch_id, product_name, pack_size, hsn_code, batch_no, expiry_date,
      quantity, unit_price, discount_percent, discount_amount, taxable_amount, tax_percent,
      sgst_amount, cgst_amount, igst_amount, tax_amount, line_total
    ) values (
      v_id, v_line, r.variant_id, v_batch, v_info.product_name, v_info.pack_size, v_info.hsn_code, v_batch_no,
      coalesce(r.expiry_date, v_expiry), r.quantity, r.unit_price, r.discount_percent, r.discount_amount,
      r.taxable_amount, r.tax_percent, r.sgst_amount, r.cgst_amount, r.igst_amount, r.tax_amount, r.line_total
    );
  end loop;

  v_total := public.nb_apply_totals('company_invoices', 'company_invoice_items', 'invoice_id', v_id, (p_header ->> 'round_off')::numeric);

  if v_manual_no is not null then
    begin
      update public.company_invoices
         set invoice_no = v_manual_no, number_source = 'manual'
       where id = v_id and invoice_no is distinct from v_manual_no;
    exception when unique_violation then
      raise exception 'Invoice number % is already used', v_manual_no;
    end;
  end if;

  select invoice_no into v_no from public.company_invoices where id = v_id;

  if p_finalize then
    if v_no is null then
      v_no := public.nb_next_document_no('company_invoice', null);
      update public.company_invoices set invoice_no = v_no, number_source = 'auto' where id = v_id;
    end if;
    v_warning := public.nb_enforce_outstanding_limit(v_store, v_total);
    update public.company_invoices
       set status = 'final', finalized_at = now(), finalized_by = auth.uid()
     where id = v_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'invoice_no', v_no,
    'status', case when p_finalize then 'final' else 'draft' end,
    'total_amount', v_total,
    'limit_warning', v_warning
  );
end;
$$;

create or replace function public.cancel_company_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.company_invoices%rowtype;
begin
  perform public.nb_require_company_admin();
  select * into v_inv from public.company_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Company invoice % not found', p_invoice_id;
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'Invoice is already cancelled';
  end if;
  if v_inv.receipt_status = 'received' then
    raise exception 'A received invoice cannot be cancelled';
  end if;
  if exists (select 1 from public.company_receipts where company_invoice_id = p_invoice_id and status = 'final') then
    raise exception 'Cancel the receipts on this invoice first';
  end if;
  if v_inv.status = 'final' then
    perform 1 from public.stores where id = v_inv.store_id for update;
    if public.nb_store_outstanding(v_inv.store_id) - v_inv.total_amount < 0 then
      raise exception 'Cancelling this invoice would make the store outstanding negative';
    end if;
  end if;
  update public.company_invoices
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_invoice_id;
end;
$$;

create or replace function public.mark_company_invoice_received(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.company_invoices%rowtype;
  v_item record;
begin
  select * into v_inv from public.company_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Company invoice % not found', p_invoice_id;
  end if;
  perform public.nb_require_store_admin(v_inv.store_id);
  if v_inv.status <> 'final' then
    raise exception 'Only final invoices can be received';
  end if;
  if v_inv.receipt_status = 'received' then
    raise exception 'This invoice has already been received';
  end if;

  for v_item in select * from public.company_invoice_items where invoice_id = p_invoice_id order by line_no loop
    perform public.nb_post_stock(
      'store', v_inv.store_id, null, v_item.variant_id, v_item.batch_id, v_item.quantity,
      'store_receipt', 'company_invoice_items', p_invoice_id, v_item.id, public.nb_today(), v_item.unit_price
    );
  end loop;

  update public.company_invoices
     set receipt_status = 'received', received_at = now(), received_by = auth.uid()
   where id = p_invoice_id;
end;
$$;

-- ===========================================================================
-- Purchase returns (company UI: "Sales Return")
-- ===========================================================================
create or replace function public.submit_purchase_return(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.company_invoices%rowtype;
  v_id uuid;
  v_no text;
  r public.nb_line_input;
  v_item public.company_invoice_items%rowtype;
  v_returned numeric;
  v_ratio numeric;
  v_taxable numeric;
  v_sgst numeric;
  v_cgst numeric;
  v_igst numeric;
  v_line smallint := 0;
  v_total numeric;
begin
  select * into v_inv from public.company_invoices where id = (p_header ->> 'company_invoice_id')::uuid;
  if not found then
    raise exception 'Company invoice not found';
  end if;
  perform public.nb_require_store_admin(v_inv.store_id);
  if v_inv.status <> 'final' or v_inv.receipt_status <> 'received' then
    raise exception 'Only received company invoices can be returned';
  end if;

  v_no := public.nb_next_document_no('purchase_return', v_inv.store_id);
  insert into public.purchase_returns (
    store_id, return_no, return_date, company_invoice_id, supplier, place_of_return, reason
  ) values (
    v_inv.store_id, v_no,
    coalesce((p_header ->> 'return_date')::date, public.nb_today()),
    v_inv.id,
    coalesce(nullif(p_header ->> 'supplier', ''), 'Nature Biotic'),
    coalesce(nullif(p_header ->> 'place_of_return', ''), 'Rajapalayam'),
    p_header ->> 'reason'
  )
  returning id into v_id;

  for r in select * from public.nb_parse_lines(p_lines) loop
    select * into v_item from public.company_invoice_items
    where id = r.source_item_id and invoice_id = v_inv.id;
    if not found then
      raise exception 'Each return line must reference a line of the selected invoice (source_item_id)';
    end if;
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero';
    end if;

    select coalesce(sum(pri.quantity), 0) into v_returned
    from public.purchase_return_items pri
    join public.purchase_returns pr on pr.id = pri.return_id
    where pri.company_invoice_item_id = v_item.id and pr.status in ('pending', 'approved');
    if v_returned + r.quantity > v_item.quantity then
      raise exception 'Return quantity for % exceeds the received quantity (% already returned of %)',
        v_item.product_name, v_returned, v_item.quantity;
    end if;

    perform public.nb_stock_lock('store', v_inv.store_id, null, v_item.variant_id, v_item.batch_id);
    if public.nb_store_available(v_inv.store_id, v_item.variant_id, v_item.batch_id, null) < r.quantity then
      raise exception 'Not enough available stock of % (batch %) to return', v_item.product_name, v_item.batch_no;
    end if;

    v_ratio := r.quantity / v_item.quantity;
    v_taxable := round(v_item.taxable_amount * v_ratio, 2);
    v_sgst := round(v_item.sgst_amount * v_ratio, 2);
    v_cgst := round(v_item.cgst_amount * v_ratio, 2);
    v_igst := round(v_item.igst_amount * v_ratio, 2);
    v_line := v_line + 1;

    insert into public.purchase_return_items (
      return_id, company_invoice_item_id, line_no, variant_id, batch_id, product_name, pack_size, hsn_code,
      batch_no, expiry_date, purchased_quantity, quantity, unit_price, discount_percent, discount_amount,
      taxable_amount, tax_percent, sgst_amount, cgst_amount, igst_amount, tax_amount, line_total, reason
    ) values (
      v_id, v_item.id, v_line, v_item.variant_id, v_item.batch_id, v_item.product_name, v_item.pack_size,
      v_item.hsn_code, v_item.batch_no, v_item.expiry_date, v_item.quantity, r.quantity, v_item.unit_price,
      v_item.discount_percent, round(v_item.discount_amount * v_ratio, 2), v_taxable, v_item.tax_percent,
      v_sgst, v_cgst, v_igst, v_sgst + v_cgst + v_igst, v_taxable + v_sgst + v_cgst + v_igst, r.reason
    );
  end loop;

  v_total := public.nb_apply_totals('purchase_returns', 'purchase_return_items', 'return_id', v_id, 0);
  return jsonb_build_object('id', v_id, 'return_no', v_no, 'total_amount', v_total, 'status', 'pending');
end;
$$;

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
     set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = p_note
   where id = p_return_id;
end;
$$;

-- ===========================================================================
-- Company credit notes (store sees "Debit Note"; accept only; never stock)
-- ===========================================================================
create or replace function public.save_company_credit_note(p_credit_note_id uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_credit_note_id;
  v_store uuid := (p_header ->> 'store_id')::uuid;
  v_status text;
  r public.nb_line_input;
  v_type text;
  v_pri public.purchase_return_items%rowtype;
  v_ret_status text;
  v_ret_store uuid;
  v_qty numeric;
  v_ratio numeric;
  v_credited_qty numeric;
  v_credited_amt numeric;
  v_info public.nb_variant_snapshot;
  v_line smallint := 0;
  v_total numeric;
begin
  perform public.nb_require_company_admin();
  if v_store is null then
    raise exception 'store_id is required';
  end if;

  if v_id is null then
    insert into public.company_credit_notes (store_id, credit_note_date, period_from, period_to, reason, notes)
    values (
      v_store,
      coalesce((p_header ->> 'credit_note_date')::date, public.nb_today()),
      (p_header ->> 'period_from')::date,
      (p_header ->> 'period_to')::date,
      p_header ->> 'reason',
      p_header ->> 'notes'
    )
    returning id into v_id;
  else
    select status into v_status from public.company_credit_notes where id = v_id for update;
    if not found then
      raise exception 'Credit note % not found', v_id;
    end if;
    if v_status <> 'draft' then
      raise exception 'Only draft credit notes can be edited';
    end if;
    update public.company_credit_notes
       set store_id = v_store,
           credit_note_date = coalesce((p_header ->> 'credit_note_date')::date, credit_note_date),
           period_from = (p_header ->> 'period_from')::date,
           period_to = (p_header ->> 'period_to')::date,
           reason = p_header ->> 'reason',
           notes = p_header ->> 'notes'
     where id = v_id;
    delete from public.company_credit_note_items where credit_note_id = v_id;
  end if;

  for r in select * from public.nb_parse_lines(p_lines) loop
    v_type := coalesce(r.line_type, case when r.source_item_id is not null then 'return' else 'adjustment' end);
    v_line := v_line + 1;

    if v_type = 'return' then
      perform pg_advisory_xact_lock(hashtextextended('pri-credit|' || r.source_item_id::text, 0));
      select pri.* into v_pri from public.purchase_return_items pri where pri.id = r.source_item_id;
      if not found then
        raise exception 'Purchase return line % not found', r.source_item_id;
      end if;
      select status, store_id into v_ret_status, v_ret_store from public.purchase_returns where id = v_pri.return_id;
      if v_ret_status <> 'approved' then
        raise exception 'Only approved returns can be credited';
      end if;
      if v_ret_store <> v_store then
        raise exception 'The return belongs to a different store';
      end if;

      v_qty := coalesce(r.quantity, v_pri.quantity);
      if v_qty <= 0 then
        raise exception 'Credit quantity must be greater than zero';
      end if;

      select coalesce(sum(cni.quantity), 0), coalesce(sum(cni.line_total), 0)
        into v_credited_qty, v_credited_amt
      from public.company_credit_note_items cni
      join public.company_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
      where cni.purchase_return_item_id = v_pri.id;

      if v_credited_qty + v_qty > v_pri.quantity then
        raise exception 'Credit quantity for % exceeds the approved return quantity', v_pri.product_name;
      end if;

      if r.line_total is null and r.taxable_amount is null then
        v_ratio := v_qty / v_pri.quantity;
        r.quantity := v_qty;
        r.unit_price := v_pri.unit_price;
        r.discount_percent := v_pri.discount_percent;
        r.discount_amount := round(v_pri.discount_amount * v_ratio, 2);
        r.taxable_amount := round(v_pri.taxable_amount * v_ratio, 2);
        r.tax_percent := v_pri.tax_percent;
        r.sgst_amount := round(v_pri.sgst_amount * v_ratio, 2);
        r.cgst_amount := round(v_pri.cgst_amount * v_ratio, 2);
        r.igst_amount := round(v_pri.igst_amount * v_ratio, 2);
        r.tax_amount := r.sgst_amount + r.cgst_amount + r.igst_amount;
        r.line_total := r.taxable_amount + r.tax_amount;
      else
        r.variant_id := v_pri.variant_id;
        r.quantity := v_qty;
        r := public.nb_normalize_line(r, true);
      end if;

      if v_credited_amt + r.line_total > v_pri.line_total + 0.01 then
        raise exception 'Credit amount for % exceeds the approved return value', v_pri.product_name;
      end if;

      insert into public.company_credit_note_items (
        credit_note_id, line_no, line_type, purchase_return_item_id, variant_id, batch_id, product_name,
        pack_size, hsn_code, batch_no, expiry_date, quantity, unit_price, discount_percent, discount_amount,
        taxable_amount, tax_percent, sgst_amount, cgst_amount, igst_amount, tax_amount, line_total, reason
      ) values (
        v_id, v_line, 'return', v_pri.id, v_pri.variant_id, v_pri.batch_id, v_pri.product_name,
        v_pri.pack_size, v_pri.hsn_code, v_pri.batch_no, v_pri.expiry_date, r.quantity, r.unit_price,
        r.discount_percent, r.discount_amount, r.taxable_amount, r.tax_percent, r.sgst_amount,
        r.cgst_amount, r.igst_amount, r.tax_amount, r.line_total, r.reason
      );
    elsif v_type = 'adjustment' then
      if nullif(trim(coalesce(r.reason, '')), '') is null then
        raise exception 'Adjustment lines need a reason';
      end if;
      r := public.nb_normalize_line(r, false);
      v_info := null;
      if r.variant_id is not null then
        v_info := public.nb_variant_info(r.variant_id);
      end if;
      insert into public.company_credit_note_items (
        credit_note_id, line_no, line_type, variant_id, product_name, pack_size, hsn_code, quantity,
        unit_price, discount_percent, discount_amount, taxable_amount, tax_percent, sgst_amount,
        cgst_amount, igst_amount, tax_amount, line_total, reason
      ) values (
        v_id, v_line, 'adjustment', r.variant_id,
        coalesce(nullif(trim(r.product_name), ''), v_info.product_name, 'Adjustment'),
        coalesce(v_info.pack_size, ''), v_info.hsn_code, r.quantity, r.unit_price, r.discount_percent,
        r.discount_amount, r.taxable_amount, r.tax_percent, r.sgst_amount, r.cgst_amount, r.igst_amount,
        r.tax_amount, r.line_total, r.reason
      );
    else
      raise exception 'line_type must be return or adjustment';
    end if;
  end loop;

  v_total := public.nb_apply_totals('company_credit_notes', 'company_credit_note_items', 'credit_note_id', v_id, (p_header ->> 'round_off')::numeric);
  return jsonb_build_object('id', v_id, 'status', 'draft', 'total_amount', v_total);
end;
$$;

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
  return jsonb_build_object('id', p_credit_note_id, 'credit_note_no', v_no, 'status', 'issued');
end;
$$;

create or replace function public.cancel_company_credit_note(p_credit_note_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.nb_require_company_admin();
  select status into v_status from public.company_credit_notes where id = p_credit_note_id for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  if v_status not in ('draft', 'issued') then
    raise exception 'Only draft or issued credit notes can be cancelled (accepted notes are final)';
  end if;
  update public.company_credit_notes
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_credit_note_id;
end;
$$;

create or replace function public.accept_debit_note(p_credit_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cn public.company_credit_notes%rowtype;
begin
  select * into v_cn from public.company_credit_notes where id = p_credit_note_id for update;
  if not found then
    raise exception 'Debit note % not found', p_credit_note_id;
  end if;
  perform public.nb_require_store_admin(v_cn.store_id);
  if v_cn.status <> 'issued' then
    raise exception 'Only issued debit notes can be accepted';
  end if;
  update public.company_credit_notes
     set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   where id = p_credit_note_id;
end;
$$;

-- ===========================================================================
-- Company receipts and refunds
-- ===========================================================================
create or replace function public.create_company_receipt(p_header jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.company_invoices%rowtype;
  v_amount numeric := round(coalesce((p_header ->> 'amount')::numeric, 0), 2);
  v_out numeric;
  v_no text;
  v_id uuid;
begin
  perform public.nb_require_company_admin();
  select * into v_inv from public.company_invoices where id = (p_header ->> 'company_invoice_id')::uuid;
  if not found or v_inv.status <> 'final' then
    raise exception 'Receipts can only be recorded against a final company invoice';
  end if;
  perform 1 from public.stores where id = v_inv.store_id for update;
  v_out := public.nb_company_invoice_outstanding(v_inv.id);
  if v_amount <= 0 then
    raise exception 'Receipt amount must be greater than zero';
  end if;
  if v_amount > v_out then
    raise exception 'Receipt amount % is more than the invoice outstanding %', v_amount, v_out;
  end if;

  v_no := public.nb_next_document_no('company_receipt', null);
  insert into public.company_receipts (
    receipt_no, receipt_date, store_id, company_invoice_id, method, amount, invoice_amount,
    balance_after, received_by_name, remarks
  ) values (
    v_no,
    coalesce((p_header ->> 'receipt_date')::date, public.nb_today()),
    v_inv.store_id, v_inv.id,
    (p_header ->> 'method')::public.payment_method,
    v_amount, v_inv.total_amount, v_out - v_amount,
    p_header ->> 'received_by_name', p_header ->> 'remarks'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'receipt_no', v_no, 'balance_after', v_out - v_amount);
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
  v_refunded numeric;
  v_remaining numeric;
  v_out numeric;
  v_amount numeric;
  v_applied numeric;
begin
  select * into v_cn from public.company_credit_notes where id = p_credit_note_id;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  if not public.can_read_company_doc(v_cn.store_id) then
    raise exception 'Not authorized for this credit note' using errcode = '42501';
  end if;

  select coalesce(sum(refund_amount), 0) into v_refunded
  from public.company_refunds where company_credit_note_id = v_cn.id and status = 'final';
  v_remaining := case when v_cn.status = 'accepted' then v_cn.total_amount - v_refunded else 0 end;
  v_out := greatest(public.nb_store_outstanding(v_cn.store_id), 0);
  v_amount := round(coalesce(p_amount, v_remaining), 2);
  v_applied := least(greatest(v_amount, 0), v_out);

  return jsonb_build_object(
    'credit_note_id', v_cn.id,
    'credit_note_no', v_cn.credit_note_no,
    'credit_note_status', v_cn.status,
    'credit_total', v_cn.total_amount,
    'refunded_total', v_refunded,
    'remaining_refundable', v_remaining,
    'outstanding_before', v_out,
    'refund_amount', v_amount,
    'applied_to_outstanding', v_applied,
    'cash_paid', greatest(v_amount - v_applied, 0),
    'outstanding_after', v_out - v_applied,
    'method_required', v_amount > v_applied,
    'valid', v_cn.status = 'accepted' and v_amount > 0 and v_amount <= v_remaining
  );
end;
$$;

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
declare
  v_cn public.company_credit_notes%rowtype;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_remaining numeric;
  v_out numeric;
  v_applied numeric;
  v_no text;
  v_id uuid;
begin
  perform public.nb_require_company_admin();
  select * into v_cn from public.company_credit_notes where id = p_credit_note_id for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  if v_cn.status <> 'accepted' then
    raise exception 'Refunds can only be created after the store accepts the debit note';
  end if;

  select v_cn.total_amount - coalesce(sum(refund_amount), 0) into v_remaining
  from public.company_refunds where company_credit_note_id = v_cn.id and status = 'final';
  if v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;
  if v_amount > v_remaining then
    raise exception 'Refund amount % exceeds the remaining refundable credit %', v_amount, v_remaining;
  end if;

  perform 1 from public.stores where id = v_cn.store_id for update;
  v_out := greatest(public.nb_store_outstanding(v_cn.store_id), 0);
  v_applied := least(v_amount, v_out);
  if v_amount > v_applied and p_method is null then
    raise exception 'A payment method is required for the cash payout of %', v_amount - v_applied;
  end if;

  v_no := public.nb_next_document_no('company_refund', null);
  insert into public.company_refunds (
    refund_no, refund_date, store_id, company_credit_note_id, refund_amount, outstanding_before,
    applied_to_outstanding, method, reason, remarks
  ) values (
    v_no, coalesce(p_refund_date, public.nb_today()), v_cn.store_id, v_cn.id, v_amount, v_out,
    v_applied, p_method, p_reason, p_remarks
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'refund_no', v_no, 'refund_amount', v_amount,
    'applied_to_outstanding', v_applied, 'cash_paid', v_amount - v_applied,
    'outstanding_after', v_out - v_applied
  );
end;
$$;

create or replace function public.cancel_company_refund(p_refund_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.nb_require_company_admin();
  select status into v_status from public.company_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund % not found', p_refund_id;
  end if;
  if v_status <> 'final' then
    raise exception 'Refund is already cancelled';
  end if;
  update public.company_refunds
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_refund_id;
end;
$$;

-- ===========================================================================
-- Sales invoices (internal creator shared by direct save and quotation conversion)
-- ===========================================================================
create or replace function public.nb_create_sales_invoice(p_header jsonb, p_lines jsonb, p_quotation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := coalesce((p_header ->> 'store_id')::uuid, public.auth_store_id());
  v_actor text;
  v_channel public.sales_channel;
  v_fro uuid;
  v_farmer public.farmers%rowtype;
  v_farmer_id uuid := (p_header ->> 'farmer_id')::uuid;
  v_party text;
  v_id uuid;
  v_no text;
  v_date date := coalesce((p_header ->> 'invoice_date')::date, public.nb_today());
  r public.nb_line_input;
  v_info public.nb_variant_snapshot;
  v_batch uuid;
  v_batch_no text;
  v_expiry date;
  v_item_id uuid;
  v_line smallint := 0;
  v_total numeric;
begin
  v_actor := public.nb_store_actor(v_store, true);
  if v_actor = 'fro' then
    v_channel := 'executive';
    v_fro := public.auth_staff_id();
  else
    v_channel := coalesce(nullif(p_header ->> 'channel', ''), 'direct')::public.sales_channel;
    v_fro := case when v_channel = 'executive' then (p_header ->> 'fro_staff_id')::uuid end;
    if v_channel = 'executive' and v_fro is null then
      raise exception 'Executive sales need fro_staff_id';
    end if;
  end if;
  if v_fro is not null and not exists (
    select 1 from public.staff
    where id = v_fro and store_id = v_store and public.nb_is_fro_designation(designation)
  ) then
    raise exception 'fro_staff_id must be an FRO of this store';
  end if;

  if v_farmer_id is not null then
    select * into v_farmer from public.farmers where id = v_farmer_id and store_id = v_store;
    if not found then
      raise exception 'Farmer not found in this store';
    end if;
  end if;
  v_party := coalesce(nullif(trim(p_header ->> 'party_name'), ''), v_farmer.name);
  if v_party is null then
    raise exception 'party_name or farmer_id is required';
  end if;

  v_no := public.nb_next_document_no('sales_invoice', v_store);
  insert into public.sales_invoices (
    store_id, invoice_no, invoice_date, farmer_id, party_name, farmer_phone, farmer_village, farmer_crop,
    farmer_acre, place_of_supply, channel, fro_staff_id, quotation_id, notes
  ) values (
    v_store, v_no, v_date, v_farmer_id, v_party,
    coalesce(p_header ->> 'farmer_phone', v_farmer.phone),
    coalesce(p_header ->> 'farmer_village', v_farmer.village),
    p_header ->> 'farmer_crop',
    p_header ->> 'farmer_acre',
    coalesce(nullif(p_header ->> 'place_of_supply', ''), 'Tamil Nadu'),
    v_channel, v_fro, p_quotation_id, p_header ->> 'notes'
  )
  returning id into v_id;

  for r in select * from public.nb_parse_lines(p_lines) loop
    r := public.nb_normalize_line(r, true);
    v_info := public.nb_variant_info(r.variant_id);
    v_batch := public.nb_resolve_batch(r.variant_id, r.batch_id, r.batch_no, null, null, false);
    v_batch_no := null;
    v_expiry := null;
    if v_batch is not null then
      select batch_no, expiry_date into v_batch_no, v_expiry from public.product_batches where id = v_batch;
    end if;
    v_line := v_line + 1;
    insert into public.sales_invoice_items (
      invoice_id, line_no, variant_id, batch_id, product_name, pack_size, hsn_code, batch_no, expiry_date,
      quantity, unit_price, discount_percent, discount_amount, taxable_amount, tax_percent,
      sgst_amount, cgst_amount, igst_amount, tax_amount, line_total
    ) values (
      v_id, v_line, r.variant_id, v_batch, v_info.product_name, v_info.pack_size, v_info.hsn_code,
      v_batch_no, v_expiry, r.quantity, r.unit_price, r.discount_percent, r.discount_amount,
      r.taxable_amount, r.tax_percent, r.sgst_amount, r.cgst_amount, r.igst_amount, r.tax_amount, r.line_total
    )
    returning id into v_item_id;

    if v_channel = 'direct' then
      perform public.nb_post_stock('store', v_store, null, r.variant_id, v_batch, -r.quantity,
        'sale', 'sales_invoice_items', v_id, v_item_id, v_date, r.unit_price);
    else
      perform public.nb_post_stock('fro', v_store, v_fro, r.variant_id, v_batch, -r.quantity,
        'sale', 'sales_invoice_items', v_id, v_item_id, v_date, r.unit_price);
    end if;
  end loop;

  v_total := public.nb_apply_totals('sales_invoices', 'sales_invoice_items', 'invoice_id', v_id, (p_header ->> 'round_off')::numeric);
  return jsonb_build_object('id', v_id, 'invoice_no', v_no, 'total_amount', v_total, 'channel', v_channel);
end;
$$;

create or replace function public.create_sales_invoice(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.nb_create_sales_invoice(p_header - 'quotation_id', p_lines, null);
end;
$$;

create or replace function public.cancel_sales_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.sales_invoices%rowtype;
  v_item record;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Sales invoice % not found', p_invoice_id;
  end if;
  perform public.nb_require_store_admin(v_inv.store_id);
  if v_inv.status <> 'final' then
    raise exception 'Invoice is already cancelled';
  end if;
  if exists (select 1 from public.sales_returns where sales_invoice_id = p_invoice_id and status in ('pending', 'approved')) then
    raise exception 'This invoice has sales returns; it cannot be cancelled';
  end if;
  if exists (select 1 from public.store_receipts where sales_invoice_id = p_invoice_id and status = 'final') then
    raise exception 'Cancel the receipts on this invoice first';
  end if;
  if exists (select 1 from public.store_credit_notes where sales_invoice_id = p_invoice_id and status <> 'cancelled') then
    raise exception 'This invoice has credit notes; it cannot be cancelled';
  end if;

  if v_inv.farmer_id is not null then
    perform 1 from public.farmers where id = v_inv.farmer_id for update;
  end if;
  if public.nb_party_outstanding(v_inv.store_id, v_inv.farmer_id, v_inv.id) - v_inv.total_amount < 0 then
    raise exception 'Cancelling this invoice would make the outstanding negative';
  end if;

  for v_item in select * from public.sales_invoice_items where invoice_id = p_invoice_id order by line_no loop
    perform public.nb_post_stock(
      case when v_inv.channel = 'direct' then 'store' else 'fro' end,
      v_inv.store_id, v_inv.fro_staff_id, v_item.variant_id, v_item.batch_id, v_item.quantity,
      'sale', 'sales_invoice_items', p_invoice_id, v_item.id, public.nb_today(), v_item.unit_price, true
    );
  end loop;

  update public.sales_invoices
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_invoice_id;
end;
$$;

-- ===========================================================================
-- Quotations (convert to sales invoice at most once)
-- ===========================================================================
create or replace function public.save_quotation(p_quotation_id uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_quotation_id;
  v_store uuid := coalesce((p_header ->> 'store_id')::uuid, public.auth_store_id());
  v_actor text;
  v_channel public.sales_channel;
  v_fro uuid;
  v_farmer public.farmers%rowtype;
  v_farmer_id uuid := (p_header ->> 'farmer_id')::uuid;
  v_name text;
  v_existing public.quotations%rowtype;
  v_no text;
  r public.nb_line_input;
  v_info public.nb_variant_snapshot;
  v_line smallint := 0;
  v_total numeric;
begin
  v_actor := public.nb_store_actor(v_store, true);
  if v_actor = 'fro' then
    v_channel := 'executive';
    v_fro := public.auth_staff_id();
  else
    v_channel := coalesce(nullif(p_header ->> 'channel', ''), 'direct')::public.sales_channel;
    v_fro := case when v_channel = 'executive' then (p_header ->> 'fro_staff_id')::uuid end;
    if v_channel = 'executive' and v_fro is null then
      raise exception 'Executive quotations need fro_staff_id';
    end if;
  end if;

  if v_farmer_id is not null then
    select * into v_farmer from public.farmers where id = v_farmer_id and store_id = v_store;
    if not found then
      raise exception 'Farmer not found in this store';
    end if;
  end if;
  v_name := coalesce(nullif(trim(p_header ->> 'farmer_name'), ''), v_farmer.name);
  if v_name is null then
    raise exception 'farmer_name or farmer_id is required';
  end if;

  if v_id is null then
    v_no := public.nb_next_document_no('quotation', v_store);
    insert into public.quotations (
      store_id, quotation_no, quotation_date, farmer_id, farmer_name, phone, village, crop, acre,
      place_of_supply, remarks, channel, fro_staff_id
    ) values (
      v_store, v_no, coalesce((p_header ->> 'quotation_date')::date, public.nb_today()), v_farmer_id, v_name,
      coalesce(p_header ->> 'phone', v_farmer.phone), coalesce(p_header ->> 'village', v_farmer.village),
      p_header ->> 'crop', p_header ->> 'acre',
      coalesce(nullif(p_header ->> 'place_of_supply', ''), 'Tamil Nadu'),
      p_header ->> 'remarks', v_channel, v_fro
    )
    returning id into v_id;
  else
    select * into v_existing from public.quotations where id = v_id for update;
    if not found then
      raise exception 'Quotation % not found', v_id;
    end if;
    if v_existing.store_id <> v_store then
      raise exception 'Quotation belongs to a different store';
    end if;
    if v_actor = 'fro' and v_existing.fro_staff_id is distinct from v_fro then
      raise exception 'Not authorized to edit this quotation' using errcode = '42501';
    end if;
    if v_existing.status <> 'open' then
      raise exception 'Only open quotations can be edited';
    end if;
    v_no := v_existing.quotation_no;
    update public.quotations
       set quotation_date = coalesce((p_header ->> 'quotation_date')::date, quotation_date),
           farmer_id = v_farmer_id, farmer_name = v_name,
           phone = coalesce(p_header ->> 'phone', v_farmer.phone),
           village = coalesce(p_header ->> 'village', v_farmer.village),
           crop = p_header ->> 'crop', acre = p_header ->> 'acre',
           place_of_supply = coalesce(nullif(p_header ->> 'place_of_supply', ''), 'Tamil Nadu'),
           remarks = p_header ->> 'remarks', channel = v_channel, fro_staff_id = v_fro
     where id = v_id;
    delete from public.quotation_items where quotation_id = v_id;
  end if;

  for r in select * from public.nb_parse_lines(p_lines) loop
    r := public.nb_normalize_line(r, true);
    v_info := public.nb_variant_info(r.variant_id);
    v_line := v_line + 1;
    insert into public.quotation_items (
      quotation_id, line_no, variant_id, product_name, pack_size, hsn_code, quantity, unit_price,
      discount_percent, discount_amount, taxable_amount, tax_percent, sgst_amount, cgst_amount,
      igst_amount, tax_amount, line_total
    ) values (
      v_id, v_line, r.variant_id, v_info.product_name, v_info.pack_size, v_info.hsn_code, r.quantity,
      r.unit_price, r.discount_percent, r.discount_amount, r.taxable_amount, r.tax_percent,
      r.sgst_amount, r.cgst_amount, r.igst_amount, r.tax_amount, r.line_total
    );
  end loop;

  v_total := public.nb_apply_totals('quotations', 'quotation_items', 'quotation_id', v_id, (p_header ->> 'round_off')::numeric);
  return jsonb_build_object('id', v_id, 'quotation_no', v_no, 'total_amount', v_total, 'status', 'open');
end;
$$;

create or replace function public.cancel_quotation(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.quotations%rowtype;
  v_actor text;
begin
  select * into v_q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation % not found', p_quotation_id;
  end if;
  v_actor := public.nb_store_actor(v_q.store_id, true);
  if v_actor = 'fro' and v_q.fro_staff_id is distinct from public.auth_staff_id() then
    raise exception 'Not authorized to cancel this quotation' using errcode = '42501';
  end if;
  if v_q.status <> 'open' then
    raise exception 'Only open quotations can be cancelled';
  end if;
  update public.quotations
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
   where id = p_quotation_id;
end;
$$;

-- Returns a pre-filled, editable invoice draft. Nothing is saved.
create or replace function public.prepare_quotation_conversion(p_quotation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q public.quotations%rowtype;
begin
  select * into v_q from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'Quotation % not found', p_quotation_id;
  end if;
  if not public.can_read_store_doc(v_q.store_id, v_q.fro_staff_id) then
    raise exception 'Not authorized for this quotation' using errcode = '42501';
  end if;
  if v_q.status <> 'open' then
    raise exception 'This quotation has already been converted or cancelled';
  end if;

  return jsonb_build_object(
    'quotation_id', v_q.id,
    'quotation_no', v_q.quotation_no,
    'header', jsonb_build_object(
      'store_id', v_q.store_id,
      'farmer_id', v_q.farmer_id,
      'party_name', v_q.farmer_name,
      'farmer_phone', v_q.phone,
      'farmer_village', v_q.village,
      'farmer_crop', v_q.crop,
      'farmer_acre', v_q.acre,
      'place_of_supply', v_q.place_of_supply,
      'channel', v_q.channel,
      'fro_staff_id', v_q.fro_staff_id,
      'round_off', v_q.round_off,
      'notes', v_q.remarks
    ),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_id', qi.variant_id,
        'product_name', qi.product_name,
        'pack_size', qi.pack_size,
        'quantity', qi.quantity,
        'unit_price', qi.unit_price,
        'discount_percent', qi.discount_percent,
        'discount_amount', qi.discount_amount,
        'taxable_amount', qi.taxable_amount,
        'tax_percent', qi.tax_percent,
        'sgst_amount', qi.sgst_amount,
        'cgst_amount', qi.cgst_amount,
        'igst_amount', qi.igst_amount,
        'tax_amount', qi.tax_amount,
        'line_total', qi.line_total
      ) order by qi.line_no)
      from public.quotation_items qi where qi.quotation_id = v_q.id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'taxable_amount', v_q.taxable_amount,
      'sgst_amount', v_q.sgst_amount,
      'cgst_amount', v_q.cgst_amount,
      'igst_amount', v_q.igst_amount,
      'total_amount', v_q.total_amount
    )
  );
end;
$$;

create or replace function public.convert_quotation_to_invoice(p_quotation_id uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.quotations%rowtype;
  v_result jsonb;
begin
  select * into v_q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation % not found', p_quotation_id;
  end if;
  if public.nb_store_actor(v_q.store_id, true) = 'fro' and v_q.fro_staff_id is distinct from public.auth_staff_id() then
    raise exception 'Not authorized to convert this quotation' using errcode = '42501';
  end if;
  if v_q.status <> 'open' then
    raise exception 'This quotation has already been converted or cancelled';
  end if;

  v_result := public.nb_create_sales_invoice(
    coalesce(p_header, '{}'::jsonb) || jsonb_build_object('store_id', v_q.store_id),
    p_lines,
    v_q.id
  );

  update public.quotations
     set status = 'converted',
         converted_invoice_id = (v_result ->> 'id')::uuid,
         converted_at = now(),
         converted_by = auth.uid()
   where id = v_q.id;

  return v_result || jsonb_build_object('quotation_id', v_q.id);
end;
$$;

-- ===========================================================================
-- Sales returns (pending -> approved posts stock; rejected never posts)
-- ===========================================================================
create or replace function public.create_sales_return(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.sales_invoices%rowtype;
  v_actor text;
  v_id uuid;
  v_no text;
  r public.nb_line_input;
  v_item public.sales_invoice_items%rowtype;
  v_returned numeric;
  v_ratio numeric;
  v_taxable numeric;
  v_sgst numeric;
  v_cgst numeric;
  v_igst numeric;
  v_line smallint := 0;
  v_total numeric;
begin
  select * into v_inv from public.sales_invoices where id = (p_header ->> 'sales_invoice_id')::uuid;
  if not found then
    raise exception 'Sales invoice not found';
  end if;
  v_actor := public.nb_store_actor(v_inv.store_id, true);
  if v_actor = 'fro' and v_inv.fro_staff_id is distinct from public.auth_staff_id() then
    raise exception 'Not authorized to return this invoice' using errcode = '42501';
  end if;
  if v_inv.status <> 'final' then
    raise exception 'Only final invoices can be returned';
  end if;

  v_no := public.nb_next_document_no('sales_return', v_inv.store_id);
  insert into public.sales_returns (
    store_id, return_no, return_date, sales_invoice_id, farmer_id, party_name, farmer_phone,
    farmer_village, channel, fro_staff_id
  ) values (
    v_inv.store_id, v_no, coalesce((p_header ->> 'return_date')::date, public.nb_today()), v_inv.id,
    v_inv.farmer_id, v_inv.party_name, v_inv.farmer_phone, v_inv.farmer_village, v_inv.channel, v_inv.fro_staff_id
  )
  returning id into v_id;

  for r in select * from public.nb_parse_lines(p_lines) loop
    select * into v_item from public.sales_invoice_items where id = r.source_item_id and invoice_id = v_inv.id;
    if not found then
      raise exception 'Each return line must reference a line of the selected invoice (source_item_id)';
    end if;
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero';
    end if;

    select coalesce(sum(sri.quantity), 0) into v_returned
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.return_id
    where sri.sales_invoice_item_id = v_item.id and sr.status in ('pending', 'approved');
    if v_returned + r.quantity > v_item.quantity then
      raise exception 'Return quantity for % exceeds the invoiced quantity (% already returned of %)',
        v_item.product_name, v_returned, v_item.quantity;
    end if;

    v_ratio := r.quantity / v_item.quantity;
    v_taxable := round(v_item.taxable_amount * v_ratio, 2);
    v_sgst := round(v_item.sgst_amount * v_ratio, 2);
    v_cgst := round(v_item.cgst_amount * v_ratio, 2);
    v_igst := round(v_item.igst_amount * v_ratio, 2);
    v_line := v_line + 1;

    insert into public.sales_return_items (
      return_id, sales_invoice_item_id, line_no, variant_id, batch_id, product_name, pack_size, hsn_code,
      batch_no, expiry_date, quantity, unit_price, discount_percent, discount_amount, taxable_amount,
      tax_percent, sgst_amount, cgst_amount, igst_amount, tax_amount, line_total, reason
    ) values (
      v_id, v_item.id, v_line, v_item.variant_id, v_item.batch_id, v_item.product_name, v_item.pack_size,
      v_item.hsn_code, v_item.batch_no, v_item.expiry_date, r.quantity, v_item.unit_price,
      v_item.discount_percent, round(v_item.discount_amount * v_ratio, 2), v_taxable, v_item.tax_percent,
      v_sgst, v_cgst, v_igst, v_sgst + v_cgst + v_igst, v_taxable + v_sgst + v_cgst + v_igst, r.reason
    );
  end loop;

  v_total := public.nb_apply_totals('sales_returns', 'sales_return_items', 'return_id', v_id, 0);
  return jsonb_build_object('id', v_id, 'return_no', v_no, 'total_amount', v_total, 'status', 'pending');
end;
$$;

create or replace function public.approve_sales_return(p_return_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.sales_returns%rowtype;
  v_item record;
begin
  select * into v_ret from public.sales_returns where id = p_return_id for update;
  if not found then
    raise exception 'Sales return % not found', p_return_id;
  end if;
  if not (public.is_company_admin() or (public.is_store_admin() and public.auth_store_id() = v_ret.store_id)) then
    raise exception 'Only the store admin or company admin can approve sales returns' using errcode = '42501';
  end if;
  if v_ret.status <> 'pending' then
    raise exception 'Only pending sales returns can be approved';
  end if;

  for v_item in select * from public.sales_return_items where return_id = p_return_id order by line_no loop
    perform public.nb_post_stock(
      case when v_ret.channel = 'direct' then 'store' else 'fro' end,
      v_ret.store_id, v_ret.fro_staff_id, v_item.variant_id, v_item.batch_id, v_item.quantity,
      'sale_return', 'sales_return_items', p_return_id, v_item.id, public.nb_today(), v_item.unit_price
    );
  end loop;

  update public.sales_returns
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where id = p_return_id;
end;
$$;

create or replace function public.reject_sales_return(p_return_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.sales_returns%rowtype;
begin
  select * into v_ret from public.sales_returns where id = p_return_id for update;
  if not found then
    raise exception 'Sales return % not found', p_return_id;
  end if;
  if not (public.is_company_admin() or (public.is_store_admin() and public.auth_store_id() = v_ret.store_id)) then
    raise exception 'Only the store admin or company admin can reject sales returns' using errcode = '42501';
  end if;
  if v_ret.status <> 'pending' then
    raise exception 'Only pending sales returns can be rejected';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A rejection reason is required';
  end if;
  update public.sales_returns
     set status = 'rejected', decided_at = now(), decided_by = auth.uid(), rejection_reason = p_reason
   where id = p_return_id;
end;
$$;

create or replace function public.cancel_sales_return(p_return_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.sales_returns%rowtype;
  v_item record;
begin
  select * into v_ret from public.sales_returns where id = p_return_id for update;
  if not found then
    raise exception 'Sales return % not found', p_return_id;
  end if;
  perform public.nb_require_store_admin(v_ret.store_id);
  if v_ret.status <> 'approved' then
    raise exception 'Only approved sales returns can be cancelled (reject pending ones instead)';
  end if;
  if exists (select 1 from public.store_refunds where sales_return_id = p_return_id and status = 'final') then
    raise exception 'This return has refunds; cancel them first';
  end if;
  if exists (
    select 1 from public.store_credit_note_items cni
    join public.store_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
    join public.sales_return_items sri on sri.id = cni.sales_return_item_id
    where sri.return_id = p_return_id
  ) then
    raise exception 'This return is linked to a credit note; cancel the credit note first';
  end if;

  for v_item in select * from public.sales_return_items where return_id = p_return_id order by line_no loop
    perform public.nb_post_stock(
      case when v_ret.channel = 'direct' then 'store' else 'fro' end,
      v_ret.store_id, v_ret.fro_staff_id, v_item.variant_id, v_item.batch_id, -v_item.quantity,
      'sale_return', 'sales_return_items', p_return_id, v_item.id, public.nb_today(), v_item.unit_price, true
    );
  end loop;

  update public.sales_returns
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_return_id;
end;
$$;

-- ===========================================================================
-- Store credit notes (financial only; can consolidate many sales returns)
-- ===========================================================================
create or replace function public.save_store_credit_note(p_credit_note_id uuid, p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_credit_note_id;
  v_store uuid := coalesce((p_header ->> 'store_id')::uuid, public.auth_store_id());
  v_status text;
  v_farmer uuid := (p_header ->> 'farmer_id')::uuid;
  v_invoice uuid := (p_header ->> 'sales_invoice_id')::uuid;
  v_party_key text;
  v_party text := nullif(trim(p_header ->> 'party_name'), '');
  v_channel public.sales_channel := coalesce(nullif(p_header ->> 'channel', ''), 'direct')::public.sales_channel;
  v_fro uuid := (p_header ->> 'fro_staff_id')::uuid;
  r public.nb_line_input;
  v_type text;
  v_sri public.sales_return_items%rowtype;
  v_sr public.sales_returns%rowtype;
  v_qty numeric;
  v_ratio numeric;
  v_credited_qty numeric;
  v_credited_amt numeric;
  v_return_used numeric;
  v_info public.nb_variant_snapshot;
  v_line smallint := 0;
  v_total numeric;
begin
  perform public.nb_require_store_admin(v_store);
  if v_channel = 'direct' then
    v_fro := null;
  end if;
  if v_party is null and v_farmer is not null then
    select name into v_party from public.farmers where id = v_farmer and store_id = v_store;
  end if;

  if v_id is null then
    insert into public.store_credit_notes (
      store_id, credit_note_date, farmer_id, sales_invoice_id, party_name, farmer_phone, farmer_village,
      store_location, place_of_return, channel, fro_staff_id, notes
    ) values (
      v_store, coalesce((p_header ->> 'credit_note_date')::date, public.nb_today()), v_farmer, v_invoice,
      coalesce(v_party, '-'), p_header ->> 'farmer_phone', p_header ->> 'farmer_village',
      p_header ->> 'store_location', p_header ->> 'place_of_return', v_channel, v_fro, p_header ->> 'notes'
    )
    returning id into v_id;
  else
    select status into v_status from public.store_credit_notes where id = v_id and store_id = v_store for update;
    if not found then
      raise exception 'Credit note % not found in this store', v_id;
    end if;
    if v_status <> 'draft' then
      raise exception 'Only draft credit notes can be edited';
    end if;
    update public.store_credit_notes
       set credit_note_date = coalesce((p_header ->> 'credit_note_date')::date, credit_note_date),
           farmer_id = v_farmer, sales_invoice_id = v_invoice, party_name = coalesce(v_party, '-'),
           farmer_phone = p_header ->> 'farmer_phone', farmer_village = p_header ->> 'farmer_village',
           store_location = p_header ->> 'store_location', place_of_return = p_header ->> 'place_of_return',
           channel = v_channel, fro_staff_id = v_fro, notes = p_header ->> 'notes'
     where id = v_id;
    delete from public.store_credit_note_items where credit_note_id = v_id;
  end if;

  v_party_key := case
    when v_farmer is not null then v_farmer::text
    when v_invoice is not null then 'inv:' || v_invoice::text
  end;

  for r in select * from public.nb_parse_lines(p_lines) loop
    v_type := coalesce(r.line_type, case when r.source_item_id is not null then 'return' else 'adjustment' end);
    v_line := v_line + 1;

    if v_type = 'return' then
      perform pg_advisory_xact_lock(hashtextextended('sri-credit|' || r.source_item_id::text, 0));
      select * into v_sri from public.sales_return_items where id = r.source_item_id;
      if not found then
        raise exception 'Sales return line % not found', r.source_item_id;
      end if;
      select * into v_sr from public.sales_returns where id = v_sri.return_id;
      perform pg_advisory_xact_lock(hashtextextended('sr-credit|' || v_sr.id::text, 0));
      if v_sr.status <> 'approved' then
        raise exception 'Only approved sales returns can be credited';
      end if;
      if v_sr.store_id <> v_store then
        raise exception 'The sales return belongs to a different store';
      end if;

      if v_party_key is null then
        v_farmer := v_sr.farmer_id;
        v_invoice := case when v_sr.farmer_id is null then v_sr.sales_invoice_id end;
        v_party_key := coalesce(v_sr.farmer_id::text, 'inv:' || v_sr.sales_invoice_id::text);
        update public.store_credit_notes
           set farmer_id = v_farmer,
               sales_invoice_id = coalesce(sales_invoice_id, v_sr.sales_invoice_id),
               party_name = case when party_name = '-' then v_sr.party_name else party_name end,
               channel = v_sr.channel,
               fro_staff_id = v_sr.fro_staff_id
         where id = v_id;
      end if;
      if coalesce(v_sr.farmer_id::text, 'inv:' || v_sr.sales_invoice_id::text) <> v_party_key then
        raise exception 'All credited returns must belong to the same farmer as the credit note';
      end if;

      v_qty := coalesce(r.quantity, v_sri.quantity);
      if v_qty <= 0 then
        raise exception 'Credit quantity must be greater than zero';
      end if;

      select coalesce(sum(cni.quantity), 0), coalesce(sum(cni.line_total), 0)
        into v_credited_qty, v_credited_amt
      from public.store_credit_note_items cni
      join public.store_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
      where cni.sales_return_item_id = v_sri.id;
      if v_credited_qty + v_qty > v_sri.quantity then
        raise exception 'Credit quantity for % exceeds the approved return quantity', v_sri.product_name;
      end if;

      if r.line_total is null and r.taxable_amount is null then
        v_ratio := v_qty / v_sri.quantity;
        r.quantity := v_qty;
        r.unit_price := v_sri.unit_price;
        r.discount_percent := v_sri.discount_percent;
        r.discount_amount := round(v_sri.discount_amount * v_ratio, 2);
        r.taxable_amount := round(v_sri.taxable_amount * v_ratio, 2);
        r.tax_percent := v_sri.tax_percent;
        r.sgst_amount := round(v_sri.sgst_amount * v_ratio, 2);
        r.cgst_amount := round(v_sri.cgst_amount * v_ratio, 2);
        r.igst_amount := round(v_sri.igst_amount * v_ratio, 2);
        r.tax_amount := r.sgst_amount + r.cgst_amount + r.igst_amount;
        r.line_total := r.taxable_amount + r.tax_amount;
      else
        r.variant_id := v_sri.variant_id;
        r.quantity := v_qty;
        r := public.nb_normalize_line(r, true);
      end if;

      if v_credited_amt + r.line_total > v_sri.line_total + 0.01 then
        raise exception 'Credit amount for % exceeds the returned value', v_sri.product_name;
      end if;

      select
        coalesce((select sum(refund_amount) from public.store_refunds
                  where sales_return_id = v_sr.id and status = 'final'), 0)
        + coalesce((select sum(cni.line_total) from public.store_credit_note_items cni
                    join public.store_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
                    join public.sales_return_items x on x.id = cni.sales_return_item_id
                    where x.return_id = v_sr.id), 0)
        into v_return_used;
      if v_return_used + r.line_total > v_sr.total_amount + 0.01 then
        raise exception 'Return % has only % refundable credit left', v_sr.return_no, v_sr.total_amount - v_return_used;
      end if;

      insert into public.store_credit_note_items (
        credit_note_id, line_no, line_type, sales_return_item_id, variant_id, batch_id, product_name,
        pack_size, hsn_code, batch_no, expiry_date, quantity, unit_price, discount_percent, discount_amount,
        taxable_amount, tax_percent, sgst_amount, cgst_amount, igst_amount, tax_amount, line_total, reason
      ) values (
        v_id, v_line, 'return', v_sri.id, v_sri.variant_id, v_sri.batch_id, v_sri.product_name,
        v_sri.pack_size, v_sri.hsn_code, v_sri.batch_no, v_sri.expiry_date, r.quantity, r.unit_price,
        r.discount_percent, r.discount_amount, r.taxable_amount, r.tax_percent, r.sgst_amount,
        r.cgst_amount, r.igst_amount, r.tax_amount, r.line_total, coalesce(r.reason, v_sri.reason)
      );
    elsif v_type = 'adjustment' then
      if nullif(trim(coalesce(r.reason, '')), '') is null then
        raise exception 'Adjustment lines need a reason';
      end if;
      r := public.nb_normalize_line(r, false);
      v_info := null;
      if r.variant_id is not null then
        v_info := public.nb_variant_info(r.variant_id);
      end if;
      insert into public.store_credit_note_items (
        credit_note_id, line_no, line_type, variant_id, product_name, pack_size, hsn_code, quantity,
        unit_price, discount_percent, discount_amount, taxable_amount, tax_percent, sgst_amount,
        cgst_amount, igst_amount, tax_amount, line_total, reason
      ) values (
        v_id, v_line, 'adjustment', r.variant_id,
        coalesce(nullif(trim(r.product_name), ''), v_info.product_name, 'Adjustment'),
        coalesce(v_info.pack_size, ''), v_info.hsn_code, r.quantity, r.unit_price, r.discount_percent,
        r.discount_amount, r.taxable_amount, r.tax_percent, r.sgst_amount, r.cgst_amount, r.igst_amount,
        r.tax_amount, r.line_total, r.reason
      );
    else
      raise exception 'line_type must be return or adjustment';
    end if;
  end loop;

  v_total := public.nb_apply_totals('store_credit_notes', 'store_credit_note_items', 'credit_note_id', v_id, (p_header ->> 'round_off')::numeric);
  return jsonb_build_object('id', v_id, 'status', 'draft', 'total_amount', v_total);
end;
$$;

create or replace function public.issue_store_credit_note(p_credit_note_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cn public.store_credit_notes%rowtype;
  v_no text;
begin
  select * into v_cn from public.store_credit_notes where id = p_credit_note_id for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  perform public.nb_require_store_admin(v_cn.store_id);
  if v_cn.status <> 'draft' then
    raise exception 'Only draft credit notes can be issued';
  end if;
  if not exists (select 1 from public.store_credit_note_items where credit_note_id = p_credit_note_id) then
    raise exception 'A credit note needs at least one line';
  end if;
  if v_cn.total_amount <= 0 then
    raise exception 'Credit note total must be greater than zero';
  end if;

  v_no := public.nb_next_document_no('store_credit_note', v_cn.store_id);
  update public.store_credit_notes
     set status = 'issued', credit_note_no = v_no, issued_at = now(), issued_by = auth.uid()
   where id = p_credit_note_id;
  return jsonb_build_object('id', p_credit_note_id, 'credit_note_no', v_no, 'status', 'issued');
end;
$$;

create or replace function public.cancel_store_credit_note(p_credit_note_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cn public.store_credit_notes%rowtype;
begin
  select * into v_cn from public.store_credit_notes where id = p_credit_note_id for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id;
  end if;
  perform public.nb_require_store_admin(v_cn.store_id);
  if v_cn.status = 'cancelled' then
    raise exception 'Credit note is already cancelled';
  end if;
  if exists (select 1 from public.store_refunds where store_credit_note_id = p_credit_note_id and status = 'final') then
    raise exception 'This credit note has refunds; cancel them first';
  end if;
  update public.store_credit_notes
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_credit_note_id;
end;
$$;

-- ===========================================================================
-- Store receipts
-- ===========================================================================
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
begin
  select * into v_inv from public.sales_invoices where id = (p_header ->> 'sales_invoice_id')::uuid;
  if not found or v_inv.status <> 'final' then
    raise exception 'Receipts can only be recorded against a final sales invoice';
  end if;
  v_actor := public.nb_store_actor(v_inv.store_id, true);
  if v_actor = 'fro' and v_inv.fro_staff_id is distinct from public.auth_staff_id() then
    raise exception 'Not authorized to collect on this invoice' using errcode = '42501';
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
    invoice_amount, balance_after, received_by, received_by_name, fro_staff_id, remarks
  ) values (
    v_inv.store_id, v_no, coalesce((p_header ->> 'receipt_date')::date, public.nb_today()),
    v_inv.farmer_id, v_inv.party_name, v_inv.id, (p_header ->> 'method')::public.payment_method, v_amount,
    v_inv.total_amount, v_out - v_amount, auth.uid(), p_header ->> 'received_by_name',
    case when v_actor = 'fro' then public.auth_staff_id() end,
    p_header ->> 'remarks'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'receipt_no', v_no, 'balance_after', v_out - v_amount);
end;
$$;

create or replace function public.cancel_store_receipt(p_receipt_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rcpt public.store_receipts%rowtype;
begin
  select * into v_rcpt from public.store_receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'Receipt % not found', p_receipt_id;
  end if;
  perform public.nb_require_store_admin(v_rcpt.store_id);
  if v_rcpt.status <> 'final' then
    raise exception 'Receipt is already cancelled';
  end if;
  update public.store_receipts
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_receipt_id;
end;
$$;

-- ===========================================================================
-- Store refunds (source = approved sales return OR issued store credit note)
-- ===========================================================================
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
begin
  if p_source_type = 'sales_return' then
    select * into v_sr from public.sales_returns where id = p_source_id;
    if not found then
      raise exception 'Sales return % not found', p_source_id;
    end if;
    select
      coalesce((select sum(refund_amount) from public.store_refunds
                where sales_return_id = v_sr.id and status = 'final'), 0)
      + coalesce((select sum(cni.line_total) from public.store_credit_note_items cni
                  join public.store_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
                  join public.sales_return_items x on x.id = cni.sales_return_item_id
                  where x.return_id = v_sr.id), 0)
      into v_used;
    return jsonb_build_object(
      'store_id', v_sr.store_id,
      'farmer_id', v_sr.farmer_id,
      'sales_invoice_id', v_sr.sales_invoice_id,
      'reference_no', v_sr.return_no,
      'source_total', v_sr.total_amount,
      'source_status', v_sr.status,
      'eligible', v_sr.status = 'approved',
      'remaining_refundable', case when v_sr.status = 'approved' then v_sr.total_amount - v_used else 0 end,
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
    from public.store_refunds where store_credit_note_id = v_cn.id and status = 'final';
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

create or replace function public.preview_store_refund(p_source_type text, p_source_id uuid, p_amount numeric default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_src jsonb;
  v_store uuid;
  v_actor text;
  v_remaining numeric;
  v_out numeric;
  v_amount numeric;
  v_applied numeric;
begin
  v_src := public.nb_store_refund_source(p_source_type, p_source_id);
  v_store := (v_src ->> 'store_id')::uuid;
  v_actor := public.nb_store_actor(v_store, true);
  if v_actor = 'fro' and (v_src ->> 'fro_staff_id')::uuid is distinct from public.auth_staff_id() then
    raise exception 'Not authorized for this refund source' using errcode = '42501';
  end if;

  v_remaining := (v_src ->> 'remaining_refundable')::numeric;
  v_out := greatest(public.nb_party_outstanding(v_store, (v_src ->> 'farmer_id')::uuid, (v_src ->> 'sales_invoice_id')::uuid), 0);
  v_amount := round(coalesce(p_amount, v_remaining), 2);
  v_applied := least(greatest(v_amount, 0), v_out);

  return v_src || jsonb_build_object(
    'outstanding_before', v_out,
    'refund_amount', v_amount,
    'applied_to_outstanding', v_applied,
    'cash_paid', greatest(v_amount - v_applied, 0),
    'outstanding_after', v_out - v_applied,
    'method_required', v_amount > v_applied,
    'valid', (v_src ->> 'eligible')::boolean and v_amount > 0 and v_amount <= v_remaining
  );
end;
$$;

create or replace function public.create_store_refund(
  p_source_type text,
  p_source_id uuid,
  p_amount numeric,
  p_method public.payment_method default null,
  p_reason text default null,
  p_remarks text default null,
  p_refund_date date default null,
  p_place_of_supply text default null
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
  v_no text;
  v_id uuid;
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
  if v_amount > v_applied and p_method is null then
    raise exception 'A payment method is required for the cash payout of %', v_amount - v_applied;
  end if;

  v_no := public.nb_next_document_no('store_refund', v_store);
  insert into public.store_refunds (
    store_id, refund_no, refund_date, farmer_id, farmer_name, farmer_phone, farmer_village,
    sales_return_id, store_credit_note_id, reference_no, sales_invoice_id, return_amount,
    refund_amount, outstanding_before, applied_to_outstanding, method, reason, remarks,
    channel, fro_staff_id, place_of_supply
  ) values (
    v_store, v_no, coalesce(p_refund_date, public.nb_today()), v_farmer, v_src ->> 'party_name',
    v_src ->> 'farmer_phone', v_src ->> 'farmer_village',
    case when p_source_type = 'sales_return' then p_source_id end,
    case when p_source_type = 'store_credit_note' then p_source_id end,
    v_src ->> 'reference_no', v_invoice, (v_src ->> 'source_total')::numeric,
    v_amount, v_out, v_applied, p_method, p_reason, p_remarks,
    (v_src ->> 'channel')::public.sales_channel,
    case when v_src ->> 'channel' = 'executive' then (v_src ->> 'fro_staff_id')::uuid end,
    p_place_of_supply
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'refund_no', v_no, 'refund_amount', v_amount,
    'applied_to_outstanding', v_applied, 'cash_paid', v_amount - v_applied,
    'outstanding_after', v_out - v_applied
  );
end;
$$;

create or replace function public.cancel_store_refund(p_refund_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.store_refunds%rowtype;
begin
  select * into v_ref from public.store_refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund % not found', p_refund_id;
  end if;
  perform public.nb_require_store_admin(v_ref.store_id);
  if v_ref.status <> 'final' then
    raise exception 'Refund is already cancelled';
  end if;
  update public.store_refunds
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_refund_id;
end;
$$;

-- ===========================================================================
-- Inventory: adjustments and physical counts
-- ===========================================================================
create or replace function public.create_stock_adjustment(
  p_store_id uuid,
  p_variant_id uuid,
  p_qty numeric,
  p_reason text,
  p_batch_id uuid default null,
  p_batch_no text default null,
  p_adjustment_date date default null,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid;
  v_date date := coalesce(p_adjustment_date, public.nb_today());
  v_id uuid;
  v_ids uuid[] := '{}';
  v_left numeric;
  v_take numeric;
  v_avail numeric;
  b record;
begin
  perform public.nb_require_store_admin(p_store_id);
  if p_qty is null or p_qty = 0 then
    raise exception 'Adjustment quantity cannot be zero';
  end if;
  perform public.nb_variant_info(p_variant_id);
  v_batch := public.nb_resolve_batch(p_variant_id, p_batch_id, p_batch_no, null, null, false);

  if p_qty > 0 or v_batch is not null then
    insert into public.stock_adjustments (store_id, variant_id, batch_id, qty, reason, adjustment_date, remarks)
    values (p_store_id, p_variant_id, v_batch, p_qty, p_reason, v_date, p_remarks)
    returning id into v_id;
    perform public.nb_post_stock('store', p_store_id, null, p_variant_id, v_batch, p_qty,
      'adjustment', 'stock_adjustments', v_id, v_id, v_date);
    return jsonb_build_object('ids', jsonb_build_array(v_id));
  end if;

  v_left := -p_qty;
  for b in
    select sm.batch_id, pb.expiry_date
    from public.stock_movements sm
    left join public.product_batches pb on pb.id = sm.batch_id
    where sm.location = 'store' and sm.store_id = p_store_id and sm.variant_id = p_variant_id
    group by sm.batch_id, pb.expiry_date
    having sum(sm.qty_delta) > 0
    order by pb.expiry_date nulls last
  loop
    perform public.nb_stock_lock('store', p_store_id, null, p_variant_id, b.batch_id);
    v_avail := public.nb_store_available(p_store_id, p_variant_id, b.batch_id, null);
    continue when v_avail <= 0;
    v_take := least(v_left, v_avail);
    insert into public.stock_adjustments (store_id, variant_id, batch_id, qty, reason, adjustment_date, remarks)
    values (p_store_id, p_variant_id, b.batch_id, -v_take, p_reason, v_date, p_remarks)
    returning id into v_id;
    perform public.nb_post_stock('store', p_store_id, null, p_variant_id, b.batch_id, -v_take,
      'adjustment', 'stock_adjustments', v_id, v_id, v_date);
    v_ids := v_ids || v_id;
    v_left := v_left - v_take;
    exit when v_left <= 0;
  end loop;

  if v_left > 0 then
    raise exception 'Not enough available stock to reduce by %', -p_qty;
  end if;
  return jsonb_build_object('ids', to_jsonb(v_ids));
end;
$$;

create or replace function public.record_physical_count(
  p_store_id uuid,
  p_lines jsonb,
  p_count_date date default null,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_line jsonb;
  v_variant uuid;
  v_qty numeric;
  v_price numeric;
  v_system numeric;
  v_info public.nb_variant_snapshot;
  v_no smallint := 0;
  v_total_qty numeric := 0;
  v_total_value numeric := 0;
  v_system_qty numeric := 0;
  v_system_value numeric := 0;
  v_match boolean := true;
begin
  perform public.nb_require_store_admin(p_store_id);
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one line is required';
  end if;

  insert into public.physical_stock_counts (store_id, count_date, remarks)
  values (p_store_id, coalesce(p_count_date, public.nb_today()), p_remarks)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_variant := (v_line ->> 'variant_id')::uuid;
    v_qty := coalesce((v_line ->> 'qty')::numeric, 0);
    v_price := coalesce((v_line ->> 'unit_price')::numeric, 0);
    v_info := public.nb_variant_info(v_variant);
    select coalesce(sum(qty_delta), 0) into v_system
    from public.stock_movements
    where location = 'store' and store_id = p_store_id and variant_id = v_variant;
    v_no := v_no + 1;
    insert into public.physical_stock_count_lines (count_id, line_no, variant_id, product_name, pack_size, qty, unit_price, system_qty)
    values (v_id, v_no, v_variant, v_info.product_name, v_info.pack_size, v_qty, v_price, v_system);
    v_total_qty := v_total_qty + v_qty;
    v_total_value := v_total_value + v_qty * v_price;
    v_system_qty := v_system_qty + v_system;
    v_system_value := v_system_value + v_system * v_price;
    if v_qty <> v_system then
      v_match := false;
    end if;
  end loop;

  update public.physical_stock_counts
     set total_qty = v_total_qty, total_value = round(v_total_value, 2),
         system_qty = v_system_qty, system_value = round(v_system_value, 2), is_match = v_match
   where id = v_id;
  return jsonb_build_object('id', v_id, 'is_match', v_match);
end;
$$;

-- ===========================================================================
-- FRO stock: deliveries (store -> FRO) and stock returns (FRO -> store)
-- ===========================================================================
create or replace function public.create_stock_delivery(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := coalesce((p_header ->> 'store_id')::uuid, public.auth_store_id());
  v_fro uuid := (p_header ->> 'fro_staff_id')::uuid;
  v_id uuid;
  v_no text;
  r public.nb_line_input;
  v_info public.nb_variant_snapshot;
  v_batch uuid;
  v_batch_no text;
  v_expiry date;
  v_line smallint := 0;
begin
  perform public.nb_require_store_admin(v_store);
  if not exists (
    select 1 from public.staff
    where id = v_fro and store_id = v_store and status = 'active' and public.nb_is_fro_designation(designation)
  ) then
    raise exception 'Deliveries can only be issued to an active FRO of this store';
  end if;

  v_no := public.nb_next_document_no('delivery_challan', v_store);
  insert into public.stock_deliveries (store_id, sd_no, delivery_date, fro_staff_id, issued_by, remarks)
  values (v_store, v_no, coalesce((p_header ->> 'delivery_date')::date, public.nb_today()), v_fro, auth.uid(), p_header ->> 'remarks')
  returning id into v_id;

  for r in select * from public.nb_parse_lines(p_lines) loop
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'Delivery quantity must be greater than zero';
    end if;
    v_info := public.nb_variant_info(r.variant_id);
    v_batch := public.nb_resolve_batch(r.variant_id, r.batch_id, r.batch_no, null, null, false);
    if public.nb_store_available(v_store, r.variant_id, v_batch, null) < r.quantity then
      raise exception 'Not enough available store stock of % for this delivery', v_info.product_name;
    end if;
    v_batch_no := null;
    v_expiry := null;
    if v_batch is not null then
      select batch_no, expiry_date into v_batch_no, v_expiry from public.product_batches where id = v_batch;
    end if;
    v_line := v_line + 1;
    insert into public.stock_delivery_items (
      delivery_id, line_no, variant_id, batch_id, product_name, pack_size, batch_no, expiry_date, qty, unit_value, tax_percent
    ) values (
      v_id, v_line, r.variant_id, v_batch, v_info.product_name, v_info.pack_size, v_batch_no, v_expiry, r.quantity,
      round(coalesce(r.unit_value, r.unit_price, 0), 2), coalesce(r.tax_percent, v_info.tax_percent, 0)
    );
  end loop;

  return jsonb_build_object('id', v_id, 'sd_no', v_no, 'status', 'pending');
end;
$$;

create or replace function public.accept_stock_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_del public.stock_deliveries%rowtype;
  v_item record;
begin
  select * into v_del from public.stock_deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Delivery % not found', p_delivery_id;
  end if;
  if not (public.is_fro() and public.auth_staff_id() = v_del.fro_staff_id) then
    raise exception 'Only the receiving FRO can accept this delivery' using errcode = '42501';
  end if;
  if v_del.status <> 'pending' then
    raise exception 'This delivery has already been accepted';
  end if;

  for v_item in select * from public.stock_delivery_items where delivery_id = p_delivery_id order by line_no loop
    perform public.nb_post_stock('store', v_del.store_id, null, v_item.variant_id, v_item.batch_id, -v_item.qty,
      'delivery_out', 'stock_delivery_items', p_delivery_id, v_item.id, public.nb_today(), v_item.unit_value);
    perform public.nb_post_stock('fro', v_del.store_id, v_del.fro_staff_id, v_item.variant_id, v_item.batch_id, v_item.qty,
      'delivery_in', 'stock_delivery_items', p_delivery_id, v_item.id, public.nb_today(), v_item.unit_value);
  end loop;

  update public.stock_deliveries
     set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   where id = p_delivery_id;
end;
$$;

create or replace function public.nb_insert_stock_return_lines(p_return_id uuid, p_store_id uuid, p_fro uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nb_line_input;
  v_info public.nb_variant_snapshot;
  v_batch uuid;
  v_batch_no text;
  v_expiry date;
  v_line smallint := 0;
begin
  for r in select * from public.nb_parse_lines(p_lines) loop
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero';
    end if;
    v_info := public.nb_variant_info(r.variant_id);
    v_batch := public.nb_resolve_batch(r.variant_id, r.batch_id, r.batch_no, null, null, false);
    if public.nb_stock_balance('fro', p_store_id, p_fro, r.variant_id, v_batch) < r.quantity then
      raise exception 'The FRO does not hold enough stock of % to return', v_info.product_name;
    end if;
    v_batch_no := null;
    v_expiry := null;
    if v_batch is not null then
      select batch_no, expiry_date into v_batch_no, v_expiry from public.product_batches where id = v_batch;
    end if;
    v_line := v_line + 1;
    insert into public.stock_return_items (
      return_id, line_no, variant_id, batch_id, product_name, pack_size, batch_no, expiry_date, qty, unit_value, reason
    ) values (
      p_return_id, v_line, r.variant_id, v_batch, v_info.product_name, v_info.pack_size, v_batch_no, v_expiry,
      r.quantity, round(coalesce(r.unit_value, r.unit_price, 0), 2), r.reason
    );
  end loop;
end;
$$;

create or replace function public.nb_accept_stock_return(p_return_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.stock_returns%rowtype;
  v_item record;
begin
  select * into v_ret from public.stock_returns where id = p_return_id for update;
  if v_ret.status <> 'pending' then
    raise exception 'This stock return has already been accepted';
  end if;
  for v_item in select * from public.stock_return_items where return_id = p_return_id order by line_no loop
    perform public.nb_post_stock('fro', v_ret.store_id, v_ret.fro_staff_id, v_item.variant_id, v_item.batch_id, -v_item.qty,
      'fro_return_out', 'stock_return_items', p_return_id, v_item.id, public.nb_today(), v_item.unit_value);
    perform public.nb_post_stock('store', v_ret.store_id, null, v_item.variant_id, v_item.batch_id, v_item.qty,
      'fro_return_in', 'stock_return_items', p_return_id, v_item.id, public.nb_today(), v_item.unit_value);
  end loop;
  update public.stock_returns
     set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   where id = p_return_id;
end;
$$;

create or replace function public.submit_stock_return(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.auth_store_id();
  v_fro uuid := public.auth_staff_id();
  v_id uuid;
  v_no text;
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can submit a stock return request' using errcode = '42501';
  end if;
  v_no := public.nb_next_document_no('fro_stock_return', v_store);
  insert into public.stock_returns (
    store_id, return_no, return_date, fro_staff_id, source, stock_delivery_id, reason, discount, remarks
  ) values (
    v_store, v_no, coalesce((p_header ->> 'return_date')::date, public.nb_today()), v_fro, 'fro_request',
    (p_header ->> 'stock_delivery_id')::uuid, p_header ->> 'reason',
    coalesce((p_header ->> 'discount')::numeric, 0), p_header ->> 'remarks'
  )
  returning id into v_id;
  perform public.nb_insert_stock_return_lines(v_id, v_store, v_fro, p_lines);
  return jsonb_build_object('id', v_id, 'return_no', v_no, 'status', 'pending');
end;
$$;

create or replace function public.accept_stock_return(p_return_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  select store_id into v_store from public.stock_returns where id = p_return_id;
  if v_store is null then
    raise exception 'Stock return % not found', p_return_id;
  end if;
  perform public.nb_require_store_admin(v_store);
  perform public.nb_accept_stock_return(p_return_id);
end;
$$;

create or replace function public.create_manual_stock_return(p_header jsonb, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := coalesce((p_header ->> 'store_id')::uuid, public.auth_store_id());
  v_fro uuid := (p_header ->> 'fro_staff_id')::uuid;
  v_id uuid;
  v_no text;
begin
  perform public.nb_require_store_admin(v_store);
  if not exists (select 1 from public.staff where id = v_fro and store_id = v_store and public.nb_is_fro_designation(designation)) then
    raise exception 'fro_staff_id must be an FRO of this store';
  end if;
  v_no := public.nb_next_document_no('fro_stock_return', v_store);
  insert into public.stock_returns (
    store_id, return_no, manual_ref_no, return_date, fro_staff_id, source, stock_delivery_id, reason,
    discount, customer_name, village, phone, place_of_supply, remarks
  ) values (
    v_store, v_no, p_header ->> 'manual_ref_no', coalesce((p_header ->> 'return_date')::date, public.nb_today()),
    v_fro, 'store_manual', (p_header ->> 'stock_delivery_id')::uuid, p_header ->> 'reason',
    coalesce((p_header ->> 'discount')::numeric, 0), p_header ->> 'customer_name', p_header ->> 'village',
    p_header ->> 'phone', p_header ->> 'place_of_supply', p_header ->> 'remarks'
  )
  returning id into v_id;
  perform public.nb_insert_stock_return_lines(v_id, v_store, v_fro, p_lines);
  perform public.nb_accept_stock_return(v_id);
  return jsonb_build_object('id', v_id, 'return_no', v_no, 'status', 'accepted');
end;
$$;

-- ===========================================================================
-- FRO cash: handovers, advances, settlements, cash refunds
-- ===========================================================================
create or replace function public.nb_open_settlement_id(p_fro uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.fro_expense_settlements where fro_staff_id = p_fro and status = 'open' limit 1;
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
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can hand over cash' using errcode = '42501';
  end if;
  insert into public.cash_handovers (store_id, fro_staff_id, handover_date, amount, method, remarks)
  values (public.auth_store_id(), public.auth_staff_id(), coalesce(p_handover_date, public.nb_today()), round(p_amount, 2), p_method, p_remarks)
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
  update public.cash_handovers
     set status = p_decision, decided_at = now(), decided_by = auth.uid()
   where id = p_handover_id;
end;
$$;

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
begin
  select store_id into v_store from public.staff where id = p_fro_staff_id and public.nb_is_fro_designation(designation);
  if v_store is null then
    raise exception 'FRO % not found', p_fro_staff_id;
  end if;
  perform public.nb_require_store_admin(v_store);
  insert into public.fro_cash_advances (store_id, fro_staff_id, advance_date, amount, method, remarks, settlement_id)
  values (v_store, p_fro_staff_id, coalesce(p_advance_date, public.nb_today()), round(p_amount, 2), p_method,
          p_remarks, public.nb_open_settlement_id(p_fro_staff_id))
  returning id into v_id;
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
     set status = 'accepted', accepted_at = now(), accepted_by = auth.uid(),
         settlement_id = coalesce(settlement_id, public.nb_open_settlement_id(v_row.fro_staff_id))
   where id = p_advance_id;
end;
$$;

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
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can record a cash refund to the store' using errcode = '42501';
  end if;
  insert into public.fro_cash_refunds (store_id, fro_staff_id, settlement_id, refunded_at, amount, method, remarks)
  values (public.auth_store_id(), public.auth_staff_id(), public.nb_open_settlement_id(public.auth_staff_id()),
          coalesce(p_refunded_at, now()), round(p_amount, 2), p_method, p_remarks)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.open_fro_settlement(p_fro_staff_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fro uuid := coalesce(p_fro_staff_id, public.auth_staff_id());
  v_store uuid;
  v_id uuid;
begin
  select store_id into v_store from public.staff where id = v_fro and public.nb_is_fro_designation(designation);
  if v_store is null then
    raise exception 'FRO % not found', v_fro;
  end if;
  if not ((public.is_fro() and public.auth_staff_id() = v_fro)
          or (public.is_store_admin() and public.auth_store_id() = v_store)) then
    raise exception 'Not authorized to open a settlement for this FRO' using errcode = '42501';
  end if;
  if public.nb_open_settlement_id(v_fro) is not null then
    raise exception 'This FRO already has an open settlement';
  end if;
  insert into public.fro_expense_settlements (store_id, fro_staff_id) values (v_store, v_fro) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.complete_fro_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fro_expense_settlements%rowtype;
begin
  select * into v_row from public.fro_expense_settlements where id = p_settlement_id for update;
  if not found then
    raise exception 'Settlement % not found', p_settlement_id;
  end if;
  if not ((public.is_fro() and public.auth_staff_id() = v_row.fro_staff_id)
          or (public.is_store_admin() and public.auth_store_id() = v_row.store_id)) then
    raise exception 'Not authorized to complete this settlement' using errcode = '42501';
  end if;
  if v_row.status <> 'open' then
    raise exception 'Settlement is already completed';
  end if;
  update public.fro_expense_settlements
     set status = 'completed', completed_at = now(), completed_by = auth.uid()
   where id = p_settlement_id;
end;
$$;

-- ===========================================================================
-- Expenses (store and FRO share one SAI-EXP series per store; company NB-EXP)
-- ===========================================================================
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
begin
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
  else
    raise exception 'scope must be company, store or fro';
  end if;

  insert into public.expenses (
    scope, store_id, fro_staff_id, expense_no, expense_date, category_id, description, amount, method,
    entered_by_name, settlement_id, receipt_path
  ) values (
    p_scope, v_store, v_fro, v_no, coalesce(p_expense_date, public.nb_today()), p_category_id, p_description,
    round(p_amount, 2), p_method, p_entered_by_name, v_settlement, p_receipt_path
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'expense_no', v_no);
end;
$$;

-- ===========================================================================
-- Attendance and visits
-- ===========================================================================
create or replace function public.check_in(
  p_staff_id uuid default null,
  p_status text default 'checked_in',
  p_note text default null,
  p_attendance_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := coalesce(p_staff_id, public.auth_staff_id());
  v_store uuid;
  v_id uuid;
begin
  select store_id into v_store from public.staff where id = v_staff;
  if v_store is null then
    raise exception 'Staff member not found';
  end if;
  if public.is_fro() then
    if v_staff <> public.auth_staff_id() then
      raise exception 'An FRO can only mark their own attendance' using errcode = '42501';
    end if;
  else
    perform public.nb_require_store_admin(v_store);
  end if;
  if p_status not in ('present', 'leave', 'absent', 'half_day', 'checked_in') then
    raise exception 'Invalid attendance status %', p_status;
  end if;

  insert into public.staff_attendance (store_id, staff_id, attendance_date, check_in_at, status, note)
  values (
    v_store, v_staff, coalesce(p_attendance_date, public.nb_today()),
    case when p_status in ('present', 'half_day', 'checked_in') then now() end,
    p_status, p_note
  )
  on conflict (staff_id, attendance_date) do update
    set status = excluded.status,
        note = coalesce(excluded.note, staff_attendance.note),
        check_in_at = coalesce(staff_attendance.check_in_at, excluded.check_in_at)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.check_out(p_staff_id uuid default null, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := coalesce(p_staff_id, public.auth_staff_id());
  v_store uuid;
  v_id uuid;
begin
  select store_id into v_store from public.staff where id = v_staff;
  if v_store is null then
    raise exception 'Staff member not found';
  end if;
  if public.is_fro() then
    if v_staff <> public.auth_staff_id() then
      raise exception 'An FRO can only mark their own attendance' using errcode = '42501';
    end if;
  else
    perform public.nb_require_store_admin(v_store);
  end if;

  update public.staff_attendance
     set check_out_at = now(), status = 'checked_out', note = coalesce(p_note, note)
   where staff_id = v_staff and attendance_date = public.nb_today() and check_in_at is not null
  returning id into v_id;
  if v_id is null then
    raise exception 'No check-in found for today';
  end if;
  return v_id;
end;
$$;

create or replace function public.record_visit(
  p_farmer_name text,
  p_farmer_id uuid default null,
  p_village text default null,
  p_phone text default null,
  p_visit_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_farmer_name, '')), '');
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can record visits' using errcode = '42501';
  end if;
  if v_name is null and p_farmer_id is not null then
    select name into v_name from public.farmers where id = p_farmer_id and store_id = public.auth_store_id();
  end if;
  if v_name is null then
    raise exception 'Farmer name is required';
  end if;
  insert into public.fro_visits (store_id, fro_staff_id, visit_date, farmer_id, farmer_name, village, phone)
  values (public.auth_store_id(), public.auth_staff_id(), coalesce(p_visit_date, public.nb_today()), p_farmer_id, v_name, p_village, p_phone)
  returning id into v_id;
  return v_id;
end;
$$;

-- ===========================================================================
-- Notifications (derived in the app; only read state is stored)
-- ===========================================================================
create or replace function public.mark_notifications_read(p_keys text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_active_user() then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.notification_reads (profile_id, notification_key)
  select auth.uid(), k from unnest(p_keys) as k where nullif(trim(k), '') is not null
  on conflict (profile_id, notification_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ===========================================================================
-- Function privileges
--   * nb_* helpers: internal only (except nb_is_fro_designation, used inside views)
--   * everything else in public: callable by authenticated, never by anon
-- ===========================================================================
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname like 'nb\_%' and f.proname <> 'nb_is_fro_designation' then
      execute format('revoke all on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end;
$$;
