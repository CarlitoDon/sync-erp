-- Default Permissions Seed Script
-- Run this in your PostgreSQL database to set up default permissions for RBAC
-- This script creates permissions and links them to roles

-- Create default permissions for P2P flow
INSERT INTO "Permission" (id, module, action, scope) VALUES
  -- Bill operations
  (gen_random_uuid(), 'bill', 'create', 'ALL'),
  (gen_random_uuid(), 'bill', 'post', 'ALL'),
  (gen_random_uuid(), 'bill', 'void', 'ALL'),
  
  -- Payment operations
  (gen_random_uuid(), 'payment', 'create', 'ALL'),
  (gen_random_uuid(), 'payment', 'void', 'ALL'),
  
  -- Inventory operations  
  (gen_random_uuid(), 'inventory', 'create', 'ALL'),
  (gen_random_uuid(), 'inventory', 'post', 'ALL'),
  (gen_random_uuid(), 'inventory', 'void', 'ALL'),
  
  -- Order operations
  (gen_random_uuid(), 'purchase_order', 'create', 'ALL'),
  (gen_random_uuid(), 'purchase_order', 'confirm', 'ALL'),
  (gen_random_uuid(), 'purchase_order', 'cancel', 'ALL'),
  (gen_random_uuid(), 'purchase_order', 'close', 'ALL'),
  
  (gen_random_uuid(), 'sales_order', 'create', 'ALL'),
  (gen_random_uuid(), 'sales_order', 'confirm', 'ALL'),
  (gen_random_uuid(), 'sales_order', 'cancel', 'ALL'),
  
  -- Admin wildcard
  (gen_random_uuid(), '*', '*', 'ALL')
ON CONFLICT DO NOTHING;

-- Example: Grant all permissions to Owner role
-- (Run this per company after company setup)
/*
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT 
  gen_random_uuid(),
  r.id,
  p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name = 'Owner' 
  AND p.module = '*' AND p.action = '*'
ON CONFLICT DO NOTHING;
*/

-- Example: Grant void permissions to Finance Manager
/*
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT 
  gen_random_uuid(),
  r.id,
  p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name = 'Finance Manager' 
  AND p.module IN ('bill', 'payment') AND p.action = 'void'
ON CONFLICT DO NOTHING;
*/
