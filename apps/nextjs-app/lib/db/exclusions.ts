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
import type { AnyColumn } from "drizzle-orm";
import { and, eq, inArray, not, notInArray, type SQL, sql } from "drizzle-orm";

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
 * Get the library IDs a user is allowed to access, or null if unrestricted.
 * Returns null when the user has EnableAllFolders=true or is an admin.
 * Returns the intersection of user's enabledFolders minus server exclusions otherwise.
 */
async function getUserAllowedLibraryIds(
  serverId: number | string,
  userId: string,
): Promise<string[] | null> {
  const id = Number(serverId);

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.serverId, id)),
    columns: {
      enableAllFolders: true,
      enabledFolders: true,
      isAdministrator: true,
    },
  });

  if (!user || user.isAdministrator || user.enableAllFolders) {
    return null;
  }

  return user.enabledFolders ?? [];
}

/**
 * Build the library condition for rows of the 'items' table. An item can be in
 * several libraries while items.library_id only holds one of them, so it passes
 * when any of its libraries does. The others are in item_libraries, and an item
 * with nothing recorded there is judged by its own library alone.
 */
function buildItemLibraryCondition(
  buildLibraryCondition: (column: AnyColumn) => SQL | undefined,
): SQL | undefined {
  const ownLibrary = buildLibraryCondition(items.libraryId);
  const recordedLibrary = buildLibraryCondition(itemLibraries.libraryId);
  if (!ownLibrary || !recordedLibrary) {
    return undefined;
  }
  return sql`(${ownLibrary} OR EXISTS (SELECT 1 FROM ${itemLibraries} WHERE ${itemLibraries.serverId} = ${items.serverId} AND ${itemLibraries.itemId} = ${items.id} AND ${recordedLibrary}))`;
}

/**
 * Unified helper to get all exclusion filters for statistics queries.
 * When userId is provided and the user has folder restrictions, library filters
 * switch from blocklist (notInArray) to allowlist (inArray) mode.
 */
export async function getStatisticsExclusions(
  serverId: number | string,
  userId?: string,
) {
  const [settings, allowedLibraryIds] = await Promise.all([
    getExclusionSettings(serverId),
    userId ? getUserAllowedLibraryIds(serverId, userId) : Promise.resolve(null),
  ]);
  const { excludedUserIds, excludedLibraryIds } = settings;

  const hasUserExclusions = excludedUserIds.length > 0;

  // Remove server-excluded libraries from user's allowed set
  let effectiveAllowedIds: string[] | null = allowedLibraryIds;
  if (effectiveAllowedIds !== null && excludedLibraryIds.length > 0) {
    const excludedSet = new Set(excludedLibraryIds);
    effectiveAllowedIds = effectiveAllowedIds.filter(
      (id) => !excludedSet.has(id),
    );
  }

  const useAllowlist = effectiveAllowedIds !== null;
  const hasLibraryExclusions = useAllowlist || excludedLibraryIds.length > 0;

  // Build library condition for a given column, handling allowlist vs blocklist
  const buildLibraryCondition = (column: AnyColumn): SQL | undefined => {
    if (useAllowlist) {
      const ids = effectiveAllowedIds as string[];
      return ids.length > 0 ? inArray(column, ids) : sql`false`;
    }
    return excludedLibraryIds.length > 0
      ? notInArray(column, excludedLibraryIds)
      : undefined;
  };

  return {
    ...settings,

    // The effective allowed library IDs (null = no user restriction)
    allowedLibraryIds: effectiveAllowedIds,

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
    itemLibraryExclusion: buildItemLibraryCondition(buildLibraryCondition),

    // For 'users' table queries
    usersTableExclusion: hasUserExclusions
      ? notInArray(users.id, excludedUserIds)
      : undefined,

    // For 'libraries' table queries
    librariesTableExclusion: buildLibraryCondition(libraries.id),
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
 * This should be used when joining sessions with items.
 * Returns undefined if no libraries are excluded.
 */
export function buildLibraryExclusionCondition(
  excludedLibraryIds: string[],
): SQL | undefined {
  if (excludedLibraryIds.length === 0) {
    return undefined;
  }
  return buildItemLibraryCondition((column) =>
    notInArray(column, excludedLibraryIds),
  );
}

/**
 * Get item IDs that belong to excluded libraries only.
 * Useful when you need to filter sessions without joining items table.
 */
export async function getExcludedItemIds(
  serverId: number,
  excludedLibraryIds: string[],
): Promise<string[]> {
  const libraryCondition = buildLibraryExclusionCondition(excludedLibraryIds);
  if (!libraryCondition) {
    return [];
  }

  const excludedItems = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.serverId, serverId), not(libraryCondition)));

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
