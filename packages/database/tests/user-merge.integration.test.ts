import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/schema";
import {
  getMergedUserTarget,
  mergeUsersPermanently,
  previewUserMerge,
} from "../src/user-merge";
import { migrateTestDatabase } from "./setup";
import {
  exportMergedUserData,
  restoreUserMerges,
} from "../src/user-merge-backup";

const url = process.env.STREAMYSTATS_TEST_DATABASE_URL;
describe.skipIf(!url)("permanent user merge (PostgreSQL)", () => {
  if (!url) return;
  const client = postgres(url, { max: 5 });
  const database = drizzle(client, { schema });
  const {
    servers,
    users,
    sessions,
    items,
    libraries,
    watchlists,
    watchlistItems,
    hiddenRecommendations,
    activities,
    anomalyEvents,
    userFingerprints,
    userMerges,
    userMergeAudit,
  } = schema;
  let serverId: number;
  let sourceId: string;
  let targetId: string;
  let itemId: string;
  let libraryId: string;
  let sourceListId: number;
  const actor = { id: "fixture-admin", name: "Fixture admin" };
  beforeAll(() => migrateTestDatabase(url), 30_000);
  beforeEach(async () => {
    sourceId = randomUUID();
    targetId = randomUUID();
    itemId = randomUUID();
    libraryId = randomUUID();
    const [server] = await database
      .insert(servers)
      .values({
        name: "Permanent merge fixture",
        url: `https://${randomUUID()}.invalid`,
        apiKey: "fixture",
        excludedUserIds: [sourceId, "unrelated"],
      })
      .returning();
    serverId = server.id;
    await database.insert(users).values([
      {
        id: sourceId,
        serverId,
        name: "Old",
        isAdministrator: true,
        inferWatchtimeOnMarkWatched: true,
      },
      {
        id: targetId,
        serverId,
        name: "New",
        isAdministrator: false,
        enableAllFolders: false,
        enabledFolders: [libraryId],
      },
    ]);
    await database
      .insert(libraries)
      .values({ id: libraryId, serverId, name: "Movies", type: "Movie" });
    await database.insert(items).values({
      id: itemId,
      serverId,
      libraryId,
      name: "Movie",
      type: "Movie",
      isFolder: false,
      rawData: {},
    });
    await database
      .insert(sessions)
      .values([
        playback(sourceId, 20),
        playback(targetId, 30),
        { ...playback(sourceId, 5), userId: null, itemId: null },
      ]);
    const lists = await database
      .insert(watchlists)
      .values([
        { serverId, userId: sourceId, name: "Favorites", isPublic: false },
        { serverId, userId: targetId, name: "Favorites", isPublic: false },
      ])
      .returning();
    sourceListId = lists[0].id;
    await database
      .insert(watchlistItems)
      .values({ watchlistId: sourceListId, itemId });
    await database
      .insert(hiddenRecommendations)
      .values(
        [sourceId, targetId].map((userId) => ({ serverId, userId, itemId })),
      );
    const activityId = randomUUID();
    await database.insert(activities).values({
      id: activityId,
      serverId,
      userId: sourceId,
      name: "Old signed in",
      type: "UserLoggedIn",
      date: new Date(),
      severity: "Information",
    });
    await database.insert(anomalyEvents).values({
      serverId,
      userId: sourceId,
      activityId,
      anomalyType: "new_device",
      severity: "low",
      details: { description: "Old device event" },
    });
    await database.insert(userFingerprints).values(
      [sourceId, targetId].map((userId) => ({
        serverId,
        userId,
        knownDeviceIds: ["device"],
      })),
    );
  });
  afterEach(async () => {
    if (serverId)
      await database.delete(servers).where(eq(servers.id, serverId));
  });
  afterAll(() => client.end());
  function playback(userId: string, hours = 1) {
    return {
      id: randomUUID(),
      serverId,
      userId,
      userServerId: userId,
      userName: userId === sourceId ? "Old" : "New",
      itemId,
      playDuration: hours * 3600,
      startTime: new Date("2026-01-01"),
      completed: true,
      isPaused: false,
      isActive: false,
      isMuted: false,
      rawData: { UserId: userId },
    };
  }
  async function request({
    sourceUserId = sourceId,
    targetUserId = targetId,
  } = {}) {
    const input = { sourceUserId, targetUserId };
    const preview = await previewUserMerge({ serverId, input, database });
    return {
      serverId,
      input,
      previewToken: preview.token,
      operationId: randomUUID(),
      actor,
      database,
    };
  }
  test("transfers every owned record and removes the source without elevating permissions", async () => {
    const req = await request();
    const result = await mergeUsersPermanently(req);
    expect(result.transferred).toEqual({
      sessions: 2,
      activities: 1,
      watchlists: 1,
      hiddenRecommendations: 1,
      securityEvents: 1,
    });
    const accounts = await database
      .select()
      .from(users)
      .where(eq(users.serverId, serverId));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: targetId,
      isAdministrator: false,
      enableAllFolders: false,
      enabledFolders: [libraryId],
      inferWatchtimeOnMarkWatched: true,
    });
    const playbackRows = await database
      .select()
      .from(sessions)
      .where(eq(sessions.serverId, serverId));
    expect(playbackRows).toHaveLength(3);
    expect(playbackRows.every((row) => row.userId === targetId)).toBe(true);
    expect(
      playbackRows.reduce((sum, row) => sum + (row.playDuration ?? 0), 0),
    ).toBe(55 * 3600);
    expect(
      playbackRows
        .filter((row) => row.userServerId === sourceId)
        .every(
          (row) => row.userName === "New" && row.rawData.UserId === sourceId,
        ),
    ).toBe(true);
    for (const table of [watchlists, activities, anomalyEvents]) {
      const rows = await database
        .select({ userId: table.userId })
        .from(table)
        .where(eq(table.serverId, serverId));
      expect(rows.every((row) => row.userId === targetId)).toBe(true);
    }
    expect(
      await database
        .select()
        .from(watchlists)
        .where(eq(watchlists.serverId, serverId)),
    ).toHaveLength(2);
    expect(
      await database
        .select()
        .from(watchlistItems)
        .where(eq(watchlistItems.watchlistId, sourceListId)),
    ).toHaveLength(1);
    expect(
      await database
        .select()
        .from(hiddenRecommendations)
        .where(eq(hiddenRecommendations.serverId, serverId)),
    ).toHaveLength(1);
    expect(
      await database
        .select()
        .from(userFingerprints)
        .where(eq(userFingerprints.serverId, serverId)),
    ).toHaveLength(0);
    expect(
      (await database.select().from(servers).where(eq(servers.id, serverId)))[0]
        .excludedUserIds,
    ).toEqual(["unrelated"]);
    expect(await mergeUsersPermanently(req)).toEqual(result);
    expect(
      await database
        .select()
        .from(userMergeAudit)
        .where(eq(userMergeAudit.serverId, serverId)),
    ).toHaveLength(1);
  });
  test("blocks resurrection and remaps late sync/import writes, including null foreign keys", async () => {
    await mergeUsersPermanently(await request());
    expect(
      await database
        .insert(users)
        .values({
          id: sourceId,
          serverId,
          name: "Old synced again",
          isAdministrator: true,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { name: "Old synced again" },
        })
        .returning(),
    ).toHaveLength(0);
    const inserted = await database
      .insert(sessions)
      .values([{ ...playback(sourceId), userId: null }, playback(sourceId)])
      .returning();
    expect(
      inserted.every(
        (row) => row.userId === targetId && row.userName === "New",
      ),
    ).toBe(true);
    await database
      .update(sessions)
      .set({ userId: sourceId, userName: "Old" })
      .where(eq(sessions.id, inserted[0].id));
    expect(
      (
        await database
          .select()
          .from(sessions)
          .where(eq(sessions.id, inserted[0].id))
      )[0].userId,
    ).toBe(targetId);
    const [activity] = await database
      .insert(activities)
      .values({
        id: randomUUID(),
        serverId,
        userId: sourceId,
        name: "Late event",
        type: "UserLoggedIn",
        date: new Date(),
        severity: "Information",
      })
      .returning();
    expect(activity.userId).toBe(targetId);
    expect(
      await database
        .insert(userFingerprints)
        .values({ serverId, userId: sourceId })
        .returning(),
    ).toHaveLength(0);
  });
  test("flattens consecutive merges and retains destination preferences", async () => {
    await database
      .update(users)
      .set({ inferWatchtimeOnMarkWatched: false })
      .where(eq(users.id, targetId));
    await mergeUsersPermanently(await request());
    expect(
      (await database.select().from(users).where(eq(users.id, targetId)))[0]
        .inferWatchtimeOnMarkWatched,
    ).toBe(false);
    const newer = randomUUID();
    await database
      .insert(users)
      .values({ id: newer, serverId, name: "Newest" });
    await mergeUsersPermanently(
      await request({ sourceUserId: targetId, targetUserId: newer }),
    );
    expect(
      await getMergedUserTarget({ serverId, userId: sourceId, database }),
    ).toBe(newer);
    expect(
      await getMergedUserTarget({ serverId, userId: targetId, database }),
    ).toBe(newer);
    expect(
      (
        await database.insert(sessions).values(playback(sourceId)).returning()
      )[0].userId,
    ).toBe(newer);
  });
  test("rejects stale previews, cross-server accounts, self merges, and retiring the actor", async () => {
    const req = await request();
    await database
      .update(users)
      .set({ name: "Renamed" })
      .where(eq(users.id, targetId));
    await expect(mergeUsersPermanently(req)).rejects.toThrow(
      "Accounts changed",
    );
    await expect(
      previewUserMerge({
        serverId,
        input: { sourceUserId: sourceId, targetUserId: sourceId },
        database,
      }),
    ).rejects.toThrow("different accounts");
    await expect(
      previewUserMerge({
        serverId: serverId + 9999,
        input: req.input,
        database,
      }),
    ).rejects.toThrow("Both accounts");
    await expect(
      mergeUsersPermanently({ ...req, actor: { id: sourceId, name: "Old" } }),
    ).rejects.toThrow("different administrator");
    expect(
      await database
        .select()
        .from(userMerges)
        .where(eq(userMerges.serverId, serverId)),
    ).toHaveLength(0);
    expect(
      await database.select().from(users).where(eq(users.serverId, serverId)),
    ).toHaveLength(2);
  });
  test("rolls back all transfers if source deletion fails", async () => {
    const req = await request();
    await client.unsafe(
      `CREATE FUNCTION fail_merge_${serverId}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected merge failure'; END; $$`,
    );
    await client.unsafe(
      `CREATE TRIGGER fail_merge_${serverId} BEFORE DELETE ON users FOR EACH ROW WHEN (OLD.server_id = ${serverId}) EXECUTE FUNCTION fail_merge_${serverId}()`,
    );
    try {
      await expect(mergeUsersPermanently(req)).rejects.toThrow();
      expect(
        await database
          .select()
          .from(userMerges)
          .where(eq(userMerges.serverId, serverId)),
      ).toHaveLength(0);
      expect(
        await database
          .select()
          .from(watchlists)
          .where(
            and(
              eq(watchlists.serverId, serverId),
              eq(watchlists.userId, sourceId),
            ),
          ),
      ).toHaveLength(1);
      expect(
        await database.select().from(users).where(eq(users.serverId, serverId)),
      ).toHaveLength(2);
    } finally {
      await client.unsafe(`DROP TRIGGER fail_merge_${serverId} ON users`);
      await client.unsafe(`DROP FUNCTION fail_merge_${serverId}()`);
    }
  });
  test("a writer waiting on a merge sees the committed retirement mapping", async () => {
    const req = await request();
    let writing: Promise<(typeof sessions.$inferSelect)[]> | undefined;
    await database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(582, ${serverId})`);
      writing = database
        .insert(sessions)
        .values(playback(sourceId))
        .returning()
        .execute();
      await mergeUsersPermanently({
        ...req,
        database: tx,
      });
    });
    const rows = await writing;
    if (!rows) throw new Error("Writer did not start");
    expect(rows[0].userId).toBe(targetId);
    expect(
      await database
        .select()
        .from(sessions)
        .where(
          and(eq(sessions.serverId, serverId), eq(sessions.userId, sourceId)),
        ),
    ).toHaveLength(0);
  });
  test("retries rather than deadlocking with an update already holding a row lock", async () => {
    const req = await request();
    const locked = Promise.withResolvers<void>();
    const releaseWriter = Promise.withResolvers<void>();
    const writing = database.transaction(async (tx) => {
      await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, sourceId))
        .for("update");
      locked.resolve();
      await releaseWriter.promise;
      await tx
        .update(sessions)
        .set({ playDuration: 21 * 3600 })
        .where(eq(sessions.userId, sourceId));
    });
    await locked.promise;
    const merging = mergeUsersPermanently(req);
    await Bun.sleep(50);
    releaseWriter.resolve();
    await Promise.all([writing, merging]);
    const [total] = await database
      .select({ duration: sql<number>`sum(${sessions.playDuration})::int` })
      .from(sessions)
      .where(
        and(eq(sessions.serverId, serverId), eq(sessions.userId, targetId)),
      );
    expect(total.duration).toBe(56 * 3600);
    expect(
      await database.select().from(users).where(eq(users.id, sourceId)),
    ).toHaveLength(0);
  });
  test("backup restore retains retirement and consolidates a source recreated by initial sync", async () => {
    await mergeUsersPermanently(await request());
    const backup = await exportMergedUserData({ serverId, database });
    expect(backup.userMerges.accounts).toEqual([{ id: targetId, name: "New" }]);
    await database.delete(servers).where(eq(servers.id, serverId));
    const [fresh] = await database
      .insert(servers)
      .values({
        name: "Restored server",
        url: `https://${randomUUID()}.invalid`,
        apiKey: "fixture",
      })
      .returning();
    serverId = fresh.id;
    await database
      .insert(users)
      .values({ id: sourceId, serverId, name: "Old still in Jellyfin" });
    await database
      .insert(sessions)
      .values({ ...playback(sourceId), itemId: null });
    await restoreUserMerges({
      serverId,
      backup: backup.userMerges,
      actor,
      database,
    });
    await database
      .insert(sessions)
      .values(
        backup.sessions.map((row) => ({ ...row, serverId, itemId: null })),
      );
    expect(
      await getMergedUserTarget({ serverId, userId: sourceId, database }),
    ).toBe(targetId);
    const accounts = await database
      .select()
      .from(users)
      .where(eq(users.serverId, serverId));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: targetId,
      isDisabled: true,
      isAdministrator: false,
      enableAllFolders: false,
    });
    const rows = await database
      .select()
      .from(sessions)
      .where(eq(sessions.serverId, serverId));
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.userId === targetId)).toBe(true);
    await restoreUserMerges({
      serverId,
      backup: backup.userMerges,
      actor,
      database,
    });
    expect(
      await database
        .select()
        .from(userMergeAudit)
        .where(eq(userMergeAudit.serverId, serverId)),
    ).toHaveLength(1);
  });
  test("rejects conflicting backup metadata without changing accounts", async () => {
    await expect(
      restoreUserMerges({
        serverId,
        actor,
        database,
        backup: {
          accounts: [
            { id: sourceId, name: "Old" },
            { id: targetId, name: "New" },
          ],
          retiredUsers: [
            {
              sourceUserId: sourceId,
              sourceName: "Old",
              targetUserId: targetId,
            },
            {
              sourceUserId: targetId,
              sourceName: "New",
              targetUserId: sourceId,
            },
          ],
        },
      }),
    ).rejects.toThrow("Invalid permanent merge metadata");
    expect(
      await database.select().from(users).where(eq(users.serverId, serverId)),
    ).toHaveLength(2);
  });
});
