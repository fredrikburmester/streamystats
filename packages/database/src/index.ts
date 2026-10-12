// Export the database connection (lazy-init; safe to import in Next.js build/SSG)
export {
  client,
  db,
  default as database,
  closeConnection,
  getClient,
  getDatabaseUrl,
  getDb,
} from "./connection";

export {
  buildDatabaseUrl,
  FILE_ENV_VARS,
  type FileEnvVar,
  loadFileEnv,
  resolveDatabaseUrl,
} from "./env";

// Export all schema tables and types
export * from "./schema";
export * from "./user-merge";
export * from "./user-merge-backup";

// Export job defaults
export * from "./job-defaults";

export { embeddableItemCondition } from "./embeddable";

// Export migration utilities
export { migrate } from "./migrate";
