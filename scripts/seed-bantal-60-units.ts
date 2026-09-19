import {
  prisma,
  Prisma,
  DepositPolicyType,
  UnitCondition,
  UnitStatus,
  CostingMethod,
} from '@sync-erp/database';

const SANTI_LIVING_COMPANY_ID = '04d0ed88-0db8-4641-b98b-101728cd0caa';

async function main(): Promise<void> {
  console.log('=== SEEDING BANTAL (60 UNITS) FOR SANTI LIVING ===\n');

  const company = await prisma.company.findUnique({
    where: { id: SANTI_LIVING_COMPANY_ID },
  });

  if (!company) {
    throw new Error(`Company with ID ${SANTI_LIVING_COMPANY_ID} not found.`);
  }

  // 1. Get Category
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

  // 2. Check or create Product
  const sku = 'BANTAL-STD';
  let product = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku,
      },
    },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: category.id,
        sku,
        name: 'Bantal Standar',
        price: new Prisma.Decimal(50000), // Replacement value
        averageCost: new Prisma.Decimal(35000), // Acquisition cost
        stockQty: 0,
        unitOfMeasure: 'PCS',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created product: ${product.name} (${product.sku}) - ID: ${product.id}`);
  } else {
    console.log(`Found existing product: ${product.name} (${product.id})`);
  }

  // 3. Check or create RentalItem
  let rentalItem = await prisma.rentalItem.findUnique({
    where: { productId: product.id },
  });

  if (!rentalItem) {
    rentalItem = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: product.id,
        dailyRate: new Prisma.Decimal(10000),
        weeklyRate: new Prisma.Decimal(45000),
        monthlyRate: new Prisma.Decimal(120000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(25000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for product: ${product.name} - ID: ${rentalItem.id}`);
  } else {
    console.log(`Found existing RentalItem: ${rentalItem.id}`);
  }

  // 4. Create 60 Physical RentalItemUnits
  const existingUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: rentalItem.id,
    },
    orderBy: { unitCode: 'asc' },
  });

  const targetCount = 60;
  const unitsNeeded = targetCount - existingUnits.length;

  if (unitsNeeded > 0) {
    console.log(`Creating ${unitsNeeded} units to reach ${targetCount}...`);
    const existingCodes = new Set(existingUnits.map((u) => u.unitCode));
    const newUnitsData: Prisma.RentalItemUnitCreateManyInput[] = [];

    let counter = 1;
    while (newUnitsData.length < unitsNeeded) {
      const code = `BANTAL-${String(counter).padStart(3, '0')}`;
      if (!existingCodes.has(code)) {
        newUnitsData.push({
          companyId: SANTI_LIVING_COMPANY_ID,
          rentalItemId: rentalItem.id,
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

    const result = await prisma.rentalItemUnit.createMany({
      data: newUnitsData,
    });
    console.log(`Successfully created ${result.count} rental units for Bantal!`);
  } else {
    console.log(`Bantal already has ${existingUnits.length} units.`);
  }

  // 5. Audit & Summary
  const finalUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: rentalItem.id,
    },
    orderBy: { unitCode: 'asc' },
  });

  const availableUnits = finalUnits.filter((u) => u.status === UnitStatus.AVAILABLE);

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log(`Product: ${product.name} [${product.sku}]`);
  console.log(`Rental Item ID: ${rentalItem.id}`);
  console.log(`Daily Rate: Rp ${Number(rentalItem.dailyRate).toLocaleString('id-ID')}`);
  console.log(`Weekly Rate: Rp ${Number(rentalItem.weeklyRate).toLocaleString('id-ID')}`);
  console.log(`Monthly Rate: Rp ${Number(rentalItem.monthlyRate).toLocaleString('id-ID')}`);
  console.log(`Deposit Per Unit: Rp ${Number(rentalItem.depositPerUnit ?? 0).toLocaleString('id-ID')}`);
  console.log(`Total Physical Units: ${finalUnits.length}`);
  console.log(`Available Units: ${availableUnits.length}`);
  console.log('Sample Unit Codes:', finalUnits.slice(0, 5).map((u) => u.unitCode).join(', '), '...', finalUnits.slice(-5).map((u) => u.unitCode).join(', '));
}

main()
  .catch((err: unknown) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
