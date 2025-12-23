import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { PrismaClient } from '../src/generated/client/client.js';

import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Default RBAC Permissions
const DEFAULT_PERMISSIONS = [
  // Company Module
  { module: 'COMPANY', action: 'CREATE', scope: 'ALL' },
  { module: 'COMPANY', action: 'READ', scope: 'ALL' },
  { module: 'COMPANY', action: 'UPDATE', scope: 'ALL' },
  { module: 'COMPANY', action: 'DELETE', scope: 'ALL' },

  // Sales Module
  { module: 'SALES', action: 'CREATE', scope: 'ALL' },
  { module: 'SALES', action: 'READ', scope: 'ALL' },
  { module: 'SALES', action: 'READ', scope: 'OWN' },
  { module: 'SALES', action: 'UPDATE', scope: 'ALL' },
  { module: 'SALES', action: 'DELETE', scope: 'ALL' },
  { module: 'SALES', action: 'APPROVE', scope: 'ALL' },

  // Purchasing Module
  { module: 'PURCHASING', action: 'CREATE', scope: 'ALL' },
  { module: 'PURCHASING', action: 'READ', scope: 'ALL' },
  { module: 'PURCHASING', action: 'UPDATE', scope: 'ALL' },
  { module: 'PURCHASING', action: 'DELETE', scope: 'ALL' },
  { module: 'PURCHASING', action: 'APPROVE', scope: 'ALL' },

  // Inventory Module
  { module: 'INVENTORY', action: 'CREATE', scope: 'ALL' },
  { module: 'INVENTORY', action: 'READ', scope: 'ALL' },
  { module: 'INVENTORY', action: 'UPDATE', scope: 'ALL' },
  { module: 'INVENTORY', action: 'DELETE', scope: 'ALL' },

  // Finance Module
  { module: 'FINANCE', action: 'CREATE', scope: 'ALL' },
  { module: 'FINANCE', action: 'READ', scope: 'ALL' },
  { module: 'FINANCE', action: 'UPDATE', scope: 'ALL' },
  { module: 'FINANCE', action: 'DELETE', scope: 'ALL' },
  { module: 'FINANCE', action: 'APPROVE', scope: 'ALL' },

  // Users Module
  { module: 'USERS', action: 'CREATE', scope: 'ALL' },
  { module: 'USERS', action: 'READ', scope: 'ALL' },
  { module: 'USERS', action: 'UPDATE', scope: 'ALL' },
  { module: 'USERS', action: 'DELETE', scope: 'ALL' },
];

async function main() {
  console.warn('🌱 Starting database seed...');

  // Seed default permissions
  console.warn('📝 Creating default permissions...');
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        module_action_scope: {
          module: perm.module,
          action: perm.action,
          scope: perm.scope,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.warn(
    `✅ Created ${DEFAULT_PERMISSIONS.length} permissions`
  );

  // Create demo company and admin user (for development)
  if (process.env.NODE_ENV !== 'production') {
    console.warn('👤 Creating demo data...');

    // Create demo user
    const demoUser = await prisma.user.upsert({
      where: { email: 'admin@sync-erp.local' },
      update: {},
      create: {
        email: 'admin@sync-erp.local',
        name: 'System Admin',
        passwordHash:
          '$2b$10$sw11gC0LBcucZMk3qa/Rq.04xFOFIjKDuXg7DSom9zHWfpsSFxIMe', // password: 'password'
      },
    });

    // Create demo company
    const demoCompany = await prisma.company.upsert({
      where: { id: 'demo-company-001' },
      update: {},
      create: {
        id: 'demo-company-001',
        name: 'Demo Company',
        businessShape: 'RETAIL',
      },
    });

    // ... (rest of permission/role logic unchanged) ...

    // Get all permissions for admin role
    const allPermissions = await prisma.permission.findMany();

    // Create admin role
    const adminRole = await prisma.role.upsert({
      where: {
        companyId_name: {
          companyId: demoCompany.id,
          name: 'Administrator',
        },
      },
      update: {},
      create: {
        name: 'Administrator',
        companyId: demoCompany.id,
      },
    });

    // Assign all permissions to admin role
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Assign user to company with admin role
    await prisma.companyMember.upsert({
      where: {
        userId_companyId: {
          userId: demoUser.id,
          companyId: demoCompany.id,
        },
      },
      update: { roleId: adminRole.id },
      create: {
        userId: demoUser.id,
        companyId: demoCompany.id,
        roleId: adminRole.id,
      },
    });

    console.warn('✅ Demo data created');
    console.warn(`   - User: ${demoUser.email}`);
    console.warn(`   - Company: ${demoCompany.name}`);
    console.warn(`   - Role: ${adminRole.name}`);
    console.warn(`   - Shape: RETAIL`);

    // ==========================================
    // 1a. Seed System Config
    // ==========================================
    console.warn('⚙️ Seeding System Config...');
    const CONFIGS = [
      { key: 'inventory.enabled', value: true },
      { key: 'inventory.costing_method', value: 'AVG' },
      { key: 'inventory.multi_warehouse', value: false },
      { key: 'inventory.wip_enabled', value: false },
    ];

    for (const config of CONFIGS) {
      const existing = await prisma.systemConfig.findFirst({
        where: {
          companyId: demoCompany.id,
          key: config.key,
        },
      });

      if (existing) {
        await prisma.systemConfig.update({
          where: { id: existing.id },
          data: { value: config.value },
        });
      } else {
        await prisma.systemConfig.create({
          data: {
            companyId: demoCompany.id,
            key: config.key,
            value: config.value,
          },
        });
      }
    }

    // ==========================================
    // 1. Seed Chart of Accounts
    // JournalService expects these specific codes:
    // Assets: 1100 Cash, 1200 Bank, 1300 AR, 1400 Inventory, 1500 VAT Receivable
    // Liabilities: 2100 AP, 2105 GRNI Accrual, 2300 VAT Payable
    // Revenue: 4100 Sales Revenue
    // Expenses: 5000 COGS, 5200 Inventory Adjustment
    // ==========================================
    console.warn('📊 Seeding Chart of Accounts...');
    const ACCOUNTS = [
      // Assets (1xxx)
      { code: '1100', name: 'Cash on Hand', type: 'ASSET' as const },
      { code: '1200', name: 'Bank Account', type: 'ASSET' as const },
      {
        code: '1210',
        name: 'Goods in Transit',
        type: 'ASSET' as const,
      },
      {
        code: '1300',
        name: 'Accounts Receivable',
        type: 'ASSET' as const,
      },
      {
        code: '1400',
        name: 'Inventory Asset',
        type: 'ASSET' as const,
      },
      {
        code: '1500',
        name: 'VAT Receivable (Input)',
        type: 'ASSET' as const,
      }, // JournalService expects this
      {
        code: '1600',
        name: 'Advances to Supplier', // Feature 036: Cash Upfront Payment
        type: 'ASSET' as const,
      },
      {
        code: '1700',
        name: 'Office Equipment',
        type: 'ASSET' as const,
      },

      // Liabilities (2xxx)
      {
        code: '2100',
        name: 'Accounts Payable',
        type: 'LIABILITY' as const,
      },
      {
        code: '2105',
        name: 'Accrued Liability (GRNI)',
        type: 'LIABILITY' as const,
      },
      {
        code: '2200',
        name: 'Sales Tax Payable',
        type: 'LIABILITY' as const,
      },
      {
        code: '2300',
        name: 'VAT Payable (Output)',
        type: 'LIABILITY' as const,
      }, // JournalService expects this

      // Equity (3xxx)
      {
        code: '3100',
        name: "Owner's Capital",
        type: 'EQUITY' as const,
      },
      {
        code: '3200',
        name: 'Retained Earnings',
        type: 'EQUITY' as const,
      },

      // Revenue (4xxx)
      {
        code: '4100',
        name: 'Sales Revenue',
        type: 'REVENUE' as const,
      }, // JournalService expects this
      {
        code: '4200',
        name: 'Service Income',
        type: 'REVENUE' as const,
      },

      // Expenses (5xxx, 6xxx)
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        type: 'EXPENSE' as const,
      }, // JournalService expects this
      {
        code: '5200',
        name: 'Inventory Adjustment',
        type: 'EXPENSE' as const,
      },
      {
        code: '6100',
        name: 'Rent Expense',
        type: 'EXPENSE' as const,
      },
      {
        code: '6200',
        name: 'Utilities Expense',
        type: 'EXPENSE' as const,
      },
      {
        code: '6300',
        name: 'Salaries Expense',
        type: 'EXPENSE' as const,
      },
    ];

    for (const acc of ACCOUNTS) {
      await prisma.account.upsert({
        where: {
          companyId_code: {
            companyId: demoCompany.id,
            code: acc.code,
          },
        },
        update: {},
        create: {
          companyId: demoCompany.id,
          ...acc,
        },
      });
    }

    // ==========================================
    // 2. Seed Partners
    // ==========================================
    console.warn('🤝 Seeding Partners...');
    const PARTNERS = [
      // Customers
      {
        type: 'CUSTOMER' as const,
        name: 'Adi Santoso',
        email: 'adi@example.com',
        address: 'Jl. Merdeka No. 1',
      },
      {
        type: 'CUSTOMER' as const,
        name: 'Budi Hartono',
        email: 'budi@example.com',
        address: 'Jl. Sudirman No. 45',
      },
      {
        type: 'CUSTOMER' as const,
        name: 'PT. Maju Jaya',
        email: 'procurement@majujaya.com',
        address: 'Kawasan Industri Pulogadung',
      },
      {
        type: 'CUSTOMER' as const,
        name: 'CV. Sejahtera',
        email: 'admin@sejahtera.id',
        address: 'Cikarang Barat',
      },
      {
        type: 'CUSTOMER' as const,
        name: 'Toko Elektronik Makmur',
        email: 'tem@example.com',
        address: 'Glodok Plaza',
      },

      // Suppliers
      {
        type: 'SUPPLIER' as const,
        name: 'PT. Component Ind',
        email: 'sales@comp-ind.com',
        address: 'Bekasi Timur',
      },
      {
        type: 'SUPPLIER' as const,
        name: 'Global Tech Supply',
        email: 'sales@globaltech.com',
        address: 'Jakarta Pusat',
      },
      {
        type: 'SUPPLIER' as const,
        name: 'CV. Packaging Solusi',
        email: 'order@packaging.com',
        address: 'Tangerang',
      },
      {
        type: 'SUPPLIER' as const,
        name: 'Distributor A1',
        email: 'sales@dist-a1.com',
        address: 'Mangga Dua',
      },
      {
        type: 'SUPPLIER' as const,
        name: 'Logistics Partner',
        email: 'ops@logistics.com',
        address: 'Bandara Soetta',
      },
    ];

    for (const p of PARTNERS) {
      await prisma.partner.create({
        data: {
          companyId: demoCompany.id,
          ...p,
        },
      });
    }

    // ==========================================
    // 3. Seed Products & Inventory
    // ==========================================
    console.warn('📦 Seeding Products...');
    const PRODUCTS = [
      {
        sku: 'LAP-001',
        name: 'Laptop Pro X1',
        price: 15000000,
        cost: 12000000,
        stock: 10,
      },
      {
        sku: 'MON-001',
        name: 'Monitor 24 Inch',
        price: 2500000,
        cost: 1800000,
        stock: 25,
      },
      {
        sku: 'KEY-001',
        name: 'Mechanical Keyboard',
        price: 850000,
        cost: 500000,
        stock: 50,
      },
      {
        sku: 'MOU-001',
        name: 'Wireless Mouse',
        price: 350000,
        cost: 150000,
        stock: 100,
      },
      {
        sku: 'DSK-001',
        name: 'Standing Desk',
        price: 4500000,
        cost: 2500000,
        stock: 5,
      },
      {
        sku: 'CHA-001',
        name: 'Ergo Chair',
        price: 3200000,
        cost: 1800000,
        stock: 8,
      },
      {
        sku: 'HDP-001',
        name: 'Noise Cancel Headphone',
        price: 1200000,
        cost: 750000,
        stock: 30,
      },
      {
        sku: 'CAB-001',
        name: 'USB-C Cable 2m',
        price: 150000,
        cost: 50000,
        stock: 200,
      },
      {
        sku: 'HUB-001',
        name: 'USB-C Hub Multi',
        price: 750000,
        cost: 400000,
        stock: 40,
      },
      {
        sku: 'CAM-001',
        name: 'Webcam 1080p',
        price: 950000,
        cost: 600000,
        stock: 15,
      },
    ];

    for (const prod of PRODUCTS) {
      // Create Product (no initial stock - will be added via GRN through API)
      await prisma.product.upsert({
        where: {
          companyId_sku: { companyId: demoCompany.id, sku: prod.sku },
        },
        update: {},
        create: {
          companyId: demoCompany.id,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          averageCost: prod.cost,
          stockQty: 0, // No initial stock - will come from GRN via API
        },
      });
    }
    // ==========================================
    // NOTE: Transactions (SO, PO, Invoices, Bills, Payments)
    // are NOT seeded here to ensure proper business logic.
    // Use ./scripts/seed-via-api.sh after base seed to create
    // transactions through the API with proper:
    // - Journal entries
    // - Balance updates
    // - Saga logs
    // - Inventory movements
    // ==========================================
  }

  console.warn('🎉 Database seed completed!');
  console.warn('');
  console.warn(
    '📌 Next step: Run ./scripts/seed-via-api.sh to create transactions'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
