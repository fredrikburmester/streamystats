import { readFileSync } from "node:fs";

/**
 * Secrets that can also be provided through a `<NAME>_FILE` variable pointing
 * to a file (Docker secrets, Kubernetes secret volumes, Vault/OpenBao agents).
 * Same convention as the official postgres image, which the AIO image bundles:
 * setting both NAME and NAME_FILE is an error, and only trailing newlines are
 * stripped from the file, so the app and postgres always read the same value.
 */
export const FILE_ENV_VARS = [
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "SESSION_SECRET",
  "INTERNAL_API_KEY",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
] as const;

export type FileEnvVar = (typeof FILE_ENV_VARS)[number];

let loaded = false;

/**
 * Resolve every `<NAME>_FILE` into `process.env[NAME]` so the rest of the code
 * (and libraries such as Next.js) keep reading plain environment variables.
 * Throws on a misconfiguration so it fails at startup. NAME_FILE is removed
 * once resolved: bundlers such as Next.js can load several copies of this
 * module in one process, and a later copy must not see NAME and NAME_FILE.
 */
export function loadFileEnv(): void {
  if (loaded) return;
  for (const name of FILE_ENV_VARS) {
    const file = process.env[`${name}_FILE`];
    if (!file) continue;
    if (process.env[name]) {
      throw new Error(
        `Both ${name} and ${name}_FILE are set, but they are exclusive`,
      );
    }
    let contents: string;
    try {
      contents = readFileSync(file, "utf-8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${name}_FILE (${file}): ${reason}`);
    }
    process.env[name] = contents.replace(/\n+$/, "");
    delete process.env[`${name}_FILE`];
  }
  loaded = true;
}

/** Test hook: allow loadFileEnv() to run again. */
export function resetFileEnvForTests(): void {
  loaded = false;
}

export function buildDatabaseUrl({
  user,
  password,
  host,
  port,
  database,
}: {
  user: string;
  password: string;
  host: string;
  port: string | number;
  database: string;
}): string {
  // IPv6 literals must be bracketed inside a URL
  const urlHost =
    host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${urlHost}:${port}/${encodeURIComponent(database)}`;
}

/**
 * Resolve the PostgreSQL connection string: DATABASE_URL when set, otherwise
 * built from POSTGRES_PASSWORD plus the optional POSTGRES_USER, POSTGRES_HOST,
 * POSTGRES_PORT and POSTGRES_DB. Returns undefined when neither
 * DATABASE_URL nor POSTGRES_PASSWORD is set.
 */
export function resolveDatabaseUrl(): string | undefined {
  // Also covers entry points that do not import load-env (scripts, drizzle-kit)
  loadFileEnv();

  const { DATABASE_URL, POSTGRES_PASSWORD } = process.env;
  if (DATABASE_URL) return DATABASE_URL;
  if (!POSTGRES_PASSWORD) return undefined;

  return buildDatabaseUrl({
    user: process.env.POSTGRES_USER || "postgres",
    password: POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST || "localhost",
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || "streamystats",
  });
}

export const MISSING_DATABASE_URL_MESSAGE =
  'Database connection is not configured. Set DATABASE_URL (e.g. "postgresql://postgres:postgres@host:5432/streamystats"), or POSTGRES_PASSWORD with optional POSTGRES_USER/POSTGRES_HOST/POSTGRES_PORT/POSTGRES_DB. DATABASE_URL and POSTGRES_PASSWORD also accept a *_FILE variant.';
