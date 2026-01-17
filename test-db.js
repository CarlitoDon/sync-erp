import pg from 'pg';

async function testConnection() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres.vktglrwmbrhtddpmekda:JlGodeanKM10!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to Supabase database (pooler)');
    const result = await client.query('SELECT version()');
    console.log('Database version:', result.rows[0].version);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();