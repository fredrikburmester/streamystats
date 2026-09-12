import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("API guards reject malformed and cross-server IDs for cookies and tokens", () => {
  // Bun module mocks are global; isolate these from the backup route mocks.
  const result = Bun.spawnSync(
    [process.execPath, "lib/__tests__/api-auth-scenarios.ts"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)) },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
