import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("backup export and import routes", () => {
  // Bun module mocks are global. The backup suite replaces @streamystats/database
  // and drizzle-orm, so run it in its own process, away from the real database suites.
  const result = Bun.spawnSync(
    [
      process.execPath,
      "test",
      fileURLToPath(new URL("./backup-routes.ts", import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      timeout: 60_000,
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stdout.toString() + result.stderr.toString());
  }
  expect(result.exitCode).toBe(0);
}, 60_000);
