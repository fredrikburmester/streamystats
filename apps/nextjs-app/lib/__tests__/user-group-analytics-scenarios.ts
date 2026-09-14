import { expect } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  changeUserGroup,
  closeConnection,
  db,
  items,
  libraries,
  previewUserGroup,
  servers,
  sessions,
  users,
} from "@streamystats/database";
import { eq } from "drizzle-orm";
import { getClientStatistics } from "../db/client-statistics";
import { getHistory, getUserHistory } from "../db/history";
import { getItemUserStats } from "../db/items";
import { getAggregatedLibraryStatistics } from "../db/library-statistics";
import { getUserTasteProfile } from "../db/taste-profile";
import {
  getUserActivityPerDay,
  getUserGenreStats,
  getUserStatsSummaryForServer,
  getUsersWithStats,
  getUserWatchStats,
} from "../db/users";
import { getWrappedData } from "../db/wrapped";

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a dedicated test database.");
const nonce = randomUUID();
const [server] = await db
  .insert(servers)
  .values({
    name: "Analytics fixture",
    url: `https://${nonce}.invalid`,
    apiKey: "fixture",
  })
  .returning();
const serverId = server.id;
const oldId = randomUUID();
const newId = randomUUID();
const movieId = randomUUID();
const libraryId = randomUUID();
try {
  await db
    .insert(libraries)
    .values({ id: libraryId, serverId, name: "Movies", type: "Movie" });
  await db.insert(users).values([
    { id: oldId, serverId, name: "Old", isAdministrator: true },
    {
      id: newId,
      serverId,
      name: "New",
      enableAllFolders: false,
      enabledFolders: [libraryId],
    },
  ]);
  await db.insert(items).values({
    id: movieId,
    serverId,
    libraryId,
    name: "Movie",
    type: "Movie",
    genres: ["Drama"],
    isFolder: false,
    rawData: {},
  });
  await db.insert(sessions).values(
    [oldId, newId].map((userId, i) => ({
      id: randomUUID(),
      serverId,
      userId,
      userServerId: userId,
      userName: userId,
      itemId: movieId,
      startTime: new Date(`2026-01-0${i + 1}`),
      endTime: new Date(`2026-01-0${i + 1}T01:00:00Z`),
      playDuration: (i ? 30 : 20) * 3600,
      percentComplete: 100,
      clientName: "Web",
      deviceName: "Fixture",
      rawData: {},
      completed: true,
      isPaused: false,
      isMuted: false,
      isActive: false,
    })),
  );
  const change = {
    groupId: null,
    expectedRevision: null,
    primaryUserId: newId,
    memberUserIds: [oldId, newId],
  };
  const preview = await previewUserGroup({ serverId, change });
  const group = await changeUserGroup({
    serverId,
    change,
    previewToken: preview.token,
    operationId: randomUUID(),
    actor: { id: oldId, name: "Old" },
  });
  if (!group) throw new Error("Missing group");
  const viewerUserId = newId;
  expect(
    await getUserWatchStats({ serverId, userId: oldId, viewerUserId }),
  ).toEqual({ total_watch_time: 50 * 3600, total_plays: 2, longest_streak: 2 });
  const list = await getUsersWithStats({ serverId, viewerUserId });
  expect(list).toHaveLength(1);
  expect(list[0].id).toBe(newId);
  const leaders = await getUserStatsSummaryForServer({
    serverId,
    viewerUserId,
  });
  expect(leaders).toHaveLength(1);
  expect(leaders[0].totalWatchTime).toBe(50 * 3600);
  const history = await getUserHistory(serverId, oldId, { viewerUserId });
  expect(Number(history.totalCount)).toBe(2);
  expect(new Set(history.data.map((h) => h.session.userId))).toEqual(
    new Set([oldId, newId]),
  );
  expect(
    Number(
      (
        await getHistory(
          serverId,
          1,
          50,
          undefined,
          undefined,
          undefined,
          { userId: oldId },
          viewerUserId,
        )
      ).totalCount,
    ),
  ).toBe(2);
  const clients = await getClientStatistics({ serverId, viewerUserId });
  expect(clients.uniqueUsers).toBe(1);
  expect(clients.clientsPerUser).toHaveLength(1);
  expect(await getItemUserStats({ itemId: movieId, serverId })).toHaveLength(1);
  const wrapped = await getWrappedData({
    serverId,
    userId: oldId,
    year: 2026,
    viewerUserId,
  });
  expect(wrapped.overview.totalWatchTimeSeconds).toBe(50 * 3600);
  expect(wrapped.overview.uniqueItemsWatched).toBe(1);
  expect(wrapped.userName).toBe("New");
  expect(
    (await getUserTasteProfile(serverId, oldId, "Old", viewerUserId))
      .totalWatchTime,
  ).toBe(50 * 3600);
  expect(
    (await getUserGenreStats({ serverId, userId: oldId, viewerUserId }))[0]
      .watchTime,
  ).toBe(50 * 3600);
  expect(
    await getUserActivityPerDay({
      serverId,
      startDate: "2026-01-01",
      endDate: "2026-01-04",
      viewerUserId,
    }),
  ).toEqual({ "2026-01-01": 1, "2026-01-02": 1 });
  await getAggregatedLibraryStatistics({ serverId, userId: viewerUserId });
  await db
    .update(servers)
    .set({ excludedUserIds: [oldId] })
    .where(eq(servers.id, serverId));
  expect(
    (await getUserWatchStats({ serverId, userId: newId, viewerUserId }))
      .total_watch_time,
  ).toBe(30 * 3600);
  expect(
    Number(
      (await getUserHistory(serverId, oldId, { viewerUserId })).totalCount,
    ),
  ).toBe(1);
  expect(
    (
      await getWrappedData({
        serverId,
        userId: oldId,
        year: 2026,
        viewerUserId,
      })
    ).overview.totalWatchTimeSeconds,
  ).toBe(30 * 3600);
  expect(
    (await getUserTasteProfile(serverId, oldId, "Old", viewerUserId))
      .totalWatchTime,
  ).toBe(30 * 3600);
} finally {
  await db.delete(servers).where(eq(servers.id, serverId));
  await closeConnection();
}
