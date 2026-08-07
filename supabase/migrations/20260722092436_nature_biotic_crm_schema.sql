/*
# Nature Biotic CRM — Core Schema

1. Overview
Creates the full data model for the Nature Biotic CRM: company-owned retail stores
plus each store's products, farmers (customers), bills, and staff. All tables are
owner-scoped to the authenticated user via `user_id` on `stores`, with child tables
scoped through store ownership.

2. New Tables
- `stores` — retail outlets (e.g. "Sairam Agri Input"). Owner = user_id.
  - name, manager, location, phone, status, today_sales, monthly_sales,
    total_profit, outstanding, active_customers, inventory_value.
- `products` — products sold at a store. FK -> stores.
  - name, category, sku, price, stock, unit.
- `farmers` — customers of a store. FK -> stores.
  - name, phone, village, outstanding, total_purchases.
- `bills` — sales invoices at a store. FK -> stores.
  - farmer_name, items_count, total, payment_status, bill_date.
- `staff` — employees of a store. FK -> stores.
  - name, role, phone, status, joined_date.

3. Security
- RLS enabled on every table.
- Owner-scoped CRUD: authenticated users can only access rows belonging to
  stores they own. Child tables use EXISTS checks against the parent store.
- Owner column `stores.user_id` defaults to `auth.uid()` so inserts that omit
  it still satisfy the INSERT policy.

4. Notes
- Email confirmation stays OFF.
- All policies are split into 4 verbs (select/insert/update/delete).
*/

-- Stores
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  manager text NOT NULL,
  location text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  today_sales numeric(12,2) NOT NULL DEFAULT 0,
  monthly_sales numeric(12,2) NOT NULL DEFAULT 0,
  total_profit numeric(12,2) NOT NULL DEFAULT 0,
  outstanding numeric(12,2) NOT NULL DEFAULT 0,
  active_customers integer NOT NULL DEFAULT 0,
  inventory_value numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stores" ON stores;
CREATE POLICY "select_own_stores" ON stores FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_stores" ON stores;
CREATE POLICY "insert_own_stores" ON stores FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_stores" ON stores;
CREATE POLICY "update_own_stores" ON stores FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_stores" ON stores;
CREATE POLICY "delete_own_stores" ON stores FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Fertilizer',
  sku text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL DEFAULT 0,
  stock numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = products.store_id AND s.user_id = auth.uid()));

-- Farmers
CREATE TABLE IF NOT EXISTS farmers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  village text NOT NULL DEFAULT '',
  outstanding numeric(12,2) NOT NULL DEFAULT 0,
  total_purchases numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_farmers" ON farmers;
CREATE POLICY "select_own_farmers" ON farmers FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = farmers.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_farmers" ON farmers;
CREATE POLICY "insert_own_farmers" ON farmers FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = farmers.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_farmers" ON farmers;
CREATE POLICY "update_own_farmers" ON farmers FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = farmers.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = farmers.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_farmers" ON farmers;
CREATE POLICY "delete_own_farmers" ON farmers FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = farmers.store_id AND s.user_id = auth.uid()));

-- Bills
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  farmer_name text NOT NULL DEFAULT '',
  items_count integer NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Paid',
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bills" ON bills;
CREATE POLICY "select_own_bills" ON bills FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = bills.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_bills" ON bills;
CREATE POLICY "insert_own_bills" ON bills FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = bills.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_bills" ON bills;
CREATE POLICY "update_own_bills" ON bills FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = bills.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = bills.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_bills" ON bills;
CREATE POLICY "delete_own_bills" ON bills FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = bills.store_id AND s.user_id = auth.uid()));

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  joined_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_staff" ON staff;
CREATE POLICY "select_own_staff" ON staff FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = staff.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_staff" ON staff;
CREATE POLICY "insert_own_staff" ON staff FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = staff.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_staff" ON staff;
CREATE POLICY "update_own_staff" ON staff FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = staff.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = staff.store_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_staff" ON staff;
CREATE POLICY "delete_own_staff" ON staff FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = staff.store_id AND s.user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_farmers_store_id ON farmers(store_id);
CREATE INDEX IF NOT EXISTS idx_bills_store_id ON bills(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_store_id ON staff(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
