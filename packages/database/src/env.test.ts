import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDatabaseUrl,
  FILE_ENV_VARS,
  loadFileEnv,
  resetFileEnvForTests,
  resolveDatabaseUrl,
} from "./env";

const savedEnv = { ...process.env };
const DB_VARS = [
  "POSTGRES_USER",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
];
let dir: string;

const secretFile = (name: string, contents: string) => {
  const path = join(dir, name);
  writeFileSync(path, contents);
  return path;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "streamystats-env-"));
  for (const name of [...FILE_ENV_VARS, ...DB_VARS]) {
    delete process.env[name];
    delete process.env[`${name}_FILE`];
  }
  resetFileEnvForTests();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
});

describe("loadFileEnv", () => {
  test("copies a _FILE value into process.env without trailing newlines", () => {
    process.env.SESSION_SECRET_FILE = secretFile("session", "from-file\n\n");
    loadFileEnv();
    expect(process.env.SESSION_SECRET).toBe("from-file");
  });

  test("keeps other whitespace, like postgres does (CRLF files keep the \\r)", () => {
    process.env.POSTGRES_PASSWORD_FILE = secretFile("pw", " s3cret\r\n");
    loadFileEnv();
    expect(process.env.POSTGRES_PASSWORD).toBe(" s3cret\r");
  });

  test("leaves plain variables alone", () => {
    process.env.SESSION_SECRET = "plain";
    loadFileEnv();
    expect(process.env.SESSION_SECRET).toBe("plain");
  });

  test("rejects a variable set both directly and through _FILE", () => {
    process.env.SESSION_SECRET = "plain";
    process.env.SESSION_SECRET_FILE = secretFile("session", "from-file");
    expect(() => loadFileEnv()).toThrow(
      /Both SESSION_SECRET and SESSION_SECRET_FILE/,
    );
  });

  test("throws a clear error when the file cannot be read", () => {
    process.env.SESSION_SECRET_FILE = join(dir, "missing");
    expect(() => loadFileEnv()).toThrow(/Failed to read SESSION_SECRET_FILE/);
  });

  test("a second copy of the module does not re-resolve or reject", () => {
    process.env.SESSION_SECRET_FILE = secretFile("session", "from-file\n");
    loadFileEnv();
    expect(process.env.SESSION_SECRET_FILE).toBeUndefined();
    // Same process, fresh module state (e.g. another Next.js bundle)
    resetFileEnvForTests();
    expect(() => loadFileEnv()).not.toThrow();
    expect(process.env.SESSION_SECRET).toBe("from-file");
  });

  test("runs once per process", () => {
    const path = secretFile("key", "first");
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY_FILE = path;
    loadFileEnv();
    writeFileSync(path, "second");
    loadFileEnv();
    expect(process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY).toBe("first");
  });
});

describe("resolveDatabaseUrl", () => {
  test("prefers DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://a:b@db:5432/c";
    process.env.POSTGRES_PASSWORD = "ignored";
    expect(resolveDatabaseUrl()).toBe("postgresql://a:b@db:5432/c");
  });

  test("reads DATABASE_URL_FILE", () => {
    process.env.DATABASE_URL_FILE = secretFile(
      "url",
      "postgresql://a:b@db:5432/c\n",
    );
    expect(resolveDatabaseUrl()).toBe("postgresql://a:b@db:5432/c");
  });

  test("derives the URL from POSTGRES_PASSWORD with defaults", () => {
    process.env.POSTGRES_PASSWORD = "secret";
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://postgres:secret@localhost:5432/streamystats",
    );
  });

  test("derives the URL from POSTGRES_PASSWORD_FILE and POSTGRES_* and encodes it", () => {
    process.env.POSTGRES_USER = "stats";
    process.env.POSTGRES_PASSWORD_FILE = secretFile("pw", "p@ss:w/rd é%\n");
    process.env.POSTGRES_HOST = "vectorchord";
    process.env.POSTGRES_PORT = "6543";
    process.env.POSTGRES_DB = "db";
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://stats:p%40ss%3Aw%2Frd%20%C3%A9%25@vectorchord:6543/db",
    );
  });

  test("returns undefined when nothing is configured", () => {
    expect(resolveDatabaseUrl()).toBeUndefined();
  });
});

describe("buildDatabaseUrl", () => {
  test("encodes credentials and database name", () => {
    expect(
      buildDatabaseUrl({
        user: "u@x",
        password: "p w",
        host: "h",
        port: 1,
        database: "d/b",
      }),
    ).toBe("postgresql://u%40x:p%20w@h:1/d%2Fb");
  });

  test("brackets IPv6 hosts", () => {
    expect(
      buildDatabaseUrl({
        user: "u",
        password: "p",
        host: "fd00::5",
        port: 5432,
        database: "d",
      }),
    ).toBe("postgresql://u:p@[fd00::5]:5432/d");
    expect(
      buildDatabaseUrl({
        user: "u",
        password: "p",
        host: "[::1]",
        port: 5432,
        database: "d",
      }),
    ).toBe("postgresql://u:p@[::1]:5432/d");
  });
});
