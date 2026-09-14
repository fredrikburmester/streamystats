import {
  db,
  hiddenRecommendations,
  items,
  sessions,
} from "@streamystats/database";
import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

interface MergePair {
  deletedItemId: string;
  activeItemId: string;
}

interface MergeResult {
  sessionsMigrated: number;
  recsMigrated: number;
  duplicateRecsRemoved: number;
}

async function mergeSinglePair(
  pair: MergePair,
  serverId: number,
): Promise<MergeResult> {
  return await db.transaction(async (tx) => {
    const migratedSessions = await tx
      .update(sessions)
      .set({ itemId: pair.activeItemId })
      .where(
        and(
          eq(sessions.serverId, serverId),
          eq(sessions.itemId, pair.deletedItemId),
        ),
      )
      .returning({ id: sessions.id });

    const existingRightRecs = await tx
      .select({ userId: hiddenRecommendations.userId })
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.itemId, pair.activeItemId),
        ),
      );
    const existingUserIds = existingRightRecs.map((r) => r.userId);

    let deletedDuplicateRecs = 0;
    if (existingUserIds.length > 0) {
      const deleted = await tx
        .delete(hiddenRecommendations)
        .where(
          and(
            eq(hiddenRecommendations.serverId, serverId),
            eq(hiddenRecommendations.itemId, pair.deletedItemId),
            inArray(hiddenRecommendations.userId, existingUserIds),
          ),
        )
        .returning({ id: hiddenRecommendations.id });
      deletedDuplicateRecs = deleted.length;
    }

    const migratedRecs = await tx
      .update(hiddenRecommendations)
      .set({ itemId: pair.activeItemId })
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.itemId, pair.deletedItemId),
        ),
      )
      .returning({ id: hiddenRecommendations.id });

    await tx
      .delete(items)
      .where(
        and(eq(items.id, pair.deletedItemId), eq(items.serverId, serverId)),
      );

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
    const { pairs } = body as { pairs: MergePair[] };

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
    let totalItemsDeleted = 0;
    let totalDuplicateRecsRemoved = 0;
    const errors: string[] = [];

    for (const pair of pairs) {
      try {
        if (pair.deletedItemId === pair.activeItemId) {
          errors.push(`Cannot merge item ${pair.deletedItemId} into itself`);
          continue;
        }

        const deletedItem = await db
          .select()
          .from(items)
          .where(
            and(
              eq(items.id, pair.deletedItemId),
              eq(items.serverId, session.serverId),
            ),
          )
          .limit(1);

        if (deletedItem.length === 0) {
          errors.push(`Deleted item ${pair.deletedItemId} not found`);
          continue;
        }

        if (!deletedItem[0].deletedAt) {
          errors.push(`Item ${pair.deletedItemId} is not deleted`);
          continue;
        }

        const activeItem = await db
          .select()
          .from(items)
          .where(
            and(
              eq(items.id, pair.activeItemId),
              eq(items.serverId, session.serverId),
            ),
          )
          .limit(1);

        if (activeItem.length === 0) {
          errors.push(`Active item ${pair.activeItemId} not found`);
          continue;
        }

        if (activeItem[0].deletedAt) {
          errors.push(`Target item ${pair.activeItemId} is deleted`);
          continue;
        }

        const serverId = deletedItem[0].serverId;
        if (session.serverId !== serverId) {
          errors.push(
            `Item ${pair.deletedItemId} does not belong to your server`,
          );
          continue;
        }

        if (serverId !== activeItem[0].serverId) {
          errors.push(
            `Items ${pair.deletedItemId} and ${pair.activeItemId} are from different servers`,
          );
          continue;
        }

        const result = await mergeSinglePair(pair, serverId);
        totalSessionsMigrated += result.sessionsMigrated;
        totalRecsMigrated += result.recsMigrated;
        totalDuplicateRecsRemoved += result.duplicateRecsRemoved;
        totalItemsDeleted++;
      } catch (pairError) {
        errors.push(
          `Error merging ${pair.deletedItemId} -> ${pair.activeItemId}: ${
            pairError instanceof Error ? pairError.message : "Unknown error"
          }`,
        );
      }
    }

    const allSucceeded = errors.length === 0;
    const someSucceeded = totalItemsDeleted > 0;

    let message: string;
    if (allSucceeded) {
      message = `Successfully merged ${totalItemsDeleted} items`;
    } else if (someSucceeded) {
      message = `Merged ${totalItemsDeleted} of ${pairs.length} items (${errors.length} skipped)`;
    } else {
      message = "No items were merged";
    }

    return new Response(
      JSON.stringify({
        success: someSucceeded,
        message,
        metrics: {
          itemsMerged: totalItemsDeleted,
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
    console.error("Error merging items in bulk:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to merge items",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
