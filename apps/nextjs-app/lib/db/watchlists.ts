import "server-only";
import {
  db,
  type Item,
  items,
  type NewWatchlist,
  type Watchlist,
  type WatchlistItem,
  watchlistItems,
  watchlists,
} from "@streamystats/database";
import { and, asc, count, desc, eq, or, type SQL, sql } from "drizzle-orm";

export type SortOrder = "custom" | "name" | "dateAdded" | "releaseDate";

export interface WatchlistWithItemCount extends Watchlist {
  itemCount: number;
}

export interface WatchlistWithItems extends Watchlist {
  items: WatchlistItemWithDetails[];
}

export interface WatchlistItemWithDetails extends WatchlistItem {
  item: Item;
}

export type WatchlistListItem = Pick<
  Item,
  | "id"
  | "name"
  | "type"
  | "productionYear"
  | "runtimeTicks"
  | "genres"
  | "primaryImageTag"
  | "primaryImageThumbTag"
  | "primaryImageLogoTag"
  | "backdropImageTags"
  | "seriesId"
  | "seriesPrimaryImageTag"
  | "parentBackdropItemId"
  | "parentBackdropImageTags"
  | "parentThumbItemId"
  | "parentThumbImageTag"
  | "imageBlurHashes"
  | "seriesName"
  | "seasonName"
  | "indexNumber"
  | "parentIndexNumber"
  | "premiereDate"
  | "communityRating"
>;

export interface WatchlistItemWithListItem extends WatchlistItem {
  item: WatchlistListItem;
}

export interface WatchlistWithItemsLite extends Watchlist {
  items: WatchlistItemWithListItem[];
}

/**
 * Get all watchlists for a user (includes their own + public ones from others)
 */
export const getWatchlistsForUser = async ({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<WatchlistWithItemCount[]> => {
  const result = await db
    .select({
      watchlist: watchlists,
      itemCount: count(watchlistItems.id),
    })
    .from(watchlists)
    .leftJoin(watchlistItems, eq(watchlists.id, watchlistItems.watchlistId))
    .where(
      and(
        eq(watchlists.serverId, serverId),
        or(eq(watchlists.userId, userId), eq(watchlists.isPublic, true)),
      ),
    )
    .groupBy(watchlists.id)
    .orderBy(desc(watchlists.createdAt));

  return result.map((r) => ({
    ...r.watchlist,
    itemCount: Number(r.itemCount),
  }));
};

/**
 * Get a single watchlist by ID
 */
export const getWatchlistById = async ({
  watchlistId,
  userId,
}: {
  watchlistId: number;
  userId: string;
}): Promise<Watchlist | null> => {
  const result = await db.query.watchlists.findFirst({
    where: and(
      eq(watchlists.id, watchlistId),
      or(eq(watchlists.userId, userId), eq(watchlists.isPublic, true)),
    ),
  });

  return result ?? null;
};

/**
 * Get a watchlist by name for a specific user
 */
export const getWatchlistByName = async ({
  serverId,
  userId,
  name,
  requestingUserId,
}: {
  serverId: number;
  userId: string;
  name: string;
  requestingUserId: string;
}): Promise<Watchlist | null> => {
  const result = await db.query.watchlists.findFirst({
    where: and(
      eq(watchlists.serverId, serverId),
      eq(watchlists.userId, userId),
      eq(watchlists.name, name),
      or(
        eq(watchlists.userId, requestingUserId),
        eq(watchlists.isPublic, true),
      ),
    ),
  });

  return result ?? null;
};

/**
 * Get watchlist with all its items
 */
export const getWatchlistWithItems = async ({
  watchlistId,
  userId,
  typeFilter,
  sortOrder,
}: {
  watchlistId: number;
  userId: string;
  typeFilter?: string;
  sortOrder?: SortOrder;
}): Promise<WatchlistWithItems | null> => {
  const watchlist = await getWatchlistById({ watchlistId, userId });

  if (!watchlist) {
    return null;
  }

  const effectiveSortOrder =
    sortOrder ?? (watchlist.defaultSortOrder as SortOrder);

  let orderByClause: SQL;
  switch (effectiveSortOrder) {
    case "name":
      orderByClause = asc(items.name);
      break;
    case "dateAdded":
      orderByClause = desc(watchlistItems.addedAt);
      break;
    case "releaseDate":
      orderByClause = desc(items.premiereDate);
      break;
    default:
      orderByClause = asc(watchlistItems.position);
      break;
  }

  const whereConditions = [eq(watchlistItems.watchlistId, watchlistId)];
  if (typeFilter) {
    whereConditions.push(eq(items.type, typeFilter));
  }

  const itemsResult = await db
    .select({
      watchlistItem: watchlistItems,
      item: items,
    })
    .from(watchlistItems)
    .innerJoin(items, eq(watchlistItems.itemId, items.id))
    .where(and(...whereConditions))
    .orderBy(orderByClause);

  return {
    ...watchlist,
    items: itemsResult.map((r) => ({
      ...r.watchlistItem,
      item: r.item,
    })),
  };
};

/**
 * Get watchlist with all its items (lightweight item payload safe for Client Components)
 */
export const getWatchlistWithItemsLite = async ({
  watchlistId,
  userId,
}: {
  watchlistId: number;
  userId: string;
}): Promise<WatchlistWithItemsLite | null> => {
  const watchlist = await getWatchlistById({ watchlistId, userId });

  if (!watchlist) {
    return null;
  }

  const itemsResult = await db
    .select({
      watchlistItem: watchlistItems,
      item: {
        id: items.id,
        name: items.name,
        type: items.type,
        productionYear: items.productionYear,
        runtimeTicks: items.runtimeTicks,
        genres: items.genres,
        primaryImageTag: items.primaryImageTag,
        primaryImageThumbTag: items.primaryImageThumbTag,
        primaryImageLogoTag: items.primaryImageLogoTag,
        backdropImageTags: items.backdropImageTags,
        seriesId: items.seriesId,
        seriesPrimaryImageTag: items.seriesPrimaryImageTag,
        parentBackdropItemId: items.parentBackdropItemId,
        parentBackdropImageTags: items.parentBackdropImageTags,
        parentThumbItemId: items.parentThumbItemId,
        parentThumbImageTag: items.parentThumbImageTag,
        imageBlurHashes: items.imageBlurHashes,
        seriesName: items.seriesName,
        seasonName: items.seasonName,
        indexNumber: items.indexNumber,
        parentIndexNumber: items.parentIndexNumber,
        premiereDate: items.premiereDate,
        communityRating: items.communityRating,
      },
    })
    .from(watchlistItems)
    .innerJoin(items, eq(watchlistItems.itemId, items.id))
    .where(eq(watchlistItems.watchlistId, watchlistId))
    .orderBy(asc(watchlistItems.position));

  return {
    ...watchlist,
    items: itemsResult.map((r) => ({
      ...r.watchlistItem,
      item: r.item,
    })),
  };
};

/**
 * Get preview items for watchlist poster (first 4 items)
 */
export const getWatchlistPreviewItems = async ({
  watchlistId,
}: {
  watchlistId: number;
}): Promise<Item[]> => {
  const result = await db
    .select({ item: items })
    .from(watchlistItems)
    .innerJoin(items, eq(watchlistItems.itemId, items.id))
    .where(eq(watchlistItems.watchlistId, watchlistId))
    .orderBy(asc(watchlistItems.position))
    .limit(4);

  return result.map((r) => r.item);
};

/**
 * Create a new watchlist
 */
export const createWatchlist = async (
  data: Omit<NewWatchlist, "createdAt" | "updatedAt">,
): Promise<Watchlist> => {
  const [result] = await db.insert(watchlists).values(data).returning();
  return result;
};

/**
 * Update a watchlist
 */
export const updateWatchlist = async ({
  watchlistId,
  userId,
  data,
}: {
  watchlistId: number;
  userId: string;
  data: Partial<
    Pick<
      Watchlist,
      | "name"
      | "description"
      | "isPublic"
      | "allowedItemType"
      | "defaultSortOrder"
    >
  >;
}): Promise<Watchlist | null> => {
  const [result] = await db
    .update(watchlists)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .returning();

  return result ?? null;
};

/**
 * Delete a watchlist
 */
export const deleteWatchlist = async ({
  watchlistId,
  userId,
}: {
  watchlistId: number;
  userId: string;
}): Promise<boolean> => {
  const result = await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .returning();

  return result.length > 0;
};

/**
 * Add an item to a watchlist
 */
export const addItemToWatchlist = async ({
  watchlistId,
  itemId,
  userId,
}: {
  watchlistId: number;
  itemId: string;
  userId: string;
}): Promise<WatchlistItem | null> => {
  // Verify user owns the watchlist
  const watchlist = await db.query.watchlists.findFirst({
    where: and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)),
  });

  if (!watchlist) {
    return null;
  }

  // Check if item type is allowed (if type lock is set)
  if (watchlist.allowedItemType) {
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemId),
    });

    if (!item || item.type !== watchlist.allowedItemType) {
      return null;
    }
  }

  // Get max position
  const maxPositionResult = await db
    .select({
      maxPos: sql<number>`COALESCE(MAX(${watchlistItems.position}), -1)`,
    })
    .from(watchlistItems)
    .where(eq(watchlistItems.watchlistId, watchlistId));

  const nextPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;

  try {
    const [result] = await db
      .insert(watchlistItems)
      .values({
        watchlistId,
        itemId,
        position: nextPosition,
      })
      .returning();

    return result;
  } catch {
    // Item already exists in watchlist (unique constraint)
    return null;
  }
};

/**
 * Remove an item from a watchlist
 */
export const removeItemFromWatchlist = async ({
  watchlistId,
  itemId,
  userId,
}: {
  watchlistId: number;
  itemId: string;
  userId: string;
}): Promise<boolean> => {
  // Verify user owns the watchlist
  const watchlist = await db.query.watchlists.findFirst({
    where: and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)),
  });

  if (!watchlist) {
    return false;
  }

  const result = await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.watchlistId, watchlistId),
        eq(watchlistItems.itemId, itemId),
      ),
    )
    .returning();

  return result.length > 0;
};

/**
 * Reorder items in a watchlist
 */
export const reorderWatchlistItems = async ({
  watchlistId,
  userId,
  itemIds,
}: {
  watchlistId: number;
  userId: string;
  itemIds: string[];
}): Promise<boolean> => {
  // Verify user owns the watchlist
  const watchlist = await db.query.watchlists.findFirst({
    where: and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)),
  });

  if (!watchlist) {
    return false;
  }

  // Update positions for all items
  for (let i = 0; i < itemIds.length; i++) {
    await db
      .update(watchlistItems)
      .set({ position: i })
      .where(
        and(
          eq(watchlistItems.watchlistId, watchlistId),
          eq(watchlistItems.itemId, itemIds[i]),
        ),
      );
  }

  return true;
};

/**
 * Check if an item is in any of the user's watchlists
 */
export const getWatchlistsContainingItem = async ({
  serverId,
  userId,
  itemId,
}: {
  serverId: number;
  userId: string;
  itemId: string;
}): Promise<Watchlist[]> => {
  const result = await db
    .select({ watchlist: watchlists })
    .from(watchlists)
    .innerJoin(watchlistItems, eq(watchlists.id, watchlistItems.watchlistId))
    .where(
      and(
        eq(watchlists.serverId, serverId),
        eq(watchlists.userId, userId),
        eq(watchlistItems.itemId, itemId),
      ),
    );

  return result.map((r) => r.watchlist);
};

/**
 * Get user's own watchlists only (for adding items)
 */
export const getUserOwnWatchlists = async ({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<WatchlistWithItemCount[]> => {
  const result = await db
    .select({
      watchlist: watchlists,
      itemCount: count(watchlistItems.id),
    })
    .from(watchlists)
    .leftJoin(watchlistItems, eq(watchlists.id, watchlistItems.watchlistId))
    .where(
      and(eq(watchlists.serverId, serverId), eq(watchlists.userId, userId)),
    )
    .groupBy(watchlists.id)
    .orderBy(desc(watchlists.createdAt));

  return result.map((r) => ({
    ...r.watchlist,
    itemCount: Number(r.itemCount),
  }));
};
