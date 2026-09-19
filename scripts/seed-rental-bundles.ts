import {
  prisma,
  Prisma,
  DepositPolicyType,
  UnitCondition,
  UnitStatus,
  CostingMethod,
} from '@sync-erp/database';

const SANTI_LIVING_COMPANY_ID = '04d0ed88-0db8-4641-b98b-101728cd0caa';

interface SpreiItemConfig {
  sku: string;
  name: string;
  sizeLabel: string;
  unitPrefix: string;
  unitCount: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  depositPerUnit: number;
  price: number;
  averageCost: number;
}

const SPREI_CONFIGS: SpreiItemConfig[] = [
  {
    sku: 'SPREI-90',
    name: 'Sprei 90x200',
    sizeLabel: '90x200',
    unitPrefix: 'SPREI90',
    unitCount: 26, // 2x stock kasur 90 (13 x 2 = 26)
    dailyRate: 10000,
    weeklyRate: 45000,
    monthlyRate: 120000,
    depositPerUnit: 20000,
    price: 35000,
    averageCost: 25000,
  },
  {
    sku: 'SPREI-100',
    name: 'Sprei 100x200',
    sizeLabel: '100x200',
    unitPrefix: 'SPREI100',
    unitCount: 12, // 2x stock kasur 100 (6 x 2 = 12)
    dailyRate: 10000,
    weeklyRate: 45000,
    monthlyRate: 120000,
    depositPerUnit: 20000,
    price: 35000,
    averageCost: 25000,
  },
  {
    sku: 'SPREI-120',
    name: 'Sprei 120x200',
    sizeLabel: '120x200',
    unitPrefix: 'SPREI120',
    unitCount: 12, // 2x stock kasur 120 (6 x 2 = 12)
    dailyRate: 10000,
    weeklyRate: 45000,
    monthlyRate: 120000,
    depositPerUnit: 20000,
    price: 40000,
    averageCost: 30000,
  },
  {
    sku: 'SPREI-160',
    name: 'Sprei 160x200',
    sizeLabel: '160x200',
    unitPrefix: 'SPREI160',
    unitCount: 16, // 2x stock kasur 160 (8 x 2 = 16)
    dailyRate: 10000,
    weeklyRate: 45000,
    monthlyRate: 120000,
    depositPerUnit: 20000,
    price: 45000,
    averageCost: 35000,
  },
];

interface BundleDefinition {
  externalId: string;
  name: string;
  shortName: string;
  description: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  dimensions: string;
  capacity: string;
  imagePath: string;
  components: Array<{
    itemSku: string;
    quantity: number;
    label: string;
  }>;
}

const BUNDLE_DEFINITIONS: BundleDefinition[] = [
  {
    externalId: 'package-single-standard',
    name: 'Single Standard (Paket 90)',
    shortName: 'Paket 90',
    description: 'Paket Kasur busa 90x200 + Sprei 90 + 1 Bantal standar (Single)',
    dailyRate: 40000,
    weeklyRate: 180000,
    monthlyRate: 450000,
    dimensions: '90 x 200 cm',
    capacity: '1 orang',
    imagePath: '/images/paket-90.webp',
    components: [
      { itemSku: 'KASUR-90X200', quantity: 1, label: 'Kasur busa 90x200' },
      { itemSku: 'SPREI-90', quantity: 1, label: 'Sprei bersih 90x200' },
      { itemSku: 'BANTAL-STD', quantity: 1, label: 'Bantal standar' },
    ],
  },
  {
    externalId: 'package-single-super',
    name: 'Single Super (Paket 100)',
    shortName: 'Paket 100',
    description: 'Paket Kasur busa 100x200 + Sprei 100 + 1 Bantal standar (Single)',
    dailyRate: 45000,
    weeklyRate: 200000,
    monthlyRate: 500000,
    dimensions: '100 x 200 cm',
    capacity: '1 orang',
    imagePath: '/images/paket-100.webp',
    components: [
      { itemSku: 'KASUR-100X200', quantity: 1, label: 'Kasur busa 100x200' },
      { itemSku: 'SPREI-100', quantity: 1, label: 'Sprei bersih 100x200' },
      { itemSku: 'BANTAL-STD', quantity: 1, label: 'Bantal standar' },
    ],
  },
  {
    externalId: 'package-double',
    name: 'Double (Paket 120)',
    shortName: 'Paket 120',
    description: 'Paket Kasur busa 120x200 + Sprei 120 + 2 Bantal standar (Double)',
    dailyRate: 50000,
    weeklyRate: 220000,
    monthlyRate: 550000,
    dimensions: '120 x 200 cm',
    capacity: '1-2 orang',
    imagePath: '/images/paket-120.webp',
    components: [
      { itemSku: 'KASUR-120X200', quantity: 1, label: 'Kasur busa 120x200' },
      { itemSku: 'SPREI-120', quantity: 1, label: 'Sprei bersih 120x200' },
      { itemSku: 'BANTAL-STD', quantity: 2, label: 'Bantal standar' },
    ],
  },
  {
    externalId: 'package-queen',
    name: 'Queen (Paket 160)',
    shortName: 'Paket 160',
    description: 'Paket Kasur busa 160x200 + Sprei 160 + 2 Bantal standar (Double)',
    dailyRate: 60000,
    weeklyRate: 270000,
    monthlyRate: 700000,
    dimensions: '160 x 200 cm',
    capacity: '2 orang',
    imagePath: '/images/paket-160.webp',
    components: [
      { itemSku: 'KASUR-160X200', quantity: 1, label: 'Kasur busa 160x200' },
      { itemSku: 'SPREI-160', quantity: 1, label: 'Sprei bersih 160x200' },
      { itemSku: 'BANTAL-STD', quantity: 2, label: 'Bantal standar' },
    ],
  },
];

async function main(): Promise<void> {
  console.log('=== SEEDING RENTAL BUNDLES & SPREI FOR SANTI LIVING ===\n');

  const company = await prisma.company.findUnique({
    where: { id: SANTI_LIVING_COMPANY_ID },
  });

  if (!company) {
    throw new Error(`Company with ID ${SANTI_LIVING_COMPANY_ID} not found.`);
  }

  // 1. Get or create Category
  let category = await prisma.productCategory.findFirst({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      name: 'Kasur & Perlengkapan Tidur',
    },
  });

  if (!category) {
    category = await prisma.productCategory.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        name: 'Kasur & Perlengkapan Tidur',
        description: 'Kasur busa, sprei, bantal, guling dan perlengkapan tidur lainnya',
      },
    });
  }

  // 2. Create Sprei Items and physical units
  const rentalItemMap = new Map<string, string>(); // SKU -> RentalItem.id

  // Preload existing rental items
  const existingRentalItems = await prisma.rentalItem.findMany({
    where: { companyId: SANTI_LIVING_COMPANY_ID },
    include: { product: true },
  });

  for (const ri of existingRentalItems) {
    rentalItemMap.set(ri.product.sku, ri.id);
  }

  console.log('--- SEEDING SPREI INVENTORY ---');
  for (const cfg of SPREI_CONFIGS) {
    // Check or create Product
    let product = await prisma.product.findUnique({
      where: {
        companyId_sku: {
          companyId: SANTI_LIVING_COMPANY_ID,
          sku: cfg.sku,
        },
      },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          companyId: SANTI_LIVING_COMPANY_ID,
          categoryId: category.id,
          sku: cfg.sku,
          name: cfg.name,
          price: new Prisma.Decimal(cfg.price),
          averageCost: new Prisma.Decimal(cfg.averageCost),
          stockQty: 0,
          unitOfMeasure: 'PCS',
          costingMethod: CostingMethod.AVG,
          isService: false,
        },
      });
      console.log(`Created Product: ${product.name} [${product.sku}]`);
    } else {
      console.log(`Found Product: ${product.name} [${product.sku}]`);
    }

    // Check or create RentalItem
    let rentalItem = await prisma.rentalItem.findUnique({
      where: { productId: product.id },
    });

    if (!rentalItem) {
      rentalItem = await prisma.rentalItem.create({
        data: {
          companyId: SANTI_LIVING_COMPANY_ID,
          productId: product.id,
          dailyRate: new Prisma.Decimal(cfg.dailyRate),
          weeklyRate: new Prisma.Decimal(cfg.weeklyRate),
          monthlyRate: new Prisma.Decimal(cfg.monthlyRate),
          depositPolicyType: DepositPolicyType.PER_UNIT,
          depositPerUnit: new Prisma.Decimal(cfg.depositPerUnit),
          isActive: true,
        },
      });
      console.log(`  -> Created RentalItem: ${rentalItem.id}`);
    } else {
      console.log(`  -> Found RentalItem: ${rentalItem.id}`);
    }

    rentalItemMap.set(cfg.sku, rentalItem.id);

    // Create Units
    const existingUnits = await prisma.rentalItemUnit.findMany({
      where: {
        companyId: SANTI_LIVING_COMPANY_ID,
        rentalItemId: rentalItem.id,
      },
    });

    const needed = cfg.unitCount - existingUnits.length;
    if (needed > 0) {
      const existingCodes = new Set(existingUnits.map((u) => u.unitCode));
      const newUnits: Prisma.RentalItemUnitCreateManyInput[] = [];

      let counter = 1;
      while (newUnits.length < needed) {
        const code = `${cfg.unitPrefix}-${String(counter).padStart(3, '0')}`;
        if (!existingCodes.has(code)) {
          newUnits.push({
            companyId: SANTI_LIVING_COMPANY_ID,
            rentalItemId: rentalItem.id,
            unitCode: code,
            condition: UnitCondition.GOOD,
            status: UnitStatus.AVAILABLE,
            sizeLabel: cfg.sizeLabel,
            acquisitionCost: new Prisma.Decimal(cfg.averageCost),
            acquiredAt: new Date(),
          });
        }
        counter++;
      }

      await prisma.rentalItemUnit.createMany({ data: newUnits });
      console.log(`  -> Created ${newUnits.length} physical units for ${cfg.name}`);
    } else {
      console.log(`  -> Already has ${existingUnits.length} units (target: ${cfg.unitCount})`);
    }
  }

  // Also seed Selimut Standar as an Add-on item
  const selimutSku = 'SELIMUT-STD';
  let selimutProduct = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: selimutSku,
      },
    },
  });

  if (!selimutProduct) {
    selimutProduct = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: category.id,
        sku: selimutSku,
        name: 'Selimut Standar',
        price: new Prisma.Decimal(50000),
        averageCost: new Prisma.Decimal(35000),
        stockQty: 0,
        unitOfMeasure: 'PCS',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created Product: ${selimutProduct.name} [${selimutProduct.sku}]`);
  }

  let selimutRentalItem = await prisma.rentalItem.findUnique({
    where: { productId: selimutProduct.id },
  });

  if (!selimutRentalItem) {
    selimutRentalItem = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: selimutProduct.id,
        dailyRate: new Prisma.Decimal(10000),
        weeklyRate: new Prisma.Decimal(45000),
        monthlyRate: new Prisma.Decimal(120000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(25000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for Selimut: ${selimutRentalItem.id}`);
  }
  rentalItemMap.set(selimutSku, selimutRentalItem.id);

  const existingSelimutUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: selimutRentalItem.id,
    },
  });

  if (existingSelimutUnits.length < 10) {
    const needed = 10 - existingSelimutUnits.length;
    const existingCodes = new Set(existingSelimutUnits.map((u) => u.unitCode));
    const newUnits: Prisma.RentalItemUnitCreateManyInput[] = [];
    let counter = 1;
    while (newUnits.length < needed) {
      const code = `SELIMUT-${String(counter).padStart(3, '0')}`;
      if (!existingCodes.has(code)) {
        newUnits.push({
          companyId: SANTI_LIVING_COMPANY_ID,
          rentalItemId: selimutRentalItem.id,
          unitCode: code,
          condition: UnitCondition.GOOD,
          status: UnitStatus.AVAILABLE,
          sizeLabel: 'Standar',
          acquisitionCost: new Prisma.Decimal(35000),
          acquiredAt: new Date(),
        });
      }
      counter++;
    }
    await prisma.rentalItemUnit.createMany({ data: newUnits });
    console.log(`Created ${newUnits.length} physical units for Selimut Standar`);
  }

  // 3. Create or update Rental Bundles and their components
  console.log('\n--- SEEDING RENTAL BUNDLES ---');
  for (const bDef of BUNDLE_DEFINITIONS) {
    // Validate pricing incentive
    if (bDef.weeklyRate >= bDef.dailyRate * 7) {
      throw new Error(`Pricing violation: weeklyRate >= 7 * dailyRate for ${bDef.name}`);
    }
    if (bDef.monthlyRate >= bDef.dailyRate * 30) {
      throw new Error(`Pricing violation: monthlyRate >= 30 * dailyRate for ${bDef.name}`);
    }

    const bundle = await prisma.rentalBundle.upsert({
      where: {
        companyId_externalId: {
          companyId: SANTI_LIVING_COMPANY_ID,
          externalId: bDef.externalId,
        },
      },
      update: {
        name: bDef.name,
        shortName: bDef.shortName,
        description: bDef.description,
        dailyRate: new Prisma.Decimal(bDef.dailyRate),
        weeklyRate: new Prisma.Decimal(bDef.weeklyRate),
        monthlyRate: new Prisma.Decimal(bDef.monthlyRate),
        dimensions: bDef.dimensions,
        capacity: bDef.capacity,
        imagePath: bDef.imagePath,
        isActive: true,
      },
      create: {
        companyId: SANTI_LIVING_COMPANY_ID,
        externalId: bDef.externalId,
        name: bDef.name,
        shortName: bDef.shortName,
        description: bDef.description,
        dailyRate: new Prisma.Decimal(bDef.dailyRate),
        weeklyRate: new Prisma.Decimal(bDef.weeklyRate),
        monthlyRate: new Prisma.Decimal(bDef.monthlyRate),
        dimensions: bDef.dimensions,
        capacity: bDef.capacity,
        imagePath: bDef.imagePath,
        isActive: true,
      },
    });

    console.log(`Upserted Bundle: ${bundle.name} (${bundle.id})`);

    // Re-create components cleanly
    await prisma.rentalBundleComponent.deleteMany({
      where: { bundleId: bundle.id },
    });

    for (const comp of bDef.components) {
      const rentalItemId = rentalItemMap.get(comp.itemSku);
      if (!rentalItemId) {
        throw new Error(`RentalItem ID not found for SKU ${comp.itemSku}`);
      }

      await prisma.rentalBundleComponent.create({
        data: {
          bundleId: bundle.id,
          rentalItemId,
          quantity: comp.quantity,
          componentLabel: comp.label,
        },
      });
      console.log(`  -> Component: ${comp.label} (Qty: ${comp.quantity}, SKU: ${comp.itemSku})`);
    }
  }

  // 4. Verification & Summary
  console.log('\n=== VERIFICATION OF ALL BUNDLES ===');
  const allBundles = await prisma.rentalBundle.findMany({
    where: { companyId: SANTI_LIVING_COMPANY_ID, isActive: true },
    include: {
      components: {
        include: {
          rentalItem: {
            include: {
              product: true,
              units: { where: { status: UnitStatus.AVAILABLE } },
            },
          },
        },
      },
    },
    orderBy: { dailyRate: 'asc' },
  });

  for (const b of allBundles) {
    console.log(`\nBundle: ${b.name} [${b.externalId}]`);
    console.log(`  Tarif: Rp ${Number(b.dailyRate).toLocaleString('id-ID')}/hari | Rp ${Number(b.weeklyRate).toLocaleString('id-ID')}/minggu | Rp ${Number(b.monthlyRate).toLocaleString('id-ID')}/bulan`);
    console.log(`  Dimensi: ${b.dimensions} | Kapasitas: ${b.capacity}`);
    console.log(`  Komponen:`);
    for (const c of b.components) {
      const availUnits = c.rentalItem.units.length;
      console.log(`    - ${c.componentLabel}: Qty ${c.quantity} (Tersedia: ${availUnits} unit fisik '${c.rentalItem.product.name}')`);
    }
  }

  console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((err: unknown) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
