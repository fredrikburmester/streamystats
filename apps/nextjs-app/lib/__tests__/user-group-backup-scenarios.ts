import { expect } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  changeUserGroup,
  closeConnection,
  db,
  getUserGroups,
  items,
  libraries,
  previewUserGroup,
  servers,
  sessions,
  users,
} from "@streamystats/database";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET } from "../../app/api/export/[serverId]/route";
import { POST } from "../../app/api/import/route";
import { getUserWatchStats } from "../db/users";

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a dedicated test database.");

const oldId = randomUUID();
const newId = randomUUID();
const movieId = randomUUID();
const libraryId = randomUUID();
const ownedServers: number[] = [];
async function createServer() {
  const [server] = await db
    .insert(servers)
    .values({
      name: "Backup fixture",
      url: `https://${randomUUID()}.invalid`,
      apiKey: "fixture",
    })
    .returning();
  ownedServers.push(server.id);
  return server.id;
}
async function syncedContent(serverId: number) {
  await db
    .insert(libraries)
    .values({ id: libraryId, serverId, name: "Movies", type: "Movie" });
  await db.insert(items).values({
    id: movieId,
    serverId,
    libraryId,
    name: "Movie",
    type: "Movie",
    isFolder: false,
    rawData: {},
  });
  await db.insert(users).values({
    id: newId,
    serverId,
    name: "Current",
    enableAllFolders: false,
    enabledFolders: [libraryId],
  });
}
try {
  const sourceId = await createServer();
  await syncedContent(sourceId);
  await db.insert(users).values({
    id: oldId,
    serverId: sourceId,
    name: "Historical",
    isAdministrator: true,
  });
  await db.insert(sessions).values(
    [oldId, newId].map((userId, i) => ({
      id: randomUUID(),
      serverId: sourceId,
      userId,
      userServerId: userId,
      userName: userId,
      itemId: movieId,
      startTime: new Date(`2026-01-0${i + 1}`),
      playDuration: (i ? 30 : 20) * 3600,
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
  const preview = await previewUserGroup({ serverId: sourceId, change });
  await changeUserGroup({
    serverId: sourceId,
    change,
    previewToken: preview.token,
    operationId: randomUUID(),
    actor: { id: oldId, name: "Historical" },
  });
  const exported = await GET(
    new NextRequest(`http://localhost/api/export/${sourceId}`),
    { params: Promise.resolve({ serverId: String(sourceId) }) },
  );
  expect(exported.status).toBe(200);
  const backup = await exported.text();
  await db.delete(servers).where(eq(servers.id, sourceId));

  // Fresh destination has only accounts/items returned by live Jellyfin sync.
  const destinationId = await createServer();
  await syncedContent(destinationId);
  for (let attempt = 0; attempt < 2; attempt++) {
    const form = new FormData();
    form.set("serverId", String(destinationId));
    form.set(
      "file",
      new File([backup], "backup.json", { type: "application/json" }),
    );
    const imported = await POST(
      new NextRequest("http://localhost/api/import", {
        method: "POST",
        body: form,
      }),
    );
    const result = await imported.json();
    expect(imported.status).toBe(200);
    expect(result.user_references_nullified).toBe(0);
    expect(result.error_count).toBe(0);
  }
  const [historical] = await db.select().from(users).where(eq(users.id, oldId));
  expect(historical.isDisabled).toBe(true);
  expect(historical.isAdministrator).toBe(false);
  expect(historical.enableAllFolders).toBe(false);
  const restored = await db
    .select()
    .from(sessions)
    .where(eq(sessions.serverId, destinationId));
  expect(restored).toHaveLength(2);
  expect(new Set(restored.map((s) => s.userId))).toEqual(
    new Set([oldId, newId]),
  );
  expect(await getUserGroups({ serverId: destinationId })).toHaveLength(1);
  expect(
    (
      await getUserWatchStats({
        serverId: destinationId,
        userId: newId,
        viewerUserId: newId,
      })
    ).total_watch_time,
  ).toBe(50 * 3600);
} finally {
  for (const serverId of ownedServers)
    await db.delete(servers).where(eq(servers.id, serverId));
  await closeConnection();
}
