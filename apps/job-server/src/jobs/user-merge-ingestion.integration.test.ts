import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.skipIf(!process.env.STREAMYSTATS_TEST_DATABASE_URL)(
  "slow permanent merges preserve playback and security alerts",
  async () => {
    const child = Bun.spawn(
      [
        Bun.which("bun") ?? "bun",
        fileURLToPath(
          new URL("./__tests__/user-merge-ingestion.ts", import.meta.url),
        ),
      ],
      {
        env: {
          ...Bun.env,
          DATABASE_URL: Bun.env.STREAMYSTATS_TEST_DATABASE_URL,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({
      exitCode,
      stderr,
      output: stdout.includes("regressions passed"),
    }).toEqual({ exitCode: 0, stderr: "", output: true });
  },
  45_000,
);
