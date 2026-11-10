import { db, items, sessions } from "@streamystats/database";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

export interface DangerousMatch {
  deletedItem: {
    id: string;
    name: string;
    type: string;
    productionYear: number | null;
    deletedAt: Date;
  };
  activeItem: {
    id: string;
    name: string;
    type: string;
    productionYear: number | null;
  };
  sessionsCount: number;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serverId = url.searchParams.get("serverId");
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(
      Number.parseInt(url.searchParams.get("limit") || "100", 10),
      100,
    );
    const offset = (page - 1) * limit;

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

    const deletedItems = db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        productionYear: items.productionYear,
        deletedAt: items.deletedAt,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, "Movie"),
          isNotNull(items.deletedAt),
          isNotNull(items.productionYear),
        ),
      )
      .as("deleted_items");

    const activeItems = db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        productionYear: items.productionYear,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, "Movie"),
          isNull(items.deletedAt),
          isNotNull(items.productionYear),
        ),
      )
      .as("active_items");

    const joinCondition = and(
      sql`lower(${deletedItems.name}) = lower(${activeItems.name})`,
      eq(deletedItems.productionYear, activeItems.productionYear),
      eq(deletedItems.type, activeItems.type),
    );

    const [matches, totalResult] = await Promise.all([
      db
        .select({
          deletedId: deletedItems.id,
          deletedName: deletedItems.name,
          deletedType: deletedItems.type,
          deletedYear: deletedItems.productionYear,
          deletedAt: deletedItems.deletedAt,
          activeId: activeItems.id,
          activeName: activeItems.name,
          activeType: activeItems.type,
          activeYear: activeItems.productionYear,
        })
        .from(deletedItems)
        .innerJoin(activeItems, joinCondition)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(deletedItems)
        .innerJoin(activeItems, joinCondition),
    ]);

    const matchesWithSessions = await Promise.all(
      matches.map(async (match) => {
        const sessionCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(sessions)
          .where(
            and(
              eq(sessions.itemId, match.deletedId),
              eq(sessions.serverId, serverIdNum),
            ),
          );

        return {
          deletedItem: {
            id: match.deletedId,
            name: match.deletedName,
            type: match.deletedType,
            productionYear: match.deletedYear,
            deletedAt: match.deletedAt,
          },
          activeItem: {
            id: match.activeId,
            name: match.activeName,
            type: match.activeType,
            productionYear: match.activeYear,
          },
          sessionsCount: sessionCount[0]?.count ?? 0,
        } as DangerousMatch;
      }),
    );

    const total = totalResult[0]?.count || 0;

    return new Response(
      JSON.stringify({
        success: true,
        matches: matchesWithSessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error finding dangerous matches:", error);
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
