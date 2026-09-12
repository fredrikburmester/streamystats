import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Gemini supports connection checks, streaming, and tool round trips", () => {
  // Isolate server-only and fetch mocks from other test files.
  const result = Bun.spawnSync(
    [process.execPath, "lib/ai/__tests__/gemini-scenarios.ts"],
    { cwd: fileURLToPath(new URL("../../", import.meta.url)) },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
