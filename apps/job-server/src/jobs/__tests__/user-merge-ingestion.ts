import { mock } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  db,
  closeConnection,
  servers,
  users,
  sessions,
  activities,
  activityLocations,
  userFingerprints,
  anomalyEvents,
  mergeUsersPermanently,
  previewUserMerge,
} from "@streamystats/database";
import { eq, sql, and } from "drizzle-orm";
import { migrateTestDatabase } from "../../../../../packages/database/tests/setup";
import type { TrackedSession } from "../../jellyfin/types";
import { SessionPoller } from "../session-poller";

// Only the geographic lookup is mocked; persistence and worker lifecycles are real.
mock.module("../../services/geolocation", () => ({
  geolocateIp: () => ({
    geo: {
      countryCode: "DE",
      country: "Germany",
      city: "Berlin",
      latitude: null,
      longitude: null,
    },
    isPrivateIp: false,
  }),
  checkImpossibleTravel: () => null,
  parseIpFromShortOverview: () => "203.0.113.1",
  getDeviceOrClientFromActivity: () => "fixture",
}));
const { geolocateActivitiesJob } = await import("../geolocation-jobs");
const url = process.env.DATABASE_URL;
if (!url?.endsWith("_test")) throw new Error("Use an isolated test database");
await migrateTestDatabase(url);
const [server] = await db
  .insert(servers)
  .values({
    name: "Merge ingestion fixture",
    url: `http://${randomUUID()}.invalid`,
    apiKey: "fixture",
  })
  .returning();
const sourceId = randomUUID();
const targetId = randomUUID();
const actor = { id: "fixture-admin", name: "Fixture admin" };
try {
  await db
    .insert(users)
    .values(
      [sourceId, targetId].map((id) => ({ id, serverId: server.id, name: id })),
    );
  await db.insert(userFingerprints).values(
    [sourceId, targetId].map((userId) => ({
      serverId: server.id,
      userId,
      knownCountries: [userId === sourceId ? "SE" : "US"],
      knownDeviceIds: ["fixture"],
    })),
  );
  const activityId = randomUUID();
  await db.insert(activities).values({
    id: activityId,
    serverId: server.id,
    userId: sourceId,
    name: "New country login",
    type: "UserLoggedIn",
    date: new Date(),
    shortOverview: "IP: 203.0.113.1",
    severity: "Information",
  });
  const input = { sourceUserId: sourceId, targetUserId: targetId };
  const preview = await previewUserMerge({ serverId: server.id, input });
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const merging = db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(582, ${server.id})`);
    locked.resolve();
    await release.promise;
    await mergeUsersPermanently({
      serverId: server.id,
      input,
      previewToken: preview.token,
      operationId: randomUUID(),
      actor,
      database: tx,
    });
  });
  await locked.promise;
  const poller = new SessionPoller();
  const tracked: TrackedSession = {
    sessionKey: randomUUID(),
    sessionId: randomUUID(),
    userJellyfinId: sourceId,
    userName: sourceId,
    itemId: null,
    itemName: "Fixture movie",
    startTime: new Date(Date.now() - 120_000),
    lastUpdateTime: new Date(),
    playDuration: 120,
    isPaused: true,
    isActive: false,
    isMuted: false,
    positionTicks: 1_200_000_000,
    runtimeTicks: 2_400_000_000,
    deviceId: "fixture",
    deviceName: "fixture",
    clientName: "Test",
  };
  const trackedMap = new Map([[tracked.sessionKey, tracked]]);
  const saving: Promise<unknown> = Reflect.apply(
    Reflect.get(poller, "handleEndedSessions"),
    poller,
    [server, [{ key: tracked.sessionKey, session: tracked }], trackedMap],
  );
  const geolocating = geolocateActivitiesJob({ data: { serverId: server.id } });
  // Longer than the poller's 10-second statement timeout. Both workers must
  // resume using the destination after the merge commits.
  await Bun.sleep(11_000);
  release.resolve();
  await Promise.all([merging, saving, geolocating]);
  const history = await db
    .select()
    .from(sessions)
    .where(eq(sessions.serverId, server.id));
  assert.equal(history.length, 1);
  assert.equal(history[0].userId, targetId);
  assert.equal(history[0].playDuration, 120);
  assert.equal(trackedMap.size, 0);
  const alerts = await db
    .select()
    .from(anomalyEvents)
    .where(
      and(
        eq(anomalyEvents.serverId, server.id),
        eq(anomalyEvents.anomalyType, "new_country"),
      ),
    );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].userId, targetId);
  const [fingerprint] = await db
    .select()
    .from(userFingerprints)
    .where(eq(userFingerprints.serverId, server.id));
  assert.deepEqual(fingerprint.knownCountries?.sort(), ["DE", "SE", "US"]);
  // The activity itself was read before merging; its location must still persist.
  assert.equal(
    (
      await db
        .select()
        .from(activityLocations)
        .where(eq(activityLocations.activityId, activityId))
    ).length,
    1,
  );
  console.log("merge ingestion regressions passed");
} finally {
  await db.delete(servers).where(eq(servers.id, server.id));
  await closeConnection();
}
