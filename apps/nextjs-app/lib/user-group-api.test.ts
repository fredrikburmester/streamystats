import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("merge routes enforce admin, server, origin, validation, and cache expiration", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--preload",
      "./lib/__tests__/user-group-api-preload.ts",
      "./lib/__tests__/user-group-api-scenarios.ts",
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
    },
  );
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  expect(result.exitCode).toBe(0);
});
