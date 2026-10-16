-- Keep the creator's display name on the farmer, even if that login is later removed.
alter table public.farmers
  add column if not exists created_by_name text;

create or replace function public.nb_set_farmer_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.created_by_name is null and new.created_by is not null then
    select coalesce(nullif(trim(s.name), ''), nullif(trim(p.full_name), ''))
      into v_name
      from public.profiles p
      left join public.staff s on s.id = p.staff_id
     where p.id = new.created_by;
    new.created_by_name := v_name;
  end if;
  return new;
end;
$$;

revoke all on function public.nb_set_farmer_creator() from public, anon, authenticated;

drop trigger if exists trg_farmer_creator on public.farmers;
create trigger trg_farmer_creator
  before insert on public.farmers
  for each row execute function public.nb_set_farmer_creator();

update public.farmers f
   set created_by_name = coalesce(
     (
       select nullif(trim(s.name), '')
         from public.profiles p
         join public.staff s on s.id = p.staff_id
        where p.id = f.created_by
     ),
     (
       select nullif(trim(p.full_name), '')
         from public.profiles p
        where p.id = f.created_by
     )
   )
 where f.created_by is not null
   and f.created_by_name is null;
