import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("playback persistence resolves items synced after playback starts", () => {
  // Isolate module mocks from the other suites that replace the database module.
  const result = Bun.spawnSync([
    process.execPath,
    fileURLToPath(
      new URL("./__tests__/session-poller-persistence.ts", import.meta.url),
    ),
  ]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
