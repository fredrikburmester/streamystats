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

// Export job defaults
export * from "./job-defaults";

// Export migration utilities
export { migrate } from "./migrate";

// Export Jellyfin auth utilities
export * from "./jellyfin-auth";
