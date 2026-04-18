import fs from 'fs';
import path from 'path';

function walk(dir: string, callback: (filepath: string) => void) {
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat && stat.isDirectory()) {
      walk(filepath, callback);
    } else if (filepath.endsWith('.ts')) {
      callback(filepath);
    }
  });
}

const testDir = path.join(process.cwd(), 'apps/api/test');
let totalFixed = 0;

walk(testDir, (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  const orig = content;

  // ============================================================
  // FIX 1: Remove verbose journal-level find() lambda type annotations
  //         Let TypeScript infer from Prisma return type
  //         Pattern: (j: { reference?: string; sourceType?: string; lines: ... }) =>
  // ============================================================
  content = content.replace(
    /\(j: \{ reference\?: string; sourceType\?: string; lines: \{ account: \{ code: string \}; debit: import\("decimal\.js"\)\.Decimal; credit: import\("decimal\.js"\)\.Decimal \}\[\] \}\)/g,
    '(j)'
  );

  // ============================================================
  // FIX 2: Remove verbose line-level find() lambda type annotations
  //         Pattern: (l: { account: { code: string }; credit?: number|string; debit?: number|string }) =>
  // ============================================================
  content = content.replace(
    /\(l: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\)/g,
    '(l)'
  );

  // Also the Decimal variant
  content = content.replace(
    /\(l: \{ account\?: \{ code: string \}; debit: import\("decimal\.js"\)\.Decimal; credit: import\("decimal\.js"\)\.Decimal \}\)/g,
    '(l)'
  );

  // ============================================================
  // FIX 3: Remove structural casts on journal variables that are
  //         already properly typed from Prisma.
  //         Pattern: (xxxJournal as unknown as { lines: ... })
  // ============================================================
  content = content.replace(
    /\(grnJournal as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'grnJournal!'
  );
  content = content.replace(
    /\(billJournal as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'billJournal!'
  );
  content = content.replace(
    /\(payJournal as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'payJournal!'
  );
  content = content.replace(
    /\(shipJournal as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'shipJournal!'
  );
  content = content.replace(
    /\(invJournal as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'invJournal!'
  );
  content = content.replace(
    /\(settJournal as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'settJournal!'
  );
  content = content.replace(
    /\(j as unknown as \{ lines: \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\] \}\)/g,
    'j!'
  );

  // ============================================================
  // FIX 4: Handle bare `journalVar.lines` on possibly-undefined find result
  //         Add non-null assertions where expect(x).toBeDefined() precedes
  // ============================================================
  // Pattern: grnJournal.lines -> grnJournal!.lines (already patched above for casted ones)
  // For raw ones:
  const journalVars = ['grnJournal', 'billJournal', 'payJournal', 'shipJournal', 'invJournal', 
                        'settJournal', 'adjJournal', 'paymentJournal', 'shipmentJournal', 'salesJournal'];
  for (const v of journalVars) {
    // Replace bare `varName.lines` with `varName!.lines` (only when NOT already using !)
    const barePattern = new RegExp(`(?<!!)\\b${v}\\.lines`, 'g');
    content = content.replace(barePattern, `${v}!.lines`);
    // Also `varName.reference` access
    const refPattern = new RegExp(`(?<!!)\\b${v}\\.reference`, 'g');
    content = content.replace(refPattern, `${v}!.reference`);
  }

  // Fix drLine/crLine possibly undefined
  content = content.replace(/Number\(drLine\??\./g, 'Number(drLine!.');
  content = content.replace(/Number\(crLine\??\./g, 'Number(crLine!.');
  content = content.replace(/expect\(Number\(drLine\!\./g, 'expect(Number(drLine!.');
  content = content.replace(/expect\(Number\(crLine\!\./g, 'expect(Number(crLine!.');

  // ============================================================
  // FIX 5: Invoice/Bill policy tests - use Partial<Invoice> pattern
  //         Replace verbose structural cast with simple workaround
  // ============================================================
  content = content.replace(
    /\} as unknown as \{ id: string; status: import\("@sync-erp\/database"\)\.InvoiceStatus; orderId: string \| null; amount: import\("decimal\.js"\)\.Decimal; \[key: string\]: unknown \};/g,
    '} as never;'
  );
  // The issue is that BillPolicy.validateUpdate expects the full Invoice type
  // but tests only provide partial data. Using `as never` bypasses this safely in tests.

  // ============================================================
  // FIX 6: Remove unused JournalLine import that was left behind
  // ============================================================
  content = content.replace(
    /import \{ JournalLine \} from '@sync-erp\/shared';\n/g,
    ''
  );
  // Also handle the case where it's in a multi-import
  content = content.replace(
    /, JournalLine/g,
    ''
  );
  content = content.replace(
    /JournalLine, /g,
    ''
  );

  // ============================================================
  // FIX 7: finance-automation.test.ts - `const j = journal as unknown as ...`
  //         Replace with simple non-null assertion
  // ============================================================
  content = content.replace(
    /const j = journal as unknown as \{ lines: \{ account: \{ code: string \}; debit: import\("decimal\.js"\)\.Decimal; credit: import\("decimal\.js"\)\.Decimal \}\[\] \};/g,
    'const j = journal!;'
  );

  // ============================================================
  // FIX 8: expenses-flow.test.ts - caller/ctx type imports that don't resolve
  // ============================================================
  content = content.replace(
    /caller: ReturnType<typeof import\("\.\.\/\.\.\/src\/trpc\/trpc\.router"\)\.appRouter\.createCaller>;/g,
    'caller: ReturnType<typeof import("../../src/trpc/trpc.router").appRouter.createCaller>;'
  );
  content = content.replace(
    /ctx: import\("\.\.\/\.\.\/src\/trpc\/trpc"\)\.Context;/g,
    'ctx: Record<string, unknown>;'
  );
  // Fix import paths for integration tests  
  if (filepath.includes('/integration/')) {
    content = content.replace(
      /import\("\.\.\/\.\.\/\.\.\/src\/trpc\/trpc\.router"\)/g,
      'import("../../src/trpc/trpc.router")'
    );
    content = content.replace(
      /import\("\.\.\/\.\.\/\.\.\/src\/trpc\/trpc"\)/g,
      'import("../../src/trpc/trpc")'
    );
  }

  // ============================================================
  // FIX 9: sourceId on journal variable access
  // ============================================================
  // The `j.sourceId` access fails because our structural type for j doesn't have it.
  // But after removing the structural typing (FIX 1), the Prisma type should have it.

  // ============================================================
  // FIX 10: (lines as unknown as { account... }[]) still has Decimal mismatch
  //          Remove the cast and use bang operator since lines are from Prisma
  // ============================================================
  content = content.replace(
    /\(lines as unknown as \{ account: \{ code: string \}; credit\?: number\|string; debit\?: number\|string \}\[\]\)/g,
    'lines'
  );

  // ============================================================
  // FIX 11: req cast issue in expenses-flow - was wrongly converted
  // ============================================================
  content = content.replace(
    /\} as unknown as import\("@sync-erp\/shared"\)\.PrismaInvoiceWithRelations as unknown as import\("express"\)\.Request/g,
    '} as never'
  );

  if (content !== orig) {
    fs.writeFileSync(filepath, content, 'utf8');
    totalFixed++;
  }
});

console.log(`Fixed ${totalFixed} files`);
