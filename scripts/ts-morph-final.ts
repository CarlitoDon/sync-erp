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
  // FIX 1: setup.ts - Revert broken getTestGlobal call
  // ============================================================
  content = content.replace(
    /const state = \(getTestGlobal\("globalThis"\) as unknown as Record<string, unknown>\)\.__vitest_worker__;/g,
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const state = (globalThis as Record<string, unknown>).__vitest_worker__ as Record<string, unknown> | undefined;'
  );
  content = content.replace(
    /const filepath = state\?\.filepath \|\| '';/g,
    "const filepath = (state?.filepath as string) || '';"
  );

  // ============================================================
  // FIX 2: UserRole doesn't exist in @sync-erp/database - use string literal
  // ============================================================
  content = content.replace(
    /import\("@sync-erp\/database"\)\.UserRole/g,
    'string'
  );
  content = content.replace(
    /import\("@sync-erp\/shared"\)\.UserRole/g,
    'string'
  );

  // ============================================================
  // FIX 3: PaymentMethod doesn't exist as enum - use string
  // ============================================================
  content = content.replace(
    /import\("@sync-erp\/database"\)\.PaymentMethod/g,
    'string'
  );

  // ============================================================
  // FIX 4: PrismaInvoiceWithRelations doesn't exist in shared
  //         Replace with inline structural type for test data
  // ============================================================
  content = content.replace(
    /import\("@sync-erp\/shared"\)\.PrismaInvoiceWithRelations/g,
    '{ id: string; status: import("@sync-erp/database").InvoiceStatus; orderId: string | null; amount: import("decimal.js").Decimal; [key: string]: unknown }'
  );

  // ============================================================
  // FIX 5: (journals.find((j: any) => ...) as never)
  //         The 'as never' kills the type. Replace with typed find.
  //         Pattern: `) as never;` at end of a journals.find call
  // ============================================================
  // Match the pattern: find((j: any) => ...) as never;
  content = content.replace(
    /\(j: any\)/g,
    '(j: { reference?: string; sourceType?: string; lines: { account: { code: string }; debit: import("decimal.js").Decimal; credit: import("decimal.js").Decimal }[] })'
  );
  content = content.replace(
    /\) as never;/g,
    ');'
  );

  // ============================================================
  // FIX 6: .lines access on journal variables that are now typed via find()
  //         The journal variables from find() already carry the right type
  //         from the array element type, so no cast needed - except when
  //         find returns undefined. The issue is the 'as never' killed it.
  //         After removing 'as never', the Prisma type should flow through.
  //         But there are bare `grnJournal.lines` without the cast.
  // ============================================================
  // These are already correct from previous fixes - the issue was `as never` upstream.

  // ============================================================
  // FIX 7: l.account possibly undefined - was from our optional typing.
  //         Prisma includes always return defined account, so
  //         the test lambda types should use non-optional account.
  // ============================================================
  // Already handled in ts-morph-final. Just need to ensure no optional remains.

  // ============================================================
  // FIX 8: expenses-flow.test.ts import path issues
  //         '../../../src/trpc/trpc' - wrong depth for integration tests
  // ============================================================
  if (filepath.includes('/integration/')) {
    content = content.replace(
      /import\("\.\.\/\.\.\/\.\.\/src\/trpc\/trpc"\)/g,
      'import("../../src/trpc/trpc")'
    );
    content = content.replace(
      /import\("\.\.\/\.\.\/\.\.\/src\/trpc\/trpc\.router"\)/g,
      'import("../../src/trpc/trpc.router")'
    );
  }

  // ============================================================
  // FIX 9: InputJsonValue not assignable to TRPCRequestInfo
  //         The info field in tRPC context - just make it `never` in test
  // ============================================================
  content = content.replace(
    /info: \{\} as unknown as import\("@sync-erp\/database"\)\.Prisma\.InputJsonValue/g,
    'info: {} as never'
  );
  content = content.replace(
    /info: \{\} as import\("@sync-erp\/database"\)\.Prisma\.InputJsonValue/g,
    'info: {} as never'
  );

  // ============================================================
  // FIX 10: (lines as { account... }) cast needs `unknown` intermediary
  //          when Prisma types have Decimal but our cast uses number|string
  // ============================================================
  content = content.replace(
    /\(lines as \{ account/g,
    '(lines as unknown as { account'
  );

  // ============================================================
  // FIX 11: o2c-tempo-dp JournalLine lambda type mismatch
  //          (l: JournalLine) => ... is used inside .some() on a
  //          structurally-cast array. Remove the explicit lambda type.
  // ============================================================
  content = content.replace(
    /\(l: JournalLine\) =>/g,
    '(l: { account?: { code: string }; debit: import("decimal.js").Decimal; credit: import("decimal.js").Decimal }) =>'
  );

  // ============================================================
  // FIX 12: finance-automation `const j = journal as never;`
  //          Pattern from generic `} as never` replacement
  // ============================================================
  content = content.replace(
    /const j = journal as never;/g,
    'const j = journal as unknown as { lines: { account: { code: string }; debit: import("decimal.js").Decimal; credit: import("decimal.js").Decimal }[] };'
  );

  // ============================================================
  // FIX 13: Remaining `as never` from catch-all replacements that
  //         broke specific structural types. Replace with proper types
  //         when possible, or remove if the object already has needed shape.
  // ============================================================
  // idempotency test - result.id access on 'never'
  content = content.replace(
    /const result = await caller\.procurement\.createPO\(([^)]+)\) as never;/g,
    'const result = await caller.procurement.createPO($1);'
  );

  if (content !== orig) {
    fs.writeFileSync(filepath, content, 'utf8');
    totalFixed++;
  }
});

console.log(`Fixed ${totalFixed} files`);
