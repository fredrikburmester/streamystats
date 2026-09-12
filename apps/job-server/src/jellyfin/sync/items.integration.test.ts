import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  closeConnection,
  db,
  hiddenRecommendations,
  items,
  libraries,
  servers,
  sessions,
  type Server,
} from "@streamystats/database";
import { JellyfinClient, type JellyfinBaseItemDto } from "../client";
import { performFullSync } from "./index";
import { syncItems, syncRecentlyAddedItems } from "./items";

// Use a dedicated database: this suite runs migrations and installs a failure trigger.
const testDatabaseUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

describe.skipIf(!testDatabaseUrl)(
  "item replacement with PostgreSQL foreign keys",
  () => {
    let server: Server;
    let libraryId: string;
    let oldId: string;
    let replacement: JellyfinBaseItemDto;

    beforeAll(async () => {
      if (
        !testDatabaseUrl ||
        !new URL(testDatabaseUrl).pathname.endsWith("_test")
      ) {
        throw new Error(
          "STREAMYSTATS_TEST_DATABASE_URL must name a dedicated database ending in _test",
        );
      }
      await closeConnection();
      process.env.DATABASE_URL = testDatabaseUrl;
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      await migrate(db, {
        migrationsFolder: fileURLToPath(
          new URL("../../../../../packages/database/drizzle", import.meta.url),
        ),
      });
      await db.execute(sql`
      CREATE OR REPLACE FUNCTION reject_item_replacement_test() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'injected replacement failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    }, 30_000);

    beforeEach(async () => {
      const suffix = crypto.randomUUID();
      const [createdServer] = await db
        .insert(servers)
        .values({
          name: "replacement-test",
          url: `http://replacement-test.invalid/${suffix}`,
          apiKey: "test-only",
        })
        .returning();
      if (!createdServer) throw new Error("Failed to create test server");
      server = createdServer;
      libraryId = `library-${suffix}`;
      oldId = `old-${suffix}`;
      replacement = {
        Id: `new-${suffix}`,
        Name: "Replacement movie",
        Type: "Movie",
        IsFolder: false,
        LocationType: "FileSystem",
        Etag: "replacement-etag",
        ProviderIds: { Imdb: `imdb-${suffix}` },
      };
      await db.insert(libraries).values({
        id: libraryId,
        name: "Movies",
        type: "movies",
        serverId: server.id,
      });
      spyOn(JellyfinClient.prototype, "getItemsPage").mockResolvedValue({
        items: [replacement],
        totalCount: 1,
      });
      spyOn(JellyfinClient.prototype, "getLibraries").mockResolvedValue([
        {
          Id: libraryId,
          Name: "Movies",
          CollectionType: "movies",
          IsFolder: true,
          Type: "CollectionFolder",
          LocationType: "FileSystem",
        },
      ]);
      spyOn(
        JellyfinClient.prototype,
        "getRecentlyAddedItemsByLibrary",
      ).mockResolvedValue([replacement]);
    });

    afterEach(async () => {
      mock.restore();
      await db.execute(
        sql`DROP TRIGGER IF EXISTS reject_item_replacement_test ON items`,
      );
      await db.delete(servers).where(eq(servers.id, server.id));
    });

    afterAll(async () => {
      await db.execute(
        sql`DROP FUNCTION IF EXISTS reject_item_replacement_test()`,
      );
      await closeConnection();
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    });

    async function seedHistory() {
      await db.insert(items).values({
        id: oldId,
        serverId: server.id,
        libraryId,
        name: "Old movie",
        type: "Movie",
        isFolder: false,
        rawData: {},
        providerIds: replacement.ProviderIds,
        deletedAt: new Date(),
      });
      await db.insert(sessions).values({
        id: `session-${oldId}`,
        serverId: server.id,
        itemId: oldId,
        userName: "test-user",
        playDuration: 120,
        completed: true,
        isPaused: false,
        isMuted: false,
        isActive: false,
        rawData: {},
      });
      await db
        .insert(hiddenRecommendations)
        .values({ serverId: server.id, itemId: oldId, userId: "test-user" });
    }

    async function rejectOldItemDeletion() {
      await db.execute(sql`
      CREATE TRIGGER reject_item_replacement_test BEFORE DELETE ON items
      FOR EACH ROW EXECUTE FUNCTION reject_item_replacement_test()
    `);
    }

    for (const mode of ["full", "recent"] as const) {
      const sync = () =>
        mode === "full"
          ? syncItems(server, { apiRequestDelayMs: 0 })
          : syncRecentlyAddedItems(server);

      test(`${mode} sync inserts the target before moving history`, async () => {
        await seedHistory();
        const result = await sync();
        expect(result.status).toBe("success");
        expect(result.metrics.itemsInserted).toBe(1);
        expect(result.metrics.errors).toBe(0);
        expect(
          await db
            .select({ id: items.id })
            .from(items)
            .where(eq(items.serverId, server.id)),
        ).toEqual([{ id: replacement.Id }]);
        expect(
          await db
            .select({
              itemId: sessions.itemId,
              playDuration: sessions.playDuration,
            })
            .from(sessions)
            .where(eq(sessions.serverId, server.id)),
        ).toEqual([{ itemId: replacement.Id, playDuration: 120 }]);
        expect(
          await db
            .select({ itemId: hiddenRecommendations.itemId })
            .from(hiddenRecommendations)
            .where(eq(hiddenRecommendations.serverId, server.id)),
        ).toEqual([{ itemId: replacement.Id }]);

        const repeated = await sync();
        expect(repeated.status).toBe("success");
        expect(repeated.metrics.itemsInserted).toBe(0);
        expect(repeated.metrics.itemsUnchanged).toBe(1);
      });

      test(`${mode} sync rolls back the target and all history changes if deletion fails`, async () => {
        await seedHistory();
        await rejectOldItemDeletion();
        const result = await sync();
        expect(result.status).toBe("error");
        expect(
          await db
            .select({ id: items.id })
            .from(items)
            .where(eq(items.serverId, server.id)),
        ).toEqual([{ id: oldId }]);
        expect(
          await db
            .select({ itemId: sessions.itemId })
            .from(sessions)
            .where(eq(sessions.serverId, server.id)),
        ).toEqual([{ itemId: oldId }]);
        expect(
          await db
            .select({ itemId: hiddenRecommendations.itemId })
            .from(hiddenRecommendations)
            .where(eq(hiddenRecommendations.serverId, server.id)),
        ).toEqual([{ itemId: oldId }]);
        expect(result.metrics.itemsInserted).toBe(0);

        await db.execute(
          sql`DROP TRIGGER reject_item_replacement_test ON items`,
        );
        const retried = await sync();
        expect(retried.status).toBe("success");
        expect(retried.metrics.itemsInserted).toBe(1);
        expect(
          await db
            .select({ itemId: sessions.itemId })
            .from(sessions)
            .where(eq(sessions.serverId, server.id)),
        ).toEqual([{ itemId: replacement.Id }]);
      });
    }

    test("full sync reports partial failure and actual item counts while preserving successful items", async () => {
      await seedHistory();
      await rejectOldItemDeletion();
      const ordinaryItem = {
        ...replacement,
        Id: `ordinary-${oldId}`,
        ProviderIds: {},
      };
      spyOn(JellyfinClient.prototype, "getItemsPage").mockResolvedValue({
        items: [replacement, ordinaryItem],
        totalCount: 2,
      });
      spyOn(JellyfinClient.prototype, "getUsers").mockResolvedValue([]);
      spyOn(JellyfinClient.prototype, "getActivities").mockResolvedValue([]);
      const logs = spyOn(console, "info").mockImplementation(() => {});

      const result = await performFullSync(server, { apiRequestDelayMs: 0 });

      expect(result.status).toBe("partial");
      if (result.status !== "partial") throw new Error("Expected partial sync");
      expect(result.data.items.itemsInserted).toBe(1);
      expect(result.errors.join(" ")).toContain("Items:");
      expect(
        await db
          .select({ id: items.id })
          .from(items)
          .where(
            and(eq(items.serverId, server.id), eq(items.id, ordinaryItem.Id)),
          ),
      ).toHaveLength(1);
      const itemSummary = logs.mock.calls
        .map(([line]) => String(line))
        .find(
          (line) =>
            line.includes("[full-sync]") &&
            line.includes("phase=done") &&
            line.includes("step=items"),
        );
      expect(itemSummary).toContain("status=partial");
      expect(itemSummary).toContain("processed=1");
      expect(itemSummary).toContain("inserted=1");
      expect(itemSummary).toContain("errors=1");
    });

    test("a failed page fetch is reported as an error", async () => {
      spyOn(JellyfinClient.prototype, "getItemsPage").mockRejectedValue(
        new Error("test API unavailable"),
      );
      const result = await syncItems(server);
      expect(result.status).toBe("error");
      expect(result.metrics.errors).toBe(1);
    });

    test("missing libraries report a counted error", async () => {
      await db.delete(libraries).where(eq(libraries.id, libraryId));
      const result = await syncItems(server);
      expect(result.status).toBe("error");
      expect(result.metrics.errors).toBe(1);
    });

    test("an empty library succeeds without inserting anything", async () => {
      spyOn(JellyfinClient.prototype, "getItemsPage").mockResolvedValue({
        items: [],
        totalCount: 0,
      });
      const result = await syncItems(server);
      expect(result.status).toBe("success");
      expect(result.metrics.itemsInserted).toBe(0);
      expect(result.metrics.errors).toBe(0);
    });
  },
);
