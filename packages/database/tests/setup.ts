import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function migrateTestDatabase(url: string) {
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("Use an isolated database ending in _test.");
  }
  const client = postgres(url, { max: 1 });
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    await client`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
  } finally {
    await client.end();
  }
}
