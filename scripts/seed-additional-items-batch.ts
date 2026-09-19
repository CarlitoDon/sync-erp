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
  console.log('=== SEEDING ADDITIONAL RENTAL ITEMS FOR SANTI LIVING ===\n');

  const company = await prisma.company.findUnique({
    where: { id: SANTI_LIVING_COMPANY_ID },
  });

  if (!company) {
    throw new Error(`Company with ID ${SANTI_LIVING_COMPANY_ID} not found.`);
  }

  // =========================================================================
  // 1. UPDATE KASUR 160x200: Add 2 units to make total 8 units
  // =========================================================================
  console.log('--- 1. Updating Kasur 160x200 (Add 2 units -> Total 8) ---');
  const kasur160Product = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: 'KASUR-160X200',
      },
    },
    include: { rentalItem: true },
  });

  if (!kasur160Product || !kasur160Product.rentalItem) {
    throw new Error('Kasur 160x200 or its RentalItem not found.');
  }

  const existing160Units = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: kasur160Product.rentalItem.id,
    },
    orderBy: { unitCode: 'asc' },
  });

  console.log(`Current Kasur 160x200 units count: ${existing160Units.length}`);
  const target160Count = 8;
  const needed160Count = target160Count - existing160Units.length;

  if (needed160Count > 0) {
    console.log(`Adding ${needed160Count} units for Kasur 160x200...`);
    const existing160Codes = new Set(existing160Units.map((u) => u.unitCode));
    const new160Units: Prisma.RentalItemUnitCreateManyInput[] = [];

    let counter = 1;
    while (new160Units.length < needed160Count) {
      const code = `KASUR160-${String(counter).padStart(3, '0')}`;
      if (!existing160Codes.has(code)) {
        new160Units.push({
          companyId: SANTI_LIVING_COMPANY_ID,
          rentalItemId: kasur160Product.rentalItem.id,
          unitCode: code,
          condition: UnitCondition.GOOD,
          status: UnitStatus.AVAILABLE,
          sizeLabel: '160x200',
          acquisitionCost: new Prisma.Decimal(700000),
          acquiredAt: new Date(),
        });
      }
      counter++;
    }

    await prisma.rentalItemUnit.createMany({ data: new160Units });
    console.log(`Created ${new160Units.length} new units: ${new160Units.map((u) => u.unitCode).join(', ')}`);
  } else {
    console.log(`Kasur 160x200 already has ${existing160Units.length} units.`);
  }

  // =========================================================================
  // 2. CATEGORIES SETUP
  // =========================================================================
  console.log('\n--- 2. Setting Up Categories ---');

  let catCooling = await prisma.productCategory.findFirst({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      name: 'Elektronik & Pendingin',
    },
  });
  if (!catCooling) {
    catCooling = await prisma.productCategory.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        name: 'Elektronik & Pendingin',
        description: 'Peralatan pendingin udara, air cooler, dan kipas angin ruangan',
      },
    });
    console.log(`Created category: ${catCooling.name}`);
  }

  let catDisplay = await prisma.productCategory.findFirst({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      name: 'Elektronik & Multimedia',
    },
  });
  if (!catDisplay) {
    catDisplay = await prisma.productCategory.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        name: 'Elektronik & Multimedia',
        description: 'TV display, monitor, dan perlengkapan multimedia acara',
      },
    });
    console.log(`Created category: ${catDisplay.name}`);
  }

  let catKarpet = await prisma.productCategory.findFirst({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      name: 'Karpet & Permadani',
    },
  });
  if (!catKarpet) {
    catKarpet = await prisma.productCategory.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        name: 'Karpet & Permadani',
        description: 'Karpet permadani basic, busa sponge, dan alas duduk lesehan acara',
      },
    });
    console.log(`Created category: ${catKarpet.name}`);
  }

  // =========================================================================
  // 3. AIR COOLER (1 Unit)
  // =========================================================================
  console.log('\n--- 3. Seeding Air Cooler (1 Unit) ---');
  let airCooler = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: 'AIR-COOLER',
      },
    },
  });

  if (!airCooler) {
    airCooler = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: catCooling.id,
        sku: 'AIR-COOLER',
        name: 'Air Cooler',
        price: new Prisma.Decimal(800000),
        averageCost: new Prisma.Decimal(550000),
        stockQty: 0,
        unitOfMeasure: 'UNIT',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created product: ${airCooler.name} (${airCooler.sku})`);
  }

  let airCoolerRental = await prisma.rentalItem.findUnique({
    where: { productId: airCooler.id },
  });
  if (!airCoolerRental) {
    airCoolerRental = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: airCooler.id,
        dailyRate: new Prisma.Decimal(35000),
        weeklyRate: new Prisma.Decimal(175000),
        monthlyRate: new Prisma.Decimal(450000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(100000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for Air Cooler: ID ${airCoolerRental.id}`);
  }

  const existingCoolerUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: airCoolerRental.id,
    },
  });
  if (existingCoolerUnits.length === 0) {
    await prisma.rentalItemUnit.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        rentalItemId: airCoolerRental.id,
        unitCode: 'COOLER-001',
        condition: UnitCondition.GOOD,
        status: UnitStatus.AVAILABLE,
        sizeLabel: 'Standar Portable',
        acquisitionCost: new Prisma.Decimal(550000),
        acquiredAt: new Date(),
      },
    });
    console.log('Created unit: COOLER-001');
  }

  // =========================================================================
  // 4. KIPAS ANGIN BERDIRI (2 Units)
  // =========================================================================
  console.log('\n--- 4. Seeding Kipas Angin Berdiri (2 Units) ---');
  let kipasProduct = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: 'KIPAS-BERDIRI',
      },
    },
  });

  if (!kipasProduct) {
    kipasProduct = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: catCooling.id,
        sku: 'KIPAS-BERDIRI',
        name: 'Kipas Angin Berdiri',
        price: new Prisma.Decimal(350000),
        averageCost: new Prisma.Decimal(250000),
        stockQty: 0,
        unitOfMeasure: 'UNIT',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created product: ${kipasProduct.name} (${kipasProduct.sku})`);
  }

  let kipasRental = await prisma.rentalItem.findUnique({
    where: { productId: kipasProduct.id },
  });
  if (!kipasRental) {
    kipasRental = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: kipasProduct.id,
        dailyRate: new Prisma.Decimal(25000),
        weeklyRate: new Prisma.Decimal(120000),
        monthlyRate: new Prisma.Decimal(300000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(50000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for Kipas Angin: ID ${kipasRental.id}`);
  }

  const existingKipasUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: kipasRental.id,
    },
  });
  if (existingKipasUnits.length < 2) {
    const existingKipasCodes = new Set(existingKipasUnits.map((u) => u.unitCode));
    const newKipasUnits: Prisma.RentalItemUnitCreateManyInput[] = [];
    for (let i = 1; i <= 2; i++) {
      const code = `KIPAS-${String(i).padStart(3, '0')}`;
      if (!existingKipasCodes.has(code)) {
        newKipasUnits.push({
          companyId: SANTI_LIVING_COMPANY_ID,
          rentalItemId: kipasRental.id,
          unitCode: code,
          condition: UnitCondition.GOOD,
          status: UnitStatus.AVAILABLE,
          sizeLabel: '16 Inch Stand',
          acquisitionCost: new Prisma.Decimal(250000),
          acquiredAt: new Date(),
        });
      }
    }
    if (newKipasUnits.length > 0) {
      await prisma.rentalItemUnit.createMany({ data: newKipasUnits });
      console.log(`Created units: ${newKipasUnits.map((u) => u.unitCode).join(', ')}`);
    }
  }

  // =========================================================================
  // 5. TV LED 32 INCH (1 Unit)
  // =========================================================================
  console.log('\n--- 5. Seeding TV LED 32 Inch (1 Unit) ---');
  let tvProduct = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: 'TV-LED-32',
      },
    },
  });

  if (!tvProduct) {
    tvProduct = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: catDisplay.id,
        sku: 'TV-LED-32',
        name: 'TV LED 32 Inch',
        price: new Prisma.Decimal(2000000),
        averageCost: new Prisma.Decimal(1400000),
        stockQty: 0,
        unitOfMeasure: 'UNIT',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created product: ${tvProduct.name} (${tvProduct.sku})`);
  }

  let tvRental = await prisma.rentalItem.findUnique({
    where: { productId: tvProduct.id },
  });
  if (!tvRental) {
    tvRental = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: tvProduct.id,
        dailyRate: new Prisma.Decimal(50000),
        weeklyRate: new Prisma.Decimal(250000),
        monthlyRate: new Prisma.Decimal(600000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(200000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for TV LED: ID ${tvRental.id}`);
  }

  const existingTvUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: tvRental.id,
    },
  });
  if (existingTvUnits.length === 0) {
    await prisma.rentalItemUnit.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        rentalItemId: tvRental.id,
        unitCode: 'TV32-001',
        condition: UnitCondition.GOOD,
        status: UnitStatus.AVAILABLE,
        sizeLabel: '32 Inch LED',
        acquisitionCost: new Prisma.Decimal(1400000),
        acquiredAt: new Date(),
      },
    });
    console.log('Created unit: TV32-001');
  }

  // =========================================================================
  // 6. KARPET PERMADANI BASIC (8 Units: 7 Merah, 1 Hijau)
  // =========================================================================
  console.log('\n--- 6. Seeding Karpet Permadani Basic (8 Units: 7 Merah, 1 Hijau) ---');
  let karpetBasic = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: 'KARPET-PERMADANI-BASIC',
      },
    },
  });

  if (!karpetBasic) {
    karpetBasic = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: catKarpet.id,
        sku: 'KARPET-PERMADANI-BASIC',
        name: 'Karpet Permadani Basic',
        price: new Prisma.Decimal(250000),
        averageCost: new Prisma.Decimal(160000),
        stockQty: 0,
        unitOfMeasure: 'PCS',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created product: ${karpetBasic.name} (${karpetBasic.sku})`);
  }

  let karpetBasicRental = await prisma.rentalItem.findUnique({
    where: { productId: karpetBasic.id },
  });
  if (!karpetBasicRental) {
    karpetBasicRental = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: karpetBasic.id,
        dailyRate: new Prisma.Decimal(30000),
        weeklyRate: new Prisma.Decimal(140000),
        monthlyRate: new Prisma.Decimal(350000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(50000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for Karpet Basic: ID ${karpetBasicRental.id}`);
  }

  const existingBasicUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: karpetBasicRental.id,
    },
  });

  if (existingBasicUnits.length < 8) {
    const existingBasicCodes = new Set(existingBasicUnits.map((u) => u.unitCode));
    const newBasicUnits: Prisma.RentalItemUnitCreateManyInput[] = [];

    // 7 Merah
    for (let i = 1; i <= 7; i++) {
      const code = `KRP-BSC-M0${i}`;
      if (!existingBasicCodes.has(code)) {
        newBasicUnits.push({
          companyId: SANTI_LIVING_COMPANY_ID,
          rentalItemId: karpetBasicRental.id,
          unitCode: code,
          condition: UnitCondition.GOOD,
          status: UnitStatus.AVAILABLE,
          color: 'Merah',
          sizeLabel: 'Basic - Merah',
          acquisitionCost: new Prisma.Decimal(160000),
          acquiredAt: new Date(),
        });
      }
    }

    // 1 Hijau
    const hijauCode = 'KRP-BSC-H01';
    if (!existingBasicCodes.has(hijauCode)) {
      newBasicUnits.push({
        companyId: SANTI_LIVING_COMPANY_ID,
        rentalItemId: karpetBasicRental.id,
        unitCode: hijauCode,
        condition: UnitCondition.GOOD,
        status: UnitStatus.AVAILABLE,
        color: 'Hijau',
        sizeLabel: 'Basic - Hijau',
        acquisitionCost: new Prisma.Decimal(160000),
        acquiredAt: new Date(),
      });
    }

    if (newBasicUnits.length > 0) {
      await prisma.rentalItemUnit.createMany({ data: newBasicUnits });
      console.log(`Created ${newBasicUnits.length} units for Karpet Basic: ${newBasicUnits.map((u) => u.unitCode).join(', ')}`);
    }
  }

  // =========================================================================
  // 7. KARPET PERMADANI BUSA SPONGE (4 Units: Cream)
  // =========================================================================
  console.log('\n--- 7. Seeding Karpet Permadani Busa Sponge (4 Units: Cream) ---');
  let karpetSponge = await prisma.product.findUnique({
    where: {
      companyId_sku: {
        companyId: SANTI_LIVING_COMPANY_ID,
        sku: 'KARPET-PERMADANI-SPONGE',
      },
    },
  });

  if (!karpetSponge) {
    karpetSponge = await prisma.product.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        categoryId: catKarpet.id,
        sku: 'KARPET-PERMADANI-SPONGE',
        name: 'Karpet Permadani Busa Sponge',
        price: new Prisma.Decimal(350000),
        averageCost: new Prisma.Decimal(220000),
        stockQty: 0,
        unitOfMeasure: 'PCS',
        costingMethod: CostingMethod.AVG,
        isService: false,
      },
    });
    console.log(`Created product: ${karpetSponge.name} (${karpetSponge.sku})`);
  }

  let karpetSpongeRental = await prisma.rentalItem.findUnique({
    where: { productId: karpetSponge.id },
  });
  if (!karpetSpongeRental) {
    karpetSpongeRental = await prisma.rentalItem.create({
      data: {
        companyId: SANTI_LIVING_COMPANY_ID,
        productId: karpetSponge.id,
        dailyRate: new Prisma.Decimal(40000),
        weeklyRate: new Prisma.Decimal(180000),
        monthlyRate: new Prisma.Decimal(450000),
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: new Prisma.Decimal(75000),
        isActive: true,
      },
    });
    console.log(`Created RentalItem for Karpet Busa Sponge: ID ${karpetSpongeRental.id}`);
  }

  const existingSpongeUnits = await prisma.rentalItemUnit.findMany({
    where: {
      companyId: SANTI_LIVING_COMPANY_ID,
      rentalItemId: karpetSpongeRental.id,
    },
  });

  if (existingSpongeUnits.length < 4) {
    const existingSpongeCodes = new Set(existingSpongeUnits.map((u) => u.unitCode));
    const newSpongeUnits: Prisma.RentalItemUnitCreateManyInput[] = [];

    for (let i = 1; i <= 4; i++) {
      const code = `KRP-SPG-C0${i}`;
      if (!existingSpongeCodes.has(code)) {
        newSpongeUnits.push({
          companyId: SANTI_LIVING_COMPANY_ID,
          rentalItemId: karpetSpongeRental.id,
          unitCode: code,
          condition: UnitCondition.GOOD,
          status: UnitStatus.AVAILABLE,
          color: 'Cream',
          sizeLabel: 'Sponge - Cream',
          acquisitionCost: new Prisma.Decimal(220000),
          acquiredAt: new Date(),
        });
      }
    }

    if (newSpongeUnits.length > 0) {
      await prisma.rentalItemUnit.createMany({ data: newSpongeUnits });
      console.log(`Created ${newSpongeUnits.length} units for Karpet Sponge: ${newSpongeUnits.map((u) => u.unitCode).join(', ')}`);
    }
  }

  // =========================================================================
  // 8. FINAL AUDIT & SUMMARY
  // =========================================================================
  console.log('\n=== FINAL INVENTORY RECAP ===');
  const allRentalItems = await prisma.rentalItem.findMany({
    where: { companyId: SANTI_LIVING_COMPANY_ID },
    include: {
      product: { include: { category: true } },
      units: { orderBy: { unitCode: 'asc' } },
    },
    orderBy: { product: { name: 'asc' } },
  });

  let grandTotalUnits = 0;
  for (const item of allRentalItems) {
    const totalUnits = item.units.length;
    const availUnits = item.units.filter((u) => u.status === UnitStatus.AVAILABLE).length;
    grandTotalUnits += totalUnits;
    console.log(
      `• ${item.product.name.padEnd(30)} [${item.product.category?.name || '-'}] : ${availUnits}/${totalUnits} Tersedia | Harian Rp ${Number(item.dailyRate).toLocaleString('id-ID')}`
    );
    console.log(`   Units: ${item.units.map((u) => u.unitCode).join(', ')}`);
  }

  console.log(`\nGrand Total Units Across All Rental Items: ${grandTotalUnits}`);
}

main()
  .catch((err: unknown) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
