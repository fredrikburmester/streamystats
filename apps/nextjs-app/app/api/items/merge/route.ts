import {
  db,
  hiddenRecommendations,
  items,
  sessions,
} from "@streamystats/database";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { leftId, rightId } = body;

    if (!leftId || !rightId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Both leftId and rightId are required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (leftId === rightId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Left and right IDs must be different",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const [leftItem, rightItem] = await Promise.all([
      db
        .select()
        .from(items)
        .where(
          and(
            eq(items.id, leftId),
            eq(items.serverId, session.serverId),
            isNull(items.deletedAt),
          ),
        )
        .limit(1),
      db
        .select()
        .from(items)
        .where(
          and(
            eq(items.id, rightId),
            eq(items.serverId, session.serverId),
            isNull(items.deletedAt),
          ),
        )
        .limit(1),
    ]);

    if (leftItem.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Left item with ID ${leftId} not found or already deleted`,
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (rightItem.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Right item with ID ${rightId} not found or already deleted`,
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const serverId = leftItem[0].serverId;

    if (session.serverId !== serverId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Admin privileges required for this server",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (serverId !== rightItem[0].serverId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Items must be from the same server",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const result = await db.transaction(async (tx) => {
      const migratedSessions = await tx
        .update(sessions)
        .set({ itemId: rightId })
        .where(
          and(eq(sessions.serverId, serverId), eq(sessions.itemId, leftId)),
        )
        .returning({ id: sessions.id });

      const existingRightRecs = await tx
        .select({ userId: hiddenRecommendations.userId })
        .from(hiddenRecommendations)
        .where(
          and(
            eq(hiddenRecommendations.serverId, serverId),
            eq(hiddenRecommendations.itemId, rightId),
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
              eq(hiddenRecommendations.itemId, leftId),
              inArray(hiddenRecommendations.userId, existingUserIds),
            ),
          )
          .returning({ id: hiddenRecommendations.id });
        deletedDuplicateRecs = deleted.length;
      }

      const migratedRecs = await tx
        .update(hiddenRecommendations)
        .set({ itemId: rightId })
        .where(
          and(
            eq(hiddenRecommendations.serverId, serverId),
            eq(hiddenRecommendations.itemId, leftId),
          ),
        )
        .returning({ id: hiddenRecommendations.id });

      await tx
        .delete(items)
        .where(and(eq(items.id, leftId), eq(items.serverId, session.serverId)));

      return {
        sessionsMigrated: migratedSessions.length,
        hiddenRecommendationsMigrated: migratedRecs.length,
        duplicateRecsRemoved: deletedDuplicateRecs,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully merged item ${leftId} into ${rightId}`,
        metrics: result,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error merging items:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to merge items",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
