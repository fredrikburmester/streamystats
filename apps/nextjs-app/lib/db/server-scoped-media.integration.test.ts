import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Bun module mocks are global. Keep real database tests isolated from route mocks.
test.skipIf(!process.env.STREAMYSTATS_TEST_DATABASE_URL)(
  "server-scoped media regression suite",
  () => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "test",
        fileURLToPath(
          new URL("./__tests__/server-scoped-media.ts", import.meta.url),
        ),
      ],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        timeout: 60_000,
      },
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stdout.toString() + result.stderr.toString());
    }
    expect(result.exitCode).toBe(0);
  },
  60_000,
);
