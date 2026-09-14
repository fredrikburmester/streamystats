import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	closeConnection,
	db,
	getClient,
	hiddenRecommendations,
	itemPeople,
	items,
	libraries,
	mediaSources,
	people,
	type Server,
	servers,
	sessions,
	watchlistItems,
	watchlists,
} from "@streamystats/database";
import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { type JellyfinBaseItemDto, JellyfinClient } from "../../client";
import { syncItems, syncRecentlyAddedItems } from "../items";
import { syncLibraries } from "../libraries";

const testUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;
const originalUrl = process.env.DATABASE_URL;

describe.skipIf(!testUrl)("server-scoped media identities", () => {
	const databaseName = `media_scope_${crypto.randomUUID().replaceAll("-", "")}_test`;
	let databaseCreated = false;
	let migrationDirectory: string | undefined;
	let upgradeServers: Server[] = [];

	beforeAll(async () => {
		if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) {
			throw new Error(
				"STREAMYSTATS_TEST_DATABASE_URL must name a dedicated database ending in _test",
			);
		}
		// A fresh child database exercises the real upgrade, including corrupted
		// pre-upgrade references, without modifying the caller's test database.
		await closeConnection();
		process.env.DATABASE_URL = testUrl;
		await getClient().unsafe(`CREATE DATABASE "${databaseName}"`);
		databaseCreated = true;
		const isolatedUrl = new URL(testUrl);
		isolatedUrl.pathname = `/${databaseName}`;
		await closeConnection();
		process.env.DATABASE_URL = isolatedUrl.toString();
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

		const migrations = fileURLToPath(
			new URL("../../../../../../packages/database/drizzle", import.meta.url),
		);
		migrationDirectory = await mkdtemp(
			join(tmpdir(), "media-scope-migrations-"),
		);
		await mkdir(join(migrationDirectory, "meta"));
		const journal = JSON.parse(
			await readFile(join(migrations, "meta/_journal.json"), "utf8"),
		);
		const oldEntries = journal.entries.filter(
			(entry: { idx: number }) => entry.idx < 45,
		);
		await writeFile(
			join(migrationDirectory, "meta/_journal.json"),
			JSON.stringify({ ...journal, entries: oldEntries }),
		);
		for (const entry of oldEntries) {
			await copyFile(
				join(migrations, `${entry.tag}.sql`),
				join(migrationDirectory, `${entry.tag}.sql`),
			);
		}
		await migrate(db, { migrationsFolder: migrationDirectory });
		upgradeServers = await db
			.insert(servers)
			.values([
				{
					name: "Upgrade A",
					url: "http://upgrade-a.invalid",
					apiKey: "test-only",
				},
				{
					name: "Upgrade B",
					url: "http://upgrade-b.invalid",
					apiKey: "test-only",
				},
			])
			.returning();
		const [a, b] = upgradeServers;
		if (!a || !b) throw new Error("Missing upgrade fixtures");
		// This is the state left by a library/item overwritten by server B.
		await db.insert(libraries).values({
			id: "upgrade-library",
			serverId: b.id,
			name: "Movies",
			type: "movies",
		});
		await db.insert(items).values({
			id: "upgrade-item",
			serverId: b.id,
			libraryId: "upgrade-library",
			name: "Last synced title",
			type: "Movie",
			isFolder: false,
			etag: "old-etag",
			processed: true,
			rawData: {},
		});
		await seedSession(a.id, "upgrade-session", "upgrade-item", 321);
		await db.insert(hiddenRecommendations).values({
			serverId: a.id,
			itemId: "upgrade-item",
			userId: "fixture-user",
		});
		await db
			.insert(mediaSources)
			.values({ serverId: a.id, id: "upgrade-source", itemId: "upgrade-item" });
		await db.insert(itemPeople).values({
			serverId: a.id,
			itemId: "upgrade-item",
			personId: "person",
			type: "Actor",
		});
		const [list] = await db
			.insert(watchlists)
			.values({
				serverId: a.id,
				userId: "fixture-user",
				name: "Preserved list",
			})
			.returning();
		if (!list) throw new Error("Missing watchlist fixture");
		await db.execute(
			sql`INSERT INTO watchlist_items (watchlist_id, item_id) VALUES (${list.id}, 'upgrade-item')`,
		);
		await migrate(db, { migrationsFolder: migrations });
	}, 60_000);

	afterEach(() => mock.restore());
	afterAll(async () => {
		await closeConnection();
		try {
			if (databaseCreated && testUrl) {
				process.env.DATABASE_URL = testUrl;
				await getClient().unsafe(`DROP DATABASE "${databaseName}"`);
			}
		} finally {
			await closeConnection();
			if (originalUrl === undefined) delete process.env.DATABASE_URL;
			else process.env.DATABASE_URL = originalUrl;
			if (migrationDirectory)
				await rm(migrationDirectory, { recursive: true, force: true });
		}
	});

	async function createPair() {
		const suffix = crypto.randomUUID();
		const [a, b] = await db
			.insert(servers)
			.values([
				{
					name: `A-${suffix}`,
					url: `http://a.invalid/${suffix}`,
					apiKey: "test-only",
				},
				{
					name: `B-${suffix}`,
					url: `http://b.invalid/${suffix}`,
					apiKey: "test-only",
				},
			])
			.returning();
		if (!a || !b) throw new Error("Missing test servers");
		return {
			a,
			b,
			libraryId: `library-${suffix}`,
			itemId: `item-${suffix}`,
			sourceId: `source-${suffix}`,
		};
	}

	function library(id: string, name: string) {
		return {
			Id: id,
			Name: name,
			CollectionType: "movies",
			IsFolder: true,
			Type: "CollectionFolder",
			LocationType: "FileSystem",
		};
	}

	function item(
		id: string,
		sourceId: string,
		name: string,
		etag = name,
	): JellyfinBaseItemDto {
		return {
			Id: id,
			Name: name,
			Etag: etag,
			Type: "Movie",
			IsFolder: false,
			LocationType: "FileSystem",
			MediaSources: [{ Id: sourceId, Name: name, Size: 100 }],
		};
	}

	async function seedSession(
		serverId: number,
		id: string,
		itemId: string,
		duration: number,
	) {
		await db.insert(sessions).values({
			id,
			serverId,
			itemId,
			userName: "fixture-user",
			playDuration: duration,
			startTime: new Date("2026-01-01T12:00:00Z"),
			completed: true,
			isPaused: false,
			isMuted: false,
			isActive: false,
			rawData: {},
		});
	}

	test("upgrade preserves historical links, restores ownership and invalidates copied metadata", async () => {
		const [a, b] = upgradeServers;
		if (!a || !b) throw new Error("Missing upgrade fixtures");
		const repaired = await db.query.items.findFirst({
			where: and(eq(items.serverId, a.id), eq(items.id, "upgrade-item")),
			with: {
				library: true,
				sessions: true,
				itemPeople: true,
				hiddenRecommendations: true,
				watchlistItems: true,
			},
		});
		expect(repaired?.library.serverId).toBe(a.id);
		expect(repaired?.sessions.map((s) => s.playDuration)).toEqual([321]);
		expect(repaired?.itemPeople).toHaveLength(1);
		expect(repaired?.hiddenRecommendations).toHaveLength(1);
		expect(repaired?.watchlistItems[0]?.serverId).toBe(a.id);
		expect(repaired?.etag).toBeNull();
		expect(repaired?.processed).toBe(false);
		expect(
			await db.select().from(items).where(eq(items.id, "upgrade-item")),
		).toHaveLength(2);
		await db.delete(servers).where(eq(servers.id, b.id));
		expect(
			await db.select().from(items).where(eq(items.id, "upgrade-item")),
		).toHaveLength(1);
		expect(
			await db
				.select()
				.from(sessions)
				.where(eq(sessions.id, "upgrade-session")),
		).toHaveLength(1);
	});

	for (const mode of ["full", "recent"] as const) {
		test(`${mode} sync preserves colliding library, item, source, cast and history on both servers`, async () => {
			const { a, b, libraryId, itemId, sourceId } = await createPair();
			const libraryApi = spyOn(JellyfinClient.prototype, "getLibraries");
			const fullApi = spyOn(JellyfinClient.prototype, "getItemsPage");
			const recentApi = spyOn(
				JellyfinClient.prototype,
				"getRecentlyAddedItemsByLibrary",
			);
			for (const server of [a, b]) {
				const dto = item(itemId, sourceId, server.name, "shared-etag");
				libraryApi.mockResolvedValue([library(libraryId, server.name)]);
				expect((await syncLibraries(server)).status).toBe("success");
				fullApi.mockResolvedValue({ items: [dto], totalCount: 1 });
				recentApi.mockResolvedValue([dto]);
				const sync = () =>
					mode === "full"
						? syncItems(server, { apiRequestDelayMs: 0 })
						: syncRecentlyAddedItems(server);
				expect((await sync()).status).toBe("success");
				expect((await sync()).metrics.itemsUnchanged).toBe(1);
				await seedSession(server.id, `session-${server.id}`, itemId, server.id);
				await db.insert(people).values({
					id: "shared-person",
					serverId: server.id,
					name: server.name,
				});
				await db.insert(itemPeople).values({
					itemId,
					serverId: server.id,
					personId: "shared-person",
					type: "Actor",
				});
			}
			const storedItems = await db
				.select({ serverId: items.serverId, name: items.name })
				.from(items)
				.where(eq(items.id, itemId))
				.orderBy(items.serverId);
			expect(storedItems).toEqual([
				{ serverId: a.id, name: a.name },
				{ serverId: b.id, name: b.name },
			]);
			expect(
				await db
					.select({ serverId: mediaSources.serverId, name: mediaSources.name })
					.from(mediaSources)
					.where(eq(mediaSources.id, sourceId))
					.orderBy(mediaSources.serverId),
			).toEqual(storedItems);
			const history = await db.query.sessions.findMany({
				where: eq(sessions.itemId, itemId),
				with: {
					item: {
						with: { library: true, itemPeople: { with: { person: true } } },
					},
				},
				orderBy: sessions.serverId,
			});
			expect(
				history.map((s) => [
					s.serverId,
					s.item?.serverId,
					s.item?.library.serverId,
					s.item?.itemPeople[0]?.person.name,
				]),
			).toEqual([
				[a.id, a.id, a.id, a.name],
				[b.id, b.id, b.id, b.name],
			]);
			// Deleting B's library must not delete A's item or null A's history.
			await db
				.delete(libraries)
				.where(and(eq(libraries.serverId, b.id), eq(libraries.id, libraryId)));
			expect(
				await db.select().from(items).where(eq(items.id, itemId)),
			).toHaveLength(1);
			const remaining = await db
				.select({ serverId: sessions.serverId, itemId: sessions.itemId })
				.from(sessions)
				.where(
					sql`${sessions.id} IN (${`session-${a.id}`}, ${`session-${b.id}`})`,
				)
				.orderBy(sessions.serverId);
			expect(remaining).toEqual([
				{ serverId: a.id, itemId },
				{ serverId: b.id, itemId: null },
			]);
		});
	}

	test("recent sync inserts the whole batch when only another server has the same ID", async () => {
		const { a, b, libraryId, itemId, sourceId } = await createPair();
		await db.insert(libraries).values(
			[a, b].map((server) => ({
				serverId: server.id,
				id: libraryId,
				name: server.name,
				type: "movies",
			})),
		);
		await db.insert(items).values({
			serverId: a.id,
			id: itemId,
			libraryId,
			name: a.name,
			type: "Movie",
			isFolder: false,
			rawData: {},
		});
		spyOn(JellyfinClient.prototype, "getLibraries").mockResolvedValue([
			library(libraryId, b.name),
		]);
		spyOn(
			JellyfinClient.prototype,
			"getRecentlyAddedItemsByLibrary",
		).mockResolvedValue([
			item(itemId, sourceId, b.name),
			item(`unique-${itemId}`, `unique-${sourceId}`, "Unique"),
		]);
		const result = await syncRecentlyAddedItems(b);
		expect(result.status).toBe("success");
		expect(result.metrics.itemsInserted).toBe(2);
		expect(
			await db.select().from(items).where(eq(items.serverId, b.id)),
		).toHaveLength(2);
	});

	test("foreign keys reject cross-server references and watchlists retain their server", async () => {
		const { a, b, libraryId, itemId } = await createPair();
		await db
			.insert(libraries)
			.values({ serverId: a.id, id: libraryId, name: a.name, type: "movies" });
		await expect(
			db
				.insert(items)
				.values({
					serverId: b.id,
					id: itemId,
					libraryId,
					name: "Wrong server",
					type: "Movie",
					isFolder: false,
					rawData: {},
				})
				.execute(),
		).rejects.toThrow();
		await db.insert(items).values({
			serverId: a.id,
			id: itemId,
			libraryId,
			name: "A",
			type: "Movie",
			isFolder: false,
			rawData: {},
		});
		await expect(
			seedSession(b.id, `invalid-${itemId}`, itemId, 1),
		).rejects.toThrow();
		const [list] = await db
			.insert(watchlists)
			.values({ serverId: b.id, userId: "fixture", name: "B list" })
			.returning();
		if (!list) throw new Error("Missing watchlist");
		await expect(
			db
				.insert(watchlistItems)
				.values({ watchlistId: list.id, serverId: a.id, itemId })
				.execute(),
		).rejects.toThrow();
		await expect(
			db
				.insert(watchlistItems)
				.values({ watchlistId: list.id, serverId: b.id, itemId })
				.execute(),
		).rejects.toThrow();
	});
	test("replacement migration moves only the matching server's history", async () => {
		const { a, b, libraryId, itemId, sourceId } = await createPair();
		for (const server of [a, b]) {
			await db.insert(libraries).values({
				serverId: server.id,
				id: libraryId,
				name: server.name,
				type: "movies",
			});
			await db.insert(items).values({
				serverId: server.id,
				id: itemId,
				libraryId,
				name: server.name,
				type: "Movie",
				isFolder: false,
				rawData: {},
				providerIds: { Imdb: itemId },
				deletedAt: new Date(),
			});
			await seedSession(server.id, `replace-${server.id}`, itemId, 100);
			await db
				.insert(hiddenRecommendations)
				.values({ serverId: server.id, itemId, userId: "fixture" });
		}
		const replacement = {
			...item(`new-${itemId}`, sourceId, "Replacement"),
			ProviderIds: { Imdb: itemId },
		};
		spyOn(JellyfinClient.prototype, "getItemsPage").mockResolvedValue({
			items: [replacement],
			totalCount: 1,
		});
		expect((await syncItems(a, { apiRequestDelayMs: 0 })).status).toBe(
			"success",
		);
		const aHistory = await db.query.sessions.findFirst({
			where: eq(sessions.id, `replace-${a.id}`),
		});
		const bHistory = await db.query.sessions.findFirst({
			where: eq(sessions.id, `replace-${b.id}`),
		});
		expect(aHistory?.itemId).toBe(replacement.Id);
		expect(bHistory?.itemId).toBe(itemId);
		expect(
			await db
				.select()
				.from(items)
				.where(and(eq(items.serverId, b.id), eq(items.id, itemId))),
		).toHaveLength(1);
		expect(
			await db
				.select({ serverId: hiddenRecommendations.serverId })
				.from(hiddenRecommendations)
				.where(eq(hiddenRecommendations.itemId, itemId)),
		).toEqual([{ serverId: b.id }]);
	});
});
