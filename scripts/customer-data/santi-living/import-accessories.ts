import {
  DocumentStatus,
  InvoiceStatus,
  InvoiceType,
  JournalSourceType,
  MovementType,
  OrderStatus,
  OrderType,
  PaymentTerms,
  Prisma,
  prisma,
  SequenceType,
  type PrismaClient,
} from '@sync-erp/database';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

type ProductSpec = {
  sku: string;
  name: string;
  defaultPrice: number;
};

type AccessoryLine = {
  sku: string;
  quantity: number;
  unitCost: number;
};

type PurchaseSpec = {
  reference: string;
  date: string;
  mode: 'merge' | 'standalone';
  targetOrderNumber?: string;
  description: string;
  note: string;
  lines: AccessoryLine[];
};

type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
};

type Mutation = {
  action: string;
  detail: string;
};

const IMPORT_TAG = 'santi-living-accessories-2026-05-25';

const applyChanges = process.argv.includes('--apply');

const products: ProductSpec[] = [
  {
    sku: 'ACC-BANTAL-SPRINGBACK',
    name: 'Bantal Springback',
    defaultPrice: 50000,
  },
  {
    sku: 'ACC-BANTAL-COMFY',
    name: 'Bantal Comfy',
    defaultPrice: 40000,
  },
  {
    sku: 'ACC-BANTAL-ROYAL-KING',
    name: 'Bantal Royal King',
    defaultPrice: 28600,
  },
  {
    sku: 'ACC-GULING-COMFY',
    name: 'Guling Comfy',
    defaultPrice: 45000,
  },
];

const purchases: PurchaseSpec[] = [
  {
    reference: 'P002',
    date: '2026-02-13',
    mode: 'merge',
    targetOrderNumber: 'PO-202602-00001',
    description: 'Aksesori yang dibeli bersama kasur PO-202602-00001',
    note: 'Tambah bantal Springback 7 pcs @ Rp60.000 dari temuan WhatsApp. Pembelian kasur + aksesori digabung; pembayaran belum dicatat.',
    lines: [{ sku: 'ACC-BANTAL-SPRINGBACK', quantity: 7, unitCost: 60000 }],
  },
  {
    reference: 'P003',
    date: '2026-02-14',
    mode: 'merge',
    targetOrderNumber: 'PO-202602-00002',
    description: 'Aksesori yang dibeli bersama kasur PO-202602-00002',
    note: 'Tambah bantal Springback 2 pcs @ Rp60.000, bantal Comfy 7 pcs @ Rp40.000, dan bantal Royal King 1 pcs @ Rp30.000 dari temuan WhatsApp. Pembelian kasur + aksesori digabung; pembayaran belum dicatat.',
    lines: [
      { sku: 'ACC-BANTAL-SPRINGBACK', quantity: 2, unitCost: 60000 },
      { sku: 'ACC-BANTAL-COMFY', quantity: 7, unitCost: 40000 },
      { sku: 'ACC-BANTAL-ROYAL-KING', quantity: 1, unitCost: 30000 },
    ],
  },
  {
    reference: 'BG003',
    date: '2026-02-20',
    mode: 'standalone',
    description: 'Pembelian guling Comfy standalone dari Santi Mebel',
    note: 'Pembelian aksesori standalone dari temuan WhatsApp; pembayaran belum dicatat.',
    lines: [{ sku: 'ACC-GULING-COMFY', quantity: 4, unitCost: 45000 }],
  },
  {
    reference: 'P004',
    date: '2026-03-19',
    mode: 'merge',
    targetOrderNumber: 'PO-202603-00001',
    description: 'Aksesori yang dibeli bersama kasur PO-202603-00001',
    note: 'Tambah bantal Comfy 9 pcs @ Rp40.000 dari temuan WhatsApp. Draft Springback dikoreksi menjadi Comfy. Pembelian kasur + aksesori digabung; pembayaran belum dicatat.',
    lines: [{ sku: 'ACC-BANTAL-COMFY', quantity: 9, unitCost: 40000 }],
  },
  {
    reference: 'BG005',
    date: '2026-03-23',
    mode: 'standalone',
    description: 'Pembelian bantal Royal King standalone dari Santi Mebel',
    note: 'Pembelian aksesori standalone dari temuan WhatsApp; pembayaran belum dicatat.',
    lines: [{ sku: 'ACC-BANTAL-ROYAL-KING', quantity: 4, unitCost: 28600 }],
  },
  {
    reference: 'P006',
    date: '2026-04-18',
    mode: 'merge',
    targetOrderNumber: 'PO-202604-00002',
    description: 'Aksesori yang dibeli bersama kasur PO-202604-00002',
    note: 'Tambah bantal Springback 3 pcs @ Rp50.000 dari temuan WhatsApp. Pembelian kasur + aksesori digabung; pembayaran belum dicatat.',
    lines: [{ sku: 'ACC-BANTAL-SPRINGBACK', quantity: 3, unitCost: 50000 }],
  },
  {
    reference: 'BG007',
    date: '2026-05-06',
    mode: 'standalone',
    description: 'Pembelian bantal Springback standalone dari Santi Mebel',
    note: 'Pembelian aksesori standalone dari temuan WhatsApp. User mengklarifikasi bantal saja; 2 pcs masih belum diambil di Berjo per 2026-05-14. Pembayaran belum dicatat.',
    lines: [{ sku: 'ACC-BANTAL-SPRINGBACK', quantity: 8, unitCost: 50000 }],
  },
];

class DryRunRollback extends Error {
  constructor() {
    super('dry-run rollback');
  }
}

const money = (value: number) => new Prisma.Decimal(value);

const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const lineTotal = (line: AccessoryLine) => line.quantity * line.unitCost;

const purchaseTotal = (purchase: PurchaseSpec) =>
  purchase.lines.reduce((sum, line) => sum + lineTotal(line), 0);

const formatMoney = (value: number) =>
  `Rp${value.toLocaleString('id-ID')}`;

const appendImportNote = (
  existing: string | null | undefined,
  reference: string,
  note: string
) => {
  const marker = `[${IMPORT_TAG}:${reference}]`;
  if (existing?.includes(marker)) return existing;
  return [existing?.trim(), `${marker} ${note}`]
    .filter(Boolean)
    .join('\n');
};

const isSameInstant = (left: Date, right: Date) =>
  left.getTime() === right.getTime();

async function generateDocumentNumber(
  tx: Tx,
  companyId: string,
  type: SequenceType,
  businessDate: Date
) {
  const year = businessDate.getFullYear();
  const month = businessDate.getMonth() + 1;
  const sequence = await tx.documentSequence.upsert({
    where: {
      companyId_type_year_month: {
        companyId,
        type,
        year,
        month,
      },
    },
    create: {
      companyId,
      type,
      year,
      month,
      lastSequence: 1,
    },
    update: {
      lastSequence: { increment: 1 },
    },
  });

  return `${type}-${year}${String(month).padStart(2, '0')}-${String(
    sequence.lastSequence
  ).padStart(5, '0')}`;
}

async function generateReceiptNumber(
  tx: Tx,
  companyId: string,
  businessDate: Date
) {
  const count = await tx.fulfillment.count({
    where: { companyId, type: 'RECEIPT' },
  });
  return `GRN-${businessDate.getFullYear()}-${String(count + 1).padStart(
    4,
    '0'
  )}`;
}

async function ensureProducts(tx: Tx, companyId: string) {
  const result = new Map<string, { id: string; sku: string; name: string }>();

  for (const product of products) {
    const record = await tx.product.upsert({
      where: {
        companyId_sku: {
          companyId,
          sku: product.sku,
        },
      },
      create: {
        companyId,
        sku: product.sku,
        name: product.name,
        price: money(product.defaultPrice),
        unitOfMeasure: 'PCS',
        isService: false,
      },
      update: {},
      select: { id: true, sku: true, name: true },
    });
    result.set(product.sku, record);
  }

  return result;
}

async function postJournal(
  tx: Tx,
  companyId: string,
  input: {
    reference: string;
    memo: string;
    date: Date;
    sourceType: JournalSourceType;
    sourceId: string;
    lines: JournalLineInput[];
  },
  mutations: Mutation[]
) {
  const existing = await tx.journalEntry.findFirst({
    where: {
      companyId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
  });
  if (existing) {
    if (!isSameInstant(existing.date, input.date)) {
      await tx.journalEntry.update({
        where: { id: existing.id },
        data: {
          date: input.date,
          reference: input.reference,
          memo: input.memo,
        },
      });
      mutations.push({
        action: 'update-journal-date',
        detail: `${input.reference} -> ${input.date.toISOString().slice(0, 10)}`,
      });
      return existing;
    }
    mutations.push({
      action: 'skip-journal',
      detail: `${input.reference} already exists`,
    });
    return existing;
  }

  const accountCodes = [...new Set(input.lines.map((line) => line.accountCode))];
  const accounts = await tx.account.findMany({
    where: { companyId, code: { in: accountCodes } },
    select: { id: true, code: true },
  });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const missing = accountCodes.filter((code) => !accountByCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Missing account codes: ${missing.join(', ')}`);
  }

  const journal = await tx.journalEntry.create({
    data: {
      companyId,
      reference: input.reference,
      date: input.date,
      memo: input.memo,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: {
        create: input.lines.map((line) => ({
          accountId: accountByCode.get(line.accountCode)!.id,
          debit: money(line.debit || 0),
          credit: money(line.credit || 0),
        })),
      },
    },
  });
  mutations.push({ action: 'create-journal', detail: input.reference });
  return journal;
}

async function createStockIn(
  tx: Tx,
  input: {
    companyId: string;
    productId: string;
    orderId: string;
    fulfillmentId: string;
    quantity: number;
    unitCost: number;
    reference: string;
    date: Date;
  },
  mutations: Mutation[]
) {
  const existingMovement = await tx.inventoryMovement.findFirst({
    where: {
      companyId: input.companyId,
      productId: input.productId,
      orderId: input.orderId,
      fulfillmentId: input.fulfillmentId,
      type: MovementType.IN,
      reference: input.reference,
    },
  });
  if (existingMovement) {
    if (!isSameInstant(existingMovement.date, input.date)) {
      await tx.inventoryMovement.update({
        where: { id: existingMovement.id },
        data: { date: input.date },
      });
      mutations.push({
        action: 'update-stock-date',
        detail: `${input.reference} -> ${input.date.toISOString().slice(0, 10)}`,
      });
      return;
    }
    mutations.push({
      action: 'skip-stock',
      detail: `${input.reference} already exists`,
    });
    return;
  }

  const product = await tx.product.findUniqueOrThrow({
    where: { id: input.productId },
    select: { stockQty: true, averageCost: true },
  });
  const oldQty = product.stockQty;
  const oldAverageCost = Number(product.averageCost);
  const newQty = oldQty + input.quantity;
  const newAverageCost =
    newQty > 0
      ? (oldQty * oldAverageCost + input.quantity * input.unitCost) / newQty
      : oldAverageCost;

  await tx.inventoryMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      orderId: input.orderId,
      fulfillmentId: input.fulfillmentId,
      type: MovementType.IN,
      quantity: input.quantity,
      reference: input.reference,
      date: input.date,
    },
  });
  await tx.product.update({
    where: { id: input.productId },
    data: {
      stockQty: { increment: input.quantity },
      averageCost: money(newAverageCost),
    },
  });

  mutations.push({
    action: 'create-stock',
    detail: `${input.reference} qty ${input.quantity}`,
  });
}

async function addLineToPostedPurchase(
  tx: Tx,
  companyId: string,
  productBySku: Map<string, { id: string; sku: string; name: string }>,
  purchase: PurchaseSpec,
  line: AccessoryLine,
  mutations: Mutation[]
) {
  if (!purchase.targetOrderNumber) {
    throw new Error(`Missing target order number for ${purchase.reference}`);
  }

  const product = productBySku.get(line.sku);
  if (!product) throw new Error(`Product not prepared: ${line.sku}`);

  const order = await tx.order.findFirstOrThrow({
    where: {
      companyId,
      orderNumber: purchase.targetOrderNumber,
      type: OrderType.PURCHASE,
    },
    include: {
      fulfillments: {
        where: {
          type: 'RECEIPT',
          status: DocumentStatus.POSTED,
        },
        orderBy: { createdAt: 'asc' },
      },
      invoices: {
        where: {
          type: InvoiceType.BILL,
          status: { not: InvoiceStatus.VOID },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const existingOrderItem = await tx.orderItem.findFirst({
    where: {
      orderId: order.id,
      productId: product.id,
      quantity: line.quantity,
      price: money(line.unitCost),
    },
  });
  const orderItem =
    existingOrderItem ||
    (await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        quantity: line.quantity,
        price: money(line.unitCost),
      },
    }));

  if (existingOrderItem) {
    mutations.push({
      action: 'skip-order-line',
      detail: `${purchase.targetOrderNumber} ${product.sku}`,
    });
  } else {
    mutations.push({
      action: 'add-order-line',
      detail: `${purchase.targetOrderNumber} ${product.name} ${line.quantity} x ${formatMoney(line.unitCost)}`,
    });
  }

  const amount = lineTotal(line);
  if (!existingOrderItem) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        totalAmount: { increment: amount },
        notes: appendImportNote(order.notes, purchase.reference, purchase.note),
        version: { increment: 1 },
      },
    });
    mutations.push({
      action: 'update-po-total',
      detail: `${purchase.targetOrderNumber} +${formatMoney(amount)}`,
    });
  }

  const receipt = order.fulfillments[0];
  if (!receipt) {
    throw new Error(`No posted receipt found for ${purchase.targetOrderNumber}`);
  }

  const existingFulfillmentItem = await tx.fulfillmentItem.findFirst({
    where: {
      fulfillmentId: receipt.id,
      productId: product.id,
      orderItemId: orderItem.id,
    },
  });
  if (!existingFulfillmentItem) {
    await tx.fulfillmentItem.create({
      data: {
        fulfillmentId: receipt.id,
        productId: product.id,
        orderItemId: orderItem.id,
        quantity: money(line.quantity),
        costSnapshot: money(line.unitCost),
      },
    });
    await tx.fulfillment.update({
      where: { id: receipt.id },
      data: {
        notes: appendImportNote(
          receipt.notes,
          purchase.reference,
          `Tambah receipt ${product.name} ${line.quantity} pcs dari koreksi pembelian aksesori.`
        ),
      },
    });
    mutations.push({
      action: 'add-receipt-line',
      detail: `${receipt.number} ${product.name}`,
    });
  } else {
    mutations.push({
      action: 'skip-receipt-line',
      detail: `${receipt.number} ${product.sku}`,
    });
  }

  const stockReference = `GRN:${receipt.number} PO:${order.orderNumber} ${IMPORT_TAG}:${purchase.reference}:${product.sku}`;
  await createStockIn(
    tx,
    {
      companyId,
      productId: product.id,
      orderId: order.id,
      fulfillmentId: receipt.id,
      quantity: line.quantity,
      unitCost: line.unitCost,
      reference: stockReference,
      date: parseDate(purchase.date),
    },
    mutations
  );

  await postJournal(
    tx,
    companyId,
    {
      reference: `GRN correction: ${receipt.number}`,
      memo: `${IMPORT_TAG} ${purchase.reference} ${product.name}`,
      date: parseDate(purchase.date),
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId: `${IMPORT_TAG}:grn:${purchase.reference}:${product.sku}`,
      lines: [
        { accountCode: '1400', debit: amount },
        { accountCode: '2105', credit: amount },
      ],
    },
    mutations
  );

  const bill = order.invoices[0];
  if (!bill) {
    throw new Error(`No active bill found for ${purchase.targetOrderNumber}`);
  }
  const existingBillJournal = await tx.journalEntry.findFirst({
    where: {
      companyId,
      sourceType: JournalSourceType.BILL,
      sourceId: `${IMPORT_TAG}:bill:${purchase.reference}:${product.sku}`,
    },
  });
  if (!existingBillJournal) {
    await tx.invoice.update({
      where: { id: bill.id },
      data: {
        amount: { increment: amount },
        subtotal: { increment: amount },
        balance: { increment: amount },
        notes: appendImportNote(
          bill.notes,
          purchase.reference,
          `Tambah tagihan ${product.name} ${line.quantity} pcs dari koreksi pembelian aksesori.`
        ),
        version: { increment: 1 },
      },
    });
    mutations.push({
      action: 'update-bill-total',
      detail: `${bill.invoiceNumber} +${formatMoney(amount)}`,
    });
  }

  await postJournal(
    tx,
    companyId,
    {
      reference: `Bill correction: ${bill.invoiceNumber}`,
      memo: `${IMPORT_TAG} ${purchase.reference} ${product.name}`,
      date: parseDate(purchase.date),
      sourceType: JournalSourceType.BILL,
      sourceId: `${IMPORT_TAG}:bill:${purchase.reference}:${product.sku}`,
      lines: [
        { accountCode: '2105', debit: amount },
        { accountCode: '2100', credit: amount },
      ],
    },
    mutations
  );
}

async function reconcileStandalonePurchase(
  tx: Tx,
  companyId: string,
  purchase: PurchaseSpec,
  order: {
    id: string;
    orderNumber: string | null;
    date: Date;
    notes: string | null;
    fulfillments: { id: string; number: string; date: Date; notes: string | null }[];
    invoices: { id: string; invoiceNumber: string | null; date: Date; dueDate: Date }[];
  },
  mutations: Mutation[]
) {
  const businessDate = parseDate(purchase.date);
  const dueDate = addDays(businessDate, 30);
  const nextOrderNotes = appendImportNote(
    order.notes,
    purchase.reference,
    purchase.note
  );

  if (!isSameInstant(order.date, businessDate) || nextOrderNotes !== order.notes) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        date: businessDate,
        notes: nextOrderNotes,
      },
    });
    mutations.push({
      action: 'update-standalone-po-date',
      detail: `${order.orderNumber} -> ${purchase.date}`,
    });
  }

  for (const receipt of order.fulfillments) {
    const nextReceiptNotes = appendImportNote(
      receipt.notes,
      purchase.reference,
      purchase.description
    );
    if (
      !isSameInstant(receipt.date, businessDate) ||
      nextReceiptNotes !== receipt.notes
    ) {
      await tx.fulfillment.update({
        where: { id: receipt.id },
        data: {
          date: businessDate,
          notes: nextReceiptNotes,
        },
      });
      mutations.push({
        action: 'update-receipt-date',
        detail: `${receipt.number} -> ${purchase.date}`,
      });
    }
  }

  for (const bill of order.invoices) {
    if (
      !isSameInstant(bill.date, businessDate) ||
      !isSameInstant(bill.dueDate, dueDate)
    ) {
      await tx.invoice.update({
        where: { id: bill.id },
        data: {
          date: businessDate,
          dueDate,
        },
      });
      mutations.push({
        action: 'update-bill-date',
        detail: `${bill.invoiceNumber} -> ${purchase.date}`,
      });
    }
  }

  const movements = await tx.inventoryMovement.findMany({
    where: {
      companyId,
      orderId: order.id,
      type: MovementType.IN,
    },
  });
  for (const movement of movements) {
    if (!isSameInstant(movement.date, businessDate)) {
      await tx.inventoryMovement.update({
        where: { id: movement.id },
        data: { date: businessDate },
      });
      mutations.push({
        action: 'update-stock-date',
        detail: `${movement.reference || movement.id} -> ${purchase.date}`,
      });
    }
  }

  await tx.journalEntry.updateMany({
    where: {
      companyId,
      memo: { contains: `${IMPORT_TAG}:${purchase.reference}` },
    },
    data: { date: businessDate },
  });
}

async function createStandalonePurchase(
  tx: Tx,
  companyId: string,
  partnerId: string,
  productBySku: Map<string, { id: string; sku: string; name: string }>,
  purchase: PurchaseSpec,
  mutations: Mutation[]
) {
  const existing = await tx.order.findFirst({
    where: {
      companyId,
      type: OrderType.PURCHASE,
      notes: { contains: `[${IMPORT_TAG}:${purchase.reference}]` },
    },
    include: {
      items: { include: { product: true } },
      fulfillments: true,
      invoices: {
        where: {
          type: InvoiceType.BILL,
          status: { not: InvoiceStatus.VOID },
        },
      },
    },
  });
  if (existing) {
    await reconcileStandalonePurchase(
      tx,
      companyId,
      purchase,
      existing,
      mutations
    );
    mutations.push({
      action: 'skip-standalone-po',
      detail: `${purchase.reference} already exists as ${existing.orderNumber}`,
    });
    return existing;
  }

  const businessDate = parseDate(purchase.date);
  const total = purchaseTotal(purchase);
  const orderNumber = await generateDocumentNumber(
    tx,
    companyId,
    SequenceType.PO,
    businessDate
  );
  const billNumber = await generateDocumentNumber(
    tx,
    companyId,
    SequenceType.BILL,
    businessDate
  );
  const receiptNumber = await generateReceiptNumber(tx, companyId, businessDate);

  const order = await tx.order.create({
    data: {
      companyId,
      partnerId,
      type: OrderType.PURCHASE,
      status: OrderStatus.COMPLETED,
      orderNumber,
      date: businessDate,
      totalAmount: money(total),
      taxRate: money(0),
      paymentTerms: PaymentTerms.NET30,
      paidAmount: money(0),
      notes: appendImportNote(null, purchase.reference, purchase.note),
      items: {
        create: purchase.lines.map((line) => {
          const product = productBySku.get(line.sku);
          if (!product) throw new Error(`Product not prepared: ${line.sku}`);
          return {
            productId: product.id,
            quantity: line.quantity,
            price: money(line.unitCost),
          };
        }),
      },
    },
    include: { items: true },
  });
  mutations.push({
    action: 'create-standalone-po',
    detail: `${orderNumber} ${purchase.reference} ${formatMoney(total)}`,
  });

  const receipt = await tx.fulfillment.create({
    data: {
      companyId,
      orderId: order.id,
      type: 'RECEIPT',
      number: receiptNumber,
      date: businessDate,
      status: DocumentStatus.POSTED,
      notes: appendImportNote(null, purchase.reference, purchase.description),
      items: {
        create: order.items.map((item) => ({
          productId: item.productId,
          orderItemId: item.id,
          quantity: money(item.quantity),
          costSnapshot: item.price,
        })),
      },
    },
  });
  mutations.push({
    action: 'create-receipt',
    detail: `${receiptNumber} ${orderNumber}`,
  });

  for (const item of order.items) {
    const product = [...productBySku.values()].find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error(`Product map missing id ${item.productId}`);
    await createStockIn(
      tx,
      {
        companyId,
        productId: item.productId,
        orderId: order.id,
        fulfillmentId: receipt.id,
        quantity: item.quantity,
        unitCost: Number(item.price),
        reference: `GRN:${receiptNumber} PO:${orderNumber}`,
        date: businessDate,
      },
      mutations
    );
  }

  await postJournal(
    tx,
    companyId,
    {
      reference: `GRN:${receiptNumber}`,
      memo: `Auto-generated Accrual from Goods Receipt (${IMPORT_TAG}:${purchase.reference})`,
      date: businessDate,
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId: `${IMPORT_TAG}:grn:${purchase.reference}`,
      lines: [
        { accountCode: '1400', debit: total },
        { accountCode: '2105', credit: total },
      ],
    },
    mutations
  );

  const bill = await tx.invoice.create({
    data: {
      companyId,
      orderId: order.id,
      partnerId,
      fulfillmentId: receipt.id,
      type: InvoiceType.BILL,
      status: InvoiceStatus.POSTED,
      invoiceNumber: billNumber,
      date: businessDate,
      dueDate: addDays(businessDate, 30),
      amount: money(total),
      subtotal: money(total),
      taxAmount: money(0),
      taxRate: money(0),
      balance: money(total),
      supplierInvoiceNumber: `WHATSAPP-${purchase.reference}`,
      paymentTermsString: PaymentTerms.NET30,
      notes: appendImportNote(null, purchase.reference, purchase.description),
    },
  });
  mutations.push({
    action: 'create-bill',
    detail: `${billNumber} ${orderNumber} ${formatMoney(total)}`,
  });

  await postJournal(
    tx,
    companyId,
    {
      reference: `Bill: ${billNumber}`,
      memo: `Auto-generated from bill ${billNumber} (${IMPORT_TAG}:${purchase.reference})`,
      date: businessDate,
      sourceType: JournalSourceType.BILL,
      sourceId: bill.id,
      lines: [
        { accountCode: '2105', debit: total },
        { accountCode: '2100', credit: total },
      ],
    },
    mutations
  );

  return order;
}

async function verify(companyId: string) {
  const accessoryProducts = await prisma.product.findMany({
    where: {
      companyId,
      sku: { in: products.map((product) => product.sku) },
    },
    select: {
      sku: true,
      name: true,
      stockQty: true,
      averageCost: true,
      orderItems: {
        select: { quantity: true },
      },
    },
    orderBy: { sku: 'asc' },
  });

  const totals = accessoryProducts.map((product) => ({
    sku: product.sku,
    name: product.name,
    orderedQty: product.orderItems.reduce((sum, item) => sum + item.quantity, 0),
    stockQty: product.stockQty,
    averageCost: Number(product.averageCost),
  }));

  const orderTotal = await prisma.order.aggregate({
    where: {
      companyId,
      type: OrderType.PURCHASE,
      notes: { contains: IMPORT_TAG },
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  return {
    products: totals,
    taggedPurchaseOrders: orderTotal._count,
    taggedPurchaseOrderAmount: Number(orderTotal._sum.totalAmount || 0),
  };
}

async function main() {
  const mutations: Mutation[] = [];

  const company = await prisma.company.findFirstOrThrow({
    where: { name: 'Santi Living' },
    select: { id: true, name: true },
  });
  const supplier = await prisma.partner.findFirstOrThrow({
    where: { companyId: company.id, name: 'Santi Mebel Godean' },
    select: { id: true, name: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const productBySku = await ensureProducts(tx, company.id);

      for (const purchase of purchases) {
        if (purchase.mode === 'merge') {
          for (const line of purchase.lines) {
            await addLineToPostedPurchase(
              tx,
              company.id,
              productBySku,
              purchase,
              line,
              mutations
            );
          }
        } else {
          await createStandalonePurchase(
            tx,
            company.id,
            supplier.id,
            productBySku,
            purchase,
            mutations
          );
        }
      }

      if (!applyChanges) {
        throw new DryRunRollback();
      }
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) {
      throw error;
    }
  }

  const verification = applyChanges ? await verify(company.id) : null;

  console.log(
    JSON.stringify(
      {
        mode: applyChanges ? 'applied' : 'dry-run',
        company: company.name,
        supplier: supplier.name,
        expectedTotals: {
          bantal: 41,
          guling: 4,
          amount: purchases.reduce(
            (sum, purchase) => sum + purchaseTotal(purchase),
            0
          ),
        },
        mutations,
        verification,
      },
      null,
      2
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    console.error(error);
    process.exit(1);
  });
