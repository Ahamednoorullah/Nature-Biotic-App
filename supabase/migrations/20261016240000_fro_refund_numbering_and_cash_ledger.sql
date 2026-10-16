-- FRO cash refund sequential numbering: FRO-REF-0001, FRO-REF-0002, ...
-- Existing refund_no values are preserved. New refunds use document_sequences.

insert into public.document_sequences (doc_type, scope_key, prefix, pad_width, allow_manual)
values ('fro_cash_refund', 'GLOBAL', 'FRO-REF-', 4, false)
on conflict (doc_type, scope_key) do nothing;

-- Start the counter after any already-used FRO-REF-NNNN values (none expected yet).
do $$
declare
  v_max bigint := 0;
begin
  select coalesce(max(
    nullif(regexp_replace(refund_no, '^FRO-REF-', '', 'i'), '')::bigint
  ), 0)
    into v_max
    from public.fro_cash_refunds
   where refund_no ~* '^FRO-REF-[0-9]+$';

  update public.document_sequences
     set last_value = greatest(last_value, v_max)
   where doc_type = 'fro_cash_refund' and scope_key = 'GLOBAL';
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
    when 'fro_cash_refund' then exists (select 1 from public.fro_cash_refunds where upper(refund_no) = upper(p_no))
    else false
  end;
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
  v_fro uuid := public.auth_staff_id();
  v_store uuid := public.auth_store_id();
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_available numeric;
  v_name text;
  v_no text;
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can record a cash refund to the store' using errcode = '42501';
  end if;
  if v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  perform 1 from public.staff where id = v_fro for update;
  select coalesce(nullif(trim(name), ''), 'FRO') into v_name from public.staff where id = v_fro;

  if p_method = 'cash' then
    v_available := public.nb_fro_cash_available(v_fro);
    if v_amount > v_available then
      raise exception 'Refund amount % exceeds available cash %', v_amount, v_available;
    end if;
  end if;

  v_no := public.nb_next_document_no('fro_cash_refund', null);

  insert into public.fro_cash_refunds (
    store_id, fro_staff_id, settlement_id, refunded_at, amount, method, remarks, status, refund_no
  ) values (
    v_store, v_fro, public.nb_open_settlement_id(v_fro),
    coalesce(p_refunded_at, now()), v_amount, p_method, p_remarks, 'pending', v_no
  )
  returning id into v_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, cash_refund_id)
  values (
    v_store,
    'fro_cash_refund_pending',
    'FRO cash refund awaiting acceptance',
    v_name || ' submitted cash refund ' || v_no || ' of ₹' || to_char(v_amount, 'FM999,999,990.00') || ' awaiting acceptance.',
    v_fro,
    v_id
  )
  on conflict do nothing;

  return v_id;
end;
$$;

revoke all on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz) from public, anon;
grant execute on function public.create_fro_cash_refund(numeric, public.payment_method, text, timestamptz) to authenticated, service_role;
