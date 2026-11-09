import "server-only";
import {
  db,
  itemPeople,
  items,
  people,
  sessions,
} from "@streamystats/database";
import { and, count, eq, isNotNull, sql, sum } from "drizzle-orm";
import type { ActorDetailsResponse, ActorItem } from "./actor-types";
import { getStatisticsExclusions } from "./exclusions";

export type {
  ActorDetailsResponse,
  ActorItem,
  ActorStats,
  PersonFromDb,
} from "./actor-types";
export {
  getItemCast,
  getItemDirectors,
  getItemPeopleGrouped,
  getItemWriters,
} from "./actor-types";

/**
 * Get actor/person details with all items they appear in and statistics
 * Uses the normalized people and item_people tables for fast lookups
 */
export const getActorDetails = async ({
  serverId,
  actorId,
}: {
  serverId: number;
  actorId: string;
}): Promise<ActorDetailsResponse | null> => {
  // Get exclusion settings
  const exclusions = await getStatisticsExclusions(serverId);

  // Get the person info from the people table
  const personResult = await db
    .select()
    .from(people)
    .where(and(eq(people.id, actorId), eq(people.serverId, serverId)))
    .limit(1);

  if (personResult.length === 0) {
    return null;
  }

  const personInfo = personResult[0];

  // Get all items for this person via the junction table
  // type is stored per item-person relationship, so we select it here
  const itemsWithRoles = await db
    .select({
      item: items,
      role: itemPeople.role,
      type: itemPeople.type,
    })
    .from(itemPeople)
    .innerJoin(
      items,
      and(
        eq(itemPeople.itemId, items.id),
        eq(itemPeople.serverId, items.serverId),
      ),
    )
    .where(
      and(
        eq(itemPeople.personId, actorId),
        eq(itemPeople.serverId, serverId),
        sql`${items.deletedAt} IS NULL`,
      ),
    )
    .orderBy(itemPeople.sortOrder);

  if (itemsWithRoles.length === 0) {
    return null;
  }

  // Get statistics for each item
  const itemsWithStats: ActorItem[] = await Promise.all(
    itemsWithRoles.map(async ({ item, role }) => {
      // Get stats for this item - handle both Movies and Series
      let itemIdsToQuery: string[] = [item.id];

      if (item.type === "Series") {
        // Get all episode IDs for this series
        const episodes = await db
          .select({ id: items.id })
          .from(items)
          .where(
            and(
              eq(items.serverId, serverId),
              eq(items.type, "Episode"),
              eq(items.seriesId, item.id),
            ),
          );
        itemIdsToQuery = episodes.map((ep) => ep.id);
        if (itemIdsToQuery.length === 0) {
          return {
            item,
            role: role ?? undefined,
            totalViews: 0,
            totalWatchTime: 0,
          };
        }
      }

      // Build where conditions
      const whereConditions = [
        eq(sessions.serverId, serverId),
        sql`${sessions.itemId} IN (${sql.join(
          itemIdsToQuery.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        isNotNull(sessions.playDuration),
      ];

      // Add user exclusion filter
      if (exclusions.userExclusion) {
        whereConditions.push(exclusions.userExclusion);
      }

      const stats = await db
        .select({
          totalViews: count(sessions.id),
          totalWatchTime: sum(sessions.playDuration),
        })
        .from(sessions)
        .where(and(...whereConditions));

      return {
        item,
        role: role ?? undefined,
        totalViews: stats[0]?.totalViews ?? 0,
        totalWatchTime: Number(stats[0]?.totalWatchTime ?? 0),
      };
    }),
  );

  // Sort by total watch time descending
  itemsWithStats.sort((a, b) => b.totalWatchTime - a.totalWatchTime);

  // Calculate totals
  const totalViews = itemsWithStats.reduce((acc, i) => acc + i.totalViews, 0);
  const totalWatchTime = itemsWithStats.reduce(
    (acc, i) => acc + i.totalWatchTime,
    0,
  );

  // Get the most common type for this person across all their items
  // (since type is per item-person relationship now)
  const typeCounts = new Map<string, number>();
  for (const { type } of itemsWithRoles) {
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  let primaryType = "Unknown";
  let maxCount = 0;
  for (const [type, typeCount] of typeCounts) {
    if (typeCount > maxCount) {
      maxCount = typeCount;
      primaryType = type;
    }
  }

  return {
    id: personInfo.id,
    name: personInfo.name,
    type: primaryType,
    primaryImageTag: personInfo.primaryImageTag ?? undefined,
    totalItems: itemsWithStats.length,
    totalViews,
    totalWatchTime,
    items: itemsWithStats,
  };
};
