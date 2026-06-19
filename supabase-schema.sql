-- Create a table for bills (Maintain original structure)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  "billNumber" TEXT,
  "customerId" TEXT,
  "customerName" TEXT,
  "customerNameTamil" TEXT,
  "customerPhone" TEXT,
  "isNewCustomer" BOOLEAN,
  items JSONB,
  pages JSONB,
  subtotal NUMERIC,
  discount NUMERIC,
  "totalAmount" NUMERIC,
  "paidAmount" NUMERIC,
  "pendingAmount" NUMERIC,
  "paymentMethod" TEXT,
  status TEXT,
  "employeeId" TEXT,
  "employeeName" TEXT,
  "employeeBarcode" TEXT,
  "dueDate" TIMESTAMP WITH TIME ZONE,
  "isDelivery" BOOLEAN,
  "upiQrData" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "syncedToCloud" BOOLEAN,
  "isOfflineBill" BOOLEAN,
  "billImageBase64" TEXT  -- Base64-encoded PNG snapshot of the printed bill
);

-- Add the image column if the table already exists
ALTER TABLE bills ADD COLUMN IF NOT EXISTS "billImageBase64" TEXT;

-- Enable Row Level Security (RLS)
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Drop and re-create policies so all operations are allowed (development mode)
DROP POLICY IF EXISTS "Enable read access for all users" ON bills;
DROP POLICY IF EXISTS "Enable insert access for all users" ON bills;
DROP POLICY IF EXISTS "Enable update access for all users" ON bills;
DROP POLICY IF EXISTS "allow all" ON bills;

CREATE POLICY "allow all" ON bills FOR ALL USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────────────────────
-- UPGRADE SCHEMA: Drop old mismatching tables and recreate matching React models
-- ────────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS purchase_vouchers CASCADE;
DROP TABLE IF EXISTS stock_ledger CASCADE;
DROP TABLE IF EXISTS employee_tasks CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Create tables matching React frontend types

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "nameTamil" TEXT,
  phone TEXT NOT NULL,
  "isRegular" BOOLEAN DEFAULT false,
  "totalPurchases" NUMERIC DEFAULT 0,
  "pendingDues" NUMERIC DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "lastVisit" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "sortOrder" INTEGER DEFAULT 1
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "nameTamil" TEXT,
  category TEXT,
  price NUMERIC NOT NULL,
  "minPrice" NUMERIC NOT NULL,
  "maxPrice" NUMERIC NOT NULL,
  unit TEXT,
  uom TEXT,
  sku TEXT,
  stock NUMERIC DEFAULT 0,
  "stockQuantity" NUMERIC DEFAULT 0,
  "costPrice" NUMERIC DEFAULT 0,
  division TEXT,
  "conversionFactor" NUMERIC DEFAULT 1,
  barcode TEXT,
  "hsnCode" TEXT,
  "gstPercentage" NUMERIC DEFAULT 0,
  "lastPurchaseDate" TIMESTAMP WITH TIME ZONE,
  "productImage" TEXT,
  description TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  barcode TEXT,
  phone TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "isActive" BOOLEAN DEFAULT true,
  password_hash TEXT
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "supplierCode" TEXT,
  "contactPerson" TEXT,
  phone TEXT,
  email TEXT,
  "gstNumber" TEXT,
  "panNumber" TEXT,
  address1 TEXT,
  address2 TEXT,
  address3 TEXT,
  city TEXT,
  zip TEXT,
  state TEXT,
  country TEXT,
  "openingBalance" NUMERIC DEFAULT 0,
  "creditLimit" NUMERIC DEFAULT 0,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  "billId" TEXT,
  amount NUMERIC DEFAULT 0,
  method TEXT,
  "receivedBy" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_vouchers (
  id TEXT PRIMARY KEY,
  "voucherNumber" TEXT,
  "supplierId" TEXT,
  "supplierName" TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  branch TEXT,
  location TEXT,
  "purchaseAccount" TEXT,
  executive TEXT,
  remarks TEXT,
  "totalAmount" NUMERIC DEFAULT 0,
  items JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_ledger (
  id TEXT PRIMARY KEY,
  "productId" TEXT,
  type TEXT,
  quantity NUMERIC DEFAULT 0,
  "referenceId" TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE employee_tasks (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT,
  "employeeName" TEXT,
  "billNumber" TEXT,
  "startTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "endTime" TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  status TEXT
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT,
  "employeeName" TEXT,
  date TEXT,
  "checkIn" TEXT,
  "checkOut" TEXT,
  "totalHours" NUMERIC
);

CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  "storeName" TEXT,
  "storeAddress" TEXT,
  "storePhone" TEXT,
  "upiId" TEXT,
  "upiQrImageBase64" TEXT,
  "taxRate" NUMERIC,
  "defaultDueDays" INTEGER,
  "billFooterMessage" TEXT,
  "billFooterSubMessage" TEXT,
  "showQrOnBill" BOOLEAN,
  "fastGstApiKey" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "allow all" ON customers;
DROP POLICY IF EXISTS "allow all" ON categories;
DROP POLICY IF EXISTS "allow all" ON products;
DROP POLICY IF EXISTS "allow all" ON users;
DROP POLICY IF EXISTS "allow all" ON suppliers;
DROP POLICY IF EXISTS "allow all" ON payments;
DROP POLICY IF EXISTS "allow all" ON purchase_vouchers;
DROP POLICY IF EXISTS "allow all" ON stock_ledger;
DROP POLICY IF EXISTS "allow all" ON employee_tasks;
DROP POLICY IF EXISTS "allow all" ON attendance;
DROP POLICY IF EXISTS "allow all" ON settings;

-- Create public access policies for development
CREATE POLICY "allow all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON purchase_vouchers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON stock_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON employee_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON settings FOR ALL USING (true) WITH CHECK (true);

-- ── Daily Sales Reports (tax snapshots saved by admin) ───────────────────────
-- Drop and recreate to ensure correct TEXT primary key
DROP TABLE IF EXISTS daily_sales_reports CASCADE;

CREATE TABLE daily_sales_reports (
  id TEXT PRIMARY KEY,                         -- e.g. "daily-2026-05-21" or "monthly-2026-05"
  store_id TEXT,
  report_date DATE NOT NULL,
  report_type TEXT DEFAULT 'daily',            -- 'daily' or 'monthly'
  total_bills INTEGER DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  total_discount NUMERIC DEFAULT 0,
  cash_sales NUMERIC DEFAULT 0,
  upi_sales NUMERIC DEFAULT 0,
  card_sales NUMERIC DEFAULT 0,
  pending_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE daily_sales_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON daily_sales_reports;
CREATE POLICY "allow all" ON daily_sales_reports FOR ALL USING (true) WITH CHECK (true);
