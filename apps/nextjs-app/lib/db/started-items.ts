import "server-only";

import { db } from "@streamystats/database";
import { items, servers, sessions } from "@streamystats/database/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

/** The server's "recommend only titles the user has never started" setting. */
export async function isExcludeStartedEnabled(
  serverId: number,
): Promise<boolean> {
  const rows = await db
    .select({ enabled: servers.recommendationsExcludeStarted })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  return rows[0]?.enabled === true;
}

/**
 * Every movie and series the user has started in any way: a session of any
 * length on the item, any episode of the series, or any of these on another
 * copy of the same title (matched by TMDB id) -- a library often holds the
 * same movie twice, and having watched one copy means the other is not new.
 */
export async function getStartedItemIds({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<string[]> {
  const startedRows = await db
    .selectDistinct({ itemId: sessions.itemId, seriesId: sessions.seriesId })
    .from(sessions)
    .where(and(eq(sessions.serverId, serverId), eq(sessions.userId, userId)));

  const started = new Set<string>();
  // An episode session carries its series id; only movies and series are ever
  // recommended, so episode ids themselves would only bloat the exclusion.
  for (const row of startedRows) {
    if (row.seriesId) started.add(row.seriesId);
    else if (row.itemId) started.add(row.itemId);
  }
  if (started.size === 0) return [];

  const startedIds = [...started];
  const tmdb = sql<string>`${items.providerIds}->>'Tmdb'`;
  const tmdbIds = new Set<string>();
  for (let i = 0; i < startedIds.length; i += 5000) {
    const rows = await db
      .select({ type: items.type, tmdb })
      .from(items)
      .where(
        and(
          inArray(items.id, startedIds.slice(i, i + 5000)),
          inArray(items.type, ["Movie", "Series"]),
          isNotNull(sql`${items.providerIds}->>'Tmdb'`),
        ),
      );
    for (const row of rows) {
      if (row.tmdb) tmdbIds.add(`${row.type}:${row.tmdb}`);
    }
  }

  if (tmdbIds.size > 0) {
    const copies = await db
      .select({ id: items.id, type: items.type, tmdb })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          inArray(items.type, ["Movie", "Series"]),
          inArray(sql`${items.providerIds}->>'Tmdb'`, [
            ...new Set([...tmdbIds].map((key) => key.split(":")[1] ?? "")),
          ]),
        ),
      );
    for (const copy of copies) {
      if (copy.tmdb && tmdbIds.has(`${copy.type}:${copy.tmdb}`)) {
        started.add(copy.id);
      }
    }
  }

  return [...started];
}

/** Started titles to exclude, or none when the server setting is off. */
export async function getExcludedStartedIds({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<string[]> {
  if (!(await isExcludeStartedEnabled(serverId))) return [];
  return getStartedItemIds({ serverId, userId });
}
