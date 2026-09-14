import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  closeConnection,
  db,
  itemPeople,
  items,
  libraries,
  people,
  type Server,
  servers,
  sessions,
  users,
  watchlists,
} from "@streamystats/database";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

mock.module("server-only", () => ({}));
mock.module("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
const { getItemDetails, getSeasonsAndEpisodes } = await import("../items");
const { getItemHistory } = await import("../history");
const { getLibraryItemsWithStats } = await import("../library-statistics");
const { getMostWatchedItems, getWatchTimeByLibrary } = await import(
  "../statistics"
);
const { getActorDetails } = await import("../actors");
const { addItemToWatchlist, getWatchlistWithItems } = await import(
  "../watchlists"
);

const testUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;
const originalUrl = process.env.DATABASE_URL;

describe.skipIf(!testUrl)("media queries with overlapping Jellyfin IDs", () => {
  const suffix = crypto.randomUUID();
  const libraryId = `library-${suffix}`;
  const seriesId = `series-${suffix}`;
  const episodeId = `episode-${suffix}`;
  const personId = `person-${suffix}`;
  let fixtures: Server[] = [];

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
    fixtures = await db
      .insert(servers)
      .values([
        {
          name: "Query A",
          url: `http://query-a.invalid/${suffix}`,
          apiKey: "fixture",
        },
        {
          name: "Query B",
          url: `http://query-b.invalid/${suffix}`,
          apiKey: "fixture",
        },
      ])
      .returning();
    for (const [index, server] of fixtures.entries()) {
      await db.insert(libraries).values({
        serverId: server.id,
        id: libraryId,
        name: server.name,
        type: "tvshows",
      });
      await db.insert(users).values({
        serverId: server.id,
        id: `user-${server.id}`,
        name: "Fixture",
      });
      await db.insert(items).values([
        {
          serverId: server.id,
          id: seriesId,
          libraryId,
          name: server.name,
          type: "Series",
          isFolder: true,
          rawData: {},
        },
        {
          serverId: server.id,
          id: episodeId,
          libraryId,
          name: `${server.name} episode`,
          type: "Episode",
          seriesId,
          parentId: seriesId,
          parentIndexNumber: 1,
          indexNumber: 1,
          isFolder: false,
          rawData: {},
        },
      ]);
      await db.insert(sessions).values({
        id: `session-${server.id}`,
        serverId: server.id,
        userId: `user-${server.id}`,
        userName: "Fixture",
        itemId: episodeId,
        seriesId,
        playDuration: (index + 1) * 120,
        startTime: new Date("2026-01-01T12:00:00Z"),
        percentComplete: 100,
        completed: true,
        isPaused: false,
        isMuted: false,
        isActive: false,
        rawData: {},
      });
      await db
        .insert(people)
        .values({ id: personId, serverId: server.id, name: server.name });
      await db.insert(itemPeople).values({
        itemId: seriesId,
        serverId: server.id,
        personId,
        type: "Actor",
      });
    }
  }, 30_000);

  afterAll(async () => {
    for (const server of fixtures)
      await db.delete(servers).where(eq(servers.id, server.id));
    await closeConnection();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  test("item details and episode lists use the requested server", async () => {
    for (const [index, server] of fixtures.entries()) {
      const details = await getItemDetails({
        serverId: server.id,
        itemId: seriesId,
      });
      expect(details?.item.name).toBe(server.name);
      expect(details?.totalViews).toBe(1);
      expect(details?.totalWatchTime).toBe((index + 1) * 120);
      const seasons = await getSeasonsAndEpisodes({
        serverId: server.id,
        seriesId,
      });
      expect(seasons[0]?.episodes.map((item) => item.serverId)).toEqual([
        server.id,
      ]);
    }
  });

  test("history joins do not duplicate or leak the other server's metadata", async () => {
    for (const server of fixtures) {
      const history = await getItemHistory(server.id, episodeId);
      expect(history.data).toHaveLength(1);
      expect(history.data[0]?.item?.name).toBe(`${server.name} episode`);
    }
  });

  test("library and most-watched aggregation count only the selected server", async () => {
    for (const [index, server] of fixtures.entries()) {
      const library = await getLibraryItemsWithStats({
        serverId: server.id,
        libraryId,
      });
      expect(library.data).toHaveLength(2);
      const episode = library.data.find((entry) => entry.item.id === episodeId);
      expect(Number(episode?.total_watch_time)).toBe((index + 1) * 120);
      const mostWatched = await getMostWatchedItems({ serverId: server.id });
      expect(mostWatched.Episode).toHaveLength(1);
      expect(mostWatched.Series).toHaveLength(1);
      expect(
        Object.values(mostWatched)
          .flat()
          .every((entry) => entry.serverId === server.id),
      ).toBe(true);
      const totals = await getWatchTimeByLibrary({
        serverId: server.id,
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      });
      expect(JSON.stringify(totals)).toContain(server.name);
      expect(JSON.stringify(totals)).not.toContain(
        fixtures.find((other) => other.id !== server.id)?.name ?? "missing",
      );
    }
  });

  test("actor episode statistics and watchlist item joins remain isolated", async () => {
    for (const [index, server] of fixtures.entries()) {
      const actor = await getActorDetails({
        serverId: server.id,
        actorId: personId,
      });
      expect(actor?.items).toHaveLength(1);
      expect(actor?.items[0]?.totalWatchTime).toBe((index + 1) * 120);
      const userId = `user-${server.id}`;
      const [list] = await db
        .insert(watchlists)
        .values({ serverId: server.id, userId, name: "Fixture" })
        .returning();
      if (!list) throw new Error("Missing watchlist");
      const added = await addItemToWatchlist({
        watchlistId: list.id,
        userId,
        itemId: seriesId,
      });
      expect(added?.serverId).toBe(server.id);
      const loaded = await getWatchlistWithItems({
        watchlistId: list.id,
        userId,
      });
      expect(loaded?.items).toHaveLength(1);
      expect(loaded?.items[0]?.item.name).toBe(server.name);
    }
  });
});
