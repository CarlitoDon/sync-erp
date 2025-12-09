import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  console.warn(`✅ Created ${DEFAULT_PERMISSIONS.length} permissions`);

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
      },
    });

    // Create demo company
    const demoCompany = await prisma.company.upsert({
      where: { id: 'demo-company-001' },
      update: {},
      create: {
        id: 'demo-company-001',
        name: 'Demo Company',
      },
    });

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
  }

  console.warn('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
