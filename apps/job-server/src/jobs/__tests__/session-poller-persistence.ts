import { mock } from "bun:test";
import assert from "node:assert/strict";
import type { NewSession } from "@streamystats/database";
import * as schema from "@streamystats/database/schema";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { JellyfinSession } from "../../jellyfin/types";

const dialect = new PgDialect();
type ItemRow = { id: string; serverId: number };
type SourceRow = ItemRow & { itemId: string };
let itemRows: ItemRow[] = [];
let sourceRows: SourceRow[] = [];
const saved: NewSession[] = [];
const database = {
  execute: async () => [],
  select: () => ({
    from: (table: unknown) => ({
      where: (condition: SQL) => ({
        limit: async () => {
          const { params } = dialect.sqlToQuery(condition);
          if (table === schema.users) return [{ id: "viewer" }];
          const rows = table === schema.items ? itemRows : sourceRows;
          return rows.filter(
            (row) => row.id === params[0] && row.serverId === params[1],
          );
        },
      }),
    }),
  }),
  insert: () => ({
    values: (record: NewSession) => ({
      onConflictDoNothing: () => ({
        returning: async () => {
          saved.push(record);
          return [{ id: record.id }];
        },
      }),
    }),
  }),
};
mock.module("@streamystats/database", () => ({
  ...schema,
  db: {
    transaction: async (fn: (tx: typeof database) => Promise<void>) =>
      fn(database),
    ...database,
  },
}));
mock.module("../../jellyfin/client", () => ({
  JellyfinClient: {
    fromServer: () => ({ getItemMediaSourceIds: async () => [] }),
  },
}));

// Load the real lifecycle after mocking only database and Jellyfin boundaries.
const { SessionPoller } = await import("../session-poller");
const source: JellyfinSession = {
  Id: "playback-1",
  UserId: "viewer",
  NowPlayingItem: {
    Id: "new-movie",
    Type: "Movie",
    RunTimeTicks: 36_000_000_000,
  },
  PlayState: { PositionTicks: 1_000_000_000, MediaSourceId: "version-source" },
};
const server = { id: 1, url: "http://jellyfin.invalid", apiKey: "test-only" };
const scenarios: {
  name: string;
  items: ItemRow[];
  sources?: SourceRow[];
  expectedId: string | null;
  syncedBeforeStart?: boolean;
}[] = [
  {
    name: "item synced during playback",
    items: [{ id: "new-movie", serverId: 1 }],
    expectedId: "new-movie",
  },
  {
    name: "alternate version synced during playback",
    items: [{ id: "listed-movie", serverId: 1 }],
    sources: [{ id: "version-source", itemId: "listed-movie", serverId: 1 }],
    expectedId: "listed-movie",
  },
  { name: "still unresolved", items: [], expectedId: null },
  {
    name: "item belongs to another server",
    items: [{ id: "new-movie", serverId: 2 }],
    expectedId: null,
  },
  {
    name: "media source belongs to another server",
    items: [{ id: "listed-movie", serverId: 2 }],
    sources: [{ id: "version-source", itemId: "listed-movie", serverId: 2 }],
    expectedId: null,
  },
  {
    name: "already resolved alternate version",
    items: [{ id: "listed-movie", serverId: 1 }],
    sources: [{ id: "version-source", itemId: "listed-movie", serverId: 1 }],
    expectedId: "listed-movie",
    syncedBeforeStart: true,
  },
];

for (const scenario of scenarios) {
  itemRows = scenario.syncedBeforeStart ? scenario.items : [];
  sourceRows = scenario.syncedBeforeStart ? (scenario.sources ?? []) : [];
  saved.length = 0;
  const poller = new SessionPoller();
  const tracked = await Reflect.apply(
    Reflect.get(poller, "createTrackedSession"),
    poller,
    [server, source, new Date(Date.now() - 5000)],
  );
  assert.ok(
    tracked &&
      typeof tracked === "object" &&
      "itemId" in tracked &&
      "sessionKey" in tracked,
  );
  assert.equal(
    tracked.itemId,
    scenario.syncedBeforeStart ? scenario.expectedId : null,
  );
  itemRows = scenario.items;
  sourceRows = scenario.sources ?? [];
  const updated = await Reflect.apply(
    Reflect.get(poller, "handleUpdatedSessions"),
    poller,
    [server, [source], new Map([[tracked.sessionKey, tracked]])],
  );
  assert.ok(updated instanceof Map);
  await Reflect.apply(Reflect.get(poller, "savePlaybackRecord"), poller, [
    server,
    updated.get(tracked.sessionKey),
    100,
    10,
    false,
  ]);
  assert.equal(saved.length, 1, scenario.name);
  assert.equal(saved[0]?.itemId, scenario.expectedId, scenario.name);
  assert.equal(saved[0]?.playDuration, 100, scenario.name);
  const rawData = saved[0]?.rawData;
  assert.ok(
    rawData && typeof rawData === "object" && "nowPlayingItemId" in rawData,
  );
  assert.equal(rawData.nowPlayingItemId, "new-movie", scenario.name);
}
