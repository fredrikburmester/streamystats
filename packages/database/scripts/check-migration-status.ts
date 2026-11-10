import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import { MISSING_DATABASE_URL_MESSAGE, resolveDatabaseUrl } from "../src/env";

interface MigrationRecord {
  id: number;
  hash: string;
  created_at: string;
}

async function checkMigrationStatus(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    console.error(`❌ ${MISSING_DATABASE_URL_MESSAGE}`);
    process.exit(1);
  }

  console.log("🔍 Checking migration status...\n");

  const sql = postgres(databaseUrl);

  try {
    // Check database connection
    console.log("📡 Testing database connection...");
    await sql`SELECT 1`;
    console.log("✅ Database connection successful\n");

    // Check if migrations table exists
    const migrationTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      )
    `;

    if (!migrationTableExists[0].exists) {
      console.log(
        "⚠️  Migration table does not exist. No migrations have been run yet."
      );
      return;
    }

    // Get applied migrations
    const appliedMigrations = await sql<MigrationRecord[]>`
      SELECT id, hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY id
    `;

    console.log(`📋 Applied migrations (${appliedMigrations.length} total):\n`);

    appliedMigrations.forEach((migration) => {
      const date = new Date(migration.created_at).toLocaleString();
      console.log(`  - Migration #${migration.id}`);
      console.log(`    Hash: ${migration.hash}`);
      console.log(`    Applied: ${date}\n`);
    });

    // Check pending migrations
    const migrationsDir = path.join(__dirname, "../drizzle");

    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      console.log(
        `📁 Migration files in drizzle/ directory (${migrationFiles.length} total):\n`
      );

      migrationFiles.forEach((file) => {
        console.log(`  - ${file}`);
      });

      // Simple check for pending migrations (comparing count)
      const pendingCount = migrationFiles.length - appliedMigrations.length;

      if (pendingCount > 0) {
        console.log(`\n⚠️  ${pendingCount} migration(s) may be pending`);
      } else if (pendingCount < 0) {
        console.log(
          `\n⚠️  Database has more migrations than files. This might indicate missing migration files.`
        );
      } else {
        console.log(`\n✅ All migrations appear to be applied`);
      }
    }

    // Check extensions
    console.log("\n🔌 Checking database extensions:\n");

    const extensions = await sql`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname IN ('vector', 'uuid-ossp')
    `;

    const requiredExtensions = ["vector", "uuid-ossp"];
    const installedExtensions = extensions.map((ext) => ext.extname);

    requiredExtensions.forEach((ext) => {
      const installed = installedExtensions.includes(ext);
      const version = extensions.find((e) => e.extname === ext)?.extversion;

      if (installed) {
        console.log(`  ✅ ${ext} (v${version})`);
      } else {
        console.log(`  ❌ ${ext} (not installed)`);
      }
    });

    // Check tables
    console.log("\n📊 Database tables:\n");

    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;

    if (tables.length === 0) {
      console.log("  ⚠️  No tables found in public schema");
    } else {
      tables.forEach((table) => {
        console.log(`  - ${table.tablename}`);
      });
    }

    console.log("\n✅ Migration status check complete");
  } catch (error) {
    console.error("❌ Error checking migration status:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the check
checkMigrationStatus().catch(console.error);
