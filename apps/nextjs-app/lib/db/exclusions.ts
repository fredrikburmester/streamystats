import "server-only";

import {
  db,
  itemLibraries,
  items,
  libraries,
  servers,
  sessions,
  users,
} from "@streamystats/database";
import {
  and,
  eq,
  exists,
  inArray,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";

export interface ExclusionSettings {
  excludedUserIds: string[];
  excludedLibraryIds: string[];
}

/**
 * Get exclusion settings for a server.
 * Results are cached for performance.
 */
export async function getExclusionSettings(
  serverId: number | string,
): Promise<ExclusionSettings> {
  const id = Number(serverId);

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, id),
    columns: {
      excludedUserIds: true,
      excludedLibraryIds: true,
    },
  });

  return {
    excludedUserIds: server?.excludedUserIds ?? [],
    excludedLibraryIds: server?.excludedLibraryIds ?? [],
  };
}

/**
 * Unified helper to get all exclusion filters for statistics queries.
 * This should be the preferred way to handle exclusions in new code.
 *
 * @example
 * const { userExclusion, itemLibraryExclusion, requiresItemsJoin } = await getStatisticsExclusions(serverId);
 * const conditions = [eq(sessions.serverId, serverId), userExclusion];
 * if (requiresItemsJoin) {
 *   query.innerJoin(items, eq(sessions.itemId, items.id));
 *   conditions.push(itemLibraryExclusion);
 * }
 */
export async function getStatisticsExclusions(serverId: number | string) {
  const settings = await getExclusionSettings(serverId);
  const { excludedUserIds, excludedLibraryIds } = settings;

  const hasUserExclusions = excludedUserIds.length > 0;
  const hasLibraryExclusions = excludedLibraryIds.length > 0;

  return {
    ...settings,

    // Boolean flags for easy checking
    hasUserExclusions,
    hasLibraryExclusions,
    requiresItemsJoin: hasLibraryExclusions,

    // Pre-built SQL conditions for common tables

    // For 'sessions' table queries
    userExclusion: hasUserExclusions
      ? notInArray(sessions.userId, excludedUserIds)
      : undefined,

    // For queries involving 'items' table (either direct or joined)
    // Uses EXISTS to check if item has at least one library NOT in the excluded list.
    // This correctly handles items that exist in multiple libraries.
    itemLibraryExclusion: hasLibraryExclusions
      ? exists(
          db
            .select({ one: sql`1` })
            .from(itemLibraries)
            .where(
              and(
                eq(itemLibraries.itemId, items.id),
                notInArray(itemLibraries.libraryId, excludedLibraryIds),
              ),
            ),
        )
      : undefined,

    // For 'users' table queries
    usersTableExclusion: hasUserExclusions
      ? notInArray(users.id, excludedUserIds)
      : undefined,

    // For 'libraries' table queries
    librariesTableExclusion: hasLibraryExclusions
      ? notInArray(libraries.id, excludedLibraryIds)
      : undefined,
  };
}

/**
 * Build a SQL condition to exclude users from a sessions query.
 * Returns undefined if no users are excluded.
 */
export function buildUserExclusionCondition(
  excludedUserIds: string[],
): SQL | undefined {
  if (excludedUserIds.length === 0) {
    return undefined;
  }
  return notInArray(sessions.userId, excludedUserIds);
}

/**
 * Build a SQL condition to exclude items from excluded libraries.
 * Uses EXISTS subquery on item_libraries to handle items in multiple libraries.
 * Returns undefined if no libraries are excluded.
 */
export function buildLibraryExclusionCondition(
  excludedLibraryIds: string[],
): SQL | undefined {
  if (excludedLibraryIds.length === 0) {
    return undefined;
  }
  return exists(
    db
      .select({ one: sql`1` })
      .from(itemLibraries)
      .where(
        and(
          eq(itemLibraries.itemId, items.id),
          notInArray(itemLibraries.libraryId, excludedLibraryIds),
        ),
      ),
  );
}

/**
 * Get item IDs that exist ONLY in excluded libraries.
 * Items that also belong to a non-excluded library are kept.
 */
export async function getExcludedItemIds(
  serverId: number,
  excludedLibraryIds: string[],
): Promise<string[]> {
  if (excludedLibraryIds.length === 0) {
    return [];
  }

  // Find items that have at least one excluded library membership
  // but NO non-excluded library membership
  const excludedItems = await db
    .select({ id: items.id })
    .from(items)
    .where(
      and(
        eq(items.serverId, serverId),
        exists(
          db
            .select({ one: sql`1` })
            .from(itemLibraries)
            .where(
              and(
                eq(itemLibraries.itemId, items.id),
                inArray(itemLibraries.libraryId, excludedLibraryIds),
              ),
            ),
        ),
        sql`NOT ${exists(
          db
            .select({ one: sql`1` })
            .from(itemLibraries)
            .where(
              and(
                eq(itemLibraries.itemId, items.id),
                notInArray(itemLibraries.libraryId, excludedLibraryIds),
              ),
            ),
        )}`,
      ),
    );

  return excludedItems.map((item) => item.id);
}

/**
 * Helper to add exclusion conditions to an existing conditions array.
 * Modifies the array in place and returns it for chaining.
 */
export function addExclusionConditions(
  conditions: SQL[],
  exclusions: ExclusionSettings,
): SQL[] {
  const userCondition = buildUserExclusionCondition(exclusions.excludedUserIds);
  if (userCondition) {
    conditions.push(userCondition);
  }

  const libraryCondition = buildLibraryExclusionCondition(
    exclusions.excludedLibraryIds,
  );
  if (libraryCondition) {
    conditions.push(libraryCondition);
  }

  return conditions;
}
