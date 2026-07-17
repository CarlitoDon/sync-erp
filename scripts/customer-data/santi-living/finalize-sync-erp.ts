import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AttachmentEntityType,
  AccountType,
  DepositPolicyType,
  DocumentStatus,
  InvoiceStatus,
  InvoiceType,
  JournalSourceType,
  MovementType,
  OrderStatus,
  OrderType,
  PaymentMethodType,
  PaymentStatus,
  prisma,
  UnitCondition,
  UnitStatus,
} from '../../../packages/database/src/index.ts';
import { PaymentService } from '../../../apps/api/src/modules/accounting/services/payment.service.ts';
import { AttachmentService } from '../../../apps/api/src/modules/attachment/attachment.service.ts';

type RefCode =
  | 'P001'
  | 'P002'
  | 'P003'
  | 'BG003'
  | 'P004'
  | 'BG005'
  | 'P005'
  | 'P006'
  | 'BG007'
  | 'P007';

type ProductKey =
  | 'RGE90'
  | 'RGE100'
  | 'RGE120'
  | 'RGE160'
  | 'SPRINGBACK'
  | 'COMFY'
  | 'ROYAL_KING'
  | 'GULING_COMFY';

interface PurchaseLine {
  product: ProductKey;
  qty: number;
  price: number;
}

interface PurchaseRef {
  ref: RefCode;
  date: string;
  receiptDate?: string;
  total: number;
  knownOrderId: string;
  knownBillId: string;
  knownGrnId: string;
  lines: PurchaseLine[];
  evidenceIds: string[];
  note: string;
}

interface PaymentEvent {
  eventRef: string;
  legacyEventRefs?: string[];
  date: string;
  amount: number;
  method: PaymentMethodType;
  paymentMethodCode?: string;
  useBankAccount?: boolean;
  evidenceIds: string[];
  note: string;
  allocations: { ref: RefCode; amount: number }[];
}

interface EvidenceFile {
  id: string;
  refs: RefCode[];
  filePath: string;
  summary: string;
}

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../..'
);
const FINAL_BUNDLE = path.join(
  REPO_ROOT,
  'storage/imports/santi-living-payment-final-2026-05-25'
);
process.env.SYNC_ERP_STORAGE_DIR = path.join(REPO_ROOT, 'storage');

const PRODUCT_DEFS: Record<
  ProductKey,
  {
    oldSku: string;
    finalSku: string;
    name: string;
    price: number;
    averageCost: number;
    rental: { dailyRate: number; weeklyRate: number; monthlyRate: number };
    unitPrefix: string;
    sizeLabel?: string;
    color?: string;
  }
> = {
  RGE90: {
    oldSku: 'KSR-RG-90-BIRU-001',
    finalSku: 'RGE-90-BIRU',
    name: 'Royal Grand Exclusive 90 Biru',
    price: 684000,
    averageCost: 571852.25,
    rental: { dailyRate: 30000, weeklyRate: 180000, monthlyRate: 650000 },
    unitPrefix: 'RGE90',
    sizeLabel: '90 x 200',
    color: 'biru',
  },
  RGE100: {
    oldSku: 'KSR-RG-100-BIRU-001',
    finalSku: 'RGE-100-BIRU',
    name: 'Royal Grand Exclusive 100 Biru',
    price: 793000,
    averageCost: 620100,
    rental: { dailyRate: 35000, weeklyRate: 210000, monthlyRate: 750000 },
    unitPrefix: 'RGE100',
    sizeLabel: '100 x 200',
    color: 'biru',
  },
  RGE120: {
    oldSku: 'KSR-RG-120-BIRU-001',
    finalSku: 'RGE-120-BIRU',
    name: 'Royal Grand Exclusive 120 Biru',
    price: 628724,
    averageCost: 628724,
    rental: { dailyRate: 40000, weeklyRate: 240000, monthlyRate: 850000 },
    unitPrefix: 'RGE120',
    sizeLabel: '120 x 200',
    color: 'biru',
  },
  RGE160: {
    oldSku: 'KSR-RG-160-BIRU-001',
    finalSku: 'RGE-160-BIRU',
    name: 'Royal Grand Exclusive 160 Biru',
    price: 790379,
    averageCost: 790379,
    rental: { dailyRate: 50000, weeklyRate: 300000, monthlyRate: 1100000 },
    unitPrefix: 'RGE160',
    sizeLabel: '160 x 200',
    color: 'biru',
  },
  SPRINGBACK: {
    oldSku: 'ACC-BANTAL-SPRINGBACK',
    finalSku: 'BANTAL-SPRINGBACK',
    name: 'Bantal Springback',
    price: 50000,
    averageCost: 50000,
    rental: { dailyRate: 10000, weeklyRate: 60000, monthlyRate: 250000 },
    unitPrefix: 'BSP',
  },
  COMFY: {
    oldSku: 'ACC-BANTAL-COMFY',
    finalSku: 'BANTAL-COMFY',
    name: 'Bantal Comfy',
    price: 40000,
    averageCost: 40000,
    rental: { dailyRate: 10000, weeklyRate: 60000, monthlyRate: 250000 },
    unitPrefix: 'BCO',
  },
  ROYAL_KING: {
    oldSku: 'ACC-BANTAL-ROYAL-KING',
    finalSku: 'BANTAL-ROYAL-KING',
    name: 'Bantal Royal King',
    price: 28600,
    averageCost: 28600,
    rental: { dailyRate: 10000, weeklyRate: 60000, monthlyRate: 250000 },
    unitPrefix: 'BRK',
  },
  GULING_COMFY: {
    oldSku: 'ACC-GULING-COMFY',
    finalSku: 'GULING-COMFY',
    name: 'Guling Comfy',
    price: 45000,
    averageCost: 45000,
    rental: { dailyRate: 10000, weeklyRate: 60000, monthlyRate: 250000 },
    unitPrefix: 'GCO',
  },
};

const PURCHASES: PurchaseRef[] = [
  {
    ref: 'P001',
    date: '2026-01-29',
    total: 469409,
    knownOrderId: '884193ef-1058-48c3-8f5c-df836ab14fda',
    knownBillId: '9e073536-67b7-459c-a549-d4a0cff00007',
    knownGrnId: '88c3c122-f7c0-40ae-88a0-260e80e2319a',
    lines: [{ product: 'RGE90', qty: 1, price: 469409 }],
    evidenceIds: [
      'IMG-LOAN-PRICE-LIST-41696',
      'IMG-LOAN-HPP-CALC-44301',
      'IMG-P001-PRICE-32157',
    ],
    note: 'Initial payroll-loan mattress purchase; ERP basis corrected to Jurnal/HPP.',
  },
  {
    ref: 'P002',
    date: '2026-02-13',
    total: 4076358,
    knownOrderId: 'b89ce2b0-c5be-4150-b631-215c4b3f5fbc',
    knownBillId: '4211b488-49de-4178-9f18-17a7ee7cbcf4',
    knownGrnId: '13cad292-c246-4a7e-bf6c-580b1b71179b',
    lines: [
      { product: 'RGE100', qty: 4, price: 536400 },
      { product: 'RGE160', qty: 2, price: 790379 },
      { product: 'SPRINGBACK', qty: 7, price: 50000 },
    ],
    evidenceIds: [
      'IMG-LOAN-PRICE-LIST-41696',
      'IMG-LOAN-KASUR-LIST-44284',
      'IMG-LOAN-HPP-CALC-44301',
      'IMG-ACCESSORY-LIST-48224',
    ],
    note: 'Initial payroll-loan mattress and pillow purchase; do not infer price from SKU.',
  },
  {
    ref: 'P003',
    date: '2026-02-14',
    total: 4827564,
    knownOrderId: '4523b8db-578c-4b15-b9c4-5c0044ee5d36',
    knownBillId: '03461298-1dc1-482e-8be9-a40f0fa45529',
    knownGrnId: 'aeca3fef-b50e-4a94-be8b-952567021e5c',
    lines: [
      { product: 'RGE160', qty: 4, price: 790379 },
      { product: 'RGE120', qty: 2, price: 628724 },
      { product: 'SPRINGBACK', qty: 2, price: 50000 },
      { product: 'COMFY', qty: 7, price: 40000 },
      { product: 'ROYAL_KING', qty: 1, price: 28600 },
    ],
    evidenceIds: [
      'IMG-LOAN-PRICE-LIST-41696',
      'IMG-LOAN-KASUR-LIST-44284',
      'IMG-LOAN-HPP-CALC-44301',
      'IMG-ACCESSORY-LIST-48224',
    ],
    note: 'Initial payroll-loan mattress and pillow purchase; do not infer price from SKU.',
  },
  {
    ref: 'BG003',
    date: '2026-02-20',
    total: 180000,
    knownOrderId: '889874ca-038f-4803-8e1e-e4a826ccddc5',
    knownBillId: '461b026e-a3b0-4dc8-8d87-7d922aee22eb',
    knownGrnId: 'cca33c49-e948-4737-9fe2-018aaa48c702',
    lines: [{ product: 'GULING_COMFY', qty: 4, price: 45000 }],
    evidenceIds: ['IMG-ACCESSORY-LIST-48224', 'IMG-LOAN-JURNAL-49244'],
    note: 'Initial payroll-loan bolster purchase included in Rp9.553.331 loan basis.',
  },
  {
    ref: 'P004',
    date: '2026-03-19',
    total: 2874896,
    knownOrderId: '694963a6-2947-4860-b366-89f92005ecfe',
    knownBillId: 'f5eaefa4-2966-4e63-a798-b9cef81aa850',
    knownGrnId: '5959cec3-ac37-4644-a50c-e3aba990482c',
    lines: [
      { product: 'RGE120', qty: 4, price: 628724 },
      { product: 'COMFY', qty: 9, price: 40000 },
    ],
    evidenceIds: ['IMG-P004-INVOICE-62205'],
    note: 'Cash/lunas asset purchase from Santi Mebel.',
  },
  {
    ref: 'BG005',
    date: '2026-03-23',
    total: 114400,
    knownOrderId: '19aa4fa7-7e4f-40bf-97ac-1b4dc365ea97',
    knownBillId: '633bdbcd-39e7-4364-8a32-50cca1d421bd',
    knownGrnId: '78bf446f-3965-436a-b30a-c60cef9fc82c',
    lines: [{ product: 'ROYAL_KING', qty: 4, price: 28600 }],
    evidenceIds: ['IMG-BG005-PAY-72129'],
    note: 'Cash/lunas bantal purchase.',
  },
  {
    ref: 'P005',
    date: '2026-04-03',
    total: 1134000,
    knownOrderId: 'a9ba2850-1f54-4739-98c6-43c1e49c9fda',
    knownBillId: '46fa066b-337e-40cc-99d4-63c2e0084d22',
    knownGrnId: '7b925a61-e694-411e-b2fc-e83824643d17',
    lines: [{ product: 'RGE90', qty: 2, price: 567000 }],
    evidenceIds: ['IMG-P005-INVOICE-63002'],
    note: 'Cash/lunas mattress purchase.',
  },
  {
    ref: 'P006',
    date: '2026-04-18',
    receiptDate: '2026-04-23',
    total: 1616000,
    knownOrderId: '10b18b38-19f0-4b0e-b853-6ed1cf9f9465',
    knownBillId: '39a4147b-be3d-4a89-b151-e944059b16c8',
    knownGrnId: '474880af-b7fb-4418-b9cf-5f4cfcabb7c4',
    lines: [
      { product: 'RGE90', qty: 1, price: 684000 },
      { product: 'RGE100', qty: 1, price: 782000 },
      { product: 'SPRINGBACK', qty: 3, price: 50000 },
    ],
    evidenceIds: ['IMG-P006-PAY-92508'],
    note: 'Cash/lunas, msg 92508, transfer ID 260419SYATIDJ100005822, note kasur 2 bantal 3.',
  },
  {
    ref: 'BG007',
    date: '2026-05-06',
    total: 400000,
    knownOrderId: 'fada2f36-936f-4fd4-9753-e6d1922501dc',
    knownBillId: '2fac3858-0a2c-4ab3-8648-826af2465948',
    knownGrnId: '2cb827ec-24c7-49f3-9bfe-92d80175d6ff',
    lines: [{ product: 'SPRINGBACK', qty: 8, price: 50000 }],
    evidenceIds: ['IMG-BG007-PAY-112161'],
    note: 'Cash/lunas bantal purchase.',
  },
  {
    ref: 'P007',
    date: '2026-05-14',
    total: 793000,
    knownOrderId: '2622c533-85d0-4669-9f83-7d85e1fcae50',
    knownBillId: '3b07d094-51f3-4efb-a47f-8541bebc625f',
    knownGrnId: '5d2702be-6da0-4091-a66a-81316d653ddc',
    lines: [{ product: 'RGE100', qty: 1, price: 793000 }],
    evidenceIds: ['IMG-P007-INVOICE-65396'],
    note: 'Cash/lunas mattress purchase.',
  },
];

const PAYMENT_EVENTS: PaymentEvent[] = [
  {
    eventRef: 'SL-SM-CAPITAL-001-SALARY-OFFSET',
    legacyEventRefs: ['SL-SM-PAYROLL-001'],
    date: '2026-02-27',
    amount: 1590000,
    method: PaymentMethodType.OTHER,
    paymentMethodCode: 'OWNER_CONTRIBUTION',
    useBankAccount: false,
    evidenceIds: ['IMG-LOAN-TALENTA-93190'],
    note: 'Owner capital contribution via Doni salary offset at Santi Mebel, installment 1/6.',
    allocations: [
      { ref: 'P001', amount: 469409 },
      { ref: 'P002', amount: 1120591 },
    ],
  },
  {
    eventRef: 'SL-SM-CAPITAL-002-SALARY-OFFSET',
    legacyEventRefs: ['SL-SM-PAYROLL-002'],
    date: '2026-03-27',
    amount: 1590000,
    method: PaymentMethodType.OTHER,
    paymentMethodCode: 'OWNER_CONTRIBUTION',
    useBankAccount: false,
    evidenceIds: ['IMG-LOAN-TALENTA-93190'],
    note: 'Owner capital contribution via Doni salary offset at Santi Mebel, installment 2/6.',
    allocations: [{ ref: 'P002', amount: 1590000 }],
  },
  {
    eventRef: 'SL-SM-CAPITAL-003-SALARY-OFFSET-BALANCE-DERIVED',
    legacyEventRefs: ['SL-SM-PAYROLL-003-BALANCE-DERIVED'],
    date: '2026-05-15',
    amount: 1590000,
    method: PaymentMethodType.OTHER,
    paymentMethodCode: 'OWNER_CONTRIBUTION',
    useBankAccount: false,
    evidenceIds: ['IMG-LOAN-TALENTA-93190', 'IMG-LOAN-PAYOFF-122773'],
    note: 'Balance-derived owner capital contribution via Doni salary offset at Santi Mebel; reconciles Talenta remaining balance to final operating payoff.',
    allocations: [
      { ref: 'P002', amount: 1365767 },
      { ref: 'P003', amount: 224233 },
    ],
  },
  {
    eventRef: 'SL-SM-BANK-PAYOFF-004',
    legacyEventRefs: ['SL-SM-PAYROLL-004-PAYOFF'],
    date: '2026-05-15',
    amount: 4783331,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-LOAN-PAYOFF-122773'],
    note: 'Final payoff from Santi Living operating income via Bank Jago, transfer ID 260515SYATIDJ100023688; pelunasan utang dhoni.',
    allocations: [
      { ref: 'P003', amount: 4603331 },
      { ref: 'BG003', amount: 180000 },
    ],
  },
  {
    eventRef: 'SL-SM-CASH-P004',
    date: '2026-03-19',
    amount: 2874896,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-P004-INVOICE-62205'],
    note: 'Cash/lunas P004.',
    allocations: [{ ref: 'P004', amount: 2874896 }],
  },
  {
    eventRef: 'SL-SM-CASH-BG005',
    date: '2026-03-24',
    amount: 114400,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-BG005-PAY-72129'],
    note: 'Transfer ID 260324SYATIDJ100014744; note bantal 4.',
    allocations: [{ ref: 'BG005', amount: 114400 }],
  },
  {
    eventRef: 'SL-SM-CASH-P005',
    date: '2026-04-03',
    amount: 1134000,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-P005-INVOICE-63002'],
    note: 'Cash/lunas P005.',
    allocations: [{ ref: 'P005', amount: 1134000 }],
  },
  {
    eventRef: 'SL-SM-CASH-P006-260419SYATIDJ100005822',
    date: '2026-04-19',
    amount: 1616000,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-P006-PAY-92508'],
    note: 'Msg 92508, transfer ID 260419SYATIDJ100005822, receipt note kasur 2 bantal 3.',
    allocations: [{ ref: 'P006', amount: 1616000 }],
  },
  {
    eventRef: 'SL-SM-CASH-BG007',
    date: '2026-05-08',
    amount: 400000,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-BG007-PAY-112161'],
    note: 'Transfer ID 260508SYATIDJ100022891; note 8 bantal dhoni.',
    allocations: [{ ref: 'BG007', amount: 400000 }],
  },
  {
    eventRef: 'SL-SM-CASH-P007',
    date: '2026-05-14',
    amount: 793000,
    method: PaymentMethodType.BANK,
    evidenceIds: ['IMG-P007-INVOICE-65396'],
    note: 'Cash/lunas P007.',
    allocations: [{ ref: 'P007', amount: 793000 }],
  },
];

const EVIDENCE_FILES: EvidenceFile[] = [
  {
    id: 'IMG-P001-PRICE-32157',
    refs: ['P001'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/p001_price_invoice_msg_32157.jpg'),
    summary: 'P001 original invoice screenshot; retained as supporting evidence beside HPP basis.',
  },
  {
    id: 'IMG-LOAN-PRICE-LIST-41696',
    refs: ['P001', 'P002', 'P003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/initial_loan_hpp_price_list_msg_41696.jpg'),
    summary: 'HPP/Jurnal price list for initial payroll loan purchase.',
  },
  {
    id: 'IMG-LOAN-KASUR-LIST-44284',
    refs: ['P001', 'P002', 'P003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/initial_loan_13_kasur_list_msg_44284.jpg'),
    summary: 'Initial 13 mattress quantity split evidence.',
  },
  {
    id: 'IMG-LOAN-HPP-CALC-44301',
    refs: ['P001', 'P002', 'P003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/initial_loan_hpp_calc_13_kasur_msg_44301.jpg'),
    summary: 'Initial 13 mattress HPP calculation evidence.',
  },
  {
    id: 'IMG-ACCESSORY-LIST-48224',
    refs: ['P002', 'P003', 'BG003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/initial_accessory_list_msg_48224.jpg'),
    summary: 'Initial accessory quantity/date support.',
  },
  {
    id: 'IMG-LOAN-JURNAL-49244',
    refs: ['P001', 'P002', 'P003', 'BG003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/payroll_loan_jurnal_outstanding_msg_49244.jpg'),
    summary: 'Fajar/Jurnal outstanding principal Rp9.553.331.',
  },
  {
    id: 'IMG-LOAN-TALENTA-93190',
    refs: ['P001', 'P002', 'P003', 'BG003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/payroll_loan_talenta_msg_93190.jpg'),
    summary: 'Talenta loan schedule evidence.',
  },
  {
    id: 'IMG-LOAN-PAYOFF-122773',
    refs: ['P001', 'P002', 'P003', 'BG003'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/payroll_loan_payoff_jago_msg_122773.jpg'),
    summary: 'Final payoff transfer evidence.',
  },
  {
    id: 'IMG-P004-INVOICE-62205',
    refs: ['P004'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/p004_sales_invoice_62205_thumb.jpg'),
    summary: 'P004 invoice support.',
  },
  {
    id: 'IMG-BG005-PAY-72129',
    refs: ['BG005'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/bg005_payment_bantal4_msg_72129.jpg'),
    summary: 'BG005 cash payment evidence.',
  },
  {
    id: 'IMG-P005-INVOICE-63002',
    refs: ['P005'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/p005_sales_invoice_63002_thumb.jpg'),
    summary: 'P005 invoice support.',
  },
  {
    id: 'IMG-P006-PAY-92508',
    refs: ['P006'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/p006_payment_kasur2_bantal3_msg_92508.jpg'),
    summary: 'P006 cash payment evidence, msg 92508, transfer ID 260419SYATIDJ100005822.',
  },
  {
    id: 'IMG-BG007-PAY-112161',
    refs: ['BG007'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/bg007_payment_8bantal_msg_112161.jpg'),
    summary: 'BG007 cash payment evidence.',
  },
  {
    id: 'IMG-P007-INVOICE-65396',
    refs: ['P007'],
    filePath: path.join(FINAL_BUNDLE, 'image-evidence-curated/p007_sales_invoice_65396.jpg'),
    summary: 'P007 invoice support.',
  },
];

const REF_BY_CODE = new Map(PURCHASES.map((purchase) => [purchase.ref, purchase]));
const TARGET_TOTAL = 16485627;
const INITIAL_DEBT_SETTLEMENT_TOTAL = 9553331;
const OWNER_CONTRIBUTION_TOTAL = 4770000;
const OPERATING_PAYOFF_TOTAL = 4783331;
const CASH_PURCHASE_TOTAL = 6932296;
const BANK_JAGO_TOTAL = CASH_PURCHASE_TOTAL + OPERATING_PAYOFF_TOTAL;
const OWNER_CONTRIBUTION_METHOD_CODE = 'OWNER_CONTRIBUTION';
const LEGACY_PAYROLL_METHOD_CODE = 'PAYROLL_DEDUCTION';
const OWNER_CONTRIBUTION_ACCOUNT_NAME =
  'Modal Doni - Setoran via Gaji Santi Mebel';
const OWNER_CONTRIBUTION_METHOD_NAME =
  'Setoran Modal Doni via Gaji Santi Mebel';

function dateInJakarta(date: string): Date {
  return new Date(`${date}T12:00:00+07:00`);
}

function amountOf(lines: PurchaseLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.price, 0);
}

function appendAuditNote(existing: string | null | undefined, ref: RefCode, lines: string[]): string {
  const marker = `Reference: SL-SM-${ref}`;
  const base = existing?.includes(marker) ? existing : [marker, existing].filter(Boolean).join('\n');
  const block = [
    `Sync ERP Santi Living final mapping 2026-05-25.`,
    ...lines,
  ].join('\n');

  if (base.includes('Sync ERP Santi Living final mapping 2026-05-25.')) {
    return base;
  }

  return [base, block].filter(Boolean).join('\n');
}

function mimeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.md') return 'text/markdown';
  if (extension === '.csv') return 'text/csv';
  return 'application/octet-stream';
}

async function findCompany() {
  const company = await prisma.company.findFirst({
    where: { name: 'Santi Living' },
    select: { id: true, name: true },
  });
  if (!company) throw new Error('Company Santi Living not found');
  return company;
}

async function findUploadUser(companyId: string): Promise<string> {
  const member = await prisma.companyMember.findFirst({
    where: { companyId },
    select: { userId: true },
  });
  if (member) return member.userId;

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('No user available for attachment uploads');
  return user.id;
}

async function ensureProductMap(companyId: string) {
  const result = new Map<ProductKey, string>();

  for (const [key, def] of Object.entries(PRODUCT_DEFS) as Array<[ProductKey, typeof PRODUCT_DEFS[ProductKey]]>) {
    const existing = await prisma.product.findFirst({
      where: {
        companyId,
        OR: [{ sku: def.finalSku }, { sku: def.oldSku }],
      },
      select: { id: true },
    });
    if (!existing) {
      throw new Error(`Product not found for ${key}: ${def.oldSku}/${def.finalSku}`);
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: {
        sku: def.finalSku,
        name: def.name,
        price: def.price,
        averageCost: def.averageCost,
        unitOfMeasure: 'PCS',
      },
    });
    result.set(key, existing.id);
  }

  return result;
}

async function ensureRentalItems(companyId: string, productIds: Map<ProductKey, string>) {
  const rentalItems = new Map<ProductKey, string>();

  for (const [key, productId] of productIds.entries()) {
    const def = PRODUCT_DEFS[key];
    const rentalItem = await prisma.rentalItem.upsert({
      where: { productId },
      create: {
        companyId,
        productId,
        dailyRate: def.rental.dailyRate,
        weeklyRate: def.rental.weeklyRate,
        monthlyRate: def.rental.monthlyRate,
        depositPolicyType: DepositPolicyType.PERCENTAGE,
        depositPercentage: 50,
        depositPerUnit: null,
        isActive: true,
      },
      update: {
        dailyRate: def.rental.dailyRate,
        weeklyRate: def.rental.weeklyRate,
        monthlyRate: def.rental.monthlyRate,
        depositPolicyType: DepositPolicyType.PERCENTAGE,
        depositPercentage: 50,
        depositPerUnit: null,
        isActive: true,
      },
      select: { id: true },
    });
    rentalItems.set(key, rentalItem.id);
  }

  return rentalItems;
}

async function findPurchaseRecords(companyId: string) {
  const records = new Map<
    RefCode,
    {
      order: Awaited<ReturnType<typeof prisma.order.findFirstOrThrow>>;
      bill: Awaited<ReturnType<typeof prisma.invoice.findFirstOrThrow>>;
      grn: Awaited<ReturnType<typeof prisma.fulfillment.findFirstOrThrow>>;
    }
  >();

  for (const purchase of PURCHASES) {
    const order = await prisma.order.findFirstOrThrow({
      where: {
        companyId,
        type: OrderType.PURCHASE,
        OR: [
          { id: purchase.knownOrderId },
          { notes: { contains: `SL-SM-${purchase.ref}` } },
        ],
      },
      include: { items: true },
    });
    const bill = await prisma.invoice.findFirstOrThrow({
      where: {
        companyId,
        type: InvoiceType.BILL,
        OR: [
          { id: purchase.knownBillId },
          { supplierInvoiceNumber: `SL-SM-${purchase.ref}` },
          { notes: { contains: `SL-SM-${purchase.ref}` } },
        ],
      },
      include: { items: true, payments: true },
    });
    const grn = await prisma.fulfillment.findFirstOrThrow({
      where: {
        companyId,
        type: 'RECEIPT',
        OR: [
          { id: purchase.knownGrnId },
          { notes: { contains: `SL-SM-${purchase.ref}` } },
        ],
      },
      include: { items: true },
    });
    records.set(purchase.ref, { order, bill, grn });
  }

  return records;
}

async function applyPurchaseBasis(
  companyId: string,
  productIds: Map<ProductKey, string>,
  records: Awaited<ReturnType<typeof findPurchaseRecords>>
) {
  for (const purchase of PURCHASES) {
    if (amountOf(purchase.lines) !== purchase.total) {
      throw new Error(`Line total mismatch for ${purchase.ref}`);
    }

    const record = records.get(purchase.ref);
    if (!record) throw new Error(`Missing purchase record for ${purchase.ref}`);

    const purchaseDate = dateInJakarta(purchase.date);
    const receiptDate = dateInJakarta(purchase.receiptDate ?? purchase.date);
    const evidenceLine = `Evidence IDs: ${purchase.evidenceIds.join(', ')}`;
    const sourceLine = `ERP cost basis: Jurnal/HPP ${purchase.total}; original SO/import baseline retained only in evidence notes.`;

    await prisma.order.update({
      where: { id: record.order.id },
      data: {
        date: purchaseDate,
        totalAmount: purchase.total,
        status: OrderStatus.RECEIVED,
        notes: appendAuditNote(record.order.notes, purchase.ref, [
          sourceLine,
          evidenceLine,
          purchase.note,
        ]),
      },
    });

    await prisma.fulfillment.update({
      where: { id: record.grn.id },
      data: {
        date: receiptDate,
        status: DocumentStatus.POSTED,
        notes: appendAuditNote(record.grn.notes, purchase.ref, [
          `Receipt date: ${purchase.receiptDate ?? purchase.date}.`,
          evidenceLine,
        ]),
      },
    });

    await prisma.inventoryMovement.updateMany({
      where: { companyId, fulfillmentId: record.grn.id },
      data: {
        date: receiptDate,
        reference: `GRN ${record.grn.number} / SL-SM-${purchase.ref}`,
      },
    });

    const paidAmount = record.bill.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
    const remaining = Math.max(0, purchase.total - paidAmount);
    await prisma.invoice.update({
      where: { id: record.bill.id },
      data: {
        date: purchaseDate,
        dueDate: purchaseDate,
        amount: purchase.total,
        subtotal: purchase.total,
        taxAmount: 0,
        taxRate: 0,
        balance: remaining,
        status:
          remaining <= 0
            ? InvoiceStatus.PAID
            : paidAmount > 0
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.POSTED,
        supplierInvoiceNumber: `SL-SM-${purchase.ref}`,
        notes: appendAuditNote(record.bill.notes, purchase.ref, [
          sourceLine,
          evidenceLine,
          purchase.note,
        ]),
      },
    });

    for (const line of purchase.lines) {
      const productId = productIds.get(line.product);
      if (!productId) throw new Error(`Missing product id for ${line.product}`);
      const orderItem = record.order.items.find((item) => item.productId === productId);
      if (!orderItem) {
        throw new Error(`Order item not found for ${purchase.ref} / ${line.product}`);
      }
      await prisma.orderItem.update({
        where: { id: orderItem.id },
        data: {
          quantity: line.qty,
          price: line.price,
          cost: line.price,
        },
      });

      const invoiceItem = record.bill.items.find((item) => item.productId === productId);
      if (invoiceItem) {
        await prisma.invoiceItem.update({
          where: { id: invoiceItem.id },
          data: {
            quantity: line.qty,
            price: line.price,
            amount: line.qty * line.price,
          },
        });
      } else {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: record.bill.id,
            productId,
            description: PRODUCT_DEFS[line.product].name,
            quantity: line.qty,
            price: line.price,
            amount: line.qty * line.price,
          },
        });
      }

      await prisma.fulfillmentItem.updateMany({
        where: {
          fulfillmentId: record.grn.id,
          productId,
          orderItemId: orderItem.id,
        },
        data: { quantity: line.qty, costSnapshot: line.price },
      });
    }
  }
}

async function ensurePriceBasisAdjustment(companyId: string) {
  const sourceId = 'SL-SM-PRICE-BASIS-2026-05-25';
  const existing = await prisma.journalEntry.findFirst({
    where: { companyId, sourceType: JournalSourceType.ADJUSTMENT, sourceId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const accounts = await findAccounts(companyId, ['2100', '5200']);
  const journal = await prisma.journalEntry.create({
    data: {
      companyId,
      reference: 'SL-SM price basis adjustment',
      date: dateInJakarta('2026-05-15'),
      memo: 'Correct P001/P002/P003/BG initial loan from SO/import basis Rp10.048.818 to Jurnal/HPP loan basis Rp9.553.331; difference Rp495.487.',
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId,
      lines: {
        create: [
          { accountId: accounts.get('2100')!, debit: 495487, credit: 0 },
          { accountId: accounts.get('5200')!, debit: 0, credit: 495487 },
        ],
      },
    },
    select: { id: true },
  });
  return journal.id;
}

async function findAccounts(companyId: string, codes: string[]) {
  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: codes } },
    select: { id: true, code: true },
  });
  const result = new Map(accounts.map((account) => [account.code, account.id]));
  for (const code of codes) {
    if (!result.has(code)) throw new Error(`Account code ${code} not found`);
  }
  return result;
}

async function ensureBankAccountAndMethods(companyId: string) {
  const accounts = await findAccounts(companyId, ['1000', '1211']);
  const ownerContribution = await prisma.account.upsert({
    where: { companyId_code: { companyId, code: '3210' } },
    create: {
      companyId,
      code: '3210',
      name: OWNER_CONTRIBUTION_ACCOUNT_NAME,
      type: AccountType.EQUITY,
    },
    update: {
      name: OWNER_CONTRIBUTION_ACCOUNT_NAME,
      isActive: true,
    },
    select: { id: true },
  });
  const bankAccount = await prisma.bankAccount.upsert({
    where: {
      companyId_accountId: {
        companyId,
        accountId: accounts.get('1211')!,
      },
    },
    create: {
      companyId,
      accountId: accounts.get('1211')!,
      bankName: 'Bank Jago',
      accountNumber: null,
      currency: 'IDR',
    },
    update: {
      bankName: 'Bank Jago',
      isArchived: false,
    },
    select: { id: true },
  });

  await prisma.companyPaymentMethod.upsert({
    where: { companyId_code: { companyId, code: 'BANK_TRANSFER' } },
    create: {
      companyId,
      code: 'BANK_TRANSFER',
      name: 'Transfer Bank',
      type: PaymentMethodType.BANK,
      accountId: accounts.get('1211')!,
      isDefault: true,
      sortOrder: 10,
    },
    update: {
      name: 'Transfer Bank',
      type: PaymentMethodType.BANK,
      accountId: accounts.get('1211')!,
      isActive: true,
      isDefault: true,
    },
  });

  await prisma.companyPaymentMethod.upsert({
    where: { companyId_code: { companyId, code: 'CASH' } },
    create: {
      companyId,
      code: 'CASH',
      name: 'Tunai',
      type: PaymentMethodType.CASH,
      accountId: accounts.get('1000')!,
      isDefault: true,
      sortOrder: 5,
    },
    update: {
      name: 'Tunai',
      type: PaymentMethodType.CASH,
      accountId: accounts.get('1000')!,
      isActive: true,
      isDefault: true,
    },
  });

  await prisma.companyPaymentMethod.upsert({
    where: { companyId_code: { companyId, code: OWNER_CONTRIBUTION_METHOD_CODE } },
    create: {
      companyId,
      code: OWNER_CONTRIBUTION_METHOD_CODE,
      name: OWNER_CONTRIBUTION_METHOD_NAME,
      type: PaymentMethodType.OTHER,
      accountId: ownerContribution.id,
      isDefault: false,
      sortOrder: 20,
    },
    update: {
      name: OWNER_CONTRIBUTION_METHOD_NAME,
      type: PaymentMethodType.OTHER,
      accountId: ownerContribution.id,
      isActive: true,
    },
  });

  await prisma.companyPaymentMethod.updateMany({
    where: { companyId, code: LEGACY_PAYROLL_METHOD_CODE },
    data: {
      name: 'Legacy - gunakan Setoran Modal Doni',
      isActive: false,
      isDefault: false,
    },
  });

  return bankAccount.id;
}

async function postPayments(
  companyId: string,
  records: Awaited<ReturnType<typeof findPurchaseRecords>>,
  bankAccountId: string
) {
  const paymentService = new PaymentService();
  const createdOrReused: string[] = [];

  for (const event of PAYMENT_EVENTS) {
    const allocationTotal = event.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (allocationTotal !== event.amount) {
      throw new Error(`Payment event total mismatch for ${event.eventRef}`);
    }

    for (const allocation of event.allocations) {
      const record = records.get(allocation.ref);
      if (!record) throw new Error(`Missing bill for payment allocation ${allocation.ref}`);

      const reference = `${event.eventRef}/${allocation.ref} | evidence=${event.evidenceIds.join(',')} | ${event.note}`;
      const reusableRefs = [event.eventRef, ...(event.legacyEventRefs ?? [])];
      const existing = await prisma.payment.findFirst({
        where: {
          companyId,
          invoiceId: record.bill.id,
          OR: reusableRefs.map((eventRef) => ({
            reference: { contains: `${eventRef}/${allocation.ref}` },
          })),
        },
        select: { id: true, reference: true },
      });

      if (existing) {
        const updatedReference = (event.legacyEventRefs ?? []).reduce(
          (reference, legacyEventRef) =>
            reference?.replace(legacyEventRef, event.eventRef) ?? reference,
          existing.reference
        );
        if (updatedReference !== existing.reference) {
          await prisma.payment.update({
            where: { id: existing.id },
            data: { reference: updatedReference },
          });
        }
        createdOrReused.push(existing.id);
        continue;
      }

      const payment = await paymentService.create(
        companyId,
        {
          invoiceId: record.bill.id,
          amount: allocation.amount,
          method: event.method,
          ...(event.useBankAccount === false ? {} : { bankAccountId }),
          ...(event.paymentMethodCode
            ? { paymentMethodCode: event.paymentMethodCode }
            : {}),
          reference,
          businessDate: dateInJakarta(event.date),
        },
        `${event.eventRef}/${allocation.ref}`
      );
      createdOrReused.push(payment.id);
    }
  }

  return createdOrReused;
}

async function updateOrdersAfterPayment(
  records: Awaited<ReturnType<typeof findPurchaseRecords>>
) {
  for (const purchase of PURCHASES) {
    const record = records.get(purchase.ref);
    if (!record) throw new Error(`Missing purchase record ${purchase.ref}`);
    const paid = await prisma.payment.aggregate({
      where: { invoiceId: record.bill.id },
      _sum: { amount: true },
    });
    const paidAmount = Number(paid._sum.amount ?? 0);
    await prisma.order.update({
      where: { id: record.order.id },
      data: {
        paidAmount,
        paymentStatus:
          paidAmount >= purchase.total ? PaymentStatus.SETTLED : PaymentStatus.PARTIAL,
      },
    });
  }
}

async function updateMattressUnits(
  companyId: string,
  productIds: Map<ProductKey, string>,
  records: Awaited<ReturnType<typeof findPurchaseRecords>>
) {
  for (const purchase of PURCHASES) {
    for (const line of purchase.lines.filter((entry) =>
      ['RGE90', 'RGE100', 'RGE120', 'RGE160'].includes(entry.product)
    )) {
      const productId = productIds.get(line.product);
      if (!productId) throw new Error(`Missing mattress product ${line.product}`);
      const record = records.get(purchase.ref);
      if (!record) throw new Error(`Missing purchase record ${purchase.ref}`);
      const orderItem = record.order.items.find((item) => item.productId === productId);

      const units = await prisma.rentalItemUnit.findMany({
        where: {
          companyId,
          rentalItem: { productId },
          OR: [
            { sourceOrderId: record.order.id },
            { sourceBatchCode: purchase.ref },
            { sourceBatchCode: `SL-SM-${purchase.ref}` },
          ],
        },
        orderBy: { unitCode: 'asc' },
        take: line.qty,
      });

      if (units.length !== line.qty) {
        throw new Error(`Expected ${line.qty} mattress units for ${purchase.ref}/${line.product}, found ${units.length}`);
      }

      for (const unit of units) {
        await prisma.rentalItemUnit.update({
          where: { id: unit.id },
          data: {
            acquiredAt: dateInJakarta(purchase.date),
            acquisitionCost: line.price,
            sourceOrderId: record.order.id,
            sourceOrderItemId: orderItem?.id,
            sourceFulfillmentId: record.grn.id,
            sourceBillId: record.bill.id,
            sourceBatchCode: `SL-SM-${purchase.ref}`,
            sizeLabel: PRODUCT_DEFS[line.product].sizeLabel,
            color: 'biru',
            sourceNotes: `Santi Living purchase ${purchase.ref}; evidence ${purchase.evidenceIds.join(', ')}; price preserved from transaction, not SKU.`,
          },
        });
      }
    }
  }
}

async function decrementStockLayers(productId: string, quantity: number) {
  let remaining = quantity;
  const layers = await prisma.stockLayer.findMany({
    where: { productId, qtyRemaining: { gt: 0 } },
    orderBy: { receivedAt: 'asc' },
  });
  if (layers.length === 0) return;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const current = layer.qtyRemaining;
    const decrement = Math.min(current, remaining);
    await prisma.stockLayer.update({
      where: { id: layer.id },
      data: { qtyRemaining: current - decrement },
    });
    remaining -= decrement;
  }

  if (remaining > 0) {
    console.warn(`Stock layer quantity was lower than product stock by ${remaining} units; product stock remains the operational source of truth.`);
  }
}

async function createCapitalizationJournal(
  companyId: string,
  sourceId: string,
  reference: string,
  date: Date,
  amount: number
) {
  const existing = await prisma.journalEntry.findFirst({
    where: { companyId, sourceType: JournalSourceType.ADJUSTMENT, sourceId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const accounts = await findAccounts(companyId, ['1400', '5200']);
  const journal = await prisma.journalEntry.create({
    data: {
      companyId,
      reference,
      date,
      memo: 'Capitalization from inventory stock to rental units for Santi Living final mapping.',
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId,
      lines: {
        create: [
          { accountId: accounts.get('5200')!, debit: amount, credit: 0 },
          { accountId: accounts.get('1400')!, debit: 0, credit: amount },
        ],
      },
    },
    select: { id: true },
  });
  return journal.id;
}

async function createAccessoryUnits(
  companyId: string,
  productIds: Map<ProductKey, string>,
  rentalItems: Map<ProductKey, string>,
  records: Awaited<ReturnType<typeof findPurchaseRecords>>
) {
  const unitCounters = new Map<ProductKey, number>();
  for (const key of ['SPRINGBACK', 'COMFY', 'ROYAL_KING', 'GULING_COMFY'] as ProductKey[]) {
    const rentalItemId = rentalItems.get(key);
    if (!rentalItemId) throw new Error(`Missing rental item ${key}`);
    const existingCount = await prisma.rentalItemUnit.count({
      where: { companyId, rentalItemId },
    });
    unitCounters.set(key, existingCount);
  }

  for (const purchase of PURCHASES) {
    for (const line of purchase.lines.filter((entry) =>
      ['SPRINGBACK', 'COMFY', 'ROYAL_KING', 'GULING_COMFY'].includes(entry.product)
    )) {
      const productId = productIds.get(line.product);
      const rentalItemId = rentalItems.get(line.product);
      const record = records.get(purchase.ref);
      if (!productId || !rentalItemId || !record) {
        throw new Error(`Missing accessory context for ${purchase.ref}/${line.product}`);
      }

      const existingUnits = await prisma.rentalItemUnit.count({
        where: {
          companyId,
          rentalItemId,
          sourceBatchCode: `SL-SM-${purchase.ref}`,
        },
      });
      if (existingUnits === line.qty) continue;
      if (existingUnits > 0) {
        throw new Error(`Partial accessory unit batch exists for ${purchase.ref}/${line.product}: ${existingUnits}/${line.qty}`);
      }

      const orderItem = record.order.items.find((item) => item.productId === productId);
      const amount = line.qty * line.price;
      const date = dateInJakarta(purchase.date);
      const units = Array.from({ length: line.qty }, () => {
        const next = (unitCounters.get(line.product) ?? 0) + 1;
        unitCounters.set(line.product, next);
        return {
          rentalItemId,
          companyId,
          unitCode: `${PRODUCT_DEFS[line.product].unitPrefix}-${String(next).padStart(3, '0')}`,
          acquiredAt: date,
          acquisitionCost: line.price,
          sourceOrderId: record.order.id,
          sourceOrderItemId: orderItem?.id,
          sourceFulfillmentId: record.grn.id,
          sourceBillId: record.bill.id,
          sourceBatchCode: `SL-SM-${purchase.ref}`,
          sizeLabel: null,
          color: null,
          sourceNotes: `Santi Living accessory purchase ${purchase.ref}; evidence ${purchase.evidenceIds.join(', ')}; price preserved from transaction, not SKU.`,
          condition: UnitCondition.NEW,
          status: UnitStatus.AVAILABLE,
        };
      });

      await prisma.$transaction(async (tx) => {
        await tx.rentalItemUnit.createMany({ data: units });
        await tx.product.update({
          where: { id: productId },
          data: { stockQty: { decrement: line.qty } },
        });
        await tx.inventoryMovement.create({
          data: {
            companyId,
            productId,
            type: MovementType.OUT,
            quantity: -line.qty,
            orderId: record.order.id,
            fulfillmentId: record.grn.id,
            reference: `Capitalization to Rental Units SL-SM-${purchase.ref}`,
            date,
          },
        });
      });

      await decrementStockLayers(productId, line.qty);
      await createCapitalizationJournal(
        companyId,
        `SL-SM-CAP-${purchase.ref}-${PRODUCT_DEFS[line.product].finalSku}`,
        `Capitalization to Rental Units SL-SM-${purchase.ref}`,
        date,
        amount
      );
    }
  }
}

async function uploadEvidence(
  companyId: string,
  userId: string,
  records: Awaited<ReturnType<typeof findPurchaseRecords>>
) {
  const attachmentService = new AttachmentService();
  const uploadedOrReused: string[] = [];

  for (const evidence of EVIDENCE_FILES) {
    const buffer = await readFile(evidence.filePath);
    const fileName = path.basename(evidence.filePath);
    for (const ref of evidence.refs) {
      const record = records.get(ref);
      if (!record) throw new Error(`Missing record for evidence ${evidence.id}/${ref}`);
      const entities = [
        { entityType: AttachmentEntityType.PURCHASE_ORDER, entityId: record.order.id },
        { entityType: AttachmentEntityType.BILL, entityId: record.bill.id },
      ];

      for (const entity of entities) {
        const existing = await prisma.attachment.findFirst({
          where: {
            companyId,
            entityType: entity.entityType,
            entityId: entity.entityId,
            originalFileName: fileName,
            notes: { contains: evidence.id },
          },
          select: { id: true },
        });
        if (existing) {
          uploadedOrReused.push(existing.id);
          continue;
        }

        const attachment = await attachmentService.upload(companyId, userId, {
          entityType: entity.entityType,
          entityId: entity.entityId,
          fileName,
          mimeType: mimeFor(fileName),
          fileBase64: buffer.toString('base64'),
          notes: `${evidence.id}: ${evidence.summary}`,
        });
        uploadedOrReused.push(attachment.id);
      }
    }
  }

  for (const event of PAYMENT_EVENTS) {
    const eventPayments = await prisma.payment.findMany({
      where: { companyId, reference: { contains: event.eventRef } },
      select: { id: true },
    });
    for (const evidenceId of event.evidenceIds) {
      const evidence = EVIDENCE_FILES.find((item) => item.id === evidenceId);
      if (!evidence) continue;
      const buffer = await readFile(evidence.filePath);
      const fileName = path.basename(evidence.filePath);
      for (const payment of eventPayments) {
        const existing = await prisma.attachment.findFirst({
          where: {
            companyId,
            entityType: AttachmentEntityType.PAYMENT,
            entityId: payment.id,
            originalFileName: fileName,
            notes: { contains: evidence.id },
          },
          select: { id: true },
        });
        if (existing) {
          uploadedOrReused.push(existing.id);
          continue;
        }
        const attachment = await attachmentService.upload(companyId, userId, {
          entityType: AttachmentEntityType.PAYMENT,
          entityId: payment.id,
          fileName,
          mimeType: mimeFor(fileName),
          fileBase64: buffer.toString('base64'),
          notes: `${evidence.id}: ${evidence.summary}`,
        });
        uploadedOrReused.push(attachment.id);
      }
    }
  }

  return uploadedOrReused;
}

async function verify(companyId: string, productIds: Map<ProductKey, string>) {
  const records = await findPurchaseRecords(companyId);
  const billIds = [...records.values()].map((record) => record.bill.id);
  const orderIds = [...records.values()].map((record) => record.order.id);

  const bills = await prisma.invoice.findMany({
    where: { companyId, id: { in: billIds } },
    include: { payments: true },
  });
  const billTotal = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const unpaidTotal = bills.reduce((sum, bill) => sum + Number(bill.balance), 0);
  const paymentTotal = bills.reduce(
    (sum, bill) => sum + bill.payments.reduce((inner, payment) => inner + Number(payment.amount), 0),
    0
  );

  const ownerContributionTotal = await prisma.payment.aggregate({
    where: { companyId, reference: { contains: 'SL-SM-CAPITAL' } },
    _sum: { amount: true },
  });
  const operatingPayoffTotal = await prisma.payment.aggregate({
    where: { companyId, reference: { contains: 'SL-SM-BANK-PAYOFF' } },
    _sum: { amount: true },
  });
  const cashTotal = await prisma.payment.aggregate({
    where: { companyId, reference: { contains: 'SL-SM-CASH' } },
    _sum: { amount: true },
  });
  const initialDebtSettlementTotal =
    Number(ownerContributionTotal._sum.amount ?? 0) +
    Number(operatingPayoffTotal._sum.amount ?? 0);
  const bankJagoTotal =
    Number(cashTotal._sum.amount ?? 0) +
    Number(operatingPayoffTotal._sum.amount ?? 0);

  const unitCounts: Record<string, number> = {};
  for (const [key, productId] of productIds.entries()) {
    const def = PRODUCT_DEFS[key];
    unitCounts[def.finalSku] = await prisma.rentalItemUnit.count({
      where: { companyId, rentalItem: { productId } },
    });
  }

  const attachmentsByRef: Record<string, number> = {};
  for (const purchase of PURCHASES) {
    const record = records.get(purchase.ref)!;
    attachmentsByRef[purchase.ref] = await prisma.attachment.count({
      where: {
        companyId,
        OR: [
          { entityType: AttachmentEntityType.PURCHASE_ORDER, entityId: record.order.id },
          { entityType: AttachmentEntityType.BILL, entityId: record.bill.id },
        ],
      },
    });
  }

  const duplicatePaymentRefs = await prisma.payment.groupBy({
    by: ['reference'],
    where: { companyId, reference: { contains: 'SL-SM-' } },
    _count: { reference: true },
    having: { reference: { _count: { gt: 1 } } },
  });

  const today = new Date();
  const todayLocal = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);
  const todayDatedDocs = await prisma.invoice.count({
    where: {
      companyId,
      id: { in: billIds },
      date: {
        gte: dateInJakarta(todayLocal),
        lt: new Date(dateInJakarta(todayLocal).getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  const p006Payment = await prisma.payment.findFirst({
    where: {
      companyId,
      reference: {
        contains: '260419SYATIDJ100005822',
      },
    },
    select: { id: true, amount: true, date: true, reference: true },
  });

  const missingAttachments = Object.entries(attachmentsByRef)
    .filter(([, count]) => count === 0)
    .map(([ref]) => ref);

  const errors: string[] = [];
  if (billTotal !== TARGET_TOTAL) errors.push(`Bill total ${billTotal} != ${TARGET_TOTAL}`);
  if (paymentTotal !== TARGET_TOTAL) errors.push(`Payment total ${paymentTotal} != ${TARGET_TOTAL}`);
  if (Number(ownerContributionTotal._sum.amount ?? 0) !== OWNER_CONTRIBUTION_TOTAL) {
    errors.push(`Owner contribution total ${Number(ownerContributionTotal._sum.amount ?? 0)} != ${OWNER_CONTRIBUTION_TOTAL}`);
  }
  if (Number(operatingPayoffTotal._sum.amount ?? 0) !== OPERATING_PAYOFF_TOTAL) {
    errors.push(`Operating payoff total ${Number(operatingPayoffTotal._sum.amount ?? 0)} != ${OPERATING_PAYOFF_TOTAL}`);
  }
  if (initialDebtSettlementTotal !== INITIAL_DEBT_SETTLEMENT_TOTAL) {
    errors.push(`Initial debt settlement total ${initialDebtSettlementTotal} != ${INITIAL_DEBT_SETTLEMENT_TOTAL}`);
  }
  if (Number(cashTotal._sum.amount ?? 0) !== CASH_PURCHASE_TOTAL) {
    errors.push(`Cash purchase total ${Number(cashTotal._sum.amount ?? 0)} != ${CASH_PURCHASE_TOTAL}`);
  }
  if (bankJagoTotal !== BANK_JAGO_TOTAL) {
    errors.push(`Bank Jago total ${bankJagoTotal} != ${BANK_JAGO_TOTAL}`);
  }
  if (unpaidTotal !== 0) errors.push(`Unpaid balance ${unpaidTotal} != 0`);
  if (duplicatePaymentRefs.length > 0) errors.push(`Duplicate payment refs: ${duplicatePaymentRefs.length}`);
  if (todayDatedDocs > 0) errors.push(`Found ${todayDatedDocs} scoped bills dated today`);
  if (missingAttachments.length > 0) errors.push(`Missing attachments for refs: ${missingAttachments.join(', ')}`);
  if (!p006Payment || Number(p006Payment.amount) !== 1616000) {
    errors.push('P006 payment evidence/reference missing or wrong amount');
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

  const ordersWithRefs = await prisma.order.count({
    where: {
      companyId,
      id: { in: orderIds },
      notes: { contains: 'Reference: SL-SM-' },
    },
  });
  if (ordersWithRefs !== PURCHASES.length) {
    errors.push(`Only ${ordersWithRefs}/${PURCHASES.length} purchase orders have SL-SM notes`);
  }

  return {
    billTotal,
    paymentTotal,
    ownerContributionTotal: Number(ownerContributionTotal._sum.amount ?? 0),
    operatingPayoffTotal: Number(operatingPayoffTotal._sum.amount ?? 0),
    initialDebtSettlementTotal,
    cashPurchaseTotal: Number(cashTotal._sum.amount ?? 0),
    bankJagoTotal,
    unpaidTotal,
    unitCounts,
    attachmentsByRef,
    p006Payment,
    errors,
  };
}

async function main() {
  const company = await findCompany();
  const userId = await findUploadUser(company.id);
  const productIds = await ensureProductMap(company.id);
  const rentalItems = await ensureRentalItems(company.id, productIds);
  const records = await findPurchaseRecords(company.id);

  await applyPurchaseBasis(company.id, productIds, records);
  const adjustmentId = await ensurePriceBasisAdjustment(company.id);
  const bankAccountId = await ensureBankAccountAndMethods(company.id);
  const paymentIds = await postPayments(company.id, records, bankAccountId);
  await updateOrdersAfterPayment(records);
  await updateMattressUnits(company.id, productIds, records);
  await createAccessoryUnits(company.id, productIds, rentalItems, records);
  const attachmentIds = await uploadEvidence(company.id, userId, records);
  const verification = await verify(company.id, productIds);

  console.log(
    JSON.stringify(
      {
        company,
        adjustmentId,
        bankAccountId,
        paymentCount: paymentIds.length,
        attachmentCount: attachmentIds.length,
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
