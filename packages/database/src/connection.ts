import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as dotenv from "dotenv";
import * as schema from "./schema";

// Ensure environment variables are loaded
dotenv.config({ quiet: true });

export const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Important: if the connection string is missing, postgres-js falls back to
    // PG* env vars and then the OS user. In root-run containers that becomes
    // "root", leading to confusing errors like: `FATAL: role "root" does not exist`.
    throw new Error(
      'DATABASE_URL environment variable is missing. Set DATABASE_URL (e.g. "postgresql://postgres:postgres@host:5432/streamystats").',
    );
  }
  return databaseUrl;
};

type Client = Sql<{}>;
type Db = PostgresJsDatabase<typeof schema> & { $client: Client };

const globalForDatabase = globalThis as unknown as {
  streamystatsClient?: Client;
  streamystatsDb?: Db;
};

// Lazily create the postgres client (avoid connecting during Next.js build/SSG)
export const getClient = (): Client => {
  if (!globalForDatabase.streamystatsClient) {
    globalForDatabase.streamystatsClient = postgres(getDatabaseUrl(), {
      max: 20, // Maximum number of connections in the pool
      idle_timeout: 20, // Close connections after 20 seconds of inactivity
      max_lifetime: 60 * 30, // Maximum lifetime of a connection (30 minutes)
      connect_timeout: 60,
      connection: {
        // Filtered vector searches (by item type, excluding watched items)
        // otherwise only see the index's first ~40 candidates, so a seed whose
        // nearest neighbours are of another type returns almost nothing.
        // pgvector >= 0.8; older versions drop the unknown setting.
        "hnsw.iterative_scan": "strict_order",
      },
    });
  }
  return globalForDatabase.streamystatsClient;
};

// Lazily create Drizzle database instance
export const getDb = (): Db => {
  if (!globalForDatabase.streamystatsDb) {
    globalForDatabase.streamystatsDb = drizzle(getClient(), { schema });
  }
  return globalForDatabase.streamystatsDb;
};

// Backwards-compatible exports: these do NOT touch env/DB until first use.
export const client: Client = new Proxy((() => {}) as unknown as Client, {
  apply(_target, thisArg, args) {
    return (getClient() as unknown as (...a: unknown[]) => unknown).apply(
      thisArg,
      args,
    );
  },
  get(_target, prop) {
    return (getClient() as never)[prop as never];
  },
});

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    return (getDb() as never)[prop as never];
  },
});

// Graceful shutdown helper
export const closeConnection = async () => {
  try {
    if (globalForDatabase.streamystatsClient) {
      await globalForDatabase.streamystatsClient.end();
      globalForDatabase.streamystatsClient = undefined;
      globalForDatabase.streamystatsDb = undefined;
    }
  } catch (error) {
    console.error("Error closing database connection:", error);
  }
};

export default db;
