-- Round a company credit note once, to the nearest rupee. Line GST stays as stored.
-- Half a rupee or more rounds up. The adjustment is the existing round_off column.
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
  v_unrounded numeric;
  v_round numeric;
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
      if v_qty <> trunc(v_qty) then
        raise exception 'Credit quantity for % must be a whole number', v_pri.product_name;
      end if;
      if exists (
        select 1 from public.company_credit_note_items
        where credit_note_id = v_id and purchase_return_item_id = v_pri.id
      ) then
        raise exception 'Credit quantity for % is already on this credit note', v_pri.product_name;
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

  select coalesce(sum(line_total), 0) into v_unrounded
  from public.company_credit_note_items
  where credit_note_id = v_id;
  v_round := round(v_unrounded, 0) - v_unrounded;
  v_total := public.nb_apply_totals('company_credit_notes', 'company_credit_note_items', 'credit_note_id', v_id, v_round);
  return jsonb_build_object('id', v_id, 'status', 'draft', 'total_amount', v_total);
end;
$$;
update public.company_credit_notes cn
   set round_off = round(s.line_total, 0) - s.line_total,
       total_amount = round(s.line_total, 0)
  from (
    select credit_note_id, coalesce(sum(line_total), 0) as line_total
    from public.company_credit_note_items
    group by credit_note_id
  ) s
 where cn.id = s.credit_note_id
   and cn.total_amount = s.line_total
   and cn.round_off = 0
   and round(s.line_total, 0) <> s.line_total;