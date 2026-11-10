import { migrate as drizzleMigrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as dotenv from "dotenv";
import { MISSING_DATABASE_URL_MESSAGE, resolveDatabaseUrl } from "./env";

dotenv.config({ quiet: true });

const getConnectionString = () => {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(MISSING_DATABASE_URL_MESSAGE);
  }
  return url;
};

export async function migrate() {
  const connectionString = getConnectionString();
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("Running migrations...");
  await drizzleMigrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed!");

  await migrationClient.end();
}

async function runMigration() {
  await migrate();
}

// Only run if this file is executed directly
if (require.main === module) {
  runMigration().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
