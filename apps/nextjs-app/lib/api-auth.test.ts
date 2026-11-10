import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Bun module mocks are global; isolate these from the backup route mocks.
function runScenarios(file: string) {
  return Bun.spawnSync([process.execPath, `lib/__tests__/${file}`], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
  });
}

test("API guards reject malformed and cross-server IDs for cookies and tokens", () => {
  const result = runScenarios("api-auth-scenarios.ts");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("a token is the admin API key identity only when it is one of the server's API keys", () => {
  const result = runScenarios("api-key-auth-scenarios.ts");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("a Bearer key must be an API key or an administrator's token, and a named server is asked on its internal URL", () => {
  const result = runScenarios("server-token-auth-scenarios.ts");
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
