import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  closeConnection,
  db,
  itemLibraries,
  items,
  libraries,
  type Server,
  servers,
  sessions,
  users,
} from "@streamystats/database";
import { and, asc, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

mock.module("server-only", () => ({}));
mock.module("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
const { getExcludedItemIds, getStatisticsExclusions } = await import(
  "../exclusions"
);
const { getItemDetails } = await import("../items");
const { globalSearch } = await import("../search");
const { getMostWatchedItems } = await import("../statistics");

const testUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;
const originalUrl = process.env.DATABASE_URL;

describe.skipIf(!testUrl)("exclusions for items in several libraries", () => {
  const suffix = crypto.randomUUID();
  const moviesId = `movies-${suffix}`;
  const kidsId = `kids-${suffix}`;
  // Stored under Movies, and also in Kids
  const sharedId = `shared-${suffix}`;
  const moviesOnlyId = `movies-only-${suffix}`;
  // Stored under Kids, with nothing in item_libraries
  const unrecordedId = `unrecorded-${suffix}`;
  const viewerId = `viewer-${suffix}`;
  const restrictedId = `restricted-${suffix}`;
  let server: Server;

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
    const [created] = await db
      .insert(servers)
      .values({
        name: "Shared folders",
        url: `http://shared-folders.invalid/${suffix}`,
        apiKey: "fixture",
      })
      .returning();
    if (!created) throw new Error("Missing server");
    server = created;
    await db.insert(libraries).values([
      { serverId: server.id, id: moviesId, name: "Movies", type: "movies" },
      { serverId: server.id, id: kidsId, name: "Kids", type: "movies" },
    ]);
    await db.insert(users).values([
      { serverId: server.id, id: viewerId, name: "Viewer" },
      {
        serverId: server.id,
        id: restrictedId,
        name: "Restricted",
        enableAllFolders: false,
        enabledFolders: [kidsId],
      },
    ]);
    const fixtures = [
      { id: sharedId, libraryId: moviesId, name: "Shared film" },
      { id: moviesOnlyId, libraryId: moviesId, name: "Movies film" },
      { id: unrecordedId, libraryId: kidsId, name: "Unrecorded film" },
    ];
    await db.insert(items).values(
      fixtures.map((item) => ({
        ...item,
        serverId: server.id,
        type: "Movie",
        isFolder: false,
        rawData: {},
      })),
    );
    await db.insert(itemLibraries).values([
      { serverId: server.id, itemId: sharedId, libraryId: moviesId },
      { serverId: server.id, itemId: sharedId, libraryId: kidsId },
      { serverId: server.id, itemId: moviesOnlyId, libraryId: moviesId },
    ]);
    await db.insert(sessions).values(
      fixtures.map((item) => ({
        id: `session-${item.id}`,
        serverId: server.id,
        userId: viewerId,
        userName: "Viewer",
        itemId: item.id,
        playDuration: 600,
        startTime: new Date("2026-01-01T12:00:00Z"),
        percentComplete: 100,
        completed: true,
        isPaused: false,
        isMuted: false,
        isActive: false,
        rawData: {},
      })),
    );
  }, 30_000);

  afterAll(async () => {
    if (server) await db.delete(servers).where(eq(servers.id, server.id));
    await closeConnection();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  async function exclude(libraryIds: string[]) {
    await db
      .update(servers)
      .set({ excludedLibraryIds: libraryIds })
      .where(eq(servers.id, server.id));
  }

  async function visibleItemIds(viewerUserId?: string) {
    const { itemLibraryExclusion } = await getStatisticsExclusions(
      server.id,
      viewerUserId,
    );
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.serverId, server.id), itemLibraryExclusion))
      .orderBy(asc(items.id));
    return rows.map((row) => row.id);
  }

  async function mostWatchedMovieIds() {
    const mostWatched = await getMostWatchedItems({ serverId: server.id });
    return mostWatched.Movie.map((item) => item.id).sort();
  }

  test("nothing is hidden without exclusions", async () => {
    await exclude([]);
    expect(await visibleItemIds()).toEqual([
      moviesOnlyId,
      sharedId,
      unrecordedId,
    ]);
  });

  test("an item stays while one of its libraries is not excluded", async () => {
    await exclude([moviesId]);
    expect(await visibleItemIds()).toEqual([sharedId, unrecordedId]);
    expect(await mostWatchedMovieIds()).toEqual([sharedId, unrecordedId]);
    expect(await getExcludedItemIds(server.id, [moviesId])).toEqual([
      moviesOnlyId,
    ]);

    await exclude([kidsId]);
    expect(await visibleItemIds()).toEqual([moviesOnlyId, sharedId]);
    expect(await mostWatchedMovieIds()).toEqual([moviesOnlyId, sharedId]);
  });

  test("an item is hidden once all of its libraries are excluded", async () => {
    await exclude([moviesId, kidsId]);
    expect(await visibleItemIds()).toEqual([]);
    expect(await mostWatchedMovieIds()).toEqual([]);
  });

  test("a restricted user reaches an item through any library they can open", async () => {
    await exclude([]);
    expect(await visibleItemIds(restrictedId)).toEqual([
      sharedId,
      unrecordedId,
    ]);
    const shared = await getItemDetails({
      serverId: server.id,
      itemId: sharedId,
      viewerUserId: restrictedId,
    });
    expect(shared?.item.id).toBe(sharedId);
    expect(
      await getItemDetails({
        serverId: server.id,
        itemId: moviesOnlyId,
        viewerUserId: restrictedId,
      }),
    ).toBeNull();
    const found = await globalSearch(
      server.id,
      "film",
      restrictedId,
      {},
      restrictedId,
    );
    expect(found.items.map((item) => item.id).sort()).toEqual([
      sharedId,
      unrecordedId,
    ]);

    await exclude([kidsId]);
    expect(await visibleItemIds(restrictedId)).toEqual([]);
    expect(
      await getItemDetails({
        serverId: server.id,
        itemId: sharedId,
        viewerUserId: restrictedId,
      }),
    ).toBeNull();
  });
});
