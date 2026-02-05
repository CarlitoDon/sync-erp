import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific .env file
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'test'
      ? '.env.test'
      : '.env';

// Use process.cwd() to resolve .env file relative to the package root
const envPath = path.join(process.cwd(), envFile);
// console.log('[Seeding] Loading env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(
    `Failed to load environment from ${envPath}`,
    result.error
  );
  process.exit(1);
}
import {
  PrismaClient,
  PermissionModule,
  PermissionAction,
  PermissionScope,
  BusinessShape,
} from '../src/generated/client/client.js';

import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not defined in environment');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

// Default RBAC Permissions
const DEFAULT_PERMISSIONS: {
  module: PermissionModule;
  action: PermissionAction;
  scope: PermissionScope;
}[] = [
  // Company Module
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },

  // Sales Module
  {
    module: PermissionModule.SALES,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.READ,
    scope: PermissionScope.OWN,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },

  // Purchasing Module
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },

  // Inventory Module
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.VOID,
    scope: PermissionScope.ALL,
  },

  // Finance Module
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.VOID,
    scope: PermissionScope.ALL,
  },

  // Users Module
  {
    module: PermissionModule.USERS,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
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

  // 1. Create Demo User
  {
    const adminEmail =
      process.env.SEED_ADMIN_EMAIL || 'admin@sync-erp.local';
    const adminPassword =
      process.env.SEED_ADMIN_PASSWORD || 'password';

    console.warn(`👤 Creating demo user (${adminEmail})...`);

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const demoUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
      },
      create: {
        email: adminEmail,
        name: 'System Admin',
        passwordHash,
      },
    });

    // 2. Define Companies to seed
    const COMPANIES = [
      {
        id: 'demo-company-rental',
        name: 'Demo Rental',
        businessShape: 'RENTAL',
      },
      {
        id: 'demo-company-retail',
        name: 'Demo Retail',
        businessShape: 'RETAIL',
      },
    ];

    // Data Definitions
    const CONFIGS = [
      { key: 'inventory.enabled', value: true },
      { key: 'inventory.costing_method', value: 'AVG' },
      { key: 'inventory.multi_warehouse', value: false },
      { key: 'inventory.wip_enabled', value: false },
    ];

    const ACCOUNTS = [
      // Assets (1xxx)
      {
        code: '1100',
        name: 'Cash',
        type: 'ASSET' as const,
        isGroup: true,
      },
      {
        code: '1101',
        name: 'Cash on Hand (Main)',
        type: 'ASSET' as const,
        parentCode: '1100',
      },
      {
        code: '1102',
        name: 'Petty Cash',
        type: 'ASSET' as const,
        parentCode: '1100',
      },
      {
        code: '1200',
        name: 'Bank',
        type: 'ASSET' as const,
        isGroup: true,
      },
      {
        code: '1201',
        name: 'BCA Corporate',
        type: 'ASSET' as const,
        parentCode: '1200',
      },
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
      },
      {
        code: '1600',
        name: 'Advances to Supplier',
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
        name: 'Customer Deposits',
        type: 'LIABILITY' as const,
      },
      {
        code: '2300',
        name: 'VAT Payable (Output)',
        type: 'LIABILITY' as const,
      },
      {
        code: '2400',
        name: 'Rental Deposits',
        type: 'LIABILITY' as const,
      }, // Fix: Added

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
      },
      {
        code: '4200',
        name: 'Service & Rental Income',
        type: 'REVENUE' as const,
      },

      // Expenses (5xxx, 6xxx)
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        type: 'EXPENSE' as const,
      },
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

    const PARTNERS = [
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
    ];

    const PRODUCTS = [
      {
        sku: 'LAP-001',
        name: 'Laptop Pro X1',
        price: 15000000,
        cost: 12000000,
      },
      {
        sku: 'CHA-001',
        name: 'Ergo Chair',
        price: 3200000,
        cost: 1800000,
      },
      {
        sku: 'HDP-001',
        name: 'Noise Cancel Headphone',
        price: 1200000,
        cost: 750000,
      },
    ];

    const BANK_ACCOUNTS = [
      {
        code: '1101',
        bankName: 'Cash on Hand (Main)',
        accountNumber: 'N/A',
      },
      { code: '1102', bankName: 'Petty Cash', accountNumber: 'N/A' },
      {
        code: '1201',
        bankName: 'BCA Corporate',
        accountNumber: '123-456-7890',
      },
    ];

    // Loop through companies
    for (const companyDef of COMPANIES) {
      console.warn(
        `🏢 Seeding Company: ${companyDef.name} (${companyDef.businessShape})...`
      );

      const company = await prisma.company.upsert({
        where: { id: companyDef.id },
        update: {
          businessShape: companyDef.businessShape as BusinessShape,
        },
        create: {
          id: companyDef.id,
          name: companyDef.name,
          businessShape: companyDef.businessShape as BusinessShape,
        },
      });

      // Role & Member
      const adminRole = await prisma.role.upsert({
        where: {
          companyId_name: {
            companyId: company.id,
            name: 'Administrator',
          },
        },
        update: {},
        create: { name: 'Administrator', companyId: company.id },
      });

      const allPermissions = await prisma.permission.findMany();
      for (const perm of allPermissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: { roleId: adminRole.id, permissionId: perm.id },
        });
      }

      await prisma.companyMember.upsert({
        where: {
          userId_companyId: {
            userId: demoUser.id,
            companyId: company.id,
          },
        },
        update: { roleId: adminRole.id },
        create: {
          userId: demoUser.id,
          companyId: company.id,
          roleId: adminRole.id,
        },
      });

      // Create API Key for rental company (multi-tenant integration)
      if (companyDef.businessShape === 'RENTAL') {
        const isDevelopment = process.env.NODE_ENV === 'development';

        // 1. Ensure Integration Record exists
        const appId = 'santi-living';
        const integration = await prisma.integration.upsert({
          where: {
            companyId_appId: { companyId: company.id, appId },
          },
          update: {},
          create: {
            companyId: company.id,
            appId,
            name: 'Santi Living',
            description: 'Official Santi Living Integration',
            icon: 'CubeIcon',
            isActive: true,
            config: {
              webhookUrl: isDevelopment
                ? 'http://localhost:3002/api/webhooks/sync-erp'
                : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
            },
          },
        });

        // Use development key for local dev, or fallback/production key for other envs (though this block is skipped in prod)
        const existingKey = isDevelopment
          ? 'dev_sync_erp_secret_key_2026'
          : 'santi_secret_auth_token_2026';

        const bcrypt = await import('bcryptjs');
        const keyHash = await bcrypt.hash(existingKey, 10);
        const keyPrefix = existingKey.substring(0, 11);

        await prisma.apiKey
          .upsert({
            where: { keyHash }, // Will fail uniqueness, use findFirst + create pattern
            update: {
              isActive: true,
              name: isDevelopment
                ? 'Santi Living Development'
                : 'Santi Living Production',
              integrationId: integration.id, // Link to integration
              webhookUrl: isDevelopment
                ? 'http://localhost:3002/api/webhooks/sync-erp'
                : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
            },
            create: {
              keyHash,
              keyPrefix,
              name: isDevelopment
                ? 'Santi Living Development'
                : 'Santi Living Production',
              companyId: company.id,
              integrationId: integration.id, // Link to integration
              permissions: ['rental:read', 'rental:write'],
              webhookUrl: isDevelopment
                ? 'http://localhost:3002/api/webhooks/sync-erp'
                : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
            },
          })
          .catch(async () => {
            // If upsert fails due to keyHash not being unique constraint, try findFirst
            const existing = await prisma.apiKey.findFirst({
              where: {
                companyId: company.id,
                name: 'Santi Living Production',
              },
            });
            if (!existing) {
              const existingApiKey = await prisma.apiKey.findFirst({
                where: {
                  companyId: company.id,
                  keyPrefix: keyPrefix,
                },
              });

              if (!existingApiKey) {
                await prisma.apiKey.create({
                  data: {
                    companyId: company.id,
                    integrationId: integration.id,
                    name: isDevelopment
                      ? 'Santi Living Development'
                      : 'Santi Living Production',
                    keyHash,
                    keyPrefix,
                    permissions: [
                      'publicRental.createOrder',
                      'publicRental.confirmPayment',
                    ],
                    webhookUrl: isDevelopment
                      ? 'http://localhost:3002/api/webhooks/sync-erp'
                      : 'https://proxy.santiliving.com/api/webhooks/sync-erp',
                    webhookSecret: 'whsec_test_123',
                    rateLimit: 1000,
                  },
                });
                console.log(`✅ API Key created for ${company.name}`);
              } else {
                console.log(
                  `ℹ️ API Key already exists for ${company.name}, skipping creation.`
                );
              }
            }
          });
        console.warn('🔑 API Key created for', companyDef.name);
      }

      // System Config
      for (const config of CONFIGS) {
        const existing = await prisma.systemConfig.findFirst({
          where: { companyId: company.id, key: config.key },
        });
        if (existing) {
          await prisma.systemConfig.update({
            where: { id: existing.id },
            data: { value: config.value },
          });
        } else {
          await prisma.systemConfig.create({
            data: {
              companyId: company.id,
              key: config.key,
              value: config.value,
            },
          });
        }
      }

      // Chart of Accounts
      for (const acc of ACCOUNTS) {
        let parentId: string | undefined;
        if ('parentCode' in acc && acc.parentCode) {
          const parent = await prisma.account.findUnique({
            where: {
              companyId_code: {
                companyId: company.id,
                code: acc.parentCode,
              },
            },
          });
          if (parent) parentId = parent.id;
        }

        const accTyped = acc as (typeof ACCOUNTS)[number];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { parentCode, ...accData } = accTyped;
        await prisma.account.upsert({
          where: {
            companyId_code: { companyId: company.id, code: acc.code },
          },
          update: { ...accData, parentId },
          create: { companyId: company.id, ...accData, parentId },
        });
      }

      // Partners
      for (const p of PARTNERS) {
        const existingPartner = await prisma.partner.findFirst({
          where: { companyId: company.id, name: p.name },
        });

        if (existingPartner) {
          await prisma.partner.update({
            where: { id: existingPartner.id },
            data: p,
          });
        } else {
          await prisma.partner.create({
            data: {
              companyId: company.id,
              ...p,
            },
          });
        }
      }

      // Products
      for (const prod of PRODUCTS) {
        await prisma.product.upsert({
          where: {
            companyId_sku: { companyId: company.id, sku: prod.sku },
          },
          update: {},
          create: {
            companyId: company.id,
            sku: prod.sku,
            name: prod.name,
            price: prod.price,
            averageCost: prod.cost,
            stockQty: 0,
          },
        });
      }

      // Bank Accounts
      for (const ba of BANK_ACCOUNTS) {
        const account = await prisma.account.findUnique({
          where: {
            companyId_code: { companyId: company.id, code: ba.code },
          },
        });
        if (account) {
          await prisma.bankAccount.upsert({
            where: {
              companyId_accountId: {
                companyId: company.id,
                accountId: account.id,
              },
            },
            update: {},
            create: {
              companyId: company.id,
              accountId: account.id,
              bankName: ba.bankName,
              accountNumber: ba.accountNumber,
              currency: 'IDR',
            },
          });
        }
      }
    }

    console.warn('✅ Demo data created for multiple companies');
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
