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

// Export all schema tables and types
export * from "./schema";
export * from "./user-merge";
export * from "./user-merge-backup";

// Export job defaults
export * from "./job-defaults";

// Export migration utilities
export { migrate } from "./migrate";
