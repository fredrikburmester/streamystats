import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  closeConnection,
  db,
  type Server,
  servers,
  sessions,
  users,
} from "@streamystats/database";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

mock.module("server-only", () => ({}));
mock.module("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
mock.module("next/headers", () => ({
  cookies: async () => ({}),
  headers: async () => new Headers(),
}));
const { getWatchTimePeriodTotals } = await import("../users");

const testUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;
const originalUrl = process.env.DATABASE_URL;

describe.skipIf(!testUrl)("watch time per period", () => {
  const suffix = crypto.randomUUID();
  const aliceId = `alice-${suffix}`;
  const bobId = `bob-${suffix}`;
  const carolId = `carol-${suffix}`;
  // Wednesday, 13 August 2025
  const now = new Date(2025, 7, 13, 15, 0);
  let server: Server;
  let otherServer: Server;

  async function createServer(name: string) {
    const [created] = await db
      .insert(servers)
      .values({
        name,
        url: `http://${name}.invalid/${suffix}`,
        apiKey: "fixture",
      })
      .returning();
    if (!created) throw new Error("Missing server");
    return created;
  }

  function session(
    id: string,
    serverId: number,
    userId: string,
    startTime: Date,
    playDuration: number,
  ) {
    return {
      id: `${id}-${suffix}`,
      serverId,
      userId,
      userName: userId,
      playDuration,
      startTime,
      percentComplete: 100,
      completed: true,
      isPaused: false,
      isMuted: false,
      isActive: false,
      rawData: {},
    };
  }

  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
      throw new Error("Use a dedicated database ending in _test");
    await closeConnection();
    process.env.DATABASE_URL = testUrl;
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/database/drizzle", import.meta.url),
      ),
    });
    server = await createServer("periods");
    otherServer = await createServer("periods-other");
    await db.insert(users).values([
      { serverId: server.id, id: aliceId, name: "Alice" },
      { serverId: server.id, id: bobId, name: "Bob" },
      { serverId: otherServer.id, id: carolId, name: "Carol" },
    ]);
    await db.insert(sessions).values([
      // This week (the week began on Monday 11 August)
      session("week", server.id, aliceId, new Date(2025, 7, 12, 20), 1000),
      // This month, but before this week
      session("month", server.id, aliceId, new Date(2025, 7, 5, 20), 200),
      // This year, but before this month
      session("year", server.id, aliceId, new Date(2025, 2, 1, 20), 30),
      // Older than this year
      session("older", server.id, aliceId, new Date(2024, 11, 31, 23), 4),
      // Another user on the same server
      session("bob", server.id, bobId, new Date(2025, 7, 12, 21), 50000),
      // Another server
      session("other", otherServer.id, carolId, new Date(2025, 7, 12, 22), 7),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (server) await db.delete(servers).where(eq(servers.id, server.id));
    if (otherServer)
      await db.delete(servers).where(eq(servers.id, otherServer.id));
    await closeConnection();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  test("splits one user's watch time into all time, year, month and week", async () => {
    expect(
      await getWatchTimePeriodTotals({
        serverId: server.id,
        userId: aliceId,
        now,
      }),
    ).toEqual({ total: 1234, year: 1230, month: 1200, week: 1000 });
  });

  test("sums every user on the server when no user is given", async () => {
    expect(
      await getWatchTimePeriodTotals({ serverId: server.id, now }),
    ).toEqual({ total: 51234, year: 51230, month: 51200, week: 51000 });
  });

  test("returns zeros for a user without sessions", async () => {
    expect(
      await getWatchTimePeriodTotals({
        serverId: server.id,
        userId: `nobody-${suffix}`,
        now,
      }),
    ).toEqual({ total: 0, year: 0, month: 0, week: 0 });
  });
});
