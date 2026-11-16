import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { ledgerRecords, sessions, items, servers, users } from "@streamystats/database";
mock.module("server-only", () => ({}));
const postgres = new PGlite();
await postgres.exec(
  "CREATE TABLE servers(id integer PRIMARY KEY, timezone text DEFAULT 'UTC'); CREATE TABLE users(id text PRIMARY KEY, name text DEFAULT 'Viewer', server_id integer DEFAULT 1); INSERT INTO servers VALUES(1); INSERT INTO users(id) VALUES('viewer'),('other');",
);
await postgres.exec(
  await readFile(
    new URL(
      "../../../../../packages/database/drizzle/0045_abnormal_war_machine.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const database = drizzle(postgres);
mock.module("@streamystats/database", () => ({
  db: database,
  ledgerRecords,
  sessions,
  items,
  servers,
  users,
}));
const { saveLedgerRows, resetLedgerCorrections } = await import("../persistence");
const scope = { serverId: 1, userId: "viewer" };
const read = async (kind: string) =>
  (
    await postgres.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM ledger_records WHERE server_id=1 AND user_id='viewer' AND kind=$1",
      [kind],
    )
  ).rows;
for (const kind of ["correction", "settings"]) {
  await Promise.all([
    saveLedgerRows({ ...scope, rows: [{ kind, sourceKey: "key", payload: { a: true } }] }),
    saveLedgerRows({ ...scope, rows: [{ kind, sourceKey: "key", payload: { b: true } }] }),
  ]);
  assert.deepEqual((await read(kind))[0].payload, { a: true, b: true });
}
const newer = {
  kind: "simkl-json",
  sourceKey: "show",
  payload: {
    history: [
      { key: "ep1", watchedAt: "2026-10-02T00:00:00.123456Z" },
      { key: "ep2", watchedAt: "2026-10-03T00:00:00.000000Z" },
    ],
  },
};
await saveLedgerRows({ ...scope, rows: [newer] });
await saveLedgerRows({
  ...scope,
  rows: [
    { ...newer, payload: { history: [{ key: "ep1", watchedAt: "2026-10-01T00:00:00.000000Z" }] } },
  ],
});
assert.deepEqual((await read("simkl-json"))[0].payload.history, newer.payload.history);
const manual = {
  kind: "manual",
  sourceKey: "stable-request",
  payload: { source: "manual", runtime: 100, completed: true },
};
await saveLedgerRows({ ...scope, rows: [manual] });
await saveLedgerRows({
  ...scope,
  rows: [{ ...manual, payload: { completed: true, runtime: 100, source: "manual" } }],
});
assert.equal((await read("manual")).length, 1);
await assert.rejects(
  saveLedgerRows({ ...scope, rows: [{ ...manual, payload: { ...manual.payload, runtime: 200 } }] }),
);
assert.equal((await read("manual"))[0].payload.runtime, 100);
await saveLedgerRows({ serverId: 1, userId: "other", rows: [manual] });
assert.equal((await read("manual")).length, 1);
await resetLedgerCorrections({ ...scope, key: "key" });
assert.equal((await read("correction")).length, 0);
mock.module("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
mock.module("@/lib/db/exclusions", () => ({
  getStatisticsExclusions: async () => ({ excludedUserIds: [] }),
}));
await postgres.exec(`CREATE TABLE items(id text PRIMARY KEY, name text, server_id integer, series_id text, type text,
  production_year integer, provider_ids jsonb, parent_index_number integer, index_number integer, runtime_ticks bigint,
  series_name text, series_primary_image_tag text, primary_image_tag text);
  CREATE TABLE sessions(id text PRIMARY KEY, server_id integer, user_id text, item_id text, item_name text, series_id text, series_name text,
  start_time timestamptz, end_time timestamptz, play_duration integer, runtime_ticks bigint, position_ticks bigint, completed boolean,
  is_inferred boolean, device_name text, client_name text, raw_data jsonb);`);
const sourceDate = "2026-04-25T12:34:56.123456Z";
await saveLedgerRows({
  ...scope,
  rows: [
    {
      kind: "simkl-json",
      sourceKey: "legacy-import",
      payload: {
        title: { key: "legacy-title", name: "Imported movie", kind: "movie" },
        history: [
          {
            key: "legacy-history",
            title: { key: "legacy-title", name: "Imported movie", kind: "movie" },
            watchedAt: null,
            originalWatchedAt: sourceDate,
            accuracy: "unknown",
            runtime: 100,
            completed: true,
            source: "simkl",
          },
        ],
      },
    },
  ],
});
const { getWatchLedger } = await import("../store");
const migrated = await getWatchLedger(scope);
assert.equal(migrated.watches.find((watch) => watch.title.key === "legacy-title")?.end, sourceDate);
assert.equal(
  migrated.watches.find((watch) => watch.title.key === "legacy-title")?.accuracy,
  "accurate",
);
const { getImportedStatisticEvents, getImportedStatistics } = await import(
  "../imported-statistics"
);
const { getTotalWatchTime } = await import("@/lib/db/users");
assert.equal((await getImportedStatisticEvents(scope)).length, 0);
assert.equal(await getTotalWatchTime(scope), 0);
await saveLedgerRows({
  ...scope,
  rows: [{ kind: "settings", sourceKey: "key", payload: { includeImportedStats: true } }],
});
assert.equal(
  (await getImportedStatisticEvents(scope)).reduce((sum, event) => sum + event.seconds, 0),
  100,
);
assert.equal(await getTotalWatchTime(scope), 100);
assert.equal((await getImportedStatistics({ ...scope, startDate: "2026-04-26" })).length, 0);
assert.equal(
  (await getImportedStatistics({ ...scope, startDate: "2026-04-25", endDate: "2026-04-25" }))
    .length,
  1,
);
await postgres.exec(`INSERT INTO items(id, server_id, type, name) VALUES('movie', 1, 'Movie', 'Imported movie');
INSERT INTO sessions(id, server_id, user_id, item_id, item_name, start_time, end_time, play_duration, runtime_ticks, position_ticks, completed, is_inferred, raw_data)
VALUES('native',1,'viewer','movie','Imported movie','2026-04-25T12:34:00Z','2026-04-25T12:35:40Z',95,1000000000,950000000,true,false,'{"watchedRanges":[[0,95]],"startPositionTicks":0}');`);
assert.equal((await getImportedStatisticEvents(scope)).length, 0);
assert.equal(await getTotalWatchTime(scope), 95);
await saveLedgerRows({
  ...scope,
  rows: [{ kind: "settings", sourceKey: "key", payload: { includeImportedStats: false } }],
});
assert.equal(await getTotalWatchTime(scope), 95);
await saveLedgerRows({
  serverId: 1,
  userId: "other",
  rows: [
    { kind: "settings", sourceKey: "settings", payload: { includeImportedStats: true } },
    {
      kind: "simkl-json",
      sourceKey: "other-import",
      payload: {
        title: { key: "other", name: "Other", kind: "movie" },
        history: [
          {
            key: "other",
            title: { key: "other", name: "Other", kind: "movie" },
            watchedAt: sourceDate,
            accuracy: "estimated",
            runtime: 200,
            completed: true,
            source: "simkl",
          },
        ],
      },
    },
  ],
});
assert.equal(
  (await getImportedStatisticEvents({ serverId: 1, userId: "other" })).reduce(
    (sum, event) => sum + event.seconds,
    0,
  ),
  200,
);
assert.equal(
  (await getImportedStatisticEvents({ serverId: 1, userId: "other", viewerUserId: "viewer" }))
    .length,
  0,
);
// A corrected backup can deliberately move dates backward without deleting anything else.
const beforeProtected = await postgres.query(
  "SELECT kind, source_key, payload FROM ledger_records WHERE server_id=1 AND user_id='viewer' AND kind <> 'simkl-json' ORDER BY kind, source_key",
);
const beforeSessions = await postgres.query("SELECT * FROM sessions ORDER BY id");
const earlierDate = "2026-02-01T12:00:00.654321Z";
await saveLedgerRows({
  ...scope,
  useIncomingDates: true,
  rows: [
    {
      ...newer,
      payload: {
        history: [{ key: "ep1", watchedAt: earlierDate, originalWatchedAt: earlierDate }],
      },
    },
  ],
});
assert.deepEqual((await read("simkl-json"))[0].payload.history, [
  { key: "ep1", watchedAt: earlierDate, originalWatchedAt: earlierDate },
  newer.payload.history[1],
]);
// A missing date is not an instruction to erase a previously supplied date.
await saveLedgerRows({
  ...scope,
  useIncomingDates: true,
  rows: [{ ...newer, payload: { history: [{ key: "ep1", watchedAt: null }] } }],
});
assert.deepEqual((await read("simkl-json"))[0].payload.history, [
  { key: "ep1", watchedAt: earlierDate, originalWatchedAt: earlierDate },
  newer.payload.history[1],
]);
await saveLedgerRows({
  ...scope,
  useIncomingDates: true,
  rows: [
    {
      kind: "simkl-json",
      sourceKey: "legacy-import",
      payload: {
        history: [
          {
            key: "legacy-history",
            title: { key: "legacy-title", name: "Imported movie", kind: "movie" },
            watchedAt: earlierDate,
            originalWatchedAt: earlierDate,
            accuracy: "accurate",
            runtime: 100,
            completed: true,
            source: "simkl",
          },
        ],
      },
    },
  ],
});
const corrected = await getWatchLedger(scope);
assert.equal(
  corrected.watches.find((watch) => watch.id === "import:legacy-history")?.end,
  earlierDate,
);
const { buildLedgerView } = await import("../view-model");
const view = buildLedgerView(
  { ...corrected, settings: { ...corrected.settings, includeImportedStats: true } },
  new URLSearchParams(),
);
assert.equal(view.days.find((day) => day.day === "2026-02-01")?.imported, 100);
assert.equal(view.days.find((day) => day.day === "2026-04-25")?.imported, 0);
assert.deepEqual(
  (
    await postgres.query(
      "SELECT kind, source_key, payload FROM ledger_records WHERE server_id=1 AND user_id='viewer' AND kind <> 'simkl-json' ORDER BY kind, source_key",
    )
  ).rows,
  beforeProtected.rows,
);
assert.deepEqual(
  (await postgres.query("SELECT * FROM sessions ORDER BY id")).rows,
  beforeSessions.rows,
);
assert.equal((await read("simkl-json")).length, 2);
await postgres.close();
