-- Company admin deletion of a store that has no business records.
-- An exclusive store_admin login is removed with the store. A company admin
-- or a login used by another store is never deleted.

create or replace function public.delete_empty_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
  v_code text;
  v_table regclass;
  v_column text;
  v_count bigint;
  v_user_ids uuid[];
  v_emails text[];
  v_user uuid;
begin
  perform public.nb_require_company_admin();

  select name, code
    into v_name, v_code
  from public.stores
  where id = p_store_id
  for update;

  if v_name is null then
    raise exception 'That store was not found. Nothing was deleted.';
  end if;

  for v_table, v_column in
    select c.conrelid::regclass, a.attname
    from pg_constraint c
    join lateral unnest(c.conkey, c.confkey) as cols(attnum, ref_attnum) on true
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = cols.attnum
    join pg_attribute ref
      on ref.attrelid = c.confrelid
     and ref.attnum = cols.ref_attnum
    where c.confrelid = 'public.stores'::regclass
      and c.contype = 'f'
      and ref.attname = 'id'
      and c.conrelid <> 'public.profiles'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', v_table, v_column)
      into v_count
      using p_store_id;
    if v_count > 0 then
      raise exception
        'This store cannot be deleted because % has % related record(s). Nothing was deleted.',
        v_table, v_count;
    end if;
  end loop;

  perform 1
  from public.profiles
  where store_id = p_store_id
  for update;

  select array_agg(id order by email), array_agg(email order by email)
    into v_user_ids, v_emails
  from public.profiles
  where store_id = p_store_id;

  v_user_ids := coalesce(v_user_ids, '{}');
  v_emails := coalesce(v_emails, '{}');

  if exists (
    select 1
    from public.profiles
    where store_id = p_store_id
      and role <> 'store_admin'
  ) then
    raise exception
      'This store has a login that is not a store administrator. Nothing was deleted.';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = any(v_user_ids)
      and (role = 'company_admin' or store_id is distinct from p_store_id)
  ) then
    raise exception
      'A linked login is shared with another store or the company admin. Nothing was deleted.';
  end if;

  foreach v_user in array v_user_ids loop
    for v_table, v_column in
      select c.conrelid::regclass, a.attname
      from pg_constraint c
      join lateral unnest(c.conkey, c.confkey) as cols(attnum, ref_attnum) on true
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = cols.attnum
      join pg_attribute ref
        on ref.attrelid = c.confrelid
       and ref.attnum = cols.ref_attnum
      where c.confrelid = 'auth.users'::regclass
        and c.contype = 'f'
        and ref.attname = 'id'
        and c.confdeltype in ('a', 'r')
        and c.conrelid not in ('public.profiles'::regclass, 'auth.identities'::regclass)
    loop
      execute format('select count(*) from %s where %I = $1', v_table, v_column)
        into v_count
        using v_user;
      if v_count > 0 then
        raise exception
          'This store login is used by other records in %. Nothing was deleted.',
          v_table;
      end if;
    end loop;
  end loop;

  if cardinality(v_user_ids) > 0 then
    delete from auth.users where id = any(v_user_ids);
  end if;

  if exists (select 1 from public.profiles where store_id = p_store_id) then
    raise exception 'The store login could not be removed. Nothing was deleted.';
  end if;

  delete from public.stores where id = p_store_id;

  return jsonb_build_object(
    'store_id', p_store_id,
    'store_name', v_name,
    'store_code', v_code,
    'removed_emails', to_jsonb(v_emails)
  );
end;
$$;

revoke all on function public.delete_empty_store(uuid) from public, anon;
grant execute on function public.delete_empty_store(uuid) to authenticated;
