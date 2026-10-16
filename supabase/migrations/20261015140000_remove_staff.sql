/*
# Company-admin staff removal

Staff with business history are deactivated and their login is disabled.
Staff with no history can be deleted, including an exclusive login and photo.
Store admins cannot delete staff directly.
*/

drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff
  for delete to authenticated
  using (public.is_company_admin());

create or replace function public.staff_has_business_history(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.farmers where fro_staff_id = p_staff_id)
    or exists (select 1 from public.stock_movements where fro_staff_id = p_staff_id)
    or exists (select 1 from public.quotations where fro_staff_id = p_staff_id)
    or exists (select 1 from public.sales_invoices where fro_staff_id = p_staff_id)
    or exists (select 1 from public.sales_returns where fro_staff_id = p_staff_id)
    or exists (select 1 from public.store_credit_notes where fro_staff_id = p_staff_id)
    or exists (select 1 from public.store_receipts where fro_staff_id = p_staff_id)
    or exists (select 1 from public.store_refunds where fro_staff_id = p_staff_id)
    or exists (select 1 from public.stock_deliveries where fro_staff_id = p_staff_id)
    or exists (select 1 from public.stock_returns where fro_staff_id = p_staff_id)
    or exists (select 1 from public.staff_attendance where staff_id = p_staff_id)
    or exists (select 1 from public.fro_visits where fro_staff_id = p_staff_id)
    or exists (select 1 from public.fro_expense_settlements where fro_staff_id = p_staff_id)
    or exists (select 1 from public.cash_handovers where fro_staff_id = p_staff_id)
    or exists (select 1 from public.fro_cash_advances where fro_staff_id = p_staff_id)
    or exists (select 1 from public.fro_cash_refunds where fro_staff_id = p_staff_id)
    or exists (select 1 from public.expenses where fro_staff_id = p_staff_id);
$$;

create or replace function public.remove_staff(p_staff_id uuid, p_mode text default 'remove')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_user_id uuid;
  v_image text;
begin
  if not public.is_company_admin() then
    raise exception 'Only a company admin can remove a staff member' using errcode = '42501';
  end if;
  if p_mode not in ('remove', 'deactivate') then
    raise exception 'Choose remove or deactivate';
  end if;
  select * into v_staff from public.staff where id = p_staff_id for update;
  if not found then
    raise exception 'That staff member was not found';
  end if;
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and staff_id = p_staff_id
  ) then
    raise exception 'You cannot remove your own staff record';
  end if;

  select id into v_user_id from public.profiles where staff_id = p_staff_id limit 1;

  if p_mode = 'remove' and public.staff_has_business_history(p_staff_id) then
    return jsonb_build_object(
      'result', 'needs_deactivation',
      'name', v_staff.name
    );
  end if;

  if p_mode = 'deactivate' or public.staff_has_business_history(p_staff_id) then
    update public.staff set status = 'inactive' where id = p_staff_id;
    if v_user_id is not null then
      update public.profiles set status = 'disabled' where id = v_user_id;
      update auth.users set banned_until = 'infinity' where id = v_user_id;
      delete from auth.sessions where user_id = v_user_id;
      delete from auth.refresh_tokens where user_id = v_user_id::text;
    end if;
    return jsonb_build_object('result', 'deactivated', 'name', v_staff.name);
  end if;

  v_image := nullif(trim(v_staff.profile_image_path), '');
  if v_user_id is not null then
    delete from auth.users where id = v_user_id;
  end if;
  delete from public.staff where id = p_staff_id;
  return jsonb_build_object(
    'result', 'deleted',
    'name', v_staff.name,
    'image_path', v_image
  );
end;
$$;

revoke all on function public.staff_has_business_history(uuid) from public;
revoke all on function public.remove_staff(uuid, text) from public;
grant execute on function public.remove_staff(uuid, text) to authenticated;
