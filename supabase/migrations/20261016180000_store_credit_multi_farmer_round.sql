-- Store credit notes may combine approved sales returns from multiple farmers.
-- Round sales returns and store credit notes once, to the nearest rupee.
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
  v_unrounded numeric;
  v_round numeric;
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

      if exists (
        select 1
        from public.store_credit_notes cn
        where cn.id = v_id and cn.party_name = '-'
      ) then
        update public.store_credit_notes
           set party_name = coalesce(v_sr.party_name, party_name),
               sales_invoice_id = coalesce(sales_invoice_id, v_sr.sales_invoice_id)
         where id = v_id;
      end if;

      v_qty := coalesce(r.quantity, v_sri.quantity);
      if v_qty <= 0 then
        raise exception 'Credit quantity must be greater than zero';
      end if;
      if v_qty <> trunc(v_qty) then
        raise exception 'Credit quantity for % must be a whole number', v_sri.product_name;
      end if;
      if exists (
        select 1 from public.store_credit_note_items
        where credit_note_id = v_id and sales_return_item_id = v_sri.id
      ) then
        raise exception 'Credit quantity for % is already on this credit note', v_sri.product_name;
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

  update public.store_credit_notes cn
     set farmer_id = case when farmer_count.cnt > 1 then null else cn.farmer_id end,
         party_name = case
           when farmer_count.cnt > 1 and cn.party_name in ('-', '') then 'Multiple farmers'
           when farmer_count.cnt = 1 and cn.party_name in ('-', '') then coalesce(farmer_count.party_name, cn.party_name)
           else cn.party_name
         end
    from (
      select count(distinct sr.farmer_id) as cnt,
             max(sr.party_name) as party_name
      from public.store_credit_note_items cni
      join public.sales_return_items sri on sri.id = cni.sales_return_item_id
      join public.sales_returns sr on sr.id = sri.return_id
      where cni.credit_note_id = v_id
        and cni.line_type = 'return'
    ) farmer_count
   where cn.id = v_id;

  select coalesce(sum(line_total), 0) into v_unrounded
  from public.store_credit_note_items
  where credit_note_id = v_id;
  v_round := round(v_unrounded, 0) - v_unrounded;
  v_total := public.nb_apply_totals('store_credit_notes', 'store_credit_note_items', 'credit_note_id', v_id, v_round);
  return jsonb_build_object('id', v_id, 'status', 'draft', 'total_amount', v_total);
end;
$$;

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
  v_unrounded numeric;
  v_round numeric;
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

  select coalesce(sum(line_total), 0) into v_unrounded
  from public.sales_return_items
  where return_id = v_id;
  v_round := round(v_unrounded, 0) - v_unrounded;
  v_total := public.nb_apply_totals('sales_returns', 'sales_return_items', 'return_id', v_id, v_round);
  return jsonb_build_object('id', v_id, 'return_no', v_no, 'total_amount', v_total, 'status', 'pending');
end;
$$;

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
                where sales_return_id = v_sr.id and status = 'final'), 0)
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

update public.sales_returns sr
   set round_off = round(s.line_total, 0) - s.line_total,
       total_amount = round(s.line_total, 0)
  from (
    select return_id, coalesce(sum(line_total), 0) as line_total
    from public.sales_return_items
    group by return_id
  ) s
 where sr.id = s.return_id
   and sr.round_off = 0
   and sr.total_amount = s.line_total
   and round(s.line_total, 0) <> s.line_total;

update public.store_credit_notes cn
   set round_off = round(s.line_total, 0) - s.line_total,
       total_amount = round(s.line_total, 0)
  from (
    select credit_note_id, coalesce(sum(line_total), 0) as line_total
    from public.store_credit_note_items
    group by credit_note_id
  ) s
 where cn.id = s.credit_note_id
   and cn.round_off = 0
   and cn.total_amount = s.line_total
   and round(s.line_total, 0) <> s.line_total;