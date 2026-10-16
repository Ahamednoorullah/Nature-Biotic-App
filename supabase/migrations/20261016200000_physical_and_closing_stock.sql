-- Physical count: batch-aware store stock comparison (no ledger mutation).
-- Closing stock: monthly store-only snapshots from the stock ledger.
-- No pg_cron is installed; finalize is an idempotent Store Admin RPC.

alter table public.physical_stock_count_lines
  add column if not exists batch_id uuid references public.product_batches (id) on delete restrict,
  add column if not exists batch_no text,
  add column if not exists expiry_date date,
  add column if not exists system_value numeric(14,2) not null default 0;

create unique index if not exists physical_stock_count_lines_unique_variant_batch
  on public.physical_stock_count_lines (
    count_id,
    variant_id,
    coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create or replace function public.nb_store_stock_as_of(
  p_store_id uuid,
  p_variant_id uuid,
  p_batch_id uuid,
  p_as_of date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(qty_delta), 0)
  from public.stock_movements
  where location = 'store'
    and store_id = p_store_id
    and variant_id = p_variant_id
    and batch_id is not distinct from p_batch_id
    and movement_date <= p_as_of;
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
  v_batch uuid;
  v_qty numeric;
  v_price numeric;
  v_system numeric;
  v_info public.nb_variant_snapshot;
  v_batch_no text;
  v_expiry date;
  v_no smallint := 0;
  v_total_qty numeric := 0;
  v_total_value numeric := 0;
  v_system_qty numeric := 0;
  v_system_value numeric := 0;
  v_match boolean := true;
  v_date date := coalesce(p_count_date, public.nb_today());
  v_seen text[] := array[]::text[];
  v_key text;
begin
  perform public.nb_require_store_admin(p_store_id);
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one line is required';
  end if;

  insert into public.physical_stock_counts (store_id, count_date, remarks)
  values (p_store_id, v_date, p_remarks)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_variant := coalesce(
      nullif(v_line ->> 'variant_id', '')::uuid,
      nullif(v_line ->> 'product_id', '')::uuid
    );
    if v_variant is null then
      raise exception 'Each physical count line needs a product variant';
    end if;
    v_batch := nullif(v_line ->> 'batch_id', '')::uuid;
    v_qty := coalesce(
      nullif(v_line ->> 'qty', '')::numeric,
      nullif(v_line ->> 'counted_quantity', '')::numeric,
      0
    );
    if v_qty < 0 then
      raise exception 'Counted quantity cannot be negative';
    end if;
    v_key := v_variant::text || '|' || coalesce(v_batch::text, '');
    if v_key = any (v_seen) then
      raise exception 'Duplicate product / package / batch on the same physical count';
    end if;
    v_seen := array_append(v_seen, v_key);

    v_info := public.nb_variant_info(v_variant);
    v_price := coalesce(
      nullif(v_line ->> 'unit_price', '')::numeric,
      (select selling_price from public.product_variants where id = v_variant),
      0
    );
    v_batch_no := null;
    v_expiry := null;
    if v_batch is not null then
      select batch_no, expiry_date into v_batch_no, v_expiry
        from public.product_batches
       where id = v_batch and variant_id = v_variant;
      if not found then
        raise exception 'Batch does not belong to the selected product variant';
      end if;
    end if;

    v_system := public.nb_store_stock_as_of(p_store_id, v_variant, v_batch, v_date);
    v_no := v_no + 1;
    insert into public.physical_stock_count_lines (
      count_id, line_no, variant_id, batch_id, product_name, pack_size, batch_no,
      expiry_date, qty, unit_price, system_qty, system_value
    ) values (
      v_id, v_no, v_variant, v_batch, v_info.product_name, v_info.pack_size, v_batch_no,
      v_expiry, v_qty, round(v_price, 2), v_system, round(v_system * v_price, 2)
    );
    v_total_qty := v_total_qty + v_qty;
    v_total_value := v_total_value + v_qty * v_price;
    v_system_qty := v_system_qty + v_system;
    v_system_value := v_system_value + v_system * v_price;
    if v_qty <> v_system then
      v_match := false;
    end if;
  end loop;

  update public.physical_stock_counts
     set total_qty = v_total_qty,
         total_value = round(v_total_value, 2),
         system_qty = v_system_qty,
         system_value = round(v_system_value, 2),
         is_match = v_match
   where id = v_id;

  return jsonb_build_object(
    'id', v_id,
    'is_match', v_match,
    'total_qty', v_total_qty,
    'total_value', round(v_total_value, 2),
    'system_qty', v_system_qty,
    'system_value', round(v_system_value, 2)
  );
end;
$$;

create table if not exists public.store_closing_stocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  closing_date date not null,
  year_month text not null,
  total_qty numeric(14,3) not null default 0,
  total_value numeric(14,2) not null default 0,
  source text not null default 'stock_ledger'
    check (source = 'stock_ledger'),
  status text not null default 'finalized'
    check (status = 'finalized'),
  finalized_at timestamptz not null default now(),
  finalized_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, closing_date),
  unique (store_id, year_month)
);

create table if not exists public.store_closing_stock_lines (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.store_closing_stocks (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  batch_no text,
  expiry_date date,
  qty numeric(14,3) not null check (qty >= 0),
  unit_value numeric(14,2) not null default 0 check (unit_value >= 0),
  line_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (closing_id, line_no)
);

create index if not exists store_closing_stocks_store_idx
  on public.store_closing_stocks (store_id, closing_date desc);
create index if not exists store_closing_stock_lines_closing_idx
  on public.store_closing_stock_lines (closing_id);

alter table public.store_closing_stocks enable row level security;
alter table public.store_closing_stock_lines enable row level security;

revoke all on public.store_closing_stocks from public, anon, authenticated;
revoke all on public.store_closing_stock_lines from public, anon, authenticated;
grant select on public.store_closing_stocks to authenticated;
grant select on public.store_closing_stock_lines to authenticated;

drop policy if exists store_closing_stocks_select on public.store_closing_stocks;
create policy store_closing_stocks_select on public.store_closing_stocks
  for select to authenticated using (public.can_read_store(store_id));

drop policy if exists store_closing_stock_lines_select on public.store_closing_stock_lines;
create policy store_closing_stock_lines_select on public.store_closing_stock_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.store_closing_stocks c
      where c.id = closing_id and public.can_read_store(c.store_id)
    )
  );

create or replace function public.nb_month_end_date(p_year int, p_month int)
returns date
language sql
immutable
as $$
  select (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date;
$$;

create or replace function public.finalize_store_month_closing(
  p_store_id uuid,
  p_year int default null,
  p_month int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.nb_today();
  v_year int;
  v_month int;
  v_closing date;
  v_ym text;
  v_existing public.store_closing_stocks%rowtype;
  v_id uuid;
  v_line smallint := 0;
  v_total_qty numeric := 0;
  v_total_value numeric := 0;
  r record;
begin
  perform public.nb_require_store_admin(p_store_id);

  if p_year is null or p_month is null then
    -- Latest fully completed calendar month in Asia/Kolkata.
    v_closing := (date_trunc('month', v_today::timestamp) - interval '1 day')::date;
    v_year := extract(year from v_closing)::int;
    v_month := extract(month from v_closing)::int;
  else
    if p_month < 1 or p_month > 12 then
      raise exception 'Month must be between 1 and 12';
    end if;
    v_year := p_year;
    v_month := p_month;
    v_closing := public.nb_month_end_date(v_year, v_month);
  end if;

  v_ym := to_char(v_closing, 'YYYY-MM');

  if v_closing >= v_today then
    raise exception 'Cannot finalize closing stock for the current or a future month (%)', v_ym;
  end if;

  select * into v_existing
    from public.store_closing_stocks
   where store_id = p_store_id and closing_date = v_closing;
  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'closing_date', v_existing.closing_date,
      'year_month', v_existing.year_month,
      'total_qty', v_existing.total_qty,
      'total_value', v_existing.total_value,
      'status', v_existing.status,
      'already_finalized', true
    );
  end if;

  insert into public.store_closing_stocks (
    store_id, closing_date, year_month, source, status, finalized_by
  ) values (
    p_store_id, v_closing, v_ym, 'stock_ledger', 'finalized', auth.uid()
  )
  returning id into v_id;

  for r in
    select
      sm.variant_id,
      sm.batch_id,
      p.name as product_name,
      v.pack_size,
      b.batch_no,
      b.expiry_date,
      sum(sm.qty_delta) as qty,
      coalesce(
        nullif(v.selling_price, 0),
        (
          select sm2.unit_value
          from public.stock_movements sm2
          where sm2.store_id = p_store_id
            and sm2.location = 'store'
            and sm2.variant_id = sm.variant_id
            and sm2.batch_id is not distinct from sm.batch_id
            and sm2.unit_value is not null
            and sm2.movement_date <= v_closing
          order by sm2.movement_date desc, sm2.created_at desc
          limit 1
        ),
        0
      ) as unit_value
    from public.stock_movements sm
    join public.product_variants v on v.id = sm.variant_id
    join public.products p on p.id = v.product_id
    left join public.product_batches b on b.id = sm.batch_id
    where sm.location = 'store'
      and sm.store_id = p_store_id
      and sm.movement_date <= v_closing
    group by sm.variant_id, sm.batch_id, p.name, v.pack_size, b.batch_no, b.expiry_date, v.selling_price
    having sum(sm.qty_delta) <> 0
    order by p.name, v.pack_size, b.batch_no
  loop
    if r.qty < 0 then
      continue; -- defensive; ledger should not leave negative closing lines
    end if;
    v_line := v_line + 1;
    insert into public.store_closing_stock_lines (
      closing_id, line_no, variant_id, batch_id, product_name, pack_size, batch_no,
      expiry_date, qty, unit_value, line_value
    ) values (
      v_id, v_line, r.variant_id, r.batch_id, r.product_name, coalesce(r.pack_size, ''),
      r.batch_no, r.expiry_date, r.qty, round(coalesce(r.unit_value, 0), 2),
      round(r.qty * coalesce(r.unit_value, 0), 2)
    );
    v_total_qty := v_total_qty + r.qty;
    v_total_value := v_total_value + r.qty * coalesce(r.unit_value, 0);
  end loop;

  update public.store_closing_stocks
     set total_qty = v_total_qty, total_value = round(v_total_value, 2)
   where id = v_id;

  return jsonb_build_object(
    'id', v_id,
    'closing_date', v_closing,
    'year_month', v_ym,
    'total_qty', v_total_qty,
    'total_value', round(v_total_value, 2),
    'status', 'finalized',
    'already_finalized', false
  );
end;
$$;

revoke all on function public.nb_store_stock_as_of(uuid, uuid, uuid, date) from public, anon;
revoke all on function public.finalize_store_month_closing(uuid, int, int) from public, anon;
grant execute on function public.nb_store_stock_as_of(uuid, uuid, uuid, date) to authenticated, service_role;
grant execute on function public.finalize_store_month_closing(uuid, int, int) to authenticated, service_role;
grant execute on function public.record_physical_count(uuid, jsonb, date, text) to authenticated, service_role;
