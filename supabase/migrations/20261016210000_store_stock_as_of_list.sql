-- List Store stock balances as of a calendar date (Asia/Kolkata business dates via movement_date).
-- Store location only — FRO hand stock is excluded. Read-only; does not create closings.

create or replace function public.list_store_stock_as_of(
  p_store_id uuid,
  p_as_of date default null
)
returns table (
  variant_id uuid,
  batch_id uuid,
  product_name text,
  pack_size text,
  batch_no text,
  expiry_date date,
  qty numeric,
  unit_value numeric,
  line_value numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_as_of date := coalesce(p_as_of, public.nb_today());
begin
  if not public.can_read_store(p_store_id) then
    raise exception 'Not allowed to read stock for this store' using errcode = '42501';
  end if;

  return query
  select
    sm.variant_id,
    sm.batch_id,
    p.name::text as product_name,
    coalesce(v.pack_size, '')::text as pack_size,
    b.batch_no::text,
    b.expiry_date,
    sum(sm.qty_delta)::numeric as qty,
    round(coalesce(
      nullif(v.selling_price, 0),
      (
        select sm2.unit_value
        from public.stock_movements sm2
        where sm2.store_id = p_store_id
          and sm2.location = 'store'
          and sm2.variant_id = sm.variant_id
          and sm2.batch_id is not distinct from sm.batch_id
          and sm2.unit_value is not null
          and sm2.movement_date <= v_as_of
        order by sm2.movement_date desc, sm2.created_at desc
        limit 1
      ),
      0
    ), 2)::numeric as unit_value,
    round(
      sum(sm.qty_delta) * coalesce(
        nullif(v.selling_price, 0),
        (
          select sm2.unit_value
          from public.stock_movements sm2
          where sm2.store_id = p_store_id
            and sm2.location = 'store'
            and sm2.variant_id = sm.variant_id
            and sm2.batch_id is not distinct from sm.batch_id
            and sm2.unit_value is not null
            and sm2.movement_date <= v_as_of
          order by sm2.movement_date desc, sm2.created_at desc
          limit 1
        ),
        0
      ),
      2
    )::numeric as line_value
  from public.stock_movements sm
  join public.product_variants v on v.id = sm.variant_id
  join public.products p on p.id = v.product_id
  left join public.product_batches b on b.id = sm.batch_id
  where sm.location = 'store'
    and sm.store_id = p_store_id
    and sm.movement_date <= v_as_of
  group by sm.variant_id, sm.batch_id, p.name, v.pack_size, b.batch_no, b.expiry_date, v.selling_price
  having sum(sm.qty_delta) <> 0
  order by p.name, v.pack_size, b.batch_no;
end;
$$;

revoke all on function public.list_store_stock_as_of(uuid, date) from public, anon;
grant execute on function public.list_store_stock_as_of(uuid, date) to authenticated, service_role;
