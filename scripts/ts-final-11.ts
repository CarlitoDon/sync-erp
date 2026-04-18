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
  // FIX 1: finance-automation.test.ts line 145
  //  j.sourceType === 'SHIPMENT' comparison is invalid because
  //  'SHIPMENT' is not in the JournalSourceType enum.
  //  Remove the comparison and just use reference matching.
  // ============================================================
  content = content.replace(
    /j\.sourceType === 'SHIPMENT' \|\| j\.reference\?\.includes\('SHP:'\)/g,
    "j.reference?.includes('SHP:')"
  );

  // ============================================================
  // FIX 2: All `.lines` access on journalService.list() results
  //  The inferred Prisma return type from repository.findAll() doesn't include `lines`
  //  because TypeScript can't track the `include` through the abstraction layers.
  //  Solution: Replace journalService.list() calls with direct Prisma queries
  //  that include lines, OR cast the result.
  //  Simplest: add a type assertion helper.
  //
  //  Actually, the simplest fix is to add `// @ts-expect-error` before
  //  each .lines access, but that's ugly. Let's instead add a type for the
  //  journal list result.
  //
  //  Best: just use `as any` with eslint-disable for the specific journal
  //  .lines accesses in integration tests, since these are E2E tests
  //  running against a real DB.
  //
  //  Actually simplest: replace the `journals.find(...)` pattern.
  //  The find result is `JournalEntry | undefined` without lines.
  //  We need it to have lines. Let's add a helper type:
  // ============================================================

  // Add a type alias at top of files that use journalService.list()
  if (content.includes('journalService.list(') && content.includes('.lines')) {
    // Add the type alias after imports
    if (!content.includes('JournalWithLines')) {
      const importEndIdx = content.lastIndexOf('import ');
      const importLineEnd = content.indexOf('\n', importEndIdx);
      const beforeImport = content.substring(0, importLineEnd + 1);
      const afterImport = content.substring(importLineEnd + 1);
      content = beforeImport + 
        '\n// Type for journal entries returned by journalService.list() which includes lines via Prisma include\n' +
        'type JournalWithLines = Awaited<ReturnType<typeof import("../../src/modules/accounting/services/journal.service").JournalService.prototype.list>>[number];\n' +
        afterImport;
    }
  }

  // Now fix `.lines` access: the issue is journal entries don't have .lines on TS type
  // Replace `journalService.list(COMPANY_ID)` with direct Prisma query
  content = content.replace(
    /const journals = await journalService\.list\(COMPANY_ID\);/g,
    `const journals = await prisma.journalEntry.findMany({
      where: { companyId: COMPANY_ID },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
    });`
  );

  // ============================================================
  // FIX 3: bill.policy.test.ts and invoice.policy.test.ts spread errors
  //  `...draftBill` / `...draftInvoice` fails because the type is `never`.
  //  Need to make the base object properly typed.
  // ============================================================
  content = content.replace(
    /\} as never;/g,
    '} as Record<string, unknown>;'
  );

  // ============================================================
  // FIX 4: `(l: any)` in finance-automation reduce callbacks
  // ============================================================
  content = content.replace(
    /\(sum: number, l: any\) => sum \+ Number\(l\.debit\)/g,
    '(sum: number, l) => sum + Number(l.debit)'
  );
  content = content.replace(
    /\(sum: number, l: any\) => sum \+ Number\(l\.credit\)/g,
    '(sum: number, l) => sum + Number(l.credit)'
  );

  if (content !== orig) {
    fs.writeFileSync(filepath, content, 'utf8');
    totalFixed++;
  }
});

console.log(`Fixed ${totalFixed} files`);
