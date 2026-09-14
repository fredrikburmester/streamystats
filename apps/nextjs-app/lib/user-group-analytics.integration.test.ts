import { beforeAll, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { migrateTestDatabase } from "../../../packages/database/tests/setup";

const url = process.env.STREAMYSTATS_TEST_DATABASE_URL;
beforeAll(async () => {
  if (url) await migrateTestDatabase(url);
}, 30_000);
test.skipIf(!url)(
  "backup routes restore merged historical accounts on a fresh server",
  async () => {
    const child = Bun.spawn(
      [
        process.execPath,
        "--preload",
        "./lib/__tests__/user-group-backup-preload.ts",
        "./lib/__tests__/user-group-backup-scenarios.ts",
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, DATABASE_URL: url },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);
    if (exitCode !== 0) throw new Error(stderr.slice(-10000));
    expect(exitCode).toBe(0);
  },
);
test.skipIf(!url)(
  "actual analytics queries combine users and retain exclusions",
  async () => {
    const child = Bun.spawn(
      [
        process.execPath,
        "--preload",
        "./lib/__tests__/user-group-preload.ts",
        "./lib/__tests__/user-group-analytics-scenarios.ts",
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, DATABASE_URL: url },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);
    if (exitCode !== 0) throw new Error(stderr.slice(-10000));
    expect(exitCode).toBe(0);
  },
);
