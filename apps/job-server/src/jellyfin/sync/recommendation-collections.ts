import { and, eq } from "drizzle-orm";
import axios from "axios";
import {
  db,
  recommendationCollections,
  servers,
  users,
} from "@streamystats/database";
import { JellyfinClient } from "../client";
import { isRecord } from "../ratings-parse";
import {
  COLLECTION_SIZE,
  collectionName,
  collectionTagsFor,
  hideTagFor,
  membershipDiff,
  reconcileBlockedTags,
  sameTags,
  type CollectionUser,
} from "../recommendation-collections-plan";
import { getInternalUrl } from "../../utils/server-url";

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Recommended item ids for a user, from the web app (which owns the engine). */
async function fetchRecommendedIds(serverId: number, userId: string): Promise<string[]> {
  const nextjsUrl = process.env.NEXTJS_URL || "http://localhost:3000";
  const internalKey = process.env.INTERNAL_API_KEY || process.env.SESSION_SECRET;
  const response = await axios.post(
    `${nextjsUrl}/api/internal/recommendation-ids`,
    { serverId, userId, limit: COLLECTION_SIZE },
    {
      headers: internalKey ? { "x-internal-key": internalKey } : {},
      timeout: 120_000,
    }
  );
  return isRecord(response.data) ? stringArray(response.data.ids) : [];
}

/** Set every user's blocked tags: their own hide tag, or none when disabling. */
async function reconcileUserPolicies(
  client: JellyfinClient,
  enabled: boolean
): Promise<number> {
  let changed = 0;
  for (const user of await client.getUsersWithPolicy()) {
    const current = stringArray(user.Policy.BlockedTags);
    const ownTag = enabled ? hideTagFor({ id: user.Id, name: user.Name }) : null;
    const next = reconcileBlockedTags(current, ownTag);
    if (sameTags(current, next)) continue;
    await client.updateUserPolicy(user.Id, { ...user.Policy, BlockedTags: next });
    changed++;
  }
  return changed;
}

/** Name and tags on the collection itself; tags locked so refreshes keep them. */
async function applyCollectionMetadata(
  client: JellyfinClient,
  collectionId: string,
  name: string,
  tags: string[]
): Promise<void> {
  const dto = await client.getItemDto(collectionId);
  if (!dto) throw new Error(`Collection ${collectionId} disappeared`);
  const locked = new Set(stringArray(dto.LockedFields));
  const needsLock = !locked.has("Tags") || !locked.has("Name");
  if (dto.Name === name && sameTags(stringArray(dto.Tags), tags) && !needsLock) return;
  locked.add("Tags");
  locked.add("Name");
  await client.updateItem(collectionId, {
    ...dto,
    Name: name,
    Tags: tags,
    LockedFields: [...locked],
  });
}

async function removeCollection(
  client: JellyfinClient,
  serverId: number,
  userId: string,
  collectionId: string
): Promise<void> {
  await client.deleteItem(collectionId);
  await db
    .delete(recommendationCollections)
    .where(
      and(
        eq(recommendationCollections.serverId, serverId),
        eq(recommendationCollections.userId, userId)
      )
    );
}

/**
 * Keep one "AI Recommendations for <user>" collection per user in Jellyfin,
 * visible only to that user (see recommendation-collections-plan). When the
 * server setting is off, remove the collections and the hide tags instead.
 */
export async function syncRecommendationCollectionsForServer(serverId: number): Promise<{
  collections: number;
  removed: number;
  policiesChanged: number;
}> {
  const server = (
    await db.select().from(servers).where(eq(servers.id, serverId)).limit(1)
  )[0];
  if (!server) throw new Error(`Server not found: ${serverId}`);
  const client = new JellyfinClient({
    baseURL: getInternalUrl(server),
    apiKey: server.apiKey,
  });
  const enabled = server.recommendationCollectionsEnabled;

  const tracked = await db
    .select()
    .from(recommendationCollections)
    .where(eq(recommendationCollections.serverId, serverId));
  const trackedByUser = new Map(tracked.map((row) => [row.userId, row]));

  let removed = 0;
  if (!enabled) {
    // Never enabled (or already cleaned up): leave users' policies alone.
    if (tracked.length === 0) return { collections: 0, removed: 0, policiesChanged: 0 };
    for (const row of tracked) {
      await removeCollection(client, serverId, row.userId, row.collectionId);
      removed++;
    }
    const policiesChanged = await reconcileUserPolicies(client, false);
    return { collections: 0, removed, policiesChanged };
  }

  // Users block their own tag before any tagged collection exists or changes.
  const policiesChanged = await reconcileUserPolicies(client, true);

  const jellyfinUsers: CollectionUser[] = (await client.getUsersWithPolicy()).map(
    (user) => ({ id: user.Id, name: user.Name })
  );
  const jellyfinUserIds = new Set(jellyfinUsers.map((user) => user.id));
  const knownUserIds = new Set(
    (
      await db.select({ id: users.id }).from(users).where(eq(users.serverId, serverId))
    ).map((user) => user.id)
  );

  // Collections of users who no longer exist in Jellyfin.
  for (const row of tracked) {
    if (!jellyfinUserIds.has(row.userId)) {
      await removeCollection(client, serverId, row.userId, row.collectionId);
      removed++;
    }
  }

  let collections = 0;
  for (const user of jellyfinUsers) {
    const row = trackedByUser.get(user.id);
    const ids = knownUserIds.has(user.id)
      ? await fetchRecommendedIds(serverId, user.id)
      : [];
    if (ids.length === 0) {
      if (row) {
        await removeCollection(client, serverId, user.id, row.collectionId);
        removed++;
      }
      continue;
    }

    const name = collectionName(user);
    const tags = collectionTagsFor(user, jellyfinUsers);
    let collectionId =
      row && (await client.getItemDto(row.collectionId)) ? row.collectionId : null;

    if (!collectionId) {
      // Created empty and hidden before anything goes in.
      collectionId = await client.createCollection(name);
      await applyCollectionMetadata(client, collectionId, name, tags);
      await db
        .insert(recommendationCollections)
        .values({ serverId, userId: user.id, collectionId })
        .onConflictDoUpdate({
          target: [recommendationCollections.serverId, recommendationCollections.userId],
          set: { collectionId, updatedAt: new Date() },
        });
    } else {
      await applyCollectionMetadata(client, collectionId, name, tags);
      await db
        .update(recommendationCollections)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(recommendationCollections.serverId, serverId),
            eq(recommendationCollections.userId, user.id)
          )
        );
    }

    const { add, remove } = membershipDiff(
      await client.getCollectionMemberIds(collectionId),
      ids
    );
    await client.addToCollection(collectionId, add);
    await client.removeFromCollection(collectionId, remove);
    collections++;
  }

  return { collections, removed, policiesChanged };
}
