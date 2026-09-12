import { db, items, libraries } from "@streamystats/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

interface RouteParams {
  params: Promise<{
    serverId: string;
  }>;
}

const LIBRARY_TYPES_WITH_PEOPLE = ["movies", "tvshows", "music"] as const;

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { serverId } = await params;

    const { error } = await requireAdmin(serverId);
    if (error) return error;

    if (!serverId) {
      return new Response(
        JSON.stringify({
          error: "Server ID is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const serverIdNum = Number.parseInt(serverId, 10);
    if (!Number.isFinite(serverIdNum)) {
      return new Response(
        JSON.stringify({
          error: "Invalid server ID",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Count total items that should have people data
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .innerJoin(libraries, eq(items.libraryId, libraries.id))
      .where(
        and(
          eq(items.serverId, serverIdNum),
          inArray(libraries.type, [...LIBRARY_TYPES_WITH_PEOPLE]),
        ),
      );

    const total = Number(totalResult[0]?.count ?? 0);

    // Count items that still need people sync
    const remainingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .innerJoin(libraries, eq(items.libraryId, libraries.id))
      .where(
        and(
          eq(items.serverId, serverIdNum),
          inArray(libraries.type, [...LIBRARY_TYPES_WITH_PEOPLE]),
          eq(items.peopleSynced, false),
        ),
      );

    const remaining = Number(remainingResult[0]?.count ?? 0);
    const synced = total - remaining;
    const progress = total > 0 ? Math.round((synced / total) * 100) : 100;
    const isComplete = remaining === 0;

    return new Response(
      JSON.stringify({
        success: true,
        total,
        synced,
        remaining,
        progress,
        isComplete,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching people sync progress:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch people sync progress",
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
