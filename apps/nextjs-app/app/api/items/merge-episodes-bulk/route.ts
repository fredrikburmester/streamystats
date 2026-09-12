import {
  db,
  hiddenRecommendations,
  items,
  sessions,
} from "@streamystats/database";
import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

interface EpisodePair {
  deletedEpisodeId: string;
  activeEpisodeId: string;
}

interface MergeResult {
  sessionsMigrated: number;
  recsMigrated: number;
  duplicateRecsRemoved: number;
}

async function mergeSingleEpisode(
  pair: EpisodePair,
  serverId: number,
): Promise<MergeResult> {
  return await db.transaction(async (tx) => {
    // Migrate sessions
    const migratedSessions = await tx
      .update(sessions)
      .set({ itemId: pair.activeEpisodeId })
      .where(
        and(
          eq(sessions.serverId, serverId),
          eq(sessions.itemId, pair.deletedEpisodeId),
        ),
      )
      .returning({ id: sessions.id });

    // Handle hidden recommendations - avoid duplicates
    const existingRecs = await tx
      .select({ userId: hiddenRecommendations.userId })
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.itemId, pair.activeEpisodeId),
        ),
      );
    const existingUserIds = existingRecs.map((r) => r.userId);

    let deletedDuplicateRecs = 0;
    if (existingUserIds.length > 0) {
      const deleted = await tx
        .delete(hiddenRecommendations)
        .where(
          and(
            eq(hiddenRecommendations.serverId, serverId),
            eq(hiddenRecommendations.itemId, pair.deletedEpisodeId),
            inArray(hiddenRecommendations.userId, existingUserIds),
          ),
        )
        .returning({ id: hiddenRecommendations.id });
      deletedDuplicateRecs = deleted.length;
    }

    // Migrate remaining hidden recommendations
    const migratedRecs = await tx
      .update(hiddenRecommendations)
      .set({ itemId: pair.activeEpisodeId })
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.itemId, pair.deletedEpisodeId),
        ),
      )
      .returning({ id: hiddenRecommendations.id });

    // Delete the old episode
    await tx.delete(items).where(eq(items.id, pair.deletedEpisodeId));

    return {
      sessionsMigrated: migratedSessions.length,
      recsMigrated: migratedRecs.length,
      duplicateRecsRemoved: deletedDuplicateRecs,
    };
  });
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { pairs } = body as { pairs: EpisodePair[] };

    if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "pairs array is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let totalSessionsMigrated = 0;
    let totalRecsMigrated = 0;
    let totalEpisodesDeleted = 0;
    let totalDuplicateRecsRemoved = 0;
    const errors: string[] = [];

    for (const pair of pairs) {
      try {
        if (pair.deletedEpisodeId === pair.activeEpisodeId) {
          errors.push(
            `Cannot merge episode ${pair.deletedEpisodeId} into itself`,
          );
          continue;
        }

        // Validate deleted episode exists and is deleted
        const deletedEpisode = await db
          .select()
          .from(items)
          .where(eq(items.id, pair.deletedEpisodeId))
          .limit(1);

        if (deletedEpisode.length === 0) {
          errors.push(`Deleted episode ${pair.deletedEpisodeId} not found`);
          continue;
        }

        if (!deletedEpisode[0].deletedAt) {
          errors.push(`Episode ${pair.deletedEpisodeId} is not deleted`);
          continue;
        }

        if (deletedEpisode[0].type !== "Episode") {
          errors.push(`Item ${pair.deletedEpisodeId} is not an Episode`);
          continue;
        }

        // Validate active episode exists and is not deleted
        const activeEpisode = await db
          .select()
          .from(items)
          .where(eq(items.id, pair.activeEpisodeId))
          .limit(1);

        if (activeEpisode.length === 0) {
          errors.push(`Active episode ${pair.activeEpisodeId} not found`);
          continue;
        }

        if (activeEpisode[0].deletedAt) {
          errors.push(`Target episode ${pair.activeEpisodeId} is deleted`);
          continue;
        }

        if (activeEpisode[0].type !== "Episode") {
          errors.push(`Target item ${pair.activeEpisodeId} is not an Episode`);
          continue;
        }

        const { serverId } = deletedEpisode[0];
        if (session.serverId !== serverId) {
          errors.push(
            `Episode ${pair.deletedEpisodeId} does not belong to your server`,
          );
          continue;
        }

        if (serverId !== activeEpisode[0].serverId) {
          errors.push(
            `Episodes ${pair.deletedEpisodeId} and ${pair.activeEpisodeId} are from different servers`,
          );
          continue;
        }

        const result = await mergeSingleEpisode(pair, serverId);
        totalSessionsMigrated += result.sessionsMigrated;
        totalRecsMigrated += result.recsMigrated;
        totalDuplicateRecsRemoved += result.duplicateRecsRemoved;
        totalEpisodesDeleted++;
      } catch (pairError) {
        errors.push(
          `Error merging ${pair.deletedEpisodeId} -> ${pair.activeEpisodeId}: ${
            pairError instanceof Error ? pairError.message : "Unknown error"
          }`,
        );
      }
    }

    const allSucceeded = errors.length === 0;
    const someSucceeded = totalEpisodesDeleted > 0;

    let message: string;
    if (allSucceeded) {
      message = `Successfully merged ${totalEpisodesDeleted} episodes`;
    } else if (someSucceeded) {
      message = `Merged ${totalEpisodesDeleted} of ${pairs.length} episodes (${errors.length} skipped)`;
    } else {
      message = "No episodes were merged";
    }

    return new Response(
      JSON.stringify({
        success: someSucceeded,
        message,
        metrics: {
          episodesMerged: totalEpisodesDeleted,
          sessionsMigrated: totalSessionsMigrated,
          hiddenRecommendationsMigrated: totalRecsMigrated,
          duplicateRecsRemoved: totalDuplicateRecsRemoved,
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error merging episodes in bulk:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to merge episodes",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
