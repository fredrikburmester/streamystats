import {
  db,
  hiddenRecommendations,
  items,
  sessions,
} from "@streamystats/database";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

interface MergeResult {
  sessionsMigrated: number;
  recsMigrated: number;
  duplicateRecsRemoved: number;
}

async function mergeSinglePair(
  deletedItemId: string,
  activeItemId: string,
  serverId: number,
): Promise<MergeResult> {
  return await db.transaction(async (tx) => {
    const migratedSessions = await tx
      .update(sessions)
      .set({ itemId: activeItemId })
      .where(
        and(
          eq(sessions.serverId, serverId),
          eq(sessions.itemId, deletedItemId),
        ),
      )
      .returning({ id: sessions.id });

    const existingRightRecs = await tx
      .select({ userId: hiddenRecommendations.userId })
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.itemId, activeItemId),
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
            eq(hiddenRecommendations.itemId, deletedItemId),
            inArray(hiddenRecommendations.userId, existingUserIds),
          ),
        )
        .returning({ id: hiddenRecommendations.id });
      deletedDuplicateRecs = deleted.length;
    }

    const migratedRecs = await tx
      .update(hiddenRecommendations)
      .set({ itemId: activeItemId })
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.itemId, deletedItemId),
        ),
      )
      .returning({ id: hiddenRecommendations.id });

    await tx
      .delete(items)
      .where(and(eq(items.id, deletedItemId), eq(items.serverId, serverId)));

    return {
      sessionsMigrated: migratedSessions.length,
      recsMigrated: migratedRecs.length,
      duplicateRecsRemoved: deletedDuplicateRecs,
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serverId } = body as { serverId: number };

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

    const deletedItemsSub = db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        productionYear: items.productionYear,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.type, "Movie"),
          isNotNull(items.deletedAt),
          isNotNull(items.productionYear),
        ),
      )
      .as("deleted_items");

    const activeItemsSub = db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        productionYear: items.productionYear,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.type, "Movie"),
          isNull(items.deletedAt),
          isNotNull(items.productionYear),
        ),
      )
      .as("active_items");

    const matches = await db
      .select({
        deletedId: deletedItemsSub.id,
        activeId: activeItemsSub.id,
      })
      .from(deletedItemsSub)
      .innerJoin(
        activeItemsSub,
        and(
          sql`lower(${deletedItemsSub.name}) = lower(${activeItemsSub.name})`,
          eq(deletedItemsSub.productionYear, activeItemsSub.productionYear),
          eq(deletedItemsSub.type, activeItemsSub.type),
        ),
      );

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No matches found to merge",
          metrics: {
            itemsMerged: 0,
            sessionsMigrated: 0,
            hiddenRecommendationsMigrated: 0,
            duplicateRecsRemoved: 0,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let totalSessionsMigrated = 0;
    let totalRecsMigrated = 0;
    let totalItemsDeleted = 0;
    let totalDuplicateRecsRemoved = 0;
    const errors: string[] = [];

    for (const match of matches) {
      try {
        const result = await mergeSinglePair(
          match.deletedId,
          match.activeId,
          serverId,
        );
        totalSessionsMigrated += result.sessionsMigrated;
        totalRecsMigrated += result.recsMigrated;
        totalDuplicateRecsRemoved += result.duplicateRecsRemoved;
        totalItemsDeleted++;
      } catch (pairError) {
        errors.push(
          `Error merging ${match.deletedId} -> ${match.activeId}: ${
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
      message = `Merged ${totalItemsDeleted} of ${matches.length} items (${errors.length} failed)`;
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
    console.error("Error merging all dangerous matches:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to merge all items",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
