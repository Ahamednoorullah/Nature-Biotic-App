/*
# Nature Biotic ERP/CRM — 01 Core schema

Creates the 50 finalized tables, enums, integrity constraints, indexes,
audit triggers and seed configuration rows.

Business rules enforced at table level:
- Company stock is NOT maintained: stock_movements only allows the
  'store' and 'fro' locations.
- Credit notes, debit notes and refunds can never be a stock source
  (stock_movements.source_table whitelist).
- stock_movements is append-only.
- A company invoice is received as a whole (single receipt_status).
- Debit notes (company credit notes seen by the store) have no rejected state.
- Sales returns follow pending -> approved / rejected (-> cancelled).
- A quotation can be converted to at most one sales invoice.
- Farmer phone is unique within a store.
- One open FRO expense settlement per FRO.
- New stores default to outstanding_limit_action = 'warn'.

RLS is enabled on every table in this file. Policies are added in
20261008150100_nb_access_rls.sql. Until then every table denies access.
*/

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('company_admin', 'store_admin', 'fro');
create type public.active_status as enum ('active', 'inactive');
create type public.staff_status as enum ('active', 'on_leave', 'inactive');
create type public.sales_channel as enum ('direct', 'executive');
create type public.payment_method as enum ('cash', 'upi', 'bank_transfer', 'cheque');

-- ---------------------------------------------------------------------------
-- Generic trigger functions
-- ---------------------------------------------------------------------------
create or replace function public.nb_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.nb_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; % is not allowed', tg_table_name, tg_op;
end;
$$;

create or replace function public.nb_prevent_store_code_change()
returns trigger
language plpgsql
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'Store code cannot be changed because it is used in document numbers';
  end if;
  return new;
end;
$$;

create or replace function public.nb_is_fro_designation(p_designation text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    position('field' in lower(p_designation)) > 0
    or position('fro' in lower(p_designation)) > 0
    or position('sales executive' in lower(p_designation)) > 0,
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. company_profile (single row)
-- ---------------------------------------------------------------------------
create table public.company_profile (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'Nature Biotic',
  gst_number text,
  business_type text,
  headquarters text,
  established text,
  address text,
  phone text,
  email text,
  bank_account_name text,
  bank_account_no text,
  bank_ifsc text,
  bank_name text,
  bank_branch text,
  upi_id text,
  logo_path text,
  signature_path text,
  authorized_signatory_name text,
  authorized_signatory_designation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 2. stores
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{2,10}$'),
  name text not null check (trim(name) <> ''),
  owner_name text not null,
  manager_name text,
  phone text not null default '',
  email text,
  address text,
  city text,
  district text,
  state text,
  location text,
  gst_number text,
  opened_date date,
  status public.active_status not null default 'active',
  outstanding_limit numeric(14,2) check (outstanding_limit is null or outstanding_limit >= 0),
  outstanding_limit_action text not null default 'warn'
    check (outstanding_limit_action in ('warn', 'block')),
  bank_account_name text,
  bank_account_no text,
  bank_ifsc text,
  bank_name text,
  bank_branch text,
  bank_upi_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index stores_status_idx on public.stores (status);

create trigger trg_store_code_immutable
  before update of code on public.stores
  for each row execute function public.nb_prevent_store_code_change();

-- ---------------------------------------------------------------------------
-- 3. staff
-- ---------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  name text not null check (trim(name) <> ''),
  phone text not null default '',
  alternative_phone text,
  email text,
  dob date,
  joined_date date,
  blood_group text,
  address text,
  family_relation text,
  designation text not null,
  level smallint not null default 1 check (level between 1 and 4),
  target_sales numeric(14,2) not null default 0 check (target_sales >= 0),
  target_farmers integer not null default 0 check (target_farmers >= 0),
  target_farms integer not null default 0 check (target_farms >= 0),
  target_visits integer not null default 0 check (target_visits >= 0),
  status public.staff_status not null default 'active',
  profile_image_path text,
  id_proof_name text,
  id_proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, store_id)
);
comment on column public.staff.target_sales is 'Monthly sales target';
comment on column public.staff.target_farmers is 'Monthly new-farmer target';
comment on column public.staff.target_farms is 'Monthly new-farm target';
comment on column public.staff.target_visits is 'Monthly visit target';
create index staff_store_status_idx on public.staff (store_id, status);

-- ---------------------------------------------------------------------------
-- 4. profiles (one per auth user; only company_admin, store_admin, fro log in)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.app_role not null,
  subject_type text not null check (subject_type in ('company', 'store', 'staff')),
  store_id uuid references public.stores (id) on delete restrict,
  staff_id uuid unique,
  status text not null default 'active' check (status in ('active', 'disabled')),
  phone text,
  employee_id text,
  dob date,
  date_of_joining date,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  constraint profiles_role_shape check (
    (role = 'company_admin' and subject_type = 'company' and store_id is null and staff_id is null)
    or (role = 'store_admin' and subject_type = 'store' and store_id is not null and staff_id is null)
    or (role = 'fro' and subject_type = 'staff' and store_id is not null and staff_id is not null)
  )
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_store_idx on public.profiles (store_id);
create index profiles_role_idx on public.profiles (role);

create or replace function public.nb_validate_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));

  if new.role = 'fro' and not exists (
    select 1 from public.staff s
    where s.id = new.staff_id
      and s.store_id = new.store_id
      and public.nb_is_fro_designation(s.designation)
  ) then
    raise exception 'An FRO login must be linked to an FRO-designation staff member of the same store';
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_company_admin() then
    if new.role is distinct from old.role
       or new.subject_type is distinct from old.subject_type
       or new.store_id is distinct from old.store_id
       or new.staff_id is distinct from old.staff_id
       or new.email is distinct from old.email then
      raise exception 'Only a company admin can change role, store, staff link or email';
    end if;
    if new.status is distinct from old.status and not (
      public.is_store_admin()
      and old.role = 'fro'
      and old.store_id = public.auth_store_id()
    ) then
      raise exception 'Not allowed to change this account status';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_profiles_validate
  before insert or update on public.profiles
  for each row execute function public.nb_validate_profile();

-- ---------------------------------------------------------------------------
-- 5. user_settings
-- ---------------------------------------------------------------------------
create table public.user_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  sound boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 6. product_parties (manufacturers / vendors)
-- ---------------------------------------------------------------------------
create table public.product_parties (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('manufacturer', 'vendor')),
  name text not null check (trim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create unique index product_parties_kind_name_key on public.product_parties (kind, lower(name));

-- ---------------------------------------------------------------------------
-- 7. products (company-wide product master)
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  product_category text not null check (product_category in (
    'Bio-stimulant', 'Pesticide', 'Fungicide', 'Nutrients (Fertilizer)', 'Manenes'
  )),
  product_type text not null check (product_type in ('Liquid', 'Powder', 'Gel', 'Granules')),
  purpose text not null check (purpose in (
    'Root Enhancer', 'Vegetative Growth Simulator', 'Tillers and Branche Developers',
    'Flower Enhancer', 'Bud Developer', 'Yield Enhancer', 'Larvicide',
    'Miticide & Acaricide', 'Botanical fungicide', 'Insecticide (Suckingpest)'
  )),
  unit text not null check (unit in ('Weight', 'Volume')),
  hsn_code text not null,
  manufacturer_id uuid references public.product_parties (id) on delete set null,
  vendor_id uuid references public.product_parties (id) on delete set null,
  tax_type text not null default 'intrastate' check (tax_type in ('intrastate', 'interstate')),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_percent numeric(5,2) generated always as
    (case when tax_type = 'intrastate' then round(tax_percent / 2, 2) else 0 end) stored,
  cgst_percent numeric(5,2) generated always as
    (case when tax_type = 'intrastate' then tax_percent - round(tax_percent / 2, 2) else 0 end) stored,
  igst_percent numeric(5,2) generated always as
    (case when tax_type = 'interstate' then tax_percent else 0 end) stored,
  description text,
  usage_instructions text,
  safety_info text,
  storage_info text,
  application_methods text[] not null default '{}',
  dosage text,
  dosage_unit text,
  filler text,
  filler_unit text,
  filler_type text,
  image_path text,
  status public.active_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create unique index products_category_name_hsn_key
  on public.products (product_category, lower(name), hsn_code);

-- ---------------------------------------------------------------------------
-- 8. product_variants (one sellable pack size)
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  pack_size text not null check (trim(pack_size) <> ''),
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  mrp numeric(14,2) not null default 0 check (mrp >= 0),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  status public.active_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create unique index product_variants_pack_key on public.product_variants (product_id, lower(trim(pack_size)));

-- ---------------------------------------------------------------------------
-- 9. product_batches (production / batch register)
-- ---------------------------------------------------------------------------
create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_no text not null check (batch_no <> '' and batch_no = upper(trim(batch_no))),
  expiry_date date,
  manufacture_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (variant_id, batch_no)
);

-- ---------------------------------------------------------------------------
-- 10-12. farmers, farmer_farms, farmer_crops
-- ---------------------------------------------------------------------------
create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  name text not null check (trim(name) <> ''),
  phone text not null check (trim(phone) <> ''),
  alt_mobile text,
  email text,
  gst text,
  aadhar text,
  village text,
  landmark text,
  district text,
  state text,
  pincode text,
  customer_category text not null default 'Retail'
    check (customer_category in ('Retail', 'Wholesale', 'Dealer')),
  channel public.sales_channel not null default 'direct',
  fro_staff_id uuid,
  payment_method text,
  credit_limit numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  remarks text,
  internal_notes text,
  profile_image_path text,
  status public.active_status not null default 'active',
  joined_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, store_id),
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check (channel = 'direct' or fro_staff_id is not null)
);
create unique index farmers_store_phone_key on public.farmers (store_id, trim(phone));
create index farmers_store_fro_idx on public.farmers (store_id, fro_staff_id);

create table public.farmer_farms (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers (id) on delete cascade,
  village text,
  landmark text,
  district text,
  state text,
  pincode text,
  farm_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index farmer_farms_farmer_idx on public.farmer_farms (farmer_id);

create table public.farmer_crops (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers (id) on delete cascade,
  farm_id uuid references public.farmer_farms (id) on delete cascade,
  crop_type text not null,
  land_size numeric(10,2) check (land_size is null or land_size >= 0),
  soil_type text,
  water_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index farmer_crops_farmer_idx on public.farmer_crops (farmer_id);
create index farmer_crops_farm_idx on public.farmer_crops (farm_id);

-- ---------------------------------------------------------------------------
-- 13. stock_movements (append-only ledger; store and FRO only)
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null default current_date,
  location text not null check (location in ('store', 'fro')),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  qty_delta numeric(14,3) not null check (qty_delta <> 0),
  unit_value numeric(14,2),
  movement_type text not null check (movement_type in (
    'store_receipt', 'sale', 'sale_return', 'delivery_out', 'delivery_in',
    'fro_return_out', 'fro_return_in', 'purchase_return_out', 'adjustment'
  )),
  is_reversal boolean not null default false,
  source_table text not null check (source_table in (
    'company_invoice_items', 'sales_invoice_items', 'sales_return_items',
    'stock_delivery_items', 'stock_return_items', 'purchase_return_items',
    'stock_adjustments'
  )),
  source_id uuid not null,
  source_line_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  constraint stock_movements_location_shape check ((location = 'fro') = (fro_staff_id is not null)),
  constraint stock_movements_type_location check (
    (movement_type in ('store_receipt', 'delivery_out', 'fro_return_in', 'purchase_return_out', 'adjustment')
      and location = 'store')
    or (movement_type in ('delivery_in', 'fro_return_out') and location = 'fro')
    or movement_type in ('sale', 'sale_return')
  ),
  constraint stock_movements_sign check (
    movement_type = 'adjustment'
    or (qty_delta > 0) = ((movement_type in ('store_receipt', 'sale_return', 'delivery_in', 'fro_return_in')) <> is_reversal)
  ),
  constraint stock_movements_once unique (source_table, source_line_id, movement_type, location, is_reversal)
);
create index stock_movements_balance_idx
  on public.stock_movements (location, store_id, fro_staff_id, variant_id, batch_id);
create index stock_movements_store_date_idx on public.stock_movements (store_id, movement_date);
create index stock_movements_source_idx on public.stock_movements (source_table, source_id);

create trigger trg_stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.nb_block_mutation();

-- ---------------------------------------------------------------------------
-- 14. stock_adjustments
-- ---------------------------------------------------------------------------
create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  qty numeric(14,3) not null check (qty <> 0),
  reason text not null check (reason in ('Damaged', 'Expired', 'Returned', 'Physical Count', 'Other')),
  adjustment_date date not null default current_date,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index stock_adjustments_store_idx on public.stock_adjustments (store_id, adjustment_date);

-- ---------------------------------------------------------------------------
-- 15-16. physical_stock_counts (snapshot only, no stock effect)
-- ---------------------------------------------------------------------------
create table public.physical_stock_counts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  count_date date not null default current_date,
  total_qty numeric(14,3) not null default 0,
  total_value numeric(14,2) not null default 0,
  system_qty numeric(14,3) not null default 0,
  system_value numeric(14,2) not null default 0,
  is_match boolean not null default false,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index physical_stock_counts_store_idx on public.physical_stock_counts (store_id, count_date);

create table public.physical_stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.physical_stock_counts (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  qty numeric(14,3) not null check (qty >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  system_qty numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index physical_stock_count_lines_count_idx on public.physical_stock_count_lines (count_id);

-- ---------------------------------------------------------------------------
-- 17-18. purchase_orders
-- ---------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  po_no text not null,
  po_date date not null default current_date,
  total_quantity numeric(14,3) not null default 0,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  notes text,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, po_no),
  unique (id, store_id)
);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_store_date_idx on public.purchase_orders (store_id, po_date);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  unit text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index purchase_order_items_po_idx on public.purchase_order_items (po_id);

-- ---------------------------------------------------------------------------
-- 19-20. company_invoices (company supply to a store; received as a whole)
-- ---------------------------------------------------------------------------
create table public.company_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text,
  number_source text check (number_source in ('auto', 'manual')),
  invoice_date date not null default current_date,
  store_id uuid not null references public.stores (id) on delete restrict,
  purchase_order_id uuid,
  place_of_supply text,
  store_location text,
  shipping_address text,
  notes text,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'final', 'cancelled')),
  finalized_at timestamptz,
  finalized_by uuid references auth.users (id) on delete set null,
  receipt_status text not null default 'dispatched' check (receipt_status in ('dispatched', 'received')),
  received_at timestamptz,
  received_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, store_id),
  foreign key (purchase_order_id, store_id) references public.purchase_orders (id, store_id) on delete restrict,
  check (status = 'draft' or status = 'cancelled' or invoice_no is not null),
  check ((invoice_no is null) = (number_source is null)),
  check (receipt_status = 'dispatched' or status = 'final')
);
create unique index company_invoices_no_key on public.company_invoices (upper(invoice_no)) where invoice_no is not null;
create index company_invoices_store_date_idx on public.company_invoices (store_id, invoice_date);
create index company_invoices_po_idx on public.company_invoices (purchase_order_id);

create table public.company_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.company_invoices (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid not null references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  batch_no text not null,
  expiry_date date,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index company_invoice_items_invoice_idx on public.company_invoice_items (invoice_id);
create index company_invoice_items_variant_idx on public.company_invoice_items (variant_id, batch_id);

-- ---------------------------------------------------------------------------
-- 21-22. purchase_returns (store -> company; company UI label: "Sales Return")
-- ---------------------------------------------------------------------------
create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  return_no text not null,
  return_date date not null default current_date,
  company_invoice_id uuid not null,
  supplier text not null default 'Nature Biotic',
  place_of_return text default 'Rajapalayam',
  reason text,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, return_no),
  unique (id, store_id),
  foreign key (company_invoice_id, store_id) references public.company_invoices (id, store_id) on delete restrict
);
create index purchase_returns_status_idx on public.purchase_returns (status);
create index purchase_returns_invoice_idx on public.purchase_returns (company_invoice_id);

create table public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.purchase_returns (id) on delete cascade,
  company_invoice_item_id uuid not null references public.company_invoice_items (id) on delete restrict,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid not null references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  batch_no text,
  expiry_date date,
  purchased_quantity numeric(14,3) not null default 0,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index purchase_return_items_return_idx on public.purchase_return_items (return_id);
create index purchase_return_items_invoice_item_idx on public.purchase_return_items (company_invoice_item_id);
create index purchase_return_items_stock_idx on public.purchase_return_items (variant_id, batch_id);

-- ---------------------------------------------------------------------------
-- 23-24. company_credit_notes (store sees them as Debit Notes; accept only)
-- ---------------------------------------------------------------------------
create table public.company_credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_no text,
  store_id uuid not null references public.stores (id) on delete restrict,
  credit_note_date date not null default current_date,
  period_from date,
  period_to date,
  reason text,
  notes text,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'issued', 'accepted', 'cancelled')),
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, store_id),
  check (status in ('draft', 'cancelled') or credit_note_no is not null),
  check (period_from is null or period_to is null or period_from <= period_to)
);
create unique index company_credit_notes_no_key on public.company_credit_notes (credit_note_no) where credit_note_no is not null;
create index company_credit_notes_store_idx on public.company_credit_notes (store_id, status);

create table public.company_credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.company_credit_notes (id) on delete cascade,
  line_no smallint not null default 1,
  line_type text not null check (line_type in ('return', 'adjustment')),
  purchase_return_item_id uuid references public.purchase_return_items (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  batch_no text,
  expiry_date date,
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check ((line_type = 'return') = (purchase_return_item_id is not null)),
  check (line_type = 'return' or nullif(trim(reason), '') is not null),
  check (line_type = 'adjustment' or quantity > 0)
);
create index company_credit_note_items_cn_idx on public.company_credit_note_items (credit_note_id);
create index company_credit_note_items_pri_idx on public.company_credit_note_items (purchase_return_item_id);

-- ---------------------------------------------------------------------------
-- 25. company_receipts (store pays company)
-- ---------------------------------------------------------------------------
create table public.company_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  receipt_date date not null default current_date,
  store_id uuid not null references public.stores (id) on delete restrict,
  company_invoice_id uuid not null,
  method public.payment_method not null,
  amount numeric(14,2) not null check (amount > 0),
  invoice_amount numeric(14,2) not null default 0,
  balance_after numeric(14,2) not null default 0 check (balance_after >= 0),
  received_by_name text,
  remarks text,
  status text not null default 'final' check (status in ('final', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (company_invoice_id, store_id) references public.company_invoices (id, store_id) on delete restrict
);
create index company_receipts_store_date_idx on public.company_receipts (store_id, receipt_date);
create index company_receipts_invoice_idx on public.company_receipts (company_invoice_id);

-- ---------------------------------------------------------------------------
-- 26. company_refunds (refund against an accepted company credit note)
-- ---------------------------------------------------------------------------
create table public.company_refunds (
  id uuid primary key default gen_random_uuid(),
  refund_no text not null unique,
  refund_date date not null default current_date,
  store_id uuid not null references public.stores (id) on delete restrict,
  company_credit_note_id uuid not null,
  refund_amount numeric(14,2) not null check (refund_amount > 0),
  outstanding_before numeric(14,2) not null check (outstanding_before >= 0),
  applied_to_outstanding numeric(14,2) not null check (applied_to_outstanding >= 0),
  cash_paid numeric(14,2) generated always as (refund_amount - applied_to_outstanding) stored,
  balance_after numeric(14,2) generated always as (outstanding_before - applied_to_outstanding) stored,
  method public.payment_method,
  reason text,
  remarks text,
  status text not null default 'final' check (status in ('final', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (company_credit_note_id, store_id) references public.company_credit_notes (id, store_id) on delete restrict,
  check (applied_to_outstanding <= refund_amount),
  check (applied_to_outstanding <= outstanding_before),
  check (refund_amount = applied_to_outstanding or method is not null)
);
create index company_refunds_store_idx on public.company_refunds (store_id, refund_date);
create index company_refunds_cn_idx on public.company_refunds (company_credit_note_id);

-- ---------------------------------------------------------------------------
-- 27-28. quotations
-- ---------------------------------------------------------------------------
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  quotation_no text not null,
  quotation_date date not null default current_date,
  farmer_id uuid,
  farmer_name text not null,
  phone text,
  village text,
  crop text,
  acre text,
  place_of_supply text default 'Tamil Nadu',
  remarks text,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  channel public.sales_channel not null default 'direct',
  fro_staff_id uuid,
  status text not null default 'open' check (status in ('open', 'converted', 'cancelled')),
  converted_invoice_id uuid unique,
  converted_at timestamptz,
  converted_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, quotation_no),
  unique (id, store_id),
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check (channel = 'direct' or fro_staff_id is not null),
  check ((status = 'converted') = (converted_invoice_id is not null))
);
create index quotations_store_date_idx on public.quotations (store_id, quotation_date);
create index quotations_fro_idx on public.quotations (fro_staff_id);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- ---------------------------------------------------------------------------
-- 29-30. sales_invoices
-- ---------------------------------------------------------------------------
create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  invoice_no text not null,
  invoice_date date not null default current_date,
  farmer_id uuid,
  party_name text not null,
  farmer_phone text,
  farmer_village text,
  farmer_crop text,
  farmer_acre text,
  place_of_supply text default 'Tamil Nadu',
  channel public.sales_channel not null default 'direct',
  fro_staff_id uuid,
  quotation_id uuid unique,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text,
  status text not null default 'final' check (status in ('final', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, invoice_no),
  unique (id, store_id),
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  foreign key (quotation_id, store_id) references public.quotations (id, store_id) on delete restrict,
  check ((channel = 'executive') = (fro_staff_id is not null))
);
create index sales_invoices_store_date_idx on public.sales_invoices (store_id, invoice_date);
create index sales_invoices_farmer_idx on public.sales_invoices (farmer_id);
create index sales_invoices_fro_idx on public.sales_invoices (fro_staff_id, invoice_date);

alter table public.quotations
  add constraint quotations_converted_invoice_fk
  foreign key (converted_invoice_id, store_id) references public.sales_invoices (id, store_id) on delete restrict;

create table public.sales_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.sales_invoices (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  batch_no text,
  expiry_date date,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index sales_invoice_items_invoice_idx on public.sales_invoice_items (invoice_id);

-- ---------------------------------------------------------------------------
-- 31-32. sales_returns (pending -> approved / rejected; stock only on approval)
-- ---------------------------------------------------------------------------
create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  return_no text not null,
  return_date date not null default current_date,
  sales_invoice_id uuid not null,
  farmer_id uuid,
  party_name text not null,
  farmer_phone text,
  farmer_village text,
  channel public.sales_channel not null default 'direct',
  fro_staff_id uuid,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  rejection_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, return_no),
  unique (id, store_id),
  foreign key (sales_invoice_id, store_id) references public.sales_invoices (id, store_id) on delete restrict,
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check ((channel = 'executive') = (fro_staff_id is not null)),
  check (status <> 'rejected' or nullif(trim(rejection_reason), '') is not null)
);
create index sales_returns_store_status_idx on public.sales_returns (store_id, status);
create index sales_returns_invoice_idx on public.sales_returns (sales_invoice_id);
create index sales_returns_fro_idx on public.sales_returns (fro_staff_id);

create table public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sales_returns (id) on delete cascade,
  sales_invoice_item_id uuid not null references public.sales_invoice_items (id) on delete restrict,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  batch_no text,
  expiry_date date,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index sales_return_items_return_idx on public.sales_return_items (return_id);
create index sales_return_items_invoice_item_idx on public.sales_return_items (sales_invoice_item_id);

-- ---------------------------------------------------------------------------
-- 33-34. store_credit_notes (to farmers; financial only, never moves stock)
-- ---------------------------------------------------------------------------
create table public.store_credit_notes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  credit_note_no text,
  credit_note_date date not null default current_date,
  farmer_id uuid,
  sales_invoice_id uuid,
  party_name text not null,
  farmer_phone text,
  farmer_village text,
  store_location text,
  place_of_return text,
  channel public.sales_channel not null default 'direct',
  fro_staff_id uuid,
  notes text,
  before_discount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0 check (round_off between -1 and 1),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, store_id),
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict,
  foreign key (sales_invoice_id, store_id) references public.sales_invoices (id, store_id) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check ((channel = 'executive') = (fro_staff_id is not null)),
  check (status in ('draft', 'cancelled') or credit_note_no is not null)
);
create unique index store_credit_notes_no_key on public.store_credit_notes (store_id, credit_note_no) where credit_note_no is not null;
create index store_credit_notes_farmer_idx on public.store_credit_notes (farmer_id);

create table public.store_credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.store_credit_notes (id) on delete cascade,
  line_no smallint not null default 1,
  line_type text not null check (line_type in ('return', 'adjustment')),
  sales_return_item_id uuid references public.sales_return_items (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  hsn_code text,
  batch_no text,
  expiry_date date,
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(14,2) not null default 0 check (taxable_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  check ((line_type = 'return') = (sales_return_item_id is not null)),
  check (line_type = 'return' or nullif(trim(reason), '') is not null),
  check (line_type = 'adjustment' or quantity > 0)
);
create index store_credit_note_items_cn_idx on public.store_credit_note_items (credit_note_id);
create index store_credit_note_items_sri_idx on public.store_credit_note_items (sales_return_item_id);

-- ---------------------------------------------------------------------------
-- 35. store_receipts (farmer pays store)
-- ---------------------------------------------------------------------------
create table public.store_receipts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  receipt_no text not null,
  receipt_date date not null default current_date,
  farmer_id uuid,
  farmer_name text,
  sales_invoice_id uuid not null,
  method public.payment_method not null,
  amount numeric(14,2) not null check (amount > 0),
  invoice_amount numeric(14,2) not null default 0,
  balance_after numeric(14,2) not null default 0 check (balance_after >= 0),
  received_by uuid references auth.users (id) on delete set null,
  received_by_name text,
  fro_staff_id uuid,
  remarks text,
  status text not null default 'final' check (status in ('final', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, receipt_no),
  foreign key (sales_invoice_id, store_id) references public.sales_invoices (id, store_id) on delete restrict,
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict
);
create index store_receipts_store_date_idx on public.store_receipts (store_id, receipt_date);
create index store_receipts_invoice_idx on public.store_receipts (sales_invoice_id);
create index store_receipts_fro_idx on public.store_receipts (fro_staff_id, method);

-- ---------------------------------------------------------------------------
-- 36. store_refunds (direct from a sales return, or via a store credit note)
-- ---------------------------------------------------------------------------
create table public.store_refunds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  refund_no text not null,
  refund_date date not null default current_date,
  farmer_id uuid,
  farmer_name text,
  farmer_phone text,
  farmer_village text,
  sales_return_id uuid,
  store_credit_note_id uuid,
  reference_no text not null,
  sales_invoice_id uuid,
  return_amount numeric(14,2) not null default 0,
  refund_amount numeric(14,2) not null check (refund_amount > 0),
  outstanding_before numeric(14,2) not null check (outstanding_before >= 0),
  applied_to_outstanding numeric(14,2) not null check (applied_to_outstanding >= 0),
  cash_paid numeric(14,2) generated always as (refund_amount - applied_to_outstanding) stored,
  balance_after numeric(14,2) generated always as (outstanding_before - applied_to_outstanding) stored,
  method public.payment_method,
  reason text,
  remarks text,
  channel public.sales_channel not null default 'direct',
  fro_staff_id uuid,
  place_of_supply text,
  status text not null default 'final' check (status in ('final', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, refund_no),
  foreign key (sales_return_id, store_id) references public.sales_returns (id, store_id) on delete restrict,
  foreign key (store_credit_note_id, store_id) references public.store_credit_notes (id, store_id) on delete restrict,
  foreign key (sales_invoice_id, store_id) references public.sales_invoices (id, store_id) on delete restrict,
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check ((sales_return_id is null) <> (store_credit_note_id is null)),
  check (applied_to_outstanding <= refund_amount),
  check (applied_to_outstanding <= outstanding_before),
  check (refund_amount = applied_to_outstanding or method is not null)
);
create index store_refunds_store_idx on public.store_refunds (store_id, refund_date);
create index store_refunds_return_idx on public.store_refunds (sales_return_id);
create index store_refunds_cn_idx on public.store_refunds (store_credit_note_id);
create index store_refunds_farmer_idx on public.store_refunds (farmer_id);

-- ---------------------------------------------------------------------------
-- 37-38. stock_deliveries (store -> FRO delivery challan)
-- ---------------------------------------------------------------------------
create table public.stock_deliveries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  sd_no text not null,
  delivery_date date not null default current_date,
  fro_staff_id uuid not null,
  issued_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, sd_no),
  unique (id, store_id),
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict
);
create index stock_deliveries_fro_idx on public.stock_deliveries (fro_staff_id, status);

create table public.stock_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.stock_deliveries (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  batch_no text,
  expiry_date date,
  qty numeric(14,3) not null check (qty > 0),
  unit_value numeric(14,2) not null default 0 check (unit_value >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index stock_delivery_items_delivery_idx on public.stock_delivery_items (delivery_id);

-- ---------------------------------------------------------------------------
-- 39-40. stock_returns (FRO -> store; SR-0001 per store)
-- ---------------------------------------------------------------------------
create table public.stock_returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  return_no text not null,
  manual_ref_no text,
  return_date date not null default current_date,
  fro_staff_id uuid not null,
  source text not null default 'fro_request' check (source in ('fro_request', 'store_manual')),
  stock_delivery_id uuid,
  reason text,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  customer_name text,
  village text,
  phone text,
  place_of_supply text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (store_id, return_no),
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  foreign key (stock_delivery_id, store_id) references public.stock_deliveries (id, store_id) on delete restrict
);
create index stock_returns_fro_idx on public.stock_returns (fro_staff_id, status);

create table public.stock_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.stock_returns (id) on delete cascade,
  line_no smallint not null default 1,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  batch_id uuid references public.product_batches (id) on delete restrict,
  product_name text not null,
  pack_size text not null default '',
  batch_no text,
  expiry_date date,
  qty numeric(14,3) not null check (qty > 0),
  unit_value numeric(14,2) not null default 0 check (unit_value >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index stock_return_items_return_idx on public.stock_return_items (return_id);

-- ---------------------------------------------------------------------------
-- 41. staff_attendance
-- ---------------------------------------------------------------------------
create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  staff_id uuid not null,
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  worked_duration interval generated always as (check_out_at - check_in_at) stored,
  status text not null check (status in ('present', 'leave', 'absent', 'half_day', 'checked_in', 'checked_out')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (staff_id, attendance_date),
  foreign key (staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);
create index staff_attendance_store_date_idx on public.staff_attendance (store_id, attendance_date);

-- ---------------------------------------------------------------------------
-- 42. fro_visits
-- ---------------------------------------------------------------------------
create table public.fro_visits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid not null,
  visit_date date not null default current_date,
  farmer_id uuid,
  farmer_name text not null,
  village text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  foreign key (farmer_id, store_id) references public.farmers (id, store_id) on delete restrict
);
create index fro_visits_fro_date_idx on public.fro_visits (fro_staff_id, visit_date);

-- ---------------------------------------------------------------------------
-- 45. fro_expense_settlements (per FRO; created before tables that reference it)
-- ---------------------------------------------------------------------------
create table public.fro_expense_settlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid not null,
  status text not null default 'open' check (status in ('open', 'completed')),
  opened_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, store_id),
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null))
);
create unique index fro_expense_settlements_one_open on public.fro_expense_settlements (fro_staff_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- 43. cash_handovers (FRO -> store)
-- ---------------------------------------------------------------------------
create table public.cash_handovers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid not null,
  handover_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  remarks text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict
);
create index cash_handovers_store_status_idx on public.cash_handovers (store_id, status);
create index cash_handovers_fro_idx on public.cash_handovers (fro_staff_id);

-- ---------------------------------------------------------------------------
-- 44. fro_cash_advances (store -> FRO; "cash received" in the current UI)
-- ---------------------------------------------------------------------------
create table public.fro_cash_advances (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid not null,
  advance_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  received_from text not null default 'Store',
  remarks text,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  settlement_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  foreign key (settlement_id, store_id) references public.fro_expense_settlements (id, store_id) on delete restrict
);
create index fro_cash_advances_fro_idx on public.fro_cash_advances (fro_staff_id, status);

-- ---------------------------------------------------------------------------
-- 46. fro_cash_refunds (FRO returns unused cash to the store)
-- ---------------------------------------------------------------------------
create table public.fro_cash_refunds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  fro_staff_id uuid not null,
  settlement_id uuid,
  refunded_at timestamptz not null default now(),
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  refunded_to text not null default 'Store',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  foreign key (settlement_id, store_id) references public.fro_expense_settlements (id, store_id) on delete restrict
);
create index fro_cash_refunds_fro_idx on public.fro_cash_refunds (fro_staff_id);

-- ---------------------------------------------------------------------------
-- 47-48. expense_categories, expenses
-- ---------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('company', 'store', 'fro')),
  name text not null check (trim(name) <> ''),
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (scope, name),
  unique (id, scope)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('company', 'store', 'fro')),
  store_id uuid references public.stores (id) on delete restrict,
  fro_staff_id uuid,
  expense_no text not null unique,
  expense_date date not null default current_date,
  category_id uuid not null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null,
  entered_by_name text,
  settlement_id uuid,
  status text not null default 'accepted' check (status in ('accepted', 'cancelled')),
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (category_id, scope) references public.expense_categories (id, scope) on delete restrict,
  foreign key (fro_staff_id, store_id) references public.staff (id, store_id) on delete restrict,
  foreign key (settlement_id, store_id) references public.fro_expense_settlements (id, store_id) on delete restrict,
  check (
    (scope = 'company' and store_id is null and fro_staff_id is null and settlement_id is null)
    or (scope = 'store' and store_id is not null and fro_staff_id is null and settlement_id is null)
    or (scope = 'fro' and store_id is not null and fro_staff_id is not null)
  )
);
create index expenses_store_date_idx on public.expenses (store_id, expense_date);
create index expenses_fro_idx on public.expenses (fro_staff_id, settlement_id);

-- ---------------------------------------------------------------------------
-- 49. document_sequences (numbering configuration + counters)
--   scope_key '*'      = template row for store-scoped documents
--   scope_key 'GLOBAL' = company-wide documents
--   scope_key '<CODE>' = per-store counter (created on first use)
--   prefix may contain {STORE}, replaced by stores.code
-- ---------------------------------------------------------------------------
create table public.document_sequences (
  doc_type text not null,
  scope_key text not null,
  prefix text not null,
  pad_width smallint not null default 4 check (pad_width between 1 and 10),
  allow_manual boolean not null default false,
  last_value bigint not null default 0 check (last_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (doc_type, scope_key)
);

-- ---------------------------------------------------------------------------
-- 50. notification_reads (notifications themselves stay derived; table postponed)
-- ---------------------------------------------------------------------------
create table public.notification_reads (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (profile_id, notification_key)
);

-- ---------------------------------------------------------------------------
-- Company invoice number validation (configured NB-INV pattern)
-- ---------------------------------------------------------------------------
create or replace function public.nb_company_invoice_number_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invoice_no is not null then
    new.invoice_no := upper(trim(new.invoice_no));
    if new.invoice_no !~ public.nb_document_pattern('company_invoice') then
      raise exception 'Invoice number "%" does not match the configured company invoice pattern (e.g. %)',
        new.invoice_no, public.nb_format_document_no('company_invoice', null, 1);
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.invoice_no is not null
     and new.invoice_no is distinct from old.invoice_no
     and old.status <> 'draft' then
    raise exception 'The invoice number is locked once the invoice is final';
  end if;

  return new;
end;
$$;

create trigger trg_company_invoice_number_guard
  before insert or update of invoice_no on public.company_invoices
  for each row execute function public.nb_company_invoice_number_guard();

create or replace function public.nb_company_invoice_number_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invoice_no is not null and new.number_source = 'manual' then
    perform public.nb_sync_manual_sequence('company_invoice', new.invoice_no);
  end if;
  return null;
end;
$$;

create trigger trg_company_invoice_number_sync
  after insert or update of invoice_no on public.company_invoices
  for each row execute function public.nb_company_invoice_number_sync();

-- ---------------------------------------------------------------------------
-- Audit triggers + RLS on all 50 tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'company_profile', 'stores', 'staff', 'profiles', 'user_settings',
    'product_parties', 'products', 'product_variants', 'product_batches',
    'farmers', 'farmer_farms', 'farmer_crops',
    'stock_movements', 'stock_adjustments', 'physical_stock_counts', 'physical_stock_count_lines',
    'purchase_orders', 'purchase_order_items', 'company_invoices', 'company_invoice_items',
    'purchase_returns', 'purchase_return_items', 'company_credit_notes', 'company_credit_note_items',
    'company_receipts', 'company_refunds',
    'quotations', 'quotation_items', 'sales_invoices', 'sales_invoice_items',
    'sales_returns', 'sales_return_items', 'store_credit_notes', 'store_credit_note_items',
    'store_receipts', 'store_refunds',
    'stock_deliveries', 'stock_delivery_items', 'stock_returns', 'stock_return_items',
    'staff_attendance', 'fro_visits', 'cash_handovers', 'fro_cash_advances',
    'fro_expense_settlements', 'fro_cash_refunds',
    'expense_categories', 'expenses',
    'document_sequences', 'notification_reads'
  ]
  loop
    if t <> 'stock_movements' then
      execute format(
        'create trigger trg_audit before insert or update on public.%I for each row execute function public.nb_audit_fields()',
        t
      );
    else
      execute format(
        'create trigger trg_audit before insert on public.%I for each row execute function public.nb_audit_fields()',
        t
      );
    end if;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed configuration
-- ---------------------------------------------------------------------------
insert into public.company_profile (id) values (1) on conflict (id) do nothing;

insert into public.document_sequences (doc_type, scope_key, prefix, pad_width, allow_manual) values
  ('purchase_order',      '*',      '{STORE}-PO-',  4, false),
  ('purchase_return',     '*',      '{STORE}-PR-',  4, false),
  ('sales_invoice',       '*',      '{STORE}-INV-', 4, false),
  ('sales_return',        '*',      '{STORE}-SR-',  4, false),
  ('quotation',           '*',      '{STORE}-QT-',  4, false),
  ('store_receipt',       '*',      '{STORE}-RCP-', 4, false),
  ('store_credit_note',   '*',      '{STORE}-CN-',  4, false),
  ('store_refund',        '*',      '{STORE}-REF-', 4, false),
  ('store_expense',       '*',      '{STORE}-EXP-', 4, false),
  ('fro_stock_return',    '*',      'SR-',          4, false),
  ('delivery_challan',    '*',      'SD-',          4, false),
  ('company_invoice',     'GLOBAL', 'NB-INV-',      4, true),
  ('company_credit_note', 'GLOBAL', 'NB-CN-',       4, false),
  ('company_receipt',     'GLOBAL', 'RCP-',         4, false),
  ('company_refund',      'GLOBAL', 'NB-REF-',      4, false),
  ('company_expense',     'GLOBAL', 'NB-EXP-',      4, false)
on conflict (doc_type, scope_key) do nothing;

insert into public.expense_categories (scope, name, sort_order) values
  ('store', 'Transport', 1), ('store', 'Electricity', 2), ('store', 'Salary', 3),
  ('store', 'Office Expense', 4), ('store', 'Maintenance', 5), ('store', 'Miscellaneous', 6),
  ('store', 'Food', 7), ('store', 'Travel', 8), ('store', 'Fuel', 9), ('store', 'Accommodation', 10),
  ('fro', 'Travel', 1), ('fro', 'Food', 2), ('fro', 'Fuel', 3), ('fro', 'Accommodation', 4),
  ('fro', 'Transport', 5), ('fro', 'Driver', 6), ('fro', 'Other', 7),
  ('company', 'Transport', 1), ('company', 'Electricity', 2), ('company', 'Salary', 3),
  ('company', 'Office Expense', 4), ('company', 'Maintenance', 5), ('company', 'Miscellaneous', 6),
  ('company', 'Food', 7), ('company', 'Travel', 8), ('company', 'Fuel', 9), ('company', 'Accommodation', 10)
on conflict (scope, name) do nothing;
