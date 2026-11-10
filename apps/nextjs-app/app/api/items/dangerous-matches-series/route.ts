import { db, items, sessions } from "@streamystats/database";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

interface DeletedEpisode {
  id: string;
  name: string;
  seriesName: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  productionYear: number | null;
  deletedAt: Date;
  sessionsCount: number;
}

interface ActiveEpisode {
  id: string;
  name: string;
  seriesName: string | null;
  seriesId: string | null;
  seasonId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

interface EpisodeMatch {
  deletedEpisode: DeletedEpisode;
  activeEpisode: ActiveEpisode | null;
}

interface SeriesGroup {
  seriesName: string;
  productionYear: number | null;
  deletedSeriesId: string | null;
  activeSeriesId: string | null;
  activeSeriesName: string | null;
  episodes: EpisodeMatch[];
  totalSessions: number;
  matchedCount: number;
  unmatchedCount: number;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serverId = url.searchParams.get("serverId");

    if (!serverId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "serverId is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { error } = await requireAdmin(serverId);
    if (error) return error;

    const serverIdNum = Number.parseInt(serverId, 10);
    if (Number.isNaN(serverIdNum)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "serverId must be a valid number",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Find all deleted episodes
    const deletedEpisodes = await db
      .select({
        id: items.id,
        name: items.name,
        seriesName: items.seriesName,
        seriesId: items.seriesId,
        seasonNumber: items.parentIndexNumber,
        episodeNumber: items.indexNumber,
        productionYear: items.productionYear,
        deletedAt: items.deletedAt,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, "Episode"),
          isNotNull(items.deletedAt),
          isNotNull(items.seriesName),
        ),
      );

    if (deletedEpisodes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          seriesGroups: [],
          summary: {
            totalDeletedEpisodes: 0,
            totalSeries: 0,
            totalSessions: 0,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get session counts for deleted episodes
    const sessionCounts = await db
      .select({
        itemId: sessions.itemId,
        count: sql<number>`count(*)::int`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.serverId, serverIdNum),
          sql`${sessions.itemId} IN (${sql.join(
            deletedEpisodes.map((e) => sql`${e.id}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(sessions.itemId);

    const sessionCountMap = new Map(
      sessionCounts.map((s) => [s.itemId, s.count]),
    );

    // Find all active episodes for matching
    const activeEpisodes = await db
      .select({
        id: items.id,
        name: items.name,
        seriesName: items.seriesName,
        seriesId: items.seriesId,
        seasonId: items.seasonId,
        seasonNumber: items.parentIndexNumber,
        episodeNumber: items.indexNumber,
        productionYear: items.productionYear,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, "Episode"),
          isNull(items.deletedAt),
          isNotNull(items.seriesName),
        ),
      );

    // Build a map for quick matching: seriesName:seasonNum:episodeNum -> activeEpisode
    const activeEpisodeMap = new Map<string, (typeof activeEpisodes)[0]>();
    for (const ep of activeEpisodes) {
      if (
        ep.seriesName &&
        ep.seasonNumber !== null &&
        ep.episodeNumber !== null
      ) {
        // Key with production year
        if (ep.productionYear) {
          const keyWithYear = `${ep.seriesName.toLowerCase()}:${
            ep.productionYear
          }:${ep.seasonNumber}:${ep.episodeNumber}`;
          activeEpisodeMap.set(keyWithYear, ep);
        }
        // Key without production year (fallback)
        const keyNoYear = `${ep.seriesName.toLowerCase()}:${ep.seasonNumber}:${
          ep.episodeNumber
        }`;
        if (!activeEpisodeMap.has(keyNoYear)) {
          activeEpisodeMap.set(keyNoYear, ep);
        }
      }
    }

    // Group deleted episodes by series
    const seriesGroupsMap = new Map<string, SeriesGroup>();

    for (const deleted of deletedEpisodes) {
      const seriesKey = `${deleted.seriesName?.toLowerCase()}:${
        deleted.productionYear ?? "unknown"
      }`;

      // Find matching active episode
      let matchingActive: (typeof activeEpisodes)[0] | null = null;

      if (
        deleted.seriesName &&
        deleted.seasonNumber !== null &&
        deleted.episodeNumber !== null
      ) {
        // Try with production year first
        if (deleted.productionYear) {
          const keyWithYear = `${deleted.seriesName.toLowerCase()}:${
            deleted.productionYear
          }:${deleted.seasonNumber}:${deleted.episodeNumber}`;
          matchingActive = activeEpisodeMap.get(keyWithYear) ?? null;
        }
        // Fallback without year
        if (!matchingActive) {
          const keyNoYear = `${deleted.seriesName.toLowerCase()}:${
            deleted.seasonNumber
          }:${deleted.episodeNumber}`;
          matchingActive = activeEpisodeMap.get(keyNoYear) ?? null;
        }
      }

      const sessionsCount = sessionCountMap.get(deleted.id) ?? 0;

      const episodeMatch: EpisodeMatch = {
        deletedEpisode: {
          id: deleted.id,
          name: deleted.name,
          seriesName: deleted.seriesName,
          seasonNumber: deleted.seasonNumber,
          episodeNumber: deleted.episodeNumber,
          productionYear: deleted.productionYear,
          deletedAt: deleted.deletedAt!,
          sessionsCount,
        },
        activeEpisode: matchingActive
          ? {
              id: matchingActive.id,
              name: matchingActive.name,
              seriesName: matchingActive.seriesName,
              seriesId: matchingActive.seriesId,
              seasonId: matchingActive.seasonId,
              seasonNumber: matchingActive.seasonNumber,
              episodeNumber: matchingActive.episodeNumber,
            }
          : null,
      };

      if (!seriesGroupsMap.has(seriesKey)) {
        seriesGroupsMap.set(seriesKey, {
          seriesName: deleted.seriesName ?? "Unknown Series",
          productionYear: deleted.productionYear,
          deletedSeriesId: deleted.seriesId,
          activeSeriesId: matchingActive?.seriesId ?? null,
          activeSeriesName: matchingActive?.seriesName ?? null,
          episodes: [],
          totalSessions: 0,
          matchedCount: 0,
          unmatchedCount: 0,
        });
      }

      const group = seriesGroupsMap.get(seriesKey)!;
      group.episodes.push(episodeMatch);
      group.totalSessions += sessionsCount;
      if (matchingActive) {
        group.matchedCount++;
        // Update active series info if not set
        if (!group.activeSeriesId) {
          group.activeSeriesId = matchingActive.seriesId;
          group.activeSeriesName = matchingActive.seriesName;
        }
      } else {
        group.unmatchedCount++;
      }
    }

    // Sort episodes within each group by season and episode number
    const seriesGroups = Array.from(seriesGroupsMap.values()).map((group) => {
      group.episodes.sort((a, b) => {
        const seasonA = a.deletedEpisode.seasonNumber ?? 0;
        const seasonB = b.deletedEpisode.seasonNumber ?? 0;
        if (seasonA !== seasonB) return seasonA - seasonB;
        const epA = a.deletedEpisode.episodeNumber ?? 0;
        const epB = b.deletedEpisode.episodeNumber ?? 0;
        return epA - epB;
      });
      return group;
    });

    // Sort series by total sessions (most sessions first)
    seriesGroups.sort((a, b) => b.totalSessions - a.totalSessions);

    const totalSessions = seriesGroups.reduce(
      (sum, g) => sum + g.totalSessions,
      0,
    );

    return new Response(
      JSON.stringify({
        success: true,
        seriesGroups,
        summary: {
          totalDeletedEpisodes: deletedEpisodes.length,
          totalSeries: seriesGroups.length,
          totalSessions,
          totalMatched: seriesGroups.reduce(
            (sum, g) => sum + g.matchedCount,
            0,
          ),
          totalUnmatched: seriesGroups.reduce(
            (sum, g) => sum + g.unmatchedCount,
            0,
          ),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error finding dangerous series matches:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to find matches",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
