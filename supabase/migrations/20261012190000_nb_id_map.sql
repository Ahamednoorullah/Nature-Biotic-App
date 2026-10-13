-- Local/browser string IDs are not UUIDs. This table maps them for catalog sync.
-- Applied only to the local project; do not use a service-role key from the app.

create table public.id_map (
  entity text not null check (entity in (
    'product_party',
    'product',
    'product_variant'
  )),
  local_id text not null check (trim(local_id) <> ''),
  remote_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (entity, local_id)
);

create index id_map_remote_idx on public.id_map (entity, remote_id);

alter table public.id_map enable row level security;

create policy id_map_select on public.id_map
  for select to authenticated using (public.is_company_admin());
create policy id_map_insert on public.id_map
  for insert to authenticated with check (public.is_company_admin());
create policy id_map_update on public.id_map
  for update to authenticated
  using (public.is_company_admin())
  with check (public.is_company_admin());

revoke all on public.id_map from anon;
grant select, insert, update on public.id_map to authenticated;
