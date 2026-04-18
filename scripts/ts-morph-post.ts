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

  // Fix UserRole
  replace(/import\("@sync-erp\/shared"\)\.UserRole/g, 'import("@sync-erp/database").UserRole');

  // Fix lines on never
  replace(/\(grnJournal as never\)\.lines/g, '(grnJournal as unknown as { lines: any[] }).lines'); // wait NO any!
  replace(/\(grnJournal as never\)/g, '(grnJournal as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(payJournal as never\)/g, '(payJournal as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(shipJournal as never\)/g, '(shipJournal as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(invJournal as never\)/g, '(invJournal as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(billJournal as never\)/g, '(billJournal as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(j as never\)/g, '(j as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(js as never\)/g, '(js as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  replace(/\(settJournal as never\)/g, '(settJournal as unknown as { lines: { account: { code: string }; credit?: number|string; debit?: number|string }[] })');
  
  // Fix l.account undefined issue by removing optional
  replace(/account\?: \{ code: string \}/g, 'account: { code: string }');

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
  }
});
