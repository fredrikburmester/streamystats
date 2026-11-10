import { and, eq, inArray, sql } from "drizzle-orm";
import { db, itemLibraries, items } from "@streamystats/database";

const BATCH_SIZE = 1000;

/**
 * Records that a library lists these items. Jellyfin lists an item under one
 * ID in every library that has its folder, so the same item can come in from
 * several libraries. Reads from the items table so that an item whose own
 * sync failed, and has no row yet, is left for the next run.
 */
export async function recordItemLibrary({
  serverId,
  libraryId,
  itemIds,
}: {
  serverId: number;
  libraryId: string;
  itemIds: string[];
}): Promise<void> {
  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    await db
      .insert(itemLibraries)
      .select(
        db
          .select({
            serverId: items.serverId,
            itemId: items.id,
            libraryId: sql<string>`${libraryId}::text`.as("library_id"),
          })
          .from(items)
          .where(
            and(
              eq(items.serverId, serverId),
              inArray(items.id, itemIds.slice(i, i + BATCH_SIZE))
            )
          )
      )
      .onConflictDoNothing();
  }
}

/**
 * The items on record for a library that its full listing no longer has.
 */
export async function findUnlistedItemIds({
  serverId,
  libraryId,
  listedItemIds,
}: {
  serverId: number;
  libraryId: string;
  listedItemIds: string[];
}): Promise<string[]> {
  const listed = new Set(listedItemIds);
  const recorded = await db
    .select({ itemId: itemLibraries.itemId })
    .from(itemLibraries)
    .where(
      and(
        eq(itemLibraries.serverId, serverId),
        eq(itemLibraries.libraryId, libraryId)
      )
    );
  return recorded
    .map((row) => row.itemId)
    .filter((itemId) => !listed.has(itemId));
}

/**
 * Takes items out of a library they have left for another one. An item stored
 * under the library it left is stored under the other one from here on.
 */
export async function removeItemLibrary({
  serverId,
  libraryId,
  remainingLibraryId,
  itemIds,
}: {
  serverId: number;
  libraryId: string;
  remainingLibraryId: string;
  itemIds: string[];
}): Promise<void> {
  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    const batch = itemIds.slice(i, i + BATCH_SIZE);
    await db.transaction(async (tx) => {
      await tx
        .update(items)
        .set({ libraryId: remainingLibraryId })
        .where(
          and(
            eq(items.serverId, serverId),
            eq(items.libraryId, libraryId),
            inArray(items.id, batch)
          )
        );
      await tx
        .delete(itemLibraries)
        .where(
          and(
            eq(itemLibraries.serverId, serverId),
            eq(itemLibraries.libraryId, libraryId),
            inArray(itemLibraries.itemId, batch)
          )
        );
    });
  }
}
