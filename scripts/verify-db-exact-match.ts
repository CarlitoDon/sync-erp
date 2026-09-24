import { execSync } from 'node:child_process';

function getLocalTableCounts(): Record<string, number> {
  const query = `
    SELECT jsonb_object_agg(t.tablename, t.cnt)
    FROM (
      SELECT tablename, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS cnt
      FROM (
        SELECT tablename, query_to_xml(format('SELECT count(*) AS cnt FROM %I', tablename), false, true, '') AS xml_count
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      ) sub
    ) t;
  `;
  const out = execSync(`/opt/homebrew/bin/psql -U wecik -d sync-erp-dev -t -A -c "${query.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
  return JSON.parse(out.trim());
}

function getContainerTableCounts(dbName: string): Record<string, number> {
  const query = `
    SELECT jsonb_object_agg(t.tablename, t.cnt)
    FROM (
      SELECT tablename, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS cnt
      FROM (
        SELECT tablename, query_to_xml(format('SELECT count(*) AS cnt FROM %I', tablename), false, true, '') AS xml_count
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      ) sub
    ) t;
  `;
  const cmd = `docker exec -e PGPASSWORD=c13d02c8681a8f6933cbc8f5c94bb6f571e2fa6137f7bd78 sync-erp-postgres psql -U sync_erp -d ${dbName} -t -A -c "${query.replace(/\n/g, ' ')}"`;
  const out = execSync(cmd, { encoding: 'utf-8' });
  return JSON.parse(out.trim());
}

async function verify() {
  console.log('🔍 Running 3-Way Database Exact Match Verification...');

  const devCounts = getLocalTableCounts();
  const stagingCounts = getContainerTableCounts('sync_erp_staging');
  const prodCounts = getContainerTableCounts('sync_erp');

  const allTables = Array.from(new Set([...Object.keys(devCounts), ...Object.keys(stagingCounts), ...Object.keys(prodCounts)])).sort();

  console.log(`\nFound ${allTables.length} total tables across environments.\n`);

  let mismatches = 0;
  console.log(
    'Table Name'.padEnd(32) +
    'Dev (Local)'.padEnd(14) +
    'Staging'.padEnd(14) +
    'Production'.padEnd(14) +
    'Status'
  );
  console.log('-'.repeat(80));

  for (const table of allTables) {
    const dev = devCounts[table] ?? 0;
    const stg = stagingCounts[table] ?? 0;
    const prd = prodCounts[table] ?? 0;

    const matches = dev === stg && stg === prd;
    if (!matches) mismatches++;

    // Only show tables with > 0 rows or if there's a mismatch
    if (dev > 0 || stg > 0 || prd > 0 || !matches) {
      console.log(
        table.padEnd(32) +
        String(dev).padEnd(14) +
        String(stg).padEnd(14) +
        String(prd).padEnd(14) +
        (matches ? '✅ MATCH' : '❌ MISMATCH')
      );
    }
  }

  console.log('-'.repeat(80));
  if (mismatches === 0) {
    console.log(`\n🎉 ALL ${allTables.length} TABLES MATCH EXACTLY ACROSS DEV, STAGING, AND PRODUCTION! (0 mismatches)\n`);
  } else {
    console.error(`\n❌ FOUND ${mismatches} TABLE MISMATCHES!\n`);
    process.exit(1);
  }

  // Sample check key orders
  console.log('📋 Sample Check: Rental Orders Across Environments:');
  for (const [env, db] of [['Staging', 'sync_erp_staging'], ['Production', 'sync_erp']] as const) {
    const ordersCmd = `docker exec -e PGPASSWORD=c13d02c8681a8f6933cbc8f5c94bb6f571e2fa6137f7bd78 sync-erp-postgres psql -U sync_erp -d ${db} -t -A -c "SELECT \\"orderNumber\\", status, \\"rentalPaymentStatus\\", \\"totalAmount\\", \\"depositAmount\\" FROM \\"RentalOrder\\" ORDER BY \\"orderNumber\\";"`;
    const rows = execSync(ordersCmd, { encoding: 'utf-8' }).trim().split('\n');
    console.log(`  [${env}] Total Orders: ${rows.length}`);
    for (const r of rows) {
      console.log(`    ${r}`);
    }
  }
}

verify().catch(console.error);
