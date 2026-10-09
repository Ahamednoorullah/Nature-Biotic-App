/*
# Nature Biotic ERP/CRM — 04 Internal engine (numbering, stock, outstanding, lines)

Internal helpers (prefix nb_). They are NOT callable by clients; the grants
block in 20261008150400_nb_business_rpcs.sql revokes EXECUTE on nb_* from
anon/authenticated. Business RPCs call them.

Numbering
- document_sequences holds the configuration (prefix, pad width, manual allowed)
  and the counters. Store-scoped templates use scope_key '*' and a {STORE}
  placeholder; counters are kept per store code. Company documents use 'GLOBAL'.
- nb_next_document_no increments the counter with a row lock (UPDATE ... RETURNING),
  so concurrent saves never get the same number, and skips numbers already taken.
- Company invoices may be entered manually; they must match the configured
  NB-INV pattern, and a higher manual number moves the counter past it.

Stock
- Only 'store' and 'fro' locations. Every decrease is checked under an advisory
  lock; store decreases also respect pending purchase-return reservations.
*/

-- ---------------------------------------------------------------------------
-- Small utilities
-- ---------------------------------------------------------------------------
create or replace function public.nb_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

create or replace function public.nb_store_code(p_store_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from public.stores where id = p_store_id;
  if v_code is null then
    raise exception 'Unknown store %', p_store_id;
  end if;
  return v_code;
end;
$$;

create or replace function public.nb_require_company_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_company_admin() then
    raise exception 'Only a company admin can perform this action' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.nb_require_store_admin(p_store_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_store_admin() and public.auth_store_id() = p_store_id) then
    raise exception 'Only the store admin of this store can perform this action' using errcode = '42501';
  end if;
end;
$$;

-- Returns 'store_admin' or 'fro' for a user acting inside p_store_id.
create or replace function public.nb_store_actor(p_store_id uuid, p_allow_fro boolean)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_store_admin() and public.auth_store_id() = p_store_id then
    return 'store_admin';
  end if;
  if p_allow_fro and public.is_fro() and public.auth_store_id() = p_store_id then
    return 'fro';
  end if;
  raise exception 'Not authorized for this store' using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------
create or replace function public.nb_sequence_config(p_doc_type text)
returns public.document_sequences
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.document_sequences;
begin
  select * into v_row
  from public.document_sequences
  where doc_type = p_doc_type and scope_key in ('*', 'GLOBAL')
  order by (scope_key = 'GLOBAL') desc
  limit 1;
  if not found then
    raise exception 'Unknown document type %', p_doc_type;
  end if;
  return v_row;
end;
$$;

create or replace function public.nb_format_document_no(p_doc_type text, p_store_id uuid, p_value bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg public.document_sequences;
  v_prefix text;
  v_digits text := p_value::text;
begin
  v_cfg := public.nb_sequence_config(p_doc_type);
  v_prefix := v_cfg.prefix;
  if position('{STORE}' in v_prefix) > 0 then
    if p_store_id is null then
      raise exception 'Document type % needs a store', p_doc_type;
    end if;
    v_prefix := replace(v_prefix, '{STORE}', public.nb_store_code(p_store_id));
  end if;
  if length(v_digits) < v_cfg.pad_width then
    v_digits := lpad(v_digits, v_cfg.pad_width, '0');
  end if;
  return v_prefix || v_digits;
end;
$$;

-- Regex for a GLOBAL document type, e.g. ^NB\-INV\-[0-9]{4,}$
create or replace function public.nb_document_pattern(p_doc_type text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg public.document_sequences;
begin
  v_cfg := public.nb_sequence_config(p_doc_type);
  if v_cfg.scope_key <> 'GLOBAL' then
    raise exception 'Pattern validation is only defined for company-wide document types';
  end if;
  return '^'
    || regexp_replace(v_cfg.prefix, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
    || '[0-9]{' || v_cfg.pad_width || ',18}$';
end;
$$;

create or replace function public.nb_document_no_taken(p_doc_type text, p_store_id uuid, p_no text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return case p_doc_type
    when 'company_invoice' then exists (select 1 from public.company_invoices where upper(invoice_no) = upper(p_no))
    when 'company_credit_note' then exists (select 1 from public.company_credit_notes where credit_note_no = p_no)
    when 'company_receipt' then exists (select 1 from public.company_receipts where receipt_no = p_no)
    when 'company_refund' then exists (select 1 from public.company_refunds where refund_no = p_no)
    when 'company_expense' then exists (select 1 from public.expenses where expense_no = p_no)
    when 'store_expense' then exists (select 1 from public.expenses where expense_no = p_no)
    when 'purchase_order' then exists (select 1 from public.purchase_orders where store_id = p_store_id and po_no = p_no)
    when 'purchase_return' then exists (select 1 from public.purchase_returns where store_id = p_store_id and return_no = p_no)
    when 'sales_invoice' then exists (select 1 from public.sales_invoices where store_id = p_store_id and invoice_no = p_no)
    when 'sales_return' then exists (select 1 from public.sales_returns where store_id = p_store_id and return_no = p_no)
    when 'quotation' then exists (select 1 from public.quotations where store_id = p_store_id and quotation_no = p_no)
    when 'store_receipt' then exists (select 1 from public.store_receipts where store_id = p_store_id and receipt_no = p_no)
    when 'store_credit_note' then exists (select 1 from public.store_credit_notes where store_id = p_store_id and credit_note_no = p_no)
    when 'store_refund' then exists (select 1 from public.store_refunds where store_id = p_store_id and refund_no = p_no)
    when 'fro_stock_return' then exists (select 1 from public.stock_returns where store_id = p_store_id and return_no = p_no)
    when 'delivery_challan' then exists (select 1 from public.stock_deliveries where store_id = p_store_id and sd_no = p_no)
    else false
  end;
end;
$$;

create or replace function public.nb_next_document_no(p_doc_type text, p_store_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.document_sequences;
  v_scope text;
  v_value bigint;
  v_no text;
  v_tries integer := 0;
begin
  v_cfg := public.nb_sequence_config(p_doc_type);

  if v_cfg.scope_key = '*' then
    if p_store_id is null then
      raise exception 'Document type % needs a store', p_doc_type;
    end if;
    v_scope := public.nb_store_code(p_store_id);
    insert into public.document_sequences (doc_type, scope_key, prefix, pad_width, allow_manual, last_value)
    values (p_doc_type, v_scope, replace(v_cfg.prefix, '{STORE}', v_scope), v_cfg.pad_width, v_cfg.allow_manual, 0)
    on conflict (doc_type, scope_key) do nothing;
  else
    v_scope := 'GLOBAL';
  end if;

  loop
    update public.document_sequences
       set last_value = last_value + 1
     where doc_type = p_doc_type and scope_key = v_scope
    returning last_value into v_value;

    v_no := public.nb_format_document_no(p_doc_type, p_store_id, v_value);
    exit when not public.nb_document_no_taken(p_doc_type, p_store_id, v_no);

    v_tries := v_tries + 1;
    if v_tries > 1000 then
      raise exception 'Could not allocate a free % number', p_doc_type;
    end if;
  end loop;

  return v_no;
end;
$$;

create or replace function public.nb_peek_document_no(p_doc_type text, p_store_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg public.document_sequences;
  v_scope text;
  v_value bigint;
  v_no text;
  v_tries integer := 0;
begin
  v_cfg := public.nb_sequence_config(p_doc_type);
  v_scope := case when v_cfg.scope_key = '*' then public.nb_store_code(p_store_id) else 'GLOBAL' end;

  select coalesce(max(last_value), 0) into v_value
  from public.document_sequences
  where doc_type = p_doc_type and scope_key = v_scope;

  loop
    v_value := v_value + 1;
    v_no := public.nb_format_document_no(p_doc_type, p_store_id, v_value);
    exit when not public.nb_document_no_taken(p_doc_type, p_store_id, v_no);
    v_tries := v_tries + 1;
    exit when v_tries > 1000;
  end loop;

  return v_no;
end;
$$;

create or replace function public.nb_sync_manual_sequence(p_doc_type text, p_no text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.document_sequences;
  v_value bigint;
begin
  v_cfg := public.nb_sequence_config(p_doc_type);
  if v_cfg.scope_key <> 'GLOBAL' or not v_cfg.allow_manual then
    return;
  end if;
  if upper(p_no) !~ public.nb_document_pattern(p_doc_type) then
    return;
  end if;
  v_value := substr(upper(p_no), length(v_cfg.prefix) + 1)::bigint;
  update public.document_sequences
     set last_value = greatest(last_value, v_value)
   where doc_type = p_doc_type and scope_key = 'GLOBAL';
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock engine
-- ---------------------------------------------------------------------------
create or replace function public.nb_stock_lock(
  p_location text, p_store_id uuid, p_fro_staff_id uuid, p_variant_id uuid, p_batch_id uuid
)
returns void
language sql
as $$
  select pg_advisory_xact_lock(
    hashtextextended(concat_ws('|', 'stock', p_location, p_store_id, p_fro_staff_id, p_variant_id, p_batch_id), 0)
  );
$$;

create or replace function public.nb_stock_balance(
  p_location text, p_store_id uuid, p_fro_staff_id uuid, p_variant_id uuid, p_batch_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(qty_delta), 0)
  from public.stock_movements
  where location = p_location
    and store_id = p_store_id
    and fro_staff_id is not distinct from p_fro_staff_id
    and variant_id = p_variant_id
    and batch_id is not distinct from p_batch_id;
$$;

create or replace function public.nb_store_reserved(
  p_store_id uuid, p_variant_id uuid, p_batch_id uuid, p_exclude_return_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pri.quantity), 0)
  from public.purchase_return_items pri
  join public.purchase_returns pr on pr.id = pri.return_id
  where pr.status = 'pending'
    and pr.store_id = p_store_id
    and pri.variant_id = p_variant_id
    and pri.batch_id is not distinct from p_batch_id
    and pr.id is distinct from p_exclude_return_id;
$$;

create or replace function public.nb_store_available(
  p_store_id uuid, p_variant_id uuid, p_batch_id uuid, p_exclude_return_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.nb_stock_balance('store', p_store_id, null, p_variant_id, p_batch_id)
       - public.nb_store_reserved(p_store_id, p_variant_id, p_batch_id, p_exclude_return_id);
$$;

create or replace function public.nb_post_stock(
  p_location text,
  p_store_id uuid,
  p_fro_staff_id uuid,
  p_variant_id uuid,
  p_batch_id uuid,
  p_qty_delta numeric,
  p_movement_type text,
  p_source_table text,
  p_source_id uuid,
  p_source_line_id uuid,
  p_movement_date date default null,
  p_unit_value numeric default null,
  p_is_reversal boolean default false,
  p_exclude_return_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric;
begin
  perform public.nb_stock_lock(p_location, p_store_id, p_fro_staff_id, p_variant_id, p_batch_id);

  if p_qty_delta < 0 then
    if p_location = 'store' then
      v_available := public.nb_store_available(p_store_id, p_variant_id, p_batch_id, p_exclude_return_id);
    else
      v_available := public.nb_stock_balance(p_location, p_store_id, p_fro_staff_id, p_variant_id, p_batch_id);
    end if;
    if v_available + p_qty_delta < 0 then
      raise exception 'Insufficient % stock for % (batch %): available %, required %',
        p_location,
        (select p.name || ' ' || v.pack_size from public.product_variants v
           join public.products p on p.id = v.product_id where v.id = p_variant_id),
        coalesce((select batch_no from public.product_batches where id = p_batch_id), '-'),
        v_available,
        -p_qty_delta;
    end if;
  end if;

  insert into public.stock_movements (
    movement_date, location, store_id, fro_staff_id, variant_id, batch_id, qty_delta,
    unit_value, movement_type, is_reversal, source_table, source_id, source_line_id
  ) values (
    coalesce(p_movement_date, public.nb_today()), p_location, p_store_id,
    case when p_location = 'fro' then p_fro_staff_id end,
    p_variant_id, p_batch_id, p_qty_delta, p_unit_value, p_movement_type, p_is_reversal,
    p_source_table, p_source_id, p_source_line_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Outstanding
-- ---------------------------------------------------------------------------
create or replace function public.nb_store_outstanding(p_store_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(total_amount) from public.company_invoices where store_id = p_store_id and status = 'final'), 0)
  - coalesce((select sum(amount) from public.company_receipts where store_id = p_store_id and status = 'final'), 0)
  - coalesce((select sum(applied_to_outstanding) from public.company_refunds where store_id = p_store_id and status = 'final'), 0);
$$;

create or replace function public.nb_company_invoice_outstanding(p_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select outstanding from public.company_invoice_outstanding where company_invoice_id = p_invoice_id), 0);
$$;

-- Farmer-level outstanding; walk-in invoices without a farmer are their own party.
create or replace function public.nb_party_outstanding(p_store_id uuid, p_farmer_id uuid, p_sales_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_farmer_id is null and p_sales_invoice_id is null then 0
    else coalesce((
      select sum(outstanding) from public.sales_invoice_outstanding
      where store_id = p_store_id
        and party_key = coalesce(p_farmer_id::text, 'inv:' || p_sales_invoice_id::text)
    ), 0)
  end;
$$;

create or replace function public.nb_sales_invoice_outstanding(p_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select outstanding from public.sales_invoice_outstanding where sales_invoice_id = p_invoice_id), 0);
$$;

-- ---------------------------------------------------------------------------
-- Store outstanding limit (warn / block)
-- ---------------------------------------------------------------------------
create or replace function public.nb_outstanding_limit_check(p_store_id uuid, p_amount numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit numeric;
  v_action text;
  v_current numeric;
  v_projected numeric;
begin
  select outstanding_limit, outstanding_limit_action into v_limit, v_action
  from public.stores where id = p_store_id;
  if not found then
    raise exception 'Unknown store %', p_store_id;
  end if;
  v_current := public.nb_store_outstanding(p_store_id);
  v_projected := v_current + coalesce(p_amount, 0);
  return jsonb_build_object(
    'store_id', p_store_id,
    'current_outstanding', v_current,
    'amount', coalesce(p_amount, 0),
    'projected_outstanding', v_projected,
    'outstanding_limit', v_limit,
    'action', v_action,
    'exceeded', (v_limit is not null and v_projected > v_limit)
  );
end;
$$;

-- Raises when the store is set to 'block'; returns the warning payload for 'warn'; null otherwise.
create or replace function public.nb_enforce_outstanding_limit(p_store_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb;
begin
  perform 1 from public.stores where id = p_store_id for update;
  v_check := public.nb_outstanding_limit_check(p_store_id, p_amount);
  if (v_check ->> 'exceeded')::boolean then
    if v_check ->> 'action' = 'block' then
      raise exception 'Outstanding limit exceeded: projected outstanding % is above the limit % for this store',
        v_check ->> 'projected_outstanding', v_check ->> 'outstanding_limit'
        using errcode = 'P0001';
    end if;
    return v_check;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Line handling
-- ---------------------------------------------------------------------------
create type public.nb_line_input as (
  variant_id uuid,
  batch_id uuid,
  batch_no text,
  expiry_date date,
  manufacture_date date,
  quantity numeric,
  unit_price numeric,
  discount_percent numeric,
  discount_amount numeric,
  taxable_amount numeric,
  tax_percent numeric,
  sgst_amount numeric,
  cgst_amount numeric,
  igst_amount numeric,
  tax_amount numeric,
  line_total numeric,
  reason text,
  line_type text,
  source_item_id uuid,
  product_name text,
  unit_value numeric
);

create type public.nb_variant_snapshot as (
  product_name text,
  pack_size text,
  hsn_code text,
  unit text,
  tax_type text,
  tax_percent numeric
);

create or replace function public.nb_variant_info(p_variant_id uuid)
returns public.nb_variant_snapshot
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_info public.nb_variant_snapshot;
begin
  select p.name, v.pack_size, p.hsn_code, p.unit, p.tax_type, p.tax_percent
    into v_info.product_name, v_info.pack_size, v_info.hsn_code, v_info.unit, v_info.tax_type, v_info.tax_percent
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id;
  if not found then
    raise exception 'Unknown product variant %', p_variant_id;
  end if;
  return v_info;
end;
$$;

create or replace function public.nb_parse_lines(p_lines jsonb)
returns setof public.nb_line_input
language plpgsql
stable
as $$
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one line is required';
  end if;
  return query select * from jsonb_populate_recordset(null::public.nb_line_input, p_lines);
end;
$$;

-- Fills missing amounts from quantity/price/tax and validates consistency.
create or replace function public.nb_normalize_line(p_line public.nb_line_input, p_variant_required boolean default true)
returns public.nb_line_input
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.nb_line_input := p_line;
  v_info public.nb_variant_snapshot;
  v_gross numeric;
begin
  if r.variant_id is not null then
    v_info := public.nb_variant_info(r.variant_id);
  elsif p_variant_required then
    raise exception 'Each line needs a product variant';
  end if;

  r.quantity := coalesce(r.quantity, case when p_variant_required then null else 1 end);
  if r.quantity is null or r.quantity < 0 or (p_variant_required and r.quantity = 0) then
    raise exception 'Line quantity must be greater than zero';
  end if;

  r.unit_price := round(coalesce(r.unit_price, 0), 2);
  r.discount_percent := coalesce(r.discount_percent, 0);
  v_gross := round(r.quantity * r.unit_price, 2);
  r.discount_amount := round(coalesce(r.discount_amount, v_gross * r.discount_percent / 100), 2);
  r.taxable_amount := round(coalesce(r.taxable_amount, v_gross - r.discount_amount), 2);
  r.tax_percent := coalesce(r.tax_percent, v_info.tax_percent, 0);

  if r.tax_amount is null then
    if r.sgst_amount is not null or r.cgst_amount is not null or r.igst_amount is not null then
      r.tax_amount := coalesce(r.sgst_amount, 0) + coalesce(r.cgst_amount, 0) + coalesce(r.igst_amount, 0);
    else
      r.tax_amount := round(r.taxable_amount * r.tax_percent / 100, 2);
    end if;
  end if;
  r.tax_amount := round(r.tax_amount, 2);

  if r.sgst_amount is null and r.cgst_amount is null and r.igst_amount is null then
    if coalesce(v_info.tax_type, 'intrastate') = 'interstate' then
      r.igst_amount := r.tax_amount;
      r.sgst_amount := 0;
      r.cgst_amount := 0;
    else
      r.sgst_amount := round(r.tax_amount / 2, 2);
      r.cgst_amount := r.tax_amount - r.sgst_amount;
      r.igst_amount := 0;
    end if;
  else
    r.sgst_amount := round(coalesce(r.sgst_amount, 0), 2);
    r.cgst_amount := round(coalesce(r.cgst_amount, 0), 2);
    r.igst_amount := round(coalesce(r.igst_amount, 0), 2);
  end if;

  r.line_total := round(coalesce(r.line_total, r.taxable_amount + r.tax_amount), 2);

  if r.unit_price < 0 or r.discount_amount < 0 or r.taxable_amount < 0 or r.tax_amount < 0
     or r.sgst_amount < 0 or r.cgst_amount < 0 or r.igst_amount < 0 or r.line_total < 0 then
    raise exception 'Line amounts cannot be negative';
  end if;
  if r.discount_percent < 0 or r.discount_percent > 100 or r.tax_percent < 0 or r.tax_percent > 100 then
    raise exception 'Line percentages must be between 0 and 100';
  end if;
  if abs(r.line_total - (r.taxable_amount + r.tax_amount)) > 0.05 then
    raise exception 'Line total % does not equal taxable % + tax %', r.line_total, r.taxable_amount, r.tax_amount;
  end if;
  if abs(r.tax_amount - (r.sgst_amount + r.cgst_amount + r.igst_amount)) > 0.05 then
    raise exception 'Line tax % does not equal SGST + CGST + IGST', r.tax_amount;
  end if;

  return r;
end;
$$;

-- Finds (or optionally creates) a batch for a variant.
create or replace function public.nb_resolve_batch(
  p_variant_id uuid,
  p_batch_id uuid,
  p_batch_no text,
  p_expiry_date date,
  p_manufacture_date date,
  p_create boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_no text := nullif(upper(trim(coalesce(p_batch_no, ''))), '');
begin
  if p_batch_id is not null then
    select id into v_id from public.product_batches where id = p_batch_id and variant_id = p_variant_id;
    if v_id is null then
      raise exception 'Batch % does not belong to this product variant', p_batch_id;
    end if;
    return v_id;
  end if;

  if v_no is null then
    return null;
  end if;

  select id into v_id from public.product_batches where variant_id = p_variant_id and batch_no = v_no;

  if v_id is null and p_create then
    insert into public.product_batches (variant_id, batch_no, expiry_date, manufacture_date)
    values (p_variant_id, v_no, p_expiry_date, p_manufacture_date)
    on conflict (variant_id, batch_no) do nothing;
    select id into v_id from public.product_batches where variant_id = p_variant_id and batch_no = v_no;
  end if;

  if v_id is null then
    raise exception 'Unknown batch % for this product variant', v_no;
  end if;

  if p_create then
    update public.product_batches
       set expiry_date = coalesce(expiry_date, p_expiry_date),
           manufacture_date = coalesce(manufacture_date, p_manufacture_date)
     where id = v_id and (expiry_date is null or manufacture_date is null);
  end if;

  return v_id;
end;
$$;

-- Recomputes document totals from its lines: total = sum(line_total) + round_off.
create or replace function public.nb_apply_totals(
  p_header_table text,
  p_items_table text,
  p_fk_column text,
  p_id uuid,
  p_round_off numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
begin
  if abs(coalesce(p_round_off, 0)) > 1 then
    raise exception 'Round-off must be between -1 and 1';
  end if;
  execute format(
    'update public.%I h set
        before_discount = coalesce(t.before_discount, 0),
        discount_amount = coalesce(t.discount_amount, 0),
        taxable_amount  = coalesce(t.taxable_amount, 0),
        sgst_amount     = coalesce(t.sgst_amount, 0),
        cgst_amount     = coalesce(t.cgst_amount, 0),
        igst_amount     = coalesce(t.igst_amount, 0),
        round_off       = $2,
        total_amount    = coalesce(t.line_total, 0) + $2
      from (
        select sum(round(quantity * unit_price, 2)) as before_discount,
               sum(discount_amount) as discount_amount,
               sum(taxable_amount) as taxable_amount,
               sum(sgst_amount) as sgst_amount,
               sum(cgst_amount) as cgst_amount,
               sum(igst_amount) as igst_amount,
               sum(line_total) as line_total
        from public.%I where %I = $1
      ) t
      where h.id = $1
      returning h.total_amount',
    p_header_table, p_items_table, p_fk_column
  ) into v_total using p_id, round(coalesce(p_round_off, 0), 2);
  return v_total;
end;
$$;
