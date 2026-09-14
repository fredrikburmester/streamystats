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
  analyticsUserId,
  analyticsUserScope,
  changeUserGroup,
  getUserGroups,
  previewUserGroup,
  type UserGroupChange,
} from "../src/user-groups";
import { exportUserGroups, restoreUserGroups } from "../src/user-group-backup";
import { migrateTestDatabase } from "./setup";

const url = process.env.STREAMYSTATS_TEST_DATABASE_URL;
describe.skipIf(!url)("reversible user analytics groups (PostgreSQL)", () => {
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Use an isolated database ending in _test.");
  const client = postgres(url, { max: 5 });
  const database = drizzle(client, { schema });
  const {
    servers,
    users,
    libraries,
    items,
    sessions,
    userGroupMembers,
    userGroups,
    userGroupAudit,
  } = schema;
  let serverId: number;
  let otherServerId: number;
  let oldId: string;
  let newId: string;
  let extraId: string;
  let otherId: string;
  let movieId: string;
  let privateMovieId: string;
  let libraryId: string;
  const actor = { id: "fixture-admin", name: "Fixture admin" };

  beforeAll(() => migrateTestDatabase(url), 30_000);
  beforeEach(async () => {
    const nonce = randomUUID();
    const result = await database
      .insert(servers)
      .values([
        {
          name: "Merge fixture",
          url: `https://${nonce}.invalid`,
          apiKey: "fixture",
        },
        {
          name: "Other fixture",
          url: `https://other-${nonce}.invalid`,
          apiKey: "fixture",
        },
      ])
      .returning();
    serverId = result[0].id;
    otherServerId = result[1].id;
    oldId = randomUUID();
    newId = randomUUID();
    extraId = randomUUID();
    otherId = randomUUID();
    libraryId = randomUUID();
    const privateLibraryId = randomUUID();
    await database.insert(libraries).values([
      { id: libraryId, serverId, name: "Public", type: "Movie" },
      { id: privateLibraryId, serverId, name: "Private", type: "Movie" },
    ]);
    await database.insert(users).values([
      { id: oldId, serverId, name: "Same name", isAdministrator: true },
      {
        id: newId,
        serverId,
        name: "Same name",
        enableAllFolders: false,
        enabledFolders: [libraryId],
      },
      { id: extraId, serverId, name: "Third" },
      { id: otherId, serverId: otherServerId, name: "Other server" },
    ]);
    movieId = randomUUID();
    privateMovieId = randomUUID();
    await database.insert(items).values([
      {
        id: movieId,
        serverId,
        libraryId,
        name: "Movie",
        type: "Movie",
        isFolder: false,
        rawData: {},
      },
      {
        id: privateMovieId,
        serverId,
        libraryId: privateLibraryId,
        name: "Private",
        type: "Movie",
        isFolder: false,
        rawData: {},
      },
    ]);
    await addPlayback(oldId, 20, "2026-01-01");
    await addPlayback(newId, 30, "2026-01-02");
  });
  afterEach(async () => {
    if (!serverId || !otherServerId) return;
    await database
      .delete(servers)
      .where(sql`${servers.id} IN (${serverId}, ${otherServerId})`);
  });
  afterAll(async () => {
    await client.end();
  });

  async function addPlayback(
    userId: string,
    hours: number,
    date: string,
    itemId = movieId,
  ) {
    await database
      .insert(sessions)
      .values({
        id: randomUUID(),
        serverId,
        userId,
        userServerId: userId,
        userName: userId,
        itemId,
        completed: true,
        isPaused: false,
        isMuted: false,
        isActive: false,
        playDuration: hours * 3600,
        startTime: new Date(date),
        rawData: { UserId: userId },
      });
  }
  async function totals(userId: string, viewerUserId?: string) {
    const [result] = await database
      .select({
        hours: sql<number>`sum(${sessions.playDuration})::float8 / 3600`,
        count: sql<number>`count(*)::int`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.serverId, serverId),
          analyticsUserScope(userId, { serverId, viewerUserId }),
        ),
      );
    return result;
  }
  function initialChange(): UserGroupChange {
    return {
      groupId: null,
      primaryUserId: newId,
      memberUserIds: [oldId, newId],
      expectedRevision: null,
    };
  }
  async function commit(change: UserGroupChange) {
    const preview = await previewUserGroup({ serverId, change, database });
    const request = {
      serverId,
      change,
      previewToken: preview.token,
      operationId: randomUUID(),
      actor,
      database,
    };
    return { request, group: await changeUserGroup(request), preview };
  }

  test("merge, sync, live playback, and unlink preserve every source row", async () => {
    const original = await database
      .select()
      .from(sessions)
      .where(eq(sessions.serverId, serverId));
    const { group, preview } = await commit(initialChange());
    expect(group).not.toBeNull();
    if (!group) return;
    expect(preview.watchTime).toBe(50 * 3600);
    expect(await totals(oldId)).toEqual({ hours: 50, count: 2 });
    expect(await totals(newId)).toEqual({ hours: 50, count: 2 });
    const leaderboard = await database
      .select({
        id: analyticsUserId(),
        hours: sql<number>`sum(${sessions.playDuration})::float8 / 3600`,
      })
      .from(sessions)
      .where(eq(sessions.serverId, serverId))
      .groupBy(analyticsUserId());
    expect(leaderboard).toEqual([{ id: newId, hours: 50 }]);
    expect(
      await database
        .select()
        .from(sessions)
        .where(eq(sessions.serverId, serverId)),
    ).toEqual(original);
    await database
      .update(users)
      .set({ name: "Synced name" })
      .where(eq(users.id, oldId));
    await addPlayback(newId, 5, "2026-01-03");
    expect(await totals(newId)).toEqual({ hours: 55, count: 3 });
    const unlinked = await commit({
      groupId: group.id,
      primaryUserId: newId,
      memberUserIds: [newId],
      expectedRevision: group.revision,
    });
    expect(unlinked.group).toBeNull();
    expect(await totals(oldId)).toEqual({ hours: 20, count: 1 });
    expect(await totals(newId)).toEqual({ hours: 35, count: 2 });
    expect(await getUserGroups({ serverId, database })).toEqual([]);
    expect(
      await database
        .select()
        .from(userGroupAudit)
        .where(eq(userGroupAudit.serverId, serverId)),
    ).toHaveLength(2);
  });

  test("source exclusions and actual viewer permissions survive merging with an admin", async () => {
    await addPlayback(oldId, 7, "2026-01-03", privateMovieId);
    await commit(initialChange());
    expect(await totals(newId)).toEqual({ hours: 57, count: 3 });
    expect(await totals(newId, newId)).toEqual({ hours: 50, count: 2 });
    expect(await totals(oldId, newId)).toEqual({ hours: 50, count: 2 });
    await database
      .update(servers)
      .set({ excludedUserIds: [oldId] })
      .where(eq(servers.id, serverId));
    expect(await totals(newId)).toEqual({ hours: 30, count: 1 });
    const [account] = await database
      .select()
      .from(users)
      .where(eq(users.id, newId));
    expect(account.isAdministrator).toBe(false);
    expect(account.enableAllFolders).toBe(false);
    expect(await totals(newId, otherId)).toEqual({ hours: null, count: 0 });
  });

  test("rejects invalid members and cross-server accounts", async () => {
    for (const ids of [
      [oldId],
      [oldId, oldId],
      [oldId, otherId],
      [oldId, "missing"],
    ]) {
      await expect(
        previewUserGroup({
          serverId,
          database,
          change: {
            ...initialChange(),
            primaryUserId: oldId,
            memberUserIds: ids,
          },
        }),
      ).rejects.toThrow();
    }
    expect(await getUserGroups({ serverId, database })).toEqual([]);
    await expect(
      database
        .insert(userGroups)
        .values({ id: randomUUID(), serverId, primaryUserId: otherId })
        .execute(),
    ).rejects.toThrow();
  });

  test("retries are idempotent and concurrent changes cannot overwrite each other", async () => {
    const { group, request } = await commit(initialChange());
    if (!group) throw new Error("missing group");
    expect(await changeUserGroup(request)).toEqual(group);
    await expect(
      changeUserGroup({
        ...request,
        change: { ...request.change, primaryUserId: oldId },
      }),
    ).rejects.toThrow("Operation ID");
    const change = {
      groupId: group.id,
      primaryUserId: oldId,
      memberUserIds: group.memberUserIds,
      expectedRevision: 1,
    };
    const preview = await previewUserGroup({ serverId, change, database });
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        changeUserGroup({
          serverId,
          change,
          database,
          actor,
          previewToken: preview.token,
          operationId: randomUUID(),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const [updated] = await getUserGroups({ serverId, database });
    expect(updated.primaryUserId).toBe(oldId);
    expect(updated.revision).toBe(2);
    const expanded = await commit({
      groupId: group.id,
      primaryUserId: oldId,
      memberUserIds: [...group.memberUserIds, extraId],
      expectedRevision: 2,
    });
    expect(expanded.group?.memberUserIds).toHaveLength(3);
    await expect(
      database.transaction(async (tx) => {
        await tx
          .delete(userGroupMembers)
          .where(
            and(
              eq(userGroupMembers.serverId, serverId),
              eq(userGroupMembers.userId, oldId),
            ),
          );
      }),
    ).rejects.toThrow();
    await expect(
      database.delete(users).where(eq(users.id, oldId)).execute(),
    ).rejects.toThrow();
  });

  test("backup restores historical identities without privileges and detects conflicts", async () => {
    const { group } = await commit(initialChange());
    if (!group) throw new Error("missing group");
    const backup = await exportUserGroups({ serverId, database });
    expect(
      backup.accounts.every((a) => Object.keys(a).sort().join() === "id,name"),
    ).toBe(true);
    await database.delete(userGroups).where(eq(userGroups.serverId, serverId));
    await database.delete(users).where(eq(users.id, oldId));
    await restoreUserGroups({ serverId, backup, actor, database });
    const [historical] = await database
      .select()
      .from(users)
      .where(eq(users.id, oldId));
    expect(historical.isDisabled).toBe(true);
    expect(historical.isAdministrator).toBe(false);
    expect(historical.enabledFolders).toEqual([]);
    expect(historical.enableAllFolders).toBe(false);
    await restoreUserGroups({ serverId, backup, actor, database });
    expect(await getUserGroups({ serverId, database })).toHaveLength(1);
    await expect(
      restoreUserGroups({
        serverId,
        backup: {
          ...backup,
          groups: [{ primaryUserId: oldId, memberUserIds: [oldId, newId] }],
        },
        actor,
        database,
      }),
    ).rejects.toThrow("conflicts");
  });

  test("query plan and totals remain correct with 20000 sessions", async () => {
    await commit(initialChange());
    await database.execute(sql`INSERT INTO sessions (id, server_id, user_id, user_name, raw_data, completed, is_paused, is_muted, is_active, play_duration)
      SELECT 'merge-perf-' || ${serverId} || '-' || n, ${serverId}, CASE WHEN n % 2 = 0 THEN ${oldId} ELSE ${newId} END, 'fixture', '{}', true, false, false, false, 1 FROM generate_series(1, 20000) n`);
    const query = database
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(
        and(
          eq(sessions.serverId, serverId),
          analyticsUserScope(newId, { serverId }),
        ),
      );
    const started = performance.now();
    expect((await query)[0].count).toBe(20002);
    const duration = performance.now() - started;
    const plan = await database.execute(
      sql`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`,
    );
    console.info(
      `Merged lookup: ${duration.toFixed(1)}ms; plan captured (${JSON.stringify(plan).length} bytes)`,
    );
  });
});
