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
import { and, asc, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  closeConnection,
  db,
  itemLibraries,
  items,
  libraries,
  servers,
  type Server,
} from "@streamystats/database";
import { JellyfinClient, type JellyfinBaseItemDto } from "../client";
import { syncItems, syncRecentlyAddedItems } from "./items";

// Use a dedicated database: this suite runs migrations.
const testDatabaseUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("items in several libraries", () => {
  let server: Server;
  let moviesId: string;
  let kidsId: string;
  let shared: JellyfinBaseItemDto;
  let moviesOnly: JellyfinBaseItemDto;
  // What each library lists. A library without an entry fails to list.
  let listings: Map<string, JellyfinBaseItemDto[]>;

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
  }, 30_000);

  beforeEach(async () => {
    const suffix = crypto.randomUUID();
    const [createdServer] = await db
      .insert(servers)
      .values({
        name: "item-libraries-test",
        url: `http://item-libraries-test.invalid/${suffix}`,
        apiKey: "test-only",
      })
      .returning();
    if (!createdServer) throw new Error("Failed to create test server");
    server = createdServer;
    moviesId = `movies-${suffix}`;
    kidsId = `kids-${suffix}`;
    const movie = (id: string): JellyfinBaseItemDto => ({
      Id: `${id}-${suffix}`,
      Name: id,
      Type: "Movie",
      IsFolder: false,
      LocationType: "FileSystem",
      Etag: `${id}-etag`,
    });
    shared = movie("shared");
    moviesOnly = movie("movies-only");
    listings = new Map([
      [moviesId, [shared, moviesOnly]],
      [kidsId, [shared]],
    ]);
    await db.insert(libraries).values([
      { id: moviesId, name: "Movies", type: "movies", serverId: server.id },
      { id: kidsId, name: "Kids", type: "movies", serverId: server.id },
    ]);
    spyOn(JellyfinClient.prototype, "getItemsPage").mockImplementation(
      async (libraryId: string) => {
        const listed = listings.get(libraryId);
        if (!listed) throw new Error("injected listing failure");
        return { items: listed, totalCount: listed.length };
      },
    );
    spyOn(JellyfinClient.prototype, "getLibraries").mockResolvedValue(
      [moviesId, kidsId].map((id) => ({
        Id: id,
        Name: id,
        CollectionType: "movies",
        IsFolder: true,
        Type: "CollectionFolder",
        LocationType: "FileSystem",
      })),
    );
    spyOn(
      JellyfinClient.prototype,
      "getRecentlyAddedItemsByLibrary",
    ).mockImplementation(
      async (libraryId: string) => listings.get(libraryId) ?? [],
    );
  });

  afterEach(async () => {
    mock.restore();
    await db.delete(servers).where(eq(servers.id, server.id));
  });

  afterAll(async () => {
    await closeConnection();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  async function librariesOf(item: JellyfinBaseItemDto) {
    const rows = await db
      .select({ libraryId: itemLibraries.libraryId })
      .from(itemLibraries)
      .where(
        and(
          eq(itemLibraries.serverId, server.id),
          eq(itemLibraries.itemId, item.Id),
        ),
      )
      .orderBy(asc(itemLibraries.libraryId));
    return rows.map((row) => row.libraryId);
  }

  async function storedLibraryOf(item: JellyfinBaseItemDto) {
    const [row] = await db
      .select({ libraryId: items.libraryId })
      .from(items)
      .where(and(eq(items.serverId, server.id), eq(items.id, item.Id)));
    return row?.libraryId;
  }

  const fullSync = () => syncItems(server, { apiRequestDelayMs: 0 });

  for (const mode of ["full", "recent"] as const) {
    const sync = () =>
      mode === "full" ? fullSync() : syncRecentlyAddedItems(server);

    test(`${mode} sync records every library that lists an item`, async () => {
      const result = await sync();
      expect(result.status).toBe("success");
      expect(result.metrics.itemsInserted).toBe(2);
      expect(await librariesOf(shared)).toEqual([kidsId, moviesId]);
      expect(await librariesOf(moviesOnly)).toEqual([moviesId]);

      const repeated = await sync();
      expect(repeated.status).toBe("success");
      expect(repeated.metrics.itemsInserted).toBe(0);
      expect(await librariesOf(shared)).toEqual([kidsId, moviesId]);
    });
  }

  test("an unchanged item is recorded for a library it has joined", async () => {
    listings.set(kidsId, []);
    await fullSync();
    expect(await librariesOf(shared)).toEqual([moviesId]);

    listings.set(kidsId, [shared]);
    const result = await fullSync();
    expect(result.metrics.itemsUnchanged).toBe(3);
    expect(await librariesOf(shared)).toEqual([kidsId, moviesId]);
  });

  test("an item that left a library is taken out of it", async () => {
    await fullSync();
    await db
      .update(items)
      .set({ libraryId: moviesId })
      .where(and(eq(items.serverId, server.id), eq(items.id, shared.Id)));

    listings.set(moviesId, [moviesOnly]);
    const result = await fullSync();
    expect(result.status).toBe("success");
    expect(await librariesOf(shared)).toEqual([kidsId]);
    expect(await storedLibraryOf(shared)).toBe(kidsId);
    expect(await librariesOf(moviesOnly)).toEqual([moviesId]);
  });

  test("an item gone from Jellyfin keeps its libraries", async () => {
    await fullSync();
    listings.set(moviesId, [moviesOnly]);
    listings.set(kidsId, []);
    const result = await fullSync();
    expect(result.status).toBe("success");
    expect(await librariesOf(shared)).toEqual([kidsId, moviesId]);
  });

  test("a library that failed to list keeps its items", async () => {
    await fullSync();
    listings.delete(moviesId);
    const result = await fullSync();
    expect(result.status).toBe("partial");
    expect(await librariesOf(shared)).toEqual([kidsId, moviesId]);
    expect(await librariesOf(moviesOnly)).toEqual([moviesId]);
  });

  test("syncing one library leaves the others as they are", async () => {
    await fullSync();
    listings.set(moviesId, [moviesOnly]);
    const result = await syncItems(server, {
      apiRequestDelayMs: 0,
      libraryId: moviesId,
    });
    expect(result.status).toBe("success");
    expect(await librariesOf(shared)).toEqual([kidsId, moviesId]);
  });
});
