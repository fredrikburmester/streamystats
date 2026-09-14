import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("permanent merge API enforces authorization, consent, CSRF and server scope", async () => {
  const child = Bun.spawn(
    [process.execPath, "./lib/__tests__/user-merge-api-scenarios.ts"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [code, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  if (code !== 0) throw new Error(stderr);
  expect(code).toBe(0);
});
