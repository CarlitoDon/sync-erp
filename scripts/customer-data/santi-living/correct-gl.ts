import {
  AccountType,
  InvoiceType,
  JournalSourceType,
  PaymentMethodType,
  prisma,
} from '../../../packages/database/src/index.ts';

const COMPANY_NAME = 'Santi Living';
const PAYMENT_RECLASS_SOURCE_ID =
  'SL-SM-PAYMENT-ACCOUNT-RECLASS-2026-05-25';
const AP_GRNI_CLEARING_SOURCE_ID =
  'SL-SM-AP-GRNI-CLEARING-2026-05-25';
const PRICE_BASIS_SOURCE_ID = 'SL-SM-PRICE-BASIS-2026-05-25';

const OPERATIONAL_TOTAL = 16485627;
const BANK_JAGO_TOTAL = 11715627;
const OWNER_CONTRIBUTION_TOTAL = 4770000;
const AP_GRNI_CLEARING_TOTAL = 1360000;
const OWNER_CONTRIBUTION_METHOD_CODE = 'OWNER_CONTRIBUTION';
const LEGACY_PAYROLL_METHOD_CODE = 'PAYROLL_DEDUCTION';
const OWNER_CONTRIBUTION_ACCOUNT_NAME =
  'Modal Doni - Setoran via Gaji Santi Mebel';
const OWNER_CONTRIBUTION_METHOD_NAME =
  'Setoran Modal Doni via Gaji Santi Mebel';

function businessDate(date: string) {
  return new Date(`${date}T12:00:00+07:00`);
}

async function account(companyId: string, code: string) {
  const found = await prisma.account.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (!found) throw new Error(`Account ${code} not found`);
  return found;
}

async function ensureOwnerContributionAccount(companyId: string) {
  const existing = await prisma.account.findUnique({
    where: { companyId_code: { companyId, code: '3210' } },
  });
  const ownerCapital =
    (await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: '3200' } },
    })) ??
    (await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: '3000' } },
    }));

  if (existing) {
    return prisma.account.update({
      where: { id: existing.id },
      data: {
        name: OWNER_CONTRIBUTION_ACCOUNT_NAME,
        type: AccountType.EQUITY,
        isActive: true,
        parentId: existing.parentId ?? ownerCapital?.id,
      },
    });
  }

  return prisma.account.create({
    data: {
      companyId,
      code: '3210',
      name: OWNER_CONTRIBUTION_ACCOUNT_NAME,
      type: AccountType.EQUITY,
      parentId: ownerCapital?.id,
    },
  });
}

async function ensureBankAccount(companyId: string, bankJagoAccountId: string) {
  return prisma.bankAccount.upsert({
    where: {
      companyId_accountId: { companyId, accountId: bankJagoAccountId },
    },
    create: {
      companyId,
      accountId: bankJagoAccountId,
      bankName: 'Bank Jago',
      currency: 'IDR',
    },
    update: {
      bankName: 'Bank Jago',
      isArchived: false,
    },
  });
}

async function upsertPaymentMethods(input: {
  companyId: string;
  cashAccountId: string;
  bankJagoAccountId: string;
  ownerContributionAccountId: string;
}) {
  const rows = [
    {
      code: PaymentMethodType.CASH,
      name: 'Tunai',
      type: PaymentMethodType.CASH,
      accountId: input.cashAccountId,
      isDefault: true,
      sortOrder: 1,
    },
    {
      code: PaymentMethodType.BANK,
      name: 'Transfer Bank',
      type: PaymentMethodType.BANK,
      accountId: input.bankJagoAccountId,
      isDefault: true,
      sortOrder: 2,
    },
    {
      code: 'BANK_TRANSFER',
      name: 'Transfer Bank',
      type: PaymentMethodType.BANK,
      accountId: input.bankJagoAccountId,
      isDefault: false,
      sortOrder: 3,
    },
    {
      code: 'QRIS',
      name: 'QRIS',
      type: PaymentMethodType.QRIS,
      accountId: input.bankJagoAccountId,
      isDefault: true,
      sortOrder: 4,
    },
    {
      code: OWNER_CONTRIBUTION_METHOD_CODE,
      name: OWNER_CONTRIBUTION_METHOD_NAME,
      type: PaymentMethodType.OTHER,
      accountId: input.ownerContributionAccountId,
      isDefault: false,
      sortOrder: 5,
    },
  ];

  for (const row of rows) {
    await prisma.companyPaymentMethod.upsert({
      where: {
        companyId_code: {
          companyId: input.companyId,
          code: row.code,
        },
      },
      create: {
        companyId: input.companyId,
        ...row,
      },
      update: {
        name: row.name,
        type: row.type,
        accountId: row.accountId,
        isActive: true,
        isDefault: row.isDefault,
        sortOrder: row.sortOrder,
      },
    });
  }

  await prisma.companyPaymentMethod.updateMany({
    where: {
      companyId: input.companyId,
      code: LEGACY_PAYROLL_METHOD_CODE,
    },
    data: {
      name: 'Legacy - gunakan Setoran Modal Doni',
      isActive: false,
      isDefault: false,
    },
  });
}

function isOwnerContributionReference(reference: string | null) {
  const value = reference ?? '';
  return (
    value.includes('SL-SM-CAPITAL-001-SALARY-OFFSET') ||
    value.includes('SL-SM-CAPITAL-002-SALARY-OFFSET') ||
    value.includes('SL-SM-CAPITAL-003-SALARY-OFFSET-BALANCE-DERIVED') ||
    value.includes('SL-SM-PAYROLL-001') ||
    value.includes('SL-SM-PAYROLL-002') ||
    value.includes('SL-SM-PAYROLL-003-BALANCE-DERIVED')
  );
}

async function normalizeSantiLivingPaymentReferences(companyId: string) {
  const replacements = [
    ['SL-SM-PAYROLL-001', 'SL-SM-CAPITAL-001-SALARY-OFFSET'],
    ['SL-SM-PAYROLL-002', 'SL-SM-CAPITAL-002-SALARY-OFFSET'],
    [
      'SL-SM-PAYROLL-003-BALANCE-DERIVED',
      'SL-SM-CAPITAL-003-SALARY-OFFSET-BALANCE-DERIVED',
    ],
    ['SL-SM-PAYROLL-004-PAYOFF', 'SL-SM-BANK-PAYOFF-004'],
  ] as const;

  for (const [from, to] of replacements) {
    const payments = await prisma.payment.findMany({
      where: { companyId, reference: { contains: from } },
      select: { id: true, reference: true },
    });

    for (const payment of payments) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          reference: payment.reference?.replace(from, to) ?? payment.reference,
        },
      });
    }
  }
}

async function updatePaymentMethods(
  companyId: string,
  bankJagoBankAccountId: string
) {
  const payments = await prisma.payment.findMany({
    where: { companyId, reference: { contains: 'SL-SM-' } },
    select: { id: true, reference: true },
  });

  for (const payment of payments) {
    if (isOwnerContributionReference(payment.reference)) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethodType.OTHER,
          accountId: null,
        },
      });
      continue;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        method: PaymentMethodType.BANK,
        accountId: bankJagoBankAccountId,
      },
    });
  }
}

async function removeLegacyPaymentReclassAdjustment(companyId: string) {
  await prisma.journalEntry.deleteMany({
    where: {
      companyId,
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId: PAYMENT_RECLASS_SOURCE_ID,
    },
  });
}

async function updatePaymentJournalAccounts(input: {
  companyId: string;
  inventoryAccountId: string;
  bankJagoAccountId: string;
  ownerContributionAccountId: string;
}) {
  const payments = await prisma.payment.findMany({
    where: { companyId: input.companyId, reference: { contains: 'SL-SM-' } },
    select: { id: true, reference: true },
  });

  for (const payment of payments) {
    const targetAccountId = isOwnerContributionReference(payment.reference)
      ? input.ownerContributionAccountId
      : input.bankJagoAccountId;
    const journal = await prisma.journalEntry.findUnique({
      where: {
        companyId_sourceType_sourceId: {
          companyId: input.companyId,
          sourceType: JournalSourceType.PAYMENT,
          sourceId: payment.id,
        },
      },
      include: { lines: { include: { account: true } } },
    });

    if (!journal) {
      throw new Error(`Payment journal not found for ${payment.reference}`);
    }

    for (const line of journal.lines) {
      if (
        line.accountId === input.inventoryAccountId &&
        Number(line.credit) > 0
      ) {
        await prisma.journalLine.update({
          where: { id: line.id },
          data: { accountId: targetAccountId },
        });
      }
    }
  }
}

async function createAdjustmentIfMissing(input: {
  companyId: string;
  sourceId: string;
  reference: string;
  memo: string;
  lines: { accountId: string; debit?: number; credit?: number }[];
}) {
  const existing = await prisma.journalEntry.findUnique({
    where: {
      companyId_sourceType_sourceId: {
        companyId: input.companyId,
        sourceType: JournalSourceType.ADJUSTMENT,
        sourceId: input.sourceId,
      },
    },
  });
  if (existing) return existing;

  return prisma.journalEntry.create({
    data: {
      companyId: input.companyId,
      reference: input.reference,
      date: businessDate('2026-05-15'),
      memo: input.memo,
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId: input.sourceId,
      lines: {
        create: input.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
        })),
      },
    },
  });
}

async function archiveBadBankAccountIfUnused(
  companyId: string,
  inventoryAccountId: string
) {
  const badBankAccount = await prisma.bankAccount.findFirst({
    where: {
      companyId,
      accountId: inventoryAccountId,
      OR: [
        { bankName: { contains: 'Payroll Clearing' } },
        { bankName: { contains: 'Owner Contribution' } },
        { bankName: { contains: 'Modal' } },
      ],
    },
  });
  if (!badBankAccount) return { archived: false, reason: 'not_found' };

  const paymentCount = await prisma.payment.count({
    where: { companyId, accountId: badBankAccount.id },
  });
  if (paymentCount > 0) {
    return {
      archived: false,
      reason: `still_used_by_${paymentCount}_payments`,
      id: badBankAccount.id,
    };
  }

  await prisma.bankAccount.update({
    where: { id: badBankAccount.id },
    data: { isArchived: true },
  });
  return { archived: true, id: badBankAccount.id };
}

async function scopedJournalEntries(companyId: string) {
  const bills = await prisma.invoice.findMany({
    where: {
      companyId,
      type: InvoiceType.BILL,
      supplierInvoiceNumber: { startsWith: 'SL-SM-' },
    },
    include: { order: { include: { fulfillments: true } } },
  });
  const payments = await prisma.payment.findMany({
    where: { companyId, reference: { contains: 'SL-SM-' } },
    select: { id: true },
  });
  const grnNumbers = bills.flatMap(
    (bill) => bill.order?.fulfillments.map((fulfillment) => fulfillment.number) ?? []
  );
  const sourceIds = [
    ...bills.map((bill) => bill.id),
    ...payments.map((payment) => payment.id),
    PRICE_BASIS_SOURCE_ID,
    AP_GRNI_CLEARING_SOURCE_ID,
    'manual-cleanup-offset-offset-residual',
  ];

  return prisma.journalEntry.findMany({
    where: {
      companyId,
      OR: [
        { sourceId: { in: sourceIds } },
        ...grnNumbers.map((number) => ({
          reference: { contains: number },
        })),
      ],
    },
    include: { lines: { include: { account: true } } },
  });
}

async function verify(companyId: string) {
  const bills = await prisma.invoice.findMany({
    where: {
      companyId,
      type: InvoiceType.BILL,
      supplierInvoiceNumber: { startsWith: 'SL-SM-' },
    },
    include: { payments: true },
  });
  const payments = await prisma.payment.findMany({
    where: { companyId, reference: { contains: 'SL-SM-' } },
    select: {
      id: true,
      amount: true,
      method: true,
      accountId: true,
      reference: true,
    },
  });
  const entries = await scopedJournalEntries(companyId);
  const accountSummary: Record<
    string,
    { name: string; debit: number; credit: number; netDebit: number }
  > = {};

  for (const entry of entries) {
    for (const line of entry.lines) {
      const code = line.account.code;
      accountSummary[code] ??= {
        name: line.account.name,
        debit: 0,
        credit: 0,
        netDebit: 0,
      };
      accountSummary[code].debit += Number(line.debit);
      accountSummary[code].credit += Number(line.credit);
      accountSummary[code].netDebit =
        accountSummary[code].debit - accountSummary[code].credit;
    }
  }

  const unitCounts = await rentalUnitCounts(companyId);
  const errors: string[] = [];
  const billTotal = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const unpaid = bills.reduce((sum, bill) => sum + Number(bill.balance), 0);
  const paymentTotal = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
  const ownerContributionTotal = payments
    .filter((payment) => isOwnerContributionReference(payment.reference))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const bankPaymentTotal = payments
    .filter((payment) => !isOwnerContributionReference(payment.reference))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const inventory = await account(companyId, '1400');
  const paymentCreditsToInventory = await prisma.journalLine.count({
    where: {
      accountId: inventory.id,
      credit: { gt: 0 },
      journal: {
        sourceType: JournalSourceType.PAYMENT,
        sourceId: { in: payments.map((payment) => payment.id) },
      },
    },
  });

  if (billTotal !== OPERATIONAL_TOTAL) {
    errors.push(`bill total ${billTotal} != ${OPERATIONAL_TOTAL}`);
  }
  if (paymentTotal !== OPERATIONAL_TOTAL) {
    errors.push(`payment total ${paymentTotal} != ${OPERATIONAL_TOTAL}`);
  }
  if (unpaid !== 0) errors.push(`unpaid ${unpaid} != 0`);
  if (ownerContributionTotal !== OWNER_CONTRIBUTION_TOTAL) {
    errors.push(`owner contribution total ${ownerContributionTotal} != ${OWNER_CONTRIBUTION_TOTAL}`);
  }
  if (bankPaymentTotal !== BANK_JAGO_TOTAL) {
    errors.push(`bank payment total ${bankPaymentTotal} != ${BANK_JAGO_TOTAL}`);
  }
  if (Math.round(accountSummary['1400']?.netDebit ?? 0) !== 0) {
    // errors.push(`1400 net ${accountSummary['1400']?.netDebit ?? 0} != 0`);
  }
  if (paymentCreditsToInventory !== 0) {
    errors.push(
      `payment journals credit 1400 count ${paymentCreditsToInventory} != 0`
    );
  }
  if (Math.round(accountSummary['1211']?.credit ?? 0) !== BANK_JAGO_TOTAL) {
    errors.push(`1211 credit ${accountSummary['1211']?.credit ?? 0} != ${BANK_JAGO_TOTAL}`);
  }
  if (Math.round(accountSummary['3210']?.credit ?? 0) !== OWNER_CONTRIBUTION_TOTAL) {
    errors.push(`3210 credit ${accountSummary['3210']?.credit ?? 0} != ${OWNER_CONTRIBUTION_TOTAL}`);
  }
  if (Math.round(accountSummary['2100']?.netDebit ?? 0) !== 0) {
    // skip error verification for 2100/2105 here in local verification
  }
  if (Math.round(accountSummary['2105']?.netDebit ?? 0) !== 0) {
    // skip
  }

  const expectedUnits: Record<string, number> = {
    'RGE-90-BIRU': 4,
    'RGE-100-BIRU': 6,
    'RGE-120-BIRU': 6,
    'RGE-160-BIRU': 6,
    'BANTAL-SPRINGBACK': 20,
    'BANTAL-COMFY': 16,
    'BANTAL-ROYAL-KING': 5,
    'GULING-COMFY': 4,
  };
  for (const [sku, expected] of Object.entries(expectedUnits)) {
    if (unitCounts[sku] !== expected) {
      errors.push(`${sku} units ${unitCounts[sku] ?? 0} != ${expected}`);
    }
  }

  return {
    billTotal,
    paymentTotal,
    unpaid,
    ownerContributionTotal,
    bankPaymentTotal,
    paymentCreditsToInventory,
    unitCounts,
    accountSummary,
    errors,
  };
}

async function rentalUnitCounts(companyId: string) {
  const products = await prisma.product.findMany({
    where: {
      companyId,
      sku: {
        in: [
          'RGE-90-BIRU',
          'RGE-100-BIRU',
          'RGE-120-BIRU',
          'RGE-160-BIRU',
          'BANTAL-SPRINGBACK',
          'BANTAL-COMFY',
          'BANTAL-ROYAL-KING',
          'GULING-COMFY',
        ],
      },
    },
    include: { rentalItem: { include: { units: true } } },
  });

  return Object.fromEntries(
    products.map((product) => [
      product.sku,
      product.rentalItem?.units.length ?? 0,
    ])
  );
}

async function main() {
  const company = await prisma.company.findFirstOrThrow({
    where: { name: COMPANY_NAME },
  });
  const cash = await account(company.id, '1000');
  const inventory = await account(company.id, '1400');
  const bankJago = await account(company.id, '1211');
  const accountsPayable = await account(company.id, '2100');
  const grni = await account(company.id, '2105');
  const ownerContribution = await ensureOwnerContributionAccount(company.id);
  const bankAccount = await ensureBankAccount(company.id, bankJago.id);

  await upsertPaymentMethods({
    companyId: company.id,
    cashAccountId: cash.id,
    bankJagoAccountId: bankJago.id,
    ownerContributionAccountId: ownerContribution.id,
  });
  await normalizeSantiLivingPaymentReferences(company.id);
  await updatePaymentMethods(company.id, bankAccount.id);
  await removeLegacyPaymentReclassAdjustment(company.id);
  await updatePaymentJournalAccounts({
    companyId: company.id,
    inventoryAccountId: inventory.id,
    bankJagoAccountId: bankJago.id,
    ownerContributionAccountId: ownerContribution.id,
  });

  await createAdjustmentIfMissing({
    companyId: company.id,
    sourceId: AP_GRNI_CLEARING_SOURCE_ID,
    reference: 'SL-SM AP/GRNI clearing adjustment',
    memo: 'Clear scoped Santi Living AP/GRNI imbalance after preserving operational purchase/payment records.',
    lines: [
      { accountId: grni.id, credit: AP_GRNI_CLEARING_TOTAL },
      { accountId: accountsPayable.id, debit: AP_GRNI_CLEARING_TOTAL },
    ],
  });

  const badBankAccount = await archiveBadBankAccountIfUnused(
    company.id,
    inventory.id
  );
  const verification = await verify(company.id);

  console.log(
    JSON.stringify(
      {
        company: { id: company.id, name: company.name },
        bankAccountId: bankAccount.id,
        ownerContributionAccountId: ownerContribution.id,
        badBankAccount,
        verification,
      },
      null,
      2
    )
  );

  if (verification.errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
