-- Store credit quantities are whole packs from one sales-return line.
-- The balance is the approved return quantity minus quantities already on
-- non-cancelled store credit notes.
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
