-- FRO Hand Stock → Stock Returned
-- Pending returns notify the store; accept/reject move stock once (or never) and notify the FRO.

alter table public.stock_returns drop constraint if exists stock_returns_status_check;
alter table public.stock_returns
  add constraint stock_returns_status_check
  check (status = any (array['pending'::text, 'accepted'::text, 'rejected'::text]));

alter table public.stock_returns
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles (id);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'staff_assignment',
    'cash_handover_pending',
    'cash_handover_accepted',
    'company_debit_note',
    'fro_stock_return_pending',
    'fro_stock_return_accepted',
    'fro_stock_return_rejected'
  ));

alter table public.notifications
  add column if not exists stock_return_id uuid references public.stock_returns (id) on delete cascade;

create unique index if not exists notifications_stock_return_event_uidx
  on public.notifications (stock_return_id, kind)
  where stock_return_id is not null;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_company_admin()
    or (
      public.is_store_admin()
      and store_id = public.auth_store_id()
    )
    or (
      public.is_fro()
      and store_id = public.auth_store_id()
      and staff_id = public.auth_staff_id()
      and kind in (
        'cash_handover_accepted',
        'fro_stock_return_accepted',
        'fro_stock_return_rejected'
      )
    )
  );

create or replace function public.nb_insert_stock_return_lines(
  p_return_id uuid,
  p_store_id uuid,
  p_fro uuid,
  p_lines jsonb
)
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
    if r.variant_id is null then
      raise exception
        'Each return line needs a product variant. Reselect the hand-stock product and try again.';
    end if;
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero';
    end if;
    -- Hand-stock returns are pack counts; fractional pack quantities are not allowed.
    if r.quantity <> trunc(r.quantity) then
      raise exception 'Return quantity must be a whole number';
    end if;
    v_info := public.nb_variant_info(r.variant_id);
    v_batch := public.nb_resolve_batch(r.variant_id, r.batch_id, r.batch_no, null, null, false);
    if v_batch is null and r.batch_id is null and nullif(trim(coalesce(r.batch_no, '')), '') is null then
      raise exception
        'Each return line needs a batch. Reselect the hand-stock product and try again.';
    end if;
    if public.nb_stock_balance('fro', p_store_id, p_fro, r.variant_id, v_batch) < r.quantity then
      raise exception 'The FRO does not hold enough stock of % to return', v_info.product_name;
    end if;
    v_batch_no := null;
    v_expiry := null;
    if v_batch is not null then
      select batch_no, expiry_date into v_batch_no, v_expiry
        from public.product_batches where id = v_batch;
    end if;
    v_line := v_line + 1;
    insert into public.stock_return_items (
      return_id, line_no, variant_id, batch_id, product_name, pack_size, batch_no,
      expiry_date, qty, unit_value, reason
    ) values (
      p_return_id, v_line, r.variant_id, v_batch, v_info.product_name, v_info.pack_size,
      v_batch_no, v_expiry, r.quantity, round(coalesce(r.unit_value, r.unit_price, 0), 2), r.reason
    );
  end loop;
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
  v_name text;
begin
  if not public.is_fro() then
    raise exception 'Only an FRO can submit a stock return request' using errcode = '42501';
  end if;
  select coalesce(nullif(trim(name), ''), 'FRO') into v_name from public.staff where id = v_fro;
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

  insert into public.notifications (store_id, kind, title, message, staff_id, stock_return_id)
  values (
    v_store,
    'fro_stock_return_pending',
    'FRO stock return awaiting acceptance',
    v_name || ' submitted stock return ' || v_no || ' awaiting acceptance.',
    v_fro,
    v_id
  )
  on conflict do nothing;

  return jsonb_build_object('id', v_id, 'return_no', v_no, 'status', 'pending');
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
  if not found then
    raise exception 'Stock return % not found', p_return_id;
  end if;
  if v_ret.status = 'accepted' then
    raise exception 'This stock return has already been accepted';
  end if;
  if v_ret.status = 'rejected' then
    raise exception 'This stock return has already been rejected';
  end if;
  if v_ret.status <> 'pending' then
    raise exception 'Only a pending stock return can be accepted';
  end if;

  for v_item in
    select * from public.stock_return_items where return_id = p_return_id order by line_no
  loop
    perform public.nb_post_stock(
      'fro', v_ret.store_id, v_ret.fro_staff_id, v_item.variant_id, v_item.batch_id, -v_item.qty,
      'fro_return_out', 'stock_return_items', p_return_id, v_item.id, public.nb_today(), v_item.unit_value
    );
    perform public.nb_post_stock(
      'store', v_ret.store_id, null, v_item.variant_id, v_item.batch_id, v_item.qty,
      'fro_return_in', 'stock_return_items', p_return_id, v_item.id, public.nb_today(), v_item.unit_value
    );
  end loop;

  update public.stock_returns
     set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   where id = p_return_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, stock_return_id)
  values (
    v_ret.store_id,
    'fro_stock_return_accepted',
    'Stock return accepted',
    'Your stock return ' || v_ret.return_no || ' was accepted by the store.',
    v_ret.fro_staff_id,
    v_ret.id
  )
  on conflict do nothing;
end;
$$;

create or replace function public.reject_stock_return(p_return_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret public.stock_returns%rowtype;
begin
  select * into v_ret from public.stock_returns where id = p_return_id for update;
  if not found then
    raise exception 'Stock return % not found', p_return_id;
  end if;
  perform public.nb_require_store_admin(v_ret.store_id);
  if v_ret.status = 'accepted' then
    raise exception 'This stock return has already been accepted';
  end if;
  if v_ret.status = 'rejected' then
    raise exception 'This stock return has already been rejected';
  end if;
  if v_ret.status <> 'pending' then
    raise exception 'Only a pending stock return can be rejected';
  end if;

  update public.stock_returns
     set status = 'rejected', rejected_at = now(), rejected_by = auth.uid()
   where id = p_return_id;

  insert into public.notifications (store_id, kind, title, message, staff_id, stock_return_id)
  values (
    v_ret.store_id,
    'fro_stock_return_rejected',
    'Stock return rejected',
    'Your stock return ' || v_ret.return_no || ' was rejected by the store.',
    v_ret.fro_staff_id,
    v_ret.id
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.reject_stock_return(uuid) from public, anon;
grant execute on function public.reject_stock_return(uuid) to authenticated, service_role;
