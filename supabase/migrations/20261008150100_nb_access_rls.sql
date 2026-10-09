/*
# Nature Biotic ERP/CRM — 02 Access helpers and RLS policies

Roles that can log in: company_admin, store_admin, fro (FRO-designation staff only).
Non-FRO staff are records only.

Access model:
- company_admin: reads everything; writes company profile, master data and company documents.
- store_admin:   own store only.
- fro:           own records inside own store (fro_staff_id = auth_staff_id()).

Document tables (invoices, returns, credit notes, receipts, refunds, deliveries,
cash, attendance, visits, expenses, stock ledger) are read through RLS but can only
be written through the SECURITY DEFINER functions in 20261008150400_nb_business_rpcs.sql,
so there are intentionally no INSERT/UPDATE/DELETE policies on them.
*/

-- ---------------------------------------------------------------------------
-- Helper functions (used by policies; executable by authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.status = 'active';
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active');
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'company_admin', false);
$$;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'store_admin', false);
$$;

create or replace function public.is_fro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'fro', false);
$$;

create or replace function public.auth_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id from public.profiles p where p.id = auth.uid() and p.status = 'active';
$$;

create or replace function public.auth_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.staff_id from public.profiles p where p.id = auth.uid() and p.status = 'active';
$$;

-- Any logged-in user of the store (store_admin or fro), or company admin.
create or replace function public.can_read_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_admin()
      or (p_store_id is not null and p_store_id = public.auth_store_id());
$$;

-- Company <-> store documents: company admin or the store's admin.
create or replace function public.can_read_company_doc(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_admin()
      or (public.is_store_admin() and p_store_id = public.auth_store_id());
$$;

-- Store documents: company admin, the store's admin, or the owning FRO.
create or replace function public.can_read_store_doc(p_store_id uuid, p_fro_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_admin()
      or (public.is_store_admin() and p_store_id = public.auth_store_id())
      or (public.is_fro()
          and p_store_id = public.auth_store_id()
          and p_fro_staff_id is not null
          and p_fro_staff_id = public.auth_staff_id());
$$;

create or replace function public.can_write_farmer(p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.farmers f
    where f.id = p_farmer_id
      and (
        public.is_company_admin()
        or (public.is_store_admin() and f.store_id = public.auth_store_id())
        or (public.is_fro() and f.store_id = public.auth_store_id() and f.fro_staff_id = public.auth_staff_id())
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Identity & organisation
-- ---------------------------------------------------------------------------
create policy company_profile_select on public.company_profile
  for select to authenticated using (public.is_active_user());
create policy company_profile_update on public.company_profile
  for update to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

create policy stores_select on public.stores
  for select to authenticated using (public.can_read_store(id));
create policy stores_insert on public.stores
  for insert to authenticated with check (public.is_company_admin());
create policy stores_update on public.stores
  for update to authenticated using (public.is_company_admin()) with check (public.is_company_admin());
create policy stores_delete on public.stores
  for delete to authenticated using (public.is_company_admin());

create policy staff_select on public.staff
  for select to authenticated using (public.can_read_store(store_id));
create policy staff_insert on public.staff
  for insert to authenticated with check (public.can_read_company_doc(store_id));
create policy staff_update on public.staff
  for update to authenticated using (public.can_read_company_doc(store_id)) with check (public.can_read_company_doc(store_id));
create policy staff_delete on public.staff
  for delete to authenticated using (public.can_read_company_doc(store_id));

create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_company_admin()
    or (public.is_store_admin() and store_id = public.auth_store_id())
  );
create policy profiles_insert on public.profiles
  for insert to authenticated with check (public.is_company_admin());
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_company_admin())
  with check (id = auth.uid() or public.is_company_admin());
create policy profiles_delete on public.profiles
  for delete to authenticated using (public.is_company_admin());

create policy user_settings_all on public.user_settings
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Master data (company-wide catalogue)
-- ---------------------------------------------------------------------------
create policy product_parties_select on public.product_parties
  for select to authenticated using (public.is_active_user());
create policy product_parties_write on public.product_parties
  for all to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

create policy products_select on public.products
  for select to authenticated using (public.is_active_user());
create policy products_write on public.products
  for all to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

create policy product_variants_select on public.product_variants
  for select to authenticated using (public.is_active_user());
create policy product_variants_write on public.product_variants
  for all to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

create policy product_batches_select on public.product_batches
  for select to authenticated using (public.is_active_user());
create policy product_batches_write on public.product_batches
  for all to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

create policy expense_categories_select on public.expense_categories
  for select to authenticated using (public.is_active_user());
create policy expense_categories_write on public.expense_categories
  for all to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

-- Farmers: every store user can read the store's farmers; FRO writes own farmers.
create policy farmers_select on public.farmers
  for select to authenticated using (public.can_read_store(store_id));
create policy farmers_insert on public.farmers
  for insert to authenticated with check (
    public.can_read_company_doc(store_id)
    or (public.is_fro()
        and store_id = public.auth_store_id()
        and channel = 'executive'
        and fro_staff_id = public.auth_staff_id())
  );
create policy farmers_update on public.farmers
  for update to authenticated
  using (
    public.can_read_company_doc(store_id)
    or (public.is_fro() and store_id = public.auth_store_id() and fro_staff_id = public.auth_staff_id())
  )
  with check (
    public.can_read_company_doc(store_id)
    or (public.is_fro() and store_id = public.auth_store_id() and fro_staff_id = public.auth_staff_id())
  );
create policy farmers_delete on public.farmers
  for delete to authenticated using (public.can_read_company_doc(store_id));

create policy farmer_farms_select on public.farmer_farms
  for select to authenticated using (exists (select 1 from public.farmers f where f.id = farmer_id));
create policy farmer_farms_write on public.farmer_farms
  for all to authenticated using (public.can_write_farmer(farmer_id)) with check (public.can_write_farmer(farmer_id));

create policy farmer_crops_select on public.farmer_crops
  for select to authenticated using (exists (select 1 from public.farmers f where f.id = farmer_id));
create policy farmer_crops_write on public.farmer_crops
  for all to authenticated using (public.can_write_farmer(farmer_id)) with check (public.can_write_farmer(farmer_id));

-- ---------------------------------------------------------------------------
-- Inventory (read only; writes via functions)
-- ---------------------------------------------------------------------------
create policy stock_movements_select on public.stock_movements
  for select to authenticated using (
    public.is_company_admin()
    or (public.is_store_admin() and store_id = public.auth_store_id())
    or (public.is_fro()
        and store_id = public.auth_store_id()
        and (location = 'store' or fro_staff_id = public.auth_staff_id()))
  );

create policy stock_adjustments_select on public.stock_adjustments
  for select to authenticated using (public.can_read_company_doc(store_id));

create policy physical_stock_counts_select on public.physical_stock_counts
  for select to authenticated using (public.can_read_company_doc(store_id));
create policy physical_stock_count_lines_select on public.physical_stock_count_lines
  for select to authenticated using (exists (select 1 from public.physical_stock_counts c where c.id = count_id));

-- ---------------------------------------------------------------------------
-- Company <-> store documents (read only; writes via functions)
-- ---------------------------------------------------------------------------
create policy purchase_orders_select on public.purchase_orders
  for select to authenticated using (public.can_read_company_doc(store_id));
create policy purchase_order_items_select on public.purchase_order_items
  for select to authenticated using (exists (select 1 from public.purchase_orders h where h.id = po_id));

create policy company_invoices_select on public.company_invoices
  for select to authenticated using (
    public.is_company_admin()
    or (public.is_store_admin() and store_id = public.auth_store_id() and status <> 'draft')
  );
create policy company_invoice_items_select on public.company_invoice_items
  for select to authenticated using (exists (select 1 from public.company_invoices h where h.id = invoice_id));

create policy purchase_returns_select on public.purchase_returns
  for select to authenticated using (public.can_read_company_doc(store_id));
create policy purchase_return_items_select on public.purchase_return_items
  for select to authenticated using (exists (select 1 from public.purchase_returns h where h.id = return_id));

create policy company_credit_notes_select on public.company_credit_notes
  for select to authenticated using (
    public.is_company_admin()
    or (public.is_store_admin() and store_id = public.auth_store_id() and status <> 'draft')
  );
create policy company_credit_note_items_select on public.company_credit_note_items
  for select to authenticated using (exists (select 1 from public.company_credit_notes h where h.id = credit_note_id));

create policy company_receipts_select on public.company_receipts
  for select to authenticated using (public.can_read_company_doc(store_id));

create policy company_refunds_select on public.company_refunds
  for select to authenticated using (public.can_read_company_doc(store_id));

-- ---------------------------------------------------------------------------
-- Store sales documents (read only; writes via functions)
-- ---------------------------------------------------------------------------
create policy quotations_select on public.quotations
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));
create policy quotation_items_select on public.quotation_items
  for select to authenticated using (exists (select 1 from public.quotations h where h.id = quotation_id));

create policy sales_invoices_select on public.sales_invoices
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));
create policy sales_invoice_items_select on public.sales_invoice_items
  for select to authenticated using (exists (select 1 from public.sales_invoices h where h.id = invoice_id));

create policy sales_returns_select on public.sales_returns
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));
create policy sales_return_items_select on public.sales_return_items
  for select to authenticated using (exists (select 1 from public.sales_returns h where h.id = return_id));

create policy store_credit_notes_select on public.store_credit_notes
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));
create policy store_credit_note_items_select on public.store_credit_note_items
  for select to authenticated using (exists (select 1 from public.store_credit_notes h where h.id = credit_note_id));

create policy store_receipts_select on public.store_receipts
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

create policy store_refunds_select on public.store_refunds
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

-- ---------------------------------------------------------------------------
-- FRO documents (read only; writes via functions)
-- ---------------------------------------------------------------------------
create policy stock_deliveries_select on public.stock_deliveries
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));
create policy stock_delivery_items_select on public.stock_delivery_items
  for select to authenticated using (exists (select 1 from public.stock_deliveries h where h.id = delivery_id));

create policy stock_returns_select on public.stock_returns
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));
create policy stock_return_items_select on public.stock_return_items
  for select to authenticated using (exists (select 1 from public.stock_returns h where h.id = return_id));

create policy staff_attendance_select on public.staff_attendance
  for select to authenticated using (public.can_read_store_doc(store_id, staff_id));

create policy fro_visits_select on public.fro_visits
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

create policy cash_handovers_select on public.cash_handovers
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

create policy fro_cash_advances_select on public.fro_cash_advances
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

create policy fro_expense_settlements_select on public.fro_expense_settlements
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

create policy fro_cash_refunds_select on public.fro_cash_refunds
  for select to authenticated using (public.can_read_store_doc(store_id, fro_staff_id));

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create policy expenses_select on public.expenses
  for select to authenticated using (
    public.is_company_admin()
    or (scope in ('store', 'fro') and public.is_store_admin() and store_id = public.auth_store_id())
    or (scope = 'fro' and public.is_fro() and fro_staff_id = public.auth_staff_id())
  );

-- ---------------------------------------------------------------------------
-- System
-- ---------------------------------------------------------------------------
create policy document_sequences_select on public.document_sequences
  for select to authenticated using (public.is_company_admin());

create policy notification_reads_select on public.notification_reads
  for select to authenticated using (profile_id = auth.uid());
create policy notification_reads_insert on public.notification_reads
  for insert to authenticated with check (profile_id = auth.uid());
create policy notification_reads_delete on public.notification_reads
  for delete to authenticated using (profile_id = auth.uid());

-- Anonymous users get nothing from these tables.
revoke all on all tables in schema public from anon;
