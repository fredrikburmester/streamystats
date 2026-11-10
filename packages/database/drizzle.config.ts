import type { Config } from "drizzle-kit";
import { MISSING_DATABASE_URL_MESSAGE, resolveDatabaseUrl } from "./src/env";

const databaseUrl = resolveDatabaseUrl();
const isGenerate = process.argv.some((arg) => arg === "generate" || arg.endsWith("generate"));
if (!databaseUrl && !isGenerate) {
  throw new Error(MISSING_DATABASE_URL_MESSAGE);
}
if (!databaseUrl && isGenerate) {
  // `drizzle-kit generate` does not require a live DB connection, but drizzle-kit still
  // expects a URL in the config shape.
  console.warn(
    '[drizzle] DATABASE_URL missing; using placeholder for "generate" only.'
  );
}

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      databaseUrl ??
      "postgresql://postgres:postgres@localhost:5432/streamystats",
  },
} satisfies Config;
