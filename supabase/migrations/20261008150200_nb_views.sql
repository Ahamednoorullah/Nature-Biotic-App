/*
# Nature Biotic ERP/CRM — 03 Derived views

All views use security_invoker = true so the caller's RLS on the underlying
tables applies (no data leaks through views).

Derived-value rules:
- Stock = sum of stock_movements (store and FRO only; no company stock).
- Available store stock = balance - quantities in pending purchase returns.
- Outstanding (store -> company) = final company invoices - final company receipts
  - applied part of final company refunds.
- Outstanding (farmer -> store) = final sales invoices - final store receipts
  - applied part of final store refunds.
- Returns and credit notes never change outstanding directly; only the applied
  part of a refund does. Applied refund amounts are spread across invoices
  oldest-first (FIFO) for invoice-level display.
- "Today" / "this month" use the Asia/Kolkata calendar date.
*/

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------
create view public.store_stock_balances
with (security_invoker = true) as
select
  sm.store_id,
  sm.variant_id,
  sm.batch_id,
  v.product_id,
  p.name as product_name,
  v.pack_size,
  b.batch_no,
  b.expiry_date,
  sum(sm.qty_delta) as quantity
from public.stock_movements sm
join public.product_variants v on v.id = sm.variant_id
join public.products p on p.id = v.product_id
left join public.product_batches b on b.id = sm.batch_id
where sm.location = 'store'
group by sm.store_id, sm.variant_id, sm.batch_id, v.product_id, p.name, v.pack_size, b.batch_no, b.expiry_date;

create view public.store_stock_available
with (security_invoker = true) as
with reserved as (
  select pr.store_id, pri.variant_id, pri.batch_id, sum(pri.quantity) as qty
  from public.purchase_return_items pri
  join public.purchase_returns pr on pr.id = pri.return_id
  where pr.status = 'pending'
  group by pr.store_id, pri.variant_id, pri.batch_id
)
select
  b.store_id,
  b.variant_id,
  b.batch_id,
  b.product_id,
  b.product_name,
  b.pack_size,
  b.batch_no,
  b.expiry_date,
  b.quantity,
  coalesce(r.qty, 0) as reserved_quantity,
  b.quantity - coalesce(r.qty, 0) as available_quantity
from public.store_stock_balances b
left join reserved r
  on r.store_id = b.store_id
 and r.variant_id = b.variant_id
 and r.batch_id is not distinct from b.batch_id;

create view public.fro_stock_balances
with (security_invoker = true) as
select
  sm.store_id,
  sm.fro_staff_id,
  st.name as fro_name,
  sm.variant_id,
  sm.batch_id,
  v.product_id,
  p.name as product_name,
  v.pack_size,
  b.batch_no,
  b.expiry_date,
  sum(sm.qty_delta) as quantity
from public.stock_movements sm
join public.staff st on st.id = sm.fro_staff_id
join public.product_variants v on v.id = sm.variant_id
join public.products p on p.id = v.product_id
left join public.product_batches b on b.id = sm.batch_id
where sm.location = 'fro'
group by sm.store_id, sm.fro_staff_id, st.name, sm.variant_id, sm.batch_id,
         v.product_id, p.name, v.pack_size, b.batch_no, b.expiry_date;

create view public.store_stock_value
with (security_invoker = true) as
select
  b.store_id,
  sum(b.quantity) as total_quantity,
  sum(b.quantity * v.purchase_price) as cost_value,
  sum(b.quantity * v.selling_price) as selling_value
from public.store_stock_balances b
join public.product_variants v on v.id = b.variant_id
group by b.store_id;

-- ---------------------------------------------------------------------------
-- Company <-> store
-- ---------------------------------------------------------------------------
create view public.company_invoice_outstanding
with (security_invoker = true) as
with inv as (
  select
    ci.id,
    ci.store_id,
    ci.invoice_no,
    ci.invoice_date,
    ci.created_at,
    ci.total_amount,
    ci.receipt_status,
    coalesce((
      select sum(r.amount) from public.company_receipts r
      where r.company_invoice_id = ci.id and r.status = 'final'
    ), 0) as received_amount
  from public.company_invoices ci
  where ci.status = 'final'
),
due as (
  select
    inv.*,
    greatest(inv.total_amount - inv.received_amount, 0) as gross_due,
    coalesce(sum(greatest(inv.total_amount - inv.received_amount, 0)) over (
      partition by inv.store_id
      order by inv.invoice_date, inv.created_at, inv.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_due
  from inv
),
ref as (
  select store_id, sum(applied_to_outstanding) as applied
  from public.company_refunds
  where status = 'final'
  group by store_id
)
select
  d.id as company_invoice_id,
  d.store_id,
  d.invoice_no,
  d.invoice_date,
  d.receipt_status,
  d.total_amount,
  d.received_amount,
  least(d.gross_due, greatest(coalesce(ref.applied, 0) - d.prior_due, 0)) as refund_applied,
  d.gross_due - least(d.gross_due, greatest(coalesce(ref.applied, 0) - d.prior_due, 0)) as outstanding
from due d
left join ref on ref.store_id = d.store_id;

create view public.company_store_positions
with (security_invoker = true) as
with totals as (
  select
    s.id as store_id,
    s.code,
    s.name,
    s.outstanding_limit,
    s.outstanding_limit_action,
    coalesce((select sum(ci.total_amount) from public.company_invoices ci
              where ci.store_id = s.id and ci.status = 'final'), 0) as invoiced_total,
    coalesce((select sum(r.amount) from public.company_receipts r
              where r.store_id = s.id and r.status = 'final'), 0) as received_total,
    coalesce((select sum(f.applied_to_outstanding) from public.company_refunds f
              where f.store_id = s.id and f.status = 'final'), 0) as refund_applied_total,
    coalesce((select sum(f.cash_paid) from public.company_refunds f
              where f.store_id = s.id and f.status = 'final'), 0) as refund_cash_total,
    coalesce((select sum(pr.total_amount) from public.purchase_returns pr
              where pr.store_id = s.id and pr.status = 'approved'), 0) as approved_returns_total,
    coalesce((select sum(cn.total_amount) from public.company_credit_notes cn
              where cn.store_id = s.id and cn.status = 'accepted'), 0) as accepted_credit_total
  from public.stores s
)
select
  t.*,
  t.invoiced_total - t.received_total - t.refund_applied_total as outstanding,
  t.outstanding_limit_action as limit_action,
  case when t.outstanding_limit is null then null
       else t.outstanding_limit - (t.invoiced_total - t.received_total - t.refund_applied_total)
  end as available_limit,
  coalesce(t.outstanding_limit is not null
    and (t.invoiced_total - t.received_total - t.refund_applied_total) > t.outstanding_limit, false) as over_limit
from totals t;

create view public.store_purchase_bills
with (security_invoker = true) as
select
  ci.id as company_invoice_id,
  ci.store_id,
  ci.invoice_no,
  ci.invoice_date,
  ci.purchase_order_id,
  ci.total_amount,
  ci.receipt_status,
  ci.received_at,
  coalesce(o.received_amount, 0) as paid_amount,
  coalesce(o.refund_applied, 0) as refund_applied,
  coalesce(o.outstanding, 0) as outstanding
from public.company_invoices ci
left join public.company_invoice_outstanding o on o.company_invoice_id = ci.id
where ci.status = 'final';

create view public.store_payments
with (security_invoker = true) as
select
  'receipt'::text as entry_type,
  r.id,
  r.store_id,
  r.receipt_no as document_no,
  r.receipt_date as entry_date,
  r.amount,
  r.amount as applied_to_outstanding,
  0::numeric(14,2) as cash_paid,
  r.method,
  r.company_invoice_id,
  null::uuid as company_credit_note_id,
  r.status
from public.company_receipts r
union all
select
  'refund'::text,
  f.id,
  f.store_id,
  f.refund_no,
  f.refund_date,
  f.refund_amount,
  f.applied_to_outstanding,
  f.cash_paid,
  f.method,
  null::uuid,
  f.company_credit_note_id,
  f.status
from public.company_refunds f;

create view public.company_approval_queue
with (security_invoker = true) as
select
  'purchase_order'::text as doc_type,
  po.id,
  po.store_id,
  s.name as store_name,
  po.po_no as document_no,
  po.po_date as document_date,
  po.total_amount,
  po.created_at
from public.purchase_orders po
join public.stores s on s.id = po.store_id
where po.status = 'pending'
union all
select
  'purchase_return'::text,
  pr.id,
  pr.store_id,
  s.name,
  pr.return_no,
  pr.return_date,
  pr.total_amount,
  pr.created_at
from public.purchase_returns pr
join public.stores s on s.id = pr.store_id
where pr.status = 'pending';

create view public.purchase_return_credit_status
with (security_invoker = true) as
select
  pr.id as purchase_return_id,
  pr.store_id,
  pr.return_no,
  pr.status,
  pr.total_amount,
  coalesce(c.credited_amount, 0) as credited_amount,
  case when pr.status = 'approved' then pr.total_amount - coalesce(c.credited_amount, 0) else 0 end as remaining_creditable
from public.purchase_returns pr
left join (
  select pri.return_id, sum(cni.line_total) as credited_amount
  from public.company_credit_note_items cni
  join public.company_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
  join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
  group by pri.return_id
) c on c.return_id = pr.id;

create view public.company_sales_returns
with (security_invoker = true) as
select
  pr.id,
  pr.store_id,
  s.code as store_code,
  s.name as store_name,
  pr.return_no,
  pr.return_date,
  pr.company_invoice_id,
  ci.invoice_no,
  pr.reason,
  pr.total_amount,
  pr.status,
  pr.decided_at,
  cs.credited_amount,
  cs.remaining_creditable
from public.purchase_returns pr
join public.stores s on s.id = pr.store_id
join public.company_invoices ci on ci.id = pr.company_invoice_id
left join public.purchase_return_credit_status cs on cs.purchase_return_id = pr.id;

-- ---------------------------------------------------------------------------
-- Credit notes / debit notes
-- ---------------------------------------------------------------------------
create view public.company_credit_note_balances
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
  case when cn.status = 'accepted' then cn.total_amount - coalesce(f.refunded_total, 0) else 0 end as remaining_refundable,
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

create view public.store_debit_notes
with (security_invoker = true) as
select
  cn.id,
  cn.store_id,
  cn.credit_note_no as debit_note_no,
  cn.credit_note_date as debit_note_date,
  cn.period_from,
  cn.period_to,
  cn.reason,
  cn.status,
  cn.issued_at,
  cn.accepted_at,
  b.credit_total,
  b.refunded_total,
  b.applied_total,
  b.cash_paid_total,
  b.remaining_refundable,
  b.refund_state
from public.company_credit_notes cn
join public.company_credit_note_balances b on b.company_credit_note_id = cn.id
where cn.status in ('issued', 'accepted');

-- ---------------------------------------------------------------------------
-- Store sales
-- ---------------------------------------------------------------------------
create view public.sales_invoice_outstanding
with (security_invoker = true) as
with inv as (
  select
    si.id,
    si.store_id,
    si.invoice_no,
    si.invoice_date,
    si.created_at,
    si.farmer_id,
    si.party_name,
    si.channel,
    si.fro_staff_id,
    si.total_amount,
    coalesce(si.farmer_id::text, 'inv:' || si.id::text) as party_key,
    coalesce((
      select sum(r.amount) from public.store_receipts r
      where r.sales_invoice_id = si.id and r.status = 'final'
    ), 0) as received_amount
  from public.sales_invoices si
  where si.status = 'final'
),
due as (
  select
    inv.*,
    greatest(inv.total_amount - inv.received_amount, 0) as gross_due,
    coalesce(sum(greatest(inv.total_amount - inv.received_amount, 0)) over (
      partition by inv.store_id, inv.party_key
      order by inv.invoice_date, inv.created_at, inv.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_due
  from inv
),
ref as (
  select
    store_id,
    coalesce(farmer_id::text, 'inv:' || sales_invoice_id::text) as party_key,
    sum(applied_to_outstanding) as applied
  from public.store_refunds
  where status = 'final'
  group by store_id, coalesce(farmer_id::text, 'inv:' || sales_invoice_id::text)
)
select
  d.id as sales_invoice_id,
  d.store_id,
  d.invoice_no,
  d.invoice_date,
  d.farmer_id,
  d.party_name,
  d.party_key,
  d.channel,
  d.fro_staff_id,
  d.total_amount,
  d.received_amount,
  least(d.gross_due, greatest(coalesce(ref.applied, 0) - d.prior_due, 0)) as refund_applied,
  d.gross_due - least(d.gross_due, greatest(coalesce(ref.applied, 0) - d.prior_due, 0)) as outstanding
from due d
left join ref on ref.store_id = d.store_id and ref.party_key = d.party_key;

create view public.farmer_accounts
with (security_invoker = true) as
select
  f.id as farmer_id,
  f.store_id,
  f.name,
  f.phone,
  f.village,
  f.fro_staff_id,
  coalesce(i.invoiced_total, 0) as invoiced_total,
  coalesce(r.approved_returns_total, 0) as approved_returns_total,
  coalesce(i.invoiced_total, 0) - coalesce(r.approved_returns_total, 0) as net_purchases,
  coalesce(o.received_total, 0) as received_total,
  coalesce(o.refund_applied_total, 0) as refund_applied_total,
  coalesce(o.outstanding, 0) as outstanding,
  i.last_invoice_date
from public.farmers f
left join (
  select farmer_id, sum(total_amount) as invoiced_total, max(invoice_date) as last_invoice_date
  from public.sales_invoices
  where status = 'final' and farmer_id is not null
  group by farmer_id
) i on i.farmer_id = f.id
left join (
  select farmer_id, sum(total_amount) as approved_returns_total
  from public.sales_returns
  where status = 'approved' and farmer_id is not null
  group by farmer_id
) r on r.farmer_id = f.id
left join (
  select farmer_id,
         sum(received_amount) as received_total,
         sum(refund_applied) as refund_applied_total,
         sum(outstanding) as outstanding
  from public.sales_invoice_outstanding
  where farmer_id is not null
  group by farmer_id
) o on o.farmer_id = f.id;

create view public.sales_return_balances
with (security_invoker = true) as
select
  sr.id as sales_return_id,
  sr.store_id,
  sr.return_no,
  sr.status,
  sr.farmer_id,
  sr.sales_invoice_id,
  sr.channel,
  sr.fro_staff_id,
  sr.total_amount as return_total,
  coalesce(d.direct_refunded, 0) as direct_refunded,
  coalesce(c.credited_via_cn, 0) as credited_via_cn,
  case when sr.status = 'approved'
       then sr.total_amount - coalesce(d.direct_refunded, 0) - coalesce(c.credited_via_cn, 0)
       else 0 end as remaining_refundable
from public.sales_returns sr
left join (
  select sales_return_id, sum(refund_amount) as direct_refunded
  from public.store_refunds
  where status = 'final' and sales_return_id is not null
  group by sales_return_id
) d on d.sales_return_id = sr.id
left join (
  select sri.return_id, sum(cni.line_total) as credited_via_cn
  from public.store_credit_note_items cni
  join public.store_credit_notes cn on cn.id = cni.credit_note_id and cn.status <> 'cancelled'
  join public.sales_return_items sri on sri.id = cni.sales_return_item_id
  group by sri.return_id
) c on c.return_id = sr.id;

create view public.store_credit_note_balances
with (security_invoker = true) as
select
  cn.id as store_credit_note_id,
  cn.store_id,
  cn.credit_note_no,
  cn.credit_note_date,
  cn.status,
  cn.farmer_id,
  cn.fro_staff_id,
  cn.total_amount as credit_total,
  coalesce(f.refunded_total, 0) as refunded_total,
  coalesce(f.applied_total, 0) as applied_total,
  coalesce(f.cash_paid_total, 0) as cash_paid_total,
  case when cn.status = 'issued' then cn.total_amount - coalesce(f.refunded_total, 0) else 0 end as remaining_refundable,
  case
    when coalesce(f.refunded_total, 0) = 0 then 'not_refunded'
    when coalesce(f.refunded_total, 0) < cn.total_amount then 'partially_refunded'
    else 'fully_refunded'
  end as refund_state
from public.store_credit_notes cn
left join (
  select store_credit_note_id,
         sum(refund_amount) as refunded_total,
         sum(applied_to_outstanding) as applied_total,
         sum(cash_paid) as cash_paid_total
  from public.store_refunds
  where status = 'final' and store_credit_note_id is not null
  group by store_credit_note_id
) f on f.store_credit_note_id = cn.id;

create view public.quotation_conversion_status
with (security_invoker = true) as
select
  q.id as quotation_id,
  q.store_id,
  q.quotation_no,
  q.quotation_date,
  q.status,
  q.farmer_id,
  q.farmer_name,
  q.fro_staff_id,
  q.total_amount,
  q.converted_invoice_id,
  si.invoice_no as converted_invoice_no,
  q.converted_at
from public.quotations q
left join public.sales_invoices si on si.id = q.converted_invoice_id;

-- ---------------------------------------------------------------------------
-- FRO
-- ---------------------------------------------------------------------------
create view public.fro_cash_position
with (security_invoker = true) as
select
  st.id as fro_staff_id,
  st.store_id,
  st.name as fro_name,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id and r.method = 'cash' and r.status = 'final'), 0) as cash_receipts,
  coalesce((select sum(a.amount) from public.fro_cash_advances a
            where a.fro_staff_id = st.id and a.status = 'accepted'), 0) as advances_accepted,
  coalesce((select sum(h.amount) from public.cash_handovers h
            where h.fro_staff_id = st.id and h.status = 'accepted'), 0) as handovers_accepted,
  coalesce((select sum(e.amount) from public.expenses e
            where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0) as cash_expenses,
  coalesce((select sum(c.amount) from public.fro_cash_refunds c
            where c.fro_staff_id = st.id), 0) as cash_refunds,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.fro_staff_id = st.id and r.method = 'cash' and r.status = 'final'), 0)
  + coalesce((select sum(a.amount) from public.fro_cash_advances a
              where a.fro_staff_id = st.id and a.status = 'accepted'), 0)
  - coalesce((select sum(h.amount) from public.cash_handovers h
              where h.fro_staff_id = st.id and h.status = 'accepted'), 0)
  - coalesce((select sum(e.amount) from public.expenses e
              where e.fro_staff_id = st.id and e.scope = 'fro' and e.method = 'cash' and e.status = 'accepted'), 0)
  - coalesce((select sum(c.amount) from public.fro_cash_refunds c
              where c.fro_staff_id = st.id), 0) as cash_in_hand
from public.staff st
where public.nb_is_fro_designation(st.designation);

create view public.fro_target_progress
with (security_invoker = true) as
with period as (
  select date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date as month_start
)
select
  st.id as fro_staff_id,
  st.store_id,
  st.name as fro_name,
  p.month_start,
  st.target_sales,
  st.target_farmers,
  st.target_farms,
  st.target_visits,
  coalesce((select sum(si.total_amount) from public.sales_invoices si
            where si.fro_staff_id = st.id and si.status = 'final' and si.invoice_date >= p.month_start), 0)
  - coalesce((select sum(sr.total_amount) from public.sales_returns sr
              where sr.fro_staff_id = st.id and sr.status = 'approved' and sr.return_date >= p.month_start), 0) as sales_achieved,
  (select count(*) from public.farmers f
    where f.fro_staff_id = st.id and f.joined_date >= p.month_start) as farmers_added,
  (select count(*) from public.farmer_farms ff
    join public.farmers f on f.id = ff.farmer_id
    where f.fro_staff_id = st.id and (ff.created_at at time zone 'Asia/Kolkata')::date >= p.month_start) as farms_added,
  (select count(*) from public.fro_visits v
    where v.fro_staff_id = st.id and v.visit_date >= p.month_start) as visits_done
from public.staff st
cross join period p
where public.nb_is_fro_designation(st.designation);

create view public.store_approval_queue
with (security_invoker = true) as
select
  'sales_return'::text as item_type,
  sr.id,
  sr.store_id,
  sr.return_no as document_no,
  sr.return_date as document_date,
  sr.total_amount as amount,
  sr.fro_staff_id,
  sr.created_at
from public.sales_returns sr
where sr.status = 'pending'
union all
select
  'fro_stock_return'::text,
  r.id,
  r.store_id,
  r.return_no,
  r.return_date,
  null::numeric,
  r.fro_staff_id,
  r.created_at
from public.stock_returns r
where r.status = 'pending'
union all
select
  'cash_handover'::text,
  h.id,
  h.store_id,
  null::text,
  h.handover_date,
  h.amount,
  h.fro_staff_id,
  h.created_at
from public.cash_handovers h
where h.status = 'pending';

-- ---------------------------------------------------------------------------
-- Dashboards
-- ---------------------------------------------------------------------------
create view public.store_dashboard_metrics
with (security_invoker = true) as
with d as (
  select
    (now() at time zone 'Asia/Kolkata')::date as today,
    date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date as month_start
)
select
  s.id as store_id,
  s.code,
  s.name,
  coalesce((select sum(si.total_amount) from public.sales_invoices si
            where si.store_id = s.id and si.status = 'final' and si.invoice_date = d.today), 0) as today_sales,
  coalesce((select sum(si.total_amount) from public.sales_invoices si
            where si.store_id = s.id and si.status = 'final' and si.invoice_date >= d.month_start), 0) as month_sales,
  coalesce((select sum(sr.total_amount) from public.sales_returns sr
            where sr.store_id = s.id and sr.status = 'approved' and sr.return_date >= d.month_start), 0) as month_returns,
  coalesce((select sum(r.amount) from public.store_receipts r
            where r.store_id = s.id and r.status = 'final' and r.receipt_date >= d.month_start), 0) as month_collections,
  (select count(*) from public.farmers f where f.store_id = s.id and f.status = 'active') as active_farmers,
  coalesce((select sum(o.outstanding) from public.sales_invoice_outstanding o where o.store_id = s.id), 0) as farmer_outstanding,
  coalesce((select p.outstanding from public.company_store_positions p where p.store_id = s.id), 0) as payable_to_company,
  coalesce((select v.cost_value from public.store_stock_value v where v.store_id = s.id), 0) as stock_cost_value,
  (select count(*) from public.sales_returns sr where sr.store_id = s.id and sr.status = 'pending') as pending_sales_returns,
  (select count(*) from public.stock_returns r where r.store_id = s.id and r.status = 'pending') as pending_fro_returns,
  (select count(*) from public.cash_handovers h where h.store_id = s.id and h.status = 'pending') as pending_handovers,
  (select count(*) from public.company_credit_notes cn where cn.store_id = s.id and cn.status = 'issued') as debit_notes_to_accept,
  (select count(*) from public.company_invoices ci
    where ci.store_id = s.id and ci.status = 'final' and ci.receipt_status = 'dispatched') as invoices_to_receive
from public.stores s
cross join d;

create view public.company_dashboard_metrics
with (security_invoker = true) as
with d as (
  select date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date as month_start
)
select
  (select count(*) from public.stores where status = 'active') as active_stores,
  coalesce((select sum(ci.total_amount) from public.company_invoices ci
            where ci.status = 'final' and ci.invoice_date >= d.month_start), 0) as month_invoiced,
  coalesce((select sum(r.amount) from public.company_receipts r
            where r.status = 'final' and r.receipt_date >= d.month_start), 0) as month_received,
  coalesce((select sum(p.outstanding) from public.company_store_positions p), 0) as total_store_outstanding,
  (select count(*) from public.company_store_positions p where p.over_limit) as stores_over_limit,
  (select count(*) from public.purchase_orders where status = 'pending') as pending_purchase_orders,
  (select count(*) from public.purchase_returns where status = 'pending') as pending_sales_returns,
  (select count(*) from public.company_credit_notes where status = 'issued') as credit_notes_awaiting_acceptance,
  coalesce((select sum(b.remaining_refundable) from public.company_credit_note_balances b), 0) as refundable_credit_open
from d;

-- Anonymous users get nothing from the views either.
do $$
declare
  v record;
begin
  for v in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('revoke all on public.%I from anon', v.relname);
  end loop;
end;
$$;
