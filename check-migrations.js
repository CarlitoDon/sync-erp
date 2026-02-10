var Pool = require("/home/u1046450/public_html/apps/api/node_modules/pg").Pool;
var p = new Pool({connectionString: "postgresql://postgres.vktglrwmbrhtddpmekda:JlGodeanKM10!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"});

async function main() {
  // Check Prisma migrations history
  try {
    var r = await p.query('SELECT * FROM "_prisma_migrations" ORDER BY "finished_at" DESC LIMIT 10');
    console.log("Last 10 Prisma migrations:");
    r.rows.forEach(function(row) {
      console.log("  " + row.finished_at + " | " + row.migration_name + " | steps: " + row.applied_steps_count + " | rolled_back: " + row.rolled_back_at);
    });
  } catch(e) {
    console.log("No _prisma_migrations table: " + e.message);
  }

  // Check if _prisma_migrations table exists
  try {
    var r3 = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations'");
    console.log("\n_prisma_migrations table exists: " + (r3.rows.length > 0));
  } catch(e) {
    console.log("Error checking table: " + e.message);
  }

  // Check for dangerous queries in pg_stat_statements
  try {
    var r4 = await p.query("SELECT query, calls, total_exec_time FROM pg_stat_statements WHERE query ILIKE '%truncate%' OR query ILIKE '%drop table%' OR query ILIKE '%delete from%' ORDER BY total_exec_time DESC LIMIT 20");
    console.log("\nDangerous queries in pg_stat_statements:");
    r4.rows.forEach(function(row) {
      console.log("  calls=" + row.calls + " | " + row.query.substring(0, 150));
    });
  } catch(e) {
    console.log("\npg_stat_statements: " + e.message);
  }

  // Check Supabase auth audit log
  try {
    var r5 = await p.query("SELECT * FROM auth.audit_log_entries ORDER BY created_at DESC LIMIT 5");
    console.log("\nAuth audit entries:");
    r5.rows.forEach(function(row) {
      console.log("  " + row.created_at + " | " + row.ip_address);
    });
  } catch(e) {
    console.log("\nauth.audit_log: " + e.message);
  }

  // Check supabase migrations
  try {
    var r6 = await p.query("SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5");
    console.log("\nSupabase schema migrations:");
    r6.rows.forEach(function(row) {
      console.log("  version=" + row.version + " | " + (row.name || ""));
    });
  } catch(e) {
    console.log("\nsupabase_migrations: " + e.message);
  }

  process.exit(0);
}

main().catch(function(e) { console.error("FATAL:", e.message); process.exit(1); });
