import {
  db,
  itemPeople,
  items,
  people,
  sessions,
} from "@streamystats/database";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  isNotNull,
  type SQL,
  sum,
} from "drizzle-orm";
import { cacheLife } from "next/cache";
import { getStatisticsExclusions } from "./exclusions";

export interface PersonStats {
  id: string;
  name: string;
  primaryImageTag: string | null;
  type: "Actor" | "Director";
  totalWatchTime: number;
  totalPlayCount: number;
  itemCount: number;
}

export interface DirectorActorCombination {
  directorId: string;
  directorName: string;
  directorImageTag: string | null;
  actorId: string;
  actorName: string;
  actorImageTag: string | null;
  totalWatchTime: number;
  totalPlayCount: number;
  itemCount: number;
}

export type MediaTypeFilter = "all" | "Movie" | "Series";

export interface PersonLibraryStats {
  id: string;
  name: string;
  primaryImageTag: string | null;
  type: "Actor" | "Director";
  itemCount: number;
}

/**
 * Get top people (actors or directors) by library presence (number of items they appear in).
 * This is independent of watch history - just counts items in the library.
 */
export async function getTopPeopleByLibraryPresence(
  serverId: string | number,
  personType: "Actor" | "Director",
  mediaType: MediaTypeFilter,
  limit = 20,
): Promise<PersonLibraryStats[]> {
  "use cache";
  cacheLife("hours");

  const serverIdNum = Number(serverId);

  const { itemLibraryExclusion } = await getStatisticsExclusions(serverId);

  const results: PersonLibraryStats[] = [];

  // Query for Movies
  if (mediaType === "all" || mediaType === "Movie") {
    const movieConditions: SQL[] = [
      eq(items.serverId, serverIdNum),
      eq(items.type, "Movie"),
      eq(itemPeople.type, personType),
    ];

    if (itemLibraryExclusion) {
      movieConditions.push(itemLibraryExclusion);
    }

    const movieStats = await db
      .select({
        personId: people.id,
        personName: people.name,
        primaryImageTag: people.primaryImageTag,
        itemCount: countDistinct(items.id).as("itemCount"),
      })
      .from(items)
      .innerJoin(itemPeople, eq(items.id, itemPeople.itemId))
      .innerJoin(
        people,
        and(
          eq(itemPeople.personId, people.id),
          eq(itemPeople.serverId, people.serverId),
        ),
      )
      .where(and(...movieConditions))
      .groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
      .orderBy(desc(countDistinct(items.id)))
      .limit(limit);

    for (const stat of movieStats) {
      results.push({
        id: stat.personId,
        name: stat.personName,
        primaryImageTag: stat.primaryImageTag,
        type: personType,
        itemCount: Number(stat.itemCount),
      });
    }
  }

  // Query for Series
  if (mediaType === "all" || mediaType === "Series") {
    const seriesConditions: SQL[] = [
      eq(items.serverId, serverIdNum),
      eq(items.type, "Series"),
      eq(itemPeople.type, personType),
    ];

    if (itemLibraryExclusion) {
      seriesConditions.push(itemLibraryExclusion);
    }

    const seriesStats = await db
      .select({
        personId: people.id,
        personName: people.name,
        primaryImageTag: people.primaryImageTag,
        itemCount: countDistinct(items.id).as("itemCount"),
      })
      .from(items)
      .innerJoin(itemPeople, eq(items.id, itemPeople.itemId))
      .innerJoin(
        people,
        and(
          eq(itemPeople.personId, people.id),
          eq(itemPeople.serverId, people.serverId),
        ),
      )
      .where(and(...seriesConditions))
      .groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
      .orderBy(desc(countDistinct(items.id)))
      .limit(limit);

    for (const stat of seriesStats) {
      if (mediaType === "all") {
        const existing = results.find((r) => r.id === stat.personId);
        if (existing) {
          existing.itemCount += Number(stat.itemCount);
        } else {
          results.push({
            id: stat.personId,
            name: stat.personName,
            primaryImageTag: stat.primaryImageTag,
            type: personType,
            itemCount: Number(stat.itemCount),
          });
        }
      } else {
        results.push({
          id: stat.personId,
          name: stat.personName,
          primaryImageTag: stat.primaryImageTag,
          type: personType,
          itemCount: Number(stat.itemCount),
        });
      }
    }
  }

  // Sort by item count and limit
  results.sort((a, b) => b.itemCount - a.itemCount);
  return results.slice(0, limit);
}

/**
 * Get top people (actors or directors) by total watch time.
 *
 * For Movies: sessions → items (Movie) → item_people → people
 * For Series: sessions → items (Episode) → item_people (on seriesId) → people
 */
export async function getTopPeopleByWatchTime(
  serverId: string | number,
  personType: "Actor" | "Director",
  mediaType: MediaTypeFilter,
  limit = 20,
): Promise<PersonStats[]> {
  "use cache";
  cacheLife("hours");
  const serverIdNum = Number(serverId);

  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const results: PersonStats[] = [];

  // Query for Movies
  if (mediaType === "all" || mediaType === "Movie") {
    const movieConditions: SQL[] = [
      eq(sessions.serverId, serverIdNum),
      isNotNull(sessions.itemId),
      eq(items.type, "Movie"),
      eq(itemPeople.type, personType),
    ];

    if (userExclusion) {
      movieConditions.push(userExclusion);
    }
    if (itemLibraryExclusion) {
      movieConditions.push(itemLibraryExclusion);
    }

    const movieStats = await db
      .select({
        personId: people.id,
        personName: people.name,
        primaryImageTag: people.primaryImageTag,
        totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
        totalPlayCount: count(sessions.id).as("totalPlayCount"),
        itemCount: countDistinct(items.id).as("itemCount"),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .innerJoin(itemPeople, eq(items.id, itemPeople.itemId))
      .innerJoin(
        people,
        and(
          eq(itemPeople.personId, people.id),
          eq(itemPeople.serverId, people.serverId),
        ),
      )
      .where(and(...movieConditions))
      .groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
      .orderBy(desc(sum(sessions.playDuration)))
      .limit(limit);

    for (const stat of movieStats) {
      results.push({
        id: stat.personId,
        name: stat.personName,
        primaryImageTag: stat.primaryImageTag,
        type: personType,
        totalWatchTime: Number(stat.totalWatchTime ?? 0),
        totalPlayCount: Number(stat.totalPlayCount),
        itemCount: Number(stat.itemCount),
      });
    }
  }

  // Query for Series (aggregate from episodes)
  if (mediaType === "all" || mediaType === "Series") {
    const seriesConditions: SQL[] = [
      eq(sessions.serverId, serverIdNum),
      isNotNull(sessions.itemId),
      eq(items.type, "Episode"),
      isNotNull(items.seriesId),
      eq(itemPeople.type, personType),
    ];

    if (userExclusion) {
      seriesConditions.push(userExclusion);
    }
    if (itemLibraryExclusion) {
      seriesConditions.push(itemLibraryExclusion);
    }

    // For series: join item_people on the seriesId (cast is on Series, not Episode)
    const seriesStats = await db
      .select({
        personId: people.id,
        personName: people.name,
        primaryImageTag: people.primaryImageTag,
        totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
        totalPlayCount: count(sessions.id).as("totalPlayCount"),
        itemCount: countDistinct(items.seriesId).as("itemCount"),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .innerJoin(itemPeople, eq(items.seriesId, itemPeople.itemId))
      .innerJoin(
        people,
        and(
          eq(itemPeople.personId, people.id),
          eq(itemPeople.serverId, people.serverId),
        ),
      )
      .where(and(...seriesConditions))
      .groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
      .orderBy(desc(sum(sessions.playDuration)))
      .limit(limit);

    for (const stat of seriesStats) {
      // If mediaType is "all", merge with movie stats
      if (mediaType === "all") {
        const existing = results.find((r) => r.id === stat.personId);
        if (existing) {
          existing.totalWatchTime += Number(stat.totalWatchTime ?? 0);
          existing.totalPlayCount += Number(stat.totalPlayCount);
          existing.itemCount += Number(stat.itemCount);
        } else {
          results.push({
            id: stat.personId,
            name: stat.personName,
            primaryImageTag: stat.primaryImageTag,
            type: personType,
            totalWatchTime: Number(stat.totalWatchTime ?? 0),
            totalPlayCount: Number(stat.totalPlayCount),
            itemCount: Number(stat.itemCount),
          });
        }
      } else {
        results.push({
          id: stat.personId,
          name: stat.personName,
          primaryImageTag: stat.primaryImageTag,
          type: personType,
          totalWatchTime: Number(stat.totalWatchTime ?? 0),
          totalPlayCount: Number(stat.totalPlayCount),
          itemCount: Number(stat.itemCount),
        });
      }
    }
  }

  // Sort by watch time and limit
  results.sort((a, b) => b.totalWatchTime - a.totalWatchTime);
  return results.slice(0, limit);
}

/**
 * Get top people (actors or directors) by play count or title count.
 */
export type PlayCountSortBy = "playCount" | "titleCount";

export async function getTopPeopleByPlayCount(
  serverId: string | number,
  personType: "Actor" | "Director",
  mediaType: MediaTypeFilter,
  limit = 20,
  sortBy: PlayCountSortBy = "titleCount",
): Promise<PersonStats[]> {
  "use cache";
  cacheLife("hours");

  const serverIdNum = Number(serverId);

  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const results: PersonStats[] = [];

  // Query for Movies
  if (mediaType === "all" || mediaType === "Movie") {
    const movieConditions: SQL[] = [
      eq(sessions.serverId, serverIdNum),
      isNotNull(sessions.itemId),
      eq(items.type, "Movie"),
      eq(itemPeople.type, personType),
    ];

    if (userExclusion) {
      movieConditions.push(userExclusion);
    }
    if (itemLibraryExclusion) {
      movieConditions.push(itemLibraryExclusion);
    }

    const movieStats = await db
      .select({
        personId: people.id,
        personName: people.name,
        primaryImageTag: people.primaryImageTag,
        totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
        totalPlayCount: count(sessions.id).as("totalPlayCount"),
        itemCount: countDistinct(items.id).as("itemCount"),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .innerJoin(itemPeople, eq(items.id, itemPeople.itemId))
      .innerJoin(
        people,
        and(
          eq(itemPeople.personId, people.id),
          eq(itemPeople.serverId, people.serverId),
        ),
      )
      .where(and(...movieConditions))
      .groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
      .orderBy(
        ...(sortBy === "titleCount"
          ? [desc(countDistinct(items.id)), desc(count(sessions.id))]
          : [desc(count(sessions.id))]),
      )
      .limit(limit);

    for (const stat of movieStats) {
      results.push({
        id: stat.personId,
        name: stat.personName,
        primaryImageTag: stat.primaryImageTag,
        type: personType,
        totalWatchTime: Number(stat.totalWatchTime ?? 0),
        totalPlayCount: Number(stat.totalPlayCount),
        itemCount: Number(stat.itemCount),
      });
    }
  }

  // Query for Series
  if (mediaType === "all" || mediaType === "Series") {
    const seriesConditions: SQL[] = [
      eq(sessions.serverId, serverIdNum),
      isNotNull(sessions.itemId),
      eq(items.type, "Episode"),
      isNotNull(items.seriesId),
      eq(itemPeople.type, personType),
    ];

    if (userExclusion) {
      seriesConditions.push(userExclusion);
    }
    if (itemLibraryExclusion) {
      seriesConditions.push(itemLibraryExclusion);
    }

    const seriesStats = await db
      .select({
        personId: people.id,
        personName: people.name,
        primaryImageTag: people.primaryImageTag,
        totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
        totalPlayCount: count(sessions.id).as("totalPlayCount"),
        itemCount: countDistinct(items.seriesId).as("itemCount"),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .innerJoin(itemPeople, eq(items.seriesId, itemPeople.itemId))
      .innerJoin(
        people,
        and(
          eq(itemPeople.personId, people.id),
          eq(itemPeople.serverId, people.serverId),
        ),
      )
      .where(and(...seriesConditions))
      .groupBy(people.id, people.name, people.primaryImageTag, people.serverId)
      .orderBy(
        ...(sortBy === "titleCount"
          ? [desc(countDistinct(items.seriesId)), desc(count(sessions.id))]
          : [desc(count(sessions.id))]),
      )
      .limit(limit);

    for (const stat of seriesStats) {
      if (mediaType === "all") {
        const existing = results.find((r) => r.id === stat.personId);
        if (existing) {
          existing.totalWatchTime += Number(stat.totalWatchTime ?? 0);
          existing.totalPlayCount += Number(stat.totalPlayCount);
          existing.itemCount += Number(stat.itemCount);
        } else {
          results.push({
            id: stat.personId,
            name: stat.personName,
            primaryImageTag: stat.primaryImageTag,
            type: personType,
            totalWatchTime: Number(stat.totalWatchTime ?? 0),
            totalPlayCount: Number(stat.totalPlayCount),
            itemCount: Number(stat.itemCount),
          });
        }
      } else {
        results.push({
          id: stat.personId,
          name: stat.personName,
          primaryImageTag: stat.primaryImageTag,
          type: personType,
          totalWatchTime: Number(stat.totalWatchTime ?? 0),
          totalPlayCount: Number(stat.totalPlayCount),
          itemCount: Number(stat.itemCount),
        });
      }
    }
  }

  // Sort by the selected field and limit
  if (sortBy === "titleCount") {
    results.sort((a, b) => b.itemCount - a.itemCount);
  } else {
    results.sort((a, b) => b.totalPlayCount - a.totalPlayCount);
  }
  return results.slice(0, limit);
}

/**
 * Get top director + actor combinations by watch time.
 * Finds items where both a director and actor are credited, then aggregates.
 */
export async function getTopDirectorActorCombinations(
  serverId: string | number,
  mediaType: MediaTypeFilter,
  limit = 15,
): Promise<DirectorActorCombination[]> {
  "use cache";
  cacheLife("hours");

  const serverIdNum = Number(serverId);

  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  // Create aliases for the self-join
  const directors = db
    .select({
      itemId: itemPeople.itemId,
      personId: itemPeople.personId,
    })
    .from(itemPeople)
    .where(
      and(
        eq(itemPeople.serverId, serverIdNum),
        eq(itemPeople.type, "Director"),
      ),
    )
    .as("directors");

  const actors = db
    .select({
      itemId: itemPeople.itemId,
      personId: itemPeople.personId,
    })
    .from(itemPeople)
    .where(
      and(eq(itemPeople.serverId, serverIdNum), eq(itemPeople.type, "Actor")),
    )
    .as("actors");

  const directorPeople = db
    .select({
      id: people.id,
      name: people.name,
      primaryImageTag: people.primaryImageTag,
      serverId: people.serverId,
    })
    .from(people)
    .where(eq(people.serverId, serverIdNum))
    .as("directorPeople");

  const actorPeople = db
    .select({
      id: people.id,
      name: people.name,
      primaryImageTag: people.primaryImageTag,
      serverId: people.serverId,
    })
    .from(people)
    .where(eq(people.serverId, serverIdNum))
    .as("actorPeople");

  const results: DirectorActorCombination[] = [];

  // Query for Movies
  if (mediaType === "all" || mediaType === "Movie") {
    const movieConditions: SQL[] = [
      eq(sessions.serverId, serverIdNum),
      isNotNull(sessions.itemId),
      eq(items.type, "Movie"),
    ];

    if (userExclusion) {
      movieConditions.push(userExclusion);
    }
    if (itemLibraryExclusion) {
      movieConditions.push(itemLibraryExclusion);
    }

    const movieCombos = await db
      .select({
        directorId: directors.personId,
        directorName: directorPeople.name,
        directorImageTag: directorPeople.primaryImageTag,
        actorId: actors.personId,
        actorName: actorPeople.name,
        actorImageTag: actorPeople.primaryImageTag,
        totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
        totalPlayCount: count(sessions.id).as("totalPlayCount"),
        itemCount: countDistinct(items.id).as("itemCount"),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .innerJoin(directors, eq(items.id, directors.itemId))
      .innerJoin(actors, eq(items.id, actors.itemId))
      .innerJoin(directorPeople, eq(directors.personId, directorPeople.id))
      .innerJoin(actorPeople, eq(actors.personId, actorPeople.id))
      .where(and(...movieConditions))
      .groupBy(
        directors.personId,
        directorPeople.name,
        directorPeople.primaryImageTag,
        actors.personId,
        actorPeople.name,
        actorPeople.primaryImageTag,
      )
      .orderBy(desc(sum(sessions.playDuration)))
      .limit(limit);

    for (const combo of movieCombos) {
      results.push({
        directorId: combo.directorId,
        directorName: combo.directorName,
        directorImageTag: combo.directorImageTag,
        actorId: combo.actorId,
        actorName: combo.actorName,
        actorImageTag: combo.actorImageTag,
        totalWatchTime: Number(combo.totalWatchTime ?? 0),
        totalPlayCount: Number(combo.totalPlayCount),
        itemCount: Number(combo.itemCount),
      });
    }
  }

  // Query for Series
  if (mediaType === "all" || mediaType === "Series") {
    const seriesConditions: SQL[] = [
      eq(sessions.serverId, serverIdNum),
      isNotNull(sessions.itemId),
      eq(items.type, "Episode"),
      isNotNull(items.seriesId),
    ];

    if (userExclusion) {
      seriesConditions.push(userExclusion);
    }
    if (itemLibraryExclusion) {
      seriesConditions.push(itemLibraryExclusion);
    }

    // For series, join on seriesId
    const seriesDirectors = db
      .select({
        itemId: itemPeople.itemId,
        personId: itemPeople.personId,
      })
      .from(itemPeople)
      .where(
        and(
          eq(itemPeople.serverId, serverIdNum),
          eq(itemPeople.type, "Director"),
        ),
      )
      .as("seriesDirectors");

    const seriesActors = db
      .select({
        itemId: itemPeople.itemId,
        personId: itemPeople.personId,
      })
      .from(itemPeople)
      .where(
        and(eq(itemPeople.serverId, serverIdNum), eq(itemPeople.type, "Actor")),
      )
      .as("seriesActors");

    const seriesCombos = await db
      .select({
        directorId: seriesDirectors.personId,
        directorName: directorPeople.name,
        directorImageTag: directorPeople.primaryImageTag,
        actorId: seriesActors.personId,
        actorName: actorPeople.name,
        actorImageTag: actorPeople.primaryImageTag,
        totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
        totalPlayCount: count(sessions.id).as("totalPlayCount"),
        itemCount: countDistinct(items.seriesId).as("itemCount"),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .innerJoin(seriesDirectors, eq(items.seriesId, seriesDirectors.itemId))
      .innerJoin(seriesActors, eq(items.seriesId, seriesActors.itemId))
      .innerJoin(
        directorPeople,
        eq(seriesDirectors.personId, directorPeople.id),
      )
      .innerJoin(actorPeople, eq(seriesActors.personId, actorPeople.id))
      .where(and(...seriesConditions))
      .groupBy(
        seriesDirectors.personId,
        directorPeople.name,
        directorPeople.primaryImageTag,
        seriesActors.personId,
        actorPeople.name,
        actorPeople.primaryImageTag,
      )
      .orderBy(desc(sum(sessions.playDuration)))
      .limit(limit);

    for (const combo of seriesCombos) {
      if (mediaType === "all") {
        // Merge with existing results
        const existing = results.find(
          (r) =>
            r.directorId === combo.directorId && r.actorId === combo.actorId,
        );
        if (existing) {
          existing.totalWatchTime += Number(combo.totalWatchTime ?? 0);
          existing.totalPlayCount += Number(combo.totalPlayCount);
          existing.itemCount += Number(combo.itemCount);
        } else {
          results.push({
            directorId: combo.directorId,
            directorName: combo.directorName,
            directorImageTag: combo.directorImageTag,
            actorId: combo.actorId,
            actorName: combo.actorName,
            actorImageTag: combo.actorImageTag,
            totalWatchTime: Number(combo.totalWatchTime ?? 0),
            totalPlayCount: Number(combo.totalPlayCount),
            itemCount: Number(combo.itemCount),
          });
        }
      } else {
        results.push({
          directorId: combo.directorId,
          directorName: combo.directorName,
          directorImageTag: combo.directorImageTag,
          actorId: combo.actorId,
          actorName: combo.actorName,
          actorImageTag: combo.actorImageTag,
          totalWatchTime: Number(combo.totalWatchTime ?? 0),
          totalPlayCount: Number(combo.totalPlayCount),
          itemCount: Number(combo.itemCount),
        });
      }
    }
  }

  // Sort by watch time and limit
  results.sort((a, b) => b.totalWatchTime - a.totalWatchTime);
  return results.slice(0, limit);
}
