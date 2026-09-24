import { prisma } from '@sync-erp/database';
import { DepositPolicyType, UnitCondition, UnitStatus } from '@sync-erp/database';

async function main() {
  console.log('🌱 Starting Rental Catalog, Units, and Bundles Seed...');

  const santiLiving = await prisma.company.findFirst({
    where: { name: { contains: 'Santi Living', mode: 'insensitive' } },
  });

  if (!santiLiving) {
    throw new Error('Santi Living company not found!');
  }

  const companyId = santiLiving.id;
  console.log(`🏢 Company: ${santiLiving.name} (${companyId})`);

  // 1. Create or get Rental Categories
  console.log('📦 Step 1: Creating Rental Categories...');
  const categoryDefs = [
    { name: 'Kasur Busa', description: 'Kasur busa berbagai ukuran (90, 100, 120, 160)' },
    { name: 'Sprei', description: 'Sprei kasur katun polos' },
    { name: 'Bantal & Guling', description: 'Bantal tidur, guling standar & panjang' },
    { name: 'Selimut', description: 'Selimut tidur lembut' },
    { name: 'Elektronik & Pendingin', description: 'Kipas angin, air cooler' },
    { name: 'Perlengkapan Acara', description: 'Kursi plastik, meja' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoryDefs) {
    const existing = await prisma.rentalItemCategory.findFirst({
      where: { companyId, name: cat.name },
    });
    if (existing) {
      categoryMap.set(cat.name, existing.id);
    } else {
      const created = await prisma.rentalItemCategory.create({
        data: { companyId, name: cat.name, description: cat.description },
      });
      categoryMap.set(cat.name, created.id);
    }
  }

  // 2. Define Items with Daily Rates and Physical Units from User Asset List
  console.log('🛏️ Step 2: Creating Products, Rental Items, and Physical Units...');

  interface UnitSpec {
    count: number;
    prefix: string;
    condition: UnitCondition;
    status: UnitStatus;
    notes?: string;
  }

  interface ItemDef {
    name: string;
    sku: string;
    categoryName: string;
    dailyRate: number;
    units: UnitSpec[];
  }

  const itemDefinitions: ItemDef[] = [
    // --- KASUR BUSA ---
    {
      name: 'Kasur Busa 90x200',
      sku: 'KSR-90',
      categoryName: 'Kasur Busa',
      dailyRate: 30000,
      units: [{ count: 13, prefix: 'KSR90', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Kasur Busa 100x200',
      sku: 'KSR-100',
      categoryName: 'Kasur Busa',
      dailyRate: 35000,
      units: [{ count: 6, prefix: 'KSR100', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Kasur Busa 120x200',
      sku: 'KSR-120',
      categoryName: 'Kasur Busa',
      dailyRate: 40000,
      units: [{ count: 7, prefix: 'KSR120', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Kasur Busa 160x200',
      sku: 'KSR-160',
      categoryName: 'Kasur Busa',
      dailyRate: 50000,
      units: [{ count: 8, prefix: 'KSR160', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },

    // --- SPREI ---
    {
      name: 'Sprei 160x200',
      sku: 'SPR-160',
      categoryName: 'Sprei',
      dailyRate: 10000,
      units: [{ count: 15, prefix: 'SPR160', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Sprei 120x200',
      sku: 'SPR-120',
      categoryName: 'Sprei',
      dailyRate: 10000,
      units: [
        { count: 14, prefix: 'SPR120', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE },
        { count: 2, prefix: 'SPR120-BLG', condition: UnitCondition.NEEDS_REPAIR, status: UnitStatus.MAINTENANCE, notes: 'Bolong 2' },
      ],
    },
    {
      name: 'Sprei 100x200',
      sku: 'SPR-100',
      categoryName: 'Sprei',
      dailyRate: 10000,
      units: [{ count: 15, prefix: 'SPR100', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Sprei 90x200',
      sku: 'SPR-90',
      categoryName: 'Sprei',
      dailyRate: 10000,
      units: [
        { count: 23, prefix: 'SPR90', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE },
        { count: 1, prefix: 'SPR90-SBK', condition: UnitCondition.NEEDS_REPAIR, status: UnitStatus.MAINTENANCE, notes: 'Sobek 1' },
      ],
    },

    // --- BANTAL & GULING & SARUNG ---
    {
      name: 'Bantal Standar',
      sku: 'BTL-STD',
      categoryName: 'Bantal & Guling',
      dailyRate: 10000,
      units: [{ count: 62, prefix: 'BTL', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Guling Standar',
      sku: 'GLG-STD',
      categoryName: 'Bantal & Guling',
      dailyRate: 10000,
      units: [{ count: 7, prefix: 'GLG-STD', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Guling Panjang',
      sku: 'GLG-PJG',
      categoryName: 'Bantal & Guling',
      dailyRate: 10000,
      units: [{ count: 1, prefix: 'GLG-PJG', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Sarung Bantal',
      sku: 'SRB-STD',
      categoryName: 'Bantal & Guling',
      dailyRate: 0,
      units: [
        { count: 80, prefix: 'SRB', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE },
        { count: 1, prefix: 'SRB-BLG', condition: UnitCondition.NEEDS_REPAIR, status: UnitStatus.MAINTENANCE, notes: 'Bolong 1' },
        { count: 1, prefix: 'SRB-KTR', condition: UnitCondition.FAIR, status: UnitStatus.CLEANING, notes: 'Kotor 1' },
        { count: 11, prefix: 'SRB-SBK', condition: UnitCondition.NEEDS_REPAIR, status: UnitStatus.MAINTENANCE, notes: 'Sobek 11' },
      ],
    },
    {
      name: 'Sarung Guling',
      sku: 'SRG-STD',
      categoryName: 'Bantal & Guling',
      dailyRate: 0,
      units: [{ count: 87, prefix: 'SRG', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },

    // --- SELIMUT ---
    {
      name: 'Selimut 120',
      sku: 'SLM-120',
      categoryName: 'Selimut',
      dailyRate: 10000,
      units: [{ count: 3, prefix: 'SLM120', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Selimut 160',
      sku: 'SLM-160',
      categoryName: 'Selimut',
      dailyRate: 10000,
      units: [{ count: 8, prefix: 'SLM160', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },

    // --- ELEKTRONIK & LAINNYA ---
    {
      name: 'Kipas Angin',
      sku: 'ELC-KPS',
      categoryName: 'Elektronik & Pendingin',
      dailyRate: 15000,
      units: [{ count: 2, prefix: 'KPS', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Air Cooler',
      sku: 'ELC-ACR',
      categoryName: 'Elektronik & Pendingin',
      dailyRate: 35000,
      units: [{ count: 3, prefix: 'ACR', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
    {
      name: 'Kursi Plastik Biru',
      sku: 'EVT-KRS-BLU',
      categoryName: 'Perlengkapan Acara',
      dailyRate: 3000,
      units: [{ count: 100, prefix: 'KRS', condition: UnitCondition.GOOD, status: UnitStatus.AVAILABLE }],
    },
  ];

  const rentalItemMap = new Map<string, string>(); // sku -> rentalItemId

  for (const itemDef of itemDefinitions) {
    const categoryId = categoryMap.get(itemDef.categoryName);

    // 1. Upsert Product
    let product = await prisma.product.findFirst({
      where: { companyId, sku: itemDef.sku },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          companyId,
          sku: itemDef.sku,
          name: itemDef.name,
          price: itemDef.dailyRate,
        },
      });
    }

    // 2. Upsert RentalItem
    let rentalItem = await prisma.rentalItem.findFirst({
      where: { companyId, productId: product.id },
    });
    if (!rentalItem) {
      rentalItem = await prisma.rentalItem.create({
        data: {
          companyId,
          productId: product.id,
          categoryId,
          dailyRate: itemDef.dailyRate,
          weeklyRate: itemDef.dailyRate * 7,
          monthlyRate: itemDef.dailyRate * 30,
          depositPolicyType: DepositPolicyType.PERCENTAGE,
          isActive: true,
        },
      });
    }
    rentalItemMap.set(itemDef.sku, rentalItem.id);

    // 3. Create Units
    for (const uSpec of itemDef.units) {
      for (let i = 1; i <= uSpec.count; i++) {
        const unitCode = `${uSpec.prefix}-${String(i).padStart(3, '0')}`;
        const existingUnit = await prisma.rentalItemUnit.findFirst({
          where: { companyId, unitCode },
        });

        if (!existingUnit) {
          await prisma.rentalItemUnit.create({
            data: {
              companyId,
              rentalItemId: rentalItem.id,
              unitCode,
              condition: uSpec.condition,
              status: uSpec.status,
              sourceNotes: uSpec.notes,
            },
          });
        }
      }
    }
    console.log(`   ✓ ${itemDef.name}: Units registered`);
  }

  // 3. Create Rental Bundles (Packages)
  console.log('📦 Step 3: Setting up Rental Packages / Bundles...');
  const bundleDefs = [
    {
      externalId: 'package-single-standard',
      name: 'Single Standard (Paket 90)',
      shortName: 'Paket 90',
      description: 'Kasur Busa 90 + Sprei + Bantal',
      dailyRate: 40000,
      dimensions: '90 x 200 cm',
      capacity: '1 orang',
      components: [
        { sku: 'KSR-90', quantity: 1, label: 'Kasur Busa 90x200' },
        { sku: 'SPR-90', quantity: 1, label: 'Sprei 90x200' },
        { sku: 'BTL-STD', quantity: 1, label: 'Bantal Standar' },
      ],
    },
    {
      externalId: 'package-single-super',
      name: 'Single Super (Paket 100)',
      shortName: 'Paket 100',
      description: 'Kasur Busa 100 + Sprei + Bantal',
      dailyRate: 45000,
      dimensions: '100 x 200 cm',
      capacity: '1 orang',
      components: [
        { sku: 'KSR-100', quantity: 1, label: 'Kasur Busa 100x200' },
        { sku: 'SPR-100', quantity: 1, label: 'Sprei 100x200' },
        { sku: 'BTL-STD', quantity: 1, label: 'Bantal Standar' },
      ],
    },
    {
      externalId: 'package-double',
      name: 'Double (Paket 120)',
      shortName: 'Paket 120',
      description: 'Kasur Busa 120 + Sprei + Bantal',
      dailyRate: 50000,
      dimensions: '120 x 200 cm',
      capacity: '1-2 orang',
      components: [
        { sku: 'KSR-120', quantity: 1, label: 'Kasur Busa 120x200' },
        { sku: 'SPR-120', quantity: 1, label: 'Sprei 120x200' },
        { sku: 'BTL-STD', quantity: 1, label: 'Bantal Standar' },
      ],
    },
    {
      externalId: 'package-queen',
      name: 'Queen (Paket 160)',
      shortName: 'Paket 160',
      description: 'Kasur Busa 160 + Sprei + 2 Bantal',
      dailyRate: 60000,
      dimensions: '160 x 200 cm',
      capacity: '2 orang',
      components: [
        { sku: 'KSR-160', quantity: 1, label: 'Kasur Busa 160x200' },
        { sku: 'SPR-160', quantity: 1, label: 'Sprei 160x200' },
        { sku: 'BTL-STD', quantity: 2, label: '2 Bantal Standar' },
      ],
    },
  ];

  for (const bDef of bundleDefs) {
    let bundle = await prisma.rentalBundle.findFirst({
      where: { companyId, externalId: bDef.externalId },
    });

    if (!bundle) {
      bundle = await prisma.rentalBundle.create({
        data: {
          companyId,
          externalId: bDef.externalId,
          name: bDef.name,
          shortName: bDef.shortName,
          description: bDef.description,
          dailyRate: bDef.dailyRate,
          dimensions: bDef.dimensions,
          capacity: bDef.capacity,
          isActive: true,
        },
      });
    }

    // Attach Components
    await prisma.rentalBundleComponent.deleteMany({ where: { bundleId: bundle.id } });

    for (const comp of bDef.components) {
      const rentalItemId = rentalItemMap.get(comp.sku);
      if (rentalItemId) {
        await prisma.rentalBundleComponent.create({
          data: {
            bundleId: bundle.id,
            rentalItemId,
            quantity: comp.quantity,
            componentLabel: comp.label,
          },
        });
      }
    }
    console.log(`   ✓ ${bDef.name}: Components configured`);
  }

  // Summary counts
  const totalItems = await prisma.rentalItem.count({ where: { companyId } });
  const totalUnits = await prisma.rentalItemUnit.count({ where: { companyId } });
  const totalBundles = await prisma.rentalBundle.count({ where: { companyId } });

  console.log('\n🎉 Setup Completed Successfully!');
  console.log(`📊 Total Rental Items: ${totalItems}`);
  console.log(`📊 Total Physical Units: ${totalUnits}`);
  console.log(`📊 Total Rental Bundles: ${totalBundles}`);
}

main()
  .catch((err) => {
    console.error('❌ Error seeding rental catalog:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
