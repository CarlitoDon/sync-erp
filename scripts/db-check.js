import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.vktglrwmbrhtddpmekda:JlGodeanKM10!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  await client.connect();
  try {
    const t = await client.query("SELECT count(*) AS total FROM information_schema.tables WHERE table_name='prisma_migrations'");
    console.log('prisma_migrations exists:', t.rows[0].total);

    if (+t.rows[0].total) {
      const last = await client.query('SELECT id,applied_steps_count,finished_at,migration_name FROM prisma_migrations ORDER BY finished_at DESC LIMIT 5');
      console.log('last migrations:', last.rows);
    }

    const active = await client.query("SELECT pid,state,query_start,substring(query,1,300) as query FROM pg_stat_activity WHERE state <> 'idle' ORDER BY query_start DESC LIMIT 20");
    console.log('pg_stat_activity (active):', active.rows);

    const locks = await client.query("SELECT relation::regclass AS relation, mode, granted, pid FROM pg_locks JOIN pg_class ON pg_locks.relation=pg_class.oid WHERE NOT granted ORDER BY pid LIMIT 50");
    console.log('ungranted pg_locks:', locks.rows);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});
