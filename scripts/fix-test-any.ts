import fs from 'fs';
import path from 'path';

function walk(dir: string, callback: (path: string) => void) {
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      walk(file, callback);
    } else if (file.endsWith('.ts')) {
      callback(file);
    }
  });
}

const testDir = path.join(process.cwd(), 'apps/api/test');

walk(testDir, (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replace = (regex: RegExp, replacer: string | ((m: string, ...args: any[]) => string)) => {
    const newContent = content.replace(regex, replacer as any);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  };

  replace(/\(fetchedBill as any\)/g, '(fetchedBill as unknown as { dpBill?: { id: string } })');
  replace(/\(lines as any\[\]\)/g, '(lines as { account: { code: string }; debit: number | string; credit: number | string }[])');
  replace(/\(grnJournal as any\)/g, '(grnJournal as unknown as { lines: { account?: { code: string }; debit: number | string; credit: number | string }[] })');
  replace(/\(billJournal as any\)/g, '(billJournal as unknown as { lines: { account?: { code: string }; debit: number | string; credit: number | string }[] })');
  replace(/\(j as any\)/g, '(j as unknown as { lines: { account?: { code: string }; debit: number | string; credit: number | string }[] })');
  replace(/\(l as any\)/g, '(l as unknown as { account?: { code: string }, debit: number | string, credit: number | string })');
  replace(/\(settJournal as any\)/g, '(settJournal as unknown as { lines: { account?: { code: string }; debit: number | string; credit: number | string }[] })');
  replace(/\(postedTx as any\)/g, '(postedTx as unknown as { sourceBank: { accountId: string }, destinationBank: { accountId: string } })');
  replace(/info: \{\} as any/g, 'info: {} as unknown as import("@sync-erp/database").Prisma.InputJsonValue');
  
  // Update mock cast paths based on unit dir depth
  replace(/mockRentalRepository as any/g, 'mockRentalRepository as unknown as import("../../../src/modules/rental/rental.repository").RentalRepository');
  replace(/mockJournalService as any/g, 'mockJournalService as unknown as import("../../../src/accounting/services/journal.service").JournalService');
  replace(/mockDocumentNumberService as any/g, 'mockDocumentNumberService as unknown as import("../../../src/modules/common/services/document-number.service").DocumentNumberService');
  replace(/mockRentalWebhookService as any/g, 'mockRentalWebhookService as unknown as import("../../../src/modules/rental/rental-webhook.service").RentalWebhookService');
  
  replace(/paymentMethod: 'CASH' as any/g, 'paymentMethod: "CASH" as import("@sync-erp/database").PaymentMethod');

  replace(/type: acc.type as any/g, 'type: acc.type as import("@sync-erp/database").AccountType');

  replace(/\} as any;/g, '} as unknown;');
  replace(/\} as any,/g, '} as unknown,');
  replace(/ as any\)/g, ' as unknown)');
  replace(/ as any,/g, ' as unknown,');
  replace(/ as any;/g, ' as unknown;');

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
  }
});
