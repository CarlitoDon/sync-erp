import fs from 'node:fs';
import path from 'node:path';
import { apiMutation, apiQuery } from '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/apps/mcp/src/client.ts';

const COMPANY_ID = 'f023d223-f787-4007-9660-1bfa155c6ec4';
const OUT_DIR =
  '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26';
const EVIDENCE_FILE = path.join(
  OUT_DIR,
  'carla-state-invoice-evidence-raw-2026-05-27.txt'
);
const IMPORT_BATCH = 'santi-living-wa-historical-orders-2026-05-27';
const RESULT_JSON = path.join(
  OUT_DIR,
  'santi-living-wa-historical-orders-input-result-2026-05-27.json'
);
const RESULT_LEDGER = path.join(
  OUT_DIR,
  'santi-living-wa-historical-orders-input-ledger-2026-05-27.csv'
);
const VERIFICATION_MD = path.join(
  OUT_DIR,
  'santi-living-wa-historical-orders-input-verification-2026-05-27.md'
);

type JsonRecord = Record<string, unknown>;

type OrderItemSpec = {
  kind: 'bundle' | 'item';
  key: string;
  label: string;
  quantity: number;
  pricePerDay: number;
};

type OrderSpec = {
  invoiceRef: string;
  sourceRef: string;
  partnerName: string;
  customer: string;
  location: string;
  startDate: string;
  endDate: string;
  nights: number;
  subtotal: number;
  deliveryFee: number;
  deliveryRaw: string;
  total: number;
  dp: number;
  remaining: number;
  evidence: string;
  invoiceText: string;
  items: OrderItemSpec[];
};

const ORDERS: OrderSpec[] = [
  {
    invoiceRef: 'SL-WA-001',
    sourceRef: 'WA-01',
    partnerName: 'Cust SL - Abdul Aziz Godean',
    customer: 'Abdul Aziz Salimi',
    location: 'Godean',
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    nights: 2,
    subtotal: 118000,
    deliveryFee: 10000,
    deliveryRaw: 'Ongkir Rp10.000',
    total: 128000,
    dp: 0,
    remaining: 128000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Abdul Aziz invoice rows',
    invoiceText:
      'Nama: Abdul Aziz Salimi; Lokasi: Godean; Kirim: 15 Mar 2026; Ambil: 17 Mar 2026; Paket Queen 160 x1 @59000 x2 malam = 118000; Ongkir 10000; Total 128000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 1,
        pricePerDay: 59000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-002',
    sourceRef: 'WA-02',
    partnerName: 'Cust SL - Abdul Aziz Godean',
    customer: 'Abdul Aziz Salimi',
    location: 'Godean',
    startDate: '2026-03-19',
    endDate: '2026-03-22',
    nights: 3,
    subtotal: 324000,
    deliveryFee: 0,
    deliveryRaw: 'Ongkir Rp10.000 free review Google Maps; net posted Rp0',
    total: 324000,
    dp: 0,
    remaining: 324000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Abdul Aziz second invoice rows',
    invoiceText:
      'Nama: Abdul Aziz Salimi; Lokasi: Godean; Kirim: 19 Mar 2026; Ambil: 22 Mar 2026; Queen 160 x1 @59000 x3 = 177000; Double 120 x1 @49000 x3 = 147000; Ongkir free review; Total 324000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 1,
        pricePerDay: 59000,
      },
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 1,
        pricePerDay: 49000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-003',
    sourceRef: 'WA-03',
    partnerName: 'Cust SL - Alfrida Wirogunan',
    customer: 'Alfrida',
    location: 'Wirogunan',
    startDate: '2026-03-23',
    endDate: '2026-03-27',
    nights: 4,
    subtotal: 348000,
    deliveryFee: 22000,
    deliveryRaw: 'Ongkir Rp32.000 - Rp10.000 review = Rp22.000',
    total: 370000,
    dp: 0,
    remaining: 370000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Alfrida invoice rows',
    invoiceText:
      'Nama: Alfrida; Lokasi: Wirogunan; Kirim: 23 Mar 2026; Ambil: 27 Mar 2026; Queen 160 x1 @59000 x4 = 236000; Bantal x4 @7000 x4 = 112000; Ongkir net 22000; Total 370000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 1,
        pricePerDay: 59000,
      },
      {
        kind: 'bundle',
        key: 'Add on Bantal (Untracked)',
        label: 'Add on Bantal',
        quantity: 4,
        pricePerDay: 7000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-004',
    sourceRef: 'WA-04',
    partnerName: 'Cust SL - Antoni Seyegan',
    customer: 'Antoni',
    location: 'Seyegan',
    startDate: '2026-03-20',
    endDate: '2026-03-24',
    nights: 4,
    subtotal: 784000,
    deliveryFee: 20000,
    deliveryRaw: 'Ongkir Rp20.000',
    total: 804000,
    dp: 0,
    remaining: 804000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Antoni invoice rows',
    invoiceText:
      'Nama: Antoni; Lokasi: Seyegan; Kirim: 20 Mar 2026; Ambil: 24 Mar 2026; Double 120 x4 @49000 x4 = 784000; Ongkir 20000; Total 804000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 4,
        pricePerDay: 49000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-005',
    sourceRef: 'WA-05',
    partnerName: 'Cust SL - Aries Concat',
    customer: 'Aries Nandarika',
    location: 'Condongcatur',
    startDate: '2026-04-03',
    endDate: '2026-04-06',
    nights: 3,
    subtotal: 675000,
    deliveryFee: 40000,
    deliveryRaw: 'Ongkir Rp50.000 - Rp10.000 review = Rp40.000',
    total: 715000,
    dp: 300000,
    remaining: 415000,
    evidence: 'carla-state-message-1745 wa; Aries added by later Carla state',
    invoiceText:
      'Nama: Aries Nandarika; Lokasi: Condongcatur; Kirim: 3 Apr 2026; Ambil: 6 Apr 2026; Single 100 x3 @40000 x3 = 360000; Single 90 x3 @35000 x3 = 315000; Ongkir net 40000; Total 715000; DP 300000; Sisa 415000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 3,
        pricePerDay: 40000,
      },
      {
        kind: 'bundle',
        key: 'Paket Single 90',
        label: 'Paket Single 90',
        quantity: 3,
        pricePerDay: 35000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-006',
    sourceRef: 'WA-06',
    partnerName: 'Cust SL - Dzaky Seyegan',
    customer: 'Dzaky',
    location: 'Seyegan',
    startDate: '2026-03-26',
    endDate: '2026-03-29',
    nights: 3,
    subtotal: 531000,
    deliveryFee: 21000,
    deliveryRaw: 'Ongkir Rp21.000',
    total: 552000,
    dp: 0,
    remaining: 552000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Dzaky invoice rows',
    invoiceText:
      'Nama: Dzaky; Lokasi: Seyegan; Kirim: 26 Mar 2026; Ambil: 29 Mar 2026; Queen 160 x3 @59000 x3 = 531000; Ongkir 21000; Total 552000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 3,
        pricePerDay: 59000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-007',
    sourceRef: 'WA-07',
    partnerName: 'Cust SL - Fendy Banguntapan',
    customer: 'Fendy',
    location: 'Banguntapan',
    startDate: '2026-03-18',
    endDate: '2026-03-25',
    nights: 7,
    subtotal: 616000,
    deliveryFee: 26000,
    deliveryRaw: 'Ongkir Rp46.000 - Rp20.000 = Rp26.000',
    total: 642000,
    dp: 0,
    remaining: 642000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Fendy invoice rows',
    invoiceText:
      'Nama: Fendy; Lokasi: Banguntapan; Kirim: 18 Mar 2026; Ambil: 25 Mar 2026; Single 100 x2 @44000 x7 = 616000; Ongkir net 26000; Total 642000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 2,
        pricePerDay: 44000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-008',
    sourceRef: 'WA-08',
    partnerName: 'Cust SL - Fendy Banguntapan',
    customer: 'Fendy (Perpanjangan)',
    location: 'Banguntapan',
    startDate: '2026-03-25',
    endDate: '2026-03-28',
    nights: 3,
    subtotal: 264000,
    deliveryFee: 0,
    deliveryRaw: 'Perpanjangan, ongkir Rp0',
    total: 264000,
    dp: 0,
    remaining: 264000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Fendy extension rows',
    invoiceText:
      'Nama: Fendy; Perpanjangan; Lokasi: Banguntapan; Kirim: 25 Mar 2026; Ambil: 28 Mar 2026; Single 100 x2 @44000 x3 = 264000; Total 264000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 2,
        pricePerDay: 44000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-009',
    sourceRef: 'WA-09',
    partnerName: 'Cust SL - Felis/ Ella Jitar Dukuh',
    customer: 'Felis / Ella',
    location: 'Jitar Dukuh',
    startDate: '2026-03-17',
    endDate: '2026-03-23',
    nights: 6,
    subtotal: 618000,
    deliveryFee: 26000,
    deliveryRaw: 'Ongkir Rp26.000',
    total: 644000,
    dp: 300000,
    remaining: 344000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Felis/Ella invoice and DP rows',
    invoiceText:
      'Nama: Felis / Ella; Lokasi: Jitar Dukuh; Kirim: 17 Mar 2026; Ambil: 23 Mar 2026; Queen 160 x1 @59000 x6 = 354000; Single 100 x1 @44000 x6 = 264000; Ongkir 26000; Total 644000; DP evidence 300000; Sisa 344000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 1,
        pricePerDay: 59000,
      },
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 1,
        pricePerDay: 44000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-010',
    sourceRef: 'WA-10',
    partnerName: 'Cust SL - Lucky Tajem',
    customer: 'Lucky Enjang',
    location: 'BMT BIF Tajem',
    startDate: '2026-03-17',
    endDate: '2026-03-18',
    nights: 1,
    subtotal: 39000,
    deliveryFee: 54000,
    deliveryRaw: 'Ongkir Rp54.000',
    total: 93000,
    dp: 40000,
    remaining: 53000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Lucky invoice rows and later paid/lunas context',
    invoiceText:
      'Nama: Lucky Enjang; Lokasi: BMT BIF Tajem; Kirim: 17 Mar 2026; Ambil: 18 Mar 2026; Single 90 x1 @39000 x1 = 39000; Ongkir 54000; Total 93000; DP 40000; Sisa 53000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 90',
        label: 'Paket Single 90',
        quantity: 1,
        pricePerDay: 39000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-011',
    sourceRef: 'WA-11',
    partnerName: 'Cust SL - Muji Jakal Km19',
    customer: 'Muji',
    location: 'Jakal KM19',
    startDate: '2026-03-24',
    endDate: '2026-03-25',
    nights: 1,
    subtotal: 252000,
    deliveryFee: 68000,
    deliveryRaw: 'Ongkir Rp68.000',
    total: 320000,
    dp: 0,
    remaining: 320000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Muji first invoice rows',
    invoiceText:
      'Nama: Muji; Lokasi: Jakal KM19; Kirim: 24 Mar 2026; Ambil: 25 Mar 2026; D120 tanpa sprei x2 @45000 = 90000; Single 100 x1 @44000 = 44000; Double 120 paket x2 @49000 = 98000; Selimut x2 @10000 = 20000; Ongkir 68000; Total 320000.',
    items: [
      {
        kind: 'item',
        key: 'RGE-120-BIRU',
        label: 'RGE 120 tanpa sprei',
        quantity: 2,
        pricePerDay: 45000,
      },
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 1,
        pricePerDay: 44000,
      },
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 2,
        pricePerDay: 49000,
      },
      {
        kind: 'bundle',
        key: 'Add on Selimut (Untracked)',
        label: 'Add on Selimut',
        quantity: 2,
        pricePerDay: 10000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-012',
    sourceRef: 'WA-12',
    partnerName: 'Cust SL - Muji Jakal Km19',
    customer: 'Muji',
    location: 'Jakal KM19',
    startDate: '2026-03-25',
    endDate: '2026-03-26',
    nights: 1,
    subtotal: 252000,
    deliveryFee: 0,
    deliveryRaw: 'Lanjutan harian, ongkir Rp0',
    total: 252000,
    dp: 0,
    remaining: 252000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Muji second invoice rows',
    invoiceText:
      'Nama: Muji; Lokasi: Jakal KM19; Kirim: 25 Mar 2026; Ambil: 26 Mar 2026; same rental item mix as WA-11; Total 252000.',
    items: [
      {
        kind: 'item',
        key: 'RGE-120-BIRU',
        label: 'RGE 120 tanpa sprei',
        quantity: 2,
        pricePerDay: 45000,
      },
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 1,
        pricePerDay: 44000,
      },
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 2,
        pricePerDay: 49000,
      },
      {
        kind: 'bundle',
        key: 'Add on Selimut (Untracked)',
        label: 'Add on Selimut',
        quantity: 2,
        pricePerDay: 10000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-013',
    sourceRef: 'WA-13',
    partnerName: 'Cust SL - Muji Jakal Km19',
    customer: 'Muji',
    location: 'Jakal KM19',
    startDate: '2026-03-26',
    endDate: '2026-03-27',
    nights: 1,
    subtotal: 252000,
    deliveryFee: 0,
    deliveryRaw: 'Lanjutan harian, ongkir Rp0',
    total: 252000,
    dp: 0,
    remaining: 252000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Muji third invoice rows',
    invoiceText:
      'Nama: Muji; Lokasi: Jakal KM19; Kirim: 26 Mar 2026; Ambil: 27 Mar 2026; same rental item mix as WA-11; Total 252000.',
    items: [
      {
        kind: 'item',
        key: 'RGE-120-BIRU',
        label: 'RGE 120 tanpa sprei',
        quantity: 2,
        pricePerDay: 45000,
      },
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 1,
        pricePerDay: 44000,
      },
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 2,
        pricePerDay: 49000,
      },
      {
        kind: 'bundle',
        key: 'Add on Selimut (Untracked)',
        label: 'Add on Selimut',
        quantity: 2,
        pricePerDay: 10000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-014',
    sourceRef: 'WA-14',
    partnerName: 'Cust SL - Nisrina Kotagede',
    customer: 'Nisrina',
    location: 'Kotagede',
    startDate: '2026-03-19',
    endDate: '2026-03-23',
    nights: 4,
    subtotal: 472000,
    deliveryFee: 46000,
    deliveryRaw: 'Ongkir Rp46.000',
    total: 518000,
    dp: 0,
    remaining: 518000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Nisrina invoice rows; DP amount not found',
    invoiceText:
      'Nama: Nisrina; Lokasi: Kotagede; Kirim: 19 Mar 2026; Ambil: 23 Mar 2026; Queen 160 x2 @59000 x4 = 472000; Ongkir 46000; Total 518000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 2,
        pricePerDay: 59000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-015',
    sourceRef: 'WA-15',
    partnerName: 'Cust SL Nawang - Klaci Godean Py',
    customer: 'Nawang',
    location: 'Klaci 3 Seyegan',
    startDate: '2026-04-12',
    endDate: '2026-04-13',
    nights: 1,
    subtotal: 45000,
    deliveryFee: 15000,
    deliveryRaw: 'Ongkir Rp15.000',
    total: 60000,
    dp: 20000,
    remaining: 40000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Nawang first invoice rows',
    invoiceText:
      'Nama: Nawang; Lokasi: Klaci 3 Seyegan; Kirim: 12 Apr 2026; Ambil: 13 Apr 2026; Double 120 x1 @45000 = 45000; Ongkir 15000; Total 60000; DP 20000; Sisa 40000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 1,
        pricePerDay: 45000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-016',
    sourceRef: 'WA-16',
    partnerName: 'Cust SL Nawang - Klaci Godean Py',
    customer: 'Nawang',
    location: 'Klaci 3 Seyegan',
    startDate: '2026-04-12',
    endDate: '2026-04-14',
    nights: 2,
    subtotal: 80000,
    deliveryFee: 15000,
    deliveryRaw: 'Ongkir Rp15.000',
    total: 95000,
    dp: 30000,
    remaining: 65000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Nawang second invoice rows',
    invoiceText:
      'Nama: Nawang; Lokasi: Klaci 3 Seyegan; Kirim: 12 Apr 2026; Ambil: 14 Apr 2026; Single 100 x1 @40000 x2 = 80000; Ongkir 15000; Total 95000; DP 30000; Sisa 65000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 1,
        pricePerDay: 40000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-017',
    sourceRef: 'WA-17',
    partnerName: 'Cust SL - Feris Sardonoharjo',
    customer: 'Feris',
    location: 'Greenhills Sardonoharjo',
    startDate: '2026-03-23',
    endDate: '2026-03-25',
    nights: 2,
    subtotal: 638000,
    deliveryFee: 47000,
    deliveryRaw: 'Ongkir Rp47.000',
    total: 685000,
    dp: 0,
    remaining: 685000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Feris invoice rows',
    invoiceText:
      'Nama: Feris; Lokasi: Greenhills Sardonoharjo; Kirim: 23 Mar 2026; Ambil: 25 Mar 2026; Single 100 x1 @44000 x2 = 88000; Double 120 x2 @49000 x2 = 196000; Queen 160 x3 @59000 x2 = 354000; Ongkir 47000; Total 685000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 100',
        label: 'Paket Single 100',
        quantity: 1,
        pricePerDay: 44000,
      },
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 2,
        pricePerDay: 49000,
      },
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 3,
        pricePerDay: 59000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-018',
    sourceRef: 'WA-18',
    partnerName: 'Cust SL - Zami Seyegan',
    customer: 'Zami Fatih',
    location: 'Seyegan',
    startDate: '2026-04-06',
    endDate: '2026-04-10',
    nights: 4,
    subtotal: 180000,
    deliveryFee: 25000,
    deliveryRaw: 'Ongkir Rp25.000',
    total: 205000,
    dp: 0,
    remaining: 205000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Zami invoice rows',
    invoiceText:
      'Nama: Zami Fatih; Lokasi: Seyegan; Kirim: 6 Apr 2026; Ambil: 10 Apr 2026; Double 120 x1 @45000 x4 = 180000; Ongkir 25000; Total 205000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 1,
        pricePerDay: 45000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-019',
    sourceRef: 'WA-19',
    partnerName: 'Cust SL - Jhon BT XT Square',
    customer: 'Jhon BT',
    location: 'Sidikan UH V/546',
    startDate: '2026-03-28',
    endDate: '2026-03-30',
    nights: 2,
    subtotal: 138000,
    deliveryFee: 45000,
    deliveryRaw: 'Ongkir Rp65.000 - Rp20.000 review = Rp45.000',
    total: 183000,
    dp: 75000,
    remaining: 108000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Jhon BT invoice rows',
    invoiceText:
      'Nama: Jhon BT; Lokasi: Sidikan UH V/546; Kirim: 28 Mar 2026; Ambil: 30 Mar 2026; Queen 160 x1 @59000 x2 = 118000; Sprei S100 x1 @10000 x2 = 20000; Ongkir net 45000; Total 183000; DP 75000; Sisa 108000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Queen 160',
        label: 'Paket Queen 160',
        quantity: 1,
        pricePerDay: 59000,
      },
      {
        kind: 'bundle',
        key: 'Add on Sprei (Untracked)',
        label: 'Add on Sprei',
        quantity: 1,
        pricePerDay: 10000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-020',
    sourceRef: 'WA-20',
    partnerName: 'Cust SL - Harmawan KulProg',
    customer: 'Harmawan',
    location: 'Swantari Terrace Villa',
    startDate: '2026-04-11',
    endDate: '2026-04-12',
    nights: 1,
    subtotal: 105000,
    deliveryFee: 40000,
    deliveryRaw: 'Ongkir Rp40.000',
    total: 145000,
    dp: 45000,
    remaining: 100000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Harmawan invoice rows',
    invoiceText:
      'Nama: Harmawan; Lokasi: Swantari Terrace Villa; Kirim: 11 Apr 2026; Ambil: 12 Apr 2026; Single 90 x3 @35000 = 105000; Ongkir 40000; Total 145000; DP 45000; Sisa 100000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Single 90',
        label: 'Paket Single 90',
        quantity: 3,
        pricePerDay: 35000,
      },
    ],
  },
  {
    invoiceRef: 'SL-WA-021',
    sourceRef: 'WA-21',
    partnerName: 'Cust SL - Aryadi Banguntapan',
    customer: 'Aryadi',
    location: 'Banguntapan Bantul',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    nights: 2,
    subtotal: 360000,
    deliveryFee: 60000,
    deliveryRaw: 'Ongkir Rp70.000 - Rp10.000 review = Rp60.000',
    total: 420000,
    dp: 126000,
    remaining: 294000,
    evidence: 'carla-state-message-1745 wa; raw evidence includes Aryadi invoice rows',
    invoiceText:
      'Nama: Aryadi; Lokasi: Banguntapan Bantul; Kirim: 10 Apr 2026; Ambil: 12 Apr 2026; Double 120 x4 @45000 x2 = 360000; Ongkir net 60000; Total 420000; DP 126000; Sisa 294000.',
    items: [
      {
        kind: 'bundle',
        key: 'Paket Double 120',
        label: 'Paket Double 120',
        quantity: 4,
        pricePerDay: 45000,
      },
    ],
  },
];

const NO_INVOICE_GAPS = [
  {
    customer: 'Agashi UNY',
    reason: 'Order complete label, but Feb 2026 chat invoice is encrypted or unavailable in export.',
  },
  {
    customer: 'd@pi1e - Jakal KM9',
    reason: 'Order complete label, but Feb 2026 chat invoice is encrypted or unavailable in export.',
  },
  {
    customer: 'Harza Arbaha Wates KP',
    reason: 'Only KTP/payment-info context found; invoice details were not found.',
  },
  {
    customer: 'Intan Griya Alvita',
    reason: 'Only thank-you/contact context found; invoice details were not found.',
  },
];

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object JSON response');
  }
  return value as JsonRecord;
}

function asArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected array JSON response');
  }
  return value.map(asRecord);
}

function parseResponse(raw: string): unknown {
  return JSON.parse(raw);
}

function getString(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function noteValue(notes: unknown, key: string): string {
  if (typeof notes !== 'string') return '';
  const prefix = `${key}=`;
  const line = notes
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
}

function invoiceRef(order: JsonRecord): string {
  return noteValue(order.notes, 'invoice_ref');
}

function csvEscape(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function localMidnightIso(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0)).toISOString();
}

function localDueIso(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0)).toISOString();
}

function toLocalDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function rentalDays(spec: OrderSpec): number {
  return Math.ceil(
    (new Date(localMidnightIso(spec.endDate)).getTime() -
      new Date(localMidnightIso(spec.startDate)).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function itemSubtotal(spec: OrderSpec): number {
  return spec.items.reduce(
    (sum, item) => sum + item.quantity * item.pricePerDay * spec.nights,
    0
  );
}

function buildNotes(spec: OrderSpec): string {
  return [
    `invoice_ref=${spec.invoiceRef}`,
    `source_ref=${spec.sourceRef}`,
    `source=carla_whatsapp_state_and_telegram_reports`,
    `source_session=20260527_carla_telegram_reports_and_state_db`,
    `evidence=${spec.evidence}`,
    `evidence_file=${EVIDENCE_FILE}`,
    `customer=${spec.customer}`,
    `location=${spec.location}`,
    `dp=${spec.dp}`,
    `remaining=${spec.remaining}`,
    `invoice_subtotal=${spec.subtotal}`,
    `delivery_fee=${spec.deliveryFee}`,
    `delivery_raw=${spec.deliveryRaw}`,
    `invoice_total=${spec.total}`,
    `invoice_items=${spec.items
      .map(
        (item) =>
          `${item.label} x${item.quantity} @${item.pricePerDay} x${spec.nights}`
      )
      .join('; ')}`,
    `invoice_text=${spec.invoiceText}`,
    `import_method=sync_erp_api_via_mcp_client`,
    `import_batch=${IMPORT_BATCH}`,
  ].join('\n');
}

function findByName(
  records: JsonRecord[],
  expectedName: string,
  typeLabel: string
): JsonRecord {
  const exact = records.find((record) => getString(record, 'name') === expectedName);
  if (exact) return exact;

  const normalizedExpected = expectedName.toLowerCase().replace(/\s+/g, ' ').trim();
  const fuzzy = records.find(
    (record) =>
      getString(record, 'name').toLowerCase().replace(/\s+/g, ' ').trim() ===
      normalizedExpected
  );
  if (fuzzy) return fuzzy;

  throw new Error(`${typeLabel} not found: ${expectedName}`);
}

function skuForRentalItem(item: JsonRecord): string {
  const product = asRecord(item.product ?? {});
  return (
    getString(product, 'sku') ||
    getString(item, 'sku') ||
    getString(item, 'productSku')
  );
}

function resolveOrderItems(
  spec: OrderSpec,
  bundles: JsonRecord[],
  rentalItems: JsonRecord[]
): JsonRecord[] {
  return spec.items.map((item) => {
    if (item.kind === 'bundle') {
      const bundle = findByName(bundles, item.key, 'Rental bundle');
      return {
        rentalBundleId: getString(bundle, 'id'),
        quantity: item.quantity,
        pricePerDay: item.pricePerDay,
      };
    }

    const rentalItem = rentalItems.find(
      (candidate) => skuForRentalItem(candidate) === item.key
    );
    if (!rentalItem) {
      throw new Error(`Rental item not found by SKU: ${item.key}`);
    }
    return {
      rentalItemId: getString(rentalItem, 'id'),
      quantity: item.quantity,
      pricePerDay: item.pricePerDay,
    };
  });
}

async function listAllOrders(): Promise<JsonRecord[]> {
  const orders: JsonRecord[] = [];
  let cursor: string | undefined;

  do {
    const payload: JsonRecord = { take: 100 };
    if (cursor) payload.cursor = cursor;
    const response = asRecord(
      parseResponse(await apiQuery('rental.orders.list', payload, COMPANY_ID))
    );
    orders.push(...asArray(response.items));
    cursor =
      typeof response.nextCursor === 'string'
        ? response.nextCursor
        : undefined;
  } while (cursor);

  return orders;
}

function writeLedger(rows: JsonRecord[]): void {
  const headers = [
    'action',
    'source_ref',
    'invoice_ref',
    'order_number',
    'order_id',
    'customer',
    'partner_name',
    'start_date',
    'end_date',
    'nights',
    'items',
    'subtotal_idr',
    'delivery_fee_idr',
    'total_idr',
    'dp_idr',
    'remaining_idr',
    'evidence',
  ];

  const dataRows = rows.map((row) =>
    headers.map((header) => csvEscape(row[header]))
  );
  fs.writeFileSync(
    RESULT_LEDGER,
    [headers, ...dataRows].map((row) => row.join(',')).join('\n') + '\n'
  );
}

async function main(): Promise<void> {
  if (!fs.existsSync(EVIDENCE_FILE)) {
    throw new Error(`Evidence file not found: ${EVIDENCE_FILE}`);
  }

  const specErrors = ORDERS.flatMap((spec) => {
    const errors: string[] = [];
    if (rentalDays(spec) !== spec.nights) {
      errors.push(`${spec.invoiceRef}: date range does not equal nights`);
    }
    if (itemSubtotal(spec) !== spec.subtotal) {
      errors.push(
        `${spec.invoiceRef}: item subtotal ${itemSubtotal(spec)} != ${spec.subtotal}`
      );
    }
    if (spec.subtotal + spec.deliveryFee !== spec.total) {
      errors.push(
        `${spec.invoiceRef}: subtotal + delivery ${spec.subtotal + spec.deliveryFee} != ${spec.total}`
      );
    }
    if (spec.total - spec.dp !== spec.remaining) {
      errors.push(
        `${spec.invoiceRef}: total - dp ${spec.total - spec.dp} != ${spec.remaining}`
      );
    }
    return errors;
  });
  if (specErrors.length) {
    throw new Error(`Spec validation failed:\n${specErrors.join('\n')}`);
  }

  const [partners, bundles, rentalItems, ordersBefore] = await Promise.all([
    apiQuery('partner.list', { type: 'CUSTOMER' }, COMPANY_ID).then((raw) =>
      asArray(parseResponse(raw))
    ),
    apiQuery('rentalBundle.list', { companyId: COMPANY_ID }, COMPANY_ID).then(
      (raw) => asArray(parseResponse(raw))
    ),
    apiQuery('rental.items.list', {}, COMPANY_ID).then((raw) =>
      asArray(parseResponse(raw))
    ),
    listAllOrders(),
  ]);

  const beforeRefs = new Set(
    ordersBefore.map((order) => invoiceRef(order)).filter(Boolean)
  );
  const duplicateInputRefs = ORDERS.map((spec) => spec.invoiceRef).filter(
    (ref, index, all) => all.indexOf(ref) !== index
  );
  if (duplicateInputRefs.length) {
    throw new Error(`Duplicate input invoice refs: ${duplicateInputRefs.join(', ')}`);
  }

  const results: JsonRecord[] = [];

  for (const spec of ORDERS) {
    const existing = ordersBefore.find(
      (order) =>
        invoiceRef(order) === spec.invoiceRef ||
        (typeof order.notes === 'string' &&
          order.notes.includes(`source_ref=${spec.sourceRef}`) &&
          order.notes.includes(`import_batch=${IMPORT_BATCH}`))
    );

    if (existing) {
      results.push({
        action: 'reused',
        source_ref: spec.sourceRef,
        invoice_ref: spec.invoiceRef,
        order_number: getString(existing, 'orderNumber'),
        order_id: getString(existing, 'id'),
        customer: spec.customer,
        partner_name: getString(asRecord(existing.partner ?? {}), 'name'),
        start_date: toLocalDate(existing.rentalStartDate),
        end_date: toLocalDate(existing.rentalEndDate),
        nights: spec.nights,
        items: spec.items.map((item) => `${item.label} x${item.quantity}`).join('; '),
        subtotal_idr: toNumber(existing.subtotal),
        delivery_fee_idr: toNumber(existing.deliveryFee),
        total_idr: toNumber(existing.totalAmount),
        dp_idr: spec.dp,
        remaining_idr: spec.remaining,
        evidence: spec.evidence,
      });
      continue;
    }

    const partner = findByName(partners, spec.partnerName, 'Partner');
    const created = asRecord(
      parseResponse(
        await apiMutation(
          'rental.orders.create',
          {
            partnerId: getString(partner, 'id'),
            rentalStartDate: localMidnightIso(spec.startDate),
            rentalEndDate: localMidnightIso(spec.endDate),
            dueDateTime: localDueIso(spec.endDate),
            deliveryAddress: spec.location,
            items: resolveOrderItems(spec, bundles, rentalItems),
            deliveryFee: spec.deliveryFee,
            notes: buildNotes(spec),
          },
          COMPANY_ID
        )
      )
    );

    if (toNumber(created.totalAmount) !== spec.total) {
      throw new Error(
        `${spec.invoiceRef}: created order total ${toNumber(created.totalAmount)} != expected ${spec.total}`
      );
    }

    results.push({
      action: 'created',
      source_ref: spec.sourceRef,
      invoice_ref: spec.invoiceRef,
      order_number: getString(created, 'orderNumber'),
      order_id: getString(created, 'id'),
      customer: spec.customer,
      partner_name: getString(asRecord(created.partner ?? partner), 'name'),
      start_date: toLocalDate(created.rentalStartDate),
      end_date: toLocalDate(created.rentalEndDate),
      nights: spec.nights,
      items: spec.items.map((item) => `${item.label} x${item.quantity}`).join('; '),
      subtotal_idr: toNumber(created.subtotal),
      delivery_fee_idr: toNumber(created.deliveryFee),
      total_idr: toNumber(created.totalAmount),
      dp_idr: spec.dp,
      remaining_idr: spec.remaining,
      evidence: spec.evidence,
    });
  }

  const ordersAfter = await listAllOrders();
  const slWaOrders = ordersAfter.filter((order) => invoiceRef(order).startsWith('SL-WA-'));
  const slInvOrders = ordersAfter.filter((order) => invoiceRef(order).startsWith('SL-INV-'));
  const scopedOrders = ordersAfter.filter((order) => {
    const ref = invoiceRef(order);
    return ref.startsWith('SL-WA-') || ref.startsWith('SL-INV-');
  });

  const refCounts = new Map<string, number>();
  for (const order of scopedOrders) {
    const ref = invoiceRef(order);
    if (ref) refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
  }
  const duplicateRefs = Array.from(refCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([ref, count]) => ({ ref, count }));
  const missingWaRefs = ORDERS.map((spec) => spec.invoiceRef).filter(
    (ref) => !slWaOrders.some((order) => invoiceRef(order) === ref)
  );

  const slWaTotal = slWaOrders.reduce(
    (sum, order) => sum + toNumber(order.totalAmount),
    0
  );
  const slWaDp = slWaOrders.reduce(
    (sum, order) => sum + Number(noteValue(order.notes, 'dp') || 0),
    0
  );
  const slWaRemaining = slWaOrders.reduce(
    (sum, order) => sum + Number(noteValue(order.notes, 'remaining') || 0),
    0
  );
  const scopedTotal = scopedOrders.reduce(
    (sum, order) => sum + toNumber(order.totalAmount),
    0
  );

  const summary = {
    companyId: COMPANY_ID,
    importBatch: IMPORT_BATCH,
    actions: {
      created: results.filter((row) => row.action === 'created').length,
      reused: results.filter((row) => row.action === 'reused').length,
    },
    before: {
      orderCount: ordersBefore.length,
      existingScopedRefs: Array.from(beforeRefs).filter(
        (ref) => ref.startsWith('SL-WA-') || ref.startsWith('SL-INV-')
      ).length,
    },
    after: {
      orderCount: ordersAfter.length,
      slWaOrderCount: slWaOrders.length,
      slWaTotal,
      slWaDp,
      slWaRemaining,
      slInvOrderCount: slInvOrders.length,
      slInvTotal: slInvOrders.reduce(
        (sum, order) => sum + toNumber(order.totalAmount),
        0
      ),
      scopedOrderCount: scopedOrders.length,
      scopedTotal,
    },
    expected: {
      slWaOrderCount: 21,
      slWaTotal: 7671000,
      slWaDp: 936000,
      slWaRemaining: 6735000,
      scopedOrderCountAfterBayu: 48,
      scopedTotalAfterBayu: 16687000,
    },
    checks: {
      missingWaRefs,
      duplicateRefs,
      slWaCountOk: slWaOrders.length === 21,
      slWaTotalOk: slWaTotal === 7671000,
      slWaDpOk: slWaDp === 936000,
      slWaRemainingOk: slWaRemaining === 6735000,
      scopedCountOk: scopedOrders.length === 48,
      scopedTotalOk: scopedTotal === 16687000,
      noInvoiceGaps: NO_INVOICE_GAPS,
    },
    resultLedger: RESULT_LEDGER,
    verificationReport: VERIFICATION_MD,
  };

  writeLedger(results);
  fs.writeFileSync(RESULT_JSON, `${JSON.stringify({ summary, results }, null, 2)}\n`);
  fs.writeFileSync(
    VERIFICATION_MD,
    [
      '# Santi Living WA Historical Rental Orders Input Verification - 2026-05-27',
      '',
      '## Result',
      '',
      `- Batch: ${IMPORT_BATCH}`,
      `- Created/reused: ${summary.actions.created}/${summary.actions.reused}`,
      `- SL-WA orders expected/found: ${summary.expected.slWaOrderCount}/${summary.after.slWaOrderCount}`,
      `- SL-WA total expected/found: Rp${summary.expected.slWaTotal.toLocaleString('id-ID')}/Rp${summary.after.slWaTotal.toLocaleString('id-ID')}`,
      `- SL-WA DP expected/found: Rp${summary.expected.slWaDp.toLocaleString('id-ID')}/Rp${summary.after.slWaDp.toLocaleString('id-ID')}`,
      `- SL-WA remaining expected/found: Rp${summary.expected.slWaRemaining.toLocaleString('id-ID')}/Rp${summary.after.slWaRemaining.toLocaleString('id-ID')}`,
      `- Combined SL-INV + SL-WA count expected/found: ${summary.expected.scopedOrderCountAfterBayu}/${summary.after.scopedOrderCount}`,
      `- Combined SL-INV + SL-WA total expected/found: Rp${summary.expected.scopedTotalAfterBayu.toLocaleString('id-ID')}/Rp${summary.after.scopedTotal.toLocaleString('id-ID')}`,
      `- Missing SL-WA refs: ${summary.checks.missingWaRefs.length ? summary.checks.missingWaRefs.join(', ') : 'none'}`,
      `- Duplicate scoped refs: ${summary.checks.duplicateRefs.length ? JSON.stringify(summary.checks.duplicateRefs) : 'none'}`,
      '',
      '## Orders Input',
      '',
      '| Ref | Order | Customer | Date | Total | DP | Remaining | Action |',
      '|---|---|---|---|---:|---:|---:|---|',
      ...results.map(
        (row) =>
          `| ${row.invoice_ref} | ${row.order_number} | ${row.customer} | ${row.start_date} to ${row.end_date} | Rp${Number(row.total_idr).toLocaleString('id-ID')} | Rp${Number(row.dp_idr).toLocaleString('id-ID')} | Rp${Number(row.remaining_idr).toLocaleString('id-ID')} | ${row.action} |`
      ),
      '',
      '## Not Posted To ERP Yet',
      '',
      ...NO_INVOICE_GAPS.map((gap) => `- ${gap.customer}: ${gap.reason}`),
      '',
      '## Files',
      '',
      `- Result JSON: ${RESULT_JSON}`,
      `- Result ledger: ${RESULT_LEDGER}`,
      `- Evidence file: ${EVIDENCE_FILE}`,
      '',
    ].join('\n')
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
