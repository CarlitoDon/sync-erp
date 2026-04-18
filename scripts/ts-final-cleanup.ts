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

  // FIX 1: Remove unused JournalWithLines type alias
  content = content.replace(
    /\n\/\/ Type for journal entries returned by journalService\.list\(\) which includes lines via Prisma include\ntype JournalWithLines = Awaited<ReturnType<typeof import\("\.\.\/\.\.\/src\/modules\/accounting\/services\/journal\.service"\)\.JournalService\.prototype\.list>>\[number\];\n/g,
    '\n'
  );

  // FIX 2: Remove unused journalService imports now that we use direct Prisma queries
  // Only remove if journalService is no longer referenced in the file body
  if (content.includes("import { JournalService }") && !content.includes('journalService.')) {
    content = content.replace(
      /import \{ JournalService \} from '[^']+journal\.service';\n/g,
      ''
    );
    content = content.replace(
      /const journalService = new JournalService\(\);\n/g,
      ''
    );
  }

  // FIX 3: Invoice/Bill policy - use `as never` for the mock objects
  //         that intentionally only have partial properties for testing
  content = content.replace(
    /\} as Record<string, unknown>;/g,
    '} as never;'
  );

  // FIX 4: expenses-flow req cast
  content = content.replace(
    /\} as Record<string, unknown> as unknown as import\("express"\)\.Request/g,
    '} as never'
  );

  if (content !== orig) {
    fs.writeFileSync(filepath, content, 'utf8');
    totalFixed++;
  }
});

console.log(`Fixed ${totalFixed} files`);
