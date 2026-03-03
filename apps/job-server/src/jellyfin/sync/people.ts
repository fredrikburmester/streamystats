import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  items,
  libraries,
  servers,
  people,
  itemPeople,
} from "@streamystats/database";
import { JellyfinClient } from "../client";
import { formatSyncLogLine } from "./sync-log";
import { getInternalUrl } from "../../utils/server-url";

export interface PeopleSyncJobData {
  serverId: number;
}

interface PersonData {
  Id: string;
  Name: string;
  Type?: string;
  Role?: string;
  PrimaryImageTag?: string;
}

const LIBRARY_TYPES_WITH_PEOPLE = ["movies", "tvshows", "music"] as const;
const ITEM_IDS_PER_FETCH = 20;
const DB_BATCH_LIMIT = 500;
const DEFAULT_MAX_RUNTIME_MS = 14 * 60 * 1000;

/**
 * Sync people data from Jellyfin into the normalized people and item_people tables.
 * Finds items that don't have any item_people records and fetches their people data.
 */
export async function syncPeopleForServer(
  _jobId: string,
  data: PeopleSyncJobData,
  options?: { maxRuntimeMs?: number }
): Promise<{
  processed: number;
  remaining: number;
}> {
  const { serverId } = data;
  const { client, serverName } = await createClientForServerId(serverId);
  const startTime = Date.now();
  const maxRuntimeMs = options?.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS;

  let processed = 0;
  let errors = 0;
  let page = 0;

  console.info(
    formatSyncLogLine("people-sync", {
      server: serverName,
      page: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      processMs: 0,
      totalProcessed: 0,
      serverId,
      maxRuntimeMs,
    })
  );

  while (Date.now() - startTime < maxRuntimeMs) {
    // Find items that haven't been processed for people sync yet
    const candidates = await db
      .select({ id: items.id })
      .from(items)
      .innerJoin(libraries, eq(items.libraryId, libraries.id))
      .where(
        and(
          eq(items.serverId, serverId),
          inArray(libraries.type, [...LIBRARY_TYPES_WITH_PEOPLE]),
          eq(items.peopleSynced, false)
        )
      )
      .limit(DB_BATCH_LIMIT);

    if (candidates.length === 0) {
      break;
    }

    const ids = candidates.map((c) => c.id);

    for (let i = 0; i < ids.length; i += ITEM_IDS_PER_FETCH) {
      if (Date.now() - startTime >= maxRuntimeMs) {
        break;
      }

      const chunk = ids.slice(i, i + ITEM_IDS_PER_FETCH);
      page += 1;
      const chunkStart = Date.now();

      try {
        const peopleDtos = await client.getItemsPeople(chunk);

        const byId = new Map(
          peopleDtos.map((d) => [d.Id, (d.People ?? []) as PersonData[]])
        );

        let insertedPeople = 0;
        let insertedLinks = 0;

        for (const itemId of chunk) {
          const peopleData = byId.get(itemId) ?? [];
          const result = await syncPeopleToTables(serverId, itemId, peopleData);
          insertedPeople += result.insertedPeople;
          insertedLinks += result.insertedLinks;
        }

        // Mark items as processed for people sync and trigger embeddings regeneration
        await db
          .update(items)
          .set({ processed: false, peopleSynced: true, updatedAt: new Date() })
          .where(
            and(eq(items.serverId, serverId), inArray(items.id, chunk))
          );

        processed += chunk.length;

        console.info(
          formatSyncLogLine("people-sync", {
            server: serverName,
            page,
            processed: chunk.length,
            inserted: insertedLinks,
            updated: insertedPeople,
            errors: 0,
            processMs: Date.now() - chunkStart,
            totalProcessed: processed,
            serverId,
          })
        );
      } catch (error) {
        errors += 1;
        console.error(
          formatSyncLogLine("people-sync", {
            server: serverName,
            page,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 1,
            processMs: Date.now() - chunkStart,
            totalProcessed: processed,
            serverId,
            message: "Error syncing people for items chunk",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        );
      }
    }
  }

  // Count remaining items that need people synced
  const remainingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .innerJoin(libraries, eq(items.libraryId, libraries.id))
    .where(
      and(
        eq(items.serverId, serverId),
        inArray(libraries.type, [...LIBRARY_TYPES_WITH_PEOPLE]),
        eq(items.peopleSynced, false)
      )
    );

  const remaining = Number(remainingCount[0]?.count ?? 0);

  console.info(
    formatSyncLogLine("people-sync", {
      server: serverName,
      page: -1,
      processed: 0,
      inserted: 0,
      updated: 0,
      errors,
      processMs: Date.now() - startTime,
      totalProcessed: processed,
      serverId,
      remaining,
    })
  );

  return { processed, remaining };
}

/**
 * Sync people data for a single item into the normalized tables.
 * Upserts people records and creates item_people junction records.
 */
async function syncPeopleToTables(
  serverId: number,
  itemId: string,
  peopleData: PersonData[]
): Promise<{ insertedPeople: number; insertedLinks: number }> {
  // Delete existing item_people for this item on this server (in case of resync)
  await db.delete(itemPeople).where(
    and(eq(itemPeople.itemId, itemId), eq(itemPeople.serverId, serverId))
  );

  if (!peopleData || peopleData.length === 0) {
    return { insertedPeople: 0, insertedLinks: 0 };
  }

  let insertedPeople = 0;
  let insertedLinks = 0;

  // Filter valid people entries
  const validPeople = peopleData.filter(
    (p) => p.Id && p.Name && p.Id.trim() !== "" && p.Name.trim() !== ""
  );

  // Upsert each person (type is stored per item-person relationship, not on person)
  for (const person of validPeople) {
    const result = await db
      .insert(people)
      .values({
        id: person.Id,
        serverId,
        name: person.Name,
        primaryImageTag: person.PrimaryImageTag ?? null,
      })
      .onConflictDoUpdate({
        target: [people.id, people.serverId],
        set: {
          name: person.Name,
          primaryImageTag: person.PrimaryImageTag ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: people.id });

    if (result.length > 0) {
      insertedPeople += 1;
    }
  }

  // Insert item_people junction records (type is stored here, per item-person relationship)
  const junctionRecords = validPeople.map((person, idx) => ({
    itemId,
    personId: person.Id,
    serverId,
    type: person.Type ?? "Unknown",
    role: person.Role ?? null,
    sortOrder: idx,
  }));

  if (junctionRecords.length > 0) {
    const insertResult = await db
      .insert(itemPeople)
      .values(junctionRecords)
      .onConflictDoNothing()
      .returning({ id: itemPeople.id });

    insertedLinks = insertResult.length;
  }

  return { insertedPeople, insertedLinks };
}

async function createClientForServerId(
  serverId: number
): Promise<{ client: JellyfinClient; serverName: string }> {
  const serverRows = await db
    .select({ url: servers.url, apiKey: servers.apiKey, name: servers.name })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  const server = serverRows[0];
  if (!server) {
    throw new Error(`Server not found: ${serverId}`);
  }

  return {
    client: new JellyfinClient({
      baseURL: getInternalUrl(server),
      apiKey: server.apiKey,
    }),
    serverName: server.name,
  };
}
