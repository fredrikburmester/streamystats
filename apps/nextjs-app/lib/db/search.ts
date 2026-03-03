"use server";

import "server-only";

import {
  activities,
  db,
  items,
  sessions,
  users,
  watchlists,
} from "@streamystats/database";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

/**
 * Generic search result type that can represent any searchable entity
 */
export type SearchResult = {
  id: string;
  type: "item" | "user" | "watchlist" | "activity" | "session" | "actor";
  subtype?: string; // e.g., "Movie", "Series", "Episode" for items, "Actor", "Director" for actors
  title: string;
  subtitle?: string;
  imageId?: string;
  imageTag?: string;
  href: string;
  metadata?: Record<string, string>;
  rank?: number;
};

/**
 * Grouped search results by category
 */
export type SearchResults = {
  items: SearchResult[];
  users: SearchResult[];
  watchlists: SearchResult[];
  activities: SearchResult[];
  sessions: SearchResult[];
  actors: SearchResult[];
  total: number;
};

/**
 * Convert search query to tsquery format for PostgreSQL full-text search
 * Handles simple queries with plainto_tsquery for basic searches
 */
function buildTsQuery(query: string): string {
  // Clean and prepare the query
  const cleaned = query
    .trim()
    .replace(/[^\w\s]/g, " ")
    .trim();
  if (!cleaned) return "";

  // Use plainto_tsquery for simple text search (handles spaces automatically)
  return cleaned;
}

/**
 * Search items (movies, series, episodes, etc.)
 * Uses full-text search, ILIKE, and trigram similarity for fuzzy matching
 */
async function searchItems(
  serverId: number,
  query: string,
  limit: number = 10,
): Promise<SearchResult[]> {
  const searchQuery = buildTsQuery(query);
  if (!searchQuery) return [];

  // Use a CTE to set similarity threshold, then search with multiple strategies:
  // 1. Full-text search (uses GiST index on search_vector)
  // 2. ILIKE pattern match (uses GIN trigram index)
  // 3. word_similarity for fuzzy matching with typos (threshold 0.4)
  const results = await db.execute<{
    id: string;
    name: string;
    type: string;
    series_name: string | null;
    season_name: string | null;
    index_number: number | null;
    parent_index_number: number | null;
    production_year: number | null;
    primary_image_tag: string | null;
    series_primary_image_tag: string | null;
    series_id: string | null;
    rank: number;
  }>(sql`
    SELECT
      ${items.id} as id,
      ${items.name} as name,
      ${items.type} as type,
      ${items.seriesName} as series_name,
      ${items.seasonName} as season_name,
      ${items.indexNumber} as index_number,
      ${items.parentIndexNumber} as parent_index_number,
      ${items.productionYear} as production_year,
      ${items.primaryImageTag} as primary_image_tag,
      ${items.seriesPrimaryImageTag} as series_primary_image_tag,
      ${items.seriesId} as series_id,
      GREATEST(
        CASE
          WHEN search_vector IS NOT NULL
          THEN ts_rank_cd(search_vector, plainto_tsquery('english', ${searchQuery}))
          ELSE 0
        END,
        word_similarity(${query}, ${items.name}),
        COALESCE(word_similarity(${query}, ${items.seriesName}), 0) * 0.6
      )
      * CASE ${items.type}
          WHEN 'Movie' THEN 1.2
          WHEN 'Series' THEN 1.2
          ELSE 1.0
        END
      as rank
    FROM ${items}
    WHERE ${items.serverId} = ${serverId}
      AND ${items.deletedAt} IS NULL
      AND (
        search_vector @@ plainto_tsquery('english', ${searchQuery})
        OR ${items.name} ILIKE ${`%${query}%`}
        OR ${items.seriesName} ILIKE ${`%${query}%`}
        OR word_similarity(${query}, ${items.name}) > 0.3
        OR word_similarity(${query}, ${items.seriesName}) > 0.3
      )
    ORDER BY rank DESC, ${items.communityRating} DESC NULLS LAST
    LIMIT ${limit}
  `);

  return [...results].map((item) => {
    let subtitle = "";
    if (item.type === "Episode" && item.series_name) {
      subtitle = item.series_name;
      if (item.parent_index_number !== null && item.index_number !== null) {
        subtitle += ` - S${item.parent_index_number}E${item.index_number}`;
      }
    } else if (item.type === "Season" && item.series_name) {
      subtitle = item.series_name;
    } else if (item.production_year) {
      subtitle = String(item.production_year);
    }

    // Use series image for episodes if available
    const imageId =
      item.type === "Episode" && item.series_id ? item.series_id : item.id;
    const imageTag =
      item.type === "Episode" && item.series_primary_image_tag
        ? item.series_primary_image_tag
        : item.primary_image_tag;

    return {
      id: item.id,
      type: "item" as const,
      subtype: item.type,
      title: item.name,
      subtitle,
      imageId,
      imageTag: imageTag ?? undefined,
      href: `/library/${item.id}`,
      rank: item.rank,
    };
  });
}

/**
 * Search users
 */
async function searchUsers(
  serverId: number,
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const searchQuery = buildTsQuery(query);
  if (!searchQuery) return [];

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      isAdministrator: users.isAdministrator,
      rank: sql<number>`CASE
        WHEN search_vector IS NOT NULL
        THEN ts_rank_cd(search_vector, plainto_tsquery('english', ${searchQuery}))
        ELSE 0
      END`.as("rank"),
    })
    .from(users)
    .where(
      and(
        eq(users.serverId, serverId),
        or(
          sql`search_vector @@ plainto_tsquery('english', ${searchQuery})`,
          ilike(users.name, `%${query}%`),
        ),
      ),
    )
    .orderBy(desc(sql`rank`))
    .limit(limit);

  return results.map((user) => ({
    id: user.id,
    type: "user" as const,
    title: user.name,
    subtitle: user.isAdministrator ? "Administrator" : "User",
    href: `/users/${user.id}`,
    rank: user.rank,
  }));
}

/**
 * Search watchlists
 */
async function searchWatchlists(
  serverId: number,
  query: string,
  userId: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const searchQuery = buildTsQuery(query);
  if (!searchQuery) return [];

  const results = await db
    .select({
      id: watchlists.id,
      name: watchlists.name,
      description: watchlists.description,
      isPublic: watchlists.isPublic,
      ownerId: watchlists.userId,
      rank: sql<number>`CASE
        WHEN search_vector IS NOT NULL
        THEN ts_rank_cd(search_vector, plainto_tsquery('english', ${searchQuery}))
        ELSE 0
      END`.as("rank"),
    })
    .from(watchlists)
    .where(
      and(
        eq(watchlists.serverId, serverId),
        or(eq(watchlists.userId, userId), eq(watchlists.isPublic, true)),
        or(
          sql`search_vector @@ plainto_tsquery('english', ${searchQuery})`,
          ilike(watchlists.name, `%${query}%`),
        ),
      ),
    )
    .orderBy(desc(sql`rank`))
    .limit(limit);

  return results.map((wl) => ({
    id: String(wl.id),
    type: "watchlist" as const,
    title: wl.name,
    subtitle: wl.description ?? (wl.isPublic ? "Public" : "Private"),
    href: `/watchlists/${wl.id}`,
    metadata: wl.ownerId === userId ? { owner: "You" } : undefined,
    rank: wl.rank,
  }));
}

/**
 * Search activities
 */
async function searchActivities(
  serverId: number,
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const searchQuery = buildTsQuery(query);
  if (!searchQuery) return [];

  const results = await db
    .select({
      id: activities.id,
      name: activities.name,
      shortOverview: activities.shortOverview,
      type: activities.type,
      date: activities.date,
      severity: activities.severity,
      rank: sql<number>`CASE
        WHEN search_vector IS NOT NULL
        THEN ts_rank_cd(search_vector, plainto_tsquery('english', ${searchQuery}))
        ELSE 0
      END`.as("rank"),
    })
    .from(activities)
    .where(
      and(
        eq(activities.serverId, serverId),
        or(
          sql`search_vector @@ plainto_tsquery('english', ${searchQuery})`,
          ilike(activities.name, `%${query}%`),
        ),
      ),
    )
    .orderBy(desc(sql`rank`), desc(activities.date))
    .limit(limit);

  return results.map((activity) => ({
    id: activity.id,
    type: "activity" as const,
    subtype: activity.type,
    title: activity.name,
    subtitle: activity.shortOverview ?? activity.type,
    href: `/activities?search=${encodeURIComponent(activity.name)}`,
    metadata: {
      severity: activity.severity,
      date: activity.date.toISOString(),
    },
    rank: activity.rank,
  }));
}

/**
 * Search sessions/history (uses ILIKE since sessions don't have search_vector)
 */
async function searchSessions(
  serverId: number,
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const results = await db
    .select({
      id: sessions.id,
      itemName: sessions.itemName,
      seriesName: sessions.seriesName,
      userName: sessions.userName,
      deviceName: sessions.deviceName,
      clientName: sessions.clientName,
      startTime: sessions.startTime,
      itemId: sessions.itemId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        or(
          ilike(sessions.itemName, `%${query}%`),
          ilike(sessions.seriesName, `%${query}%`),
          ilike(sessions.userName, `%${query}%`),
          ilike(sessions.deviceName, `%${query}%`),
          ilike(sessions.clientName, `%${query}%`),
        ),
      ),
    )
    .orderBy(desc(sessions.startTime))
    .limit(limit);

  return results.map((session) => ({
    id: session.id,
    type: "session" as const,
    title: session.itemName ?? "Unknown",
    subtitle: `${session.userName} - ${session.clientName ?? session.deviceName ?? "Unknown device"}`,
    href: `/history?search=${encodeURIComponent(session.itemName ?? "")}`,
    metadata: {
      date: session.startTime?.toISOString() ?? "",
    },
  }));
}

/**
 * Search people (actors, directors, etc.) using the normalized people table
 * Uses GIN trigram indexes and full-text search for fast fuzzy matching
 * Note: type is now stored per item-person relationship, so we get the most common type
 */
async function searchActors(
  serverId: number,
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const searchQuery = buildTsQuery(query);

  // Query the normalized people table with proper indexes
  // Uses GIN trigram index for ILIKE and word_similarity
  // Uses GIN index on search_vector for full-text search
  // Joins with item_people to get the most common type for each person
  const results = await db.execute<{
    id: string;
    name: string;
    primary_type: string;
    primary_image_tag: string | null;
    similarity_score: number;
  }>(sql`
    SELECT
      p.id as id,
      p.name as name,
      COALESCE(
        (
          SELECT ip.type
          FROM item_people ip
          WHERE ip.person_id = p.id AND ip.server_id = p.server_id
          GROUP BY ip.type
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ),
        'Unknown'
      ) as primary_type,
      p.primary_image_tag as primary_image_tag,
      GREATEST(
        word_similarity(${query}, p.name),
        CASE WHEN p.name ILIKE ${`%${query}%`} THEN 1.0 ELSE 0 END,
        CASE
          WHEN p.search_vector IS NOT NULL
          THEN ts_rank_cd(p.search_vector, plainto_tsquery('english', ${searchQuery}))
          ELSE 0
        END
      ) as similarity_score
    FROM people p
    WHERE p.server_id = ${serverId}
      AND (
        p.name ILIKE ${`%${query}%`}
        OR word_similarity(${query}, p.name) > 0.3
        OR p.search_vector @@ plainto_tsquery('english', ${searchQuery})
      )
    ORDER BY similarity_score DESC
    LIMIT ${limit}
  `);

  return [...results].map((person) => ({
    id: person.id,
    type: "actor" as const,
    subtype: person.primary_type,
    title: person.name,
    subtitle: person.primary_type,
    imageId: person.id,
    imageTag: person.primary_image_tag ?? undefined,
    href: `/actors/${encodeURIComponent(person.id)}`,
    rank: person.similarity_score,
  }));
}

/**
 * Global search across all entity types
 */
export async function globalSearch(
  serverId: number,
  query: string,
  userId: string,
  options: {
    itemLimit?: number;
    userLimit?: number;
    watchlistLimit?: number;
    activityLimit?: number;
    sessionLimit?: number;
    actorLimit?: number;
  } = {},
): Promise<SearchResults> {
  const {
    itemLimit = 10,
    userLimit = 5,
    watchlistLimit = 5,
    activityLimit = 5,
    sessionLimit = 5,
    actorLimit = 5,
  } = options;

  if (!query.trim()) {
    return {
      items: [],
      users: [],
      watchlists: [],
      activities: [],
      sessions: [],
      actors: [],
      total: 0,
    };
  }

  // Execute all searches in parallel
  const [
    itemResults,
    userResults,
    watchlistResults,
    activityResults,
    sessionResults,
    actorResults,
  ] = await Promise.all([
    searchItems(serverId, query, itemLimit),
    searchUsers(serverId, query, userLimit),
    searchWatchlists(serverId, query, userId, watchlistLimit),
    searchActivities(serverId, query, activityLimit),
    searchSessions(serverId, query, sessionLimit),
    searchActors(serverId, query, actorLimit),
  ]);

  const total =
    itemResults.length +
    userResults.length +
    watchlistResults.length +
    activityResults.length +
    sessionResults.length +
    actorResults.length;

  return {
    items: itemResults,
    users: userResults,
    watchlists: watchlistResults,
    activities: activityResults,
    sessions: sessionResults,
    actors: actorResults,
    total,
  };
}
