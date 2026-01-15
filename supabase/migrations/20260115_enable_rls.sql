-- Migration: Enable Row-Level Security for Multi-Tenant Data Isolation
-- Run: supabase db push --linked

-- ============================================================================
-- STEP 1: Enable RLS on all business tables
-- ============================================================================

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Partner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalBundle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalBundleComponent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RentalItemUnit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fulfillment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create company isolation policies
-- Uses session variable 'app.current_company' set by API middleware
-- ============================================================================

-- Order table
CREATE POLICY "company_isolation" ON "Order"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- Partner table
CREATE POLICY "company_isolation" ON "Partner"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- Product table
CREATE POLICY "company_isolation" ON "Product"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- ProductCategory table
CREATE POLICY "company_isolation" ON "ProductCategory"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- RentalOrder table
CREATE POLICY "company_isolation" ON "RentalOrder"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- RentalOrderItem table (via join to order)
CREATE POLICY "company_isolation" ON "RentalOrderItem"
  FOR ALL TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM "RentalOrder" ro 
      WHERE ro.id = "RentalOrderItem"."rentalOrderId"
      AND ro."companyId" = current_setting('app.current_company', true)::text
    )
  );

-- RentalItem table
CREATE POLICY "company_isolation" ON "RentalItem"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- RentalBundle table
CREATE POLICY "company_isolation" ON "RentalBundle"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- RentalBundleComponent (via join)
CREATE POLICY "company_isolation" ON "RentalBundleComponent"
  FOR ALL TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM "RentalBundle" rb 
      WHERE rb.id = "RentalBundleComponent"."bundleId"
      AND rb."companyId" = current_setting('app.current_company', true)::text
    )
  );

-- RentalItemUnit table (via join)
CREATE POLICY "company_isolation" ON "RentalItemUnit"
  FOR ALL TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM "RentalItem" ri 
      WHERE ri.id = "RentalItemUnit"."rentalItemId"
      AND ri."companyId" = current_setting('app.current_company', true)::text
    )
  );

-- Fulfillment table
CREATE POLICY "company_isolation" ON "Fulfillment"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- Invoice table
CREATE POLICY "company_isolation" ON "Invoice"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- Payment table
CREATE POLICY "company_isolation" ON "Payment"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- Account table
CREATE POLICY "company_isolation" ON "Account"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- JournalEntry table
CREATE POLICY "company_isolation" ON "JournalEntry"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- InventoryMovement table
CREATE POLICY "company_isolation" ON "InventoryMovement"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- Warehouse table
CREATE POLICY "company_isolation" ON "Warehouse"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- BankAccount table
CREATE POLICY "company_isolation" ON "BankAccount"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- ApiKey table (specific policy: only see own company's keys)
CREATE POLICY "company_isolation" ON "ApiKey"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);

-- ============================================================================
-- STEP 3: Create bypass policy for service role (admin operations)
-- ============================================================================

-- Service role bypasses RLS by default in Supabase
-- This is handled automatically, no additional policy needed.

-- ============================================================================
-- NOTES:
-- - All queries MUST set 'app.current_company' session variable before running
-- - Use: SELECT set_config('app.current_company', 'company-id', false);
-- - Prisma middleware will handle this automatically via $executeRaw
-- ============================================================================
